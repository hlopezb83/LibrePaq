import { Hono, type Context } from 'hono';
import { readBodyCompanyId, readQueryCompanyId, resolveRequestActor } from '../auth-actor';
import {
  createFixedAssetRecord,
  db,
  deleteFixedAssetRecord,
  generateExchangeFluctuationPoliza,
  generateMonthlyDepreciationPoliza,
  generateTaxProvisionPoliza,
  getCxcCxpAgingRepo,
  getFiscalWorkpaperReport,
  getFixedAssetsResponse,
  getPeriodLock,
  getTaxParameters,
  saveTaxParameters,
  setPeriodLock,
  syncThirdPartiesFromCfdis
} from '../db';
import {
  deleteCustomInpcEntrySqlite,
  listCustomInpcEntriesSqlite,
  retireFixedAssetRecord,
  updateFixedAssetRecord,
  upsertCustomInpcEntrySqlite
} from '../repositories/fixed-assets.repo';
import { deleteThirdPartyRecord, upsertThirdPartyRecord as upsertTpDirect } from '../repositories/third-parties.repo';
import { resolveYearAndPeriod } from '../validators';
import { assertRouteCompanyAccess, errorStatus, getAuthorizedCompanyForRoute } from './route-helpers';
import type { Efos69BStatus, FixedAssetCategory, VehicleCapType } from '../../shared/types';
import type { DespachoRole } from '../../shared/types/despacho-rbac.types';

export const fiscalRoutes = new Hono();

function resolveQueryCompany(c: Context) {
  const q = readQueryCompanyId(c);
  if (!q.ok) return { err: q.response, company: null };
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return { err: denied, company: null };
  const company = getAuthorizedCompanyForRoute(c, q.companyId);
  return company ? { err: null, company } : { err: c.json({ error: 'Empresa no encontrada' }, 404), company: null };
}

function resolveBodyCompany(c: Context, body: Record<string, unknown>, minRole?: DespachoRole) {
  const cid = readBodyCompanyId(c, body);
  if (!cid.ok) return { err: cid.response, company: null };
  const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true, minRole });
  if (denied) return { err: denied, company: null };
  const company = getAuthorizedCompanyForRoute(c, cid.companyId);
  return company ? { err: null, company } : { err: c.json({ error: 'Empresa no encontrada' }, 404), company: null };
}

function routeErr(c: Context, err: unknown) {
  const { message, status } = errorStatus(err);
  return c.json({ error: message }, status);
}

// Period Locks
fiscalRoutes.get('/period-locks', (c) => {
  const { err, company } = resolveQueryCompany(c);
  if (err || !company) return err!;
  const { year, period } = resolveYearAndPeriod(c.req.query('year'), c.req.query('period'), company);
  return c.json(getPeriodLock(company.id, year, period));
});

fiscalRoutes.post('/period-locks', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const { err, company } = resolveBodyCompany(c, body, 'CONTADOR');
    if (err || !company) return err!;
    return c.json(setPeriodLock(company.id, Number(body.ejercicio ?? company.currentYear), Number(body.periodo ?? company.currentPeriod), Boolean(body.isLocked), String(body.notes ?? '')));
  } catch (err) {
    return routeErr(c, err);
  }
});

// Third Parties (Padrón Fiscal y 69-B)
fiscalRoutes.get('/third-parties', (c) => {
  const { err, company } = resolveQueryCompany(c);
  if (err || !company) return err!;
  return c.json(syncThirdPartiesFromCfdis(company.id));
});

fiscalRoutes.post('/third-parties', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const { err, company } = resolveBodyCompany(c, body);
    if (err || !company) return err!;
    const rfc = String(body.rfc ?? '').trim().toUpperCase();
    const nombre = String(body.nombre ?? '').trim();
    if (!rfc || !nombre) return c.json({ error: 'RFC y Razón Social son obligatorios.' }, 400);
    const rolRaw = String(body.rol ?? 'PROVEEDOR').toUpperCase();
    const rol = (['PROVEEDOR', 'CLIENTE', 'AMBOS'].includes(rolRaw) ? rolRaw : 'PROVEEDOR') as 'PROVEEDOR' | 'CLIENTE' | 'AMBOS';
    const rawTercero = String(body.tipoTerceroDiot ?? '04');
    const tipoTerceroDiot = (['04', '05', '15'].includes(rawTercero) ? rawTercero : '04') as '04' | '05' | '15';
    const opDiotRaw = String(body.tipoOperacionDiot ?? '85');
    const tipoOperacionDiot = (['02', '03', '06', '07', '08', '85', '87'].includes(opDiotRaw) ? opDiotRaw : '85') as '02' | '03' | '06' | '07' | '08' | '85' | '87';
    const tasaNum = Number(body.tasaIvaDefault ?? 16);
    const tasaIvaDefault = (tasaNum === 8 ? 8 : tasaNum === 0 ? 0 : 16) as 16 | 8 | 0;
    const efosRaw = String(body.estatus69B ?? 'LIMPIO').toUpperCase();
    const estatus69B = (['LIMPIO', 'PRESUNTO_EFOS', 'DEFINITIVO_EFOS', 'DESVIRTUADO'].includes(efosRaw) ? efosRaw : 'LIMPIO') as Efos69BStatus;

    return c.json(upsertTpDirect(company.id, {
      rfc, nombre, rol,
      cuentaOperacionCode: String(body.cuentaOperacionCode ?? '601-01-003'),
      cuentaContrapartidaCode: String(body.cuentaContrapartidaCode ?? (rol === 'CLIENTE' ? '105-01-001' : '201-01-001')),
      tipoTerceroDiot, tipoOperacionDiot, tasaIvaDefault, estatus69B,
      idFiscal: body.idFiscal ? String(body.idFiscal) : null,
      pais: body.pais ? String(body.pais) : null,
      jurisdiccionFiscal: body.jurisdiccionFiscal ? String(body.jurisdiccionFiscal) : null,
      regionFronteriza: String(body.regionFronteriza ?? 'NORTE').toUpperCase() === 'SUR' ? 'SUR' : 'NORTE',
      deductiblePct: body.deductiblePct !== undefined ? Number(body.deductiblePct) : 100
    }));
  } catch (err) {
    return routeErr(c, err);
  }
});

fiscalRoutes.delete('/third-parties/:id', (c) => {
  try {
    const id = c.req.param('id');
    const row = db.query('SELECT company_id FROM third_parties WHERE id = ?').get(id) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Tercero no encontrado.' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;
    return deleteThirdPartyRecord(row.company_id, id) ? c.json({ deleted: true }) : c.json({ error: 'Tercero no encontrado.' }, 404);
  } catch (err) {
    return routeErr(c, err);
  }
});

// Fixed Assets (Activos Fijos)
fiscalRoutes.get('/fixed-assets', (c) => {
  const { err, company } = resolveQueryCompany(c);
  if (err || !company) return err!;
  const year = c.req.query('year') ? Number(c.req.query('year')) : undefined;
  const period = c.req.query('period') ? Number(c.req.query('period')) : undefined;
  return c.json(getFixedAssetsResponse(company.id, year, period));
});

fiscalRoutes.post('/fixed-assets', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const { err, company } = resolveBodyCompany(c, body);
    if (err || !company) return err!;
    const codigo = String(body.codigo ?? '').trim();
    const nombre = String(body.nombre ?? '').trim();
    if (!codigo || !nombre) return c.json({ error: 'Código y nombre del activo fijo son obligatorios.' }, 400);
    const catRaw = String(body.categoria ?? 'COMPUTO_30').toUpperCase();
    const categoria = (['COMPUTO_30', 'TRANSPORTE_25', 'MOBILIARIO_10', 'MAQUINARIA_10', 'EDIFICIOS_5'].includes(catRaw) ? catRaw : 'COMPUTO_30') as FixedAssetCategory;
    return c.json(createFixedAssetRecord(company.id, {
      codigo, nombre, categoria,
      fechaAdquisicion: String(body.fechaAdquisicion ?? '2026-01-15'),
      cfdiUuid: body.cfdiUuid ? String(body.cfdiUuid) : null,
      montoOriginalInversion: Number(body.montoOriginalInversion ?? 50000),
      tasaAnualPct: Number(body.tasaAnualPct ?? 30),
      mesesDepreciadosPrevios: Number(body.mesesDepreciadosPrevios ?? 0),
      inpcAdquisicion: Number(body.inpcAdquisicion ?? 132.54),
      inpcMedioPeriodo: Number(body.inpcMedioPeriodo ?? 136.82),
      cuentaActivoCode: body.cuentaActivoCode ? String(body.cuentaActivoCode) : '156-01-001',
      cuentaDepAcumCode: body.cuentaDepAcumCode ? String(body.cuentaDepAcumCode) : '171-01-001',
      cuentaGastoDepCode: body.cuentaGastoDepCode ? String(body.cuentaGastoDepCode) : '601-01-006',
      vehicleCapType: body.vehicleCapType ? (String(body.vehicleCapType) as VehicleCapType) : null
    } as Parameters<typeof createFixedAssetRecord>[1]), 201);
  } catch (err) {
    return routeErr(c, err);
  }
});

fiscalRoutes.put('/fixed-assets/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const row = db.query('SELECT company_id FROM fixed_assets WHERE id = ?').get(id) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Activo fijo no encontrado.' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;
    const body = (await c.req.json()) as Record<string, unknown>;
    const updated = updateFixedAssetRecord(id, body as Parameters<typeof updateFixedAssetRecord>[1], body.year ? Number(body.year) : undefined, body.period ? Number(body.period) : undefined);
    return updated ? c.json(updated) : c.json({ error: 'Activo fijo no encontrado.' }, 404);
  } catch (err) {
    return routeErr(c, err);
  }
});

fiscalRoutes.post('/fixed-assets/:id/baja', async (c) => {
  try {
    const id = c.req.param('id');
    const row = db.query('SELECT company_id FROM fixed_assets WHERE id = ?').get(id) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Activo fijo no encontrado.' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;
    const body = (await c.req.json()) as Record<string, unknown>;
    const res = retireFixedAssetRecord(id, {
      fechaBaja: String(body.fechaBaja ?? ''),
      precioVenta: Number(body.precioVenta ?? 0),
      generatePoliza: body.generatePoliza !== false,
      cuentaCobroCode: body.cuentaCobroCode ? String(body.cuentaCobroCode) : undefined
    });
    return res ? c.json(res) : c.json({ error: 'Activo fijo no encontrado.' }, 404);
  } catch (err) {
    return routeErr(c, err);
  }
});

fiscalRoutes.delete('/fixed-assets/:id', (c) => {
  try {
    const id = c.req.param('id');
    const row = db.query('SELECT company_id FROM fixed_assets WHERE id = ?').get(id) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'Activo fijo no encontrado.' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;
    return deleteFixedAssetRecord(id) ? c.json({ deleted: true }) : c.json({ error: 'Activo fijo no encontrado.' }, 404);
  } catch (err) {
    return routeErr(c, err);
  }
});

fiscalRoutes.post('/fixed-assets/depreciation-poliza', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const { err, company } = resolveBodyCompany(c, body);
    if (err || !company) return err!;
    const rawYear = body.year ?? body.ejercicio ?? c.req.query('year');
    const rawPeriod = body.period ?? body.periodo ?? c.req.query('period');
    const { year, period } = resolveYearAndPeriod(rawYear !== undefined ? String(rawYear) : undefined, rawPeriod !== undefined ? String(rawPeriod) : undefined, company);
    return c.json(generateMonthlyDepreciationPoliza(company.id, year, period), 201);
  } catch (err) {
    return routeErr(c, err);
  }
});

// Fiscal Workpaper (Día 17)
fiscalRoutes.get('/fiscal-workpaper', (c) => {
  const { err, company } = resolveQueryCompany(c);
  if (err || !company) return err!;
  const { year, period } = resolveYearAndPeriod(c.req.query('year'), c.req.query('period'), company);
  return c.json(getFiscalWorkpaperReport(company.id, year, period));
});

fiscalRoutes.get('/fiscal-workpaper/parameters', (c) => {
  try {
    const { err, company } = resolveQueryCompany(c);
    if (err || !company) return err!;
    const ejercicio = Number(c.req.query('year') ?? company.currentYear);
    const periodRaw = c.req.query('period');
    const periodo = periodRaw !== undefined ? Number(periodRaw) : 0;
    return c.json(getTaxParameters(company.id, ejercicio, Number.isFinite(periodo) ? periodo : 0));
  } catch (err) {
    return routeErr(c, err);
  }
});

fiscalRoutes.put('/fiscal-workpaper/parameters', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const { err, company } = resolveBodyCompany(c, body, 'CONTADOR');
    if (err || !company) return err!;
    const ejercicio = Number(body.ejercicio ?? body.year ?? company.currentYear);
    const rawPeriodo = body.periodo ?? body.period;
    const periodo = rawPeriodo !== undefined ? Number(rawPeriodo) : 0;
    return c.json(saveTaxParameters(company.id, ejercicio, {
      periodo: Number.isFinite(periodo) ? periodo : 0,
      coeficienteUtilidad: body.coeficienteUtilidad !== undefined ? Number(body.coeficienteUtilidad) : undefined,
      perdidasFiscalesPendientes: body.perdidasFiscalesPendientes !== undefined ? Number(body.perdidasFiscalesPendientes) : undefined,
      pagosProvisionalesAnteriores: body.pagosProvisionalesAnteriores !== undefined ? Number(body.pagosProvisionalesAnteriores) : undefined,
      saldoFavorIvaAnterior: body.saldoFavorIvaAnterior !== undefined ? Number(body.saldoFavorIvaAnterior) : undefined,
      tipoCambioDofCierre: body.tipoCambioDofCierre !== undefined ? Number(body.tipoCambioDofCierre) : undefined,
      ptuPagadaEjercicio: body.ptuPagadaEjercicio !== undefined ? Number(body.ptuPagadaEjercicio) : undefined
    }));
  } catch (err) {
    return routeErr(c, err);
  }
});

fiscalRoutes.post('/fiscal-workpaper/provision-poliza', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const { err, company } = resolveBodyCompany(c, body);
    if (err || !company) return err!;
    const { year, period } = resolveYearAndPeriod(body.year !== undefined ? String(body.year) : body.ejercicio !== undefined ? String(body.ejercicio) : undefined, body.period !== undefined ? String(body.period) : body.periodo !== undefined ? String(body.periodo) : undefined, company);
    return c.json(generateTaxProvisionPoliza(company.id, year, period), 201);
  } catch (err) {
    return routeErr(c, err);
  }
});

fiscalRoutes.post('/fiscal-workpaper/exchange-poliza', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const { err, company } = resolveBodyCompany(c, body);
    if (err || !company) return err!;
    const { year, period } = resolveYearAndPeriod(body.year !== undefined ? String(body.year) : body.ejercicio !== undefined ? String(body.ejercicio) : undefined, body.period !== undefined ? String(body.period) : body.periodo !== undefined ? String(body.periodo) : undefined, company);
    return c.json(generateExchangeFluctuationPoliza(company.id, year, period), 201);
  } catch (err) {
    return routeErr(c, err);
  }
});

// CxC / CxP Aging PPD
fiscalRoutes.get('/companies/:companyId/cxc-cxp', (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId);
    if (denied) return denied;
    const { userId } = resolveRequestActor(c);
    return c.json(getCxcCxpAgingRepo(companyId, c.req.query('asOf') || undefined, userId));
  } catch (err) {
    return routeErr(c, err);
  }
});

// Custom INPC Entries
fiscalRoutes.get('/custom-inpc', (c) => {
  const { err, company } = resolveQueryCompany(c);
  if (err || !company) return err!;
  return c.json(listCustomInpcEntriesSqlite(company.id));
});

fiscalRoutes.put('/custom-inpc', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const { err, company } = resolveBodyCompany(c, body, 'CONTADOR');
    if (err || !company) return err!;
    const year = Number(body.year);
    const month = Number(body.month);
    const inpcValue = Number(body.inpcValue);
    if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isFinite(inpcValue) || inpcValue <= 0) {
      return c.json({ error: 'Año, mes (1-12) y valor INPC positivo son obligatorios.' }, 400);
    }
    return c.json(upsertCustomInpcEntrySqlite({ companyId: company.id, year, month, inpcValue, source: String(body.source ?? 'MANUAL') }));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

fiscalRoutes.delete('/custom-inpc', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId, { requireWrite: true, minRole: 'CONTADOR' });
  if (denied) return denied;
  const year = Number(c.req.query('year'));
  const month = Number(c.req.query('month'));
  return c.json({ deleted: deleteCustomInpcEntrySqlite(q.companyId, year, month) });
});

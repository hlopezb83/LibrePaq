import { Hono } from 'hono';
import { resolveRequestActor } from '../auth-actor';
import {
  createFixedAssetRecord,
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
  syncThirdPartiesFromCfdis,
  upsertThirdPartyRecord
} from '../db';
import { resolveYearAndPeriod } from '../validators';
import { assertRouteCompanyAccess, errorStatus, getAuthorizedCompanyForRoute } from './route-helpers';
import type { Efos69BStatus, FixedAssetCategory } from '../../shared/types';

export const fiscalRoutes = new Hono();

// Period Locks
fiscalRoutes.get('/period-locks', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  return c.json(getPeriodLock(company.id, year, period));
});

fiscalRoutes.post('/period-locks', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const company = getAuthorizedCompanyForRoute(c, companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const ejercicio = Number(body.ejercicio ?? company.currentYear);
    const periodo = Number(body.periodo ?? company.currentPeriod);
    const isLocked = Boolean(body.isLocked);
    const notes = String(body.notes ?? '');

    return c.json(setPeriodLock(company.id, ejercicio, periodo, isLocked, notes));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

// Third Parties (Padrón Fiscal y 69-B)
fiscalRoutes.get('/third-parties', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  return c.json(syncThirdPartiesFromCfdis(companyId));
});

fiscalRoutes.post('/third-parties', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const rfc = String(body.rfc ?? '').trim().toUpperCase();
    const nombre = String(body.nombre ?? '').trim();
    if (!rfc || !nombre) {
      return c.json({ error: 'RFC y Razón Social son obligatorios.' }, 400);
    }

    const rolRaw = String(body.rol ?? 'PROVEEDOR').toUpperCase();
    const rol = (
      ['PROVEEDOR', 'CLIENTE', 'AMBOS'].includes(rolRaw) ? rolRaw : 'PROVEEDOR'
    ) as 'PROVEEDOR' | 'CLIENTE' | 'AMBOS';

    const tipoTerceroDiot = String(body.tipoTerceroDiot ?? '04') === '05' ? '05' : '04';
    const opDiotRaw = String(body.tipoOperacionDiot ?? '85');
    const tipoOperacionDiot = (
      ['03', '06', '85'].includes(opDiotRaw) ? opDiotRaw : '85'
    ) as '03' | '06' | '85';

    const tasaNum = Number(body.tasaIvaDefault ?? 16);
    const tasaIvaDefault = (tasaNum === 8 ? 8 : tasaNum === 0 ? 0 : 16) as 16 | 8 | 0;

    const efosRaw = String(body.estatus69B ?? 'LIMPIO').toUpperCase();
    const estatus69B = (
      ['LIMPIO', 'PRESUNTO_EFOS', 'DEFINITIVO_EFOS', 'DESVIRTUADO'].includes(efosRaw)
        ? efosRaw
        : 'LIMPIO'
    ) as Efos69BStatus;

    const saved = upsertThirdPartyRecord(companyId, {
      rfc,
      nombre,
      rol,
      cuentaOperacionCode: String(body.cuentaOperacionCode ?? '601-01-003'),
      cuentaContrapartidaCode: String(body.cuentaContrapartidaCode ?? '201-01-099'),
      tipoTerceroDiot,
      tipoOperacionDiot,
      tasaIvaDefault,
      estatus69B
    });
    return c.json(saved);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

// Fixed Assets (Activos Fijos)
fiscalRoutes.get('/fixed-assets', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  return c.json(getFixedAssetsResponse(companyId));
});

fiscalRoutes.post('/fixed-assets', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const codigo = String(body.codigo ?? '').trim();
    const nombre = String(body.nombre ?? '').trim();
    if (!codigo || !nombre) {
      return c.json({ error: 'Código y nombre del activo fijo son obligatorios.' }, 400);
    }

    const catRaw = String(body.categoria ?? 'COMPUTO_30').toUpperCase();
    const categoria = (
      [
        'COMPUTO_30',
        'TRANSPORTE_25',
        'MOBILIARIO_10',
        'MAQUINARIA_10',
        'EDIFICIOS_5'
      ].includes(catRaw)
        ? catRaw
        : 'COMPUTO_30'
    ) as FixedAssetCategory;

    const res = createFixedAssetRecord(companyId, {
      codigo,
      nombre,
      categoria,
      fechaAdquisicion: String(body.fechaAdquisicion ?? '2026-01-15'),
      cfdiUuid: body.cfdiUuid ? String(body.cfdiUuid) : null,
      montoOriginalInversion: Number(body.montoOriginalInversion ?? 50000),
      tasaAnualPct: Number(body.tasaAnualPct ?? 30),
      mesesDepreciadosPrevios: Number(body.mesesDepreciadosPrevios ?? 0),
      inpcAdquisicion: Number(body.inpcAdquisicion ?? 132.54),
      inpcMedioPeriodo: Number(body.inpcMedioPeriodo ?? 136.82),
      cuentaActivoCode: body.cuentaActivoCode ? String(body.cuentaActivoCode) : '156-01-001',
      cuentaDepAcumCode: body.cuentaDepAcumCode ? String(body.cuentaDepAcumCode) : '171-01-001',
      cuentaGastoDepCode: body.cuentaGastoDepCode ? String(body.cuentaGastoDepCode) : '601-01-006'
    });
    return c.json(res, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

fiscalRoutes.delete('/fixed-assets/:id', (c) => {
  try {
    const id = c.req.param('id');
    const deleted = deleteFixedAssetRecord(id);
    if (!deleted) return c.json({ error: 'Activo fijo no encontrado.' }, 404);
    return c.json({ deleted: true });
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

fiscalRoutes.post('/fixed-assets/depreciation-poliza', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const company = getAuthorizedCompanyForRoute(c, companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const poliza = generateMonthlyDepreciationPoliza(
      company.id,
      company.currentYear,
      company.currentPeriod
    );
    return c.json(poliza, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

// Fiscal Workpaper (Día 17)
fiscalRoutes.get('/fiscal-workpaper', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  return c.json(getFiscalWorkpaperReport(company.id, year, period));
});

fiscalRoutes.get('/fiscal-workpaper/parameters', (c) => {
  try {
    const companyId = c.req.query('companyId') || 'comp_tnn_01';
    const company = getAuthorizedCompanyForRoute(c, companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const ejercicio = Number(c.req.query('year') ?? company.currentYear);
    const periodRaw = c.req.query('period');
    const periodo = periodRaw !== undefined ? Number(periodRaw) : 0;
    return c.json(getTaxParameters(company.id, ejercicio, Number.isFinite(periodo) ? periodo : 0));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

fiscalRoutes.put('/fiscal-workpaper/parameters', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const company = getAuthorizedCompanyForRoute(c, companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const ejercicio = Number(body.ejercicio ?? body.year ?? company.currentYear);
    const rawPeriodo = body.periodo ?? body.period;
    const periodo = rawPeriodo !== undefined ? Number(rawPeriodo) : 0;
    const updated = saveTaxParameters(company.id, ejercicio, {
      periodo: Number.isFinite(periodo) ? periodo : 0,
      coeficienteUtilidad:
        body.coeficienteUtilidad !== undefined ? Number(body.coeficienteUtilidad) : undefined,
      perdidasFiscalesPendientes:
        body.perdidasFiscalesPendientes !== undefined
          ? Number(body.perdidasFiscalesPendientes)
          : undefined,
      pagosProvisionalesAnteriores:
        body.pagosProvisionalesAnteriores !== undefined
          ? Number(body.pagosProvisionalesAnteriores)
          : undefined,
      saldoFavorIvaAnterior:
        body.saldoFavorIvaAnterior !== undefined ? Number(body.saldoFavorIvaAnterior) : undefined,
      tipoCambioDofCierre:
        body.tipoCambioDofCierre !== undefined ? Number(body.tipoCambioDofCierre) : undefined
    });
    return c.json(updated);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

fiscalRoutes.post('/fiscal-workpaper/provision-poliza', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const company = getAuthorizedCompanyForRoute(c, companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const rawYear = body.year ?? body.ejercicio;
    const rawPeriod = body.period ?? body.periodo;
    const { year, period } = resolveYearAndPeriod(
      rawYear !== undefined ? String(rawYear) : undefined,
      rawPeriod !== undefined ? String(rawPeriod) : undefined,
      company
    );
    const poliza = generateTaxProvisionPoliza(company.id, year, period);
    return c.json(poliza, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

fiscalRoutes.post('/fiscal-workpaper/exchange-poliza', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const company = getAuthorizedCompanyForRoute(c, companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const rawYear = body.year ?? body.ejercicio;
    const rawPeriod = body.period ?? body.periodo;
    const { year, period } = resolveYearAndPeriod(
      rawYear !== undefined ? String(rawYear) : undefined,
      rawPeriod !== undefined ? String(rawPeriod) : undefined,
      company
    );
    const poliza = generateExchangeFluctuationPoliza(company.id, year, period);
    return c.json(poliza, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

// CxC / CxP Aging PPD
fiscalRoutes.get('/companies/:companyId/cxc-cxp', (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId);
    if (denied) return denied;
    const { userId } = resolveRequestActor(c);
    const asOfIso = c.req.query('asOf') || undefined;
    return c.json(getCxcCxpAgingRepo(companyId, asOfIso, userId));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

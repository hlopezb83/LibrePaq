import { db } from '../connection';
import {
  assertAccountingInvariant,
  computeFiscalWorkpaper,
  fromCents,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import type {
  DiotReportResponse,
  DiotSupplierRow,
  FiscalWorkpaperResponse,
  TaxParametersRecord
} from '../../shared/types';
import { getCompanyById } from './companies.repo';
import { getCfdiDocuments } from './cfdi.repo';
import { computeTrialBalance } from './trial-balance.repo';

export {
  getFixedAssetsResponse,
  createFixedAssetRecord,
  deleteFixedAssetRecord,
  generateMonthlyDepreciationPoliza
} from './fixed-assets.repo';

export function getDiotReport(
  companyId: string,
  ejercicio: number,
  periodo: number
): DiotReportResponse {
  const company = getCompanyById(companyId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const cfdis = getCfdiDocuments(company.id);
  const trialBalance = computeTrialBalance(company.id, ejercicio, periodo);

  const polizasPeriodo = (
    db
      .query('SELECT id FROM polizas WHERE company_id = ? AND ejercicio = ? AND periodo = ?')
      .all(company.id, ejercicio, periodo) as Array<{ id: string }>
  );
  const polizaIdsInPeriod = new Set(polizasPeriodo.map((p) => p.id));

  const paidRecibidos = cfdis.filter(
    (c) =>
      c.direction === 'RECIBIDO' &&
      c.statusSat !== 'CANCELADO' &&
      c.tipoComprobante !== 'T' &&
      c.polizaId &&
      polizaIdsInPeriod.has(c.polizaId) &&
      (c.metodoPago === 'PUE' || c.tipoComprobante === 'P' || c.tipoComprobante === 'E')
  );

  const byRfc = new Map<
    string,
    DiotSupplierRow & { devolucionesMxn?: number; baseExentaMxn?: number; baseCeroMxn?: number }
  >();

  for (const doc of paidRecibidos) {
    const rfc = doc.emisorRfc.toUpperCase();
    const existing = byRfc.get(rfc);
    const concLower = doc.conceptoPrincipal.toLowerCase();
    let tipoOperacion: '03' | '06' | '85' = '85';
    if (concLower.includes('renta') || concLower.includes('arrendamiento')) {
      tipoOperacion = '06';
    } else if (
      concLower.includes('honorario') ||
      concLower.includes('auditor') ||
      concLower.includes('consultor')
    ) {
      tipoOperacion = '03';
    }

    const tc =
      doc.moneda && doc.moneda !== 'MXN' && (doc.tipoCambio || 1) > 0
        ? doc.tipoCambio || 1
        : 1;
    const netBase = Math.max(0, doc.subtotal - (doc.descuento || 0)) * tc;
    const ivaTrasladadoMxn = doc.ivaTrasladado * tc;
    const ivaRetenidoMxn = doc.ivaRetenido * tc;
    const isrRetenidoMxn = doc.isrRetenido * tc;
    const totalMxn = doc.total * tc;
    const isCreditNote = doc.tipoComprobante === 'E';
    const isExemptOrZero = doc.ivaTrasladado === 0 && !isCreditNote;

    const subtotal16 = (!isCreditNote && !isExemptOrZero) ? netBase : 0;
    const devolucion = isCreditNote ? netBase : 0;
    const baseExenta = isExemptOrZero && concLower.includes('exento') ? netBase : 0;
    const baseCero = isExemptOrZero && !concLower.includes('exento') ? netBase : 0;
    const tipoTercero: '04' | '05' =
      rfc === 'XEXX010101000' || rfc.startsWith('XEXX') ? '05' : '04';

    if (!existing) {
      byRfc.set(rfc, {
        rfc,
        nombre: doc.emisorNombre,
        tipoTercero,
        tipoOperacion,
        actosPagados16: fromCents(toCents(subtotal16)),
        ivaAcreditable16: fromCents(toCents(isCreditNote ? -ivaTrasladadoMxn : ivaTrasladadoMxn)),
        ivaRetenido: fromCents(toCents(ivaRetenidoMxn)),
        isrRetenido: fromCents(toCents(isrRetenidoMxn)),
        totalPagado: fromCents(toCents(isCreditNote ? -totalMxn : totalMxn)),
        cfdiCount: 1,
        batchLine: '',
        devolucionesMxn: devolucion,
        baseExentaMxn: baseExenta,
        baseCeroMxn: baseCero
      });
    } else {
      existing.actosPagados16 = fromCents(
        toCents(existing.actosPagados16) + toCents(subtotal16)
      );
      existing.ivaAcreditable16 = fromCents(
        toCents(existing.ivaAcreditable16) + toCents(isCreditNote ? -ivaTrasladadoMxn : ivaTrasladadoMxn)
      );
      existing.ivaRetenido = fromCents(
        toCents(existing.ivaRetenido) + toCents(ivaRetenidoMxn)
      );
      existing.isrRetenido = fromCents(
        toCents(existing.isrRetenido) + toCents(isrRetenidoMxn)
      );
      existing.totalPagado = fromCents(
        toCents(existing.totalPagado) + toCents(isCreditNote ? -totalMxn : totalMxn)
      );
      existing.devolucionesMxn = (existing.devolucionesMxn || 0) + devolucion;
      existing.baseExentaMxn = (existing.baseExentaMxn || 0) + baseExenta;
      existing.baseCeroMxn = (existing.baseCeroMxn || 0) + baseCero;
      existing.cfdiCount += 1;
    }
  }

  const rows: DiotSupplierRow[] = Array.from(byRfc.values()).map((r) => {
    const baseRounded = Math.round(r.actosPagados16);
    const ivaRetRounded = Math.round(r.ivaRetenido);
    // SAT DEM Formato A-29: 20 campos delimitados por 19 plepas (|), sin plepas externas
    const cols = new Array(20).fill('');
    cols[0] = r.tipoTercero;
    cols[1] = r.tipoOperacion;
    cols[2] = r.tipoTercero === '05' ? '' : r.rfc;
    if (r.tipoTercero === '05') {
      cols[3] = r.rfc === 'XEXX010101000' ? '' : r.rfc;
      cols[4] = r.nombre;
      cols[5] = 'USA';
    }
    cols[7] = baseRounded > 0 ? String(baseRounded) : '';
    cols[10] = (r.baseCeroMxn || 0) > 0 ? String(Math.round(r.baseCeroMxn!)) : '';
    cols[11] = (r.baseExentaMxn || 0) > 0 ? String(Math.round(r.baseExentaMxn!)) : '';
    cols[15] = (r.devolucionesMxn || 0) > 0 ? String(Math.round(r.devolucionesMxn!)) : '';
    cols[18] = ivaRetRounded > 0 ? String(ivaRetRounded) : '';
    const batchLine = cols.join('|');
    return {
      ...r,
      batchLine
    };
  });

  const actosPagados16 = fromCents(sumCents(rows.map((r) => r.actosPagados16)));
  const ivaAcreditable16 = fromCents(sumCents(rows.map((r) => r.ivaAcreditable16)));
  const ivaRetenido = fromCents(sumCents(rows.map((r) => r.ivaRetenido)));
  const isrRetenido = fromCents(sumCents(rows.map((r) => r.isrRetenido)));

  const ivaTrasladadoAcc = trialBalance.find((a) => a.code === '208-01-001');
  const ivaTrasladadoCobrado = ivaTrasladadoAcc ? ivaTrasladadoAcc.periodCredits : 0;
  const ivaNetoCargoFavor = fromCents(
    toCents(ivaTrasladadoCobrado) - toCents(ivaAcreditable16)
  );

  const mesStr = String(periodo).padStart(2, '0');

  return {
    company,
    ejercicio,
    periodo,
    rows,
    totals: {
      actosPagados16,
      ivaAcreditable16,
      ivaRetenido,
      isrRetenido,
      ivaTrasladadoCobrado,
      ivaNetoCargoFavor
    },
    batchTxtContent: rows.map((r) => r.batchLine).join('\n'),
    filename: `DIOT_${company.rfc}_${ejercicio}_${mesStr}.txt`
  };
}

export function getTaxParameters(companyId: string, ejercicio: number): TaxParametersRecord {
  const row = db
    .query('SELECT * FROM tax_parameters WHERE company_id = ? AND ejercicio = ?')
    .get(companyId, ejercicio) as {
    company_id: string;
    ejercicio: number;
    coeficiente_utilidad: number;
    perdidas_fiscales_pendientes: number;
    pagos_provisionales_anteriores: number;
    saldo_favor_iva_anterior: number;
    tipo_cambio_dof_cierre: number;
  } | null;

  return {
    companyId,
    ejercicio,
    coeficienteUtilidad: Number(row?.coeficiente_utilidad ?? 0.1845),
    perdidasFiscalesPendientes: Number(row?.perdidas_fiscales_pendientes ?? 45000),
    pagosProvisionalesAnteriores: Number(row?.pagos_provisionales_anteriores ?? 128500),
    saldoFavorIvaAnterior: Number(row?.saldo_favor_iva_anterior ?? 0),
    tipoCambioDofCierre: Number(row?.tipo_cambio_dof_cierre ?? 19.865)
  };
}

export function saveTaxParameters(
  companyId: string,
  ejercicio: number,
  input: Partial<Omit<TaxParametersRecord, 'companyId' | 'ejercicio'>>
): TaxParametersRecord {
  const current = getTaxParameters(companyId, ejercicio);
  const next: TaxParametersRecord = {
    companyId,
    ejercicio,
    coeficienteUtilidad: input.coeficienteUtilidad ?? current.coeficienteUtilidad,
    perdidasFiscalesPendientes:
      input.perdidasFiscalesPendientes ?? current.perdidasFiscalesPendientes,
    pagosProvisionalesAnteriores:
      input.pagosProvisionalesAnteriores ?? current.pagosProvisionalesAnteriores,
    saldoFavorIvaAnterior: input.saldoFavorIvaAnterior ?? current.saldoFavorIvaAnterior,
    tipoCambioDofCierre: input.tipoCambioDofCierre ?? current.tipoCambioDofCierre
  };

  db.prepare(`
    INSERT INTO tax_parameters (
      company_id, ejercicio, coeficiente_utilidad, perdidas_fiscales_pendientes,
      pagos_provisionales_anteriores, saldo_favor_iva_anterior, tipo_cambio_dof_cierre
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, ejercicio) DO UPDATE SET
      coeficiente_utilidad = excluded.coeficiente_utilidad,
      perdidas_fiscales_pendientes = excluded.perdidas_fiscales_pendientes,
      pagos_provisionales_anteriores = excluded.pagos_provisionales_anteriores,
      saldo_favor_iva_anterior = excluded.saldo_favor_iva_anterior,
      tipo_cambio_dof_cierre = excluded.tipo_cambio_dof_cierre
  `).run(
    companyId,
    ejercicio,
    next.coeficienteUtilidad,
    fromCents(toCents(next.perdidasFiscalesPendientes)),
    fromCents(toCents(next.pagosProvisionalesAnteriores)),
    fromCents(toCents(next.saldoFavorIvaAnterior)),
    next.tipoCambioDofCierre
  );

  return getTaxParameters(companyId, ejercicio);
}

export function getFiscalWorkpaperReport(
  companyId: string,
  ejercicio: number,
  periodo: number
): FiscalWorkpaperResponse {
  const company = getCompanyById(companyId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const parameters = getTaxParameters(company.id, ejercicio);
  const tb = computeTrialBalance(company.id, ejercicio, periodo);

  const ingresosAccounts = tb.filter((a) => a.isAffectable && a.type === 'INGRESOS');
  const egresosAccounts = tb.filter(
    (a) =>
      a.isAffectable &&
      (a.type === 'COSTOS' || a.type === 'GASTOS') &&
      !a.code.startsWith('801') &&
      !a.satGroupCode?.startsWith('801')
  );

  const ingresosPeriodo = fromCents(
    sumCents(ingresosAccounts.map((a) => a.periodCredits - a.periodCharges))
  );
  const ingresosAcumuladosEjercicio = fromCents(
    sumCents(ingresosAccounts.map((a) => a.finalBalance))
  );
  const deduccionesAutorizadasPeriodo = fromCents(
    sumCents(egresosAccounts.map((a) => a.periodCharges - a.periodCredits))
  );
  const deduccionesAcumuladasEjercicio = fromCents(
    sumCents(egresosAccounts.map((a) => a.finalBalance))
  );

  const accIvaCobrado = tb.find((a) => a.code === '208-01-001' || a.satGroupCode === '208.01');
  const accIvaPagado = tb.find((a) => a.code === '118-01-001' || a.satGroupCode === '118.01');
  const accRetIsr = tb.find((a) => a.code === '216-01-001' || a.satGroupCode === '216.01');
  const accRetIva = tb.find((a) => a.code === '216-01-002' || a.satGroupCode === '216.02');
  const accIsrFavor = tb.find(
    (a) => a.code === '113-02-001' || a.code === '113-01-002' || a.satGroupCode === '113.02'
  );
  const accIvaFavor = tb.find(
    (a) => a.code === '113-01-001' || a.satGroupCode === '113.01'
  );

  const cfdis = getCfdiDocuments(company.id);
  const usdCfdis = cfdis.filter(
    (c) =>
      c.moneda.toUpperCase() === 'USD' &&
      c.statusSat !== 'CANCELADO' &&
      c.metodoPago === 'PPD'
  );

  return computeFiscalWorkpaper({
    company,
    ejercicio,
    periodo,
    parameters,
    ingresosPeriodo,
    ingresosAcumuladosEjercicio,
    deduccionesAutorizadasPeriodo,
    deduccionesAcumuladasEjercicio,
    ivaTrasladadoCobrado: accIvaCobrado?.periodCredits ?? 0,
    ivaAcreditablePagado: accIvaPagado?.periodCharges ?? 0,
    isrRetenidoPorPagar: accRetIsr?.periodCredits ?? 0,
    ivaRetenidoPorPagar: accRetIva?.periodCredits ?? 0,
    isrRetenidoFavorPeriodo: accIsrFavor?.periodCharges ?? 0,
    ivaRetenidoFavorPeriodo: accIvaFavor?.periodCharges ?? 0,
    usdCfdis
  });
}

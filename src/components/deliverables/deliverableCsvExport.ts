import { strToU8, zipSync } from 'fflate';
import { downloadBlobFile } from '../../lib/formatters';
import {
  buildAgingCxcCxpCsvRows,
  buildConciliacionBancariaCsvRows
} from '../../lib/excel-bancarios-cxc-sheets';
import { sanitizeSpreadsheetText } from '../../shared/date-utils';
import type {
  AccountWithBalance,
  BankReconciliationResponse,
  Company,
  CxcCxpAgingResponse,
  FinancialStatementsResponse,
  FiscalWorkpaperResponse
} from '../../shared/types';

function buildCsvContent(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'number' ? String(val) : sanitizeSpreadsheetText(String(val));
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))];
  return '\uFEFF' + lines.join('\r\n');
}

const isNonZeroRow = (a: AccountWithBalance) =>
  Math.abs(a.initialBalanceComputed) >= 0.01 ||
  Math.abs(a.periodCharges) >= 0.01 ||
  Math.abs(a.periodCredits) >= 0.01 ||
  Math.abs(a.finalBalance) >= 0.01;

export function exportAllDeliverablesCsv({
  reportsData, prevMonthIncomeStatement, fiscalData, agingData, bankReconciliations,
  company, year, period, formatVerticalPct,
  hideZeroAccounts = false, includeBalanza = true, includeResultados = true,
  includeBalance = true, includeDia17 = true, includeNifAging = true
}: {
  reportsData: FinancialStatementsResponse | null | undefined;
  prevMonthIncomeStatement?: FinancialStatementsResponse['incomeStatement'] | null;
  fiscalData: FiscalWorkpaperResponse | null | undefined;
  agingData?: CxcCxpAgingResponse | null;
  bankReconciliations?: BankReconciliationResponse[] | null;
  company: Company;
  year: number;
  period: number;
  formatVerticalPct: (amount: number, base: number) => string;
  hideZeroAccounts?: boolean;
  includeBalanza?: boolean;
  includeResultados?: boolean;
  includeBalance?: boolean;
  includeDia17?: boolean;
  includeNifAging?: boolean;
}): boolean {
  if (!reportsData) return false;
  const files: Record<string, Uint8Array> = {};

  if (includeBalanza) {
    const balanzaHeaders = [
      'Código Cuenta', 'Nombre de la Cuenta', 'Agrupador SAT', 'Naturaleza',
      'Nivel', 'Saldo Inicial', 'Cargos (Debe)', 'Abonos (Haber)', 'Saldo Final'
    ];
    const tbRows = hideZeroAccounts
      ? reportsData.trialBalance.filter(isNonZeroRow)
      : reportsData.trialBalance;
    const balanzaRows = tbRows.map((r) => [
      r.code, r.name, r.satGroupCode, r.nature, r.level,
      r.initialBalanceComputed, r.periodCharges, r.periodCredits, r.finalBalance
    ]);
    files['Balanza_Comprobacion.csv'] = strToU8(buildCsvContent(balanzaHeaders, balanzaRows));
  }

  const signedBal = (a: AccountWithBalance, expected: 'DEUDORA' | 'ACREEDORA') =>
    a.nature === expected ? a.finalBalance : -a.finalBalance;
  const signedMes = (a: AccountWithBalance, expected: 'DEUDORA' | 'ACREEDORA') =>
    expected === 'ACREEDORA' ? a.periodCredits - a.periodCharges : a.periodCharges - a.periodCredits;

  if (includeResultados) {
    const er = reportsData.incomeStatement;
    const p = er.periodTotals;
    const pm = prevMonthIncomeStatement?.periodTotals;
    const utilOp = er.utilidadOperativa ?? er.utilidadBruta - er.totalGastos;
    const rifNeto = er.rifNeto ?? 0;
    const uai = er.utilidadAntesImpuestos ?? utilOp + rifNeto;
    const totalIsr = er.totalIsr ?? 0;
    const safePct = (val: number) =>
      !er.totalIngresos || Math.abs(er.totalIngresos) < 0.01 ? '0.0%' : formatVerticalPct(val, er.totalIngresos);
    const safeMesPct = (val: number) =>
      !(p?.totalIngresos) || Math.abs(p.totalIngresos) < 0.01 ? '0.0%' : formatVerticalPct(val, p.totalIngresos);
    const momPct = (cur: number, prev: number) =>
      Math.abs(prev) < 0.01 ? 'N/A' : `${(((cur - prev) / Math.abs(prev)) * 100).toFixed(1)}%`;
    const prevMap = new Map<string, AccountWithBalance>();
    if (prevMonthIncomeStatement) {
      for (const grp of [
        prevMonthIncomeStatement.ingresos, prevMonthIncomeStatement.costos,
        prevMonthIncomeStatement.gastos, prevMonthIncomeStatement.rifProductos ?? [],
        prevMonthIncomeStatement.rifGastos ?? [], prevMonthIncomeStatement.isrEjercicio ?? []
      ]) {
        for (const a of grp) prevMap.set(a.code, a);
      }
    }
    const filterEr = (list: AccountWithBalance[], expected: 'DEUDORA' | 'ACREEDORA') =>
      hideZeroAccounts ? list.filter((a) => Math.abs(a.finalBalance) >= 0.01 || Math.abs(signedMes(a, expected)) >= 0.01) : list;
    const mapEr = (rubro: string, a: AccountWithBalance, expected: 'DEUDORA' | 'ACREEDORA') => {
      const mes = signedMes(a, expected);
      const prevAcc = prevMap.get(a.code);
      const prevMes = prevAcc ? signedMes(prevAcc, expected) : 0;
      const ytd = signedBal(a, expected);
      return [rubro, a.code, a.name, mes, safeMesPct(mes), prevMes, momPct(mes, prevMes), ytd, safePct(ytd)];
    };

    const erHeaders = [
      'Rubro Contable', 'Código', 'Nombre Cuenta',
      'Del Mes MXN', '% Vert. Mes', 'Mes Ant. MXN', 'Var. MoM %', 'Acum. Ejercicio MXN', '% s/Ventas YTD'
    ];
    const erRows: Array<Array<string | number>> = [
      ...filterEr(er.ingresos, 'ACREEDORA').map((a) => mapEr('INGRESOS', a, 'ACREEDORA')),
      ['TOTAL INGRESOS', '', 'Ventas Netas del Periodo', p?.totalIngresos ?? 0, safeMesPct(p?.totalIngresos ?? 0), pm?.totalIngresos ?? 0, momPct(p?.totalIngresos ?? 0, pm?.totalIngresos ?? 0), er.totalIngresos, safePct(er.totalIngresos)],
      ...filterEr(er.costos, 'DEUDORA').map((a) => mapEr('COSTOS', a, 'DEUDORA')),
      ['TOTAL COSTOS', '', 'Costo de Ventas', p?.totalCostos ?? 0, safeMesPct(p?.totalCostos ?? 0), pm?.totalCostos ?? 0, momPct(p?.totalCostos ?? 0, pm?.totalCostos ?? 0), er.totalCostos, safePct(er.totalCostos)],
      ['UTILIDAD BRUTA', '', 'Utilidad Bruta Operativa', p?.utilidadBruta ?? 0, safeMesPct(p?.utilidadBruta ?? 0), pm?.utilidadBruta ?? 0, momPct(p?.utilidadBruta ?? 0, pm?.utilidadBruta ?? 0), er.utilidadBruta, safePct(er.utilidadBruta)],
      ...filterEr(er.gastos, 'DEUDORA').map((a) => mapEr('GASTOS', a, 'DEUDORA')),
      ['TOTAL GASTOS', '', 'Gastos Generales de Operación', p?.totalGastos ?? 0, safeMesPct(p?.totalGastos ?? 0), pm?.totalGastos ?? 0, momPct(p?.totalGastos ?? 0, pm?.totalGastos ?? 0), er.totalGastos, safePct(er.totalGastos)],
      ['UTILIDAD OPERACION', '', 'Utilidad de Operación (NIF B-3)', p?.utilidadOperativa ?? 0, safeMesPct(p?.utilidadOperativa ?? 0), pm?.utilidadOperativa ?? 0, momPct(p?.utilidadOperativa ?? 0, pm?.utilidadOperativa ?? 0), utilOp, safePct(utilOp)],
      ...filterEr(er.rifProductos ?? [], 'ACREEDORA').map((a) => mapEr('RIF PRODUCTOS', a, 'ACREEDORA')),
      ...filterEr(er.rifGastos ?? [], 'DEUDORA').map((a) => mapEr('RIF GASTOS', a, 'DEUDORA')),
      ['RIF NETO', '', 'Resultado Integral de Financiamiento', p?.rifNeto ?? 0, safeMesPct(p?.rifNeto ?? 0), pm?.rifNeto ?? 0, momPct(p?.rifNeto ?? 0, pm?.rifNeto ?? 0), rifNeto, safePct(rifNeto)],
      ['UAI', '', 'Utilidad antes de Impuestos', p?.utilidadAntesImpuestos ?? 0, safeMesPct(p?.utilidadAntesImpuestos ?? 0), pm?.utilidadAntesImpuestos ?? 0, momPct(p?.utilidadAntesImpuestos ?? 0, pm?.utilidadAntesImpuestos ?? 0), uai, safePct(uai)],
      ...filterEr(er.isrEjercicio ?? [], 'DEUDORA').map((a) => mapEr('ISR EJERCICIO', a, 'DEUDORA')),
      ...(totalIsr !== 0 || (er.isrEjercicio && er.isrEjercicio.length > 0)
        ? [['PROVISION ISR', '', 'Provisión ISR del Ejercicio (NIF D-4)', p?.totalIsr ?? 0, safeMesPct(p?.totalIsr ?? 0), pm?.totalIsr ?? 0, momPct(p?.totalIsr ?? 0, pm?.totalIsr ?? 0), totalIsr, safePct(totalIsr)]]
        : []),
      ['UTILIDAD NETA', '', 'Utilidad Neta del Ejercicio (NIF B-3)', p?.utilidadNeta ?? 0, safeMesPct(p?.utilidadNeta ?? 0), pm?.utilidadNeta ?? 0, momPct(p?.utilidadNeta ?? 0, pm?.utilidadNeta ?? 0), er.utilidadNeta, safePct(er.utilidadNeta)]
    ];
    files['Estado_Resultados.csv'] = strToU8(buildCsvContent(erHeaders, erRows));
  }

  if (includeBalance) {
    const bs = reportsData.balanceSheet;
    const nif = bs.nifB6;
    const fZero = (list: AccountWithBalance[]) =>
      hideZeroAccounts ? list.filter((a) => Math.abs(a.finalBalance) >= 0.01) : list;
    const bgHeaders = ['Clasificación', 'Código', 'Nombre Cuenta', 'Saldo Final MXN'];
    const bgRows: Array<Array<string | number>> = [
      ...fZero(nif?.activoCirculante ?? bs.activos).map((a) => ['ACTIVO CIRCULANTE', a.code, a.name, signedBal(a, 'DEUDORA')]),
      ...fZero(nif?.activoNoCirculante ?? []).map((a) => ['ACTIVO NO CIRCULANTE', a.code, a.name, signedBal(a, 'DEUDORA')]),
      ['TOTAL ACTIVO', '100', 'Total Activo (NIF B-6)', bs.totalActivo],
      ...fZero(nif?.pasivoCortoPlazo ?? bs.pasivos).map((a) => ['PASIVO CORTO PLAZO', a.code, a.name, signedBal(a, 'ACREEDORA')]),
      ...fZero(nif?.pasivoLargoPlazo ?? []).map((a) => ['PASIVO LARGO PLAZO', a.code, a.name, signedBal(a, 'ACREEDORA')]),
      ['TOTAL PASIVO', '200', 'Total Pasivo', bs.totalPasivo],
      ...fZero(nif?.capitalContribuido ?? bs.capital).map((a) => ['CAPITAL CONTRIBUIDO', a.code, a.name, signedBal(a, 'ACREEDORA')]),
      ...fZero(nif?.capitalGanado ?? []).map((a) => ['CAPITAL GANADO', a.code, a.name, signedBal(a, 'ACREEDORA')]),
      ['UTILIDAD EJERCICIO', '305-01-001', 'Resultado del Ejercicio Actual', bs.utilidadEjercicio],
      ['TOTAL CAPITAL', '300', 'Total Capital Contable', bs.totalPasivoMasCapital - bs.totalPasivo],
      ['PASIVO + CAPITAL', '', 'Suma Pasivo y Capital Contable', bs.totalPasivoMasCapital]
    ];
    files['Balance_General.csv'] = strToU8(buildCsvContent(bgHeaders, bgRows));
  }

  if (includeDia17 && fiscalData) {
    const d17Headers = ['Concepto Fiscal', 'Fundamento Legal / Base', 'Importe Determinado MXN'];
    const d17Rows = buildPapelFiscalCsvRows(company, fiscalData);
    files['Papel_Fiscal.csv'] = strToU8(buildCsvContent(d17Headers, d17Rows));
  }

  if (includeNifAging && bankReconciliations && bankReconciliations.length > 0) {
    const bankHeaders = ['Cuenta Bancaria', 'Sección / Origen', 'Concepto', 'Ref. / Póliza', 'Fecha', 'Cargo / Saldo MXN', 'Abono MXN'];
    files['Conciliacion_Bancaria.csv'] = strToU8(buildCsvContent(bankHeaders, buildConciliacionBancariaCsvRows(bankReconciliations)));
  }

  if (includeNifAging && agingData) {
    const agingHeaders = ['Sección', 'RFC', 'Nombre / Cartera', '0-30d / Doctos', '31-60d / Máx.Días', '61-90d / Vencido>30d', '+90d', 'Saldo Total MXN'];
    files['Antiguedad_CxC_CxP.csv'] = strToU8(buildCsvContent(agingHeaders, buildAgingCxcCxpCsvRows(agingData)));
  }

  if (Object.keys(files).length === 0) return false;

  const safeRfc = (company.rfc || 'EMPRESA').replace(/[^a-zA-Z0-9_-]/g, '');
  const periodCode = `P${String(period).padStart(2, '0')}`;
  const zipped = zipSync(files, { level: 6 });
  const zipBuffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
  downloadBlobFile(`Paquete_CSV_${safeRfc}_${year}_${periodCode}.zip`, zipBuffer, 'application/zip');
  return true;
}

export function buildPapelFiscalCsvRows(
  company: Company,
  fiscalData: FiscalWorkpaperResponse
): Array<Array<string | number>> {
  const isr = fiscalData.isrProvisional;
  const iva = fiscalData.ivaDefinitivo;
  const cap = fiscalData.resumenLineaCapturaSat;
  const isPersonaFisica = company.rfc.trim().length === 13;
  const isResico = isr.esResico;
  const isResicoPf = isResico && isPersonaFisica;
  const isResicoPm = isResico && !isPersonaFisica;
  const isPfGeneral = isPersonaFisica && !isResico;
  const dedAcum = isr.deduccionesAcumuladasEjercicio ?? isr.deduccionesAutorizadasPeriodo;

  const isrRows: Array<Array<string | number>> = [
    ['Régimen Fiscal', company.regimenFiscal, ''],
    [
      'Ingresos Cobrados / Nominales Periodo',
      isResicoPf ? 'Art. 113-E LISR (Flujo Mensual)' : isResico ? 'Flujo de Efectivo RESICO' : isPfGeneral ? 'Art. 106 LISR' : 'Art. 16 / 17 LISR',
      isr.ingresosPeriodo
    ],
    ...(!isResicoPf
      ? [['Ingresos Acumulados del Ejercicio', 'Acumulado Anual', isr.ingresosAcumuladosEjercicio] as Array<string | number>]
      : [])
  ];

  if (isResicoPm || isPfGeneral) {
    isrRows.push(
      ['(-) Deducciones Autorizadas Periodo', 'Flujo de Efectivo', -isr.deduccionesAutorizadasPeriodo],
      ['(-) Deducciones Acumuladas Ejercicio', 'Acumulado Anual', -dedAcum],
      ...((isr.ptuPagadaAplicada ?? 0) > 0
        ? [['(-) PTU Pagada Deducible', 'Art. 14 / 106 LISR', -(isr.ptuPagadaAplicada ?? 0)] as Array<string | number>]
        : []),
      ['(=) Utilidad Fiscal (Ingresos - Deducciones)', 'Base Gravable', isr.utilidadFiscalEstimada]
    );
  } else if (!isResicoPf) {
    isrRows.push(
      ['Coeficiente de Utilidad Aplicado', 'Art. 14 LISR', (isr.coeficienteUtilidadAplicado * 100).toFixed(4) + '%'],
      ...((isr.ptuPagadaAplicada ?? 0) > 0
        ? [['(-) PTU Pagada Deducible', 'Art. 14 / 106 LISR', -(isr.ptuPagadaAplicada ?? 0)] as Array<string | number>]
        : []),
      ['Utilidad Fiscal Estimada', 'Base Gravable', isr.utilidadFiscalEstimada]
    );
  }

  if (!isResicoPf) isrRows.push(['(-) Pérdidas Fiscales Aplicadas', 'Art. 57 LISR', -isr.perdidasFiscalesAplicadas]);

  isrRows.push(
    ['(=) Base Gravable ISR', isResicoPf ? 'Art. 113-E LISR (Mensual)' : isPfGeneral ? 'Tarifa Art. 106 LISR' : 'Base Gravable ISR', isr.baseGravableIsr],
    [
      'ISR Causado Periodo',
      isResicoPf ? `RESICO PF Mensual Tasa ${isr.tasaIsrPct}%` : isResico ? `RESICO Tasa ${isr.tasaIsrPct}%` : isPfGeneral ? 'Tarifa Art. 106 LISR' : `Tasa ${isr.tasaIsrPct}% Art. 9 LISR`,
      isr.isrCausado
    ]
  );

  if (!isResicoPf) isrRows.push(['(-) Pagos Provisionales Previos', 'Acreditamiento', -isr.pagosProvisionalesPrevios]);

  isrRows.push(
    ['(-) ISR Retenido por Terceros', 'Acreditamiento', -isr.isrRetenidoPeriodo],
    ['(=) ISR Neto a Pagar Periodo', 'Línea de Captura Día 17', isr.isrNetoAPagar],
    ['Actos Gravados Cobrados', 'Art. 1 LIVA', iva.actosGravadosCobrado16],
    ['IVA Trasladado Cobrado', 'Art. 1-B LIVA', iva.ivaTrasladadoCobrado],
    ['(-) IVA Acreditable Pagado', 'Art. 4 / 5 LIVA', -iva.ivaAcreditablePagado],
    ['(-) IVA Retenido Acreditable (por Clientes)', 'Art. 1-A LIVA', -(iva.ivaRetenidoAcreditable ?? 0)],
    ['(-) Saldo a Favor IVA Anterior Acreditado', 'Art. 6 LIVA', -iva.saldoFavorIvaAcreditable],
    ['(=) IVA Neto a Pagar', 'Art. 5-D LIVA', iva.ivaNetoAPagar],
    ['Retenciones de ISR por Enterar', 'Art. 96 / 106 / 113-J LISR', cap.retencionesIsrPorEnterar],
    ['Retenciones de IVA por Enterar', 'Art. 1-A LIVA', cap.retencionesIvaPorEnterar],
    ['TOTAL ESTIMADO DÍA 17 (ISR + IVA + Retenciones)', 'Línea de Captura SAT', cap.totalEstimadoDia17]
  );

  return isrRows;
}

import type { SheetData } from 'write-excel-file/browser';
import { formatBalanceCutoffLabel, formatIncomePeriodLabel, sanitizeSpreadsheetText } from '../shared/date-utils';
import type {
  AccountWithBalance,
  Company,
  FinancialStatementsResponse,
  FiscalWorkpaperResponse
} from '../shared/types';

export const xStr = (val: string | null | undefined, bold = false) => ({
  type: String,
  value: sanitizeSpreadsheetText(val ?? ''),
  fontWeight: bold ? ('bold' as const) : undefined
});

export const xNum = (value: number, bold = false, format = '$#,##0.00') => ({
  type: Number,
  value,
  format,
  fontWeight: bold ? ('bold' as const) : undefined
});

const signedBal = (a: AccountWithBalance, expected: 'DEUDORA' | 'ACREEDORA') =>
  a.nature === expected ? a.finalBalance : -a.finalBalance;

const signedMes = (a: AccountWithBalance, expected: 'DEUDORA' | 'ACREEDORA') =>
  expected === 'ACREEDORA' ? a.periodCredits - a.periodCharges : a.periodCharges - a.periodCredits;

const isNonZeroRow = (a: AccountWithBalance) =>
  Math.abs(a.initialBalanceComputed) >= 0.01 ||
  Math.abs(a.periodCharges) >= 0.01 ||
  Math.abs(a.periodCredits) >= 0.01 ||
  Math.abs(a.finalBalance) >= 0.01;

export function buildBalanzaSheetData(
  reportsData: FinancialStatementsResponse,
  company: Company,
  year: number,
  period: number,
  mesLabel: string,
  hideZeroAccounts: boolean
): SheetData {
  const rowsSource = hideZeroAccounts
    ? reportsData.trialBalance.filter(isNonZeroRow)
    : reportsData.trialBalance;
  const t = reportsData.totals;
  const cutoff = formatBalanceCutoffLabel(year, period, mesLabel);

  return [
    [xStr('LIBREPAQ PRO ERP — BALANZA DE COMPROBACIÓN (ANEXO 24 SAT / NIF B-1)', true)],
    [xStr(`${company.name} | RFC: ${company.rfc} | ${cutoff}`, true)],
    [xStr(`Régimen: ${company.regimenFiscal} | Cifras en MXN`)],
    [],
    [
      { value: 'Código Cuenta', fontWeight: 'bold' },
      { value: 'Nombre de la Cuenta', fontWeight: 'bold' },
      { value: 'Agrupador SAT', fontWeight: 'bold' },
      { value: 'Naturaleza', fontWeight: 'bold' },
      { value: 'Nivel', fontWeight: 'bold', align: 'center' },
      { value: 'Saldo Inicial', fontWeight: 'bold', align: 'right' },
      { value: 'Cargos (Debe)', fontWeight: 'bold', align: 'right' },
      { value: 'Abonos (Haber)', fontWeight: 'bold', align: 'right' },
      { value: 'Saldo Final', fontWeight: 'bold', align: 'right' }
    ],
    ...rowsSource.map((r): SheetData[number] => [
      xStr(r.code),
      xStr(r.name),
      xStr(r.satGroupCode),
      xStr(r.nature),
      { type: Number, value: r.level },
      xNum(r.initialBalanceComputed),
      xNum(r.periodCharges),
      xNum(r.periodCredits),
      xNum(r.finalBalance, r.level === 1)
    ]),
    [
      xStr('SUMAS IGUALES (DEUDOR / CARGOS)', true),
      xStr('Validación 3/3 Saldo Inicial, Movimientos y Saldo Final', true),
      xStr(''),
      xStr('DEUDORA', true),
      xStr(''),
      xNum(t.initialDeudor, true),
      xNum(t.totalCargos, true),
      xNum(t.totalAbonos, true),
      xNum(t.finalDeudor, true)
    ],
    [
      xStr('SUMAS IGUALES (ACREEDOR / ABONOS)', true),
      xStr('Contrapartida Acreedora', true),
      xStr(''),
      xStr('ACREEDORA', true),
      xStr(''),
      xNum(t.initialAcreedor, true),
      xNum(t.totalCargos, true),
      xNum(t.totalAbonos, true),
      xNum(t.finalAcreedor, true)
    ]
  ];
}

export function buildEstadoResultadosSheetData(
  reportsData: FinancialStatementsResponse,
  company: Company,
  year: number,
  period: number,
  mesLabel: string,
  formatVerticalPct: (amount: number, base: number) => string,
  hideZeroAccounts: boolean
): SheetData {
  const er = reportsData.incomeStatement;
  const p = er.periodTotals;
  const utilOp = er.utilidadOperativa ?? er.utilidadBruta - er.totalGastos;
  const rifNeto = er.rifNeto ?? 0;
  const uai = er.utilidadAntesImpuestos ?? utilOp + rifNeto;
  const totalIsr = er.totalIsr ?? 0;
  const cutoff = formatIncomePeriodLabel(year, period, mesLabel);
  const safePct = (val: number) =>
    !er.totalIngresos || Math.abs(er.totalIngresos) < 0.01 ? '0.0%' : formatVerticalPct(val, er.totalIngresos);

  const filterList = (list: AccountWithBalance[], expected: 'DEUDORA' | 'ACREEDORA') =>
    hideZeroAccounts
      ? list.filter((a) => Math.abs(a.finalBalance) >= 0.01 || Math.abs(signedMes(a, expected)) >= 0.01)
      : list;

  const mapRow = (label: string, a: AccountWithBalance, expected: 'DEUDORA' | 'ACREEDORA'): SheetData[number] => {
    const ytd = signedBal(a, expected);
    return [
      xStr(label),
      xStr(a.code),
      xStr(a.name),
      xNum(signedMes(a, expected)),
      xNum(ytd),
      xStr(safePct(ytd))
    ];
  };

  const subtotal = (rubro: string, desc: string, mesVal: number, ytdVal: number): SheetData[number] => [
    xStr(rubro, true),
    xStr(''),
    xStr(desc, true),
    xNum(mesVal, true),
    xNum(ytdVal, true),
    xStr(safePct(ytdVal), true)
  ];

  return [
    [xStr('LIBREPAQ PRO ERP — ESTADO DE RESULTADOS INTEGRAL (NIF B-3)', true)],
    [xStr(`${company.name} | RFC: ${company.rfc} | ${cutoff}`, true)],
    [xStr('Comparativo Del Mes vs. Acumulado YTD • Cifras en MXN')],
    [],
    [
      { value: 'Rubro Contable', fontWeight: 'bold' },
      { value: 'Código', fontWeight: 'bold' },
      { value: 'Nombre Cuenta', fontWeight: 'bold' },
      { value: 'Del Mes MXN', fontWeight: 'bold', align: 'right' },
      { value: 'Acumulado YTD MXN', fontWeight: 'bold', align: 'right' },
      { value: '% s/Ventas', fontWeight: 'bold', align: 'right' }
    ],
    ...filterList(er.ingresos, 'ACREEDORA').map((a) => mapRow('INGRESOS', a, 'ACREEDORA')),
    subtotal('TOTAL INGRESOS', 'Ventas Netas del Periodo', p?.totalIngresos ?? 0, er.totalIngresos),
    ...filterList(er.costos, 'DEUDORA').map((a) => mapRow('COSTOS', a, 'DEUDORA')),
    subtotal('TOTAL COSTOS', 'Costo de Ventas NIF B-3', p?.totalCostos ?? 0, er.totalCostos),
    subtotal('UTILIDAD BRUTA', 'Utilidad Bruta Operativa', p?.utilidadBruta ?? 0, er.utilidadBruta),
    ...filterList(er.gastos, 'DEUDORA').map((a) => mapRow('GASTOS', a, 'DEUDORA')),
    subtotal('TOTAL GASTOS', 'Gastos Generales de Operación', p?.totalGastos ?? 0, er.totalGastos),
    subtotal('UTILIDAD DE OPERACIÓN', 'Resultado de Operación (NIF B-3)', p?.utilidadOperativa ?? 0, utilOp),
    ...filterList(er.rifProductos ?? [], 'ACREEDORA').map((a) => mapRow('RIF PRODUCTOS', a, 'ACREEDORA')),
    ...filterList(er.rifGastos ?? [], 'DEUDORA').map((a) => mapRow('RIF GASTOS', a, 'DEUDORA')),
    subtotal('RIF NETO', 'Resultado Integral de Financiamiento (702 - 701)', p?.rifNeto ?? 0, rifNeto),
    subtotal('UTILIDAD ANTES DE IMPUESTOS', 'Utilidad antes de Impuestos (UAI)', p?.utilidadAntesImpuestos ?? 0, uai),
    ...filterList(er.isrEjercicio ?? [], 'DEUDORA').map((a) => mapRow('ISR EJERCICIO', a, 'DEUDORA')),
    ...(totalIsr !== 0 || (er.isrEjercicio && er.isrEjercicio.length > 0)
      ? [subtotal('PROVISIÓN ISR', 'Provisión ISR del Ejercicio (NIF D-4)', p?.totalIsr ?? 0, totalIsr)]
      : []),
    subtotal(
      er.utilidadNeta < 0 ? 'PÉRDIDA NETA DEL EJERCICIO' : 'UTILIDAD NETA DEL EJERCICIO',
      'Resultado Neto Contable del Periodo (NIF B-3)',
      p?.utilidadNeta ?? 0,
      er.utilidadNeta
    )
  ];
}

export function buildBalanceGeneralSheetData(
  reportsData: FinancialStatementsResponse,
  company: Company,
  year: number,
  period: number,
  mesLabel: string,
  hideZeroAccounts: boolean
): SheetData {
  const bg = reportsData.balanceSheet;
  const nif = bg.nifB6;
  const cutoff = formatBalanceCutoffLabel(year, period, mesLabel);
  const totalCapital = bg.totalPasivoMasCapital - bg.totalPasivo;

  const filterZero = (list: AccountWithBalance[]) =>
    hideZeroAccounts ? list.filter((a) => Math.abs(a.finalBalance) >= 0.01) : list;

  const mapBgRow = (section: string, a: AccountWithBalance, expected: 'DEUDORA' | 'ACREEDORA'): SheetData[number] => {
    const val = signedBal(a, expected);
    return [
      xStr(section),
      xStr(a.code),
      xStr(a.name),
      a.isAffectable ? xNum(val) : xStr(''),
      !a.isAffectable ? xNum(val, true) : xStr('')
    ];
  };

  return [
    [xStr('LIBREPAQ PRO ERP — BALANCE GENERAL / SITUACIÓN FINANCIERA (NIF B-6)', true)],
    [xStr(`${company.name} | RFC: ${company.rfc} | ${cutoff}`, true)],
    [xStr(`Ecuación Contable: ${bg.isBalanced ? 'CUADRADA (A = P + C)' : 'CON DIFERENCIA'} • Cifras en MXN`)],
    [],
    [
      { value: 'Clasificación NIF B-6', fontWeight: 'bold' },
      { value: 'Código', fontWeight: 'bold' },
      { value: 'Nombre de la Cuenta', fontWeight: 'bold' },
      { value: 'Saldo Cuenta MXN', fontWeight: 'bold', align: 'right' },
      { value: 'Subtotal Rubro MXN', fontWeight: 'bold', align: 'right' }
    ],
    ...filterZero(nif?.activoCirculante ?? bg.activos).map((a) => mapBgRow('ACTIVO CIRCULANTE', a, 'DEUDORA')),
    ...(nif ? [[xStr('SUBTOTAL ACTIVO CIRCULANTE', true), xStr(''), xStr('Total Activo Circulante', true), xStr(''), xNum(nif.totalActivoCirculante, true)]] : []),
    ...filterZero(nif?.activoNoCirculante ?? []).map((a) => mapBgRow('ACTIVO NO CIRCULANTE', a, 'DEUDORA')),
    ...(nif ? [[xStr('SUBTOTAL ACTIVO NO CIRCULANTE', true), xStr(''), xStr('Total Activo No Circulante', true), xStr(''), xNum(nif.totalActivoNoCirculante, true)]] : []),
    [xStr('TOTAL ACTIVO', true), xStr('100'), xStr('Total Activo Neto (NIF B-6)', true), xStr(''), xNum(bg.totalActivo, true)],
    ...filterZero(nif?.pasivoCortoPlazo ?? bg.pasivos).map((a) => mapBgRow('PASIVO CORTO PLAZO', a, 'ACREEDORA')),
    ...(nif ? [[xStr('SUBTOTAL PASIVO CORTO PLAZO', true), xStr(''), xStr('Total Pasivo a Corto Plazo', true), xStr(''), xNum(nif.totalPasivoCortoPlazo, true)]] : []),
    ...filterZero(nif?.pasivoLargoPlazo ?? []).map((a) => mapBgRow('PASIVO LARGO PLAZO', a, 'ACREEDORA')),
    ...(nif && (nif.pasivoLargoPlazo.length > 0 || Math.abs(nif.totalPasivoLargoPlazo) >= 0.01)
      ? [[xStr('SUBTOTAL PASIVO LARGO PLAZO', true), xStr(''), xStr('Total Pasivo a Largo Plazo', true), xStr(''), xNum(nif.totalPasivoLargoPlazo, true)]]
      : []),
    [xStr('TOTAL PASIVO', true), xStr('200'), xStr('Total Pasivo', true), xStr(''), xNum(bg.totalPasivo, true)],
    ...filterZero(nif?.capitalContribuido ?? bg.capital).map((a) => mapBgRow('CAPITAL CONTRIBUIDO', a, 'ACREEDORA')),
    ...(nif ? [[xStr('SUBTOTAL CAPITAL CONTRIBUIDO', true), xStr(''), xStr('Total Capital Contribuido', true), xStr(''), xNum(nif.totalCapitalContribuido, true)]] : []),
    ...filterZero(nif?.capitalGanado ?? []).map((a) => mapBgRow('CAPITAL GANADO', a, 'ACREEDORA')),
    [xStr('CAPITAL GANADO'), xStr('305-01-001'), xStr('Resultado (Utilidad / Pérdida) del Ejercicio Actual'), xNum(bg.utilidadEjercicio), xStr('')],
    ...(nif ? [[xStr('SUBTOTAL CAPITAL GANADO', true), xStr(''), xStr('Total Capital Ganado', true), xStr(''), xNum(nif.totalCapitalGanado, true)]] : []),
    [xStr('TOTAL CAPITAL CONTABLE', true), xStr('300'), xStr('Total Capital Contable', true), xStr(''), xNum(totalCapital, true)],
    [xStr('TOTAL PASIVO Y CAPITAL', true), xStr(''), xStr('Suma de Pasivo y Capital Contable', true), xStr(''), xNum(bg.totalPasivoMasCapital, true)]
  ];
}

export function buildDia17SheetData(
  fiscalData: FiscalWorkpaperResponse | null | undefined,
  company: Company,
  year: number,
  period: number,
  mesLabel: string
): SheetData {
  const isr = fiscalData?.isrProvisional;
  const iva = fiscalData?.ivaDefinitivo;
  const cap = fiscalData?.resumenLineaCapturaSat;
  const isPf = company.rfc.trim().length === 13;
  const isResico = Boolean(isr?.esResico);
  const isResicoPf = isResico && isPf;
  const isResicoPm = isResico && !isPf;
  const isPfGeneral = isPf && !isResico;
  const cutoff = formatBalanceCutoffLabel(year, period, mesLabel);

  const rows: SheetData = [
    [xStr('LIBREPAQ PRO ERP — PAPEL DE TRABAJO IMPUESTOS FEDERALES (DÍA 17 SAT)', true)],
    [xStr(`${company.name} | RFC: ${company.rfc} | ${cutoff}`, true)],
    [xStr(`Régimen Fiscal: ${company.regimenFiscal} | Cifras en MXN`)],
    [],
    [
      { value: 'Concepto Fiscal SAT', fontWeight: 'bold' },
      { value: 'Fundamento Legal / Base', fontWeight: 'bold' },
      { value: 'Importe Determinado MXN', fontWeight: 'bold', align: 'right' }
    ],
    [xStr('Ingresos Cobrados / Nominales Periodo'), xStr(isResico ? 'RESICO Flujo' : isPfGeneral ? 'Art. 106 LISR' : 'Art. 14 / 16 LISR'), xNum(isr?.ingresosPeriodo ?? 0)]
  ];

  if (!isResicoPf) {
    rows.push([xStr('Ingresos Acumulables del Ejercicio'), xStr('Acumulado Anual'), xNum(isr?.ingresosAcumuladosEjercicio ?? 0)]);
  }
  if (isResicoPm || isPfGeneral) {
    rows.push(
      [xStr('(-) Deducciones Autorizadas del Mes'), xStr('Flujo de Efectivo'), xNum(isr?.deduccionesAutorizadasPeriodo ?? 0)],
      [xStr('(-) Deducciones Acumuladas del Ejercicio'), xStr('Acumulado Anual'), xNum(isr?.deduccionesAcumuladasEjercicio ?? isr?.deduccionesAutorizadasPeriodo ?? 0)]
    );
  } else if (!isResicoPf) {
    rows.push([xStr('Coeficiente de Utilidad Aplicado'), xStr('Art. 14 Fracc. I LISR'), xNum(isr?.coeficienteUtilidadAplicado ?? 0, false, '0.0000')]);
  }
  if (!isResicoPf) {
    if ((isr?.ptuPagadaAplicada ?? 0) > 0) {
      rows.push([xStr('(-) PTU Pagada Deducible'), xStr('Art. 14 / 106 LISR'), xNum(isr?.ptuPagadaAplicada ?? 0)]);
    }
    rows.push(
      [xStr('(=) Utilidad Fiscal Estimada'), xStr('Resultado Fiscal Acumulado'), xNum(isr?.utilidadFiscalEstimada ?? 0)],
      [xStr('(-) Pérdidas Fiscales Aplicadas'), xStr('Art. 57 LISR'), xNum(isr?.perdidasFiscalesAplicadas ?? 0)]
    );
  }

  rows.push(
    [xStr('(=) Base Gravable ISR'), xStr(isResicoPf ? 'Art. 113-E LISR (Mensual)' : isPfGeneral ? 'Tarifa Art. 106 LISR' : 'Base Gravable ISR'), xNum(isr?.baseGravableIsr ?? 0)],
    [xStr('ISR Causado'), xStr(`Tasa Efectiva ${(isr?.tasaIsrPct ?? 30).toFixed(2)}%`), xNum(isr?.isrCausado ?? 0)],
    ...(!isResicoPf ? [[xStr('(-) Pagos Provisionales Previos'), xStr('Acreditamiento'), xNum(isr?.pagosProvisionalesPrevios ?? 0)] as SheetData[number]] : []),
    [xStr('(-) ISR Retenido Acreditable'), xStr('Art. 14 / 106 / 113-E LISR'), xNum(isr?.isrRetenidoPeriodo ?? 0)],
    [xStr('(=) ISR Neto a Pagar Periodo', true), xStr('Línea de Captura Día 17'), xNum(isr?.isrNetoAPagar ?? 0, true)],
    [xStr('IVA Trasladado Cobrado'), xStr('Art. 1 / 1-B LIVA'), xNum(iva?.ivaTrasladadoCobrado ?? 0)],
    [xStr('(-) IVA Acreditable Pagado'), xStr('Art. 4 / 5 LIVA'), xNum(iva?.ivaAcreditablePagado ?? 0)],
    [xStr('(-) IVA Retenido Acreditable (por Clientes)'), xStr('Art. 1-A / 5 LIVA'), xNum(iva?.ivaRetenidoAcreditable ?? 0)],
    [xStr('(-) Saldo a Favor IVA Previo'), xStr('Art. 6 LIVA'), xNum(iva?.saldoFavorIvaAcreditable ?? 0)],
    [xStr('(=) IVA Neto a Pagar', true), xStr('Liquidación Mensual LIVA'), xNum(iva?.ivaNetoAPagar ?? 0, true)],
    [xStr('Retenciones de ISR por Enterar'), xStr('Art. 96 / 106 / 113-J LISR'), xNum(cap?.retencionesIsrPorEnterar ?? 0)],
    [xStr('Retenciones de IVA por Enterar'), xStr('Art. 1-A LIVA'), xNum(cap?.retencionesIvaPorEnterar ?? 0)],
    [xStr('TOTAL ESTIMADO LÍNEA CAPTURA', true), xStr('SAT Día 17 Oficial', true), xNum(cap?.totalEstimadoDia17 ?? 0, true)]
  );
  return rows;
}

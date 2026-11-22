import writeXlsx, { type SheetData } from 'write-excel-file/browser';
import { sanitizeSpreadsheetText } from '../shared/date-utils';
import type { Company, FinancialStatementsResponse, FiscalWorkpaperResponse } from '../shared/types';

interface AccountLedgerEntry {
  fecha: string;
  tipoPoliza: string;
  folioPoliza: number;
  accountCode: string;
  accountName: string;
  referencia: string;
  concepto: string;
  cfdiUuid?: string | null;
  cargo: number;
  abono: number;
  runningBalance: number;
}

export interface AccountLedgerData {
  companyId?: string;
  ejercicio: number;
  periodo: number;
  initialBalance: number;
  account: { code: string; name: string };
  entries: AccountLedgerEntry[];
}

const sCell = (val: string | null | undefined) => ({
  type: String,
  value: sanitizeSpreadsheetText(val ?? '')
});

export async function exportAccountLedgerXlsx(
  data: AccountLedgerData,
  mesNombre: string,
  companyRfc: string
): Promise<void> {
  const safeRfc = sanitizeSpreadsheetText(companyRfc);
  const safeAccName = sanitizeSpreadsheetText(data.account.name);
  const rows: SheetData = [
    [{ value: 'LIBREPAQ PRO ERP — TARJETA AUXILIAR DE MAYOR', fontWeight: 'bold' }],
    [{ value: `Empresa RFC: ${safeRfc} | Periodo: ${mesNombre} ${data.ejercicio}`, fontWeight: 'bold' }],
    [{ value: `Cuenta: ${data.account.code} - ${safeAccName}`, fontWeight: 'bold' }],
    [],
    [
      { value: 'Fecha', fontWeight: 'bold', align: 'center' },
      { value: 'Póliza', fontWeight: 'bold', align: 'center' },
      { value: 'Código Cuenta', fontWeight: 'bold' },
      { value: 'Nombre Cuenta', fontWeight: 'bold' },
      { value: 'Referencia', fontWeight: 'bold' },
      { value: 'Concepto', fontWeight: 'bold' },
      { value: 'UUID CFDI', fontWeight: 'bold' },
      { value: 'Cargo (Debe)', fontWeight: 'bold', align: 'right' },
      { value: 'Abono (Haber)', fontWeight: 'bold', align: 'right' },
      { value: 'Saldo Progresivo', fontWeight: 'bold', align: 'right' }
    ],
    [
      sCell(`${data.ejercicio}-${String(data.periodo).padStart(2, '0')}-01`),
      sCell('SALDO INICIAL'),
      sCell(data.account.code),
      sCell(data.account.name),
      sCell('APERTURA'),
      sCell(`Saldo Inicial al inicio de ${mesNombre} ${data.ejercicio}`),
      sCell(''),
      { type: Number, value: 0, format: '$#,##0.00' },
      { type: Number, value: 0, format: '$#,##0.00' },
      { type: Number, value: data.initialBalance, format: '$#,##0.00', fontWeight: 'bold' }
    ]
  ];

  let totalCargos = 0;
  let totalAbonos = 0;

  for (const e of data.entries) {
    totalCargos += e.cargo;
    totalAbonos += e.abono;
    rows.push([
      sCell(e.fecha),
      sCell(`${e.tipoPoliza} #${e.folioPoliza}`),
      sCell(e.accountCode),
      sCell(e.accountName),
      sCell(e.referencia),
      sCell(e.concepto),
      sCell(e.cfdiUuid || ''),
      { type: Number, value: e.cargo, format: '$#,##0.00' },
      { type: Number, value: e.abono, format: '$#,##0.00' },
      { type: Number, value: e.runningBalance, format: '$#,##0.00' }
    ]);
  }

  rows.push([
    { type: String, value: 'TOTALES DEL PERIODO', fontWeight: 'bold' },
    sCell(''),
    sCell(''),
    sCell(''),
    sCell(''),
    sCell(''),
    sCell(''),
    { type: Number, value: totalCargos, format: '$#,##0.00', fontWeight: 'bold' },
    { type: Number, value: totalAbonos, format: '$#,##0.00', fontWeight: 'bold' },
    {
      type: Number,
      value: data.entries.length > 0 ? (data.entries[data.entries.length - 1]?.runningBalance ?? 0) : data.initialBalance,
      format: '$#,##0.00',
      fontWeight: 'bold'
    }
  ]);

  const fileName = `Mayor_${data.account.code.replace(/[^a-zA-Z0-9-]/g, '_')}_${data.ejercicio}_P${String(data.periodo).padStart(2, '0')}.xlsx`;
  await writeXlsx([
    {
      sheet: 'Mayor',
      data: rows,
      columns: [
        { width: 14 }, { width: 16 }, { width: 16 }, { width: 28 }, { width: 16 },
        { width: 36 }, { width: 38 }, { width: 18 }, { width: 18 }, { width: 18 }
      ]
    }
  ]).toFile(fileName);
}

export async function exportDeliverablesXlsx({
  reportsData,
  fiscalData,
  company,
  year,
  period,
  formatVerticalPct
}: {
  reportsData: FinancialStatementsResponse | null | undefined;
  fiscalData: FiscalWorkpaperResponse | null | undefined;
  company: Company;
  year: number;
  period: number;
  formatVerticalPct: (amount: number, base: number) => string;
}): Promise<void> {
  if (!reportsData) return;

  const balanzaSheet: SheetData = [
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
    ...reportsData.trialBalance.map((r): SheetData[number] => [
      sCell(r.code),
      sCell(r.name),
      sCell(r.satGroupCode),
      sCell(r.nature),
      { type: Number, value: r.level },
      { type: Number, value: r.initialBalanceComputed, format: '$#,##0.00' },
      { type: Number, value: r.periodCharges, format: '$#,##0.00' },
      { type: Number, value: r.periodCredits, format: '$#,##0.00' },
      { type: Number, value: r.finalBalance, format: '$#,##0.00', fontWeight: r.level === 1 ? 'bold' : undefined }
    ])
  ];

  const er = reportsData.incomeStatement;
  const totalIsr = er.totalIsr ?? 0;
  const isrRows: SheetData =
    totalIsr !== 0
      ? [
          ...(er.isrEjercicio ?? []).map((a): SheetData[number] => [
            sCell('ISR EJERCICIO'),
            sCell(a.code),
            sCell(a.name),
            { type: Number, value: a.finalBalance, format: '$#,##0.00' },
            sCell(formatVerticalPct(a.finalBalance, er.totalIngresos))
          ]),
          [
            { type: String, value: 'IMPUESTOS A LA UTILIDAD (ISR)', fontWeight: 'bold' },
            sCell(''),
            { type: String, value: 'Provisión ISR del Ejercicio (NIF D-4)', fontWeight: 'bold' },
            { type: Number, value: totalIsr, format: '$#,##0.00', fontWeight: 'bold' },
            { type: String, value: formatVerticalPct(totalIsr, er.totalIngresos), fontWeight: 'bold' }
          ]
        ]
      : [];

  const erSheet: SheetData = [
    [
      { value: 'Rubro Contable', fontWeight: 'bold' },
      { value: 'Código', fontWeight: 'bold' },
      { value: 'Nombre Cuenta', fontWeight: 'bold' },
      { value: 'Importe MXN', fontWeight: 'bold', align: 'right' },
      { value: '% s/Ventas', fontWeight: 'bold', align: 'right' }
    ],
    ...er.ingresos.map((a): SheetData[number] => [
      sCell('INGRESOS'), sCell(a.code), sCell(a.name),
      { type: Number, value: a.finalBalance, format: '$#,##0.00' },
      sCell(formatVerticalPct(a.finalBalance, er.totalIngresos))
    ]),
    [
      { type: String, value: 'TOTAL INGRESOS', fontWeight: 'bold' }, sCell(''),
      { type: String, value: 'Ventas Netas del Periodo', fontWeight: 'bold' },
      { type: Number, value: er.totalIngresos, format: '$#,##0.00', fontWeight: 'bold' },
      { type: String, value: '100.0%', fontWeight: 'bold' }
    ],
    ...er.costos.map((a): SheetData[number] => [
      sCell('COSTOS'), sCell(a.code), sCell(a.name),
      { type: Number, value: a.finalBalance, format: '$#,##0.00' },
      sCell(formatVerticalPct(a.finalBalance, er.totalIngresos))
    ]),
    [
      { type: String, value: 'TOTAL COSTOS', fontWeight: 'bold' }, sCell(''),
      { type: String, value: 'Costo de Ventas NIF B-3', fontWeight: 'bold' },
      { type: Number, value: er.totalCostos, format: '$#,##0.00', fontWeight: 'bold' },
      { type: String, value: formatVerticalPct(er.totalCostos, er.totalIngresos), fontWeight: 'bold' }
    ],
    [
      { type: String, value: 'UTILIDAD BRUTA', fontWeight: 'bold' }, sCell(''),
      { type: String, value: 'Margen Bruto de Operación', fontWeight: 'bold' },
      { type: Number, value: er.utilidadBruta, format: '$#,##0.00', fontWeight: 'bold' },
      { type: String, value: formatVerticalPct(er.utilidadBruta, er.totalIngresos), fontWeight: 'bold' }
    ],
    ...er.gastos.map((a): SheetData[number] => [
      sCell('GASTOS'), sCell(a.code), sCell(a.name),
      { type: Number, value: a.finalBalance, format: '$#,##0.00' },
      sCell(formatVerticalPct(a.finalBalance, er.totalIngresos))
    ]),
    [
      { type: String, value: 'TOTAL GASTOS GENERALES', fontWeight: 'bold' }, sCell(''),
      { type: String, value: 'Gastos de Operación y Administración', fontWeight: 'bold' },
      { type: Number, value: er.totalGastos, format: '$#,##0.00', fontWeight: 'bold' },
      { type: String, value: formatVerticalPct(er.totalGastos, er.totalIngresos), fontWeight: 'bold' }
    ],
    ...isrRows,
    [
      { type: String, value: 'UTILIDAD NETA DEL EJERCICIO', fontWeight: 'bold' }, sCell(''),
      { type: String, value: 'Resultado Neto Fiscal', fontWeight: 'bold' },
      { type: Number, value: er.utilidadNeta, format: '$#,##0.00', fontWeight: 'bold' },
      { type: String, value: formatVerticalPct(er.utilidadNeta, er.totalIngresos), fontWeight: 'bold' }
    ]
  ];

  const bg = reportsData.balanceSheet;
  const signedBal = (a: FinancialStatementsResponse['trialBalance'][number], expectedNature: 'DEUDORA' | 'ACREEDORA') =>
    a.nature === expectedNature ? a.finalBalance : -a.finalBalance;

  const mapBgRow = (section: string, a: FinancialStatementsResponse['trialBalance'][number], expectedNature: 'DEUDORA' | 'ACREEDORA'): SheetData[number] => {
    const val = signedBal(a, expectedNature);
    return [
      sCell(section),
      sCell(a.code),
      sCell(a.name),
      a.isAffectable ? { type: Number, value: val, format: '$#,##0.00' } : sCell(''),
      !a.isAffectable ? { type: Number, value: val, format: '$#,##0.00', fontWeight: 'bold' } : sCell('')
    ];
  };

  const bgSheet: SheetData = [
    [
      { value: 'Clasificación', fontWeight: 'bold' },
      { value: 'Código', fontWeight: 'bold' },
      { value: 'Nombre de la Cuenta', fontWeight: 'bold' },
      { value: 'Saldo Cuenta MXN', fontWeight: 'bold', align: 'right' },
      { value: 'Subtotal Rubro MXN', fontWeight: 'bold', align: 'right' }
    ],
    ...bg.activos.map((a) => mapBgRow('ACTIVO', a, 'DEUDORA')),
    [
      { type: String, value: 'TOTAL ACTIVO', fontWeight: 'bold' }, sCell('100'),
      { type: String, value: 'Total Activo Neto (NIF B-6)', fontWeight: 'bold' },
      sCell(''),
      { type: Number, value: bg.totalActivo, format: '$#,##0.00', fontWeight: 'bold' }
    ],
    ...bg.pasivos.map((a) => mapBgRow('PASIVO', a, 'ACREEDORA')),
    [
      { type: String, value: 'TOTAL PASIVO', fontWeight: 'bold' }, sCell('200'),
      { type: String, value: 'Total Pasivo', fontWeight: 'bold' },
      sCell(''),
      { type: Number, value: bg.totalPasivo, format: '$#,##0.00', fontWeight: 'bold' }
    ],
    ...bg.capital.map((a) => mapBgRow('CAPITAL', a, 'ACREEDORA')),
    [
      sCell('CAPITAL'),
      sCell('305-01-001'),
      sCell('Resultado (Utilidad / Pérdida) del Ejercicio Actual'),
      { type: Number, value: bg.utilidadEjercicio, format: '$#,##0.00' },
      sCell('')
    ],
    [
      { type: String, value: 'TOTAL PASIVO Y CAPITAL', fontWeight: 'bold' }, sCell(''),
      { type: String, value: 'Suma de Pasivo y Capital Contable', fontWeight: 'bold' },
      sCell(''),
      { type: Number, value: bg.totalPasivoMasCapital, format: '$#,##0.00', fontWeight: 'bold' }
    ]
  ];

  const dia17Sheet: SheetData = [
    [
      { value: 'Concepto Fiscal SAT', fontWeight: 'bold' },
      { value: 'Fundamento Legal / Base', fontWeight: 'bold' },
      { value: 'Importe Determinado MXN', fontWeight: 'bold', align: 'right' }
    ],
    [sCell('Régimen Fiscal'), sCell(company.regimenFiscal), sCell('')],
    [sCell('Ingresos Nominales Periodo'), sCell('Art. 16 / 17 / 106 LISR'), { type: Number, value: fiscalData?.isrProvisional.ingresosPeriodo ?? 0, format: '$#,##0.00' }],
    [sCell('Ingresos Acumulables Ejercicio'), sCell('Art. 14 / 106 LISR'), { type: Number, value: fiscalData?.isrProvisional.ingresosAcumuladosEjercicio ?? 0, format: '$#,##0.00' }],
    [sCell('Deducciones Autorizadas Periodo'), sCell('Art. 25 / 103 LISR'), { type: Number, value: fiscalData?.isrProvisional.deduccionesAutorizadasPeriodo ?? 0, format: '$#,##0.00' }],
    [sCell('Coeficiente de Utilidad'), sCell('Art. 14 Fracc. I LISR'), { type: Number, value: fiscalData?.isrProvisional.coeficienteUtilidadAplicado ?? 0, format: '0.0000' }],
    [sCell('Utilidad Fiscal Estimada'), sCell('Base Gravable ISR'), { type: Number, value: fiscalData?.isrProvisional.utilidadFiscalEstimada ?? 0, format: '$#,##0.00' }],
    [sCell('ISR Causado Acumulado'), sCell(`Tasa Efectiva ${fiscalData?.isrProvisional.tasaIsrPct ?? 30}%`), { type: Number, value: fiscalData?.isrProvisional.isrCausado ?? 0, format: '$#,##0.00' }],
    [sCell('(-) Pagos Provisionales Previos'), sCell('Art. 14 LISR'), { type: Number, value: fiscalData?.isrProvisional.pagosProvisionalesPrevios ?? 0, format: '$#,##0.00' }],
    [sCell('(-) ISR Retenido Acreditable'), sCell('Art. 14 / 106 LISR'), { type: Number, value: fiscalData?.isrProvisional.isrRetenidoPeriodo ?? 0, format: '$#,##0.00' }],
    [sCell('(=) ISR Neto a Pagar Periodo'), sCell('Línea de Captura Día 17'), { type: Number, value: fiscalData?.isrProvisional.isrNetoAPagar ?? 0, format: '$#,##0.00', fontWeight: 'bold' }],
    [sCell('IVA Trasladado Cobrado'), sCell('Art. 1 / 1-B LIVA'), { type: Number, value: fiscalData?.ivaDefinitivo.ivaTrasladadoCobrado ?? 0, format: '$#,##0.00' }],
    [sCell('(-) IVA Acreditable Pagado'), sCell('Art. 4 / 5 LIVA'), { type: Number, value: fiscalData?.ivaDefinitivo.ivaAcreditablePagado ?? 0, format: '$#,##0.00' }],
    [sCell('(-) IVA Retenido Acreditable'), sCell('Art. 5 Fracc. IV LIVA'), { type: Number, value: fiscalData?.ivaDefinitivo.ivaRetenidoAcreditable ?? 0, format: '$#,##0.00' }],
    [sCell('(-) Saldo a Favor IVA Previo'), sCell('Art. 6 LIVA'), { type: Number, value: fiscalData?.ivaDefinitivo.saldoFavorIvaAcreditable ?? 0, format: '$#,##0.00' }],
    [sCell('(=) IVA Neto a Pagar'), sCell('Liquidación Mensual LIVA'), { type: Number, value: fiscalData?.ivaDefinitivo.ivaNetoAPagar ?? 0, format: '$#,##0.00', fontWeight: 'bold' }],
    [sCell('TOTAL ESTIMADO LÍNEA CAPTURA'), sCell('SAT Día 17 Oficial'), { type: Number, value: fiscalData?.resumenLineaCapturaSat.totalEstimadoDia17 ?? 0, format: '$#,##0.00', fontWeight: 'bold' }]
  ];

  const safeFileRfc = company.rfc.replace(/[^a-zA-Z0-9]/g, '');
  const fileName = `Dossier_Ejecutivo_${safeFileRfc}_${year}_P${String(period).padStart(2, '0')}.xlsx`;
  await writeXlsx([
    { sheet: 'Balanza', data: balanzaSheet },
    { sheet: 'Estado de Resultados', data: erSheet },
    { sheet: 'Balance General', data: bgSheet },
    { sheet: 'Papel Dia 17', data: dia17Sheet }
  ]).toFile(fileName);
}

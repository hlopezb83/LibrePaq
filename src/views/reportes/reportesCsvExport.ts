import { downloadCsvFile } from '../../lib/formatters';
import type {
  AccountWithBalance,
  FinancialStatementsResponse
} from '../../shared/types';
import type { AnnualTaxSummaryResponse } from '../../shared/types/annual-tax.types';
import type { ReportTabId } from './ReportesHeaderBar';

export interface BalanzaExportFilterOptions {
  levelScope?: 'ALL' | 'MAYOR' | 'SUBCUENTAS' | 'AFECTABLES' | 'N2';
  omitZeroAccounts?: boolean;
}

export function filterBalanzaAccounts(
  accounts: readonly AccountWithBalance[],
  options?: BalanzaExportFilterOptions
): AccountWithBalance[] {
  const scope = options?.levelScope ?? 'ALL';
  const omitZero = Boolean(options?.omitZeroAccounts);
  return accounts.filter((r) => {
    if (scope === 'MAYOR' && r.level !== 1) return false;
    if ((scope === 'SUBCUENTAS' || scope === 'N2') && r.level > 2) return false;
    if (scope === 'AFECTABLES' && !r.isAffectable) return false;
    if (
      omitZero &&
      Math.abs(r.initialBalanceComputed) < 0.01 &&
      Math.abs(r.periodCharges) < 0.01 &&
      Math.abs(r.periodCredits) < 0.01 &&
      Math.abs(r.finalBalance) < 0.01
    ) {
      return false;
    }
    return true;
  });
}

const signedYtd = (a: AccountWithBalance, expected: 'ACREEDORA' | 'DEUDORA') =>
  a.nature === expected ? a.finalBalance : -a.finalBalance;

const signedMes = (a: AccountWithBalance, expected: 'ACREEDORA' | 'DEUDORA') =>
  expected === 'ACREEDORA' ? a.periodCredits - a.periodCharges : a.periodCharges - a.periodCredits;

export function exportBalanzaCsvOnly(params: {
  company: FinancialStatementsResponse['company'];
  ejercicio: number;
  periodo: number;
  trialBalance: readonly AccountWithBalance[];
  balanzaOptions?: BalanzaExportFilterOptions;
}): string {
  const { company, ejercicio, periodo, trialBalance, balanzaOptions } = params;
  const periodCode = `P${String(periodo).padStart(2, '0')}`;
  const headers = [
    'Código Cuenta', 'Nombre de la Cuenta', 'Agrupador SAT', 'Naturaleza',
    'Nivel', 'Saldo Inicial', 'Cargos (Debe)', 'Abonos (Haber)', 'Saldo Final'
  ];
  const filtered = filterBalanzaAccounts(trialBalance, balanzaOptions);
  const rows = filtered.map((r) => [
    r.code, r.name, r.satGroupCode, r.nature, r.level,
    r.initialBalanceComputed, r.periodCharges, r.periodCredits, r.finalBalance
  ]);
  downloadCsvFile(`Balanza_${company.rfc}_${ejercicio}_${periodCode}.csv`, headers, rows);
  return 'Balanza de Comprobación exportada en CSV';
}

export function exportActiveReportCsv(params: {
  activeTab: ReportTabId;
  data: FinancialStatementsResponse;
  annualTaxData?: AnnualTaxSummaryResponse | null;
  balanzaOptions?: BalanzaExportFilterOptions;
}): string {
  const { activeTab, data, annualTaxData, balanzaOptions } = params;
  const periodCode = `P${String(data.periodo).padStart(2, '0')}`;

  if (activeTab === 'RESULTADOS') {
    const er = data.incomeStatement;
    const p = er.periodTotals;
    const base = er.totalIngresos || 0;
    const pct = (val: number) => (base !== 0 ? `${((val / base) * 100).toFixed(1)}%` : '0.0%');
    const totalIsr = er.totalIsr ?? 0;
    const utilOp = er.utilidadOperativa ?? er.utilidadBruta - er.totalGastos;
    const rifNeto = er.rifNeto ?? 0;
    const uai = er.utilidadAntesImpuestos ?? utilOp + rifNeto;

    const mapRow = (rubro: string, a: AccountWithBalance, expected: 'ACREEDORA' | 'DEUDORA') => {
      const ytd = signedYtd(a, expected);
      return [rubro, a.code, a.name, signedMes(a, expected), ytd, pct(ytd)];
    };

    const rows: Array<Array<string | number>> = [
      ...er.ingresos.map((a) => mapRow('INGRESOS', a, 'ACREEDORA')),
      ['TOTAL INGRESOS', '', 'Ventas Netas del Periodo', p?.totalIngresos ?? 0, er.totalIngresos, pct(er.totalIngresos)],
      ...er.costos.map((a) => mapRow('COSTOS', a, 'DEUDORA')),
      ['TOTAL COSTOS', '', 'Costo de Ventas', p?.totalCostos ?? 0, er.totalCostos, pct(er.totalCostos)],
      ['UTILIDAD BRUTA', '', 'Utilidad Bruta Operativa', p?.utilidadBruta ?? 0, er.utilidadBruta, pct(er.utilidadBruta)],
      ...er.gastos.map((a) => mapRow('GASTOS', a, 'DEUDORA')),
      ['TOTAL GASTOS', '', 'Gastos Generales de Operación', p?.totalGastos ?? 0, er.totalGastos, pct(er.totalGastos)],
      ['UTILIDAD DE OPERACION', '', 'Utilidad de Operación (NIF B-3)', p?.utilidadOperativa ?? 0, utilOp, pct(utilOp)],
      ...(er.rifProductos ?? []).map((a) => mapRow('RIF PRODUCTOS', a, 'ACREEDORA')),
      ...(er.rifGastos ?? []).map((a) => mapRow('RIF GASTOS', a, 'DEUDORA')),
      ['RIF NETO', '', 'Resultado Integral de Financiamiento (702 - 701)', p?.rifNeto ?? 0, rifNeto, pct(rifNeto)],
      ['UAI', '', 'Utilidad antes de Impuestos', p?.utilidadAntesImpuestos ?? 0, uai, pct(uai)],
      ...(er.isrEjercicio ?? []).map((a) => mapRow('ISR EJERCICIO', a, 'DEUDORA')),
      ...(totalIsr !== 0 || (er.isrEjercicio && er.isrEjercicio.length > 0)
        ? [['PROVISION ISR', '', 'Provisión ISR del Ejercicio (NIF D-4)', p?.totalIsr ?? 0, totalIsr, pct(totalIsr)]]
        : []),
      ['UTILIDAD NETA', '', 'Utilidad Neta del Periodo (NIF B-3)', p?.utilidadNeta ?? 0, er.utilidadNeta, pct(er.utilidadNeta)]
    ];

    downloadCsvFile(
      `Estado_Resultados_${data.company.rfc}_${data.ejercicio}_${periodCode}.csv`,
      ['Rubro Contable', 'Código', 'Nombre Cuenta', 'Del Mes MXN', 'Acumulado YTD MXN', '% s/Ventas'],
      rows
    );
    return 'Estado de Resultados exportado en CSV';
  }

  if (activeTab === 'BALANCE') {
    const bs = data.balanceSheet;
    const nif = bs.nifB6;
    const rows: Array<Array<string | number>> = [
      ...(nif?.activoCirculante ?? bs.activos).map((a) => ['ACTIVO CIRCULANTE', a.code, a.name, signedYtd(a, 'DEUDORA')]),
      ...(nif ? [['SUBTOTAL ACTIVO CIRCULANTE', '', 'Total Activo Circulante', nif.totalActivoCirculante]] : []),
      ...(nif?.activoNoCirculante ?? []).map((a) => ['ACTIVO NO CIRCULANTE', a.code, a.name, signedYtd(a, 'DEUDORA')]),
      ...(nif ? [['SUBTOTAL ACTIVO NO CIRCULANTE', '', 'Total Activo No Circulante', nif.totalActivoNoCirculante]] : []),
      ['TOTAL ACTIVO', '100', 'Total Activo', bs.totalActivo],
      ...(nif?.pasivoCortoPlazo ?? bs.pasivos).map((a) => ['PASIVO CORTO PLAZO', a.code, a.name, signedYtd(a, 'ACREEDORA')]),
      ...(nif ? [['SUBTOTAL PASIVO CORTO PLAZO', '', 'Total Pasivo a Corto Plazo', nif.totalPasivoCortoPlazo]] : []),
      ...(nif?.pasivoLargoPlazo ?? []).map((a) => ['PASIVO LARGO PLAZO', a.code, a.name, signedYtd(a, 'ACREEDORA')]),
      ...(nif ? [['SUBTOTAL PASIVO LARGO PLAZO', '', 'Total Pasivo a Largo Plazo', nif.totalPasivoLargoPlazo]] : []),
      ['TOTAL PASIVO', '200', 'Total Pasivo', bs.totalPasivo],
      ...(nif?.capitalContribuido ?? bs.capital).map((a) => ['CAPITAL CONTRIBUIDO', a.code, a.name, signedYtd(a, 'ACREEDORA')]),
      ...(nif ? [['SUBTOTAL CAPITAL CONTRIBUIDO', '', 'Total Capital Contribuido', nif.totalCapitalContribuido]] : []),
      ...(nif?.capitalGanado ?? []).map((a) => ['CAPITAL GANADO', a.code, a.name, signedYtd(a, 'ACREEDORA')]),
      ['UTILIDAD EJERCICIO', '305-01-001', 'Resultado del Ejercicio Actual', bs.utilidadEjercicio],
      ...(nif ? [['SUBTOTAL CAPITAL GANADO', '', 'Total Capital Ganado', nif.totalCapitalGanado]] : []),
      ['TOTAL CAPITAL', '300', 'Total Capital Contable', bs.totalPasivoMasCapital - bs.totalPasivo],
      ['PASIVO + CAPITAL', '', 'Suma Pasivo y Capital Contable', bs.totalPasivoMasCapital]
    ];
    downloadCsvFile(
      `Balance_General_${data.company.rfc}_${data.ejercicio}_${periodCode}.csv`,
      ['Clasificación', 'Código', 'Nombre Cuenta', 'Saldo Final MXN'],
      rows
    );
    return 'Balance General exportado en CSV';
  }

  if (activeTab === 'ANUAL' && annualTaxData) {
    const { reconciliation: rec, determination: det, inflation: inf } = annualTaxData;
    const isPersonaFisica =
      det.tipoRegimenAnual === 'PF_RESICO' || det.tipoRegimenAnual === 'PF_ART152';
    const isPfResico = det.tipoRegimenAnual === 'PF_RESICO';
    const isPmResico = det.tipoRegimenAnual === 'PM_RESICO';
    const pmResicoDedFlujo = det.ingresosNominales - rec.utilidadFiscalAntesPtu;
    const anualRows: Array<Array<string | number>> = isPersonaFisica
      ? [
          ['Base Gravable Persona Física', 'Ingresos Cobrados / Acumulables del Ejercicio', det.ingresosNominales],
          ...(isPfResico
            ? []
            : [
                ['Base Gravable Persona Física', '(-) Deducciones Autorizadas y PTU Pagada', -(det.ingresosNominales - rec.utilidadFiscal)],
                ['Base Gravable Persona Física', '(-) Pérdidas Fiscales Aplicadas', -rec.perdidasFiscalesAplicadas],
                ['Base Gravable Persona Física', '(-) Deducciones Personales Aplicadas (Art. 151 LISR)', -(rec.deduccionesPersonalesAplicadas ?? 0)]
              ]),
          ['Base Gravable Persona Física', '(=) Base / Resultado Fiscal Anual', isPfResico ? det.ingresosNominales : rec.resultadoFiscal],
          ['Determinación ISR Anual', 'Tasa / Tarifa Aplicable (%)', `${det.tasaAplicablePct.toFixed(2)}%`],
          ['Determinación ISR Anual', 'ISR Anual Causado', det.isrAnualCausado],
          ['Determinación ISR Anual', '(-) Pagos Provisionales Efectuados', -det.pagosProvisionalesEfectuados],
          ['Determinación ISR Anual', '(-) ISR Retenido Acreditable', -det.isrRetenidoAcreditable],
          ['Determinación ISR Anual', det.isrAnualCargoFavor >= 0 ? '(=) ISR Anual a Cargo' : '(=) Saldo a Favor de ISR', det.isrAnualCargoFavor >= 0 ? det.isrACargo : det.isrAFavor],
          ...(det.ptuPorPagar10Pct > 0 ? [['Determinación ISR Anual', 'PTU por Pagar (10%)', det.ptuPorPagar10Pct]] : [])
        ]
      : [
          ...(isPmResico
            ? [
                ['Conciliación Flujo PM RESICO', 'Ingresos Efectivamente Cobrados / Nominales', det.ingresosNominales],
                ['Conciliación Flujo PM RESICO', '(-) Deducciones Autorizadas Pagadas e Inv. Art. 31', -pmResicoDedFlujo],
                ['Conciliación Flujo PM RESICO', '(=) Utilidad Fiscal antes de PTU', rec.utilidadFiscalAntesPtu],
                ['Conciliación Flujo PM RESICO', '(-) PTU Pagada en el Ejercicio', -rec.ptuPagadaEjercicio],
                ['Conciliación Flujo PM RESICO', '(=) Utilidad / Pérdida Fiscal', rec.utilidadFiscal],
                ['Conciliación Flujo PM RESICO', '(-) Pérdidas Fiscales Aplicadas', -rec.perdidasFiscalesAplicadas],
                ['Conciliación Flujo PM RESICO', '(=) Resultado Fiscal Gravable', rec.resultadoFiscal]
              ]
            : [
                ['Conciliación Contable-Fiscal', 'Utilidad / Pérdida Contable', rec.utilidadContable],
                ['Conciliación Contable-Fiscal', '(+) Ingresos Fiscales No Contables', rec.ingresosFiscalesNoContables],
                ['Conciliación Contable-Fiscal', '(+) Deducciones Contables No Fiscales', rec.deduccionesContablesNoFiscales],
                ['Conciliación Contable-Fiscal', '(-) Deducciones Fiscales No Contables', -rec.deduccionesFiscalesNoContables],
                ['Conciliación Contable-Fiscal', '(-) PTU Pagada en el Ejercicio', -rec.ptuPagadaEjercicio],
                ['Conciliación Contable-Fiscal', '(=) Utilidad / Pérdida Fiscal', rec.utilidadFiscal],
                ['Conciliación Contable-Fiscal', '(-) Pérdidas Fiscales Aplicadas', -rec.perdidasFiscalesAplicadas],
                ['Conciliación Contable-Fiscal', '(=) Resultado Fiscal Gravable', rec.resultadoFiscal]
              ]),
          ['Ajuste Anual por Inflación', 'Promedio Anual de Créditos', inf.promedioCreditos],
          ['Ajuste Anual por Inflación', 'Promedio Anual de Deudas', inf.promedioDeudas],
          ['Ajuste Anual por Inflación', `Efecto (${inf.tipo})`, inf.tipo === 'ACUMULABLE' ? inf.ajusteAcumulable : inf.tipo === 'DEDUCIBLE' ? -inf.ajusteDeducible : 0],
          ['Determinación ISR Anual', 'ISR Anual Causado', det.isrAnualCausado],
          ['Determinación ISR Anual', '(-) Pagos Provisionales Efectuados', -det.pagosProvisionalesEfectuados],
          ['Determinación ISR Anual', '(-) ISR Retenido Acreditable', -det.isrRetenidoAcreditable],
          ['Determinación ISR Anual', det.isrAnualCargoFavor >= 0 ? '(=) ISR Anual a Cargo' : '(=) Saldo a Favor de ISR', det.isrAnualCargoFavor >= 0 ? det.isrACargo : det.isrAFavor],
          ['Determinación ISR Anual', 'PTU por Pagar (10%)', det.ptuPorPagar10Pct],
          ['Determinación ISR Anual', 'Nuevo Coeficiente de Utilidad', det.nuevoCoeficienteUtilidad.toFixed(4)],
          ['CUCA y CUFIN', 'CUCA Final Actualizada', det.cucaFinal],
          ['CUCA y CUFIN', 'CUFIN Final Actualizada', det.cufinFinal]
        ];
    downloadCsvFile(
      `Declaracion_Anual_${data.company.rfc}_${annualTaxData.ejercicio}.csv`,
      ['Sección', 'Concepto', 'Importe / Valor'],
      anualRows
    );
    return 'Declaración Anual exportada en CSV';
  }

  return exportBalanzaCsvOnly({
    company: data.company,
    ejercicio: data.ejercicio,
    periodo: data.periodo,
    trialBalance: data.trialBalance,
    balanzaOptions
  });
}

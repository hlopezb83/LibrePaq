import { formatCurrency } from '../../lib/formatters';
import type { Company, FinancialStatementsResponse, FiscalWorkpaperResponse } from '../../shared/types';

export function generateDeliverableSummaryText({
  company,
  year,
  mesNombre,
  issuanceCity,
  issuanceDate,
  firmName,
  auditorName,
  auditorCedula,
  legalRepName,
  legalRepTitle,
  reportsData,
  fiscalData,
  formatVerticalPct,
  accountantNotes
}: {
  company: Company;
  year: number;
  mesNombre: string;
  issuanceCity: string;
  issuanceDate: string;
  firmName: string;
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
  reportsData: FinancialStatementsResponse | null | undefined;
  fiscalData: FiscalWorkpaperResponse | null | undefined;
  formatVerticalPct: (amount: number, base: number) => string;
  accountantNotes?: string;
}): string {
  if (!reportsData) return '';

  const isrNeto = fiscalData?.isrProvisional.isrNetoAPagar ?? 0;
  const ivaNeto = fiscalData?.ivaDefinitivo.ivaNetoAPagar ?? 0;
  const retIsr = fiscalData?.resumenLineaCapturaSat.retencionesIsrPorEnterar ?? 0;
  const retIva = fiscalData?.resumenLineaCapturaSat.retencionesIvaPorEnterar ?? 0;
  const totalDia17 = fiscalData?.resumenLineaCapturaSat.totalEstimadoDia17 ?? 0;
  const isLoss = reportsData.incomeStatement.utilidadNeta < 0;
  const isBalanced =
    Math.abs(reportsData.balanceSheet.totalActivo - reportsData.balanceSheet.totalPasivoMasCapital) < 0.05;
  const totalIsrEjercicio = reportsData.incomeStatement.totalIsr ?? 0;

  return [
    `================================================================================`,
    `RESUMEN EJECUTIVO DE CIERRE CONTABLE Y FISCAL`,
    `EMPRESA: ${company.name} (${company.rfc})`,
    `PERIODO: ${mesNombre} ${year} | RÉGIMEN: ${company.regimenFiscal}`,
    `FECHA DE EMISIÓN: ${issuanceCity}, a ${issuanceDate}`,
    `DESPACHO: ${firmName}`,
    `--------------------------------------------------------------------------------`,
    `1. ESTADO DE RESULTADOS INTEGRAL (NIF B-3):`,
    `   • Ingresos Netos:               ${formatCurrency(reportsData.incomeStatement.totalIngresos)}`,
    `   • Costo de Ventas:             ${formatCurrency(reportsData.incomeStatement.totalCostos)}`,
    `   • Utilidad Bruta:              ${formatCurrency(reportsData.incomeStatement.utilidadBruta)} (Margen: ${formatVerticalPct(reportsData.incomeStatement.utilidadBruta, reportsData.incomeStatement.totalIngresos)})`,
    `   • Gastos de Operación:         ${formatCurrency(reportsData.incomeStatement.totalGastos)}`,
    `   • Utilidad de Operación:       ${formatCurrency(reportsData.incomeStatement.utilidadOperativa ?? (reportsData.incomeStatement.utilidadBruta - reportsData.incomeStatement.totalGastos))}`,
    `   • RIF Neto (702 - 701):        ${formatCurrency(reportsData.incomeStatement.rifNeto ?? 0)}`,
    ...(totalIsrEjercicio > 0
      ? [`   • Provisión ISR Ejercicio:     ${formatCurrency(totalIsrEjercicio)}`]
      : []),
    `   • ${isLoss ? 'PÉRDIDA' : 'UTILIDAD'} NETA DEL PERIODO:   ${formatCurrency(reportsData.incomeStatement.utilidadNeta)} (Margen Neto: ${formatVerticalPct(reportsData.incomeStatement.utilidadNeta, reportsData.incomeStatement.totalIngresos)})`,
    `--------------------------------------------------------------------------------`,
    `2. SITUACIÓN FINANCIERA (NIF B-6):`,
    `   • Total Activo:                ${formatCurrency(reportsData.balanceSheet.totalActivo)}`,
    `   • Total Pasivo:                ${formatCurrency(reportsData.balanceSheet.totalPasivo)}`,
    `   • Capital Contable:            ${formatCurrency(reportsData.balanceSheet.totalCapitalBase + reportsData.balanceSheet.utilidadEjercicio)}`,
    `   • Comprobación (A = P + C):     ${formatCurrency(reportsData.balanceSheet.totalActivo)} ${isBalanced ? '=' : '≠'} ${formatCurrency(reportsData.balanceSheet.totalPasivoMasCapital)} ${isBalanced ? '✔' : '⚠ Diferencia'}`,
    `--------------------------------------------------------------------------------`,
    `3. ESTIMACIÓN FISCAL DÍA 17 (SAT):`,
    `   • ISR Pago Provisional:        ${formatCurrency(isrNeto)}`,
    `   • IVA Definitivo:              ${formatCurrency(ivaNeto)}`,
    `   • Retenciones ISR por Enterar: ${formatCurrency(retIsr)}`,
    `   • Retenciones IVA por Enterar: ${formatCurrency(retIva)}`,
    `   • Total Línea de Captura:      ${formatCurrency(totalDia17)}`,
    ...(accountantNotes?.trim() ? [`--------------------------------------------------------------------------------`, `NOTAS DEL CONTADOR:`, accountantNotes.trim()] : []),
    `--------------------------------------------------------------------------------`,
    `Dictaminó: ${auditorName} (${auditorCedula})`,
    `Autorizó:  ${legalRepName} (${legalRepTitle})`,
    `================================================================================`
  ].join('\n');
}

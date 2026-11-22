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
  formatVerticalPct
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
}): string {
  if (!reportsData) return '';

  const isrNeto = fiscalData?.isrProvisional.isrNetoAPagar ?? 0;
  const ivaNeto = fiscalData?.ivaDefinitivo.ivaNetoAPagar ?? 0;
  const totalDia17 = fiscalData?.resumenLineaCapturaSat.totalEstimadoDia17 ?? 0;

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
    `   • UTILIDAD NETA DEL PERIODO:   ${formatCurrency(reportsData.incomeStatement.utilidadNeta)} (Margen Neto: ${formatVerticalPct(reportsData.incomeStatement.utilidadNeta, reportsData.incomeStatement.totalIngresos)})`,
    `--------------------------------------------------------------------------------`,
    `2. SITUACIÓN FINANCIERA (NIF B-6):`,
    `   • Total Activo:                ${formatCurrency(reportsData.balanceSheet.totalActivo)}`,
    `   • Total Pasivo:                ${formatCurrency(reportsData.balanceSheet.totalPasivo)}`,
    `   • Capital Contable:            ${formatCurrency(reportsData.balanceSheet.totalCapitalBase + reportsData.balanceSheet.utilidadEjercicio)}`,
    `   • Comprobación (A = P + C):     ${formatCurrency(reportsData.balanceSheet.totalActivo)} = ${formatCurrency(reportsData.balanceSheet.totalPasivoMasCapital)} ✔`,
    `--------------------------------------------------------------------------------`,
    `3. ESTIMACIÓN FISCAL DÍA 17 (SAT):`,
    `   • ISR Pago Provisional:        ${formatCurrency(isrNeto)}`,
    `   • IVA Definitivo:              ${formatCurrency(ivaNeto)}`,
    `   • Total Línea de Captura:      ${formatCurrency(totalDia17)}`,
    `--------------------------------------------------------------------------------`,
    `Dictaminó: ${auditorName} (${auditorCedula})`,
    `Autorizó:  ${legalRepName} (${legalRepTitle})`,
    `================================================================================`
  ].join('\n');
}

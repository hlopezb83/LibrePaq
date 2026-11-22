import type { FiscalWorkpaperResponse } from '../types';

function fmtMxn(val: number): string {
  return val.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formatea la Cédula Fiscal Día 17 en texto plano estructurado para captura en SAT DyP.
 */
export function formatSatDypWorkpaperText(
  workpaper: FiscalWorkpaperResponse,
  year: number,
  period: number
): string {
  const isr = workpaper.isrProvisional;
  const iva = workpaper.ivaDefinitivo;
  const totalPagar = Math.max(0, isr.isrNetoAPagar) + Math.max(0, iva.ivaNetoAPagar);

  return [
    '=======================================================',
    'CÉDULA FISCAL DÍA 17 — SAT DECLARACIONES Y PAGOS (DyP)',
    `Empresa: ${workpaper.company.rfc} - ${workpaper.company.name}`,
    `Periodo: P${String(period).padStart(2, '0')}/${year} | Régimen: ${workpaper.company.regimenFiscal}`,
    '=======================================================',
    '',
    `1. PAGO PROVISIONAL ISR (${isr.esResico ? 'RESICO' : `Art. 14 C.U. ${isr.coeficienteUtilidadAplicado.toFixed(4)}`}):`,
    `- Ingresos Nominales del Mes: ${fmtMxn(isr.ingresosPeriodo)}`,
    `- Ingresos Acumulados del Ejercicio: ${fmtMxn(isr.ingresosAcumuladosEjercicio)}`,
    `- Utilidad Fiscal Estimada: ${fmtMxn(isr.utilidadFiscalEstimada)}`,
    `- Pérdidas Fiscales de Ejercicios Anteriores Amortizadas: -${fmtMxn(isr.perdidasFiscalesAplicadas)}`,
    `- Base Gravable de ISR: ${fmtMxn(isr.baseGravableIsr)}`,
    `- ISR Causado (Tasa ${isr.tasaIsrPct}%): ${fmtMxn(isr.isrCausado)}`,
    `- Pagos Provisionales Previos: -${fmtMxn(isr.pagosProvisionalesPrevios)}`,
    `- ISR Retenido por Terceros: -${fmtMxn(isr.isrRetenidoPeriodo)}`,
    `>> ISR A CARGO A ENTERAR: ${fmtMxn(isr.isrNetoAPagar)}`,
    '',
    '2. DETERMINACIÓN DEFINITIVA DE IVA (Art. 5 LIVA - Flujo de Efectivo):',
    `- IVA Trasladado Cobrado (16%): ${fmtMxn(iva.ivaTrasladadoCobrado)}`,
    `- IVA Acreditable Pagado en DIOT: -${fmtMxn(iva.ivaAcreditablePagado)}`,
    `- IVA Retenido del Periodo: -${fmtMxn(iva.ivaRetenidoPorPagar)}`,
    `- Saldo a Favor de IVA Anterior Acreditado: -${fmtMxn(iva.saldoFavorIvaAcreditable)}`,
    `>> ${iva.ivaNetoAPagar > 0 ? 'IVA A CARGO A ENTERAR' : 'SALDO A FAVOR DE IVA'}: ${fmtMxn(iva.ivaNetoAPagar > 0 ? iva.ivaNetoAPagar : iva.saldoFavorIvaRemanente)}`,
    '',
    '-------------------------------------------------------',
    `TOTAL ESTIMADO A ENTERAR LÍNEA DE CAPTURA SAT: ${fmtMxn(totalPagar)}`,
    '======================================================='
  ].join('\n');
}

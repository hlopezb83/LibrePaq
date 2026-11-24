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
  const cap = workpaper.resumenLineaCapturaSat;
  const totalPagar = cap.totalEstimadoDia17;

  const isPersonaFisica = workpaper.company.rfc.trim().length === 13;
  const isResico = isr.esResico;
  const isResicoPf = isResico && isPersonaFisica;
  const isResicoPm = isResico && !isPersonaFisica;
  const isPfGeneral = isPersonaFisica && !isResico;
  const dedAcum = isr.deduccionesAcumuladasEjercicio ?? isr.deduccionesAutorizadasPeriodo;

  const isrMethodLabel = isResicoPf
    ? 'RESICO Persona Física (Flujo)'
    : isResicoPm
      ? 'RESICO Persona Moral (Flujo)'
      : isPfGeneral
        ? 'Art. 106 LISR — Tarifa Progresiva'
        : `Art. 14 C.U. ${isr.coeficienteUtilidadAplicado.toFixed(4)}`;

  const isrLines: string[] = [
    `1. PAGO PROVISIONAL ISR (${isrMethodLabel}):`,
    `- Ingresos Nominales del Mes: ${fmtMxn(isr.ingresosPeriodo)}`,
    `- Ingresos Acumulados del Ejercicio: ${fmtMxn(isr.ingresosAcumuladosEjercicio)}`
  ];

  if (isResicoPm || isPfGeneral) {
    isrLines.push(
      `- Deducciones del Mes: -${fmtMxn(isr.deduccionesAutorizadasPeriodo)}`,
      `- Deducciones Acumuladas del Ejercicio: -${fmtMxn(dedAcum)}`,
      `- Utilidad Fiscal (Ingresos - Deducciones): ${fmtMxn(isr.utilidadFiscalEstimada)}`
    );
  } else if (!isResicoPf) {
    isrLines.push(`- Utilidad Fiscal Estimada: ${fmtMxn(isr.utilidadFiscalEstimada)}`);
  }

  if (!isResicoPf) {
    isrLines.push(`- Pérdidas Fiscales de Ejercicios Anteriores Amortizadas: -${fmtMxn(isr.perdidasFiscalesAplicadas)}`);
  }

  isrLines.push(
    `- Base Gravable de ISR: ${fmtMxn(isr.baseGravableIsr)}`,
    `- ISR Causado (Tasa ${isr.tasaIsrPct}%): ${fmtMxn(isr.isrCausado)}`
  );

  if (!isResicoPf) {
    isrLines.push(`- Pagos Provisionales Previos: -${fmtMxn(isr.pagosProvisionalesPrevios)}`);
  }

  isrLines.push(
    `- ISR Retenido por Terceros: -${fmtMxn(isr.isrRetenidoPeriodo)}`,
    `>> ISR A CARGO A ENTERAR: ${fmtMxn(isr.isrNetoAPagar)}`
  );

  return [
    '=======================================================',
    'CÉDULA FISCAL DÍA 17 — SAT DECLARACIONES Y PAGOS (DyP)',
    `Empresa: ${workpaper.company.rfc} - ${workpaper.company.name}`,
    `Periodo: P${String(period).padStart(2, '0')}/${year} | Régimen: ${workpaper.company.regimenFiscal}`,
    '=======================================================',
    '',
    ...isrLines,
    '',
    '2. DETERMINACIÓN DEFINITIVA DE IVA (Art. 5 LIVA - Flujo de Efectivo):',
    `- IVA Trasladado Cobrado: ${fmtMxn(iva.ivaTrasladadoCobrado)}`,
    `- IVA Acreditable Pagado en DIOT: -${fmtMxn(iva.ivaAcreditablePagado)}`,
    `- IVA Retenido Acreditable (por Clientes): -${fmtMxn(iva.ivaRetenidoAcreditable ?? 0)}`,
    `- Saldo a Favor de IVA Anterior Acreditado: -${fmtMxn(iva.saldoFavorIvaAcreditable)}`,
    `>> ${iva.ivaNetoAPagar > 0 ? 'IVA A CARGO A ENTERAR' : 'SALDO A FAVOR DE IVA'}: ${fmtMxn(iva.ivaNetoAPagar > 0 ? iva.ivaNetoAPagar : iva.saldoFavorIvaRemanente)}`,
    '',
    '3. RETENCIONES POR ENTERAR:',
    `- Retenciones de ISR por Enterar: ${fmtMxn(cap.retencionesIsrPorEnterar)}`,
    `- Retenciones de IVA por Enterar: ${fmtMxn(cap.retencionesIvaPorEnterar)}`,
    '',
    '-------------------------------------------------------',
    `TOTAL ESTIMADO A ENTERAR LÍNEA DE CAPTURA SAT: ${fmtMxn(totalPagar)}`,
    '======================================================='
  ].join('\n');
}

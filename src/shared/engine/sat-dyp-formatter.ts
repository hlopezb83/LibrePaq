import type { FiscalWorkpaperResponse } from '../types';
import { calculateArt106PfIsr } from './art106-tax.engine';
import { toCents } from './invariants-and-math';

/**
 * Redondeo oficial conforme al Artículo 20 del CFF para declaraciones SAT (DyP):
 * - Fracciones de 1 a 50 centavos (<= 0.50) bajan al peso entero inmediato anterior.
 * - Fracciones de 51 a 99 centavos (> 0.50) suben al peso entero inmediato siguiente.
 * Por defecto recibe pesos MXN; con `{ isCents: true }` recibe centavos enteros.
 */
export function roundArt20Cff(centsOrPesos: number, opts?: { isCents?: boolean }): number {
  if (!Number.isFinite(centsOrPesos)) return 0;
  const totalCents = opts?.isCents ? Math.round(centsOrPesos) : Math.round(centsOrPesos * 100);
  const sign = totalCents < 0 ? -1 : 1;
  const absCents = Math.abs(totalCents);
  const whole = Math.floor(absCents / 100);
  const fracCents = absCents % 100;
  const roundedWhole = fracCents > 50 ? whole + 1 : whole;
  return roundedWhole === 0 ? 0 : sign * roundedWhole;
}

function fmtDypPesos(val: number): string {
  const whole = roundArt20Cff(val);
  return whole.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function fmtExactMxn(val: number): string {
  return val.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export interface SatDypCasillaItem {
  id: string;
  section: 'ISR' | 'IVA' | 'RETENCIONES' | 'TOTAL';
  label: string;
  satFieldHint: string;
  valuePesos: number;
  formatted: string;
}

/**
 * Genera el arreglo estructurado casilla por casilla para captura directa en SAT DyP
 * con todos los importes redondeados en pesos enteros conforme al Art. 20 CFF.
 */
export function buildSatDypCasillas(
  workpaper: FiscalWorkpaperResponse,
  year: number,
  period: number
): SatDypCasillaItem[] {
  const isr = workpaper.isrProvisional;
  const iva = workpaper.ivaDefinitivo;
  const cap = workpaper.resumenLineaCapturaSat;
  const isPersonaFisica = workpaper.company.rfc.trim().length === 13;
  const isResicoPf = isr.esResico && isPersonaFisica;
  const isResicoPm = isr.esResico && !isPersonaFisica;
  const isPfGeneral = isPersonaFisica && !isr.esResico;
  const dedAcum = isr.deduccionesAcumuladasEjercicio ?? isr.deduccionesAutorizadasPeriodo;
  const saldoFavorMes = iva.saldoFavorIvaMes ?? (iva.ivaNetoAPagar > 0 ? 0 : iva.saldoFavorIvaRemanente);

  const items: SatDypCasillaItem[] = [];
  const push = (id: string, section: SatDypCasillaItem['section'], label: string, satFieldHint: string, rawVal: number) => {
    const valuePesos = roundArt20Cff(rawVal);
    items.push({ id, section, label, satFieldHint, valuePesos, formatted: fmtDypPesos(rawVal) });
  };

  push('isr-ing-mes', 'ISR', 'Ingresos nominales / cobrados del periodo', 'DyP ISR · Ingresos del periodo', isr.ingresosPeriodo);
  if (!isResicoPf) {
    push('isr-ing-acum', 'ISR', 'Ingresos acumulados del ejercicio', 'DyP ISR · Total ingresos acumulados', isr.ingresosAcumuladosEjercicio);
  }
  if (isResicoPm || isPfGeneral) {
    push('isr-ded-acum', 'ISR', 'Deducciones autorizadas acumuladas', 'DyP ISR · Deducciones autorizadas', dedAcum);
  }
  if (!isr.esResico && !isPersonaFisica) {
    const cuVal = Number(isr.coeficienteUtilidadAplicado.toFixed(4));
    items.push({
      id: 'isr-cu',
      section: 'ISR',
      label: 'Coeficiente de Utilidad aplicado (Art. 14 LISR)',
      satFieldHint: 'DyP ISR · Coeficiente de utilidad',
      valuePesos: cuVal,
      formatted: cuVal.toFixed(4)
    });
  }
  if (!isResicoPf) {
    push(
      'isr-utilidad',
      'ISR',
      isResicoPm || isPfGeneral
        ? 'Utilidad fiscal del periodo (Ingresos - Deducciones)'
        : 'Utilidad fiscal estimada (Ingresos x C.U.)',
      'DyP ISR · Utilidad fiscal',
      isr.utilidadFiscalEstimada
    );
  }
  if ((isr.ptuPagadaAplicada ?? 0) > 0 && !isResicoPf) {
    push('isr-ptu', 'ISR', 'PTU pagada en el ejercicio disminuible', 'DyP ISR · PTU pagada', isr.ptuPagadaAplicada ?? 0);
  }
  if (!isResicoPf) {
    push('isr-perdidas', 'ISR', 'Pérdidas fiscales de ejercicios anteriores', 'DyP ISR · Pérdidas por amortizar', isr.perdidasFiscalesAplicadas);
  }
  push('isr-base', 'ISR', 'Base gravable de ISR', 'DyP ISR · Base gravable', isr.baseGravableIsr);
  push('isr-causado', 'ISR', 'Impuesto causado', 'DyP ISR · Impuesto causado', isr.isrCausado);
  if (!isResicoPf) {
    push('isr-pagos-prev', 'ISR', 'Pagos provisionales efectuados con anterioridad', 'DyP ISR · Pagos provisionales anteriores', isr.pagosProvisionalesPrevios);
  }
  push('isr-ret-favor', 'ISR', 'ISR retenido por terceros acreditable', 'DyP ISR · ISR retenido', isr.isrRetenidoPeriodo);
  push('isr-pagar', 'ISR', 'ISR a cargo (Día 17)', 'DyP ISR · Cantidad a pagar', isr.isrNetoAPagar);

  const bd = workpaper.ivaBreakdown;
  if (bd) {
    push('iva-b16', 'IVA', 'Valor de actos gravados tasa 16%', 'DyP IVA · Actos 16%', bd.base16);
    if (bd.base16 > 0) push('iva-tras-16', 'IVA', 'IVA trasladado tasa 16%', 'DyP IVA · IVA 16%', bd.base16 * 0.16);
    if (bd.base8 > 0) {
      push('iva-b8', 'IVA', 'Valor de actos gravados tasa 8%', 'DyP IVA · Actos 8%', bd.base8);
      push('iva-tras-8', 'IVA', 'IVA trasladado tasa 8%', 'DyP IVA · IVA 8%', bd.base8 * 0.08);
    }
    if (bd.base0 > 0) push('iva-b0', 'IVA', 'Valor de actos gravados tasa 0%', 'DyP IVA · Actos 0%', bd.base0);
    if (bd.baseExento > 0) push('iva-bex', 'IVA', 'Valor de actos exentos', 'DyP IVA · Actos exentos', bd.baseExento);
    const prorationVal = Number(bd.prorationFactor.toFixed(4));
    items.push({
      id: 'iva-prorrateo',
      section: 'IVA',
      label: 'Factor de prorrateo Art. 5 LIVA',
      satFieldHint: 'DyP IVA · Proporción acreditable',
      valuePesos: prorationVal,
      formatted: `${(prorationVal * 100).toFixed(2)}%`
    });
  } else {
    push('iva-b16', 'IVA', 'Valor de actos gravados tasa 16%', 'DyP IVA · Actos 16%', iva.actosGravadosCobrado16);
  }
  push('iva-tras', 'IVA', 'IVA trasladado cobrado', 'DyP IVA · IVA a cargo', iva.ivaTrasladadoCobrado);
  push('iva-acred', 'IVA', 'IVA acreditable pagado', 'DyP IVA · IVA acreditable', iva.ivaAcreditablePagado);
  push('iva-ret-acred', 'IVA', 'IVA retenido por clientes acreditable', 'DyP IVA · IVA retenido', iva.ivaRetenidoAcreditable ?? 0);
  push('iva-favor-ant', 'IVA', 'Acreditamiento saldo a favor anterior', 'DyP IVA · Saldo a favor aplicado', iva.saldoFavorIvaAcreditable);
  if (iva.ivaNetoAPagar > 0) {
    push('iva-pagar', 'IVA', 'IVA definitivo a cargo', 'DyP IVA · Cantidad a pagar', iva.ivaNetoAPagar);
  } else {
    push('iva-favor-mes', 'IVA', 'Saldo a favor de IVA del periodo', 'DyP IVA · Saldo a favor del mes', saldoFavorMes);
  }

  for (const r of workpaper.retencionesDesglose ?? []) {
    push(`ret-${r.code}-${r.satGroupCode}`, 'RETENCIONES', `${r.name} (${r.satGroupCode})`, `DyP Ret. ${r.tipo}`, r.amount);
  }
  push('ret-isr', 'RETENCIONES', 'Total Retenciones ISR por enterar', 'DyP · Retenciones ISR', cap.retencionesIsrPorEnterar);
  push('ret-iva', 'RETENCIONES', 'Total Retenciones IVA por enterar', 'DyP · Retenciones IVA', cap.retencionesIvaPorEnterar);

  const totalRounded =
    roundArt20Cff(cap.isrProvisionalAPagar) +
    roundArt20Cff(cap.ivaDefinitivoAPagar) +
    roundArt20Cff(cap.retencionesIsrPorEnterar) +
    roundArt20Cff(cap.retencionesIvaPorEnterar);
  items.push({
    id: 'total-dia17',
    section: 'TOTAL',
    label: `Total Estimado Línea de Captura P${String(period).padStart(2, '0')}/${year}`,
    satFieldHint: 'SAT DyP · Suma de enteros Art. 20 CFF',
    valuePesos: totalRounded,
    formatted: fmtDypPesos(totalRounded)
  });

  return items;
}

/**
 * Formatea la Cédula Fiscal Día 17 en texto plano estructurado para captura en SAT DyP
 * con redondeo oficial Art. 20 CFF (enteros en pesos).
 */
export function formatSatDypWorkpaperText(
  workpaper: FiscalWorkpaperResponse,
  year: number,
  period: number
): string {
  const isr = workpaper.isrProvisional;
  const iva = workpaper.ivaDefinitivo;
  const cap = workpaper.resumenLineaCapturaSat;

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
    `1. PAGO PROVISIONAL ISR (${isrMethodLabel}) [Pesos enteros Art. 20 CFF]:`,
    `- Ingresos Nominales del Mes: ${fmtDypPesos(isr.ingresosPeriodo)}`,
    `- Ingresos Acumulados del Ejercicio: ${fmtDypPesos(isr.ingresosAcumuladosEjercicio)}`
  ];

  if (isResicoPm || isPfGeneral) {
    isrLines.push(
      `- Deducciones del Mes: -${fmtDypPesos(isr.deduccionesAutorizadasPeriodo)}`,
      `- Deducciones Acumuladas del Ejercicio: -${fmtDypPesos(dedAcum)}`,
      `- Utilidad Fiscal (Ingresos - Deducciones): ${fmtDypPesos(isr.utilidadFiscalEstimada)}`
    );
  } else if (!isResicoPf) {
    isrLines.push(`- Utilidad Fiscal Estimada: ${fmtDypPesos(isr.utilidadFiscalEstimada)}`);
  }

  if (!isResicoPf && (isr.ptuPagadaAplicada ?? 0) > 0) {
    isrLines.push(`- PTU Pagada Deducible del Ejercicio: -${fmtDypPesos(isr.ptuPagadaAplicada ?? 0)}`);
  }
  if (!isResicoPf) {
    isrLines.push(`- Pérdidas Fiscales de Ejercicios Anteriores Amortizadas: -${fmtDypPesos(isr.perdidasFiscalesAplicadas)}`);
  }

  isrLines.push(`- Base Gravable de ISR: ${fmtDypPesos(isr.baseGravableIsr)}`);

  if (isPfGeneral && isr.baseGravableIsr > 0) {
    const art106 = calculateArt106PfIsr(toCents(isr.baseGravableIsr), period, year);
    if (art106.bracketDetail) {
      const b = art106.bracketDetail;
      isrLines.push(
        `  * Tarifa Art. 106: Límite Inf. ${fmtExactMxn(b.lowerLimit)} | Excedente ${fmtExactMxn(b.excedente)} x ${b.marginalRatePct}% = Imp. Marginal ${fmtExactMxn(b.impuestoMarginal)} + Cuota Fija ${fmtExactMxn(b.cuotaFija)}`
      );
    }
  }

  isrLines.push(`- ISR Causado (Tasa ${isr.tasaIsrPct}%): ${fmtDypPesos(isr.isrCausado)}`);

  if (!isResicoPf) {
    isrLines.push(`- Pagos Provisionales Previos: -${fmtDypPesos(isr.pagosProvisionalesPrevios)}`);
  }

  isrLines.push(
    `- ISR Retenido por Terceros: -${fmtDypPesos(isr.isrRetenidoPeriodo)}`,
    `>> ISR A CARGO A ENTERAR: ${fmtDypPesos(isr.isrNetoAPagar)}`
  );

  const bd = workpaper.ivaBreakdown;
  const ivaBaseLines = bd
    ? [
        `- Bases Actos Cobrados: 16% ${fmtDypPesos(bd.base16)} | 8% ${fmtDypPesos(bd.base8)} | 0% ${fmtDypPesos(bd.base0)} | Exento ${fmtDypPesos(bd.baseExento)} (Prorrateo: ${(bd.prorationFactor * 100).toFixed(2)}%)`
      ]
    : [`- Actos Gravados Cobrados 16%: ${fmtDypPesos(iva.actosGravadosCobrado16)}`];

  const saldoFavorMes = iva.saldoFavorIvaMes ?? (iva.ivaNetoAPagar > 0 ? 0 : iva.saldoFavorIvaRemanente);
  const retDesgloseLines = (workpaper.retencionesDesglose ?? []).map(
    (r) => `  * [${r.satGroupCode}] ${r.name} (${r.tipo}): ${fmtDypPesos(r.amount)}`
  );

  const totalPagarRounded =
    roundArt20Cff(cap.isrProvisionalAPagar) +
    roundArt20Cff(cap.ivaDefinitivoAPagar) +
    roundArt20Cff(cap.retencionesIsrPorEnterar) +
    roundArt20Cff(cap.retencionesIvaPorEnterar);

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
    ...ivaBaseLines,
    `- IVA Trasladado Cobrado: ${fmtDypPesos(iva.ivaTrasladadoCobrado)}`,
    `- IVA Acreditable Pagado en DIOT: -${fmtDypPesos(iva.ivaAcreditablePagado)}`,
    `- IVA Retenido Acreditable (por Clientes): -${fmtDypPesos(iva.ivaRetenidoAcreditable ?? 0)}`,
    `- Saldo a Favor de IVA Anterior Acreditado: -${fmtDypPesos(iva.saldoFavorIvaAcreditable)}`,
    `>> ${iva.ivaNetoAPagar > 0 ? 'IVA A CARGO A ENTERAR' : 'SALDO A FAVOR DE IVA DEL MES'}: ${fmtDypPesos(iva.ivaNetoAPagar > 0 ? iva.ivaNetoAPagar : saldoFavorMes)}`,
    ...(iva.ivaNetoAPagar === 0 && iva.saldoFavorIvaRemanente > saldoFavorMes
      ? [`- Saldo a Favor Remanente Acumulado (próximo mes): ${fmtDypPesos(iva.saldoFavorIvaRemanente)}`]
      : []),
    '',
    '3. RETENCIONES POR ENTERAR:',
    `- Retenciones de ISR por Enterar: ${fmtDypPesos(cap.retencionesIsrPorEnterar)}`,
    `- Retenciones de IVA por Enterar: ${fmtDypPesos(cap.retencionesIvaPorEnterar)}`,
    ...retDesgloseLines,
    '',
    '-------------------------------------------------------',
    `TOTAL ESTIMADO A ENTERAR LÍNEA DE CAPTURA SAT: ${fmtDypPesos(totalPagarRounded)}`,
    '======================================================='
  ].join('\n');
}

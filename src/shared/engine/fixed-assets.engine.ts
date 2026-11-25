import type {
  Account,
  FixedAssetRecord,
  FixedAssetWithCalculation
} from '../types';
import { SAFETY_BOUNDS } from '../sat-constants';
import { parseCalendarDate } from '../date-utils';
import { calculateInpcFactor, getInpcMedioPeriodo } from '../sat-inpc-catalog';
import {
  assertAccountingInvariant,
  fromCents,
  sumCents,
  toCents
} from './invariants-and-math';
import {
  resolveFiscalAccount,
  type AutoPolizaMovementDraft,
  type AutoPolizaPlan
} from './auto-poliza.engine';

/** Topes deducibles de automóviles Art. 36 Fracción II LISR */
const LISR_ART36_AUTO_COMBUSTION_CAP_CENTS = 17_500_000; // $175,000.00 MXN
const LISR_ART36_AUTO_ELECTRICO_CAP_CENTS = 25_000_000; // $250,000.00 MXN

function resolveFiscalDepreciableMoiCents(asset: FixedAssetRecord, moiCents: number): number {
  if (asset.categoria !== 'TRANSPORTE_25') return moiCents;
  const capType = (asset.vehicleCapType ?? '').trim().toUpperCase();
  if (capType === 'CARGA_EXENTO' || capType === 'NONE') return moiCents;
  if (capType === 'AUTO_ELECTRICO' || capType === 'ELECTRICO') {
    return Math.min(moiCents, LISR_ART36_AUTO_ELECTRICO_CAP_CENTS);
  }
  if (capType === 'AUTO_COMBUSTION' || capType === 'COMBUSTION') {
    return Math.min(moiCents, LISR_ART36_AUTO_COMBUSTION_CAP_CENTS);
  }
  const nameLower = asset.nombre.toLowerCase();
  if (nameLower.includes('camión') || nameLower.includes('camion') || nameLower.includes('tracto') || nameLower.includes('montacarga') || nameLower.includes('reparto')) {
    return moiCents;
  }
  const isElectricOrHybrid =
    nameLower.includes('eléctric') || nameLower.includes('electric') || nameLower.includes('híbrid') ||
    nameLower.includes('hibrid') || nameLower.includes('phev') || /\bev\b/i.test(nameLower);
  return Math.min(moiCents, isElectricOrHybrid ? LISR_ART36_AUTO_ELECTRICO_CAP_CENTS : LISR_ART36_AUTO_COMBUSTION_CAP_CENTS);
}

export function resolveLisrInpcMedioPeriodo(
  fechaAdquisicion: string | undefined,
  fiscalYear: number
): number {
  if (!fechaAdquisicion) return getInpcMedioPeriodo(fiscalYear, 6);
  const acq = parseCalendarDate(fechaAdquisicion, fiscalYear, 1);
  if (acq.year === fiscalYear) {
    const medioMonth = Math.min(12, Math.max(1, acq.month + Math.floor((12 - acq.month) / 2)));
    return getInpcMedioPeriodo(fiscalYear, medioMonth);
  }
  return getInpcMedioPeriodo(fiscalYear, 6);
}

export function extractDepreciatedAssetCodes(
  polizas: ReadonlyArray<{
    concepto: string;
    origin?: string | null;
    movements?: ReadonlyArray<{ referencia?: string | null }>;
  }>
): Set<string> {
  const codes = new Set<string>();
  for (const p of polizas) {
    if (!hasExistingDepreciationPoliza([p])) continue;
    for (const m of p.movements ?? []) {
      const ref = m.referencia ?? '';
      if (ref.startsWith('DEP-')) codes.add(ref.slice(4));
    }
  }
  return codes;
}

export function computeFixedAssetWithDepreciation(
  asset: FixedAssetRecord,
  targetPeriod?: {
    ejercicio: number;
    periodo: number;
    alreadyDepreciatedThisPeriod?: boolean;
    depreciatedAssetCodes?: ReadonlySet<string>;
  }
): FixedAssetWithCalculation {
  const moiCents = Math.max(0, toCents(asset.montoOriginalInversion));
  const annualRate = Math.max(0, Math.min(100, asset.tasaAnualPct)) / 100;

  let notYetDepreciable = false;
  const isPeriod13 = targetPeriod?.periodo === 13;
  if (targetPeriod && asset.fechaAdquisicion && !isPeriod13) {
    const acq = parseCalendarDate(asset.fechaAdquisicion, targetPeriod.ejercicio, 1);
    const effectiveMonth = Math.min(12, targetPeriod.periodo);
    // Art. 31 LISR: se deprecia por meses completos posteriores al mes de adquisición
    if (acq.year > targetPeriod.ejercicio || (acq.year === targetPeriod.ejercicio && acq.month >= effectiveMonth)) {
      notYetDepreciable = true;
    }
  }

  const rawPriorMonths = Math.max(0, Math.floor(asset.mesesDepreciadosPrevios));
  const includedInPeriodPoliza = Boolean(targetPeriod?.alreadyDepreciatedThisPeriod) &&
    (!targetPeriod?.depreciatedAssetCodes || targetPeriod.depreciatedAssetCodes.has(asset.codigo));
  const isFinalMonthDisplay = asset.estatus === 'TOTALMENTE_DEPRECIADO' && includedInPeriodPoliza && rawPriorMonths > 0;
  const isDepreciableNow = (asset.estatus === 'ACTIVO' || isFinalMonthDisplay) && !notYetDepreciable && !isPeriod13;

  const priorMonths = includedInPeriodPoliza && isDepreciableNow && rawPriorMonths > 0 ? rawPriorMonths - 1 : rawPriorMonths;
  const priorAccumulatedCents = priorMonths > 0 ? Math.min(moiCents, Math.round((moiCents * annualRate * priorMonths) / 12)) : 0;
  const totalAtTargetMonthCents = isDepreciableNow ? Math.min(moiCents, Math.round((moiCents * annualRate * (priorMonths + 1)) / 12)) : priorAccumulatedCents;
  const remainingDepreciableCents = Math.max(0, moiCents - priorAccumulatedCents);
  const currentMonthCents = isDepreciableNow ? Math.min(Math.max(0, totalAtTargetMonthCents - priorAccumulatedCents), remainingDepreciableCents) : 0;
  const totalAccumulatedCents = Math.min(moiCents, priorAccumulatedCents + currentMonthCents);
  const netBookValueCents = Math.max(0, moiCents - totalAccumulatedCents);

  const inpcBase = asset.inpcAdquisicion > 0 ? asset.inpcAdquisicion : 1;
  const inpcCurrent = targetPeriod
    ? resolveLisrInpcMedioPeriodo(asset.fechaAdquisicion, targetPeriod.ejercicio)
    : asset.inpcMedioPeriodo > 0 ? asset.inpcMedioPeriodo : inpcBase;
  const factorActualizacionInpc = calculateInpcFactor(inpcBase, inpcCurrent);

  const fiscalMoiCents = resolveFiscalDepreciableMoiCents(asset, moiCents);
  const priorFiscalAccumCents = priorMonths > 0 ? Math.min(fiscalMoiCents, Math.round((fiscalMoiCents * annualRate * priorMonths) / 12)) : 0;
  const totalFiscalAtTargetMonthCents = isDepreciableNow ? Math.min(fiscalMoiCents, Math.round((fiscalMoiCents * annualRate * (priorMonths + 1)) / 12)) : priorFiscalAccumCents;
  const remainingFiscalBaseCents = Math.max(0, fiscalMoiCents - priorFiscalAccumCents);
  const cappedFiscalBaseMonthCents = isDepreciableNow ? Math.min(Math.max(0, totalFiscalAtTargetMonthCents - priorFiscalAccumCents), remainingFiscalBaseCents) : 0;
  const fiscalMonthlyCents = Math.round(cappedFiscalBaseMonthCents * factorActualizacionInpc);

  return {
    ...asset,
    depreciacionMensualContable: fromCents(currentMonthCents),
    depreciacionAcumuladaTotal: fromCents(totalAccumulatedCents),
    valorNetoEnLibros: fromCents(netBookValueCents),
    factorActualizacionInpc,
    depreciacionMensualFiscalActualizada: fromCents(fiscalMonthlyCents)
  };
}

/**
 * Genera el plan de Póliza de Diario de Depreciación Mensual para todos los activos fijos activos.
 */
export function buildDepreciationPolizaPlan(
  assets: readonly FixedAssetRecord[],
  accounts: readonly Account[],
  periodLabel: string,
  targetPeriod?: { ejercicio: number; periodo: number }
): AutoPolizaPlan {
  assertAccountingInvariant(
    accounts.length > 0,
    'EMPTY_ACCOUNTS',
    'El catálogo de cuentas está vacío.'
  );

  const movements: AutoPolizaMovementDraft[] = [];
  const maxPairs = Math.floor(SAFETY_BOUNDS.MAX_POLIZA_MOVEMENTS / 2);
  const activeAssets = assets.filter((a) => a.estatus === 'ACTIVO');

  for (const rawAsset of activeAssets) {
    if (movements.length / 2 >= maxPairs) break;

    const calc = computeFixedAssetWithDepreciation(rawAsset, targetPeriod);
    const depCents = toCents(calc.depreciacionMensualContable);
    if (depCents <= 0) continue;

    const accGasto = resolveFiscalAccount(accounts, 'GASTO_DEPRECIACION', rawAsset.cuentaGastoDepCode);
    const accDepAcum = resolveFiscalAccount(accounts, 'DEPRECIACION_ACUMULADA', rawAsset.cuentaDepAcumCode);

    movements.push(
      { accountId: accGasto.id, accountCode: accGasto.code, accountName: accGasto.name, referencia: `DEP-${rawAsset.codigo}`, cargo: fromCents(depCents), abono: 0, concepto: `Depreciación mensual (${rawAsset.tasaAnualPct}% anual) - ${rawAsset.nombre}` },
      { accountId: accDepAcum.id, accountCode: accDepAcum.code, accountName: accDepAcum.name, referencia: `DEP-${rawAsset.codigo}`, cargo: 0, abono: fromCents(depCents), concepto: `Depreciación acumulada ${periodLabel} - ${rawAsset.nombre}` }
    );
  }

  assertAccountingInvariant(
    movements.length >= 2,
    'NO_DEPRECIABLE_ASSETS',
    'No existen activos fijos vigentes con importe por depreciar en este periodo.'
  );

  const totalCargoCents = sumCents(movements.map((m) => m.cargo));
  const totalAbonoCents = sumCents(movements.map((m) => m.abono));

  return {
    polizaType: 'DIARIO',
    polizaConcept: `Depreciación Contable Mensual de Activos Fijos (${periodLabel})`,
    movements,
    totalCargo: fromCents(totalCargoCents),
    totalAbono: fromCents(totalAbonoCents),
    isBalanced: totalCargoCents > 0 && totalCargoCents === totalAbonoCents
  };
}

/**
 * Calcula el nuevo acumulado de meses depreciados y estatus tras contabilizar la depreciación del periodo.
 * Retorna null si el activo no se depreció en el periodo (baja, adquirido después, o 100% depreciado).
 */
export function computeAssetPostDepreciationUpdate(
  asset: FixedAssetRecord,
  targetPeriod?: { ejercicio: number; periodo: number }
): { mesesDepreciadosPrevios: number; estatus: FixedAssetRecord['estatus'] } | null {
  if (asset.estatus !== 'ACTIVO') return null;
  const calc = computeFixedAssetWithDepreciation(asset, targetPeriod);
  if (toCents(calc.depreciacionMensualContable) <= 0) return null;

  const nextMonths = Math.max(0, Math.floor(asset.mesesDepreciadosPrevios)) + 1;
  const moiCents = Math.max(0, toCents(asset.montoOriginalInversion));
  const totalAccumCents = toCents(calc.depreciacionAcumuladaTotal);
  const nextEstatus: FixedAssetRecord['estatus'] =
    moiCents > 0 && totalAccumCents >= moiCents ? 'TOTALMENTE_DEPRECIADO' : 'ACTIVO';

  return { mesesDepreciadosPrevios: nextMonths, estatus: nextEstatus };
}

/**
 * Verifica si ya existe una póliza de depreciación mensual registrada en el periodo.
 */
export function hasExistingDepreciationPoliza(
  polizas: ReadonlyArray<{ concepto: string; origin?: string | null }>
): boolean {
  return polizas.some((p) => {
    if (p.origin === 'DEPRECIACION') return true;
    const norm = p.concepto.trim().toLowerCase();
    return (
      norm.startsWith('depreciación contable mensual de activos fijos') ||
      norm.startsWith('depreciacion contable mensual de activos fijos') ||
      norm.startsWith('depreciación mensual activos fijos') ||
      norm.startsWith('depreciacion mensual activos fijos')
    );
  });
}

export interface FixedAssetDisposalSummary {
  depAcumuladaContable: number;
  valorNetoContable: number;
  utilidadOPerdidaContable: number;
  fiscalMoiTope: number;
  saldoPendienteFiscal: number;
  factorActualizacionBaja: number;
  costoFiscalActualizado: number;
  gananciaOPerdidaFiscal: number;
}

export function computeFixedAssetDisposalSummary(
  asset: FixedAssetRecord,
  fechaBaja: string,
  precioVenta: number,
  inpcEnajenacion?: number
): FixedAssetDisposalSummary {
  const moiCents = Math.max(0, toCents(asset.montoOriginalInversion));
  const annualRate = Math.max(0, Math.min(100, asset.tasaAnualPct)) / 100;
  const priorMonths = Math.max(0, Math.floor(asset.mesesDepreciadosPrevios));
  const depAcumCents = priorMonths > 0 ? Math.min(moiCents, Math.round((moiCents * annualRate * priorMonths) / 12)) : 0;
  const valorNetoCents = Math.max(0, moiCents - depAcumCents);
  const saleCents = Math.max(0, toCents(precioVenta));

  const fiscalMoiCents = resolveFiscalDepreciableMoiCents(asset, moiCents);
  const depFiscalCents = priorMonths > 0 ? Math.min(fiscalMoiCents, Math.round((fiscalMoiCents * annualRate * priorMonths) / 12)) : 0;
  const saldoFiscalCents = Math.max(0, fiscalMoiCents - depFiscalCents);
  const bajaDate = parseCalendarDate(fechaBaja);
  const medioMonth = Math.max(1, Math.floor(bajaDate.month / 2));
  const inpcBaja = inpcEnajenacion && inpcEnajenacion > 0 ? inpcEnajenacion : getInpcMedioPeriodo(bajaDate.year, medioMonth);
  const factor = calculateInpcFactor(asset.inpcAdquisicion > 0 ? asset.inpcAdquisicion : 1, inpcBaja);
  const costoFiscalActCents = Math.round(saldoFiscalCents * factor);

  return {
    depAcumuladaContable: fromCents(depAcumCents),
    valorNetoContable: fromCents(valorNetoCents),
    utilidadOPerdidaContable: fromCents(saleCents - valorNetoCents),
    fiscalMoiTope: fromCents(fiscalMoiCents),
    saldoPendienteFiscal: fromCents(saldoFiscalCents),
    factorActualizacionBaja: factor,
    costoFiscalActualizado: fromCents(costoFiscalActCents),
    gananciaOPerdidaFiscal: fromCents(saleCents - costoFiscalActCents)
  };
}

export function buildFixedAssetDisposalPolizaPlan(params: {
  asset: FixedAssetRecord;
  accounts: readonly Account[];
  fechaBaja: string;
  precioVenta: number;
  cuentaCobroCode?: string;
  inpcEnajenacion?: number;
}): AutoPolizaPlan & { summary: FixedAssetDisposalSummary } {
  const { asset, accounts, fechaBaja, precioVenta, cuentaCobroCode, inpcEnajenacion } = params;
  assertAccountingInvariant(accounts.length > 0, 'EMPTY_ACCOUNTS', 'El catálogo de cuentas está vacío.');
  const summary = computeFixedAssetDisposalSummary(asset, fechaBaja, precioVenta, inpcEnajenacion);
  const moiCents = Math.max(0, toCents(asset.montoOriginalInversion));
  const depAcumCents = toCents(summary.depAcumuladaContable);
  const saleCents = Math.max(0, toCents(precioVenta));
  const diffCents = toCents(summary.utilidadOPerdidaContable);

  const affectable = accounts.filter((a) => a.isAffectable);
  const accActivo = affectable.find((a) => a.code === asset.cuentaActivoCode) ?? resolveFiscalAccount(accounts, 'GASTO_DEPRECIACION');
  const accDepAcum = resolveFiscalAccount(accounts, 'DEPRECIACION_ACUMULADA', asset.cuentaDepAcumCode);
  const accCobro = cuentaCobroCode
    ? affectable.find((a) => a.code === cuentaCobroCode) ?? resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL')
    : resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL');
  const accPerdida = affectable.find((a) => a.code.startsWith('601') && a.name.toLowerCase().includes('perdida'))
    ?? affectable.find((a) => a.code === '701-01-001') ?? resolveFiscalAccount(accounts, 'GASTO_DEPRECIACION');
  const accUtilidad = affectable.find((a) => a.code.startsWith('40') && a.name.toLowerCase().includes('utilidad'))
    ?? affectable.find((a) => a.code === '702-01-001') ?? resolveFiscalAccount(accounts, 'INGRESOS_TASA_16');

  const ref = `BAJA-${asset.codigo}`;
  const movements: AutoPolizaMovementDraft[] = [];
  if (saleCents > 0) {
    movements.push({ accountId: accCobro.id, accountCode: accCobro.code, accountName: accCobro.name, referencia: ref, cargo: fromCents(saleCents), abono: 0, concepto: `Enajenación activo ${asset.codigo} (${asset.nombre})` });
  }
  if (depAcumCents > 0) {
    movements.push({ accountId: accDepAcum.id, accountCode: accDepAcum.code, accountName: accDepAcum.name, referencia: ref, cargo: fromCents(depAcumCents), abono: 0, concepto: `Cancelación dep. acumulada ${asset.codigo}` });
  }
  if (diffCents < 0) {
    movements.push({ accountId: accPerdida.id, accountCode: accPerdida.code, accountName: accPerdida.name, referencia: ref, cargo: fromCents(Math.abs(diffCents)), abono: 0, concepto: `Pérdida contable por baja/enajenación ${asset.codigo}` });
  }
  movements.push({ accountId: accActivo.id, accountCode: accActivo.code, accountName: accActivo.name, referencia: ref, cargo: 0, abono: fromCents(moiCents), concepto: `Baja de MOI activo ${asset.codigo}` });
  if (diffCents > 0) {
    movements.push({ accountId: accUtilidad.id, accountCode: accUtilidad.code, accountName: accUtilidad.name, referencia: ref, cargo: 0, abono: fromCents(diffCents), concepto: `Utilidad contable en venta de activo ${asset.codigo}` });
  }
  const totalCargoCents = sumCents(movements.map((m) => m.cargo));
  const totalAbonoCents = sumCents(movements.map((m) => m.abono));
  return {
    polizaType: saleCents > 0 ? 'INGRESO' : 'DIARIO',
    polizaConcept: `Baja / Enajenación de Activo Fijo ${asset.codigo} (${asset.nombre})`,
    movements,
    totalCargo: fromCents(totalCargoCents),
    totalAbono: fromCents(totalAbonoCents),
    isBalanced: totalCargoCents > 0 && totalCargoCents === totalAbonoCents,
    summary
  };
}

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
  const nameLower = asset.nombre.toLowerCase();
  // Camiones de carga, tractocamiones y montacargas no están sujetos al tope de automóviles utilitarios
  if (
    nameLower.includes('camión') ||
    nameLower.includes('camion') ||
    nameLower.includes('tracto') ||
    nameLower.includes('montacarga') ||
    nameLower.includes('reparto')
  ) {
    return moiCents;
  }
  const isElectricOrHybrid =
    nameLower.includes('eléctric') ||
    nameLower.includes('electric') ||
    nameLower.includes('híbrid') ||
    nameLower.includes('hibrid') ||
    nameLower.includes('phev') ||
    /\bev\b/i.test(nameLower);
  const capCents = isElectricOrHybrid
    ? LISR_ART36_AUTO_ELECTRICO_CAP_CENTS
    : LISR_ART36_AUTO_COMBUSTION_CAP_CENTS;
  return Math.min(moiCents, capCents);
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
    if (
      acq.year > targetPeriod.ejercicio ||
      (acq.year === targetPeriod.ejercicio && acq.month >= effectiveMonth)
    ) {
      notYetDepreciable = true;
    }
  }

  const rawPriorMonths = Math.max(0, Math.floor(asset.mesesDepreciadosPrevios));
  const includedInPeriodPoliza =
    Boolean(targetPeriod?.alreadyDepreciatedThisPeriod) &&
    (!targetPeriod?.depreciatedAssetCodes || targetPeriod.depreciatedAssetCodes.has(asset.codigo));
  const isFinalMonthDisplay =
    asset.estatus === 'TOTALMENTE_DEPRECIADO' &&
    includedInPeriodPoliza &&
    rawPriorMonths > 0;
  const isDepreciableNow =
    (asset.estatus === 'ACTIVO' || isFinalMonthDisplay) && !notYetDepreciable && !isPeriod13;

  // Si ya se generó la póliza del periodo actual, mesesDepreciadosPrevios ya incluye +1 de este mes.
  const priorMonths =
    includedInPeriodPoliza && isDepreciableNow && rawPriorMonths > 0
      ? rawPriorMonths - 1
      : rawPriorMonths;
  const priorAccumulatedCents =
    priorMonths > 0 ? Math.min(moiCents, Math.round((moiCents * annualRate * priorMonths) / 12)) : 0;
  const totalAtTargetMonthCents = isDepreciableNow
    ? Math.min(moiCents, Math.round((moiCents * annualRate * (priorMonths + 1)) / 12))
    : priorAccumulatedCents;
  const remainingDepreciableCents = Math.max(0, moiCents - priorAccumulatedCents);
  const currentMonthCents = isDepreciableNow
    ? Math.min(Math.max(0, totalAtTargetMonthCents - priorAccumulatedCents), remainingDepreciableCents)
    : 0;
  const totalAccumulatedCents = Math.min(moiCents, priorAccumulatedCents + currentMonthCents);
  const netBookValueCents = Math.max(0, moiCents - totalAccumulatedCents);

  const inpcBase = asset.inpcAdquisicion > 0 ? asset.inpcAdquisicion : 1;
  const inpcCurrent = targetPeriod
    ? resolveLisrInpcMedioPeriodo(asset.fechaAdquisicion, targetPeriod.ejercicio)
    : asset.inpcMedioPeriodo > 0
      ? asset.inpcMedioPeriodo
      : inpcBase;
  const factorActualizacionInpc = calculateInpcFactor(inpcBase, inpcCurrent);

  const fiscalMoiCents = resolveFiscalDepreciableMoiCents(asset, moiCents);
  const priorFiscalAccumCents =
    priorMonths > 0
      ? Math.min(fiscalMoiCents, Math.round((fiscalMoiCents * annualRate * priorMonths) / 12))
      : 0;
  const totalFiscalAtTargetMonthCents = isDepreciableNow
    ? Math.min(fiscalMoiCents, Math.round((fiscalMoiCents * annualRate * (priorMonths + 1)) / 12))
    : priorFiscalAccumCents;
  const remainingFiscalBaseCents = Math.max(0, fiscalMoiCents - priorFiscalAccumCents);
  const cappedFiscalBaseMonthCents = isDepreciableNow
    ? Math.min(
        Math.max(0, totalFiscalAtTargetMonthCents - priorFiscalAccumCents),
        remainingFiscalBaseCents
      )
    : 0;
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

    const accGasto = resolveFiscalAccount(
      accounts,
      'GASTO_DEPRECIACION',
      rawAsset.cuentaGastoDepCode
    );
    const accDepAcum = resolveFiscalAccount(
      accounts,
      'DEPRECIACION_ACUMULADA',
      rawAsset.cuentaDepAcumCode
    );

    movements.push(
      {
        accountId: accGasto.id,
        accountCode: accGasto.code,
        accountName: accGasto.name,
        referencia: `DEP-${rawAsset.codigo}`,
        cargo: fromCents(depCents),
        abono: 0,
        concepto: `Depreciación mensual (${rawAsset.tasaAnualPct}% anual) - ${rawAsset.nombre}`
      },
      {
        accountId: accDepAcum.id,
        accountCode: accDepAcum.code,
        accountName: accDepAcum.name,
        referencia: `DEP-${rawAsset.codigo}`,
        cargo: 0,
        abono: fromCents(depCents),
        concepto: `Depreciación acumulada ${periodLabel} - ${rawAsset.nombre}`
      }
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

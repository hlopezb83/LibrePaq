import type {
  Account,
  FixedAssetRecord,
  FixedAssetWithCalculation
} from '../types';
import { SAFETY_BOUNDS } from '../sat-constants';
import { parseCalendarDate } from '../date-utils';
import { calculateInpcFactor } from '../sat-inpc-catalog';
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

export function computeFixedAssetWithDepreciation(
  asset: FixedAssetRecord,
  targetPeriod?: { ejercicio: number; periodo: number }
): FixedAssetWithCalculation {
  const moiCents = Math.max(0, toCents(asset.montoOriginalInversion));
  const annualRate = Math.max(0, Math.min(100, asset.tasaAnualPct)) / 100;

  let acquiredAfterTarget = false;
  const isPeriod13 = targetPeriod?.periodo === 13;
  if (targetPeriod && asset.fechaAdquisicion && !isPeriod13) {
    const acq = parseCalendarDate(asset.fechaAdquisicion, targetPeriod.ejercicio, 1);
    const effectiveMonth = Math.min(12, targetPeriod.periodo);
    if (
      acq.year > targetPeriod.ejercicio ||
      (acq.year === targetPeriod.ejercicio && acq.month > effectiveMonth)
    ) {
      acquiredAfterTarget = true;
    }
  }

  const isDepreciableNow = asset.estatus === 'ACTIVO' && !acquiredAfterTarget && !isPeriod13;
  const rawMonthlyCents = isDepreciableNow ? Math.round((moiCents * annualRate) / 12) : 0;

  const priorMonths = Math.max(0, Math.floor(asset.mesesDepreciadosPrevios));
  const priorAccumulatedCents =
    priorMonths > 0 ? Math.min(moiCents, Math.round((moiCents * annualRate * priorMonths) / 12)) : 0;
  const totalAtTargetMonthCents = isDepreciableNow
    ? Math.min(moiCents, Math.round((moiCents * annualRate * (priorMonths + 1)) / 12))
    : priorAccumulatedCents;
  const remainingDepreciableCents = Math.max(0, moiCents - priorAccumulatedCents);
  const currentMonthCents = isDepreciableNow
    ? Math.min(Math.max(rawMonthlyCents, totalAtTargetMonthCents - priorAccumulatedCents), remainingDepreciableCents)
    : 0;
  const totalAccumulatedCents = Math.min(moiCents, priorAccumulatedCents + currentMonthCents);
  const netBookValueCents = Math.max(0, moiCents - totalAccumulatedCents);

  const inpcBase = asset.inpcAdquisicion > 0 ? asset.inpcAdquisicion : 1;
  const inpcCurrent = asset.inpcMedioPeriodo > 0 ? asset.inpcMedioPeriodo : inpcBase;
  const factorActualizacionInpc = calculateInpcFactor(inpcBase, inpcCurrent);

  const fiscalMoiCents = resolveFiscalDepreciableMoiCents(asset, moiCents);
  const rawFiscalMonthlyBase = isDepreciableNow
    ? Math.round((fiscalMoiCents * annualRate) / 12)
    : 0;
  const priorFiscalAccumCents = Math.min(
    fiscalMoiCents,
    Math.round((fiscalMoiCents * annualRate) / 12) * priorMonths
  );
  const remainingFiscalBaseCents = Math.max(0, fiscalMoiCents - priorFiscalAccumCents);
  const cappedFiscalBaseMonthCents = isDepreciableNow
    ? Math.min(rawFiscalMonthlyBase, remainingFiscalBaseCents)
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
  const bound = Math.min(assets.length, Math.floor(SAFETY_BOUNDS.MAX_POLIZA_MOVEMENTS / 2));

  for (let i = 0; i < bound; i += 1) {
    const rawAsset = assets[i];
    if (!rawAsset || rawAsset.estatus !== 'ACTIVO') continue;

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
  polizas: ReadonlyArray<{ concepto: string }>
): boolean {
  return polizas.some((p) => {
    const lower = p.concepto.toLowerCase();
    return lower.includes('depreciación') || lower.includes('depreciacion');
  });
}

import {
  computeFixedAssetWithDepreciation,
  extractDepreciatedAssetCodes,
  resolveLisrInpcMedioPeriodo
} from '../../shared/engine/fixed-assets.engine';
import { fromCents, sumCents } from '../../shared/engine/invariants-and-math';
import { FISCAL_ACCOUNT_ROLES } from '../../shared/sat-constants';
import type {
  AccountWithBalance,
  FixedAssetCategory,
  FixedAssetsResponse,
  Poliza
} from '../../shared/types';

const CATEGORY_DEFAULT_ASSET_CODES: Record<string, string> = {
  EDIFICIOS_5: '152-01-001',
  MAQUINARIA_10: '153-01-001',
  TRANSPORTE_25: '154-01-001',
  EQUIPO_TRANSPORTE_25: '154-01-001',
  MOBILIARIO_10: '155-01-001',
  COMPUTO_30: '156-01-001'
};

export function resolveFixedAssetDefaultAccounts(
  category: FixedAssetCategory,
  affectableAccounts: readonly AccountWithBalance[]
): { cuentaActivoCode: string; cuentaDepAcumCode: string; cuentaGastoDepCode: string } {
  const preferredAsset = CATEGORY_DEFAULT_ASSET_CODES[category] ?? '156-01-001';
  const prefix = preferredAsset.slice(0, 3);
  const cuentaActivoCode =
    affectableAccounts.find((a) => a.code === preferredAsset)?.code ??
    affectableAccounts.find((a) => a.code.startsWith(`${prefix}-`))?.code ??
    preferredAsset;

  const cuentaDepAcumCode =
    affectableAccounts.find(
      (a) =>
        a.code === FISCAL_ACCOUNT_ROLES.DEPRECIACION_ACUMULADA.code ||
        a.satGroupCode?.startsWith('171')
    )?.code ?? FISCAL_ACCOUNT_ROLES.DEPRECIACION_ACUMULADA.code;

  const cuentaGastoDepCode =
    affectableAccounts.find(
      (a) =>
        a.code === FISCAL_ACCOUNT_ROLES.GASTO_DEPRECIACION.code ||
        a.satGroupCode?.startsWith('601.84')
    )?.code ?? FISCAL_ACCOUNT_ROLES.GASTO_DEPRECIACION.code;

  return { cuentaActivoCode, cuentaDepAcumCode, cuentaGastoDepCode };
}

export function resolveAssetInpcMedioForForm(fechaIso: string, fiscalYear: number): number {
  return resolveLisrInpcMedioPeriodo(fechaIso, fiscalYear);
}

export function adjustLocalAssetsForPostedPeriod(
  rawData: FixedAssetsResponse,
  periodPolizas: readonly Poliza[],
  year: number,
  activePeriod: number
): FixedAssetsResponse {
  const depreciatedAssetCodes = extractDepreciatedAssetCodes(periodPolizas);
  const adjusted = rawData.assets.map((a) =>
    computeFixedAssetWithDepreciation(a, {
      ejercicio: year,
      periodo: activePeriod,
      alreadyDepreciatedThisPeriod: true,
      depreciatedAssetCodes
    })
  );
  return {
    assets: adjusted,
    totals: {
      totalMoi: fromCents(sumCents(adjusted.map((a) => a.montoOriginalInversion))),
      totalDepreciacionMensualContable: fromCents(
        sumCents(adjusted.map((a) => a.depreciacionMensualContable))
      ),
      totalDepreciacionMensualFiscal: fromCents(
        sumCents(adjusted.map((a) => a.depreciacionMensualFiscalActualizada))
      ),
      totalDepreciacionAcumulada: fromCents(
        sumCents(adjusted.map((a) => a.depreciacionAcumuladaTotal))
      ),
      totalValorNetoEnLibros: fromCents(sumCents(adjusted.map((a) => a.valorNetoEnLibros)))
    }
  };
}

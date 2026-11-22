import { db, mapFixedAssetRow, type FixedAssetDbRow } from '../connection';
import {
  buildDepreciationPolizaPlan,
  computeFixedAssetWithDepreciation,
  fromCents,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-catalog';
import { getDefaultDateForPeriod } from '../../shared/date-utils';
import type { FixedAssetCategory, FixedAssetsResponse, Poliza } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { createPolizaTransaction } from './polizas.repo';
import { assertPeriodOpen } from './period-locks.repo';

export function getFixedAssetsResponse(companyId: string): FixedAssetsResponse {
  const rows = db
    .query(
      'SELECT * FROM fixed_assets WHERE company_id = ? ORDER BY fecha_adquisicion ASC, codigo ASC'
    )
    .all(companyId) as FixedAssetDbRow[];

  const assets = rows.map((r) => computeFixedAssetWithDepreciation(mapFixedAssetRow(r)));

  return {
    assets,
    totals: {
      totalMoi: fromCents(sumCents(assets.map((a) => a.montoOriginalInversion))),
      totalDepreciacionMensualContable: fromCents(
        sumCents(assets.map((a) => a.depreciacionMensualContable))
      ),
      totalDepreciacionMensualFiscal: fromCents(
        sumCents(assets.map((a) => a.depreciacionMensualFiscalActualizada))
      ),
      totalDepreciacionAcumulada: fromCents(
        sumCents(assets.map((a) => a.depreciacionAcumuladaTotal))
      ),
      totalValorNetoEnLibros: fromCents(sumCents(assets.map((a) => a.valorNetoEnLibros)))
    }
  };
}

export function createFixedAssetRecord(
  companyId: string,
  input: {
    codigo: string;
    nombre: string;
    categoria: FixedAssetCategory;
    fechaAdquisicion: string;
    cfdiUuid?: string | null;
    montoOriginalInversion: number;
    tasaAnualPct: number;
    mesesDepreciadosPrevios?: number;
    inpcAdquisicion?: number;
    inpcMedioPeriodo?: number;
    cuentaActivoCode?: string;
    cuentaDepAcumCode?: string;
    cuentaGastoDepCode?: string;
  }
): FixedAssetsResponse {
  const acqYear = parseInt(input.fechaAdquisicion.slice(0, 4), 10);
  const acqPeriod = parseInt(input.fechaAdquisicion.slice(5, 7), 10);
  if (acqYear && acqPeriod) {
    assertPeriodOpen(companyId, acqYear, acqPeriod);
  }

  const id = `fa_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO fixed_assets (
      id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
      monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
      inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code, cuenta_dep_acum_code,
      cuenta_gasto_dep_code, estatus, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', ?)
  `).run(
    id,
    companyId,
    input.codigo.trim().toUpperCase(),
    input.nombre.trim(),
    input.categoria,
    input.fechaAdquisicion,
    input.cfdiUuid || null,
    fromCents(toCents(input.montoOriginalInversion)),
    input.tasaAnualPct,
    input.mesesDepreciadosPrevios ?? 0,
    input.inpcAdquisicion ?? 132.54,
    input.inpcMedioPeriodo ?? 136.82,
    input.cuentaActivoCode || '156-01-001',
    input.cuentaDepAcumCode || '171-01-001',
    input.cuentaGastoDepCode || '601-01-006',
    now
  );

  return getFixedAssetsResponse(companyId);
}

export function deleteFixedAssetRecord(assetId: string): boolean {
  const res = db.prepare('DELETE FROM fixed_assets WHERE id = ?').run(assetId);
  return res.changes > 0;
}

export function generateMonthlyDepreciationPoliza(
  companyId: string,
  ejercicio: number,
  periodo: number
): Poliza {
  assertPeriodOpen(companyId, ejercicio, periodo);

  const rawRows = db
    .query('SELECT * FROM fixed_assets WHERE company_id = ?')
    .all(companyId) as FixedAssetDbRow[];
  const assets = rawRows.map(mapFixedAssetRow);
  const accounts = getAccounts(companyId);
  const mesNombre = MESES_SAT.find((m) => m.periodo === periodo)?.nombre || `M${periodo}`;
  const periodLabel = `${mesNombre} ${ejercicio}`;

  const plan = buildDepreciationPolizaPlan(assets, accounts, periodLabel);
  const fecha = getDefaultDateForPeriod(ejercicio, periodo);

  return createPolizaTransaction({
    companyId,
    ejercicio,
    periodo,
    tipo: plan.polizaType,
    fecha,
    concepto: plan.polizaConcept,
    cfdiUuid: null,
    origin: 'MANUAL',
    movements: plan.movements
  });
}

import { db, mapFixedAssetRow, type FixedAssetDbRow } from '../connection';
import type { SqliteDdlTarget } from '../db-ddl';
import {
  buildAnnualMonthlyBalancesFromMovements,
  computeAnnualFixedAssetFiscalDeduction,
  computeAnnualProvisionalPayments
} from '../../shared/engine/annual-tax-balances.helper';
import {
  computeAnnualTaxSummary,
  resolveAnnualInpcPair
} from '../../shared/engine/annual-tax.engine';
import { assertAccountingInvariant, fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { AnnualTaxInputs, AnnualTaxSummaryResponse } from '../../shared/types/annual-tax.types';
import { getAccounts } from './accounts.repo';
import { getCfdiDocuments } from './cfdi.repo';
import { getCompanyById } from './companies.repo';
import { getTaxParameters } from './fiscal.repo';

interface AnnualSnapshotDbRow {
  id: string;
  company_id: string;
  ejercicio: number;
  inpc_cierre_anterior: number;
  inpc_cierre_actual: number;
  cuca_inicial: number;
  aportaciones_capital: number;
  reducciones_capital: number;
  cufin_inicial: number;
  dividendos_pagados: number;
  ptu_pagada_anterior: number;
  no_deducibles_manual: number;
  updated_at: string;
}

const ANNUAL_AND_INVENTORY_DDL = `
  CREATE TABLE IF NOT EXISTS annual_tax_snapshots (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ejercicio INTEGER NOT NULL,
    inpc_cierre_anterior REAL NOT NULL DEFAULT 139.38,
    inpc_cierre_actual REAL NOT NULL DEFAULT 145.4,
    cuca_inicial REAL NOT NULL DEFAULT 0,
    aportaciones_capital REAL NOT NULL DEFAULT 0,
    reducciones_capital REAL NOT NULL DEFAULT 0,
    cufin_inicial REAL NOT NULL DEFAULT 0,
    dividendos_pagados REAL NOT NULL DEFAULT 0,
    ptu_pagada_anterior REAL NOT NULL DEFAULT 0,
    no_deducibles_manual REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(company_id, ejercicio)
  );
  CREATE INDEX IF NOT EXISTS idx_annual_tax_snapshots_company
    ON annual_tax_snapshots(company_id);

  CREATE TABLE IF NOT EXISTS inventory_periods (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ejercicio INTEGER NOT NULL,
    periodo INTEGER NOT NULL,
    initial_inventory REAL NOT NULL DEFAULT 0,
    purchases_override REAL,
    final_inventory REAL NOT NULL DEFAULT 0,
    method TEXT NOT NULL DEFAULT 'ANALITICO' CHECK (method IN ('ANALITICO','PERPETUO')),
    poliza_id TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(company_id, ejercicio, periodo)
  );
  CREATE INDEX IF NOT EXISTS idx_inventory_periods_company
    ON inventory_periods(company_id, ejercicio);
`;

export function ensureAnnualAndInventoryTables(database: SqliteDdlTarget = db): void {
  database.exec(ANNUAL_AND_INVENTORY_DDL);
}

function mapSnapshotRow(row: AnnualSnapshotDbRow): AnnualTaxInputs {
  return {
    companyId: row.company_id,
    ejercicio: Number(row.ejercicio),
    inpcCierreAnterior: Number(row.inpc_cierre_anterior),
    inpcCierreActual: Number(row.inpc_cierre_actual),
    cucaInicial: Number(row.cuca_inicial ?? 0),
    aportacionesCapital: Number(row.aportaciones_capital ?? 0),
    reduccionesCapital: Number(row.reducciones_capital ?? 0),
    cufinInicial: Number(row.cufin_inicial ?? 0),
    dividendosPagados: Number(row.dividendos_pagados ?? 0),
    ptuPagadaAnterior: Number(row.ptu_pagada_anterior ?? 0),
    noDeduciblesManual: Number(row.no_deducibles_manual ?? 0),
    updatedAt: row.updated_at
  };
}

export function getAnnualTaxInputsRepo(
  companyId: string,
  ejercicio: number
): AnnualTaxInputs {
  ensureAnnualAndInventoryTables(db);
  const row = db
    .query('SELECT * FROM annual_tax_snapshots WHERE company_id = ? AND ejercicio = ?')
    .get(companyId, ejercicio) as AnnualSnapshotDbRow | null;

  if (row) return mapSnapshotRow(row);
  const defaults = resolveAnnualInpcPair(ejercicio);
  return {
    companyId,
    ejercicio,
    inpcCierreAnterior: defaults.inpcCierreAnterior,
    inpcCierreActual: defaults.inpcCierreActual,
    cucaInicial: 0,
    aportacionesCapital: 0,
    reduccionesCapital: 0,
    cufinInicial: 0,
    dividendosPagados: 0,
    ptuPagadaAnterior: 0,
    noDeduciblesManual: 0
  };
}

export function saveAnnualTaxInputsRepo(
  companyId: string,
  ejercicio: number,
  input: Partial<Omit<AnnualTaxInputs, 'companyId' | 'ejercicio' | 'updatedAt'>>,
  userId?: string | null
): AnnualTaxInputs {
  ensureAnnualAndInventoryTables(db);
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const current = getAnnualTaxInputsRepo(companyId, ejercicio);
  const cleanNum = (val: number | undefined, fallback: number) =>
    val !== undefined && Number.isFinite(Number(val)) ? Math.max(0, Number(val)) : fallback;

  const inpcAnt =
    input.inpcCierreAnterior !== undefined && Number(input.inpcCierreAnterior) > 0
      ? Number(input.inpcCierreAnterior)
      : current.inpcCierreAnterior;
  const inpcAct =
    input.inpcCierreActual !== undefined && Number(input.inpcCierreActual) > 0
      ? Number(input.inpcCierreActual)
      : current.inpcCierreActual;

  const next: AnnualTaxInputs = {
    companyId,
    ejercicio,
    inpcCierreAnterior: inpcAnt,
    inpcCierreActual: inpcAct,
    cucaInicial: fromCents(toCents(cleanNum(input.cucaInicial, current.cucaInicial))),
    aportacionesCapital: fromCents(toCents(cleanNum(input.aportacionesCapital, current.aportacionesCapital))),
    reduccionesCapital: fromCents(toCents(cleanNum(input.reduccionesCapital, current.reduccionesCapital))),
    cufinInicial: fromCents(toCents(cleanNum(input.cufinInicial, current.cufinInicial))),
    dividendosPagados: fromCents(toCents(cleanNum(input.dividendosPagados, current.dividendosPagados))),
    ptuPagadaAnterior: fromCents(toCents(cleanNum(input.ptuPagadaAnterior, current.ptuPagadaAnterior))),
    noDeduciblesManual: fromCents(toCents(cleanNum(input.noDeduciblesManual, current.noDeduciblesManual)))
  };

  const now = new Date().toISOString();
  const id = `ats_${companyId}_${ejercicio}`;

  db.prepare(`
    INSERT INTO annual_tax_snapshots (
      id, company_id, ejercicio, inpc_cierre_anterior, inpc_cierre_actual,
      cuca_inicial, aportaciones_capital, reducciones_capital,
      cufin_inicial, dividendos_pagados, ptu_pagada_anterior, no_deducibles_manual, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, ejercicio) DO UPDATE SET
      inpc_cierre_anterior = excluded.inpc_cierre_anterior,
      inpc_cierre_actual = excluded.inpc_cierre_actual,
      cuca_inicial = excluded.cuca_inicial,
      aportaciones_capital = excluded.aportaciones_capital,
      reducciones_capital = excluded.reducciones_capital,
      cufin_inicial = excluded.cufin_inicial,
      dividendos_pagados = excluded.dividendos_pagados,
      ptu_pagada_anterior = excluded.ptu_pagada_anterior,
      no_deducibles_manual = excluded.no_deducibles_manual,
      updated_at = excluded.updated_at
  `).run(
    id, companyId, ejercicio, next.inpcCierreAnterior, next.inpcCierreActual,
    next.cucaInicial, next.aportacionesCapital, next.reduccionesCapital,
    next.cufinInicial, next.dividendosPagados, next.ptuPagadaAnterior,
    next.noDeduciblesManual, now
  );

  return getAnnualTaxInputsRepo(companyId, ejercicio);
}

export function getAnnualTaxSummaryRepo(
  companyId: string,
  ejercicio?: number,
  userId?: string | null
): AnnualTaxSummaryResponse {
  ensureAnnualAndInventoryTables(db);
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const targetYear = ejercicio && ejercicio > 2000 ? ejercicio : company.currentYear;
  const accounts = getAccounts(company.id);
  const rawMovs = db
    .query(`
      SELECT m.account_id, m.cargo, m.abono, p.company_id, p.ejercicio, p.periodo
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      WHERE p.company_id = ? AND p.ejercicio <= ?
    `)
    .all(company.id, targetYear) as Array<{
      account_id: string; cargo: number; abono: number;
      company_id: string; ejercicio: number; periodo: number;
    }>;

  const joinedMovs = rawMovs.map((r) => ({
    account_id: r.account_id,
    cargo: r.cargo,
    abono: r.abono,
    polizas: { company_id: r.company_id, ejercicio: r.ejercicio, periodo: r.periodo }
  }));

  const { trialBalance, monthlyBalancesByPeriod } = buildAnnualMonthlyBalancesFromMovements(accounts, joinedMovs, targetYear);
  const assets = (db.query('SELECT * FROM fixed_assets WHERE company_id = ?').all(company.id) as FixedAssetDbRow[]).map(mapFixedAssetRow);
  const fixedAssetsFiscalDeduction = computeAnnualFixedAssetFiscalDeduction(assets, targetYear);
  const taxRows = db
    .query('SELECT periodo, pagos_provisionales_anteriores, perdidas_fiscales_pendientes FROM tax_parameters WHERE company_id = ? AND ejercicio = ? ORDER BY periodo DESC')
    .all(company.id, targetYear) as Array<{
    periodo: number;
    pagos_provisionales_anteriores: number;
    perdidas_fiscales_pendientes: number;
  }>;
  const taxParams = getTaxParameters(company.id, targetYear);
  const paymentsProvisioned = computeAnnualProvisionalPayments({
    accounts,
    movs: joinedMovs,
    ejercicio: targetYear,
    taxParameterRows: taxRows.map((r) => ({
      periodo: Number(r.periodo ?? 0),
      pagosProvisionalesAnteriores: Number(r.pagos_provisionales_anteriores ?? 0)
    }))
  });
  const inputs = getAnnualTaxInputsRepo(company.id, targetYear);
  const cfdis = getCfdiDocuments(company.id);
  const isrFavorAcc = trialBalance.find((a) => a.code === '113-02-001' || a.satGroupCode === '113.02');

  return computeAnnualTaxSummary({
    company,
    ejercicio: targetYear,
    trialBalance,
    monthlyBalancesByPeriod,
    fixedAssetsFiscalDeduction,
    paymentsProvisioned,
    perdidasFiscalesPendientes: taxRows[0]?.perdidas_fiscales_pendientes ?? taxParams.perdidasFiscalesPendientes,
    isrRetenidoAcreditable: Math.max(0, isrFavorAcc?.finalBalance ?? 0),
    inputs,
    cfdis
  });
}

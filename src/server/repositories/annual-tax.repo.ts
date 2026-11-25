import { db, mapFixedAssetRow, type FixedAssetDbRow } from '../connection';
import type { SqliteDdlTarget } from '../db-ddl';
import {
  buildAnnualMonthlyBalancesFromMovements,
  computeAnnualFixedAssetFiscalDeduction,
  computeAnnualProvisionalPayments
} from '../../shared/engine/annual-tax-balances.helper';
import { computeAnnualTaxSummary, resolveAnnualInpcPair } from '../../shared/engine/annual-tax.engine';
import { assertAccountingInvariant, fromCents, toCents } from '../../shared/engine/invariants-and-math';
import type { AnnualTaxInputs, AnnualTaxSummaryResponse } from '../../shared/types/annual-tax.types';
import type { FiscalLossCarryforward } from '../../shared/types/ronda11.types';
import { getAccounts } from './accounts.repo';
import { listAccountingRulesRepo } from './accounting-rules.repo';
import { getCfdiDocuments } from './cfdi.repo';
import { getCompanyById } from './companies.repo';
import { getTaxParameters } from './fiscal.repo';
import { assertPeriodOpen } from './period-locks.repo';

interface AnnualSnapshotDbRow {
  id: string; company_id: string; ejercicio: number;
  inpc_cierre_anterior: number; inpc_cierre_actual: number;
  cuca_inicial: number; aportaciones_capital: number; reducciones_capital: number;
  cufin_inicial: number; dividendos_pagados: number;
  ptu_pagada_anterior: number; no_deducibles_manual: number;
  deducciones_personales?: number; updated_at: string;
}

const ANNUAL_AND_INVENTORY_DDL = `
  CREATE TABLE IF NOT EXISTS annual_tax_snapshots (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ejercicio INTEGER NOT NULL,
    inpc_cierre_anterior REAL NOT NULL DEFAULT 137.949,
    inpc_cierre_actual REAL NOT NULL DEFAULT 143.042,
    cuca_inicial REAL NOT NULL DEFAULT 0,
    aportaciones_capital REAL NOT NULL DEFAULT 0,
    reducciones_capital REAL NOT NULL DEFAULT 0,
    cufin_inicial REAL NOT NULL DEFAULT 0,
    dividendos_pagados REAL NOT NULL DEFAULT 0,
    ptu_pagada_anterior REAL NOT NULL DEFAULT 0,
    no_deducibles_manual REAL NOT NULL DEFAULT 0,
    deducciones_personales REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(company_id, ejercicio)
  );
  CREATE INDEX IF NOT EXISTS idx_annual_tax_snapshots_company ON annual_tax_snapshots(company_id);

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
  CREATE INDEX IF NOT EXISTS idx_inventory_periods_company ON inventory_periods(company_id, ejercicio);

  CREATE TABLE IF NOT EXISTS fiscal_loss_carryforwards (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    loss_year INTEGER NOT NULL,
    original_amount REAL NOT NULL DEFAULT 0,
    applied_amount REAL NOT NULL DEFAULT 0,
    remaining_amount REAL NOT NULL DEFAULT 0,
    inpc_first_update_month INTEGER,
    inpc_last_applied REAL,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(company_id, loss_year)
  );
  CREATE INDEX IF NOT EXISTS idx_fiscal_loss_carryforwards_company ON fiscal_loss_carryforwards(company_id, loss_year);
`;

export function ensureAnnualAndInventoryTables(database: SqliteDdlTarget = db): void {
  database.exec(ANNUAL_AND_INVENTORY_DDL);
  try {
    database.exec('ALTER TABLE annual_tax_snapshots ADD COLUMN deducciones_personales REAL NOT NULL DEFAULT 0');
  } catch {
    // Column already exists
  }
}

function mapSnapshotRow(row: AnnualSnapshotDbRow): AnnualTaxInputs {
  return {
    companyId: row.company_id, ejercicio: Number(row.ejercicio),
    inpcCierreAnterior: Number(row.inpc_cierre_anterior), inpcCierreActual: Number(row.inpc_cierre_actual),
    cucaInicial: Number(row.cuca_inicial ?? 0), aportacionesCapital: Number(row.aportaciones_capital ?? 0),
    reduccionesCapital: Number(row.reducciones_capital ?? 0), cufinInicial: Number(row.cufin_inicial ?? 0),
    dividendosPagados: Number(row.dividendos_pagados ?? 0), ptuPagadaAnterior: Number(row.ptu_pagada_anterior ?? 0),
    noDeduciblesManual: Number(row.no_deducibles_manual ?? 0),
    deduccionesPersonales: Number(row.deducciones_personales ?? 0), updatedAt: row.updated_at
  };
}

export function listFiscalLossesRepo(companyId: string, userId?: string | null): FiscalLossCarryforward[] {
  ensureAnnualAndInventoryTables(db);
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');
  const rows = db
    .query('SELECT * FROM fiscal_loss_carryforwards WHERE company_id = ? ORDER BY loss_year ASC')
    .all(companyId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id),
    lossYear: Number(r.loss_year),
    originalAmount: Number(r.original_amount ?? 0),
    appliedAmount: Number(r.applied_amount ?? 0),
    remainingAmount: Number(r.remaining_amount ?? 0),
    inpcFirstUpdateMonth: r.inpc_first_update_month !== null && r.inpc_first_update_month !== undefined ? Number(r.inpc_first_update_month) : null,
    inpcLastApplied: r.inpc_last_applied !== null && r.inpc_last_applied !== undefined ? Number(r.inpc_last_applied) : null,
    notes: String(r.notes ?? ''),
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  }));
}

export function upsertFiscalLossRepo(
  companyId: string,
  payload: Omit<FiscalLossCarryforward, 'id' | 'companyId' | 'updatedAt'> & { id?: string },
  userId?: string | null
): FiscalLossCarryforward[] {
  ensureAnnualAndInventoryTables(db);
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');
  const lossYear = Math.round(Number(payload.lossYear));
  assertAccountingInvariant(Number.isFinite(lossYear) && lossYear >= 1990 && lossYear <= 2100, 'INVALID_LOSS_YEAR', 'Año de origen de pérdida inválido.');
  const orig = fromCents(Math.max(0, toCents(payload.originalAmount)));
  const app = fromCents(Math.max(0, toCents(payload.appliedAmount)));
  const rem =
    payload.remainingAmount !== undefined
      ? fromCents(Math.max(0, toCents(payload.remainingAmount)))
      : fromCents(Math.max(0, toCents(orig - app)));
  const id = payload.id || `flc_${companyId}_${lossYear}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO fiscal_loss_carryforwards (
      id, company_id, loss_year, original_amount, applied_amount, remaining_amount,
      inpc_first_update_month, inpc_last_applied, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, loss_year) DO UPDATE SET
      original_amount = excluded.original_amount,
      applied_amount = excluded.applied_amount,
      remaining_amount = excluded.remaining_amount,
      inpc_first_update_month = excluded.inpc_first_update_month,
      inpc_last_applied = excluded.inpc_last_applied,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).run(
    id, companyId, lossYear, orig, app, rem,
    payload.inpcFirstUpdateMonth ?? null, payload.inpcLastApplied ?? null, payload.notes ?? '', now
  );
  return listFiscalLossesRepo(companyId, userId);
}

export function deleteFiscalLossRepo(companyId: string, lossId: string, userId?: string | null): FiscalLossCarryforward[] {
  ensureAnnualAndInventoryTables(db);
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');
  db.prepare('DELETE FROM fiscal_loss_carryforwards WHERE company_id = ? AND id = ?').run(companyId, lossId);
  return listFiscalLossesRepo(companyId, userId);
}

export function getAnnualTaxInputsRepo(companyId: string, ejercicio: number): AnnualTaxInputs {
  ensureAnnualAndInventoryTables(db);
  const row = db
    .query('SELECT * FROM annual_tax_snapshots WHERE company_id = ? AND ejercicio = ?')
    .get(companyId, ejercicio) as AnnualSnapshotDbRow | null;
  if (row) return mapSnapshotRow(row);
  const defaults = resolveAnnualInpcPair(ejercicio);
  return {
    companyId, ejercicio, inpcCierreAnterior: defaults.inpcCierreAnterior, inpcCierreActual: defaults.inpcCierreActual,
    cucaInicial: 0, aportacionesCapital: 0, reduccionesCapital: 0,
    cufinInicial: 0, dividendosPagados: 0, ptuPagadaAnterior: 0, noDeduciblesManual: 0, deduccionesPersonales: 0
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
  assertPeriodOpen(companyId, ejercicio, 12);
  assertPeriodOpen(companyId, ejercicio, 13);

  const current = getAnnualTaxInputsRepo(companyId, ejercicio);
  const cleanNum = (val: number | undefined, fallback: number) =>
    val !== undefined && Number.isFinite(Number(val)) ? Math.max(0, Number(val)) : fallback;
  const inpcAnt = input.inpcCierreAnterior !== undefined && Number(input.inpcCierreAnterior) > 0 ? Number(input.inpcCierreAnterior) : current.inpcCierreAnterior;
  const inpcAct = input.inpcCierreActual !== undefined && Number(input.inpcCierreActual) > 0 ? Number(input.inpcCierreActual) : current.inpcCierreActual;
  const next: AnnualTaxInputs = {
    companyId, ejercicio, inpcCierreAnterior: inpcAnt, inpcCierreActual: inpcAct,
    cucaInicial: fromCents(toCents(cleanNum(input.cucaInicial, current.cucaInicial))),
    aportacionesCapital: fromCents(toCents(cleanNum(input.aportacionesCapital, current.aportacionesCapital))),
    reduccionesCapital: fromCents(toCents(cleanNum(input.reduccionesCapital, current.reduccionesCapital))),
    cufinInicial: fromCents(toCents(cleanNum(input.cufinInicial, current.cufinInicial))),
    dividendosPagados: fromCents(toCents(cleanNum(input.dividendosPagados, current.dividendosPagados))),
    ptuPagadaAnterior: fromCents(toCents(cleanNum(input.ptuPagadaAnterior, current.ptuPagadaAnterior))),
    noDeduciblesManual: fromCents(toCents(cleanNum(input.noDeduciblesManual, current.noDeduciblesManual))),
    deduccionesPersonales: fromCents(toCents(cleanNum(input.deduccionesPersonales, current.deduccionesPersonales ?? 0)))
  };
  const now = new Date().toISOString();
  const id = `ats_${companyId}_${ejercicio}`;
  db.prepare(`
    INSERT INTO annual_tax_snapshots (
      id, company_id, ejercicio, inpc_cierre_anterior, inpc_cierre_actual,
      cuca_inicial, aportaciones_capital, reducciones_capital,
      cufin_inicial, dividendos_pagados, ptu_pagada_anterior, no_deducibles_manual, deducciones_personales, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, ejercicio) DO UPDATE SET
      inpc_cierre_anterior = excluded.inpc_cierre_anterior, inpc_cierre_actual = excluded.inpc_cierre_actual,
      cuca_inicial = excluded.cuca_inicial, aportaciones_capital = excluded.aportaciones_capital,
      reducciones_capital = excluded.reducciones_capital, cufin_inicial = excluded.cufin_inicial,
      dividendos_pagados = excluded.dividendos_pagados, ptu_pagada_anterior = excluded.ptu_pagada_anterior,
      no_deducibles_manual = excluded.no_deducibles_manual, deducciones_personales = excluded.deducciones_personales,
      updated_at = excluded.updated_at
  `).run(
    id, companyId, ejercicio, next.inpcCierreAnterior, next.inpcCierreActual,
    next.cucaInicial, next.aportacionesCapital, next.reduccionesCapital,
    next.cufinInicial, next.dividendosPagados, next.ptuPagadaAnterior,
    next.noDeduciblesManual, next.deduccionesPersonales ?? 0, now
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
      SELECT m.account_id, m.cargo, m.abono, p.company_id, p.ejercicio, p.periodo, p.origin
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      WHERE p.company_id = ? AND (p.ejercicio <= ? OR (p.ejercicio = ? AND p.periodo = 1))
    `)
    .all(company.id, targetYear, targetYear + 1) as Array<{
      account_id: string; cargo: number; abono: number;
      company_id: string; ejercicio: number; periodo: number; origin?: string | null;
    }>;

  const joinedMovs = rawMovs.map((r) => ({
    account_id: r.account_id, cargo: r.cargo, abono: r.abono,
    polizas: { company_id: r.company_id, ejercicio: r.ejercicio, periodo: r.periodo, origin: r.origin ?? null }
  }));

  const { trialBalance, monthlyBalancesByPeriod } = buildAnnualMonthlyBalancesFromMovements(accounts, joinedMovs, targetYear);
  const assets = (db.query('SELECT * FROM fixed_assets WHERE company_id = ?').all(company.id) as FixedAssetDbRow[]).map(mapFixedAssetRow);
  const fixedAssetsFiscalDeduction = computeAnnualFixedAssetFiscalDeduction(assets, targetYear);
  const taxRows = db
    .query('SELECT periodo, pagos_provisionales_anteriores, perdidas_fiscales_pendientes FROM tax_parameters WHERE company_id = ? AND ejercicio = ? ORDER BY periodo DESC')
    .all(company.id, targetYear) as Array<{ periodo: number; pagos_provisionales_anteriores: number; perdidas_fiscales_pendientes: number }>;
  const taxParams = getTaxParameters(company.id, targetYear);
  const paymentsProvisioned = computeAnnualProvisionalPayments({
    accounts, movs: joinedMovs, ejercicio: targetYear,
    taxParameterRows: taxRows.map((r) => ({ periodo: Number(r.periodo ?? 0), pagosProvisionalesAnteriores: Number(r.pagos_provisionales_anteriores ?? 0) }))
  });
  const inputs = getAnnualTaxInputsRepo(company.id, targetYear);
  const cfdis = getCfdiDocuments(company.id);
  const rules = listAccountingRulesRepo(company.id);
  const lossCarryforwards = listFiscalLossesRepo(company.id, userId);

  const isrFavorIds = new Set(accounts.filter((a) => a.code === '113-02-001' || a.satGroupCode === '113.02').map((a) => a.id));
  let ytdIsrRetCents = 0;
  for (const row of joinedMovs) {
    if (!isrFavorIds.has(row.account_id)) continue;
    if (row.polizas.ejercicio !== targetYear || row.polizas.periodo < 1 || row.polizas.periodo > 12) continue;
    ytdIsrRetCents += Math.max(0, toCents(row.cargo));
  }
  const isrFavorAcc = trialBalance.find((a) => a.code === '113-02-001' || a.satGroupCode === '113.02');
  const isrRetenidoAcreditable = fromCents(Math.max(ytdIsrRetCents, Math.max(0, toCents(isrFavorAcc?.finalBalance ?? 0))));

  return computeAnnualTaxSummary({
    company, ejercicio: targetYear, trialBalance, monthlyBalancesByPeriod,
    fixedAssetsFiscalDeduction, paymentsProvisioned,
    perdidasFiscalesPendientes: taxRows[0]?.perdidas_fiscales_pendientes ?? taxParams.perdidasFiscalesPendientes,
    lossCarryforwards, isrRetenidoAcreditable, inputs, cfdis, rules
  });
}

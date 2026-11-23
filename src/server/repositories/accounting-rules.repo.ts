import { db } from '../connection';
import type { SqliteDdlTarget } from '../db-ddl';
import { assertAccountingInvariant } from '../../shared/engine/invariants-and-math';
import type {
  AccountingRuleDirection,
  AccountingRuleRecord,
  UpsertAccountingRulePayload
} from '../../shared/types/accounting-rules.types';

interface AccountingRuleDbRow {
  id: string;
  company_id: string;
  name: string;
  match_rfc: string | null;
  match_clave_prod_serv: string | null;
  match_uso_cfdi: string | null;
  direction: string;
  operation_account_code: string;
  counter_account_code: string | null;
  deductible_pct: number;
  priority: number;
  auto_learned: number;
  created_at: string;
  updated_at: string;
}

const ACCOUNTING_RULES_DDL = `
  CREATE TABLE IF NOT EXISTS accounting_rules (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    match_rfc TEXT,
    match_clave_prod_serv TEXT,
    match_uso_cfdi TEXT,
    direction TEXT NOT NULL DEFAULT 'RECIBIDO' CHECK (direction IN ('EMITIDO','RECIBIDO')),
    operation_account_code TEXT NOT NULL,
    counter_account_code TEXT,
    deductible_pct REAL NOT NULL DEFAULT 100 CHECK (deductible_pct >= 0 AND deductible_pct <= 100),
    priority INTEGER NOT NULL DEFAULT 10,
    auto_learned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_accounting_rules_company_id
    ON accounting_rules(company_id, priority DESC);
`;

export function ensureAccountingRulesTable(database: SqliteDdlTarget = db): void {
  database.exec(ACCOUNTING_RULES_DDL);
}

function mapAccountingRuleRow(row: AccountingRuleDbRow): AccountingRuleRecord {
  const dir: AccountingRuleDirection =
    row.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO';
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    matchRfc: row.match_rfc ?? null,
    matchClaveProdServ: row.match_clave_prod_serv ?? null,
    matchUsoCfdi: row.match_uso_cfdi ?? null,
    direction: dir,
    operationAccountCode: row.operation_account_code,
    counterAccountCode: row.counter_account_code ?? null,
    deductiblePct: Number(row.deductible_pct ?? 100),
    priority: Number(row.priority ?? 10),
    autoLearned: Boolean(row.auto_learned),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeOptionalUpper(val?: string | null): string | null {
  const clean = val?.trim().toUpperCase() || '';
  return clean.length > 0 ? clean : null;
}

export function listAccountingRulesRepo(companyId: string): AccountingRuleRecord[] {
  ensureAccountingRulesTable(db);
  const rows = db
    .query(
      `SELECT * FROM accounting_rules
       WHERE company_id = ?
       ORDER BY priority DESC, updated_at DESC`
    )
    .all(companyId) as AccountingRuleDbRow[];
  return rows.map(mapAccountingRuleRow);
}

export function upsertAccountingRuleRepo(
  payload: UpsertAccountingRulePayload
): AccountingRuleRecord {
  ensureAccountingRulesTable(db);

  const companyId = payload.companyId?.trim();
  const opCode = payload.operationAccountCode?.trim();
  assertAccountingInvariant(
    Boolean(companyId),
    'INVALID_COMPANY_ID',
    'El identificador de empresa es obligatorio para guardar la regla contable.'
  );
  assertAccountingInvariant(
    Boolean(opCode),
    'INVALID_OPERATION_ACCOUNT',
    'La cuenta operativa contable es obligatoria en la regla.'
  );

  const matchRfc = normalizeOptionalUpper(payload.matchRfc);
  const matchClaveProdServ = normalizeOptionalUpper(payload.matchClaveProdServ);
  const matchUsoCfdi = normalizeOptionalUpper(payload.matchUsoCfdi);
  assertAccountingInvariant(
    Boolean(matchRfc || matchClaveProdServ || matchUsoCfdi),
    'MISSING_RULE_CRITERIA',
    'Debes especificar al menos un criterio: RFC, ClaveProdServ o Uso CFDI.'
  );

  const direction: AccountingRuleDirection =
    payload.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO';
  const rawPct = payload.deductiblePct === undefined ? 100 : Number(payload.deductiblePct);
  assertAccountingInvariant(
    Number.isFinite(rawPct) && rawPct >= 0 && rawPct <= 100,
    'INVALID_DEDUCTIBLE_PCT',
    'El porcentaje deducible debe estar entre 0 y 100.'
  );

  const priority =
    payload.priority !== undefined && Number.isFinite(Number(payload.priority))
      ? Math.round(Number(payload.priority))
      : 10;
  const counterCode = payload.counterAccountCode?.trim() || null;
  const now = new Date().toISOString();

  let targetId = payload.id?.trim() || '';
  if (!targetId) {
    const existingMatch = db
      .query(
        `SELECT id FROM accounting_rules
         WHERE company_id = ?
           AND direction = ?
           AND COALESCE(match_rfc, '') = COALESCE(?, '')
           AND COALESCE(match_clave_prod_serv, '') = COALESCE(?, '')
           AND COALESCE(match_uso_cfdi, '') = COALESCE(?, '')
         LIMIT 1`
      )
      .get(companyId, direction, matchRfc, matchClaveProdServ, matchUsoCfdi) as
      | { id: string }
      | null;
    targetId = existingMatch?.id || `rule_${crypto.randomUUID().slice(0, 12)}`;
  }

  const defaultName =
    payload.name?.trim() ||
    [matchRfc, matchClaveProdServ, matchUsoCfdi].filter(Boolean).join(' · ') ||
    `Regla ${opCode}`;

  db.prepare(`
    INSERT INTO accounting_rules (
      id, company_id, name, match_rfc, match_clave_prod_serv, match_uso_cfdi,
      direction, operation_account_code, counter_account_code,
      deductible_pct, priority, auto_learned, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      match_rfc = excluded.match_rfc,
      match_clave_prod_serv = excluded.match_clave_prod_serv,
      match_uso_cfdi = excluded.match_uso_cfdi,
      direction = excluded.direction,
      operation_account_code = excluded.operation_account_code,
      counter_account_code = excluded.counter_account_code,
      deductible_pct = excluded.deductible_pct,
      priority = excluded.priority,
      auto_learned = excluded.auto_learned,
      updated_at = excluded.updated_at
  `).run(
    targetId,
    companyId,
    defaultName,
    matchRfc,
    matchClaveProdServ,
    matchUsoCfdi,
    direction,
    opCode,
    counterCode,
    rawPct,
    priority,
    payload.autoLearned ? 1 : 0,
    now,
    now
  );

  const saved = db
    .query('SELECT * FROM accounting_rules WHERE id = ? AND company_id = ?')
    .get(targetId, companyId) as AccountingRuleDbRow | null;
  assertAccountingInvariant(
    saved !== null,
    'ACCOUNTING_RULE_SAVE_ERROR',
    'No se pudo recuperar la regla contable guardada.'
  );
  return mapAccountingRuleRow(saved);
}

export function deleteAccountingRuleRepo(
  companyId: string,
  ruleId: string
): { deleted: boolean } {
  ensureAccountingRulesTable(db);
  const res = db
    .prepare('DELETE FROM accounting_rules WHERE id = ? AND company_id = ?')
    .run(ruleId, companyId);
  return { deleted: res.changes > 0 };
}

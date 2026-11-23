import { db } from '../connection';
import { computeCostOfSales } from '../../shared/engine/cost-of-sales.engine';
import type { CompanyBackupBundle } from '../../shared/types';
import type { AccountingRuleDirection, AccountingRuleRecord } from '../../shared/types/accounting-rules.types';
import type { AnnualTaxInputs } from '../../shared/types/annual-tax.types';
import type { BankN1MatchRecord } from '../../shared/types/bank-n1.types';
import type { InventoryMethod, InventoryPeriodRecord } from '../../shared/types/cost-of-sales.types';
import { ensureAccountingRulesTable } from './accounting-rules.repo';
import { ensureAnnualAndInventoryTables } from './annual-tax.repo';
import { ensureBankN1MatchesTable } from './bank-n1.repo';
import { computePurchasesFromTrialBalance } from './inventory.repo';

function sqliteTableExists(tableName: string): boolean {
  const row = db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | null;
  return Boolean(row?.name);
}

export function clearOptionalSqliteBackupTables(companyId: string): void {
  const tables = [
    'bank_statement_matches',
    'accounting_rules',
    'annual_tax_snapshots',
    'inventory_periods'
  ];
  for (const table of tables) {
    if (sqliteTableExists(table)) {
      db.prepare(`DELETE FROM ${table} WHERE company_id = ?`).run(companyId);
    }
  }
}

export function restoreOptionalSqliteBackupTables(
  companyId: string,
  bundle: CompanyBackupBundle
): void {
  if (Array.isArray(bundle.accountingRules) && bundle.accountingRules.length > 0) {
    ensureAccountingRulesTable(db);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO accounting_rules (
        id, company_id, name, match_rfc, match_clave_prod_serv, match_uso_cfdi,
        direction, operation_account_code, counter_account_code, deductible_pct,
        priority, auto_learned, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of bundle.accountingRules) {
      stmt.run(
        r.id,
        companyId,
        r.name || '',
        r.matchRfc ?? null,
        r.matchClaveProdServ ?? null,
        r.matchUsoCfdi ?? null,
        r.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO',
        r.operationAccountCode,
        r.counterAccountCode ?? null,
        Number(r.deductiblePct ?? 100),
        Number(r.priority ?? 10),
        r.autoLearned ? 1 : 0,
        r.createdAt || new Date().toISOString(),
        r.updatedAt || new Date().toISOString()
      );
    }
  }

  if (Array.isArray(bundle.annualTaxSnapshots) && bundle.annualTaxSnapshots.length > 0) {
    ensureAnnualAndInventoryTables(db);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO annual_tax_snapshots (
        id, company_id, ejercicio, inpc_cierre_anterior, inpc_cierre_actual,
        cuca_inicial, aportaciones_capital, reducciones_capital, cufin_inicial,
        dividendos_pagados, ptu_pagada_anterior, no_deducibles_manual, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of bundle.annualTaxSnapshots) {
      stmt.run(
        `ats_${companyId}_${s.ejercicio}`,
        companyId,
        Number(s.ejercicio),
        Number(s.inpcCierreAnterior ?? 139.38),
        Number(s.inpcCierreActual ?? 145.4),
        Number(s.cucaInicial ?? 0),
        Number(s.aportacionesCapital ?? 0),
        Number(s.reduccionesCapital ?? 0),
        Number(s.cufinInicial ?? 0),
        Number(s.dividendosPagados ?? 0),
        Number(s.ptuPagadaAnterior ?? 0),
        Number(s.noDeduciblesManual ?? 0),
        s.updatedAt || new Date().toISOString()
      );
    }
  }

  if (Array.isArray(bundle.inventoryPeriods) && bundle.inventoryPeriods.length > 0) {
    ensureAnnualAndInventoryTables(db);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO inventory_periods (
        id, company_id, ejercicio, periodo, initial_inventory,
        purchases_override, final_inventory, method, poliza_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const inv of bundle.inventoryPeriods) {
      stmt.run(
        inv.id || `inv_${companyId}_${inv.ejercicio}_${inv.periodo}`,
        companyId,
        Number(inv.ejercicio),
        Number(inv.periodo),
        Number(inv.initialInventory ?? 0),
        inv.purchasesOverride ?? null,
        Number(inv.finalInventory ?? 0),
        inv.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO',
        inv.polizaId ?? null,
        inv.updatedAt || new Date().toISOString()
      );
    }
  }

  if (Array.isArray(bundle.bankStatementMatches) && bundle.bankStatementMatches.length > 0) {
    ensureBankN1MatchesTable(db);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO bank_statement_matches (
        id, company_id, bank_line_id, movement_id, poliza_id, matched_amount, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of bundle.bankStatementMatches) {
      stmt.run(
        m.id,
        companyId,
        m.bankLineId,
        m.movementId,
        m.polizaId || '',
        Number(m.matchedAmount ?? 0),
        m.createdAt || new Date().toISOString()
      );
    }
  }
}

export function exportOptionalSqliteBackupTables(companyId: string): {
  accountingRules: AccountingRuleRecord[];
  annualTaxSnapshots: AnnualTaxInputs[];
  inventoryPeriods: InventoryPeriodRecord[];
  bankStatementMatches: BankN1MatchRecord[];
} {
  const accountingRules: AccountingRuleRecord[] = sqliteTableExists('accounting_rules')
    ? (
        db
          .query('SELECT * FROM accounting_rules WHERE company_id = ? ORDER BY priority DESC, id ASC')
          .all(companyId) as Array<Record<string, unknown>>
      ).map((r) => ({
        id: String(r.id),
        companyId: String(r.company_id),
        name: String(r.name ?? ''),
        matchRfc: r.match_rfc ? String(r.match_rfc) : null,
        matchClaveProdServ: r.match_clave_prod_serv ? String(r.match_clave_prod_serv) : null,
        matchUsoCfdi: r.match_uso_cfdi ? String(r.match_uso_cfdi) : null,
        direction: (r.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO') as AccountingRuleDirection,
        operationAccountCode: String(r.operation_account_code ?? ''),
        counterAccountCode: r.counter_account_code ? String(r.counter_account_code) : null,
        deductiblePct: Number(r.deductible_pct ?? 100),
        priority: Number(r.priority ?? 10),
        autoLearned: Boolean(r.auto_learned),
        createdAt: String(r.created_at ?? ''),
        updatedAt: String(r.updated_at ?? '')
      }))
    : [];

  const annualTaxSnapshots: AnnualTaxInputs[] = sqliteTableExists('annual_tax_snapshots')
    ? (
        db
          .query('SELECT * FROM annual_tax_snapshots WHERE company_id = ? ORDER BY ejercicio ASC')
          .all(companyId) as Array<Record<string, unknown>>
      ).map((r) => ({
        companyId: String(r.company_id),
        ejercicio: Number(r.ejercicio),
        inpcCierreAnterior: Number(r.inpc_cierre_anterior ?? 139.38),
        inpcCierreActual: Number(r.inpc_cierre_actual ?? 145.4),
        cucaInicial: Number(r.cuca_inicial ?? 0),
        aportacionesCapital: Number(r.aportaciones_capital ?? 0),
        reduccionesCapital: Number(r.reducciones_capital ?? 0),
        cufinInicial: Number(r.cufin_inicial ?? 0),
        dividendosPagados: Number(r.dividendos_pagados ?? 0),
        ptuPagadaAnterior: Number(r.ptu_pagada_anterior ?? 0),
        noDeduciblesManual: Number(r.no_deducibles_manual ?? 0),
        updatedAt: r.updated_at ? String(r.updated_at) : undefined
      }))
    : [];

  const inventoryPeriods: InventoryPeriodRecord[] = sqliteTableExists('inventory_periods')
    ? (
        db
          .query('SELECT * FROM inventory_periods WHERE company_id = ? ORDER BY ejercicio ASC, periodo ASC')
          .all(companyId) as Array<Record<string, unknown>>
      ).map((r) => {
        const ejercicio = Number(r.ejercicio);
        const periodo = Number(r.periodo);
        const initialInventory = Number(r.initial_inventory ?? 0);
        const purchasesOverride =
          r.purchases_override !== null && r.purchases_override !== undefined
            ? Number(r.purchases_override)
            : null;
        const purchasesFromBalance = computePurchasesFromTrialBalance(companyId, ejercicio, periodo);
        const effectivePurchases = purchasesOverride !== null ? purchasesOverride : purchasesFromBalance;
        const finalInventory = Number(r.final_inventory ?? 0);
        const computed = computeCostOfSales({ initialInventory, purchasesPeriod: effectivePurchases, finalInventory });
        const method: InventoryMethod = r.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO';
        return {
          id: String(r.id),
          companyId: String(r.company_id),
          ejercicio,
          periodo,
          initialInventory: computed.initialInventory,
          purchasesFromBalance,
          purchasesOverride,
          effectivePurchases: computed.purchasesPeriod,
          finalInventory: computed.finalInventory,
          costOfSales: computed.costOfSales,
          method,
          polizaId: r.poliza_id ? String(r.poliza_id) : null,
          updatedAt: r.updated_at ? String(r.updated_at) : undefined
        };
      })
    : [];

  const bankStatementMatches: BankN1MatchRecord[] = sqliteTableExists('bank_statement_matches')
    ? (
        db
          .query('SELECT * FROM bank_statement_matches WHERE company_id = ? ORDER BY created_at DESC, id ASC')
          .all(companyId) as Array<Record<string, unknown>>
      ).map((r) => ({
        id: String(r.id),
        companyId: String(r.company_id),
        bankLineId: String(r.bank_line_id),
        movementId: String(r.movement_id),
        polizaId: String(r.poliza_id ?? ''),
        matchedAmount: Number(r.matched_amount ?? 0),
        createdAt: String(r.created_at ?? '')
      }))
    : [];

  return { accountingRules, annualTaxSnapshots, inventoryPeriods, bankStatementMatches };
}

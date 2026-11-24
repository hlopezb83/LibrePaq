import { db } from '../connection';
import { computeCostOfSales } from '../../shared/engine/cost-of-sales.engine';
import type { AccountingRuleDirection, AccountingRuleRecord } from '../../shared/types/accounting-rules.types';
import type { AnnualTaxInputs } from '../../shared/types/annual-tax.types';
import type { BankN1MatchRecord } from '../../shared/types/bank-n1.types';
import type { InventoryMethod, InventoryPeriodRecord } from '../../shared/types/cost-of-sales.types';
import { ensureAccountingRulesTable } from './accounting-rules.repo';
import { ensureAnnualAndInventoryTables } from './annual-tax.repo';
import { ensureBankN1MatchesTable } from './bank-n1.repo';
import { computePurchasesFromTrialBalance } from './inventory.repo';
import {
  assertNoCrossTenantRowId,
  ensureExtendedSqliteBackupTables,
  sqliteTableExists,
  type SqliteExtendedBackupBundle
} from './backup-restore-helpers.repo';

export type { SqliteExtendedBackupBundle };

export function clearOptionalSqliteBackupTables(companyId: string): void {
  const tables = [
    'bank_statement_matches',
    'bank_reconciliation_closures',
    'despacho_deliverable_branding',
    'poliza_cfdis',
    'payroll_period_settings',
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
  bundle: SqliteExtendedBackupBundle
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
      assertNoCrossTenantRowId('accounting_rules', r.id, companyId);
      stmt.run(
        r.id, companyId, r.name || '', r.matchRfc ?? null, r.matchClaveProdServ ?? null, r.matchUsoCfdi ?? null,
        r.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO', r.operationAccountCode, r.counterAccountCode ?? null,
        Number(r.deductiblePct ?? 100), Number(r.priority ?? 10), r.autoLearned ? 1 : 0,
        r.createdAt || new Date().toISOString(), r.updatedAt || new Date().toISOString()
      );
    }
  }

  if (Array.isArray(bundle.annualTaxSnapshots) && bundle.annualTaxSnapshots.length > 0) {
    ensureAnnualAndInventoryTables(db);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO annual_tax_snapshots (
        id, company_id, ejercicio, inpc_cierre_anterior, inpc_cierre_actual,
        cuca_inicial, aportaciones_capital, reducciones_capital, cufin_inicial,
        dividendos_pagados, ptu_pagada_anterior, no_deducibles_manual, deducciones_personales, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of bundle.annualTaxSnapshots) {
      stmt.run(
        `ats_${companyId}_${s.ejercicio}`, companyId, Number(s.ejercicio),
        Number(s.inpcCierreAnterior ?? 139.38), Number(s.inpcCierreActual ?? 145.4),
        Number(s.cucaInicial ?? 0), Number(s.aportacionesCapital ?? 0), Number(s.reduccionesCapital ?? 0),
        Number(s.cufinInicial ?? 0), Number(s.dividendosPagados ?? 0), Number(s.ptuPagadaAnterior ?? 0),
        Number(s.noDeduciblesManual ?? 0), Number(s.deduccionesPersonales ?? 0), s.updatedAt || new Date().toISOString()
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
      const invId = inv.id || `inv_${companyId}_${inv.ejercicio}_${inv.periodo}`;
      assertNoCrossTenantRowId('inventory_periods', invId, companyId);
      stmt.run(
        invId, companyId, Number(inv.ejercicio), Number(inv.periodo),
        Number(inv.initialInventory ?? 0), inv.purchasesOverride ?? null, Number(inv.finalInventory ?? 0),
        inv.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO', inv.polizaId ?? null, inv.updatedAt || new Date().toISOString()
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
      assertNoCrossTenantRowId('bank_statement_matches', m.id, companyId);
      stmt.run(m.id, companyId, m.bankLineId, m.movementId, m.polizaId || '', Number(m.matchedAmount ?? 0), m.createdAt || new Date().toISOString());
    }
  }

  if (Array.isArray(bundle.payrollPeriodSettings) && bundle.payrollPeriodSettings.length > 0 && sqliteTableExists('payroll_period_settings')) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO payroll_period_settings (
        company_id, ejercicio, periodo, state_code, isn_rate, imss_patronal, rcv, infonavit, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const ps of bundle.payrollPeriodSettings) {
      stmt.run(
        companyId, Number(ps.ejercicio), Number(ps.periodo), ps.stateCode || 'CMX',
        Number(ps.isnRate ?? 4.0), Number(ps.imssPatronal ?? 0), Number(ps.rcv ?? 0),
        Number(ps.infonavit ?? 0), ps.updatedAt || new Date().toISOString()
      );
    }
  }

  if (Array.isArray(bundle.polizaCfdis) && bundle.polizaCfdis.length > 0 && sqliteTableExists('poliza_cfdis')) {
    const polIds = new Set((bundle.polizas || []).map((p) => p.id));
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO poliza_cfdis (id, company_id, poliza_id, cfdi_uuid, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const pc of bundle.polizaCfdis) {
      if (!pc.polizaId || !pc.cfdiUuid || (polIds.size > 0 && !polIds.has(pc.polizaId))) continue;
      assertNoCrossTenantRowId('poliza_cfdis', pc.id, companyId);
      stmt.run(pc.id, companyId, pc.polizaId, pc.cfdiUuid.trim().toUpperCase(), pc.createdAt || new Date().toISOString());
    }
  }

  if (Array.isArray(bundle.bankReconciliationClosures) && bundle.bankReconciliationClosures.length > 0) {
    ensureExtendedSqliteBackupTables();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO bank_reconciliation_closures (
        id, company_id, account_id, ejercicio, periodo, saldo_banco_cierre, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of bundle.bankReconciliationClosures) {
      const cId = c.id || `bclose_${companyId}_${c.accountId}_${c.ejercicio}_${c.periodo}`;
      assertNoCrossTenantRowId('bank_reconciliation_closures', cId, companyId);
      stmt.run(cId, companyId, c.accountId, Number(c.ejercicio), Number(c.periodo), Number(c.saldoBancoCierre ?? 0), c.updatedAt || new Date().toISOString());
    }
  }

  if (Array.isArray(bundle.deliverableBranding) && bundle.deliverableBranding.length > 0) {
    ensureExtendedSqliteBackupTables();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO despacho_deliverable_branding (
        id, scope_key, company_id, organization_id, firm_name, auditor_name, auditor_cedula,
        preparer_name, legal_rep_name, legal_rep_title, issuance_city, logo_data_url, notes_text, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const b of bundle.deliverableBranding) {
      const bId = b.id || `brand_${companyId}`;
      assertNoCrossTenantRowId('despacho_deliverable_branding', bId, companyId);
      stmt.run(
        bId, `comp_${companyId}`, companyId, b.organizationId ?? null,
        b.firmName || '', b.auditorName || '', b.auditorCedula || '',
        b.preparerName || 'Auxiliar Contable', b.legalRepName || '', b.legalRepTitle || 'Representante Legal',
        b.issuanceCity || 'Ciudad de México', b.logoDataUrl ?? null, b.notesText || '', b.updatedAt || new Date().toISOString()
      );
    }
  }
}

export function exportOptionalSqliteBackupTables(companyId: string): {
  accountingRules: AccountingRuleRecord[];
  annualTaxSnapshots: AnnualTaxInputs[];
  inventoryPeriods: InventoryPeriodRecord[];
  bankStatementMatches: BankN1MatchRecord[];
  payrollPeriodSettings: NonNullable<SqliteExtendedBackupBundle['payrollPeriodSettings']>;
  polizaCfdis: NonNullable<SqliteExtendedBackupBundle['polizaCfdis']>;
  bankReconciliationClosures: NonNullable<SqliteExtendedBackupBundle['bankReconciliationClosures']>;
  deliverableBranding: NonNullable<SqliteExtendedBackupBundle['deliverableBranding']>;
} {
  const accountingRules: AccountingRuleRecord[] = sqliteTableExists('accounting_rules')
    ? (db.query('SELECT * FROM accounting_rules WHERE company_id = ? ORDER BY priority DESC, id ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id), companyId: String(r.company_id), name: String(r.name ?? ''),
        matchRfc: r.match_rfc ? String(r.match_rfc) : null,
        matchClaveProdServ: r.match_clave_prod_serv ? String(r.match_clave_prod_serv) : null,
        matchUsoCfdi: r.match_uso_cfdi ? String(r.match_uso_cfdi) : null,
        direction: (r.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO') as AccountingRuleDirection,
        operationAccountCode: String(r.operation_account_code ?? ''),
        counterAccountCode: r.counter_account_code ? String(r.counter_account_code) : null,
        deductiblePct: Number(r.deductible_pct ?? 100), priority: Number(r.priority ?? 10),
        autoLearned: Boolean(r.auto_learned), createdAt: String(r.created_at ?? ''), updatedAt: String(r.updated_at ?? '')
      }))
    : [];

  const annualTaxSnapshots: AnnualTaxInputs[] = sqliteTableExists('annual_tax_snapshots')
    ? (db.query('SELECT * FROM annual_tax_snapshots WHERE company_id = ? ORDER BY ejercicio ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        companyId: String(r.company_id), ejercicio: Number(r.ejercicio),
        inpcCierreAnterior: Number(r.inpc_cierre_anterior ?? 139.38), inpcCierreActual: Number(r.inpc_cierre_actual ?? 145.4),
        cucaInicial: Number(r.cuca_inicial ?? 0), aportacionesCapital: Number(r.aportaciones_capital ?? 0),
        reduccionesCapital: Number(r.reducciones_capital ?? 0), cufinInicial: Number(r.cufin_inicial ?? 0),
        dividendosPagados: Number(r.dividendos_pagados ?? 0), ptuPagadaAnterior: Number(r.ptu_pagada_anterior ?? 0),
        noDeduciblesManual: Number(r.no_deducibles_manual ?? 0), deduccionesPersonales: Number(r.deducciones_personales ?? 0),
        updatedAt: r.updated_at ? String(r.updated_at) : undefined
      }))
    : [];

  const inventoryPeriods: InventoryPeriodRecord[] = sqliteTableExists('inventory_periods')
    ? (db.query('SELECT * FROM inventory_periods WHERE company_id = ? ORDER BY ejercicio ASC, periodo ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => {
        const ejercicio = Number(r.ejercicio), periodo = Number(r.periodo);
        const initialInventory = Number(r.initial_inventory ?? 0);
        const purchasesOverride = r.purchases_override !== null && r.purchases_override !== undefined ? Number(r.purchases_override) : null;
        const purchasesFromBalance = computePurchasesFromTrialBalance(companyId, ejercicio, periodo);
        const effectivePurchases = purchasesOverride !== null ? purchasesOverride : purchasesFromBalance;
        const finalInventory = Number(r.final_inventory ?? 0);
        const computed = computeCostOfSales({ initialInventory, purchasesPeriod: effectivePurchases, finalInventory });
        const method: InventoryMethod = r.method === 'PERPETUO' ? 'PERPETUO' : 'ANALITICO';
        return {
          id: String(r.id), companyId: String(r.company_id), ejercicio, periodo,
          initialInventory: computed.initialInventory, purchasesFromBalance, purchasesOverride,
          effectivePurchases: computed.purchasesPeriod, finalInventory: computed.finalInventory,
          costOfSales: computed.costOfSales, method, polizaId: r.poliza_id ? String(r.poliza_id) : null,
          updatedAt: r.updated_at ? String(r.updated_at) : undefined
        };
      })
    : [];

  const bankStatementMatches: BankN1MatchRecord[] = sqliteTableExists('bank_statement_matches')
    ? (db.query('SELECT * FROM bank_statement_matches WHERE company_id = ? ORDER BY created_at DESC, id ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id), companyId: String(r.company_id), bankLineId: String(r.bank_line_id),
        movementId: String(r.movement_id), polizaId: String(r.poliza_id ?? ''),
        matchedAmount: Number(r.matched_amount ?? 0), createdAt: String(r.created_at ?? '')
      }))
    : [];

  const payrollPeriodSettings = sqliteTableExists('payroll_period_settings')
    ? (db.query('SELECT * FROM payroll_period_settings WHERE company_id = ? ORDER BY ejercicio ASC, periodo ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        companyId: String(r.company_id), ejercicio: Number(r.ejercicio), periodo: Number(r.periodo),
        stateCode: String(r.state_code ?? 'CMX'), isnRate: Number(r.isn_rate ?? 4.0),
        imssPatronal: Number(r.imss_patronal ?? 0), rcv: Number(r.rcv ?? 0),
        infonavit: Number(r.infonavit ?? 0), updatedAt: r.updated_at ? String(r.updated_at) : undefined
      }))
    : [];

  const polizaCfdis = sqliteTableExists('poliza_cfdis')
    ? (db.query('SELECT * FROM poliza_cfdis WHERE company_id = ? ORDER BY id ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id), companyId: String(r.company_id), polizaId: String(r.poliza_id),
        cfdiUuid: String(r.cfdi_uuid), createdAt: r.created_at ? String(r.created_at) : undefined
      }))
    : [];

  const bankReconciliationClosures = sqliteTableExists('bank_reconciliation_closures')
    ? (db.query('SELECT * FROM bank_reconciliation_closures WHERE company_id = ? ORDER BY ejercicio ASC, periodo ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id), companyId: String(r.company_id), accountId: String(r.account_id),
        ejercicio: Number(r.ejercicio), periodo: Number(r.periodo),
        saldoBancoCierre: Number(r.saldo_banco_cierre ?? 0), updatedAt: r.updated_at ? String(r.updated_at) : undefined
      }))
    : [];

  const deliverableBranding = sqliteTableExists('despacho_deliverable_branding')
    ? (db.query('SELECT * FROM despacho_deliverable_branding WHERE company_id = ? ORDER BY id ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id), scopeKey: String(r.scope_key ?? `comp_${companyId}`),
        companyId: r.company_id ? String(r.company_id) : companyId,
        organizationId: r.organization_id ? String(r.organization_id) : null,
        firmName: String(r.firm_name ?? ''), preparerName: String(r.preparer_name ?? 'Auxiliar Contable'),
        auditorName: String(r.auditor_name ?? ''), auditorCedula: String(r.auditor_cedula ?? ''),
        legalRepName: String(r.legal_rep_name ?? ''), legalRepTitle: String(r.legal_rep_title ?? 'Representante Legal'),
        issuanceCity: String(r.issuance_city ?? 'Ciudad de México'),
        logoDataUrl: r.logo_data_url ? String(r.logo_data_url) : null,
        notesText: String(r.notes_text ?? ''), updatedAt: r.updated_at ? String(r.updated_at) : undefined
      }))
    : [];

  return {
    accountingRules,
    annualTaxSnapshots,
    inventoryPeriods,
    bankStatementMatches,
    payrollPeriodSettings,
    polizaCfdis,
    bankReconciliationClosures,
    deliverableBranding
  };
}

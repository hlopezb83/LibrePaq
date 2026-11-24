import {
  computeCxcCxpAging,
  computeFiscalWorkpaperFromTrialBalance,
  computeFixedAssetWithDepreciation,
  fromCents,
  toCents
} from '../../shared/accounting-engine';
import {
  buildAnnualMonthlyBalancesFromMovements,
  computeAnnualFixedAssetFiscalDeduction
} from '../../shared/engine/annual-tax-balances.helper';
import { computeAnnualTaxSummary, resolveAnnualInpcPair } from '../../shared/engine/annual-tax.engine';
import { applyDemoBankN1Matches, proposeDemoBankN1Matches } from './guest-demo-n1';
import { computeCostOfSales } from '../../shared/engine/cost-of-sales.engine';
import { computeDiotReportData } from '../../shared/engine/diot.engine';
import { computeFinancialStatementsData } from '../../shared/engine/financial-reports.engine';
import type { AnnualTaxInputs } from '../../shared/types/annual-tax.types';
import type {
  BankN1ApplyItem,
  BankN1ApplyResponse,
  BankN1MatchProposal,
  BankN1ProposeResponse
} from '../../shared/types/bank-n1.types';
import type { AccountingRuleDirection, AccountingRuleRecord, UpsertAccountingRulePayload } from '../../shared/types/accounting-rules.types';
import type { InventoryPeriodRecord } from '../../shared/types/cost-of-sales.types';
import type {
  BankReconciliationResponse,
  CompanyBackupBundle,
  PeriodLock,
  TaxParametersRecord,
  ThirdPartyRecord
} from '../../shared/types';
import { getGuestDemoState } from './guest-demo-store';

function getComp(companyId: string) {
  const s = getGuestDemoState();
  const comp = (companyId ? s.companies.find((c) => c.id === companyId) : s.companies[0]) ?? s.companies[0];
  if (!comp) throw new Error('Empresa demo no encontrada');
  return comp;
}

function computeDemoTrialBalance(comp: ReturnType<typeof getComp>, y: number, p: number) {
  const s = getGuestDemoState();
  const accs = s.accounts
    .filter((a) => a.companyId === comp.id)
    .map((a) => ({
      ...a,
      initialBalanceComputed: a.initialBalance,
      periodCharges: 0,
      periodCredits: 0,
      finalBalance: a.initialBalance
    }));
  const movs = s.polizas
    .filter((pol) => pol.companyId === comp.id)
    .flatMap((pol) =>
      pol.movements.map((m) => ({
        account_id: m.accountId,
        cargo: m.cargo,
        abono: m.abono,
        polizas: { company_id: pol.companyId, ejercicio: pol.ejercicio, periodo: pol.periodo }
      }))
    );
  return computeFinancialStatementsData(comp, accs, movs, y, p).trialBalance;
}

export const guestDemoExtras = {
  async getActiveBroadcast() {
    return null;
  },

  async getTaxParameters(companyId: string, ejercicio: number, periodo = 0): Promise<TaxParametersRecord> {
    const s = getGuestDemoState();
    const row = s.taxParameters.find((t) => t.companyId === companyId && t.ejercicio === ejercicio && (t.periodo ?? 0) === periodo)
      ?? s.taxParameters.find((t) => t.companyId === companyId && t.ejercicio === ejercicio && (t.periodo ?? 0) === 0);
    return row ?? { companyId, ejercicio, periodo, coeficienteUtilidad: 0, perdidasFiscalesPendientes: 0, pagosProvisionalesAnteriores: 0, saldoFavorIvaAnterior: 0, tipoCambioDofCierre: 0 };
  },

  async saveTaxParameters(payload: TaxParametersRecord): Promise<TaxParametersRecord> {
    const s = getGuestDemoState();
    const p = payload.periodo ?? 0;
    s.taxParameters = s.taxParameters.filter((t) => !(t.companyId === payload.companyId && t.ejercicio === payload.ejercicio && (t.periodo ?? 0) === p));
    const saved = { ...payload, periodo: p };
    s.taxParameters.push(saved);
    return saved;
  },

  async getFiscalWorkpaper(companyId: string, year?: number, period?: number) {
    const s = getGuestDemoState();
    const comp = getComp(companyId);
    const y = year || comp.currentYear;
    const p = period || comp.currentPeriod;
    const params = await this.getTaxParameters(comp.id, y, p);
    const trialBalance = computeDemoTrialBalance(comp, y, p);
    return computeFiscalWorkpaperFromTrialBalance({
      company: comp, ejercicio: y, periodo: p, parameters: params,
      trialBalance, cfdis: s.cfdis.filter((c) => c.companyId === comp.id)
    });
  },

  async getDiotReport(companyId: string, year?: number, period?: number) {
    const s = getGuestDemoState();
    const comp = getComp(companyId);
    const y = year || comp.currentYear;
    const p = period || comp.currentPeriod;
    const trialBalance = computeDemoTrialBalance(comp, y, p);
    return computeDiotReportData({
      company: comp, ejercicio: y, periodo: p,
      cfdis: s.cfdis.filter((c) => c.companyId === comp.id),
      polizaIdsInPeriod: new Set(s.polizas.filter((pol) => pol.companyId === comp.id && pol.ejercicio === y && pol.periodo === p).map((pol) => pol.id)),
      trialBalance,
      thirdParties: s.thirdParties.filter((t) => t.companyId === comp.id)
    });
  },

  async getCxcCxpAging(companyId: string, asOfIso?: string) {
    return computeCxcCxpAging({
      companyId,
      cfdis: getGuestDemoState().cfdis.filter((c) => c.companyId === companyId),
      asOfIso
    });
  },

  async getPeriodLock(companyId: string, year?: number, period?: number): Promise<PeriodLock> {
    const s = getGuestDemoState();
    const y = year || 2026;
    const p = period || 1;
    return s.periodLocks.find((l) => l.companyId === companyId && l.ejercicio === y && l.periodo === p)
      ?? { companyId, ejercicio: y, periodo: p, isLocked: false, lockedAt: null, notes: '' };
  },

  async setPeriodLock(payload: { companyId: string; ejercicio: number; periodo: number; isLocked: boolean; notes?: string }): Promise<PeriodLock> {
    const s = getGuestDemoState();
    s.periodLocks = s.periodLocks.filter((l) => !(l.companyId === payload.companyId && l.ejercicio === payload.ejercicio && l.periodo === payload.periodo));
    const lock: PeriodLock = { companyId: payload.companyId, ejercicio: payload.ejercicio, periodo: payload.periodo, isLocked: payload.isLocked, lockedAt: payload.isLocked ? new Date().toISOString() : null, notes: payload.notes || '' };
    s.periodLocks.push(lock);
    return lock;
  },

  async getBankReconciliation(companyId: string, accountId?: string, year?: number, period?: number): Promise<BankReconciliationResponse> {
    const s = getGuestDemoState();
    const comp = getComp(companyId);
    const y = year || comp.currentYear;
    const p = period || comp.currentPeriod;
    const bankAcc = s.accounts.find((a) => a.companyId === comp.id && a.id === accountId) || s.accounts.find((a) => a.companyId === comp.id && a.code.startsWith('102') && a.isAffectable)!;
    const trialBalance = computeDemoTrialBalance(comp, y, p);
    const resolvedBankAcc = trialBalance.find((a) => a.id === bankAcc.id) ?? {
      ...bankAcc, initialBalanceComputed: 0, periodCharges: 0, periodCredits: 0, finalBalance: 0
    };
    const lines = s.bankLines.filter((l) => l.companyId === comp.id && l.accountId === bankAcc.id && l.ejercicio === y && l.periodo === p);
    const matchedIds = new Set(s.bankMatches.map((m) => m.movementId));
    const bookMovements = s.polizas.filter((pol) => pol.companyId === comp.id && pol.ejercicio === y && pol.periodo === p)
      .flatMap((pol) => pol.movements.filter((m) => m.accountId === bankAcc.id || m.accountCode === bankAcc.code).map((m) => ({
        movementId: m.id, polizaId: pol.id, polizaFolio: `${pol.tipo.slice(0, 3)}-${pol.folio}`, fecha: pol.fecha,
        referencia: m.referencia, concepto: m.concepto, cargoContable: m.cargo, abonoContable: m.abono,
        isMatched: matchedIds.has(m.id) || lines.some((l) => l.matchedMovementId === m.id)
      })));
    return {
      account: resolvedBankAcc,
      ejercicio: y, periodo: p, statementLines: lines, bookMovements,
      summary: {
        saldoInicialLibros: resolvedBankAcc.initialBalanceComputed,
        saldoFinalLibros: resolvedBankAcc.finalBalance,
        totalDepositosBanco: fromCents(lines.reduce((acc, l) => acc + toCents(l.abonoBanco), 0)),
        totalRetirosBanco: fromCents(lines.reduce((acc, l) => acc + toCents(l.cargoBanco), 0)),
        movimientosConciliados: lines.filter((l) => l.matchedMovementId).length,
        movimientosPendientesBanco: lines.filter((l) => !l.matchedMovementId).length,
        movimientosPendientesLibros: bookMovements.filter((b) => !b.isMatched).length
      }
    };
  },

  async getThirdParties(companyId: string): Promise<ThirdPartyRecord[]> {
    return getGuestDemoState().thirdParties.filter((t) => t.companyId === companyId);
  },

  async getFixedAssets(companyId: string) {
    const assets = getGuestDemoState().fixedAssets.filter((a) => a.companyId === companyId).map((a) => computeFixedAssetWithDepreciation(a));
    return {
      assets,
      totals: {
        totalMoi: fromCents(assets.reduce((s, a) => s + toCents(a.montoOriginalInversion), 0)),
        totalDepreciacionMensualContable: fromCents(assets.reduce((s, a) => s + toCents(a.depreciacionMensualContable), 0)),
        totalDepreciacionMensualFiscal: fromCents(assets.reduce((s, a) => s + toCents(a.depreciacionMensualFiscalActualizada), 0)),
        totalDepreciacionAcumulada: fromCents(assets.reduce((s, a) => s + toCents(a.depreciacionAcumuladaTotal), 0)),
        totalValorNetoEnLibros: fromCents(assets.reduce((s, a) => s + toCents(a.valorNetoEnLibros), 0))
      }
    };
  },

  async getFielStatus(companyId: string) {
    return { companyId, hasCredentials: false, credential: null };
  },

  async getSatDownloadRequests() {
    return [];
  },

  async listAccountingRules(companyId: string): Promise<AccountingRuleRecord[]> {
    return getGuestDemoState().accountingRules.filter((r) => r.companyId === companyId);
  },

  async upsertAccountingRule(payload: UpsertAccountingRulePayload): Promise<AccountingRuleRecord> {
    const s = getGuestDemoState();
    const now = new Date().toISOString();
    const dir: AccountingRuleDirection = payload.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO';
    const rule: AccountingRuleRecord = {
      id: payload.id || `rule_${crypto.randomUUID().slice(0, 8)}`,
      companyId: payload.companyId, name: payload.name || payload.operationAccountCode,
      matchRfc: payload.matchRfc ?? null, matchClaveProdServ: payload.matchClaveProdServ ?? null,
      matchUsoCfdi: payload.matchUsoCfdi ?? null, direction: dir,
      operationAccountCode: payload.operationAccountCode, counterAccountCode: payload.counterAccountCode ?? null,
      deductiblePct: payload.deductiblePct ?? 100, priority: payload.priority ?? 10,
      autoLearned: Boolean(payload.autoLearned), createdAt: now, updatedAt: now
    };
    s.accountingRules = [...s.accountingRules.filter((r) => r.id !== rule.id), rule];
    return rule;
  },

  async deleteAccountingRule(companyId: string, ruleId: string) {
    const s = getGuestDemoState();
    s.accountingRules = s.accountingRules.filter((r) => !(r.companyId === companyId && r.id === ruleId));
    return { deleted: true };
  },

  async getAnnualTaxSummary(companyId: string, ejercicio?: number) {
    const s = getGuestDemoState();
    const comp = getComp(companyId);
    const y = ejercicio || comp.currentYear;
    const accs = s.accounts.filter((a) => a.companyId === comp.id).map((a) => ({ ...a, initialBalanceComputed: a.initialBalance, periodCharges: 0, periodCredits: 0, finalBalance: a.initialBalance }));
    const movs = s.polizas.filter((pol) => pol.companyId === comp.id && pol.ejercicio <= y).flatMap((pol) =>
      pol.movements.map((m) => ({ account_id: m.accountId, cargo: m.cargo, abono: m.abono, polizas: { company_id: pol.companyId, ejercicio: pol.ejercicio, periodo: pol.periodo } }))
    );
    const { trialBalance, monthlyBalancesByPeriod } = buildAnnualMonthlyBalancesFromMovements(accs, movs, y);
    const pair = resolveAnnualInpcPair(y);
    const inputs: AnnualTaxInputs = s.annualSnapshots.find((sn) => sn.companyId === comp.id && sn.ejercicio === y) ?? {
      companyId: comp.id, ejercicio: y, ...pair,
      cucaInicial: 0, aportacionesCapital: 0, reduccionesCapital: 0,
      cufinInicial: 0, dividendosPagados: 0, ptuPagadaAnterior: 0, noDeduciblesManual: 0
    };
    return computeAnnualTaxSummary({
      company: comp, ejercicio: y, trialBalance, monthlyBalancesByPeriod,
      fixedAssetsFiscalDeduction: computeAnnualFixedAssetFiscalDeduction(s.fixedAssets.filter((fa) => fa.companyId === comp.id), y),
      paymentsProvisioned: 0, perdidasFiscalesPendientes: 0, isrRetenidoAcreditable: 0, inputs
    });
  },

  async saveAnnualTaxInputs(companyId: string, payload: AnnualTaxInputs) {
    const s = getGuestDemoState();
    s.annualSnapshots = [...s.annualSnapshots.filter((sn) => !(sn.companyId === companyId && sn.ejercicio === payload.ejercicio)), payload];
    return this.getAnnualTaxSummary(companyId, payload.ejercicio);
  },

  async getInventoryPeriod(companyId: string, ejercicio?: number, periodo?: number): Promise<InventoryPeriodRecord> {
    const s = getGuestDemoState();
    const comp = getComp(companyId);
    const y = ejercicio || comp.currentYear;
    const p = periodo || comp.currentPeriod;
    const found = s.inventoryPeriods.find((ip) => ip.companyId === comp.id && ip.ejercicio === y && ip.periodo === p);
    const base = {
      id: found?.id ?? `inv_${comp.id}_${y}_${p}`,
      companyId: comp.id, ejercicio: y, periodo: p,
      initialInventory: found?.initialInventory ?? 0,
      purchasesOverride: found?.purchasesOverride ?? null,
      finalInventory: found?.finalInventory ?? 0,
      method: found?.method ?? ('ANALITICO' as const),
      polizaId: found?.polizaId ?? null
    };
    const computed = computeCostOfSales({ initialInventory: base.initialInventory, purchasesPeriod: base.purchasesOverride ?? 0, finalInventory: base.finalInventory });
    return { ...base, purchasesFromBalance: 0, effectivePurchases: computed.purchasesPeriod, costOfSales: computed.costOfSales, updatedAt: found?.updatedAt };
  },

  async saveInventoryPeriod(companyId: string, payload: Partial<InventoryPeriodRecord>): Promise<InventoryPeriodRecord> {
    const s = getGuestDemoState();
    const comp = getComp(companyId);
    const y = payload.ejercicio || comp.currentYear;
    const p = payload.periodo || comp.currentPeriod;
    const initInv = Number(payload.initialInventory ?? 0);
    const finInv = Number(payload.finalInventory ?? 0);
    const ov = payload.purchasesOverride ?? null;
    const computed = computeCostOfSales({ initialInventory: initInv, purchasesPeriod: ov ?? 0, finalInventory: finInv });
    const rec: InventoryPeriodRecord = {
      id: `inv_${companyId}_${y}_${p}`, companyId, ejercicio: y, periodo: p,
      initialInventory: initInv, purchasesFromBalance: 0, purchasesOverride: ov,
      effectivePurchases: computed.purchasesPeriod, finalInventory: finInv,
      costOfSales: computed.costOfSales, method: payload.method || 'ANALITICO',
      polizaId: payload.polizaId ?? null, updatedAt: new Date().toISOString()
    };
    s.inventoryPeriods = [...s.inventoryPeriods.filter((ip) => !(ip.companyId === companyId && ip.ejercicio === y && ip.periodo === p)), rec];
    return rec;
  },

  async proposeBankN1Matches(
    companyId: string,
    accountId: string,
    year?: number,
    period?: number,
    maxGroupSize = 5,
    toleranceCents = 5
  ): Promise<BankN1ProposeResponse> {
    const recon = await this.getBankReconciliation(companyId, accountId, year, period);
    return proposeDemoBankN1Matches(companyId, recon, maxGroupSize, toleranceCents);
  },

  async applyBankN1Matches(
    companyId: string,
    accountId: string,
    items: ReadonlyArray<BankN1ApplyItem | BankN1MatchProposal>,
    year?: number,
    period?: number
  ): Promise<BankN1ApplyResponse> {
    const recon = await this.getBankReconciliation(companyId, accountId, year, period);
    const applied = applyDemoBankN1Matches(companyId, recon, items);
    const updatedRecon = await this.getBankReconciliation(companyId, accountId, year, period);
    return { ...applied, reconciliation: updatedRecon };
  },

  async exportCompanyBackup(companyId: string): Promise<CompanyBackupBundle> {
    const s = getGuestDemoState();
    const company = getComp(companyId);
    return {
      version: '2.0', exportedAt: new Date().toISOString(), company,
      accounts: s.accounts.filter((a) => a.companyId === company.id),
      cfdis: s.cfdis.filter((c) => c.companyId === company.id),
      polizas: s.polizas.filter((p) => p.companyId === company.id),
      thirdParties: s.thirdParties.filter((t) => t.companyId === company.id),
      fixedAssets: s.fixedAssets.filter((f) => f.companyId === company.id),
      periodLocks: s.periodLocks.filter((l) => l.companyId === company.id),
      taxParameters: s.taxParameters.filter((t) => t.companyId === company.id),
      bankStatementLines: s.bankLines.filter((b) => b.companyId === company.id),
      accountingRules: s.accountingRules.filter((r) => r.companyId === company.id),
      annualTaxSnapshots: s.annualSnapshots.filter((sn) => sn.companyId === company.id),
      inventoryPeriods: s.inventoryPeriods.filter((ip) => ip.companyId === company.id),
      bankStatementMatches: s.bankMatches.filter((bm) => bm.companyId === company.id)
    };
  }
};

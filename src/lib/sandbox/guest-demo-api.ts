import { fromCents, toCents, validateAccountHierarchy } from '../../shared/accounting-engine';
import { buildDashboardKpisFromTrialBalance, buildMonthlyTrendFromPolizas } from '../../shared/engine/dashboard.engine';
import { computeFinancialStatementsData, type JoinedPolizaMovementInput } from '../../shared/engine/financial-reports.engine';
import {
  buildSatAnexo24Xml,
  type Anexo24CfdiMetadata,
  type SatAnexo24Options,
  type SatXmlType
} from '../../shared/sat-anexo24';
import type {
  Account,
  AccountLedgerEntry,
  AccountLedgerResponse,
  AccountWithBalance,
  Company,
  DashboardSummary,
  FinancialStatementsResponse
} from '../../shared/types';
import { getGuestDemoState } from './guest-demo-store';
import { isGuestDemoMode } from './guest-demo-mode';
import { guestDemoExtras } from './guest-demo-extras';
import { guestDemoPolizasCfdi } from './guest-demo-polizas-cfdi';
import { createGuestDemoCompany } from './guest-demo-company';
import { buildGuestDemoBankAndOps } from './guest-demo-bank-and-ops';

function getCompanyOrFirst(companyId: string): Company {
  const s = getGuestDemoState();
  const c = (companyId ? s.companies.find((x) => x.id === companyId) : s.companies[0]) ?? s.companies[0];
  if (!c) throw new Error('Empresa demo no encontrada');
  return c;
}

function buildJoinedMovs(companyId: string): JoinedPolizaMovementInput[] {
  const s = getGuestDemoState();
  return s.polizas
    .filter((p) => p.companyId === companyId)
    .flatMap((p) =>
      p.movements.map((m) => ({
        account_id: m.accountId,
        cargo: m.cargo,
        abono: m.abono,
        polizas: { company_id: p.companyId, ejercicio: p.ejercicio, periodo: p.periodo }
      }))
    );
}

async function getDemoReports(companyId: string, year?: number, period?: number): Promise<FinancialStatementsResponse> {
  const s = getGuestDemoState();
  const company = getCompanyOrFirst(companyId);
  const ejercicio = year || company.currentYear;
  const periodo = period || company.currentPeriod;
  const accs: AccountWithBalance[] = s.accounts
    .filter((a) => a.companyId === company.id)
    .map((a) => ({
      ...a,
      initialBalanceComputed: a.initialBalance,
      periodCharges: 0,
      periodCredits: 0,
      finalBalance: a.initialBalance
    }));
  return computeFinancialStatementsData(company, accs, buildJoinedMovs(company.id), ejercicio, periodo);
}

const guestDemoBankAndOps = buildGuestDemoBankAndOps({
  getBankReconciliation: guestDemoExtras.getBankReconciliation.bind(guestDemoExtras),
  getFiscalWorkpaper: guestDemoExtras.getFiscalWorkpaper.bind(guestDemoExtras),
  getReports: getDemoReports,
  getFixedAssets: guestDemoExtras.getFixedAssets.bind(guestDemoExtras)
});

export const guestDemoApi = {
  ...guestDemoExtras,
  ...guestDemoPolizasCfdi,
  ...guestDemoBankAndOps,

  async getCompanies(): Promise<Company[]> {
    return [...getGuestDemoState().companies];
  },

  createCompany: createGuestDemoCompany,

  async updateCompany(companyId: string, payload: Partial<Company>): Promise<Company> {
    const c = getCompanyOrFirst(companyId);
    Object.assign(c, payload);
    return { ...c };
  },

  async deleteCompany(companyId: string): Promise<{ deleted: boolean }> {
    const s = getGuestDemoState();
    if (s.companies.length <= 1) throw new Error('Debe existir al menos una empresa activa.');
    s.companies = s.companies.filter((c) => c.id !== companyId);
    return { deleted: true };
  },

  async updateCompanyPeriod(companyId: string, currentYear: number, currentPeriod: number): Promise<Company> {
    const c = getCompanyOrFirst(companyId);
    c.currentYear = currentYear;
    c.currentPeriod = currentPeriod;
    return { ...c };
  },

  getReports: getDemoReports,

  async getAccounts(companyId: string, year?: number, period?: number): Promise<AccountWithBalance[]> {
    const rep = await getDemoReports(companyId, year, period);
    return rep.trialBalance;
  },

  async createAccount(payload: Omit<Account, 'id'>): Promise<Account> {
    const s = getGuestDemoState();
    const companyAccounts = s.accounts.filter((a) => a.companyId === payload.companyId);
    validateAccountHierarchy(companyAccounts, payload.parentCode, payload.code);
    const acc: Account = { ...payload, id: `acc_${crypto.randomUUID().slice(0, 10)}` };
    s.accounts.push(acc);
    return acc;
  },

  async updateAccount(accountId: string, payload: Partial<Account>): Promise<Account> {
    const s = getGuestDemoState();
    const acc = s.accounts.find((a) => a.id === accountId);
    if (!acc) throw new Error('Cuenta no encontrada');
    Object.assign(acc, payload);
    return { ...acc };
  },

  async deleteAccount(accountId: string): Promise<{ deleted: boolean; hasMovements?: boolean }> {
    const s = getGuestDemoState();
    const used = s.polizas.some((p) => p.movements.some((m) => m.accountId === accountId));
    if (used) return { deleted: false, hasMovements: true };
    s.accounts = s.accounts.filter((a) => a.id !== accountId);
    return { deleted: true };
  },

  async getDashboard(companyId: string, year?: number, period?: number): Promise<DashboardSummary> {
    const s = getGuestDemoState();
    const report = await getDemoReports(companyId, year, period);
    const company = report.company;
    const y = year || company.currentYear;
    const p = period || company.currentPeriod;
    const polizas = s.polizas.filter((pol) => pol.companyId === company.id && pol.ejercicio === y && pol.periodo === p);
    const cfdis = s.cfdis.filter((c) => c.companyId === company.id);
    const { kpis, recentPolizas, pendingCfdis } = buildDashboardKpisFromTrialBalance({
      trialBalance: report.trialBalance,
      polizas,
      cfdis,
      year: y,
      period: p
    });
    const accTypeById = new Map(s.accounts.filter((a) => a.companyId === company.id).map((a) => [a.id, a.type]));
    const trendPols = s.polizas
      .filter((pol) => pol.companyId === company.id && pol.ejercicio === y)
      .map((pol) => ({
        periodo: pol.periodo,
        poliza_movements: pol.movements.map((m) => ({
          cargo: m.cargo,
          abono: m.abono,
          accounts: { type: accTypeById.get(m.accountId) }
        }))
      }));
    const monthlyTrend = buildMonthlyTrendFromPolizas(
      Array.from({ length: 12 }, (_, idx) => idx + 1),
      trendPols
    );
    return { company, kpis, monthlyTrend, recentPolizas, pendingCfdis };
  },

  async getAccountLedger(
    companyId: string,
    accountId: string,
    year?: number,
    period?: number,
    periodTo?: number
  ): Promise<AccountLedgerResponse | null> {
    const rep = await getDemoReports(companyId, year, period);
    const acc = rep.trialBalance.find((a) => a.id === accountId || a.code === accountId);
    if (!acc) return null;
    const pFrom = rep.periodo;
    const pTo = periodTo && periodTo >= pFrom ? periodTo : pFrom;
    const pols = (await guestDemoPolizasCfdi.getPolizas(rep.company.id, rep.ejercicio, 'ALL'))
      .filter((p) => p.periodo >= pFrom && p.periodo <= pTo)
      .sort((a, b) => a.periodo - b.periodo || a.fecha.localeCompare(b.fecha) || a.folio - b.folio);

    let running = toCents(acc.initialBalanceComputed);
    let totalChargesCents = 0;
    let totalCreditsCents = 0;
    const entries: AccountLedgerEntry[] = [];
    for (const p of pols) {
      for (const m of p.movements) {
        if (m.accountId !== acc.id && m.accountCode !== acc.code) continue;
        const cC = toCents(m.cargo);
        const aC = toCents(m.abono);
        totalChargesCents += cC;
        totalCreditsCents += aC;
        running += acc.nature === 'DEUDORA' ? cC - aC : aC - cC;
        entries.push({
          movementId: m.id, polizaId: p.id, fecha: p.fecha, periodo: p.periodo,
          tipoPoliza: p.tipo, folioPoliza: p.folio, accountCode: m.accountCode, accountName: m.accountName,
          referencia: m.referencia, concepto: m.concepto, cfdiUuid: m.cfdiUuid,
          cargo: m.cargo, abono: m.abono, runningBalance: fromCents(running)
        });
      }
    }
    return {
      account: acc, ejercicio: rep.ejercicio, periodo: pFrom,
      initialBalance: acc.initialBalanceComputed,
      totalCharges: fromCents(totalChargesCents),
      totalCredits: fromCents(totalCreditsCents),
      finalBalance: fromCents(running),
      entries
    };
  },

  async getSatXml(
    companyId: string,
    type: SatXmlType | string,
    year?: number,
    period?: number,
    options?: Omit<SatAnexo24Options, 'cfdiLookup'>
  ): Promise<{ filename: string; type: string; xml: string }> {
    const rep = await getDemoReports(companyId, year, period);
    const y = rep.ejercicio;
    const p = rep.periodo;
    const needsPolizas =
      type === 'polizas' || type === 'auxiliar_folios' || type === 'auxiliar_cuentas';
    const needsCfdiLookup = type === 'polizas' || type === 'auxiliar_folios';
    const pols = needsPolizas
      ? await guestDemoPolizasCfdi.getPolizas(rep.company.id, y, p)
      : [];
    let cfdiLookup: Map<string, Anexo24CfdiMetadata> | undefined;
    if (needsCfdiLookup) {
      const cfdis = await guestDemoPolizasCfdi.getCfdis(rep.company.id);
      cfdiLookup = new Map<string, Anexo24CfdiMetadata>();
      for (const c of cfdis) {
        if (c.uuid) {
          const counterpartRfc = c.direction === 'EMITIDO' ? c.receptorRfc : c.emisorRfc;
          cfdiLookup.set(c.uuid.toUpperCase(), {
            total: c.total,
            rfcContraparte: counterpartRfc,
            moneda: c.moneda,
            tipoCambio: c.tipoCambio
          });
        }
      }
    }
    return buildSatAnexo24Xml(rep.company, y, p, type, rep.trialBalance, pols, {
      ...options,
      cfdiLookup
    });
  }
};

export function withGuestDemoClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && isGuestDemoMode()) {
        const demoFn = Reflect.get(guestDemoApi, prop, guestDemoApi);
        if (typeof demoFn === 'function') {
          return (...args: unknown[]) => (demoFn as (...a: unknown[]) => unknown).apply(guestDemoApi, args);
        }
        const targetVal = Reflect.get(target, prop, receiver);
        if (typeof targetVal === 'function') {
          return (..._args: unknown[]) =>
            Promise.reject(
              new Error(`DEMO_SANDBOX_UNSUPPORTED: La operación "${prop}" no está disponible en modo Demo.`)
            );
        }
        return undefined;
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

import { fromCents, toCents, validateAccountHierarchy } from '../../shared/accounting-engine';
import { getSeedAccountsForPreset } from '../../shared/catalogs/base-accounts.seed';
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

export const guestDemoApi = {
  ...guestDemoExtras,
  ...guestDemoPolizasCfdi,

  async getCompanies(): Promise<Company[]> {
    return [...getGuestDemoState().companies];
  },

  async createCompany(payload: {
    name: string;
    rfc: string;
    regimenFiscal: string;
    codigoPostal: string;
    currentYear?: number;
    currentPeriod?: number;
    catalogPreset?: 'SAT_STANDARD' | 'RESICO_SIMPLIFIED';
  }): Promise<Company> {
    const s = getGuestDemoState();
    const id = `comp_demo_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date();
    const company: Company = {
      id,
      name: payload.name,
      rfc: payload.rfc.toUpperCase(),
      regimenFiscal: payload.regimenFiscal,
      codigoPostal: payload.codigoPostal,
      maskFormat: 'XXX-XX-XXX',
      currentYear: payload.currentYear || now.getFullYear(),
      currentPeriod: payload.currentPeriod || now.getMonth() + 1,
      createdAt: now.toISOString(),
      userId: 'usr_guest_demo'
    };
    s.companies.push(company);
    const tplAccounts = getSeedAccountsForPreset(payload.catalogPreset || 'SAT_STANDARD');
    tplAccounts.forEach((tpl, idx) => {
      s.accounts.push({
        id: `acc_${id}_${idx + 1}`,
        companyId: id,
        code: tpl.code,
        name: tpl.name,
        parentCode: tpl.parentCode ?? null,
        type: tpl.type,
        nature: tpl.nature,
        level: tpl.level,
        isAffectable: tpl.isAffectable,
        satGroupCode: tpl.satGroupCode,
        currency: 'MXN',
        initialBalance: 0
      });
    });
    return company;
  },

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

  async getReports(companyId: string, year?: number, period?: number): Promise<FinancialStatementsResponse> {
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
  },

  async getAccounts(companyId: string, year?: number, period?: number): Promise<AccountWithBalance[]> {
    const rep = await this.getReports(companyId, year, period);
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
    const report = await this.getReports(companyId, year, period);
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

  async getAccountLedger(companyId: string, accountId: string, year?: number, period?: number): Promise<AccountLedgerResponse | null> {
    const rep = await this.getReports(companyId, year, period);
    const acc = rep.trialBalance.find((a) => a.id === accountId || a.code === accountId);
    if (!acc) return null;
    const pols = await guestDemoPolizasCfdi.getPolizas(companyId, rep.ejercicio, rep.periodo);
    let running = toCents(acc.initialBalanceComputed);
    const entries: AccountLedgerEntry[] = [];
    for (const p of pols) {
      for (const m of p.movements) {
        if (m.accountId !== acc.id && m.accountCode !== acc.code) continue;
        const cC = toCents(m.cargo);
        const aC = toCents(m.abono);
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
      account: acc, ejercicio: rep.ejercicio, periodo: rep.periodo,
      initialBalance: acc.initialBalanceComputed,
      totalCharges: acc.periodCharges, totalCredits: acc.periodCredits,
      finalBalance: acc.finalBalance, entries
    };
  },

  async getSatXml(
    companyId: string,
    type: SatXmlType | string,
    year?: number,
    period?: number,
    options?: Omit<SatAnexo24Options, 'cfdiLookup'>
  ): Promise<{ filename: string; type: string; xml: string }> {
    const rep = await this.getReports(companyId, year, period);
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
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

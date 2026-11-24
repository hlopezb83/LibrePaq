import { fromCents, toCents } from '../../shared/accounting-engine';
import { getSeedAccountsForPreset } from '../../shared/catalogs/base-accounts.seed';
import type { Account, Company } from '../../shared/types';
import { getGuestDemoState } from './guest-demo-store';

export async function createGuestDemoCompany(payload: {
  name: string;
  rfc: string;
  regimenFiscal: string;
  codigoPostal: string;
  currentYear?: number;
  currentPeriod?: number;
  catalogPreset?: 'SAT_STANDARD' | 'RESICO_SIMPLIFIED' | 'CUSTOM';
  initialBankName?: string;
  initialBankAccount?: string;
  initialBankBalance?: number;
  createOpeningEntry?: boolean;
}): Promise<Company> {
  const s = getGuestDemoState();
  const id = `comp_demo_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date();
  const currentYear = payload.currentYear || now.getFullYear();
  const currentPeriod = payload.currentPeriod || now.getMonth() + 1;
  const company: Company = {
    id,
    name: payload.name,
    rfc: payload.rfc.toUpperCase(),
    regimenFiscal: payload.regimenFiscal,
    codigoPostal: payload.codigoPostal,
    maskFormat: 'XXX-XX-XXX',
    currentYear,
    currentPeriod,
    createdAt: now.toISOString(),
    userId: 'usr_guest_demo'
  };
  s.companies.push(company);

  const resolvedPreset =
    payload.catalogPreset ??
    (payload.regimenFiscal.startsWith('626') ? 'RESICO_SIMPLIFIED' : 'SAT_STANDARD');
  const customBankLabel = payload.initialBankName
    ? `${payload.initialBankName} Cta ${payload.initialBankAccount || 'Principal'}`
    : null;

  const tplAccounts = getSeedAccountsForPreset(resolvedPreset);
  const createdAccounts: Account[] = tplAccounts.map((tpl, idx) => ({
    id: `acc_${id}_${idx + 1}`,
    companyId: id,
    code: tpl.code,
    name: tpl.code === '102-01-001' && customBankLabel ? customBankLabel : tpl.name,
    parentCode: tpl.parentCode ?? null,
    type: tpl.type,
    nature: tpl.nature,
    level: tpl.level,
    isAffectable: tpl.isAffectable,
    satGroupCode: tpl.satGroupCode,
    currency: 'MXN',
    initialBalance: 0
  }));
  s.accounts.push(...createdAccounts);

  const bankBalanceCents = toCents(Number(payload.initialBankBalance || 0));
  if (payload.createOpeningEntry && bankBalanceCents > 0) {
    const bankAcc = createdAccounts.find((a) => a.code === '102-01-001');
    const capAcc = createdAccounts.find((a) => a.code === '301-01-001');
    if (bankAcc && capAcc) {
      const amount = fromCents(bankBalanceCents);
      const polId = `pol_${id}_apertura`;
      const fecha = `${currentYear}-${String(Math.min(12, currentPeriod)).padStart(2, '0')}-01`;
      s.polizas.push({
        id: polId,
        companyId: id,
        tipo: 'DIARIO',
        folio: 1,
        fecha,
        ejercicio: currentYear,
        periodo: currentPeriod,
        concepto: `Asiento de Apertura - Saldo Inicial en Bancos (${payload.initialBankName || 'Bancos'}) y Capital Social`,
        cfdiUuid: null,
        origin: 'MANUAL',
        totalCargos: amount,
        totalAbonos: amount,
        isBalanced: true,
        createdAt: now.toISOString(),
        movements: [
          {
            id: `mov_${polId}_1`,
            polizaId: polId,
            accountId: bankAcc.id,
            accountCode: bankAcc.code,
            accountName: bankAcc.name,
            referencia: 'APERTURA',
            concepto: `Apertura cuenta bancaria ${payload.initialBankName || 'Bancos'}`,
            cargo: amount,
            abono: 0,
            cfdiUuid: null
          },
          {
            id: `mov_${polId}_2`,
            polizaId: polId,
            accountId: capAcc.id,
            accountCode: capAcc.code,
            accountName: capAcc.name,
            referencia: 'APERTURA',
            concepto: 'Aportación de Capital Social Inicial',
            cargo: 0,
            abono: amount,
            cfdiUuid: null
          }
        ]
      });
    }
  }
  return company;
}

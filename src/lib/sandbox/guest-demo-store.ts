import {
  buildAutoPolizaPlan,
  fromCents,
  toCents
} from '../../shared/accounting-engine';
import { getSeedAccountsForPreset } from '../../shared/catalogs/base-accounts.seed';
import { parseCfdiXmlString } from '../../shared/cfdi-xml';
import { parseCalendarDate } from '../../shared/date-utils';
import {
  CANONICAL_DEMO_COMPANY_ID,
  SANDBOX_DEMO_NAME,
  SANDBOX_DEMO_RFC
} from '../sandbox-demo-constants';
import { buildSampleCfdiXmlsForCompany } from '../sandbox-demo-seeder';
import type {
  Account,
  BankStatementLine,
  CfdiDocument,
  Company,
  FixedAssetRecord,
  PeriodLock,
  Poliza,
  TaxParametersRecord,
  ThirdPartyRecord
} from '../../shared/types';
import type { AccountingRuleRecord } from '../../shared/types/accounting-rules.types';
import type { AnnualTaxInputs } from '../../shared/types/annual-tax.types';
import type { BankN1MatchRecord } from '../../shared/types/bank-n1.types';
import type { InventoryPeriodRecord } from '../../shared/types/cost-of-sales.types';

export interface GuestDemoState {
  companies: Company[];
  accounts: Account[];
  polizas: Poliza[];
  cfdis: CfdiDocument[];
  bankLines: BankStatementLine[];
  bankMatches: BankN1MatchRecord[];
  periodLocks: PeriodLock[];
  thirdParties: ThirdPartyRecord[];
  fixedAssets: FixedAssetRecord[];
  taxParameters: TaxParametersRecord[];
  accountingRules: AccountingRuleRecord[];
  annualSnapshots: AnnualTaxInputs[];
  inventoryPeriods: InventoryPeriodRecord[];
}

function createInitialGuestDemoState(): GuestDemoState {
  const now = new Date();
  const year = now.getFullYear();
  const period = now.getMonth() + 1;
  const companyId = CANONICAL_DEMO_COMPANY_ID;
  const createdAt = now.toISOString();

  const company: Company = {
    id: companyId,
    name: SANDBOX_DEMO_NAME,
    rfc: SANDBOX_DEMO_RFC,
    regimenFiscal: '601 - General de Ley Personas Morales',
    codigoPostal: '64000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: year,
    currentPeriod: period,
    createdAt,
    userId: 'usr_guest_demo'
  };

  const accounts: Account[] = getSeedAccountsForPreset('SAT_STANDARD').map((tpl, idx) => ({
    id: `acc_demo_${idx + 1}`,
    companyId,
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
  }));

  const polizas: Poliza[] = [];
  const bankAcc = accounts.find((a) => a.code === '102-01-001');
  const capAcc = accounts.find((a) => a.code === '301-01-001');
  const mStr = String(period).padStart(2, '0');
  if (bankAcc && capAcc) {
    polizas.push({
      id: 'pol_demo_open_1',
      companyId,
      tipo: 'DIARIO',
      folio: 1,
      fecha: `${year}-${mStr}-01`,
      ejercicio: year,
      periodo: period,
      concepto: 'Póliza de Apertura — Saldo Inicial Banco BBVA México (01948271)',
      cfdiUuid: null,
      origin: 'MANUAL',
      totalCargos: 150000,
      totalAbonos: 150000,
      isBalanced: true,
      createdAt,
      movements: [
        {
          id: 'mov_demo_open_1',
          polizaId: 'pol_demo_open_1',
          accountId: bankAcc.id,
          accountCode: bankAcc.code,
          accountName: bankAcc.name,
          referencia: '01948271',
          concepto: 'Saldo inicial banco',
          cargo: 150000,
          abono: 0,
          cfdiUuid: null
        },
        {
          id: 'mov_demo_open_2',
          polizaId: 'pol_demo_open_1',
          accountId: capAcc.id,
          accountCode: capAcc.code,
          accountName: capAcc.name,
          referencia: 'APERTURA',
          concepto: 'Aportación capital apertura',
          cargo: 0,
          abono: 150000,
          cfdiUuid: null
        }
      ]
    });
  }

  const cfdis: CfdiDocument[] = buildSampleCfdiXmlsForCompany(
    company.rfc,
    company.name,
    year,
    period
  ).map((xml, idx) => {
    const parsed = parseCfdiXmlString(xml);
    const dir: 'EMITIDO' | 'RECIBIDO' =
      parsed.emisorRfc.toUpperCase() === company.rfc ? 'EMITIDO' : 'RECIBIDO';
    return {
      id: `cfdi_demo_${idx + 1}`,
      companyId,
      uuid: parsed.uuid,
      fecha: parsed.fecha,
      tipoComprobante: parsed.tipoComprobante,
      direction: dir,
      serie: parsed.serie,
      folio: parsed.folio,
      emisorRfc: parsed.emisorRfc,
      emisorNombre: parsed.emisorNombre,
      receptorRfc: parsed.receptorRfc,
      receptorNombre: parsed.receptorNombre,
      conceptoPrincipal: parsed.conceptoPrincipal,
      claveProdServ: parsed.claveProdServ,
      moneda: parsed.moneda,
      tipoCambio: parsed.tipoCambio,
      subtotal: parsed.subtotal,
      descuento: parsed.descuento,
      ivaTrasladado: parsed.ivaTrasladado,
      isrRetenido: parsed.isrRetenido,
      ivaRetenido: parsed.ivaRetenido,
      total: parsed.total,
      metodoPago: parsed.metodoPago,
      formaPago: parsed.formaPago,
      usoCfdi: parsed.usoCfdi,
      uuidRelacionado: parsed.uuidRelacionado,
      statusSat: 'VIGENTE',
      polizaId: null,
      polizaFolio: null,
      xmlRaw: xml,
      taxBreakdown: parsed.taxBreakdown ?? null,
      relatedDocs: parsed.relatedDocs ?? null
    };
  });

  for (const cfdi of cfdis.slice(0, 2)) {
    try {
      const accountsWithBal = accounts.map((a) => ({
        ...a,
        initialBalanceComputed: a.initialBalance,
        periodCharges: 0,
        periodCredits: 0,
        finalBalance: a.initialBalance
      }));
      const plan = buildAutoPolizaPlan(cfdi, accountsWithBal);
      const { year: pYear, month: pPeriod } = parseCalendarDate(cfdi.fecha);
      const polId = `pol_demo_${cfdi.id}`;
      const folio = polizas.filter((p) => p.tipo === plan.polizaType).length + 1;
      const totC = fromCents(plan.movements.reduce((s, m) => s + toCents(m.cargo), 0));
      const totA = fromCents(plan.movements.reduce((s, m) => s + toCents(m.abono), 0));
      polizas.push({
        id: polId,
        companyId,
        tipo: plan.polizaType,
        folio,
        fecha: cfdi.fecha,
        ejercicio: pYear,
        periodo: pPeriod,
        concepto: plan.polizaConcept,
        cfdiUuid: cfdi.uuid,
        cfdiUuids: [cfdi.uuid],
        origin: 'ADD_AUTO',
        totalCargos: totC,
        totalAbonos: totA,
        isBalanced: Math.abs(totC - totA) < 0.01,
        createdAt,
        movements: plan.movements.map((m, i) => ({
          id: `mov_demo_${cfdi.id}_${i + 1}`,
          polizaId: polId,
          accountId: m.accountId,
          accountCode: m.accountCode,
          accountName: m.accountName,
          referencia: m.referencia || '',
          concepto: m.concepto,
          cargo: m.cargo,
          abono: m.abono,
          cfdiUuid: cfdi.uuid
        }))
      });
      cfdi.polizaId = polId;
      cfdi.polizaFolio = `${plan.polizaType.slice(0, 3)}-${folio}`;
    } catch {
      // keep demo resilient
    }
  }

  return {
    companies: [company],
    accounts,
    polizas,
    cfdis,
    bankLines: [],
    bankMatches: [],
    periodLocks: [],
    thirdParties: [],
    fixedAssets: [],
    taxParameters: [],
    accountingRules: [],
    annualSnapshots: [],
    inventoryPeriods: []
  };
}

let cachedState: GuestDemoState | null = null;

export function getGuestDemoState(): GuestDemoState {
  if (!cachedState) cachedState = createInitialGuestDemoState();
  return cachedState;
}

export function resetGuestDemoState(): void {
  cachedState = createInitialGuestDemoState();
}

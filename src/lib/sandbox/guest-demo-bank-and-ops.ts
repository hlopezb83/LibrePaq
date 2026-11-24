import {
  buildExchangeFluctuationMovements,
  buildTaxProvisionMovements,
  buildYearCloseMovements,
  fromCents,
  toCents
} from '../../shared/accounting-engine';
import { parseCfdiXmlString } from '../../shared/cfdi-xml';
import { getDefaultDateForPeriod } from '../../shared/date-utils';
import type {
  Account,
  AccountNature,
  AccountType,
  BankReconciliationResponse,
  CfdiDocument,
  Company,
  CompanyBackupBundle,
  FinancialStatementsResponse,
  FiscalWorkpaperResponse,
  FixedAssetCategory,
  FixedAssetsResponse,
  Poliza,
  ThirdPartyRecord
} from '../../shared/types';
import { buildGuestDemoBankOps } from './guest-demo-bank-ops';
import { assertDemoPeriodOpen, getGuestDemoState } from './guest-demo-store';
import { guestDemoPolizasCfdi } from './guest-demo-polizas-cfdi';

function demoUnsupported(op: string): never {
  throw new Error(`DEMO_SANDBOX_UNSUPPORTED: La operación "${op}" requiere conexión a la nube.`);
}

export function buildGuestDemoBankAndOps(deps: {
  getBankReconciliation: (
    companyId: string,
    accountId?: string,
    year?: number,
    period?: number
  ) => Promise<BankReconciliationResponse>;
  getFiscalWorkpaper: (companyId: string, year?: number, period?: number) => Promise<FiscalWorkpaperResponse>;
  getReports: (companyId: string, year?: number, period?: number) => Promise<FinancialStatementsResponse>;
  getFixedAssets: (companyId: string) => Promise<FixedAssetsResponse>;
}) {
  return {
    ...buildGuestDemoBankOps(deps.getBankReconciliation),

    async getCfdiXml(cfdiId: string): Promise<string> {
      return getGuestDemoState().cfdis.find((c) => c.id === cfdiId)?.xmlRaw ?? '';
    },

    async deleteCfdi(cfdiId: string): Promise<{ deleted: boolean }> {
      const s = getGuestDemoState();
      const cfdi = s.cfdis.find((c) => c.id === cfdiId);
      if (cfdi?.polizaId) throw new Error('Desvincula o elimina la póliza asociada antes de borrar el CFDI.');
      s.cfdis = s.cfdis.filter((c) => c.id !== cfdiId);
      return { deleted: true };
    },

    async uploadCfdi(payload: { companyId: string; xmlRaw?: string }): Promise<CfdiDocument> {
      if (payload.xmlRaw) {
        const res = await guestDemoPolizasCfdi.batchUploadCfdiXmls(payload.companyId, [payload.xmlRaw]);
        if (res.uploaded[0]) return res.uploaded[0];
        const parsed = parseCfdiXmlString(payload.xmlRaw);
        const existing = getGuestDemoState().cfdis.find((c) => c.companyId === payload.companyId && c.uuid === parsed.uuid);
        if (existing) return existing;
      }
      throw new Error('Se requiere XML válido en modo demo.');
    },

    async saveThirdParty(payload: Omit<ThirdPartyRecord, 'id' | 'updatedAt'>): Promise<ThirdPartyRecord> {
      const s = getGuestDemoState();
      const cleanRfc = payload.rfc.trim().toUpperCase();
      const record: ThirdPartyRecord = {
        ...payload,
        id: `tp_${payload.companyId}_${cleanRfc}`,
        rfc: cleanRfc,
        updatedAt: new Date().toISOString()
      };
      s.thirdParties = [...s.thirdParties.filter((t) => !(t.companyId === payload.companyId && t.rfc === cleanRfc)), record];
      return record;
    },

    async createFixedAsset(payload: {
      companyId: string; codigo: string; nombre: string; categoria: FixedAssetCategory;
      fechaAdquisicion: string; cfdiUuid?: string | null; montoOriginalInversion: number; tasaAnualPct: number;
      mesesDepreciadosPrevios?: number; inpcAdquisicion?: number; inpcMedioPeriodo?: number;
      cuentaActivoCode?: string; cuentaDepAcumCode?: string; cuentaGastoDepCode?: string;
    }) {
      const s = getGuestDemoState();
      s.fixedAssets.push({
        id: `fa_${crypto.randomUUID().slice(0, 10)}`,
        companyId: payload.companyId,
        codigo: payload.codigo,
        nombre: payload.nombre,
        categoria: payload.categoria,
        fechaAdquisicion: payload.fechaAdquisicion,
        cfdiUuid: payload.cfdiUuid ?? null,
        montoOriginalInversion: payload.montoOriginalInversion,
        tasaAnualPct: payload.tasaAnualPct,
        mesesDepreciadosPrevios: payload.mesesDepreciadosPrevios ?? 0,
        inpcAdquisicion: payload.inpcAdquisicion ?? 132.54,
        inpcMedioPeriodo: payload.inpcMedioPeriodo ?? 136.82,
        cuentaActivoCode: payload.cuentaActivoCode || '156-01-001',
        cuentaDepAcumCode: payload.cuentaDepAcumCode || '171-01-001',
        cuentaGastoDepCode: payload.cuentaGastoDepCode || '601-01-006',
        estatus: 'ACTIVO',
        createdAt: new Date().toISOString()
      });
      return deps.getFixedAssets(payload.companyId);
    },

    async deleteFixedAsset(assetId: string) {
      const s = getGuestDemoState();
      s.fixedAssets = s.fixedAssets.filter((a) => a.id !== assetId);
      return { deleted: true };
    },

    async generateTaxProvisionPoliza(companyId: string, year?: number, period?: number): Promise<Poliza> {
      const wp = await deps.getFiscalWorkpaper(companyId, year, period);
      const rep = await deps.getReports(companyId, wp.ejercicio, wp.periodo);
      const movements = buildTaxProvisionMovements(wp, rep.trialBalance, wp.periodo, wp.ejercicio);
      return guestDemoPolizasCfdi.createPoliza({
        companyId,
        tipo: 'DIARIO',
        fecha: getDefaultDateForPeriod(wp.ejercicio, wp.periodo),
        ejercicio: wp.ejercicio,
        periodo: wp.periodo,
        concepto: `Póliza de Provisión de Impuestos Federales ISR e IVA (${wp.periodo}/${wp.ejercicio})`,
        movements
      });
    },

    async generateExchangePoliza(companyId: string, year?: number, period?: number): Promise<Poliza> {
      const wp = await deps.getFiscalWorkpaper(companyId, year, period);
      const rep = await deps.getReports(companyId, wp.ejercicio, wp.periodo);
      const plan = buildExchangeFluctuationMovements(wp, rep.trialBalance);
      return guestDemoPolizasCfdi.createPoliza({
        companyId,
        tipo: 'DIARIO',
        fecha: getDefaultDateForPeriod(wp.ejercicio, wp.periodo),
        ejercicio: wp.ejercicio,
        periodo: wp.periodo,
        concepto: plan.concept,
        movements: plan.movements
      });
    },

    async closeYearPoliza(companyId: string, switchToPeriod13 = true) {
      const s = getGuestDemoState();
      const comp = s.companies.find((c) => c.id === companyId) ?? s.companies[0];
      if (!comp) throw new Error('Empresa demo no encontrada');
      const ejercicio = comp.currentYear;
      assertDemoPeriodOpen(comp.id, ejercicio, 13);
      const rep = await deps.getReports(comp.id, ejercicio, 13);
      const { movements, utilidadTraspasada } = buildYearCloseMovements(rep.trialBalance, ejercicio, 'finalBalance');
      const pol = await guestDemoPolizasCfdi.createPoliza({
        companyId: comp.id,
        tipo: 'DIARIO',
        fecha: `${ejercicio}-12-31`,
        ejercicio,
        periodo: 13,
        concepto: `Póliza de Cierre Anual del Ejercicio ${ejercicio}`,
        movements
      });
      if (switchToPeriod13) comp.currentPeriod = 13;
      return { closed: true, polizaId: pol.id, utilidadTraspasada };
    },

    async batchImportAccounts(
      companyId: string,
      rows: Array<{ code: string; name: string; parentCode?: string | null; type?: string; nature?: string; level?: number; satGroupCode?: string; isAffectable?: boolean; currency?: 'MXN' | 'USD'; initialBalance?: number }>
    ) {
      const s = getGuestDemoState();
      let importedCount = 0;
      let updatedCount = 0;
      for (const r of rows) {
        if (!r.code || !r.name) continue;
        const code = r.code.trim();
        const existing = s.accounts.find((a) => a.companyId === companyId && a.code === code);
        if (existing) {
          existing.name = r.name.trim();
          if (r.parentCode) existing.parentCode = r.parentCode;
          if (r.initialBalance !== undefined) existing.initialBalance = fromCents(toCents(r.initialBalance));
          updatedCount += 1;
        } else {
          const level = r.level ?? 3;
          const acc: Account = {
            id: `${companyId}_${code}`,
            companyId,
            code,
            name: r.name.trim(),
            parentCode: r.parentCode ?? null,
            type: (r.type as AccountType) || 'ACTIVO',
            nature: (r.nature as AccountNature) || 'DEUDORA',
            level,
            isAffectable: r.isAffectable ?? level >= 3,
            satGroupCode: r.satGroupCode || code.slice(0, 3),
            currency: r.currency || 'MXN',
            initialBalance: fromCents(toCents(r.initialBalance ?? 0))
          };
          s.accounts.push(acc);
          importedCount += 1;
        }
      }
      return { importedCount, updatedCount };
    },

    async restoreCompanyBackup(bundle: CompanyBackupBundle): Promise<Company> {
      const s = getGuestDemoState();
      const comp = bundle.company;
      s.companies = [...s.companies.filter((c) => c.id !== comp.id), { ...comp, userId: 'usr_guest_demo' }];
      s.accounts = [...s.accounts.filter((a) => a.companyId !== comp.id), ...(bundle.accounts || [])];
      s.polizas = [...s.polizas.filter((p) => p.companyId !== comp.id), ...(bundle.polizas || [])];
      s.cfdis = [...s.cfdis.filter((c) => c.companyId !== comp.id), ...(bundle.cfdis || [])];
      s.thirdParties = [...s.thirdParties.filter((t) => t.companyId !== comp.id), ...(bundle.thirdParties || [])];
      s.fixedAssets = [...s.fixedAssets.filter((f) => f.companyId !== comp.id), ...(bundle.fixedAssets || [])];
      s.periodLocks = [...s.periodLocks.filter((l) => l.companyId !== comp.id), ...(bundle.periodLocks || [])];
      s.taxParameters = [...s.taxParameters.filter((t) => t.companyId !== comp.id), ...(bundle.taxParameters || [])];
      s.bankLines = [...s.bankLines.filter((b) => b.companyId !== comp.id), ...(bundle.bankStatementLines || [])];
      return comp;
    },

    getBroadcastMessage: () => null,
    setBroadcastMessage: () => undefined,
    updateUserProfileWorkspace: async () => undefined,
    saveFielCredentials: async () => demoUnsupported('saveFielCredentials'),
    generateTestFiel: async () => demoUnsupported('generateTestFiel'),
    executeSatSoapDownload: async () => demoUnsupported('executeSatSoapDownload'),
    verifyPendingSatRequests: async () => demoUnsupported('verifyPendingSatRequests'),
    verifyCfdiSatStatus: async () => demoUnsupported('verifyCfdiSatStatus'),
    verifyCfdisSatBatch: async () => demoUnsupported('verifyCfdisSatBatch')
  };
}

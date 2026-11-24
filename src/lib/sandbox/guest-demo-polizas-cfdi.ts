import {
  buildAutoPolizaPlan,
  fromCents,
  toCents,
  validateDoubleEntryMovements
} from '../../shared/accounting-engine';
import { parseCfdiXmlString } from '../../shared/cfdi-xml';
import { parseCalendarDate, resolvePolizaYearPeriod } from '../../shared/date-utils';
import { computeFinancialStatementsData } from '../../shared/engine/financial-reports.engine';
import type {
  AccountWithBalance,
  CfdiDocument,
  Poliza,
  PolizaType
} from '../../shared/types';
import { getGuestDemoState } from './guest-demo-store';

export const guestDemoPolizasCfdi = {
  async getPolizas(companyId: string, year?: number, period?: number | 'ALL'): Promise<Poliza[]> {
    return getGuestDemoState().polizas.filter(
      (p) =>
        p.companyId === companyId &&
        (!year || p.ejercicio === year) &&
        (typeof period !== 'number' || p.periodo === period)
    );
  },

  async reclassifyAccountMovements(payload: {
    companyId: string;
    fromAccountId: string;
    toAccountId: string;
    ejercicio: number;
    periodFrom?: number;
    periodTo?: number;
  }): Promise<{ updatedMovementsCount: number; affectedPolizasCount: number }> {
    const s = getGuestDemoState();
    const toAcc = s.accounts.find((a) => a.companyId === payload.companyId && a.id === payload.toAccountId);
    const fromAcc = s.accounts.find((a) => a.companyId === payload.companyId && a.id === payload.fromAccountId);
    if (!fromAcc || !toAcc) throw new Error('Cuenta origen o destino no encontrada.');
    if (!fromAcc.isAffectable || !toAcc.isAffectable) {
      throw new Error('Ambas cuentas deben ser afectables para reclasificar.');
    }
    const pFrom = Math.max(1, payload.periodFrom ?? 1);
    const pTo = Math.min(13, payload.periodTo ?? 13);
    let updatedMovementsCount = 0;
    const affectedPolizas = new Set<string>();
    for (const pol of s.polizas) {
      if (pol.companyId !== payload.companyId || pol.ejercicio !== payload.ejercicio) continue;
      if (pol.periodo < pFrom || pol.periodo > pTo) continue;
      for (const m of pol.movements) {
        if (m.accountId === fromAcc.id) {
          m.accountId = toAcc.id;
          m.accountCode = toAcc.code;
          m.accountName = toAcc.name;
          updatedMovementsCount += 1;
          affectedPolizas.add(pol.id);
        }
      }
    }
    return { updatedMovementsCount, affectedPolizasCount: affectedPolizas.size };
  },

  async createPoliza(payload: {
    companyId: string;
    tipo: PolizaType;
    fecha: string;
    concepto: string;
    cfdiUuid?: string | null;
    origin?: 'MANUAL' | 'ADD_AUTO';
    ejercicio?: number;
    periodo?: number;
    movements: Array<{ accountId: string; accountCode?: string; accountName?: string; referencia?: string; concepto?: string; cargo: number; abono: number; cfdiUuid?: string | null }>;
  }): Promise<Poliza> {
    const s = getGuestDemoState();
    const resolved = resolvePolizaYearPeriod(payload.fecha, payload.periodo);
    const year = payload.ejercicio || resolved.ejercicio;
    const period = resolved.periodo;
    const accMap = new Map(s.accounts.filter((a) => a.companyId === payload.companyId).map((a) => [a.id, a]));
    validateDoubleEntryMovements(payload.movements, accMap);
    const folio = s.polizas.filter((p) => p.companyId === payload.companyId && p.tipo === payload.tipo && p.ejercicio === year && p.periodo === period).length + 1;
    const polId = `pol_${crypto.randomUUID().slice(0, 10)}`;
    const totC = fromCents(payload.movements.reduce((acc, m) => acc + toCents(m.cargo), 0));
    const totA = fromCents(payload.movements.reduce((acc, m) => acc + toCents(m.abono), 0));
    const pol: Poliza = {
      id: polId,
      companyId: payload.companyId,
      tipo: payload.tipo,
      folio,
      fecha: payload.fecha,
      ejercicio: year,
      periodo: period,
      concepto: payload.concepto,
      cfdiUuid: payload.cfdiUuid || null,
      origin: payload.origin || 'MANUAL',
      totalCargos: totC,
      totalAbonos: totA,
      isBalanced: true,
      createdAt: new Date().toISOString(),
      movements: payload.movements.map((m, i) => {
        const acc = accMap.get(m.accountId);
        return {
          id: `mov_${polId}_${i + 1}`,
          polizaId: polId,
          accountId: m.accountId,
          accountCode: m.accountCode || acc?.code || '',
          accountName: m.accountName || acc?.name || '',
          referencia: m.referencia || '',
          concepto: m.concepto || payload.concepto,
          cargo: Number(m.cargo || 0),
          abono: Number(m.abono || 0),
          cfdiUuid: m.cfdiUuid ?? payload.cfdiUuid ?? null
        };
      })
    };
    s.polizas.unshift(pol);
    return pol;
  },

  async updatePoliza(polizaId: string, payload: Partial<Poliza>): Promise<{ updated: boolean }> {
    const s = getGuestDemoState();
    const pol = s.polizas.find((p) => p.id === polizaId);
    if (!pol) throw new Error('Póliza no encontrada');
    Object.assign(pol, payload);
    return { updated: true };
  },

  async deletePoliza(polizaId: string): Promise<{ deleted: boolean }> {
    const s = getGuestDemoState();
    s.polizas = s.polizas.filter((p) => p.id !== polizaId);
    s.cfdis.forEach((c) => {
      if (c.polizaId === polizaId) {
        c.polizaId = null;
        c.polizaFolio = null;
      }
    });
    return { deleted: true };
  },

  async getCfdis(companyId: string): Promise<CfdiDocument[]> {
    return getGuestDemoState().cfdis.filter((c) => c.companyId === companyId);
  },

  async batchUploadCfdiXmls(companyId: string, xmlStrings: string[]) {
    const s = getGuestDemoState();
    const comp = s.companies.find((c) => c.id === companyId) ?? s.companies[0];
    if (!comp) throw new Error('Empresa demo no encontrada');
    const uploaded: CfdiDocument[] = [];
    for (const xml of xmlStrings) {
      const p = parseCfdiXmlString(xml);
      if (s.cfdis.some((c) => c.companyId === companyId && c.uuid === p.uuid)) continue;
      const doc: CfdiDocument = {
        id: `cfdi_${crypto.randomUUID().slice(0, 10)}`,
        companyId,
        uuid: p.uuid,
        fecha: p.fecha,
        tipoComprobante: p.tipoComprobante,
        direction: p.emisorRfc.toUpperCase() === comp.rfc.toUpperCase() ? 'EMITIDO' : 'RECIBIDO',
        serie: p.serie,
        folio: p.folio,
        emisorRfc: p.emisorRfc,
        emisorNombre: p.emisorNombre,
        receptorRfc: p.receptorRfc,
        receptorNombre: p.receptorNombre,
        conceptoPrincipal: p.conceptoPrincipal,
        claveProdServ: p.claveProdServ,
        moneda: p.moneda,
        tipoCambio: p.tipoCambio,
        subtotal: p.subtotal,
        descuento: p.descuento,
        ivaTrasladado: p.ivaTrasladado,
        isrRetenido: p.isrRetenido,
        ivaRetenido: p.ivaRetenido,
        total: p.total,
        metodoPago: p.metodoPago,
        formaPago: p.formaPago,
        usoCfdi: p.usoCfdi,
        uuidRelacionado: p.uuidRelacionado,
        statusSat: 'VIGENTE',
        polizaId: null,
        polizaFolio: null,
        xmlRaw: xml,
        taxBreakdown: p.taxBreakdown ?? null,
        relatedDocs: p.relatedDocs ?? null
      };
      s.cfdis.unshift(doc);
      uploaded.push(doc);
    }
    return { uploadedCount: uploaded.length, skippedDuplicates: xmlStrings.length - uploaded.length, uploaded };
  },

  async autoPolizaFromCfdi(
    cfdiId: string,
    options?: { operationAccountCode?: string; counterAccountCode?: string; deductiblePct?: number }
  ): Promise<Poliza> {
    const s = getGuestDemoState();
    const cfdi = s.cfdis.find((c) => c.id === cfdiId);
    if (!cfdi) throw new Error('CFDI no encontrado');
    if (cfdi.polizaId) throw new Error('Este CFDI ya está contabilizado');
    const comp = s.companies.find((c) => c.id === cfdi.companyId) ?? s.companies[0];
    if (!comp) throw new Error('Empresa demo no encontrada');
    const accs: AccountWithBalance[] = s.accounts
      .filter((a) => a.companyId === comp.id)
      .map((a) => ({ ...a, initialBalanceComputed: a.initialBalance, periodCharges: 0, periodCredits: 0, finalBalance: a.initialBalance }));
    const movs = s.polizas
      .filter((pol) => pol.companyId === comp.id)
      .flatMap((pol) => pol.movements.map((m) => ({ account_id: m.accountId, cargo: m.cargo, abono: m.abono, polizas: { company_id: pol.companyId, ejercicio: pol.ejercicio, periodo: pol.periodo } })));
    const rep = computeFinancialStatementsData(comp, accs, movs, comp.currentYear, comp.currentPeriod);
    const plan = buildAutoPolizaPlan(cfdi, rep.trialBalance, options);
    const { year, month } = parseCalendarDate(cfdi.fecha);
    const pol = await this.createPoliza({
      companyId: cfdi.companyId,
      tipo: plan.polizaType,
      fecha: cfdi.fecha,
      ejercicio: year,
      periodo: month,
      concepto: plan.polizaConcept,
      cfdiUuid: cfdi.uuid,
      origin: 'ADD_AUTO',
      movements: plan.movements
    });
    cfdi.polizaId = pol.id;
    cfdi.polizaFolio = `${pol.tipo.slice(0, 3)}-${pol.folio}`;
    return pol;
  },

  async batchAutoPolizaFromCfdis(cfdiIds: string[]) {
    const results: Poliza[] = [];
    for (const id of cfdiIds) {
      results.push(await this.autoPolizaFromCfdi(id));
    }
    return { createdCount: results.length, polizas: results };
  }
};

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
import { assertDemoPeriodOpen, getGuestDemoState } from './guest-demo-store';

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

    const matchingPolizas = s.polizas.filter(
      (pol) =>
        pol.companyId === payload.companyId &&
        pol.ejercicio === payload.ejercicio &&
        pol.periodo >= pFrom &&
        pol.periodo <= pTo &&
        pol.movements.some((m) => m.accountId === fromAcc.id)
    );

    const checkedPeriods = new Set<number>();
    for (const pol of matchingPolizas) {
      if (!checkedPeriods.has(pol.periodo)) {
        checkedPeriods.add(pol.periodo);
        assertDemoPeriodOpen(payload.companyId, payload.ejercicio, pol.periodo);
      }
    }

    let updatedMovementsCount = 0;
    const affectedPolizas = new Set<string>();
    for (const pol of matchingPolizas) {
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
    cfdiUuids?: string[];
    origin?: 'MANUAL' | 'ADD_AUTO';
    ejercicio?: number;
    periodo?: number;
    movements: Array<{ accountId: string; accountCode?: string; accountName?: string; referencia?: string; concepto?: string; cargo: number; abono: number; cfdiUuid?: string | null }>;
  }): Promise<Poliza> {
    const s = getGuestDemoState();
    const resolved = resolvePolizaYearPeriod(payload.fecha, payload.periodo);
    const year = payload.ejercicio || resolved.ejercicio;
    const period = resolved.periodo;
    assertDemoPeriodOpen(payload.companyId, year, period);

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
      cfdiUuids: payload.cfdiUuids,
      origin: payload.origin || 'MANUAL',
      totalCargos: totC,
      totalAbonos: totA,
      isBalanced: toCents(totC) === toCents(totA),
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

  async updatePoliza(
    polizaId: string,
    payload: Partial<Poliza> & { periodo?: number | null }
  ): Promise<{ updated: boolean }> {
    const s = getGuestDemoState();
    const pol = s.polizas.find((p) => p.id === polizaId);
    if (!pol) throw new Error('Póliza no encontrada');

    assertDemoPeriodOpen(pol.companyId, pol.ejercicio, pol.periodo);

    const nextFecha = payload.fecha ?? pol.fecha;
    const resolved = resolvePolizaYearPeriod(
      nextFecha,
      payload.periodo !== undefined ? payload.periodo : pol.periodo,
      pol.ejercicio,
      pol.periodo
    );
    const nextYear = payload.ejercicio ?? resolved.ejercicio;
    const nextPeriod = resolved.periodo;
    if (nextYear !== pol.ejercicio || nextPeriod !== pol.periodo) {
      assertDemoPeriodOpen(pol.companyId, nextYear, nextPeriod);
    }

    const accMap = new Map(
      s.accounts.filter((a) => a.companyId === pol.companyId).map((a) => [a.id, a])
    );
    const rawMovements = payload.movements ?? pol.movements;
    validateDoubleEntryMovements(rawMovements, accMap);

    const nextTipo = payload.tipo ?? pol.tipo;
    const nextConcepto = payload.concepto ?? pol.concepto;
    const nextCfdiUuid = payload.cfdiUuid !== undefined ? (payload.cfdiUuid || null) : pol.cfdiUuid;
    const nextMovements = rawMovements.map((m, i) => {
      const acc = accMap.get(m.accountId);
      return {
        id: 'id' in m && m.id ? m.id : `mov_${pol.id}_${i + 1}`,
        polizaId: pol.id,
        accountId: m.accountId,
        accountCode: m.accountCode || acc?.code || '',
        accountName: m.accountName || acc?.name || '',
        referencia: m.referencia || '',
        concepto: m.concepto || nextConcepto,
        cargo: Number(m.cargo || 0),
        abono: Number(m.abono || 0),
        cfdiUuid: m.cfdiUuid ?? nextCfdiUuid ?? null
      };
    });

    const totC = fromCents(nextMovements.reduce((acc, m) => acc + toCents(m.cargo), 0));
    const totA = fromCents(nextMovements.reduce((acc, m) => acc + toCents(m.abono), 0));
    const linkedUuids = new Set<string>(
      [
        ...(payload.cfdiUuids ?? pol.cfdiUuids ?? []),
        ...(nextCfdiUuid ? [nextCfdiUuid] : []),
        ...nextMovements.map((m) => m.cfdiUuid || '').filter(Boolean)
      ].map((u) => u.trim().toUpperCase())
    );

    pol.tipo = nextTipo;
    pol.fecha = resolved.isoDate;
    pol.ejercicio = nextYear;
    pol.periodo = nextPeriod;
    pol.concepto = nextConcepto;
    pol.cfdiUuid = nextCfdiUuid;
    pol.cfdiUuids = Array.from(linkedUuids);
    pol.movements = nextMovements;
    pol.totalCargos = totC;
    pol.totalAbonos = totA;
    pol.isBalanced = toCents(totC) === toCents(totA);

    const nextFolioLabel = `${pol.tipo.slice(0, 3)}-${pol.folio}`;
    for (const c of s.cfdis) {
      if (c.companyId !== pol.companyId) continue;
      const isLinked = linkedUuids.has(c.uuid.trim().toUpperCase());
      if (c.polizaId === pol.id && !isLinked) {
        c.polizaId = null;
        c.polizaFolio = null;
      } else if (isLinked) {
        c.polizaId = pol.id;
        c.polizaFolio = nextFolioLabel;
      }
    }

    return { updated: true };
  },

  async deletePoliza(polizaId: string): Promise<{ deleted: boolean }> {
    const s = getGuestDemoState();
    const target = s.polizas.find((p) => p.id === polizaId);
    if (target) {
      assertDemoPeriodOpen(target.companyId, target.ejercicio, target.periodo);
    }
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
        id: `cfdi_${crypto.randomUUID().slice(0, 10)}`, companyId, uuid: p.uuid, fecha: p.fecha,
        fechaPago: p.fechaPago ?? null, tipoComprobante: p.tipoComprobante,
        direction: p.emisorRfc.toUpperCase() === comp.rfc.toUpperCase() ? 'EMITIDO' : 'RECIBIDO',
        serie: p.serie, folio: p.folio, emisorRfc: p.emisorRfc, emisorNombre: p.emisorNombre,
        receptorRfc: p.receptorRfc, receptorNombre: p.receptorNombre, conceptoPrincipal: p.conceptoPrincipal,
        claveProdServ: p.claveProdServ, moneda: p.moneda, tipoCambio: p.tipoCambio, subtotal: p.subtotal,
        descuento: p.descuento, ivaTrasladado: p.ivaTrasladado, isrRetenido: p.isrRetenido,
        ivaRetenido: p.ivaRetenido, total: p.total, metodoPago: p.metodoPago, formaPago: p.formaPago,
        usoCfdi: p.usoCfdi, uuidRelacionado: p.uuidRelacionado, statusSat: 'VIGENTE',
        polizaId: null, polizaFolio: null, xmlRaw: xml,
        taxBreakdown: p.taxBreakdown ?? null, relatedDocs: p.relatedDocs ?? null
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

  async batchAutoPolizaFromCfdis(
    cfdiIds: string[],
    options?: { operationAccountCode?: string; counterAccountCode?: string; deductiblePct?: number }
  ): Promise<{
    createdPolizas: Poliza[];
    count: number;
    failedCount: number;
    errors: Array<{ cfdiId: string; error: string }>;
  }> {
    const createdPolizas: Poliza[] = [];
    const errors: Array<{ cfdiId: string; error: string }> = [];
    for (const id of cfdiIds) {
      try {
        createdPolizas.push(await this.autoPolizaFromCfdi(id, options));
      } catch (err) {
        errors.push({ cfdiId: id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return {
      createdPolizas,
      count: createdPolizas.length,
      failedCount: errors.length,
      errors
    };
  }
};

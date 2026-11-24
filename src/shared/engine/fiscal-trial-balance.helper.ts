import type { AccountWithBalance, CfdiDocument, Poliza } from '../types';
import { parseCalendarDate } from '../date-utils';
import type { UsdMonetaryItemInput } from './fiscal.engine';
import { fromCents, sumCents, toCents } from './invariants-and-math';

export function resolveOpenUsdPpdCfdis(
  cfdis: readonly CfdiDocument[],
  ejercicio: number,
  periodo: number
): UsdMonetaryItemInput[] {
  const targetPeriod = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo));
  const isOnOrBeforeCutoff = (fecha: string): boolean => {
    const cal = parseCalendarDate(fecha, ejercicio, targetPeriod);
    return cal.year < ejercicio || (cal.year === ejercicio && cal.month <= targetPeriod);
  };

  const usdPpdDocs = cfdis.filter(
    (c) =>
      c.moneda?.toUpperCase() === 'USD' &&
      c.statusSat !== 'CANCELADO' &&
      c.metodoPago === 'PPD' &&
      (c.tipoComprobante === 'I' ||
        (c.tipoComprobante === 'E' && !c.uuidRelacionado && !(c.relatedDocs && c.relatedDocs.length > 0))) &&
      isOnOrBeforeCutoff(c.fecha)
  );
  const usdByUuid = new Map<string, CfdiDocument>();
  for (const doc of usdPpdDocs) {
    const key = (doc.uuid || '').trim().toUpperCase();
    if (key) usdByUuid.set(key, doc);
  }

  const settledUsdCents = new Map<string, number>();
  const minInsolutoCents = new Map<string, number>();
  const addSettled = (uuid: string, cents: number) => {
    if (!uuid || cents <= 0) return;
    settledUsdCents.set(uuid, (settledUsdCents.get(uuid) ?? 0) + cents);
  };

  for (const c of cfdis) {
    if (c.statusSat === 'CANCELADO') continue;
    if (c.tipoComprobante !== 'P' && c.tipoComprobante !== 'E') continue;
    if (!isOnOrBeforeCutoff(c.fecha)) continue;

    if (c.relatedDocs && c.relatedDocs.length > 0) {
      for (const dr of c.relatedDocs) {
        const targetUuid = (dr.idDocumento || '').trim().toUpperCase();
        if (!targetUuid) continue;
        const drCur = (dr.monedaDr || 'USD').toUpperCase();
        const targetInv = usdByUuid.get(targetUuid);
        const invTc = targetInv && targetInv.tipoCambio > 1 ? targetInv.tipoCambio : 1;
        const paidUsdCents =
          drCur === 'USD' ? toCents(dr.impPagado) : drCur === 'MXN' ? toCents(dr.impPagado / invTc) : 0;
        addSettled(targetUuid, paidUsdCents);

        if (c.tipoComprobante === 'P' && drCur === 'USD' && dr.impSaldoInsoluto !== undefined) {
          const isValidZero =
            dr.impSaldoInsoluto === 0 && (dr.impSaldoAnt <= 0 || dr.impPagado >= dr.impSaldoAnt - 0.01);
          if (dr.impSaldoInsoluto > 0 || isValidZero) {
            const insCents = Math.max(0, toCents(dr.impSaldoInsoluto));
            const prev = minInsolutoCents.get(targetUuid);
            minInsolutoCents.set(targetUuid, prev === undefined ? insCents : Math.min(prev, insCents));
          }
        }
      }
    } else if (c.uuidRelacionado) {
      const targetUuid = c.uuidRelacionado.trim().toUpperCase();
      const targetInv = usdByUuid.get(targetUuid);
      const cur = (c.moneda || 'MXN').toUpperCase();
      const invTc = targetInv && targetInv.tipoCambio > 1 ? targetInv.tipoCambio : 1;
      const usdCents =
        cur === 'USD' ? toCents(c.total) : cur === 'MXN' ? toCents(c.total / invTc) : 0;
      addSettled(targetUuid, usdCents);
    }
  }

  const result: UsdMonetaryItemInput[] = [];
  for (const doc of usdPpdDocs) {
    const key = (doc.uuid || '').trim().toUpperCase();
    const origCents = toCents(doc.total);
    const paidCents = key ? (settledUsdCents.get(key) ?? 0) : 0;
    let remainingCents = Math.max(0, origCents - paidCents);
    const minIns = key ? minInsolutoCents.get(key) : undefined;
    if (minIns !== undefined) remainingCents = Math.min(remainingCents, minIns);
    if (remainingCents <= 0) continue;
    result.push({ ...doc, saldoInsolutoUsd: fromCents(remainingCents) });
  }
  return result;
}

export function isNonCfdiCashDeductionAccount(a: AccountWithBalance): boolean {
  const sat = (a.satGroupCode ?? '').trim();
  const lower = a.name.toLowerCase();
  if (
    ['601-01-007', '601-01-008', '601-01-011', '601-02-001', '601-02-002', '601-26-001', '601-58-001'].includes(a.code) ||
    ['601.26', '601.27', '601.28', '601.29', '601.58'].includes(sat) ||
    sat.startsWith('613')
  ) {
    return true;
  }
  if ((a.code === '601-01-009' || a.code === '601-01-010') && sat !== '601.48' && sat !== '601.52') {
    return true;
  }
  return /imss|infonavit|\bsar\b|\brcv\b|\bisn\b|impuesto sobre n[oó]mina|cuota.*patron|depreciaci[oó]n\s*(fiscal|autorizada)|deducci[oó]n\s*(fiscal|de\s*inversiones)/i.test(
    lower
  );
}

export function hasUnpaidPpdInvoicesByDirection(
  cfdis: readonly CfdiDocument[],
  ejercicio: number,
  periodo: number
): { hasUnpaidEmitidos: boolean; hasUnpaidRecibidos: boolean } {
  const targetPeriod = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo));
  const settledCentsByUuid = new Map<string, number>();
  const settledZeroInsoluto = new Set<string>();

  for (const c of cfdis) {
    if (c.statusSat === 'CANCELADO') continue;
    if (c.tipoComprobante !== 'P' && c.tipoComprobante !== 'E') continue;
    const effDate = c.tipoComprobante === 'P' ? (c.fechaPago || c.fecha) : c.fecha;
    const cal = parseCalendarDate(effDate, ejercicio, targetPeriod);
    if (cal.year > ejercicio || (cal.year === ejercicio && cal.month > targetPeriod)) continue;

    if (c.relatedDocs && c.relatedDocs.length > 0) {
      for (const dr of c.relatedDocs) {
        const u = (dr.idDocumento || '').trim().toUpperCase();
        if (!u) continue;
        settledCentsByUuid.set(u, (settledCentsByUuid.get(u) ?? 0) + Math.max(0, toCents(dr.impPagado)));
        if (c.tipoComprobante === 'P' && dr.impSaldoInsoluto <= 0.01 && dr.impPagado > 0) {
          settledZeroInsoluto.add(u);
        }
      }
    } else if (c.uuidRelacionado) {
      for (const rawU of c.uuidRelacionado.split(/[\s,;]+/)) {
        const u = rawU.trim().toUpperCase();
        if (!u) continue;
        settledCentsByUuid.set(u, (settledCentsByUuid.get(u) ?? 0) + Math.max(0, toCents(c.total)));
      }
    }
  }

  let hasUnpaidEmitidos = false;
  let hasUnpaidRecibidos = false;
  for (const c of cfdis) {
    if (c.statusSat === 'CANCELADO' || c.tipoComprobante !== 'I' || c.metodoPago !== 'PPD') continue;
    const cal = parseCalendarDate(c.fecha, ejercicio, targetPeriod);
    if (cal.year > ejercicio || (cal.year === ejercicio && cal.month > targetPeriod)) continue;
    const u = (c.uuid || '').trim().toUpperCase();
    const isSettled = u
      ? settledZeroInsoluto.has(u) || (settledCentsByUuid.get(u) ?? 0) >= Math.max(0, toCents(c.total) - 1)
      : false;
    if (!isSettled) {
      if (c.direction === 'EMITIDO') hasUnpaidEmitidos = true;
      else if (c.direction === 'RECIBIDO') hasUnpaidRecibidos = true;
    }
  }
  return { hasUnpaidEmitidos, hasUnpaidRecibidos };
}

export function reconstructGrossIvaAfterProvision(
  trialBalance: readonly AccountWithBalance[],
  ivaCobradoAccounts: readonly AccountWithBalance[],
  ivaPagadoAccounts: readonly AccountWithBalance[],
  periodPolizas?: readonly Poliza[]
): { tbIvaCobrado: number; tbIvaPagado: number } {
  const netCobradoCents = sumCents(ivaCobradoAccounts.map((a) => a.periodCredits - a.periodCharges));
  const netPagadoCents = sumCents(ivaPagadoAccounts.map((a) => a.periodCharges - a.periodCredits));

  if (periodPolizas && periodPolizas.length > 0) {
    const cobradoIds = new Set(ivaCobradoAccounts.map((a) => a.id));
    const pagadoIds = new Set(ivaPagadoAccounts.map((a) => a.id));
    const targetIds = new Set(
      trialBalance
        .filter(
          (a) =>
            a.isAffectable &&
            (a.code === '213-01-001' || a.code === '113-01-001' || a.satGroupCode === '213.01' || a.satGroupCode === '113.01')
        )
        .map((a) => a.id)
    );
    let prov208CargoCents = 0;
    let prov118AbonoCents = 0;
    for (const p of periodPolizas) {
      const hasIvaRef = p.movements.some((m) => /^IVA-M\d+/i.test(m.referencia || ''));
      const hasIvaAcc = p.movements.some(
        (m) =>
          cobradoIds.has(m.accountId) ||
          pagadoIds.has(m.accountId) ||
          m.accountCode?.startsWith('208-01') ||
          m.accountCode?.startsWith('118-01') ||
          m.accountCode?.startsWith('118-02')
      );
      const hasOffsetAcc = p.movements.some(
        (m) => targetIds.has(m.accountId) || m.accountCode === '213-01-001' || m.accountCode === '113-01-001'
      );
      if (!hasIvaRef && !(hasIvaAcc && hasOffsetAcc)) continue;
      for (const m of p.movements) {
        if (cobradoIds.has(m.accountId) || m.accountCode?.startsWith('208-01')) {
          prov208CargoCents += toCents(m.cargo);
        } else if (pagadoIds.has(m.accountId) || m.accountCode?.startsWith('118-01') || m.accountCode?.startsWith('118-02')) {
          prov118AbonoCents += toCents(m.abono);
        }
      }
    }
    return {
      tbIvaCobrado: fromCents(Math.max(0, netCobradoCents + prov208CargoCents)),
      tbIvaPagado: fromCents(Math.max(0, netPagadoCents + prov118AbonoCents))
    };
  }

  const sum208ChargesCents = sumCents(ivaCobradoAccounts.map((a) => a.periodCharges));
  const sum118CreditsCents = sumCents(ivaPagadoAccounts.map((a) => a.periodCredits));
  const prov213CreditCents = sumCents(
    trialBalance
      .filter((a) => a.isAffectable && (a.code === '213-01-001' || a.satGroupCode === '213.01'))
      .map((a) => a.periodCredits)
  );
  const prov113DebitCents = sumCents(
    trialBalance
      .filter((a) => a.isAffectable && (a.code === '113-01-001' || a.satGroupCode === '113.01'))
      .map((a) => a.periodCharges)
  );
  const matchesOffset =
    (prov213CreditCents > 0 || prov113DebitCents > 0) &&
    (sum208ChargesCents > 0 || sum118CreditsCents > 0) &&
    Math.abs(sum208ChargesCents - sum118CreditsCents - (prov213CreditCents - prov113DebitCents)) <= 100;

  return {
    tbIvaCobrado: fromCents(Math.max(0, netCobradoCents + (matchesOffset ? sum208ChargesCents : 0))),
    tbIvaPagado: fromCents(Math.max(0, netPagadoCents + (matchesOffset ? sum118CreditsCents : 0)))
  };
}

export function isIvaRetentionAccount(a: AccountWithBalance): boolean {
  const sat = (a.satGroupCode ?? '').trim();
  if (sat === '216.10') return true;
  if (sat.startsWith('216.') && sat !== '216.10') return false;
  if (a.code === '216-01-002') return true;
  const lower = a.name.toLowerCase();
  return lower.includes('iva') && !lower.includes('isr');
}

export function isImss216Account(a: AccountWithBalance): boolean {
  const sat = (a.satGroupCode ?? '').trim();
  const lower = a.name.toLowerCase();
  return sat === '216.11' && (!lower.includes('isr') || lower.includes('imss'));
}

export function isPpdPendingRetentionAccount(a: AccountWithBalance): boolean {
  const code = a.code.trim();
  const lower = a.name.toLowerCase();
  return code.startsWith('216-02') || lower.includes('ppd') || lower.includes('pendiente de pago');
}

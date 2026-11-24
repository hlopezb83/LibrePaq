import { db } from '../connection';
import { fromCents, toCents } from '../../shared/accounting-engine';
import type { AccountLedgerEntry, AccountLedgerResponse, PolizaType } from '../../shared/types';
import { computeTrialBalance } from './trial-balance.repo';

export function getAccountLedger(
  companyId: string,
  accountId: string,
  ejercicio: number,
  periodo: number,
  periodTo?: number
): AccountLedgerResponse | null {
  const effectiveFrom = periodTo !== undefined ? Math.min(periodo, periodTo) : periodo;
  const effectiveTo = periodTo !== undefined ? Math.max(periodo, periodTo) : periodo;
  const isRange = effectiveTo !== effectiveFrom;
  const trialBalance = computeTrialBalance(companyId, ejercicio, effectiveFrom);
  const targetAcc = trialBalance.find((a) => a.id === accountId);
  if (!targetAcc) return null;
  const endTrial = isRange ? computeTrialBalance(companyId, ejercicio, effectiveTo) : trialBalance;
  const targetAccEnd = endTrial.find((a) => a.id === accountId) ?? targetAcc;

  const descendantIds = new Set<string>();
  if (targetAcc.isAffectable) {
    descendantIds.add(targetAcc.id);
  } else {
    let prefix = targetAcc.code;
    if (targetAcc.code.endsWith('-00-000')) {
      prefix = targetAcc.level === 1 ? targetAcc.code.slice(0, 1) : `${targetAcc.code.slice(0, 3)}-`;
    } else if (targetAcc.code.endsWith('-000')) {
      prefix = `${targetAcc.code.slice(0, 6)}-`;
    }
    for (const acc of trialBalance) {
      if (acc.isAffectable && acc.code.startsWith(prefix)) {
        descendantIds.add(acc.id);
      }
    }
  }

  const idsArray = Array.from(descendantIds);
  if (idsArray.length === 0) {
    return {
      account: targetAcc,
      ejercicio,
      periodo,
      initialBalance: targetAcc.initialBalanceComputed,
      totalCharges: 0,
      totalCredits: 0,
      finalBalance: targetAcc.finalBalance,
      entries: []
    };
  }

  const placeholders = idsArray.map(() => '?').join(',');
  const rows = db
    .query(`
      SELECT
        m.id as movement_id,
        m.poliza_id,
        p.fecha,
        p.periodo,
        p.tipo as tipo_poliza,
        p.folio as folio_poliza,
        m.account_code,
        m.account_name,
        m.referencia,
        m.concepto,
        m.cfdi_uuid,
        m.cargo,
        m.abono
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      WHERE p.company_id = ? AND p.ejercicio = ? AND p.periodo BETWEEN ? AND ?
        AND m.account_id IN (${placeholders})
      ORDER BY p.fecha ASC, p.folio ASC, m.id ASC
    `)
    .all(companyId, ejercicio, effectiveFrom, effectiveTo, ...idsArray) as Array<{
    movement_id: string;
    poliza_id: string;
    fecha: string;
    periodo: number;
    tipo_poliza: PolizaType;
    folio_poliza: number;
    account_code: string;
    account_name: string;
    referencia: string;
    concepto: string;
    cfdi_uuid: string | null;
    cargo: number;
    abono: number;
  }>;

  let runningCents = toCents(targetAcc.initialBalanceComputed);
  let sumChargesCents = 0;
  let sumCreditsCents = 0;
  const entries: AccountLedgerEntry[] = rows.map((r) => {
    const cargoCents = toCents(r.cargo);
    const abonoCents = toCents(r.abono);
    sumChargesCents += cargoCents;
    sumCreditsCents += abonoCents;
    if (targetAcc.nature === 'DEUDORA') {
      runningCents += cargoCents - abonoCents;
    } else {
      runningCents += abonoCents - cargoCents;
    }
    return {
      movementId: r.movement_id,
      polizaId: r.poliza_id,
      fecha: r.fecha,
      periodo: Number(r.periodo),
      tipoPoliza: r.tipo_poliza,
      folioPoliza: Number(r.folio_poliza),
      accountCode: r.account_code,
      accountName: r.account_name,
      referencia: r.referencia,
      concepto: r.concepto,
      cfdiUuid: r.cfdi_uuid,
      cargo: fromCents(cargoCents),
      abono: fromCents(abonoCents),
      runningBalance: fromCents(runningCents)
    };
  });

  return {
    account: targetAcc,
    ejercicio,
    periodo: effectiveFrom,
    initialBalance: targetAcc.initialBalanceComputed,
    totalCharges: isRange ? fromCents(sumChargesCents) : targetAcc.periodCharges,
    totalCredits: isRange ? fromCents(sumCreditsCents) : targetAcc.periodCredits,
    finalBalance: targetAccEnd.finalBalance,
    entries
  };
}

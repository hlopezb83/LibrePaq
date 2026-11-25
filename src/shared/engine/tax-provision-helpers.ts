import type { Account, AccountWithBalance, FiscalWorkpaperResponse } from '../types';
import {
  assertAccountingInvariant,
  fromCents,
  toCents
} from './invariants-and-math';
import {
  resolveFiscalAccount,
  type AutoPolizaMovementDraft
} from './auto-poliza.engine';

export interface Iva118SubaccountSlot {
  account: Account;
  remainingCents: number;
}

export function resolveIvaCobradoAccounts(accounts: readonly Account[]): Account[] {
  const matched = accounts.filter((a) => {
    if (!a.isAffectable) return false;
    const sat = (a.satGroupCode ?? '').trim();
    if (sat === '208.02' || a.code.startsWith('208-02')) return false;
    return (
      sat === '208.01' ||
      sat.startsWith('208.01') ||
      a.code.startsWith('208-01') ||
      (sat.startsWith('208') && a.name.toLowerCase().includes('iva'))
    );
  });
  return matched.length > 0 ? matched : [resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO')];
}

export function resolveIvaPagadoAccounts(accounts: readonly Account[]): Account[] {
  const matched = accounts.filter((a) => {
    if (!a.isAffectable) return false;
    const sat = (a.satGroupCode ?? '').trim();
    if (sat === '118.03' || a.code.startsWith('118-03')) return false;
    return (
      sat === '118.01' ||
      sat === '118.02' ||
      sat.startsWith('118.01') ||
      sat.startsWith('118.02') ||
      a.code.startsWith('118-01') ||
      a.code.startsWith('118-02') ||
      (sat.startsWith('118') && a.name.toLowerCase().includes('iva'))
    );
  });
  return matched.length > 0 ? matched : [resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO')];
}

export function push208Subaccounts(
  movements: AutoPolizaMovementDraft[],
  cobradoAccounts: readonly (Account | AccountWithBalance)[],
  fallbackAcc: Account,
  ivaCobradoCents: number,
  referencia: string
): void {
  if (ivaCobradoCents <= 0) return;
  const slots = cobradoAccounts
    .map((a) => {
      const bal = a as Account & Partial<AccountWithBalance>;
      const avail = typeof bal.finalBalance === 'number' ? Math.max(0, toCents(bal.finalBalance)) : 0;
      return { account: a, avail };
    })
    .filter((s) => s.avail > 0);
  if (slots.length === 0) {
    movements.push({
      accountId: fallbackAcc.id,
      accountCode: fallbackAcc.code,
      accountName: fallbackAcc.name,
      referencia,
      concepto: 'Cancelación mensual de IVA Trasladado Cobrado',
      cargo: fromCents(ivaCobradoCents),
      abono: 0
    });
    return;
  }
  let rem = ivaCobradoCents;
  for (const s of slots) {
    if (rem <= 0) break;
    const amt = Math.min(rem, s.avail);
    if (amt <= 0) continue;
    rem -= amt;
    movements.push({
      accountId: s.account.id,
      accountCode: s.account.code,
      accountName: s.account.name,
      referencia,
      concepto: 'Cancelación mensual de IVA Trasladado Cobrado',
      cargo: fromCents(amt),
      abono: 0
    });
  }
  if (rem > 0) {
    movements.push({
      accountId: fallbackAcc.id,
      accountCode: fallbackAcc.code,
      accountName: fallbackAcc.name,
      referencia,
      concepto: 'Cancelación mensual de IVA Trasladado Cobrado',
      cargo: fromCents(rem),
      abono: 0
    });
  }
}

export function credit118Subaccounts(
  movements: AutoPolizaMovementDraft[],
  slots: Iva118SubaccountSlot[],
  fallbackAcc: Account,
  desiredCents: number,
  enforceCap: boolean,
  referencia: string,
  concepto118: string
): number {
  if (desiredCents <= 0) return 0;
  if (!enforceCap) {
    movements.push({
      accountId: fallbackAcc.id,
      accountCode: fallbackAcc.code,
      accountName: fallbackAcc.name,
      referencia,
      concepto: concepto118,
      cargo: 0,
      abono: fromCents(desiredCents)
    });
    return desiredCents;
  }
  let rem = desiredCents;
  let totalCredited = 0;
  for (const slot of slots) {
    if (rem <= 0) break;
    const creditCents = Math.min(rem, slot.remainingCents);
    if (creditCents <= 0) continue;
    slot.remainingCents -= creditCents;
    rem -= creditCents;
    totalCredited += creditCents;
    movements.push({
      accountId: slot.account.id,
      accountCode: slot.account.code,
      accountName: slot.account.name,
      referencia,
      concepto: concepto118,
      cargo: 0,
      abono: fromCents(creditCents)
    });
  }
  return totalCredited;
}

export function push118WithCap(
  movements: AutoPolizaMovementDraft[],
  accIvaPagado: Account,
  _accIvaPendiente: Account | null,
  desiredCents: number,
  remaining118Ref: { cents: number },
  referencia: string,
  concepto118: string,
  _concepto119?: string
): number {
  if (desiredCents <= 0) return 0;
  const credit118 = Math.min(desiredCents, remaining118Ref.cents);
  remaining118Ref.cents -= credit118;
  if (credit118 > 0) {
    movements.push({
      accountId: accIvaPagado.id,
      accountCode: accIvaPagado.code,
      accountName: accIvaPagado.name,
      referencia,
      concepto: concepto118,
      cargo: 0,
      abono: fromCents(credit118)
    });
  }
  return credit118;
}

/**
 * Motor Contable para Revaluación Mensual de Moneda Extranjera USD (NIF B-15).
 */
export function buildExchangeFluctuationMovements(
  wp: FiscalWorkpaperResponse,
  accounts: readonly Account[]
): {
  movements: AutoPolizaMovementDraft[];
  concept: string;
} {
  const diffCents = toCents(wp.fluctuacionCambiaria.diferenciaCambiariaMxn);
  assertAccountingInvariant(
    Math.abs(diffCents) > 0,
    'ZERO_EXCHANGE_DIFF',
    'No existe diferencia cambiaria USD por registrar con el Tipo de Cambio DOF actual.'
  );

  const isNetPayable = toCents(wp.fluctuacionCambiaria.saldoMonedaExtranjeraUsd) < 0;
  const accMonetaria = isNetPayable
    ? resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES')
    : resolveFiscalAccount(accounts, 'CLIENTES_NACIONALES');
  const accUtilidad = resolveFiscalAccount(accounts, 'UTILIDAD_CAMBIARIA');
  const accPerdida = resolveFiscalAccount(accounts, 'PERDIDA_CAMBIARIA');
  const absAmount = fromCents(Math.abs(diffCents));
  const tcStr = wp.fluctuacionCambiaria.tipoCambioDofCierre.toFixed(4);

  const movements: AutoPolizaMovementDraft[] =
    diffCents > 0
      ? [
          {
            accountId: accMonetaria.id,
            accountCode: accMonetaria.code,
            accountName: accMonetaria.name,
            referencia: `TC-DOF-${tcStr}`,
            concepto: 'Ajuste por revaluación cambiaria USD al cierre DOF (NIF B-15)',
            cargo: absAmount,
            abono: 0
          },
          {
            accountId: accUtilidad.id,
            accountCode: accUtilidad.code,
            accountName: accUtilidad.name,
            referencia: `TC-DOF-${tcStr}`,
            concepto: 'Utilidad cambiaria devengada fin de mes',
            cargo: 0,
            abono: absAmount
          }
        ]
      : [
          {
            accountId: accPerdida.id,
            accountCode: accPerdida.code,
            accountName: accPerdida.name,
            referencia: `TC-DOF-${tcStr}`,
            concepto: 'Pérdida cambiaria devengada fin de mes',
            cargo: absAmount,
            abono: 0
          },
          {
            accountId: accMonetaria.id,
            accountCode: accMonetaria.code,
            accountName: accMonetaria.name,
            referencia: `TC-DOF-${tcStr}`,
            concepto: 'Ajuste por revaluación cambiaria USD al cierre DOF (NIF B-15)',
            cargo: 0,
            abono: absAmount
          }
        ];

  return {
    movements,
    concept: `Póliza de Fluctuación Cambiaria USD (T.C. DOF $${tcStr})`
  };
}

export function appendIvaNoAcreditableMovements(
  movements: AutoPolizaMovementDraft[],
  accounts: readonly Account[],
  slots118: Iva118SubaccountSlot[],
  accIvaPagadoFallback: Account,
  enforce118Cap: boolean,
  ivaNoAcreditableCents: number,
  periodo: number
): void {
  if (ivaNoAcreditableCents <= 0) return;
  const accGastoIvaNoAcred =
    accounts.find((a) => a.isAffectable && a.code === '601-01-012') ??
    accounts.find((a) => a.isAffectable && /iva\s*no\s*acreditable/i.test(a.name)) ??
    accounts.find((a) => a.isAffectable && a.satGroupCode === '601.56') ??
    resolveFiscalAccount(accounts, 'HONORARIOS_SERVICIOS');
  const noAcredTransferred = credit118Subaccounts(
    movements,
    slots118,
    accIvaPagadoFallback,
    ivaNoAcreditableCents,
    enforce118Cap,
    `IVA-M${periodo}`,
    'Cancelación de IVA no acreditable por prorrateo Art. 5 LIVA'
  );
  if (noAcredTransferred > 0) {
    movements.push({
      accountId: accGastoIvaNoAcred.id,
      accountCode: accGastoIvaNoAcred.code,
      accountName: accGastoIvaNoAcred.name,
      referencia: `IVA-M${periodo}`,
      concepto: 'IVA no acreditable por prorrateo Art. 5 LIVA (Gasto deducible Art. 28 LISR)',
      cargo: fromCents(noAcredTransferred),
      abono: 0
    });
  }
}

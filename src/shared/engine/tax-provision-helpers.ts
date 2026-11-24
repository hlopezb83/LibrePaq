import type { Account, FiscalWorkpaperResponse } from '../types';
import {
  assertAccountingInvariant,
  fromCents,
  toCents
} from './invariants-and-math';
import {
  resolveFiscalAccount,
  type AutoPolizaMovementDraft
} from './auto-poliza.engine';

export function push118WithCap(
  movements: AutoPolizaMovementDraft[],
  accIvaPagado: Account,
  accIvaPendiente: Account | null,
  desiredCents: number,
  remaining118Ref: { cents: number },
  referencia: string,
  concepto118: string,
  concepto119: string
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
  const shortfall = desiredCents - credit118;
  if (shortfall > 0 && accIvaPendiente) {
    movements.push({
      accountId: accIvaPendiente.id,
      accountCode: accIvaPendiente.code,
      accountName: accIvaPendiente.name,
      referencia,
      concepto: concepto119,
      cargo: 0,
      abono: fromCents(shortfall)
    });
    return desiredCents;
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
  accIvaPagado: Account,
  accIvaPendienteRaw: Account | null,
  ivaNoAcreditableCents: number,
  remaining118Ref: { cents: number },
  periodo: number
): void {
  if (ivaNoAcreditableCents <= 0) return;
  const accGastoIvaNoAcred =
    accounts.find((a) => a.isAffectable && a.code === '601-01-012') ??
    accounts.find((a) => a.isAffectable && /iva\s*no\s*acreditable/i.test(a.name)) ??
    accounts.find((a) => a.isAffectable && a.satGroupCode === '601.56') ??
    resolveFiscalAccount(accounts, 'HONORARIOS_SERVICIOS');
  const noAcredTransferred = push118WithCap(
    movements,
    accIvaPagado,
    accIvaPendienteRaw,
    ivaNoAcreditableCents,
    remaining118Ref,
    `IVA-M${periodo}`,
    'Cancelación de IVA no acreditable por prorrateo Art. 5 LIVA',
    'Cancelación de IVA pendiente no acreditable por prorrateo Art. 5 LIVA'
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

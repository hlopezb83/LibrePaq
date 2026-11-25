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
import { roundArt20Cff } from './sat-dyp-formatter';
import {
  appendIvaNoAcreditableMovements,
  buildExchangeFluctuationMovements,
  credit118Subaccounts,
  push208Subaccounts,
  resolveIvaCobradoAccounts,
  resolveIvaPagadoAccounts,
  type Iva118SubaccountSlot
} from './tax-provision-helpers';

export { buildExchangeFluctuationMovements };

export interface TaxProvisionOptions {
  roundArt20Cff?: boolean;
  capIva118ToBookBalance?: boolean;
}

/**
 * Motor Contable para Provisión Mensual de Impuestos Federales (ISR Día 17 e IVA Definitivo).
 * Cumple con Art. 28 Fracc. I LISR (ISR No Deducible), Art. 5-D LIVA y Art. 20 CFF (redondeo ±$0.50).
 */
export function buildTaxProvisionMovements(
  wp: FiscalWorkpaperResponse,
  accounts: readonly (Account | AccountWithBalance)[],
  periodo: number,
  ejercicio: number,
  options?: TaxProvisionOptions
): AutoPolizaMovementDraft[] {
  const isrNetoCents = toCents(wp.isrProvisional.isrNetoAPagar);
  const isrCausadoCents = toCents(wp.isrProvisional.isrCausado);
  const pagosPreviosCents = toCents(wp.isrProvisional.pagosProvisionalesPrevios);
  const isrRetFavorCents = toCents(wp.isrProvisional.isrRetenidoPeriodo);
  const isrRetMesRawCents = toCents(
    wp.isrProvisional.isrRetenidoMesActual ?? wp.isrProvisional.isrRetenidoPeriodo
  );
  const accIsrRetFavorRaw =
    accounts.find((a) => a.isAffectable && (a.code === '113-02-001' || a.satGroupCode === '113.02')) ?? null;
  const accIsrRetBal = accIsrRetFavorRaw as (Account & Partial<AccountWithBalance>) | null;
  const has113Activity =
    accIsrRetBal !== null &&
    typeof accIsrRetBal.finalBalance === 'number' &&
    (accIsrRetBal.finalBalance > 0 ||
      (accIsrRetBal.periodCharges ?? 0) > 0 ||
      (accIsrRetBal.periodCredits ?? 0) > 0);
  const remaining113Cents = has113Activity
    ? Math.max(0, toCents(accIsrRetBal!.finalBalance ?? 0))
    : Number.MAX_SAFE_INTEGER;
  const isrAntesRetCents =
    isrCausadoCents > 0
      ? Math.max(0, isrCausadoCents - pagosPreviosCents)
      : isrNetoCents + isrRetFavorCents;
  const isrRetAplicadoMesCents =
    isrRetMesRawCents > 0
      ? Math.min(isrAntesRetCents, isrRetMesRawCents, remaining113Cents)
      : 0;
  const isrGastoCents = isrNetoCents + isrRetAplicadoMesCents;

  const ivaCobradoCents = toCents(wp.ivaDefinitivo.ivaTrasladadoCobrado);
  const ivaPagadoCents = toCents(wp.ivaDefinitivo.ivaAcreditablePagado);
  const ivaSinProrrateoCents = wp.ivaBreakdown
    ? toCents(wp.ivaBreakdown.ivaAcreditableSinProrrateo)
    : ivaPagadoCents;
  const ivaNoAcreditableCents = Math.max(0, ivaSinProrrateoCents - ivaPagadoCents);

  assertAccountingInvariant(
    isrGastoCents > 0 || ivaCobradoCents > 0 || ivaPagadoCents > 0 || ivaNoAcreditableCents > 0,
    'NO_TAXES_TO_PROVISION',
    'No existen importes de ISR Provisional ni de IVA por provisionar en este periodo.'
  );

  const accGastoFiscal = resolveFiscalAccount(accounts, 'GASTO_IMPUESTO_UTILIDAD');
  const accIsrPorPagar = resolveFiscalAccount(accounts, 'PROVISION_ISR_POR_PAGAR');
  const ivaCobradoAccounts = resolveIvaCobradoAccounts(accounts);
  const accIvaCobrado = ivaCobradoAccounts[0] ?? resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');
  const ivaPagadoAccounts = resolveIvaPagadoAccounts(accounts);
  const accIvaPagado = ivaPagadoAccounts[0] ?? resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO');
  const accIvaPorPagar = resolveFiscalAccount(accounts, 'PROVISION_IVA_POR_PAGAR');
  const accIvaFavor = resolveFiscalAccount(accounts, 'IVA_A_FAVOR');
  const accIvaFavorBal = accIvaFavor as Account & Partial<AccountWithBalance>;
  const max113FavorCents =
    typeof accIvaFavorBal.finalBalance === 'number'
      ? Math.max(0, toCents(accIvaFavorBal.finalBalance))
      : Number.MAX_SAFE_INTEGER;

  const has118Activity = ivaPagadoAccounts.some((a) => {
    const b = a as Account & Partial<AccountWithBalance>;
    return (
      typeof b.finalBalance === 'number' &&
      (b.finalBalance > 0 || (b.periodCharges ?? 0) > 0 || (b.periodCredits ?? 0) > 0)
    );
  });
  const enforce118Cap = Boolean(options?.capIva118ToBookBalance) || has118Activity;
  const slots118: Iva118SubaccountSlot[] = ivaPagadoAccounts.map((a) => {
    const b = a as Account & Partial<AccountWithBalance>;
    return {
      account: a,
      remainingCents: enforce118Cap ? Math.max(0, toCents(b.finalBalance ?? 0)) : Number.MAX_SAFE_INTEGER
    };
  });
  const total118BookCents = enforce118Cap
    ? slots118.reduce((sum, s) => sum + s.remainingCents, 0)
    : Number.MAX_SAFE_INTEGER;
  const isPm601 =
    !wp.isrProvisional.esResico &&
    wp.company.rfc.trim().length !== 13 &&
    wp.company.regimenFiscal.slice(0, 3) === '601';
  const effSinProrrateoCents =
    isPm601 &&
    enforce118Cap &&
    (wp.ivaBreakdown?.prorationFactor ?? 1) < 1 &&
    (ivaSinProrrateoCents === 0 || (total118BookCents >= ivaPagadoCents && ivaSinProrrateoCents < ivaPagadoCents))
      ? total118BookCents
      : ivaSinProrrateoCents;
  const effIvaNoAcredCents = Math.max(0, effSinProrrateoCents - ivaPagadoCents);
  const applyArt20 = Boolean(options?.roundArt20Cff);
  const movements: AutoPolizaMovementDraft[] = [];

  // 1. Provisión de ISR Provisional (No deducible Art. 28 Fracc. I LISR / NIF D-4)
  if (isrGastoCents > 0) {
    const isrPayableCents = applyArt20 && isrNetoCents > 0 ? roundArt20Cff(isrNetoCents, { isCents: true }) * 100 : isrNetoCents;
    const isrRoundingDiff = isrPayableCents - isrNetoCents;
    assertAccountingInvariant(Math.abs(isrRoundingDiff) <= 50, 'ART20_ROUNDING_EXCEEDED', 'Ajuste por redondeo Art. 20 CFF fuera de rango ±$0.50.');

    movements.push({
      accountId: accGastoFiscal.id,
      accountCode: accGastoFiscal.code,
      accountName: accGastoFiscal.name,
      referencia: `ISR-M${periodo}`,
      concepto: `Provisión de Pago Provisional de ISR (No Deducible Art. 28 LISR) ${periodo}/${ejercicio}`,
      cargo: fromCents(isrGastoCents),
      abono: 0
    });
    if (isrRetAplicadoMesCents > 0) {
      const accIsrRetFavor = resolveFiscalAccount(accounts, 'ISR_ACREDITABLE_RETENIDO');
      movements.push({
        accountId: accIsrRetFavor.id,
        accountCode: accIsrRetFavor.code,
        accountName: accIsrRetFavor.name,
        referencia: `ISR-M${periodo}`,
        concepto: `Acreditamiento de ISR Retenido por Clientes contra ISR (${periodo}/${ejercicio})`,
        cargo: 0,
        abono: fromCents(isrRetAplicadoMesCents)
      });
    }
    if (isrPayableCents > 0) {
      movements.push({
        accountId: accIsrPorPagar.id,
        accountCode: accIsrPorPagar.code,
        accountName: accIsrPorPagar.name,
        referencia: `ISR-M${periodo}`,
        concepto: `ISR Provisional por pagar SAT Día 17 (${periodo}/${ejercicio})`,
        cargo: 0,
        abono: fromCents(isrPayableCents)
      });
    }
    if (isrRoundingDiff !== 0) {
      const accRound = resolveFiscalAccount(accounts, 'GASTO_NO_DEDUCIBLE');
      movements.push({
        accountId: accRound.id,
        accountCode: accRound.code,
        accountName: accRound.name,
        referencia: `ISR-M${periodo}`,
        concepto: 'Ajuste por redondeo fiscal Art. 20 CFF (ISR)',
        cargo: isrRoundingDiff > 0 ? fromCents(isrRoundingDiff) : 0,
        abono: isrRoundingDiff < 0 ? fromCents(Math.abs(isrRoundingDiff)) : 0
      });
    }
  }

  // 2. Liquidación y cancelación mensual de IVA Trasladado Cobrado y Acreditable Pagado
  if (ivaCobradoCents > 0 || ivaPagadoCents > 0 || effIvaNoAcredCents > 0) {
    if (ivaCobradoCents >= ivaPagadoCents) {
      push208Subaccounts(movements, ivaCobradoAccounts, accIvaCobrado, ivaCobradoCents, `IVA-M${periodo}`);
      const creditedIvaCents =
        ivaPagadoCents > 0
          ? credit118Subaccounts(
              movements,
              slots118,
              accIvaPagado,
              ivaPagadoCents,
              enforce118Cap,
              `IVA-M${periodo}`,
              'Acreditamiento de IVA Pagado del periodo'
            )
          : 0;
      const ivaPorPagarCents = ivaCobradoCents - creditedIvaCents;
      const retFavorCents = toCents(wp.ivaDefinitivo.ivaRetenidoAcreditable ?? 0);
      const saldoFavorAntCents = toCents(wp.ivaDefinitivo.saldoFavorIvaAcreditable ?? 0);
      const retAplicadaCents = Math.min(ivaPorPagarCents, retFavorCents);
      const retFavorExcedenteCents = retFavorCents - retAplicadaCents;
      const remanente1Cents = ivaPorPagarCents - retAplicadaCents;
      const saldoFavorAntAplicadoCents = Math.min(remanente1Cents, saldoFavorAntCents, max113FavorCents);
      const ivaNetoCents = remanente1Cents - saldoFavorAntAplicadoCents;

      if (retFavorCents > 0) {
        const accRetFavor = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_RETENIDO');
        movements.push({
          accountId: accRetFavor.id,
          accountCode: accRetFavor.code,
          accountName: accRetFavor.name,
          referencia: `IVA-M${periodo}`,
          concepto: 'Acreditamiento de IVA Retenido por Clientes',
          cargo: 0,
          abono: fromCents(retFavorCents)
        });
      }

      if (retFavorExcedenteCents > 0) {
        movements.push({
          accountId: accIvaFavor.id,
          accountCode: accIvaFavor.code,
          accountName: accIvaFavor.name,
          referencia: `IVA-M${periodo}`,
          concepto: `Remanente de IVA Saldo a Favor por Retenciones (${periodo}/${ejercicio})`,
          cargo: fromCents(retFavorExcedenteCents),
          abono: 0
        });
      }

      if (saldoFavorAntAplicadoCents > 0) {
        movements.push({
          accountId: accIvaFavor.id,
          accountCode: accIvaFavor.code,
          accountName: accIvaFavor.name,
          referencia: `IVA-M${periodo}`,
          concepto: 'Compensación de Saldo a Favor de IVA de meses anteriores',
          cargo: 0,
          abono: fromCents(saldoFavorAntAplicadoCents)
        });
      }

      if (ivaNetoCents > 0) {
        const ivaPayableCents = applyArt20 ? roundArt20Cff(ivaNetoCents, { isCents: true }) * 100 : ivaNetoCents;
        const ivaRoundingDiff = ivaPayableCents - ivaNetoCents;
        assertAccountingInvariant(Math.abs(ivaRoundingDiff) <= 50, 'ART20_ROUNDING_EXCEEDED', 'Ajuste por redondeo Art. 20 CFF fuera de rango ±$0.50.');
        if (ivaPayableCents > 0) {
          movements.push({
            accountId: accIvaPorPagar.id,
            accountCode: accIvaPorPagar.code,
            accountName: accIvaPorPagar.name,
            referencia: `IVA-M${periodo}`,
            concepto: `IVA Definitivo por pagar SAT Día 17 (${periodo}/${ejercicio})`,
            cargo: 0,
            abono: fromCents(ivaPayableCents)
          });
        }
        if (ivaRoundingDiff !== 0) {
          const accRound = resolveFiscalAccount(accounts, 'GASTO_NO_DEDUCIBLE');
          movements.push({
            accountId: accRound.id,
            accountCode: accRound.code,
            accountName: accRound.name,
            referencia: `IVA-M${periodo}`,
            concepto: 'Ajuste por redondeo fiscal Art. 20 CFF (IVA)',
            cargo: ivaRoundingDiff > 0 ? fromCents(ivaRoundingDiff) : 0,
            abono: ivaRoundingDiff < 0 ? fromCents(Math.abs(ivaRoundingDiff)) : 0
          });
        }
      }
    } else {
      push208Subaccounts(movements, ivaCobradoAccounts, accIvaCobrado, ivaCobradoCents, `IVA-M${periodo}`);
      const retFavorCents = toCents(wp.ivaDefinitivo.ivaRetenidoAcreditable ?? 0);
      const effectiveCreditedCents = Math.min(ivaPagadoCents, total118BookCents);
      const saldoFavorCents = Math.max(0, effectiveCreditedCents - ivaCobradoCents + retFavorCents);
      if (saldoFavorCents > 0) {
        movements.push({
          accountId: accIvaFavor.id,
          accountCode: accIvaFavor.code,
          accountName: accIvaFavor.name,
          referencia: `IVA-M${periodo}`,
          concepto: `Determinación de IVA Saldo a Favor del periodo (${periodo}/${ejercicio})`,
          cargo: fromCents(saldoFavorCents),
          abono: 0
        });
      }
      credit118Subaccounts(
        movements,
        slots118,
        accIvaPagado,
        effectiveCreditedCents,
        enforce118Cap,
        `IVA-M${periodo}`,
        'Cancelación de IVA Acreditable Pagado contra Saldo a Favor'
      );
      if (retFavorCents > 0) {
        const accRetFavor = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_RETENIDO');
        movements.push({
          accountId: accRetFavor.id,
          accountCode: accRetFavor.code,
          accountName: accRetFavor.name,
          referencia: `IVA-M${periodo}`,
          concepto: 'Cancelación de IVA Retenido por Clientes contra Saldo a Favor',
          cargo: 0,
          abono: fromCents(retFavorCents)
        });
      }
      const uncoveredIvaCents = Math.max(0, ivaCobradoCents - effectiveCreditedCents - retFavorCents);
      if (uncoveredIvaCents > 0) {
        movements.push({
          accountId: accIvaPorPagar.id,
          accountCode: accIvaPorPagar.code,
          accountName: accIvaPorPagar.name,
          referencia: `IVA-M${periodo}`,
          concepto: `IVA trasladado pendiente por diferencia en saldo de 118 (${periodo}/${ejercicio})`,
          cargo: 0,
          abono: fromCents(uncoveredIvaCents)
        });
      }
    }
    appendIvaNoAcreditableMovements(
      movements,
      accounts,
      slots118,
      accIvaPagado,
      enforce118Cap,
      effIvaNoAcredCents,
      periodo
    );
  }

  return movements;
}

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

/**
 * Motor Contable para Provisión Mensual de Impuestos Federales (ISR Día 17 e IVA Definitivo).
 * Cumple con Art. 28 Fracc. I LISR (ISR No Deducible) y Art. 5-D LIVA (Liquidación de IVA).
 */
export function buildTaxProvisionMovements(
  wp: FiscalWorkpaperResponse,
  accounts: readonly Account[],
  periodo: number,
  ejercicio: number
): AutoPolizaMovementDraft[] {
  const isrNetoCents = toCents(wp.isrProvisional.isrNetoAPagar);
  const ivaCobradoCents = toCents(wp.ivaDefinitivo.ivaTrasladadoCobrado);
  const ivaPagadoCents = toCents(wp.ivaDefinitivo.ivaAcreditablePagado);

  assertAccountingInvariant(
    isrNetoCents > 0 || ivaCobradoCents > 0 || ivaPagadoCents > 0,
    'NO_TAXES_TO_PROVISION',
    'No existen importes de ISR Provisional ni de IVA por provisionar en este periodo.'
  );

  const accGastoFiscal = resolveFiscalAccount(accounts, 'GASTO_IMPUESTO_UTILIDAD');
  const accIsrPorPagar = resolveFiscalAccount(accounts, 'PROVISION_ISR_POR_PAGAR');
  const accIvaCobrado = resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');
  const accIvaPagado = resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO');
  const accIvaPorPagar = resolveFiscalAccount(accounts, 'PROVISION_IVA_POR_PAGAR');
  const accIvaFavor = resolveFiscalAccount(accounts, 'IVA_A_FAVOR');

  const movements: AutoPolizaMovementDraft[] = [];

  // 1. Provisión de ISR Provisional (No deducible Art. 28 Fracc. I LISR / NIF D-4)
  if (isrNetoCents > 0) {
    movements.push(
      {
        accountId: accGastoFiscal.id,
        accountCode: accGastoFiscal.code,
        accountName: accGastoFiscal.name,
        referencia: `ISR-M${periodo}`,
        concepto: `Provisión de Pago Provisional de ISR (No Deducible Art. 28 LISR) ${periodo}/${ejercicio}`,
        cargo: fromCents(isrNetoCents),
        abono: 0
      },
      {
        accountId: accIsrPorPagar.id,
        accountCode: accIsrPorPagar.code,
        accountName: accIsrPorPagar.name,
        referencia: `ISR-M${periodo}`,
        concepto: `ISR Provisional por pagar SAT Día 17 (${periodo}/${ejercicio})`,
        cargo: 0,
        abono: fromCents(isrNetoCents)
      }
    );
  }

  // 2. Liquidación y cancelación mensual de IVA Trasladado Cobrado y Acreditable Pagado
  if (ivaCobradoCents > 0 || ivaPagadoCents > 0) {
    if (ivaCobradoCents >= ivaPagadoCents) {
      // Caso A: IVA Neto por Pagar al SAT
      if (ivaCobradoCents > 0) {
        movements.push({
          accountId: accIvaCobrado.id,
          accountCode: accIvaCobrado.code,
          accountName: accIvaCobrado.name,
          referencia: `IVA-M${periodo}`,
          concepto: 'Cancelación mensual de IVA Trasladado Cobrado',
          cargo: fromCents(ivaCobradoCents),
          abono: 0
        });
      }
      if (ivaPagadoCents > 0) {
        movements.push({
          accountId: accIvaPagado.id,
          accountCode: accIvaPagado.code,
          accountName: accIvaPagado.name,
          referencia: `IVA-M${periodo}`,
          concepto: 'Acreditamiento de IVA Pagado del periodo',
          cargo: 0,
          abono: fromCents(ivaPagadoCents)
        });
      }
      const ivaPorPagarCents = ivaCobradoCents - ivaPagadoCents;
      const retFavorCents = toCents(wp.ivaDefinitivo.ivaRetenidoAcreditable ?? 0);
      const saldoFavorAntCents = toCents(wp.ivaDefinitivo.saldoFavorIvaAcreditable ?? 0);
      const retAplicadaCents = Math.min(ivaPorPagarCents, retFavorCents);
      const retFavorExcedenteCents = retFavorCents - retAplicadaCents;
      const remanente1Cents = ivaPorPagarCents - retAplicadaCents;
      const saldoFavorAntAplicadoCents = Math.min(remanente1Cents, saldoFavorAntCents);
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
        movements.push({
          accountId: accIvaPorPagar.id,
          accountCode: accIvaPorPagar.code,
          accountName: accIvaPorPagar.name,
          referencia: `IVA-M${periodo}`,
          concepto: `IVA Definitivo por pagar SAT Día 17 (${periodo}/${ejercicio})`,
          cargo: 0,
          abono: fromCents(ivaNetoCents)
        });
      }
    } else {
      // Caso B: IVA Saldo a Favor del Contribuyente (Art. 5-D LIVA)
      if (ivaCobradoCents > 0) {
        movements.push({
          accountId: accIvaCobrado.id,
          accountCode: accIvaCobrado.code,
          accountName: accIvaCobrado.name,
          referencia: `IVA-M${periodo}`,
          concepto: 'Cancelación mensual de IVA Trasladado Cobrado',
          cargo: fromCents(ivaCobradoCents),
          abono: 0
        });
      }
      const retFavorCents = toCents(wp.ivaDefinitivo.ivaRetenidoAcreditable ?? 0);
      const saldoFavorCents = ivaPagadoCents - ivaCobradoCents + retFavorCents;
      movements.push({
        accountId: accIvaFavor.id,
        accountCode: accIvaFavor.code,
        accountName: accIvaFavor.name,
        referencia: `IVA-M${periodo}`,
        concepto: `Determinación de IVA Saldo a Favor del periodo (${periodo}/${ejercicio})`,
        cargo: fromCents(saldoFavorCents),
        abono: 0
      });
      movements.push({
        accountId: accIvaPagado.id,
        accountCode: accIvaPagado.code,
        accountName: accIvaPagado.name,
        referencia: `IVA-M${periodo}`,
        concepto: 'Cancelación de IVA Acreditable Pagado contra Saldo a Favor',
        cargo: 0,
        abono: fromCents(ivaPagadoCents)
      });
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
    }
  }

  return movements;
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

import type { Account, CfdiDocument, PolizaType } from '../types';
import { extractNominaOtrosPagos } from '../cfdi-xml';
import { assertAccountingInvariant } from './invariants-and-math';
import type { AutoPolizaMovementDraft, AutoPolizaOverrides } from './auto-poliza-types';
import { resolveFiscalAccount } from './auto-poliza-account-resolver';
import {
  extractNominaPayrollSplits,
  makeDraft,
  resolveEmployeeReceivableAccount,
  toMxnCents
} from './auto-poliza-helpers';

export function buildPayrollNominaMovements(
  cfdi: CfdiDocument,
  accounts: readonly Account[],
  overrides?: AutoPolizaOverrides
): { polizaType: PolizaType; polizaConcept: string; movements: AutoPolizaMovementDraft[] } {
  assertAccountingInvariant(
    cfdi.direction !== 'RECIBIDO',
    'CFDI_NOMINA_RECIBIDO',
    'Los CFDI de Nómina recibidos (direction RECIBIDO) no generan póliza de nómina patronal.'
  );
  const ref = `${cfdi.serie}-${cfdi.folio}`;
  const opOverride = overrides?.operationAccountCode ?? overrides?.expenseOrIncomeAccountId;
  const counterOverride = overrides?.counterAccountCode ?? overrides?.bankOrCounterpartyAccountId;

  const accSueldos = resolveFiscalAccount(accounts, 'SUELDOS_Y_SALARIOS', opOverride);
  const accBancos = resolveFiscalAccount(accounts, 'BANCO_SECUNDARIO', counterOverride);
  const accIsrRetPorPagar = resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');

  const subtotalCents = toMxnCents(cfdi.subtotal, cfdi);
  const rawOtrosPagos = extractNominaOtrosPagos(cfdi.xmlRaw);
  const otrosPagosCents = Math.min(subtotalCents, toMxnCents(rawOtrosPagos, cfdi));
  const nomSplits = extractNominaPayrollSplits(cfdi.xmlRaw);
  const subsidioCents = nomSplits.hasOtroPagoTags
    ? Math.min(otrosPagosCents, nomSplits.subsidioCents)
    : otrosPagosCents;
  const nonSubsidioOtrosCents = Math.max(0, otrosPagosCents - subsidioCents);
  const sueldosGravadosCents = Math.max(0, subtotalCents - subsidioCents);

  const isrCents = toMxnCents(cfdi.isrRetenido, cfdi);
  const imssDescuentoCents = toMxnCents(cfdi.descuento, cfdi);
  let totalCents = toMxnCents(cfdi.total, cfdi);

  const cargosTotal = sueldosGravadosCents + subsidioCents;
  const abonosTotal = isrCents + imssDescuentoCents + totalCents;
  if (cargosTotal !== abonosTotal) {
    totalCents += cargosTotal - abonosTotal;
  }

  const movements: AutoPolizaMovementDraft[] = [];
  if (sueldosGravadosCents > 0) {
    const sueldoDirectoCents = Math.max(0, sueldosGravadosCents - nonSubsidioOtrosCents);
    if (sueldoDirectoCents > 0) {
      movements.push(makeDraft(accSueldos, ref, sueldoDirectoCents, 0, cfdi.conceptoPrincipal));
    }
    if (nonSubsidioOtrosCents > 0) {
      movements.push(
        makeDraft(accSueldos, ref, nonSubsidioOtrosCents, 0, `Otros pagos gravados/no subsidio Nómina ${ref}`)
      );
    }
  }
  if (subsidioCents > 0) {
    const accSubsidio = resolveFiscalAccount(accounts, 'ISR_ACREDITABLE_RETENIDO');
    movements.push(
      makeDraft(accSubsidio, ref, subsidioCents, 0, `Subsidio al Empleo Nómina ${ref}`)
    );
  }
  if (isrCents > 0) {
    movements.push(
      makeDraft(accIsrRetPorPagar, ref, 0, isrCents, `Retenciones ISR Nómina ${ref}`)
    );
  }
  if (imssDescuentoCents > 0) {
    const accOtrasRet = resolveFiscalAccount(accounts, 'OTRAS_CUENTAS_POR_PAGAR');
    if (nomSplits.hasDeduccionTags && nomSplits.otherNonIsrDeduccionesCents > 0) {
      const imssPart = Math.min(imssDescuentoCents, nomSplits.imssObreroCents);
      const otherPart = Math.max(0, imssDescuentoCents - imssPart);
      if (imssPart > 0) {
        movements.push(makeDraft(accOtrasRet, ref, 0, imssPart, `Cuotas Obreras IMSS ${ref}`));
      }
      if (otherPart > 0) {
        const accOtherDed =
          accounts.find((a) => a.isAffectable && (a.code === '205-01-001' || a.code.startsWith('205-'))) ??
          accOtrasRet;
        movements.push(makeDraft(accOtherDed, ref, 0, otherPart, `Otras deducciones nómina ${ref}`));
      }
    } else {
      movements.push(
        makeDraft(accOtrasRet, ref, 0, imssDescuentoCents, `Cuotas Obreras IMSS / Descuentos ${ref}`)
      );
    }
  }
  if (totalCents < 0) {
    const accDeudores = resolveEmployeeReceivableAccount(accounts, accBancos);
    movements.push(
      makeDraft(
        accDeudores,
        ref,
        Math.abs(totalCents),
        0,
        `Saldo a cargo de empleado / Deudores diversos nómina ${ref} - ${cfdi.receptorNombre}`
      )
    );
  } else if (totalCents > 0) {
    movements.push(
      makeDraft(accBancos, ref, 0, totalCents, `Pago neto nómina ${ref} - ${cfdi.receptorNombre}`)
    );
  }

  return {
    polizaType: overrides?.polizaType ?? 'EGRESO',
    polizaConcept: `Nómina ${ref} - ${cfdi.receptorNombre}`,
    movements
  };
}

import {
  assertAccountingInvariant,
  buildExchangeFluctuationMovements,
  buildTaxProvisionMovements
} from '../../shared/accounting-engine';
import { getDefaultDateForPeriod } from '../../shared/date-utils';
import type { Poliza } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { createPolizaTransaction, getPolizas } from './polizas.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { getFiscalWorkpaperReport } from './fiscal.repo';

export function generateExchangeFluctuationPoliza(
  companyId: string,
  ejercicio: number,
  periodo: number
): Poliza {
  assertPeriodOpen(companyId, ejercicio, periodo);

  const existing = getPolizas(companyId, ejercicio, periodo);
  const hasExchangePoliza = existing.some((p) => {
    const lower = p.concepto.toLowerCase();
    return (
      lower.includes('fluctuación cambiaria') ||
      lower.includes('fluctuacion cambiaria') ||
      p.movements.some((m) => m.referencia.startsWith('TC-DOF-'))
    );
  });
  assertAccountingInvariant(
    !hasExchangePoliza,
    'DUPLICATE_EXCHANGE_POLIZA',
    `Ya existe una póliza de fluctuación cambiaria USD registrada para ${ejercicio}-${String(periodo).padStart(2, '0')}.`
  );

  const wp = getFiscalWorkpaperReport(companyId, ejercicio, periodo);
  const accounts = getAccounts(companyId);
  const plan = buildExchangeFluctuationMovements(wp, accounts);
  const fecha = getDefaultDateForPeriod(ejercicio, periodo);

  return createPolizaTransaction({
    companyId,
    ejercicio,
    periodo,
    tipo: 'DIARIO',
    fecha,
    concepto: plan.concept,
    cfdiUuid: null,
    origin: 'MANUAL',
    movements: plan.movements
  });
}

export function generateTaxProvisionPoliza(
  companyId: string,
  ejercicio: number,
  periodo: number
): Poliza {
  assertPeriodOpen(companyId, ejercicio, periodo);

  const existing = getPolizas(companyId, ejercicio, periodo);
  const hasProvisionPoliza = existing.some((p) => {
    const lower = p.concepto.toLowerCase();
    return (
      lower.includes('provisión de impuestos') ||
      lower.includes('provision de impuestos') ||
      p.movements.some((m) => m.referencia === `ISR-M${periodo}` || m.referencia === `IVA-M${periodo}`)
    );
  });
  assertAccountingInvariant(
    !hasProvisionPoliza,
    'DUPLICATE_TAX_PROVISION',
    `Ya existe una póliza de provisión de impuestos ISR/IVA registrada para ${ejercicio}-${String(periodo).padStart(2, '0')}.`
  );

  const wp = getFiscalWorkpaperReport(companyId, ejercicio, periodo);
  const accounts = getAccounts(companyId);
  const movements = buildTaxProvisionMovements(wp, accounts, periodo, ejercicio);
  const fecha = getDefaultDateForPeriod(ejercicio, periodo);

  return createPolizaTransaction({
    companyId,
    ejercicio,
    periodo,
    tipo: 'DIARIO',
    fecha,
    concepto: `Póliza de Provisión de Impuestos Federales ISR e IVA (${periodo}/${ejercicio})`,
    cfdiUuid: null,
    origin: 'MANUAL',
    movements
  });
}

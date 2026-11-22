import {
  buildExchangeFluctuationMovements,
  buildTaxProvisionMovements
} from '../../shared/accounting-engine';
import { getDefaultDateForPeriod } from '../../shared/date-utils';
import type { Poliza } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { createPolizaTransaction } from './polizas.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { getFiscalWorkpaperReport } from './fiscal.repo';

export function generateExchangeFluctuationPoliza(
  companyId: string,
  ejercicio: number,
  periodo: number
): Poliza {
  assertPeriodOpen(companyId, ejercicio, periodo);

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

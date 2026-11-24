import type { Poliza, PolizaType } from '../types';
import { fromCents, sumCents, toCents } from './invariants-and-math';

export interface InversePolizaDraft {
  companyId: string;
  tipo: PolizaType;
  fecha: string;
  periodo: number;
  concepto: string;
  cfdiUuid: null;
  cfdiUuids: [];
  origin: 'MANUAL';
  movements: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    referencia: string;
    concepto: string;
    cargo: number;
    abono: number;
    cfdiUuid: null;
  }>;
  totalCargos: number;
  totalAbonos: number;
  isBalanced: boolean;
}

/**
 * Construye el borrador de una Póliza Inversa (reversión contable 1-clic):
 * intercambia cargo <-> abono en todas las partidas, prefija el concepto
 * con "Reverso de [TIPO] #[FOLIO]: ..." y no vincula cfdiUuid por duplicado.
 */
export function buildInversePolizaDraft(
  source: Poliza,
  options?: {
    fecha?: string;
    periodo?: number;
  }
): InversePolizaDraft {
  const targetFecha = options?.fecha || source.fecha;
  const targetPeriodo = options?.periodo ?? source.periodo;
  const movements = source.movements.map((m) => ({
    accountId: m.accountId,
    accountCode: m.accountCode,
    accountName: m.accountName,
    referencia: m.referencia || `${source.tipo.slice(0, 1)}-${source.folio}`,
    concepto: `Reverso: ${m.concepto || source.concepto}`,
    cargo: fromCents(toCents(m.abono)),
    abono: fromCents(toCents(m.cargo)),
    cfdiUuid: null
  }));

  const totalCargosCents = sumCents(movements.map((m) => m.cargo));
  const totalAbonosCents = sumCents(movements.map((m) => m.abono));

  return {
    companyId: source.companyId,
    tipo: source.tipo,
    fecha: targetFecha,
    periodo: targetPeriodo,
    concepto: `Reverso de ${source.tipo} #${source.folio}: ${source.concepto}`,
    cfdiUuid: null,
    cfdiUuids: [],
    origin: 'MANUAL',
    movements,
    totalCargos: fromCents(totalCargosCents),
    totalAbonos: fromCents(totalAbonosCents),
    isBalanced: totalCargosCents === totalAbonosCents && totalCargosCents > 0
  };
}

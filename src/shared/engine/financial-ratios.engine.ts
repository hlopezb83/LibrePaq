import type { FinancialStatementsResponse } from '../types';
import { getCodePrefixNumber } from './financial-reports-helpers';
import { fromCents, toCents } from './invariants-and-math';

export interface ExecutiveFinancialRatios {
  activoCirculante: number;
  activoNoCirculante: number;
  pasivoCortoPlazo: number;
  pasivoLargoPlazo: number;
  inventarios: number;
  capitalContable: number;
  capitalTrabajoNeto: number;
  razonCirculante: number | null;
  pruebaAcida: number | null;
  endeudamientoPct: number | null;
  apalancamiento: number | null;
  margenBrutoPct: number | null;
  margenOperativoPct: number | null;
  margenNetoPct: number | null;
  roePct: number | null;
}

/**
 * Calcula razones financieras clave de liquidez, solvencia y rentabilidad bajo NIF A-3 / B-3 / B-6.
 */
export function computeExecutiveFinancialRatios(
  reports: Pick<FinancialStatementsResponse, 'balanceSheet' | 'incomeStatement' | 'trialBalance'>
): ExecutiveFinancialRatios {
  const { balanceSheet: bs, incomeStatement: er, trialBalance } = reports;
  const nif = bs.nifB6;

  const activoCirculante = nif?.totalActivoCirculante ?? bs.totalActivo;
  const activoNoCirculante = nif?.totalActivoNoCirculante ?? 0;
  const pasivoCortoPlazo = nif?.totalPasivoCortoPlazo ?? bs.totalPasivo;
  const pasivoLargoPlazo = nif?.totalPasivoLargoPlazo ?? 0;
  const capitalContable = fromCents(toCents(bs.totalCapitalBase) + toCents(bs.utilidadEjercicio));

  const inventariosCents = trialBalance
    .filter((a) => a.type === 'ACTIVO' && a.isAffectable && getCodePrefixNumber(a) === 115)
    .reduce((sum, a) => sum + (a.nature === 'DEUDORA' ? 1 : -1) * toCents(a.finalBalance), 0);
  const inventarios = fromCents(inventariosCents);

  const capitalTrabajoNeto = fromCents(toCents(activoCirculante) - toCents(pasivoCortoPlazo));
  const razonCirculante =
    Math.abs(pasivoCortoPlazo) >= 0.01 ? Number((activoCirculante / pasivoCortoPlazo).toFixed(2)) : null;
  const pruebaAcida =
    Math.abs(pasivoCortoPlazo) >= 0.01
      ? Number(((activoCirculante - inventarios) / pasivoCortoPlazo).toFixed(2))
      : null;

  const endeudamientoPct =
    Math.abs(bs.totalActivo) >= 0.01
      ? Number(((bs.totalPasivo / bs.totalActivo) * 100).toFixed(1))
      : null;
  const apalancamiento =
    Math.abs(capitalContable) >= 0.01
      ? Number((bs.totalPasivo / capitalContable).toFixed(2))
      : null;

  const rev = er.totalIngresos;
  const utilidadOperativa = er.utilidadOperativa ?? er.utilidadBruta - er.totalGastos;
  const margenBrutoPct =
    Math.abs(rev) >= 0.01 ? Number(((er.utilidadBruta / rev) * 100).toFixed(1)) : null;
  const margenOperativoPct =
    Math.abs(rev) >= 0.01 ? Number(((utilidadOperativa / rev) * 100).toFixed(1)) : null;
  const margenNetoPct =
    Math.abs(rev) >= 0.01 ? Number(((er.utilidadNeta / rev) * 100).toFixed(1)) : null;
  const roePct =
    Math.abs(capitalContable) >= 0.01
      ? Number(((er.utilidadNeta / capitalContable) * 100).toFixed(1))
      : null;

  return {
    activoCirculante,
    activoNoCirculante,
    pasivoCortoPlazo,
    pasivoLargoPlazo,
    inventarios,
    capitalContable,
    capitalTrabajoNeto,
    razonCirculante,
    pruebaAcida,
    endeudamientoPct,
    apalancamiento,
    margenBrutoPct,
    margenOperativoPct,
    margenNetoPct,
    roePct
  };
}

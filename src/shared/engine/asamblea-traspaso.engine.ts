import type { Account, AccountWithBalance, Poliza, PolizaType } from '../types';
import { isResultOfExerciseAccount, resolveAccumulatedEarningsAccount } from './financial-reports-helpers';
import { fromCents, toCents } from './invariants-and-math';

export interface AsambleaTraspasoMatch {
  polizaId: string;
  tipo: PolizaType;
  folio: number;
  fecha: string;
  periodo: number;
  concepto: string;
  amount: number;
  touchedAccounts: string[];
}

export interface AsambleaTraspasoDraft {
  companyId: string;
  tipo: PolizaType;
  fecha: string;
  periodo: number;
  concepto: string;
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
}

export interface AsambleaTraspasoAnalysis {
  ejercicio: number;
  isJanuary: boolean;
  sourceAccount: Account | null;
  targetAccount: Account | null;
  saldo305: number;
  direction: 'UTILIDAD' | 'PERDIDA' | 'CERO';
  hasExistingManualPoliza: boolean;
  matchingPolizas: AsambleaTraspasoMatch[];
  canGenerate: boolean;
  blockReason: string | null;
  suggestedDraft: AsambleaTraspasoDraft | null;
}

function isAccumulatedEarningsTarget(acc: Pick<Account, 'code' | 'satGroupCode'>): boolean {
  return (
    acc.code.startsWith('301-02') ||
    acc.satGroupCode === '304.01' ||
    acc.satGroupCode.startsWith('304')
  );
}

/**
 * Analiza si procede el Traspaso de Resultados del Ejercicio (305-01-001 -> 301-02-001)
 * en Enero tras cierre anual, detectando pólizas manuales existentes para evitar doble conteo.
 */
export function analyzeAsambleaTraspaso(params: {
  companyId: string;
  ejercicio: number;
  periodo: number;
  accounts: ReadonlyArray<Account | AccountWithBalance>;
  polizasInYear: ReadonlyArray<Poliza>;
}): AsambleaTraspasoAnalysis {
  const { companyId, ejercicio, periodo, accounts, polizasInYear } = params;
  const isJanuary = periodo === 1;

  const accById = new Map(accounts.map((a) => [a.id, a]));
  const sourceAccount =
    accounts.find((a) => a.code === '305-01-001' && a.isAffectable) ??
    accounts.find((a) => isResultOfExerciseAccount(a) && a.isAffectable) ??
    null;

  let targetAccount: Account | null = null;
  try {
    const resolved = resolveAccumulatedEarningsAccount(accounts);
    if (resolved && resolved.id !== sourceAccount?.id) {
      targetAccount = resolved;
    }
  } catch {
    targetAccount = null;
  }

  let saldo305Cents = 0;
  if (sourceAccount) {
    const rawBal =
      'finalBalance' in sourceAccount && typeof sourceAccount.finalBalance === 'number'
        ? sourceAccount.finalBalance
        : sourceAccount.initialBalance;
    saldo305Cents = (sourceAccount.nature === 'ACREEDORA' ? 1 : -1) * toCents(rawBal);
  }

  const matchingPolizas: AsambleaTraspasoMatch[] = [];
  for (const pol of polizasInYear) {
    if (pol.ejercicio !== ejercicio) continue;
    if (String(pol.origin || '') === 'CIERRE_ANUAL') continue;

    const touched = new Set<string>();
    let maxTouchCents = 0;
    for (const mov of pol.movements) {
      const acc = accById.get(mov.accountId);
      const code = acc?.code ?? mov.accountCode;
      const sat = acc?.satGroupCode ?? '';
      const is305 = code.startsWith('305') || sat.startsWith('305');
      const is304 = isAccumulatedEarningsTarget({ code, satGroupCode: sat });
      if (is305 || is304) {
        touched.add(code);
        maxTouchCents = Math.max(maxTouchCents, toCents(mov.cargo), toCents(mov.abono));
      }
    }
    if (touched.size > 0) {
      matchingPolizas.push({
        polizaId: pol.id,
        tipo: pol.tipo,
        folio: pol.folio,
        fecha: pol.fecha,
        periodo: pol.periodo,
        concepto: pol.concepto,
        amount: fromCents(maxTouchCents),
        touchedAccounts: Array.from(touched)
      });
    }
  }

  const hasExistingManualPoliza = matchingPolizas.length > 0;
  const saldo305 = fromCents(saldo305Cents);
  const direction: AsambleaTraspasoAnalysis['direction'] =
    saldo305Cents > 0 ? 'UTILIDAD' : saldo305Cents < 0 ? 'PERDIDA' : 'CERO';

  let blockReason: string | null = null;
  if (!sourceAccount || !targetAccount) {
    blockReason = 'Faltan las cuentas 305-01-001 (Resultado del Ejercicio) o 301-02-001 (Resultados Acumulados) en el catálogo.';
  } else if (hasExistingManualPoliza) {
    blockReason = 'Se detectó al menos una póliza manual sobre 305-01-001 / 301-02-001 en este ejercicio. Verifica para evitar doble traspaso.';
  } else if (saldo305Cents === 0) {
    blockReason = 'La cuenta 305-01-001 tiene saldo $0.00; no hay resultado pendiente por traspasar.';
  }

  let suggestedDraft: AsambleaTraspasoDraft | null = null;
  if (sourceAccount && targetAccount && saldo305Cents !== 0) {
    const absAmount = fromCents(Math.abs(saldo305Cents));
    const isUtilidad = saldo305Cents > 0;
    const prevYear = ejercicio - 1;
    const concepto = `Traspaso de ${isUtilidad ? 'Utilidad' : 'Pérdida'} del Ejercicio ${prevYear} por Acuerdo de Asamblea`;
    suggestedDraft = {
      companyId,
      tipo: 'DIARIO',
      fecha: `${ejercicio}-01-01`,
      periodo: 1,
      concepto,
      movements: [
        {
          accountId: sourceAccount.id,
          accountCode: sourceAccount.code,
          accountName: sourceAccount.name,
          referencia: `ASAM-${ejercicio}`,
          concepto,
          cargo: isUtilidad ? absAmount : 0,
          abono: isUtilidad ? 0 : absAmount,
          cfdiUuid: null
        },
        {
          accountId: targetAccount.id,
          accountCode: targetAccount.code,
          accountName: targetAccount.name,
          referencia: `ASAM-${ejercicio}`,
          concepto,
          cargo: isUtilidad ? 0 : absAmount,
          abono: isUtilidad ? absAmount : 0,
          cfdiUuid: null
        }
      ]
    };
  }

  return {
    ejercicio,
    isJanuary,
    sourceAccount,
    targetAccount,
    saldo305,
    direction,
    hasExistingManualPoliza,
    matchingPolizas,
    canGenerate: Boolean(isJanuary && !hasExistingManualPoliza && saldo305Cents !== 0 && suggestedDraft),
    blockReason,
    suggestedDraft
  };
}

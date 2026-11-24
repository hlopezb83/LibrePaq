import { getOfficialInpc } from '../sat-inpc-catalog';
import { MESES_SAT } from '../sat-constants';
import type {
  AnnualFiscalReconciliation, AnnualInflationMonthlyRow, AnnualInflationResult,
  AnnualTaxDetermination, AnnualTaxInputs, AnnualTaxRegimeType, AnnualTaxSummaryResponse
} from '../types/annual-tax.types';
import type { AccountWithBalance, Company } from '../types/core.types';
import { calculateArt106PfIsr } from './art106-tax.engine';
import { fromCents, toCents } from './invariants-and-math';

export interface AnnualTaxMonthlyBalance { periodo: number; accounts: readonly AccountWithBalance[]; }
export type AnnualMonthlyBalancesInput =
  | ReadonlyArray<AnnualTaxMonthlyBalance>
  | ReadonlyMap<number, readonly AccountWithBalance[]>
  | Record<number, readonly AccountWithBalance[]>;

export interface ComputeAnnualTaxParams {
  company: Company;
  ejercicio: number;
  trialBalance: readonly AccountWithBalance[];
  monthlyBalancesByPeriod: AnnualMonthlyBalancesInput;
  fixedAssetsFiscalDeduction: number;
  paymentsProvisioned: number;
  inputs: Partial<AnnualTaxInputs>;
  perdidasFiscalesPendientes?: number;
  isrRetenidoAcreditable?: number;
}

const CREDIT_PREFIXES = ['102', '105', '107'] as const;
const DEBT_PREFIXES = ['201', '205', '252'] as const;

function pickEvalAccounts(accounts: readonly AccountWithBalance[]): AccountWithBalance[] {
  const affectable = accounts.filter((a) => a.isAffectable);
  return affectable.length > 0 ? affectable : accounts.filter((a) => a.level >= 2);
}

function hasPrefix(acc: AccountWithBalance, prefixes: readonly string[]): boolean {
  const code = acc.code ?? '';
  const sat = acc.satGroupCode ?? '';
  return prefixes.some((p) => code.startsWith(p) || sat.startsWith(p));
}

function normalizeMonthlyBalances(
  input: AnnualMonthlyBalancesInput,
  fallbackTrialBalance: readonly AccountWithBalance[]
): AnnualTaxMonthlyBalance[] {
  const map = new Map<number, readonly AccountWithBalance[]>();
  if (input instanceof Map) {
    for (const [p, accs] of input.entries()) if (p >= 1 && p <= 12) map.set(p, accs);
  } else if (Array.isArray(input)) {
    for (const item of input) if (item && item.periodo >= 1 && item.periodo <= 12) map.set(item.periodo, item.accounts);
  } else if (input && typeof input === 'object') {
    for (const [k, accs] of Object.entries(input)) {
      const p = Number(k);
      if (p >= 1 && p <= 12 && Array.isArray(accs)) map.set(p, accs);
    }
  }
  if (map.size === 0) {
    return Array.from({ length: 12 }, (_, idx) => ({ periodo: idx + 1, accounts: fallbackTrialBalance }));
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([periodo, accounts]) => ({ periodo, accounts }));
}

function truncate4(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor((value + 1e-12) * 10000) / 10000;
}

export function resolveAnnualInpcPair(
  ejercicio: number,
  inpcAnterior?: number,
  inpcActual?: number
): { inpcCierreAnterior: number; inpcCierreActual: number } {
  const fallbackAnt = getOfficialInpc(ejercicio - 1, 12) ?? 139.38;
  const fallbackAct = getOfficialInpc(ejercicio, 12) ?? 145.4;
  return {
    inpcCierreAnterior: inpcAnterior !== undefined && Number(inpcAnterior) > 0 ? Number(inpcAnterior) : fallbackAnt,
    inpcCierreActual: inpcActual !== undefined && Number(inpcActual) > 0 ? Number(inpcActual) : fallbackAct
  };
}

export function calculateResicoPfAnnualIsr(annualRevenueCents: number): { isrCents: number; ratePct: number } {
  if (annualRevenueCents <= 0) return { isrCents: 0, ratePct: 1.0 };
  const rev = annualRevenueCents / 100;
  let ratePct = 2.5;
  if (rev <= 300_000) ratePct = 1.0;
  else if (rev <= 600_000) ratePct = 1.1;
  else if (rev <= 1_000_000) ratePct = 1.5;
  else if (rev <= 2_500_000) ratePct = 2.0;
  return { isrCents: Math.round(annualRevenueCents * (ratePct / 100)), ratePct };
}

function computeAnnualInflation(
  ejercicio: number,
  monthlyBalancesByPeriod: AnnualMonthlyBalancesInput,
  fallbackTrialBalance: readonly AccountWithBalance[],
  inpcAnteriorInput?: number,
  inpcActualInput?: number
): AnnualInflationResult {
  const { inpcCierreAnterior, inpcCierreActual } = resolveAnnualInpcPair(ejercicio, inpcAnteriorInput, inpcActualInput);
  const periods = normalizeMonthlyBalances(monthlyBalancesByPeriod, fallbackTrialBalance);
  const monthlyRows: AnnualInflationMonthlyRow[] = [];
  let sumCreditosCents = 0;
  let sumDeudasCents = 0;

  for (const item of periods) {
    let monthCreditosCents = 0;
    let monthDeudasCents = 0;
    for (const acc of pickEvalAccounts(item.accounts)) {
      const balCents = toCents(acc.finalBalance);
      if (hasPrefix(acc, CREDIT_PREFIXES)) monthCreditosCents += Math.max(0, balCents);
      else if (hasPrefix(acc, DEBT_PREFIXES)) monthDeudasCents += Math.max(0, balCents);
    }
    sumCreditosCents += monthCreditosCents;
    sumDeudasCents += monthDeudasCents;
    const mesNombre = MESES_SAT.find((m) => m.periodo === item.periodo)?.nombre ?? `Mes ${item.periodo}`;
    monthlyRows.push({ periodo: item.periodo, mesNombre, creditosCierre: fromCents(monthCreditosCents), deudasCierre: fromCents(monthDeudasCents) });
  }

  const divisor = Math.max(1, periods.length);
  const promedioCreditosCents = Math.round(sumCreditosCents / divisor);
  const promedioDeudasCents = Math.round(sumDeudasCents / divisor);
  const diffCents = promedioDeudasCents - promedioCreditosCents;
  const factorAjuste = truncate4(inpcCierreAnterior > 0 && inpcCierreActual > inpcCierreAnterior ? inpcCierreActual / inpcCierreAnterior - 1 : 0);
  const tipo: AnnualInflationResult['tipo'] = diffCents > 0 ? 'ACUMULABLE' : diffCents < 0 ? 'DEDUCIBLE' : 'NEUTRO';

  return {
    promedioCreditos: fromCents(promedioCreditosCents),
    promedioDeudas: fromCents(promedioDeudasCents),
    diferenciaPromedios: fromCents(Math.abs(diffCents)),
    tipo,
    inpcCierreAnterior,
    inpcCierreActual,
    factorAjuste,
    ajusteAcumulable: fromCents(diffCents > 0 ? Math.round(diffCents * factorAjuste) : 0),
    ajusteDeducible: fromCents(diffCents < 0 ? Math.round(Math.abs(diffCents) * factorAjuste) : 0),
    monthlyRows
  };
}

function summarizeLedgerAndReconcile(params: {
  trialBalance: readonly AccountWithBalance[];
  inflation: AnnualInflationResult;
  applyInflationAdjustment: boolean;
  fixedAssetsFiscalDeduction: number;
  ptuPagadaAnterior: number;
  noDeduciblesManual: number;
  perdidasPendientes: number;
  factorActualizacionInpc: number;
}): { ingresosContablesCents: number; noDeduciblesManualCents: number; reconciliation: AnnualFiscalReconciliation } {
  let ingresosContablesCents = 0;
  let costosCents = 0;
  let gastosOpCents = 0;
  let isrContableCents = 0;
  let depContableCents = 0;

  for (const acc of pickEvalAccounts(params.trialBalance)) {
    const balCents = toCents(acc.finalBalance);
    if (acc.type === 'INGRESOS') {
      ingresosContablesCents += (acc.nature === 'ACREEDORA' ? 1 : -1) * balCents;
    } else if (acc.type === 'COSTOS') {
      costosCents += (acc.nature === 'DEUDORA' ? 1 : -1) * balCents;
    } else if (acc.type === 'GASTOS') {
      const signedBal = (acc.nature === 'DEUDORA' ? 1 : -1) * balCents;
      const isIsr = acc.code.startsWith('801') || acc.code.startsWith('800') || acc.satGroupCode.startsWith('611') || acc.satGroupCode.startsWith('801');
      if (isIsr) {
        isrContableCents += Math.max(0, signedBal);
      } else {
        gastosOpCents += signedBal;
        if (acc.code.startsWith('601-01-006') || acc.satGroupCode.startsWith('613')) depContableCents += Math.max(0, signedBal);
      }
    }
  }

  const utilidadContableCents = ingresosContablesCents - costosCents - gastosOpCents - isrContableCents;
  const ajusteAcumCents = params.applyInflationAdjustment ? toCents(params.inflation.ajusteAcumulable) : 0;
  const ajusteDedCents = params.applyInflationAdjustment ? toCents(params.inflation.ajusteDeducible) : 0;
  const depFiscalCents = Math.max(0, toCents(params.fixedAssetsFiscalDeduction));
  const noDedManualCents = Math.max(0, toCents(params.noDeduciblesManual));
  const ptuPagadaCents = Math.max(0, toCents(params.ptuPagadaAnterior));
  const perdidasPendCents = Math.max(0, toCents(params.perdidasPendientes));

  const dedContNoFiscCents = isrContableCents + depContableCents + noDedManualCents;
  const dedFiscNoContCents = depFiscalCents + ajusteDedCents;
  const utilidadFiscalAntesPtuCents = utilidadContableCents + ajusteAcumCents + dedContNoFiscCents - dedFiscNoContCents;
  const utilidadFiscalCents = utilidadFiscalAntesPtuCents - ptuPagadaCents;
  const perdidasActCents = Math.round(perdidasPendCents * params.factorActualizacionInpc);
  const perdidasAplicadasCents = utilidadFiscalCents > 0 ? Math.min(utilidadFiscalCents, perdidasActCents) : 0;
  const resultadoFiscalCents = utilidadFiscalCents > 0 ? Math.max(0, utilidadFiscalCents - perdidasAplicadasCents) : 0;

  return {
    ingresosContablesCents,
    noDeduciblesManualCents: noDedManualCents,
    reconciliation: {
      utilidadContable: fromCents(utilidadContableCents),
      ingresosFiscalesNoContables: fromCents(ajusteAcumCents),
      deduccionesContablesNoFiscales: fromCents(dedContNoFiscCents),
      deduccionesFiscalesNoContables: fromCents(dedFiscNoContCents),
      isrContableProvisionado: fromCents(isrContableCents),
      depreciacionContable: fromCents(depContableCents),
      depreciacionFiscalInversiones: fromCents(depFiscalCents),
      noDeduciblesManual: fromCents(noDedManualCents),
      ptuPagadaEjercicio: fromCents(ptuPagadaCents),
      utilidadFiscalAntesPtu: fromCents(utilidadFiscalAntesPtuCents),
      utilidadFiscal: fromCents(utilidadFiscalCents),
      perdidasFiscalesPendientes: fromCents(perdidasPendCents),
      perdidasFiscalesActualizadas: fromCents(perdidasActCents),
      perdidasFiscalesAplicadas: fromCents(perdidasAplicadasCents),
      resultadoFiscal: fromCents(resultadoFiscalCents)
    }
  };
}

function buildResolvedInputs(companyId: string, ejercicio: number, inflation: AnnualInflationResult, inputs: Partial<AnnualTaxInputs>): AnnualTaxInputs {
  const clean = (v?: number) => fromCents(Math.max(0, toCents(v)));
  return {
    companyId,
    ejercicio,
    inpcCierreAnterior: inflation.inpcCierreAnterior,
    inpcCierreActual: inflation.inpcCierreActual,
    cucaInicial: clean(inputs.cucaInicial),
    aportacionesCapital: clean(inputs.aportacionesCapital),
    reduccionesCapital: clean(inputs.reduccionesCapital),
    cufinInicial: clean(inputs.cufinInicial),
    dividendosPagados: clean(inputs.dividendosPagados),
    ptuPagadaAnterior: clean(inputs.ptuPagadaAnterior),
    noDeduciblesManual: clean(inputs.noDeduciblesManual),
    updatedAt: inputs.updatedAt
  };
}

export function computeAnnualTaxSummary(params: ComputeAnnualTaxParams): AnnualTaxSummaryResponse {
  const { company, ejercicio, trialBalance, monthlyBalancesByPeriod, fixedAssetsFiscalDeduction, paymentsProvisioned, inputs } = params;
  const regimenClave = (company.regimenFiscal || '601').slice(0, 3);
  const esResico = regimenClave === '626';
  const isPf = company.rfc.trim().length === 13;
  const tipoRegimenAnual: AnnualTaxRegimeType = esResico && isPf ? 'PF_RESICO' : esResico ? 'PM_RESICO' : isPf ? 'PF_ART152' : 'PM_GENERAL';
  const applyInflationAdjustment = tipoRegimenAnual === 'PM_GENERAL';

  const rawInflation = computeAnnualInflation(ejercicio, monthlyBalancesByPeriod, trialBalance, inputs.inpcCierreAnterior, inputs.inpcCierreActual);
  const inflation: AnnualInflationResult = applyInflationAdjustment
    ? rawInflation
    : { ...rawInflation, tipo: 'NEUTRO', ajusteAcumulable: 0, ajusteDeducible: 0 };

  const rawUpdateFactor = inflation.inpcCierreAnterior > 0 && inflation.inpcCierreActual >= inflation.inpcCierreAnterior
    ? inflation.inpcCierreActual / inflation.inpcCierreAnterior
    : 1;
  const factorActualizacionInpc = Math.max(1, truncate4(rawUpdateFactor));
  const resolvedInputs = buildResolvedInputs(company.id, ejercicio, inflation, inputs);

  const { ingresosContablesCents, noDeduciblesManualCents, reconciliation } = summarizeLedgerAndReconcile({
    trialBalance, inflation, applyInflationAdjustment, fixedAssetsFiscalDeduction,
    ptuPagadaAnterior: resolvedInputs.ptuPagadaAnterior,
    noDeduciblesManual: resolvedInputs.noDeduciblesManual,
    perdidasPendientes: params.perdidasFiscalesPendientes ?? 0,
    factorActualizacionInpc
  });

  const resultadoFiscalCents = toCents(reconciliation.resultadoFiscal);
  const ingresosNominalesCents = Math.max(0, ingresosContablesCents);
  let tasaAplicablePct = 30.0;
  let isrAnualCausadoCents = Math.round(resultadoFiscalCents * 0.3);

  if (tipoRegimenAnual === 'PF_RESICO') {
    const resico = calculateResicoPfAnnualIsr(ingresosNominalesCents);
    tasaAplicablePct = resico.ratePct;
    isrAnualCausadoCents = resico.isrCents;
  } else if (tipoRegimenAnual === 'PF_ART152') {
    const pf = calculateArt106PfIsr(resultadoFiscalCents, 12, ejercicio);
    tasaAplicablePct = pf.effectiveRatePct;
    isrAnualCausadoCents = pf.isrCents;
  }

  const pagosPreviosCents = Math.max(0, toCents(paymentsProvisioned));
  const isrRetenidoCents = Math.max(0, toCents(params.isrRetenidoAcreditable ?? 0));
  const isrCargoFavorCents = isrAnualCausadoCents - pagosPreviosCents - isrRetenidoCents;
  const ptuBaseCents = Math.max(0, toCents(reconciliation.utilidadFiscalAntesPtu));
  const utilidadFiscalCents = toCents(reconciliation.utilidadFiscal);

  const cucaActualizadaCents = Math.round(toCents(resolvedInputs.cucaInicial) * factorActualizacionInpc);
  const cucaFinalCents = Math.max(0, cucaActualizadaCents + toCents(resolvedInputs.aportacionesCapital) - toCents(resolvedInputs.reduccionesCapital));
  const cufinActualizadaCents = Math.round(toCents(resolvedInputs.cufinInicial) * factorActualizacionInpc);
  const ufinCents = resultadoFiscalCents - isrAnualCausadoCents - noDeduciblesManualCents;
  const cufinFinalCents = Math.max(0, cufinActualizadaCents + ufinCents - toCents(resolvedInputs.dividendosPagados));

  const determination: AnnualTaxDetermination = {
    regimenClave, tipoRegimenAnual,
    ingresosNominales: fromCents(ingresosNominalesCents),
    tasaAplicablePct,
    isrAnualCausado: fromCents(isrAnualCausadoCents),
    pagosProvisionalesEfectuados: fromCents(pagosPreviosCents),
    isrRetenidoAcreditable: fromCents(isrRetenidoCents),
    isrAnualCargoFavor: fromCents(isrCargoFavorCents),
    isrACargo: isrCargoFavorCents > 0 ? fromCents(isrCargoFavorCents) : 0,
    isrAFavor: isrCargoFavorCents < 0 ? fromCents(Math.abs(isrCargoFavorCents)) : 0,
    ptuBase: fromCents(ptuBaseCents),
    ptuPorPagar10Pct: fromCents(Math.round(ptuBaseCents * 0.1)),
    nuevoCoeficienteUtilidad: utilidadFiscalCents > 0 && ingresosNominalesCents > 0 ? truncate4(utilidadFiscalCents / ingresosNominalesCents) : 0,
    factorActualizacionInpc,
    cucaActualizada: fromCents(cucaActualizadaCents),
    cucaFinal: fromCents(cucaFinalCents),
    cufinActualizada: fromCents(cufinActualizadaCents),
    ufinDelEjercicio: fromCents(ufinCents),
    cufinFinal: fromCents(cufinFinalCents)
  };

  return { company, ejercicio, inputs: resolvedInputs, inflation, reconciliation, determination };
}

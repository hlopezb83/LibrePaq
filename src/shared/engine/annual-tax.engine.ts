import type {
  AnnualFiscalReconciliation, AnnualInflationResult,
  AnnualTaxDetermination, AnnualTaxInputs, AnnualTaxRegimeType, AnnualTaxSummaryResponse
} from '../types/annual-tax.types';
import type { AccountWithBalance, CfdiDocument, Company } from '../types/core.types';
import type { AccountingRuleRecord } from '../types/accounting-rules.types';
import { getInpcMedioPeriodo } from '../sat-inpc-catalog';
import { calculateArt106PfIsr } from './art106-tax.engine';
import {
  computeAnnualInflation,
  pickEvalAccounts,
  resolveAnnualInpcPair,
  sumMonthlyIsrRetentionChargesCents,
  truncate4
} from './annual-tax-balances.helper';
import { computeCashBasisFiscalSummary } from './cash-basis-fiscal.engine';
import { fromCents, toCents } from './invariants-and-math';

export { resolveAnnualInpcPair };

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
  cfdis?: readonly CfdiDocument[];
  rules?: readonly AccountingRuleRecord[];
}

export function getOfficialUmaAnual(ejercicio: number): number {
  if (ejercicio >= 2026) return 42794.64;
  if (ejercicio === 2025) return 41273.52;
  if (ejercicio === 2024) return 39606.36;
  return 37844.40;
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

function summarizeLedgerAndReconcile(params: {
  ejercicio: number;
  trialBalance: readonly AccountWithBalance[];
  inflation: AnnualInflationResult;
  applyInflationAdjustment: boolean;
  applyPersonalDeductions: boolean;
  fixedAssetsFiscalDeduction: number;
  ptuPagadaAnterior: number;
  noDeduciblesManual: number;
  deduccionesPersonales: number;
  perdidasPendientes: number;
  factorActualizacionPerdidas: number;
  cashOverride?: { ingresosCents: number; deduccionesCents: number; isPfResico: boolean } | null;
}): {
  ingresosContablesCents: number;
  noDeduciblesManualCents: number;
  noDeducibles801Cents: number;
  ptuBaseOverrideCents?: number;
  reconciliation: AnnualFiscalReconciliation;
} {
  let ingresosContablesCents = 0;
  let costosCents = 0;
  let gastosOpCents = 0;
  let isrContableCents = 0;
  let noDeducibles801Cents = 0;
  let depContableCents = 0;
  let nonCfdiImssIsnCents = 0;

  for (const acc of pickEvalAccounts(params.trialBalance)) {
    const balCents = toCents(acc.finalBalance);
    if (acc.type === 'INGRESOS') {
      ingresosContablesCents += (acc.nature === 'ACREEDORA' ? 1 : -1) * balCents;
    } else if (acc.type === 'COSTOS') {
      costosCents += (acc.nature === 'DEUDORA' ? 1 : -1) * balCents;
    } else if (acc.type === 'GASTOS') {
      const signedBal = (acc.nature === 'DEUDORA' ? 1 : -1) * balCents;
      const sat = acc.satGroupCode ?? '';
      const isNonDed801 =
        acc.code === '801-01-002' ||
        sat === '601.74' ||
        (acc.code.startsWith('801') &&
          !sat.startsWith('611') &&
          acc.code !== '801-01-001' &&
          !acc.name.toLowerCase().includes('isr'));
      const isIsr =
        !isNonDed801 &&
        (acc.code === '801-01-001' ||
          acc.code.startsWith('800') ||
          sat.startsWith('611') ||
          sat.startsWith('801') ||
          acc.code.startsWith('801'));
      if (isNonDed801) {
        noDeducibles801Cents += Math.max(0, signedBal);
      } else if (isIsr) {
        isrContableCents += Math.max(0, signedBal);
      } else {
        gastosOpCents += signedBal;
        if (acc.code.startsWith('601-01-006') || sat.startsWith('613')) depContableCents += Math.max(0, signedBal);
        if (
          ['601-01-007', '601-01-008', '601-01-011', '601-02-001', '601-02-002', '601-26-001', '601-58-001'].includes(acc.code) ||
          ['601.26', '601.27', '601.28', '601.29', '601.58'].includes(sat)
        ) {
          nonCfdiImssIsnCents += Math.max(0, signedBal);
        }
      }
    }
  }

  const utilidadContableCents =
    ingresosContablesCents - costosCents - gastosOpCents - isrContableCents - noDeducibles801Cents;
  const ajusteAcumCents = params.applyInflationAdjustment ? toCents(params.inflation.ajusteAcumulable) : 0;
  const ajusteDedCents = params.applyInflationAdjustment ? toCents(params.inflation.ajusteDeducible) : 0;
  const depFiscalCents = Math.max(0, toCents(params.fixedAssetsFiscalDeduction));
  const noDedManualCents = Math.max(0, toCents(params.noDeduciblesManual));
  const ptuPagadaCents = Math.max(0, toCents(params.ptuPagadaAnterior));
  const perdidasPendCents = Math.max(0, toCents(params.perdidasPendientes));

  const dedContNoFiscCents = isrContableCents + depContableCents + noDedManualCents + noDeducibles801Cents;
  const dedFiscNoContCents = depFiscalCents + ajusteDedCents;
  const cashOv = params.cashOverride;
  const netCashDeductiblesCents = cashOv
    ? Math.max(0, cashOv.deduccionesCents + nonCfdiImssIsnCents - noDedManualCents)
    : 0;
  const utilidadFiscalAntesPtuCents = cashOv
    ? cashOv.isPfResico
      ? cashOv.ingresosCents
      : cashOv.ingresosCents - netCashDeductiblesCents - depFiscalCents
    : utilidadContableCents + ajusteAcumCents + dedContNoFiscCents - dedFiscNoContCents;
  // Art. 113-G LISR: PTU en RESICO PF resta erogaciones estrictamente indispensables pagadas (sin afectar base ISR 113-F)
  const ptuBaseOverrideCents = cashOv?.isPfResico
    ? Math.max(0, cashOv.ingresosCents - netCashDeductiblesCents - depFiscalCents)
    : undefined;
  const utilidadFiscalCents = cashOv?.isPfResico
    ? utilidadFiscalAntesPtuCents
    : utilidadFiscalAntesPtuCents - ptuPagadaCents;
  const perdidasActCents = Math.round(perdidasPendCents * params.factorActualizacionPerdidas);
  const perdidasAplicadasCents =
    !cashOv?.isPfResico && utilidadFiscalCents > 0
      ? Math.min(utilidadFiscalCents, perdidasActCents)
      : 0;
  const ingresosForCapCents = Math.max(0, cashOv ? cashOv.ingresosCents : ingresosContablesCents);
  const topePersonalCents = params.applyPersonalDeductions
    ? Math.min(
        Math.round(toCents(getOfficialUmaAnual(params.ejercicio)) * 5),
        Math.round(ingresosForCapCents * 0.15)
      )
    : 0;
  const remainingAfterLossCents =
    utilidadFiscalCents > 0 ? Math.max(0, utilidadFiscalCents - perdidasAplicadasCents) : 0;
  const dedPersonalAplicadasCents = params.applyPersonalDeductions
    ? Math.min(remainingAfterLossCents, Math.min(Math.max(0, toCents(params.deduccionesPersonales)), topePersonalCents))
    : 0;
  const resultadoFiscalCents = Math.max(0, remainingAfterLossCents - dedPersonalAplicadasCents);

  return {
    ingresosContablesCents: cashOv ? cashOv.ingresosCents : ingresosContablesCents,
    noDeduciblesManualCents: noDedManualCents,
    noDeducibles801Cents,
    ptuBaseOverrideCents,
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
      deduccionesPersonalesAplicadas: params.applyPersonalDeductions ? fromCents(dedPersonalAplicadasCents) : 0,
      deduccionesPersonalesTope: params.applyPersonalDeductions ? fromCents(topePersonalCents) : 0,
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
    deduccionesPersonales: clean(inputs.deduccionesPersonales),
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
  const inpcJunio = getInpcMedioPeriodo(ejercicio, 6);
  const rawLossFactor = inflation.inpcCierreAnterior > 0 && inpcJunio >= inflation.inpcCierreAnterior
    ? inpcJunio / inflation.inpcCierreAnterior
    : 1;
  const factorActualizacionPerdidas = Math.max(1, truncate4(rawLossFactor));
  const resolvedInputs = buildResolvedInputs(company.id, ejercicio, inflation, inputs);
  const cashSummary =
    tipoRegimenAnual !== 'PM_GENERAL' && params.cfdis && params.cfdis.length > 0
      ? computeCashBasisFiscalSummary({ company, ejercicio, periodo: 12, cfdis: params.cfdis, rules: params.rules })
      : null;

  const { ingresosContablesCents, noDeduciblesManualCents, noDeducibles801Cents, ptuBaseOverrideCents, reconciliation } =
    summarizeLedgerAndReconcile({
      ejercicio,
      trialBalance,
      inflation,
      applyInflationAdjustment,
      applyPersonalDeductions: tipoRegimenAnual === 'PF_ART152',
      fixedAssetsFiscalDeduction,
      ptuPagadaAnterior: resolvedInputs.ptuPagadaAnterior,
      noDeduciblesManual: resolvedInputs.noDeduciblesManual,
      deduccionesPersonales: resolvedInputs.deduccionesPersonales ?? 0,
      perdidasPendientes: params.perdidasFiscalesPendientes ?? 0,
      factorActualizacionPerdidas,
      cashOverride: cashSummary
        ? {
            ingresosCents: toCents(cashSummary.ingresosAcumulados),
            deduccionesCents: toCents(cashSummary.deduccionesAcumuladas),
            isPfResico: tipoRegimenAnual === 'PF_RESICO'
          }
        : null
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
  const cashRetCents = cashSummary ? toCents(cashSummary.isrRetenidoFavorAcumulado ?? 0) : 0;
  const tbRetChargesCents = sumMonthlyIsrRetentionChargesCents(monthlyBalancesByPeriod);
  const isrRetenidoCents = Math.max(
    toCents(params.isrRetenidoAcreditable ?? 0),
    cashRetCents,
    tbRetChargesCents
  );
  const isrCargoFavorCents = isrAnualCausadoCents - pagosPreviosCents - isrRetenidoCents;
  const ptuBaseCents = ptuBaseOverrideCents ?? Math.max(0, toCents(reconciliation.utilidadFiscalAntesPtu));
  const utilidadFiscalCents = toCents(reconciliation.utilidadFiscal);

  const cucaActualizadaCents = Math.round(toCents(resolvedInputs.cucaInicial) * factorActualizacionInpc);
  const cucaFinalCents = Math.max(0, cucaActualizadaCents + toCents(resolvedInputs.aportacionesCapital) - toCents(resolvedInputs.reduccionesCapital));
  const cufinActualizadaCents = Math.round(toCents(resolvedInputs.cufinInicial) * factorActualizacionInpc);
  const ufinCents =
    resultadoFiscalCents - isrAnualCausadoCents - noDeduciblesManualCents - noDeducibles801Cents;
  const cufinFinalCents =
    cufinActualizadaCents + ufinCents - toCents(resolvedInputs.dividendosPagados);

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

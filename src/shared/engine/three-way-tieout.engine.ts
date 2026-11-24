import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  DiotReportResponse,
  Poliza
} from '../types';
import { fromCents, sumCents, toCents } from './invariants-and-math';
import { computeSatAddPillar, detectManualIvaCauses } from './three-way-tieout.helpers';

export type TieoutTrafficLight = 'VERDE' | 'AMARILLO' | 'ROJO';

export type TieoutCauseCode =
  | 'MANUAL_IVA_SIN_CFDI'
  | 'CFDIS_PENDIENTES'
  | 'DISCREPANCIA_ADD_LIBROS'
  | 'DISCREPANCIA_DIOT_LIBROS';

export interface TieoutCause {
  code: TieoutCauseCode;
  severity: 'HIGH' | 'MEDIUM';
  title: string;
  detail: string;
  amountImpact: number;
  targetRoute: '/add' | '/polizas' | '/fiscal-bancos';
}

export interface ThreeWayTieoutInput {
  company: Company;
  ejercicio: number;
  periodo: number;
  cfdis: readonly CfdiDocument[];
  polizas: readonly Poliza[];
  trialBalance: readonly AccountWithBalance[];
  diotReport?: DiotReportResponse | null;
}

export interface ThreeWayTieoutResult {
  ejercicio: number;
  periodo: number;
  status: TieoutTrafficLight;
  satAdd: {
    ingresosNetos: number;
    gastosNetos: number;
    ivaTrasladado: number;
    ivaAcreditable: number;
    pendingCfdisCount: number;
  };
  contabilidad: {
    ingresos401_402: number;
    gastos501_601: number;
    ivaCobrado208: number;
    ivaPagado118: number;
    bancos102Cargos: number;
    bancos102Abonos: number;
    bancos102Neto: number;
  };
  diot: {
    actosPagadosTotal: number;
    actosGravados16y8: number;
    ivaAcreditablePagado: number;
    suppliersCount: number;
  };
  deltas: {
    deltaIngresos: number;
    deltaGastos: number;
    deltaIvaAcreditable: number;
    deltaIvaTrasladado: number;
    deltaIvaAcreditableDiot: number;
  };
  causes: TieoutCause[];
}

function computeContabilidadPillar(trialBalance: readonly AccountWithBalance[]) {
  const affectable = trialBalance.filter((a) => a.isAffectable !== false);
  let ingCents = 0;
  let gasCents = 0;
  let iva208Cents = 0;
  let iva118Cents = 0;
  let bancosCargosCents = 0;
  let bancosAbonosCents = 0;

  for (const acc of affectable) {
    const code = (acc.code || '').trim();
    const charges = toCents(acc.periodCharges);
    const credits = toCents(acc.periodCredits);

    if (code.startsWith('401') || code.startsWith('402')) {
      ingCents += credits - charges;
    } else if (code.startsWith('501') || code.startsWith('601')) {
      gasCents += charges - credits;
    } else if (code.startsWith('208-01') || acc.satGroupCode?.startsWith('208.01') || code.startsWith('208')) {
      iva208Cents += credits - charges;
    } else if (code.startsWith('118-01') || acc.satGroupCode?.startsWith('118.01') || code.startsWith('118')) {
      iva118Cents += charges - credits;
    } else if (code.startsWith('102')) {
      bancosCargosCents += charges;
      bancosAbonosCents += credits;
    }
  }

  return {
    ingCents,
    gasCents,
    iva208Cents,
    iva118Cents,
    bancosCargosCents,
    bancosAbonosCents,
    bancosNetoCents: bancosCargosCents - bancosAbonosCents
  };
}

/**
 * Motor puro de Amarre Integral 3-Vías (SAT ADD ↔ Contabilidad ↔ DIOT) en centavos enteros.
 */
export function computeThreeWayTieout({
  ejercicio,
  periodo,
  cfdis,
  polizas,
  trialBalance,
  diotReport
}: ThreeWayTieoutInput): ThreeWayTieoutResult {
  const sat = computeSatAddPillar(cfdis, ejercicio, periodo);
  const libros = computeContabilidadPillar(trialBalance);

  const diotRows = diotReport?.rows ?? [];
  const diotActosTotalCents =
    diotRows.length > 0
      ? sumCents(
          diotRows.map(
            (r) =>
              r.actosPagados16 +
              (r.actosPagados8 || 0) +
              (r.actosPagados0 || 0) +
              (r.actosExentos || 0)
          )
        )
      : toCents(diotReport?.totals.actosPagados16 ?? 0);
  const diotGravadosCents = toCents(diotReport?.totals.actosPagados16 ?? 0);
  const diotIvaCents = toCents(diotReport?.totals.ivaAcreditable16 ?? 0);

  const deltaIngresosCents = libros.ingCents - sat.ingCents;
  const deltaGastosCents = libros.gasCents - sat.gasCents;
  const deltaIvaAcredCents = libros.iva118Cents - sat.ivaAcredCents;
  const deltaIvaTrasCents = libros.iva208Cents - sat.ivaTrasCents;
  const deltaIvaDiotCents = libros.iva118Cents - diotIvaCents;

  const causes: TieoutCause[] = [];
  const manualIva = detectManualIvaCauses(polizas);
  if (manualIva.count > 0) {
    causes.push({
      code: 'MANUAL_IVA_SIN_CFDI',
      severity: 'HIGH',
      title: `${manualIva.count} póliza(s) manual(es) con IVA sin CFDI vinculado`,
      detail: 'Existen movimientos en cuentas 118/208 sin UUID fiscal asociado, lo que genera diferencias entre Contabilidad, ADD y DIOT.',
      amountImpact: fromCents(manualIva.impactCents),
      targetRoute: '/polizas'
    });
  }

  if (sat.pendingCfdisCount > 0) {
    causes.push({
      code: 'CFDIS_PENDIENTES',
      severity: 'MEDIUM',
      title: `${sat.pendingCfdisCount} CFDI(s) del periodo pendientes de contabilizar`,
      detail: 'Comprobantes vigentes en la Bóveda ADD aún no cuentan con póliza contable ni reflejo en Balanza/DIOT.',
      amountImpact: 0,
      targetRoute: '/add'
    });
  }

  const maxAddLibrosDeltaCents = Math.max(
    Math.abs(deltaIngresosCents),
    Math.abs(deltaGastosCents),
    Math.abs(deltaIvaAcredCents),
    Math.abs(deltaIvaTrasCents)
  );
  if (maxAddLibrosDeltaCents > 100) {
    causes.push({
      code: 'DISCREPANCIA_ADD_LIBROS',
      severity: 'HIGH',
      title: 'Discrepancia entre Bóveda ADD (Flujo) y Libros Contables',
      detail: 'Revisa pólizas manuales, provisiones devengadas PPD pendientes de cobro/pago o asientos en cuentas 401/402/501/601/118/208.',
      amountImpact: fromCents(maxAddLibrosDeltaCents),
      targetRoute: '/polizas'
    });
  }

  if (diotReport && Math.abs(deltaIvaDiotCents) > 100) {
    causes.push({
      code: 'DISCREPANCIA_DIOT_LIBROS',
      severity: 'MEDIUM',
      title: 'Diferencia entre IVA Acreditable (118) y DIOT',
      detail: 'El IVA acreditable en libros difiere de la DIOT por pólizas sin CFDI, CFDIs sin póliza o tasas no desglosadas.',
      amountImpact: fromCents(Math.abs(deltaIvaDiotCents)),
      targetRoute: '/fiscal-bancos'
    });
  }

  const hasHighCause = causes.some((c) => c.severity === 'HIGH');
  const status: TieoutTrafficLight = hasHighCause
    ? 'ROJO'
    : causes.length > 0 || maxAddLibrosDeltaCents > 0 || (diotReport ? Math.abs(deltaIvaDiotCents) > 0 : false)
      ? 'AMARILLO'
      : 'VERDE';

  return {
    ejercicio,
    periodo,
    status,
    satAdd: {
      ingresosNetos: fromCents(sat.ingCents),
      gastosNetos: fromCents(sat.gasCents),
      ivaTrasladado: fromCents(sat.ivaTrasCents),
      ivaAcreditable: fromCents(sat.ivaAcredCents),
      pendingCfdisCount: sat.pendingCfdisCount
    },
    contabilidad: {
      ingresos401_402: fromCents(libros.ingCents),
      gastos501_601: fromCents(libros.gasCents),
      ivaCobrado208: fromCents(libros.iva208Cents),
      ivaPagado118: fromCents(libros.iva118Cents),
      bancos102Cargos: fromCents(libros.bancosCargosCents),
      bancos102Abonos: fromCents(libros.bancosAbonosCents),
      bancos102Neto: fromCents(libros.bancosNetoCents)
    },
    diot: {
      actosPagadosTotal: fromCents(diotActosTotalCents),
      actosGravados16y8: fromCents(diotGravadosCents),
      ivaAcreditablePagado: fromCents(diotIvaCents),
      suppliersCount: diotRows.length
    },
    deltas: {
      deltaIngresos: fromCents(deltaIngresosCents),
      deltaGastos: fromCents(deltaGastosCents),
      deltaIvaAcreditable: fromCents(deltaIvaAcredCents),
      deltaIvaTrasladado: fromCents(deltaIvaTrasCents),
      deltaIvaAcreditableDiot: fromCents(deltaIvaDiotCents)
    },
    causes
  };
}

import { buildAutoPolizaPlan, fromCents, sumCents, toCents } from '../../shared/accounting-engine';
import type { AccountWithBalance, CfdiDocument, Poliza, PolizaType } from '../../shared/types';
import type { DraftMovement } from './poliza-editor.types';

export type PolizaPeriodScope = 'CURRENT' | 'YTD' | 'RANGE';

export interface PolizaAmountFilter {
  minAmount?: number | null;
  maxAmount?: number | null;
}

export function buildPlanDraftsFromCfdi(
  cfdi: CfdiDocument,
  accounts: AccountWithBalance[]
): { tipo: PolizaType; fecha: string; concepto: string; movements: DraftMovement[] } {
  const plan = buildAutoPolizaPlan(cfdi, accounts);
  const cleanUuid = cfdi.uuid.trim().toUpperCase();
  return {
    tipo: plan.polizaType,
    fecha: cfdi.fecha,
    concepto: plan.polizaConcept,
    movements: plan.movements.map((m) => ({
      _rowId: crypto.randomUUID(),
      accountId: m.accountId,
      referencia: m.referencia,
      concepto: m.concepto,
      cargo: m.cargo,
      abono: m.abono,
      cfdiUuid: cleanUuid
    }))
  };
}

export function collectPolizaUniqueUuids(pol: Poliza): string[] {
  return Array.from(
    new Set(
      [
        ...(pol.cfdiUuids || []),
        ...(pol.cfdiUuid ? [pol.cfdiUuid] : []),
        ...pol.movements.map((mv) => mv.cfdiUuid || '')
      ]
        .map((u) => u.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

export function formatPolizaCopyText(pol: Poliza): string {
  return [
    `PÓLIZA ${pol.tipo} #${pol.folio} | Fecha: ${pol.fecha}`,
    `Concepto: ${pol.concepto}`,
    ...pol.movements.map(
      (m) => `  ${m.accountCode} ${m.accountName} | Debe: ${m.cargo.toFixed(2)} | Haber: ${m.abono.toFixed(2)}`
    ),
    `Sumas Iguales: Debe ${pol.totalCargos.toFixed(2)} | Haber ${pol.totalAbonos.toFixed(2)}`
  ].join('\n');
}

export function hasPolizaCfdi(pol: Poliza): boolean {
  return Boolean(
    pol.cfdiUuid ||
      (pol.cfdiUuids && pol.cfdiUuids.length > 0) ||
      pol.movements.some((m) => Boolean(m.cfdiUuid))
  );
}

export function filterPolizas(
  polizas: Poliza[],
  filterTipo: 'ALL' | PolizaType,
  originFilter: 'ALL' | 'WITH_CFDI' | 'MANUAL',
  searchQuery: string,
  amountFilter?: PolizaAmountFilter
): Poliza[] {
  const minCents =
    amountFilter?.minAmount !== undefined && amountFilter.minAmount !== null && Number.isFinite(amountFilter.minAmount)
      ? toCents(amountFilter.minAmount)
      : null;
  const maxCents =
    amountFilter?.maxAmount !== undefined && amountFilter.maxAmount !== null && Number.isFinite(amountFilter.maxAmount)
      ? toCents(amountFilter.maxAmount)
      : null;

  return polizas.filter((p) => {
    if (filterTipo !== 'ALL' && p.tipo !== filterTipo) return false;
    const hasCfdi = hasPolizaCfdi(p);
    if (originFilter === 'WITH_CFDI' && !hasCfdi) return false;
    if (originFilter === 'MANUAL' && hasCfdi) return false;
    const totalCents = toCents(p.totalCargos);
    if (minCents !== null && totalCents < minCents) return false;
    if (maxCents !== null && totalCents > maxCents) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const fullFolio = `${p.tipo} #${p.folio}`.toLowerCase();
      const matchConcept = p.concepto.toLowerCase().includes(q);
      const matchFolio = fullFolio.includes(q) || String(p.folio).includes(q);
      const matchUuid =
        (p.cfdiUuid ? p.cfdiUuid.toLowerCase().includes(q) : false) ||
        Boolean(p.cfdiUuids?.some((u) => u.toLowerCase().includes(q)));
      const matchMovement = p.movements.some(
        (m) =>
          m.accountCode.toLowerCase().includes(q) ||
          m.accountName.toLowerCase().includes(q) ||
          m.referencia.toLowerCase().includes(q) ||
          m.concepto.toLowerCase().includes(q) ||
          Boolean(m.cfdiUuid?.toLowerCase().includes(q))
      );
      if (!matchConcept && !matchFolio && !matchUuid && !matchMovement) return false;
    }
    return true;
  });
}

export function computePolizasTotals(filteredPolizas: Poliza[]) {
  const totalCargosCents = sumCents(filteredPolizas.map((p) => p.totalCargos));
  const totalAbonosCents = sumCents(filteredPolizas.map((p) => p.totalAbonos));
  return {
    cargos: fromCents(totalCargosCents),
    abonos: fromCents(totalAbonosCents)
  };
}

export function isPolizaDateInDifferentPeriod(
  fecha: string,
  currentYear?: number,
  currentPeriod?: number
): boolean {
  if (!fecha || !currentYear || !currentPeriod) return false;
  const parts = fecha.split('-');
  if (parts.length < 2) return false;
  const expectedPeriodMonth = currentPeriod === 13 ? 12 : currentPeriod;
  return Number(parts[0]) !== currentYear || Number(parts[1]) !== expectedPeriodMonth;
}

export function parsePolizasUrlSearch(search: unknown): { urlSearchParam: string; isNewRequested: boolean } {
  try {
    const sp = new URLSearchParams((search || {}) as Record<string, string>);
    return {
      urlSearchParam: sp.get('search') || sp.get('folio') || '',
      isNewRequested: sp.get('nueva') === 'true' || sp.get('action') === 'new'
    };
  } catch {
    return { urlSearchParam: '', isNewRequested: false };
  }
}

import { fromCents, sumCents } from '../../shared/accounting-engine';
import type { Poliza, PolizaType } from '../../shared/types';

export function filterPolizas(
  polizas: Poliza[],
  filterTipo: 'ALL' | PolizaType,
  originFilter: 'ALL' | 'WITH_CFDI' | 'MANUAL',
  searchQuery: string
): Poliza[] {
  return polizas.filter((p) => {
    if (filterTipo !== 'ALL' && p.tipo !== filterTipo) return false;
    if (originFilter === 'WITH_CFDI' && !p.cfdiUuid) return false;
    if (originFilter === 'MANUAL' && p.cfdiUuid) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const fullFolio = `${p.tipo} #${p.folio}`.toLowerCase();
      const matchConcept = p.concepto.toLowerCase().includes(q);
      const matchFolio = fullFolio.includes(q) || String(p.folio).includes(q);
      const matchUuid = p.cfdiUuid ? p.cfdiUuid.toLowerCase().includes(q) : false;
      const matchMovement = p.movements.some(
        (m) =>
          m.accountCode.toLowerCase().includes(q) ||
          m.accountName.toLowerCase().includes(q) ||
          m.referencia.toLowerCase().includes(q) ||
          m.concepto.toLowerCase().includes(q)
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

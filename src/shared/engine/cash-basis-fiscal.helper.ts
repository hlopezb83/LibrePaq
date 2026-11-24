import type { CfdiDocument, FiscalWorkpaperResponse, ThirdPartyRecord } from '../types';
import type { AccountingRuleRecord } from '../types/accounting-rules.types';
import { sumCents, toCents } from './invariants-and-math';

export function resolveRecibidoDeductiblePct(
  doc: CfdiDocument,
  rules?: readonly AccountingRuleRecord[],
  thirdPartyByRfc?: ReadonlyMap<string, ThirdPartyRecord>
): number {
  if (doc.deductiblePct !== undefined && Number.isFinite(Number(doc.deductiblePct))) {
    return Math.max(0, Math.min(100, Number(doc.deductiblePct)));
  }
  if (rules && rules.length > 0) {
    const rfc = doc.emisorRfc.trim().toUpperCase();
    const clave = (doc.claveProdServ || '').trim();
    const uso = (doc.usoCfdi || '').trim().toUpperCase();
    const sorted = [...rules]
      .filter((r) => r.direction === 'RECIBIDO')
      .sort((a, b) => a.priority - b.priority);
    for (const r of sorted) {
      if (r.matchRfc && r.matchRfc.trim().toUpperCase() !== rfc) continue;
      if (r.matchClaveProdServ && r.matchClaveProdServ.trim() !== clave) continue;
      if (r.matchUsoCfdi && r.matchUsoCfdi.trim().toUpperCase() !== uso) continue;
      return Math.max(0, Math.min(100, Number(r.deductiblePct ?? 100)));
    }
  }
  const tp = thirdPartyByRfc?.get(doc.emisorRfc.trim().toUpperCase()) as
    | (ThirdPartyRecord & { deductiblePct?: number })
    | undefined;
  if (tp?.deductiblePct !== undefined && Number.isFinite(Number(tp.deductiblePct))) {
    return Math.max(0, Math.min(100, Number(tp.deductiblePct)));
  }
  return 100;
}

export function getCfdiExchangeRate(doc: CfdiDocument): number {
  return doc.moneda && doc.moneda.toUpperCase() !== 'MXN' && (doc.tipoCambio || 1) > 0
    ? doc.tipoCambio
    : 1;
}

export function resolveRepBaseCents(doc: CfdiDocument, tc: number): number {
  const tb = doc.taxBreakdown;
  if (tb) {
    const tbSum = tb.base16 + tb.base8 + tb.base0 + tb.baseExento;
    if (tbSum > 0) return toCents(tbSum * tc);
  }
  const hasForeignDr = Boolean(doc.relatedDocs?.some((dr) => dr.monedaDr && dr.monedaDr !== 'MXN'));
  const grossPaidCents =
    doc.relatedDocs && doc.relatedDocs.length > 0 && !(doc.moneda === 'MXN' && hasForeignDr && doc.total > 0)
      ? sumCents(doc.relatedDocs.map((dr) => dr.impPagado * tc))
      : toCents(doc.total * tc);
  if (doc.subtotal > 0 && toCents(doc.subtotal * tc) <= grossPaidCents) {
    return toCents(doc.subtotal * tc);
  }
  return Math.max(0, grossPaidCents - toCents(doc.ivaTrasladado * tc));
}

export function resolveNonFixedAssetBaseCents(
  doc: CfdiDocument,
  baseCents: number,
  cfdiByUuid: ReadonlyMap<string, CfdiDocument>
): number {
  const isFixedAssetUso = (uso?: string | null) => /^I0/i.test((uso || '').trim());
  if (isFixedAssetUso(doc.usoCfdi)) return 0;

  if (doc.tipoComprobante === 'P' || doc.tipoComprobante === 'E') {
    if (doc.relatedDocs && doc.relatedDocs.length > 0) {
      let totalWeight = 0;
      let nonFixedAssetWeight = 0;
      for (const dr of doc.relatedDocs) {
        const w =
          dr.equivalenciaDr && dr.equivalenciaDr > 0
            ? Math.max(0, dr.impPagado / dr.equivalenciaDr)
            : Math.max(0, dr.impPagado);
        totalWeight += w;
        const orig = cfdiByUuid.get((dr.idDocumento || '').trim().toUpperCase());
        if (!orig || !isFixedAssetUso(orig.usoCfdi)) {
          nonFixedAssetWeight += w;
        }
      }
      if (totalWeight > 0) {
        if (nonFixedAssetWeight <= 0) return 0;
        if (nonFixedAssetWeight >= totalWeight) return baseCents;
        return Math.round((baseCents * nonFixedAssetWeight) / totalWeight);
      }
    }
    if (doc.uuidRelacionado) {
      const orig = cfdiByUuid.get(doc.uuidRelacionado.trim().toUpperCase());
      if (orig && isFixedAssetUso(orig.usoCfdi)) return 0;
    }
  }
  return baseCents;
}

export function extractBreakdownCents(doc: CfdiDocument, baseCents: number, tc: number) {
  const tb = doc.taxBreakdown;
  const hasTb =
    tb &&
    (tb.base16 > 0 || tb.base8 > 0 || tb.base0 > 0 || tb.baseExento > 0 || tb.ieps > 0 || tb.iva16 > 0 || tb.iva8 > 0);
  if (hasTb) {
    return {
      b16: toCents(tb.base16 * tc), i16: toCents(tb.iva16 * tc),
      b8: toCents(tb.base8 * tc), i8: toCents(tb.iva8 * tc),
      b0: toCents(tb.base0 * tc), bEx: toCents(tb.baseExento * tc),
      ieps: toCents(tb.ieps * tc)
    };
  }
  const ivaCents = toCents(doc.ivaTrasladado * tc);
  if (ivaCents > 0) {
    const is8 = Math.abs((baseCents > 0 ? ivaCents / baseCents : 0.16) - 0.08) < 0.015;
    return is8
      ? { b16: 0, i16: 0, b8: baseCents, i8: ivaCents, b0: 0, bEx: 0, ieps: 0 }
      : { b16: baseCents, i16: ivaCents, b8: 0, i8: 0, b0: 0, bEx: 0, ieps: 0 };
  }
  const isEx = doc.conceptoPrincipal.toLowerCase().includes('exento');
  return { b16: 0, i16: 0, b8: 0, i8: 0, b0: isEx ? 0 : baseCents, bEx: isEx ? baseCents : 0, ieps: 0 };
}

export function buildResicoAlert(
  esResico: boolean,
  isPersonaFisica: boolean,
  accumulatedRevenueMxn: number
): NonNullable<FiscalWorkpaperResponse['resicoThresholdAlert']> {
  const thresholdMxn = esResico ? (isPersonaFisica ? 3_500_000 : 35_000_000) : 0;
  const utilizationPct =
    esResico && thresholdMxn > 0 ? Number(((accumulatedRevenueMxn / thresholdMxn) * 100).toFixed(2)) : 0;
  const status = !esResico
    ? 'OK'
    : utilizationPct >= 100
      ? 'EXCEEDED'
      : utilizationPct >= 95
        ? 'CRITICAL_95'
        : utilizationPct >= 80
          ? 'WARNING_80'
          : 'OK';
  const labels = {
    OK: esResico ? 'Dentro del límite anual RESICO' : 'No aplica (Régimen distinto a RESICO)',
    WARNING_80: 'Precaución: >=80% del límite anual RESICO',
    CRITICAL_95: 'Alerta crítica: >=95% del límite anual RESICO',
    EXCEEDED: 'Límite anual RESICO excedido (>=100%)'
  } as const;
  return { applies: esResico, thresholdMxn, accumulatedRevenueMxn, utilizationPct, status, label: labels[status] };
}

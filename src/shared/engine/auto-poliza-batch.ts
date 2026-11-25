import { SAFETY_BOUNDS } from '../sat-constants';
import { checkRfc69BStatus } from '../sat-69b';
import type { CfdiDocument, Efos69BStatus, PolizaType } from '../types';
import type {
  AutoPolizaMovementDraft,
  AutoPolizaPlan,
  BatchPolizaGroupingMode
} from './auto-poliza-types';

export interface BatchPreparedCfdiPlan {
  cfdi: CfdiDocument;
  plan: AutoPolizaPlan;
  accountingDate: string;
  year: number;
  period: number;
  counterpartyRfc: string;
}

export interface BatchTaggedMovement extends AutoPolizaMovementDraft {
  cfdiUuid: string;
  rfcContraparte: string;
  cfdiTotal: number;
  cfdiMoneda: string;
  cfdiTipoCambio: number;
}

export interface ConcentratedPolizaGroup {
  groupKey: string;
  polizaType: PolizaType;
  accountingDate: string;
  year: number;
  period: number;
  concepto: string;
  cfdiIds: string[];
  cfdiUuids: string[];
  primaryUuid: string;
  movements: BatchTaggedMovement[];
}

export function getCfdiCounterpartyRfc(
  cfdi: Pick<CfdiDocument, 'direction' | 'emisorRfc' | 'receptorRfc'>
): string {
  return (cfdi.direction === 'EMITIDO' ? cfdi.receptorRfc : cfdi.emisorRfc)
    .trim()
    .toUpperCase();
}

export function getCfdiAccountingDate(
  cfdi: Pick<CfdiDocument, 'tipoComprobante' | 'fecha' | 'fechaPago'>
): string {
  return (cfdi.tipoComprobante === 'P' || cfdi.tipoComprobante === 'N') && cfdi.fechaPago
    ? cfdi.fechaPago
    : cfdi.fecha;
}

/**
 * Evalúa si un CFDI debe bloquearse por Art. 69-B CFF (EFOS Presunto o Definitivo)
 * consultando `validacionEfos` SAT, padrón `third_parties` y lista local 69-B.
 */
export function checkCfdi69BBlock(
  cfdi: Pick<CfdiDocument, 'direction' | 'emisorRfc' | 'receptorRfc' | 'validacionEfos'>,
  thirdPartyEstatus69B?: Efos69BStatus | string | null,
  db69BSituacion?: string | null
): { isBlocked: boolean; rfc: string; situacion?: string; reason?: string } {
  const rfc = getCfdiCounterpartyRfc(cfdi);
  const valEfos = String(cfdi.validacionEfos || '').trim().toUpperCase();
  if (valEfos && (valEfos.startsWith('100') || valEfos.includes('PRESUNT') || valEfos.includes('DEFINITIV'))) {
    return {
      isBlocked: true,
      rfc,
      situacion: valEfos,
      reason: `EFOS_69B_BLOCKED: El RFC ${rfc} tiene estatus EFOS ante el SAT (${valEfos}).`
    };
  }

  const tpStatus = String(thirdPartyEstatus69B || '').trim().toUpperCase();
  if (tpStatus === 'PRESUNTO_EFOS' || tpStatus === 'DEFINITIVO_EFOS') {
    return {
      isBlocked: true,
      rfc,
      situacion: tpStatus,
      reason: `EFOS_69B_BLOCKED: El RFC ${rfc} figura en Art. 69-B CFF (${tpStatus}).`
    };
  }

  const dbSit = String(db69BSituacion || '').trim().toUpperCase();
  if (dbSit.includes('PRESUNT') || dbSit.includes('DEFINITIV')) {
    return {
      isBlocked: true,
      rfc,
      situacion: dbSit,
      reason: `EFOS_69B_BLOCKED: El RFC ${rfc} figura en padrón SAT 69-B (${dbSit}).`
    };
  }

  const staticCheck = checkRfc69BStatus(rfc);
  if (
    staticCheck.isEfos &&
    staticCheck.record?.situacion !== 'FAVORABLE'
  ) {
    const sit = staticCheck.record?.situacion || 'EFOS';
    return {
      isBlocked: true,
      rfc,
      situacion: sit,
      reason: `EFOS_69B_BLOCKED: El RFC ${rfc} está catalogado como ${sit} en el Art. 69-B CFF.`
    };
  }

  return { isBlocked: false, rfc };
}

function buildGroupKey(
  item: BatchPreparedCfdiPlan,
  mode: BatchPolizaGroupingMode
): string {
  if (mode === 'BY_DAY') {
    return `${item.year}-${item.period}::${item.accountingDate}::${item.plan.polizaType}`;
  }
  if (mode === 'BY_RFC') {
    return `${item.year}-${item.period}::${item.plan.polizaType}::${item.counterpartyRfc || 'SIN_RFC'}`;
  }
  if (mode === 'BY_NOMINA') {
    if (item.cfdi.tipoComprobante === 'N') {
      return `NOMINA::${item.year}-${item.period}::${item.accountingDate}`;
    }
    return `SINGLE::${item.cfdi.id}`;
  }
  return `SINGLE::${item.cfdi.id}`;
}

function buildGroupConcept(
  items: readonly BatchPreparedCfdiPlan[],
  mode: BatchPolizaGroupingMode,
  accountingDate: string
): string {
  if (items.length === 1) return items[0]!.plan.polizaConcept;
  const first = items[0]!;
  if (mode === 'BY_DAY') {
    return `Póliza Concentrada ${accountingDate} (${items.length} CFDIs)`;
  }
  if (mode === 'BY_RFC') {
    const pTag = `P${String(first.period).padStart(2, '0')}/${first.year}`;
    return `Concentrado ${first.counterpartyRfc || 'RFC'} ${pTag} (${items.length} CFDIs)`;
  }
  if (mode === 'BY_NOMINA') {
    return `Nómina Concentrada ${accountingDate} (${items.length} recibos)`;
  }
  return first.plan.polizaConcept;
}

const MAX_GROUP_MOVEMENTS = Math.max(50, SAFETY_BOUNDS.MAX_POLIZA_MOVEMENTS - 50);

/**
 * Agrupa planes de auto-póliza en modo individual (PER_CFDI) o concentrado
 * (BY_DAY / BY_RFC / BY_NOMINA), preservando todos los UUIDs en cada partida
 * y en la cabecera para su registro en `poliza_cfdis`.
 */
export function buildConcentratedBatchGroups(
  items: readonly BatchPreparedCfdiPlan[],
  mode: BatchPolizaGroupingMode = 'PER_CFDI'
): ConcentratedPolizaGroup[] {
  const buckets = new Map<string, BatchPreparedCfdiPlan[]>();
  for (const item of items) {
    const key = buildGroupKey(item, mode);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }

  const groups: ConcentratedPolizaGroup[] = [];
  for (const [baseKey, bucketItems] of buckets.entries()) {
    const chunks: BatchPreparedCfdiPlan[][] = [];
    let currentChunk: BatchPreparedCfdiPlan[] = [];
    let currentMovCount = 0;

    for (const item of bucketItems) {
      const movLen = item.plan.movements.length;
      if (currentChunk.length > 0 && currentMovCount + movLen > MAX_GROUP_MOVEMENTS) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentMovCount = 0;
      }
      currentChunk.push(item);
      currentMovCount += movLen;
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);

    chunks.forEach((chunkItems, chunkIdx) => {
      const first = chunkItems[0]!;
      const accountingDate = chunkItems.reduce(
        (maxD, it) => (it.accountingDate > maxD ? it.accountingDate : maxD),
        first.accountingDate
      );
      const cfdiIds = chunkItems.map((it) => it.cfdi.id);
      const cfdiUuids = Array.from(
        new Set(chunkItems.map((it) => it.cfdi.uuid.trim().toUpperCase()).filter(Boolean))
      );
      const movements: BatchTaggedMovement[] = [];
      for (const it of chunkItems) {
        const cleanUuid = it.cfdi.uuid.trim().toUpperCase();
        for (const m of it.plan.movements) {
          movements.push({
            ...m,
            cfdiUuid: cleanUuid,
            rfcContraparte: it.counterpartyRfc,
            cfdiTotal: it.cfdi.total,
            cfdiMoneda: it.cfdi.moneda || 'MXN',
            cfdiTipoCambio: it.cfdi.tipoCambio || 1
          });
        }
      }
      groups.push({
        groupKey: chunks.length > 1 ? `${baseKey}::${chunkIdx + 1}` : baseKey,
        polizaType: first.plan.polizaType,
        accountingDate,
        year: first.year,
        period: first.period,
        concepto: buildGroupConcept(chunkItems, mode, accountingDate),
        cfdiIds,
        cfdiUuids,
        primaryUuid: cfdiUuids[0] ?? '',
        movements
      });
    });
  }

  return groups;
}

import { supabase } from '../supabase';
import { buildAutoPolizaPlan } from '../../shared/accounting-engine';
import { parseCalendarDate } from '../../shared/date-utils';
import type { Poliza } from '../../shared/types';
import { logCompanyAuditEvent } from './audit-logger';
import { supabaseAccountingRules } from './supabase-accounting-rules';
import { mapSupabaseCfdi } from './supabase-cfdi-mappers';
import { fetchCompanyAccountsFromDb } from './supabase-mappers';
import { assertSupabasePeriodOpen, mapSupabasePoliza } from './supabase-polizas';

export interface AutoPolizaClientOptions {
  operationAccountCode?: string;
  counterAccountCode?: string;
  deductiblePct?: number;
}

/**
 * Genera y persiste en Supabase una póliza contable automática a partir de un CFDI,
 * aplicando reglas contables aprendidas (`accounting_rules`), padrón fiscal y `deductiblePct`.
 */
export async function runSupabaseAutoPolizaFromCfdi(
  cfdiId: string,
  options?: AutoPolizaClientOptions
): Promise<Poliza> {
  if (!supabase) throw new Error('Supabase no disponible');

  const { data: cfdiRow, error: cfdiErr } = await supabase
    .from('cfdi_documents')
    .select('*')
    .eq('id', cfdiId)
    .single();

  if (cfdiErr || !cfdiRow) throw new Error('CFDI no encontrado en el ADD');
  const cfdi = mapSupabaseCfdi(cfdiRow);
  if (cfdi.polizaId) throw new Error('Este CFDI ya tiene una póliza contable asociada');
  if (cfdi.tipoComprobante === 'T') {
    throw new Error('Los comprobantes de Traslado (T) no generan póliza contable');
  }
  if (cfdi.statusSat === 'CANCELADO') {
    throw new Error('No se pueden contabilizar comprobantes cancelados ante el SAT');
  }
  if (cfdi.total <= 0 && cfdi.subtotal <= 0) {
    throw new Error('Los comprobantes en $0.00 no generan póliza contable');
  }

  const counterpartRfc = cfdi.direction === 'EMITIDO' ? cfdi.receptorRfc : cfdi.emisorRfc;
  const [tpRes, rules, accounts] = await Promise.all([
    supabase
      .from('third_parties')
      .select('cuenta_operacion_code, cuenta_contrapartida_code')
      .eq('company_id', cfdi.companyId)
      .eq('rfc', counterpartRfc)
      .maybeSingle(),
    supabaseAccountingRules.listAccountingRules(cfdi.companyId),
    fetchCompanyAccountsFromDb(cfdi.companyId)
  ]);

  const tpRow = tpRes.data as {
    cuenta_operacion_code?: string | null;
    cuenta_contrapartida_code?: string | null;
  } | null;
  const thirdParty = tpRow
    ? {
        cuentaOperacionCode: tpRow.cuenta_operacion_code || '',
        cuentaContrapartidaCode: tpRow.cuenta_contrapartida_code || ''
      }
    : null;

  let relatedOriginalTipoCambioByUuid: Record<string, number> | undefined;
  let relatedOriginalTipoCambio: number | undefined;
  if (cfdi.tipoComprobante === 'P') {
    const relUuids = Array.from(
      new Set(
        [
          ...(cfdi.relatedDocs?.map((d) => d.idDocumento) ?? []),
          ...(cfdi.uuidRelacionado ? [cfdi.uuidRelacionado] : [])
        ]
          .map((u) => u.trim())
          .filter(Boolean)
      )
    );
    if (relUuids.length > 0) {
      const lookupKeys = Array.from(
        new Set(relUuids.flatMap((u) => [u, u.toUpperCase(), u.toLowerCase()]))
      );
      const { data: relRows } = await supabase
        .from('cfdi_documents')
        .select('uuid, moneda, tipo_cambio')
        .eq('company_id', cfdi.companyId)
        .in('uuid', lookupKeys);
      const tcMap: Record<string, number> = {};
      for (const r of (relRows ?? []) as Array<{ uuid?: string; moneda?: string; tipo_cambio?: number }>) {
        const key = String(r.uuid ?? '').trim().toUpperCase();
        const cur = String(r.moneda ?? 'MXN').toUpperCase();
        const tc = Number(r.tipo_cambio ?? 0);
        if (key && cur !== 'MXN' && tc > 0) {
          tcMap[key] = tc;
          if (relatedOriginalTipoCambio === undefined) relatedOriginalTipoCambio = tc;
        }
      }
      if (Object.keys(tcMap).length > 0) relatedOriginalTipoCambioByUuid = tcMap;
    }
  }

  const plan = buildAutoPolizaPlan(cfdi, accounts, {
    ...options,
    rules,
    thirdParty,
    ...(relatedOriginalTipoCambio !== undefined ? { relatedOriginalTipoCambio } : {}),
    ...(relatedOriginalTipoCambioByUuid ? { relatedOriginalTipoCambioByUuid } : {})
  });

  const { year, month: period } = parseCalendarDate(cfdi.fecha);
  await assertSupabasePeriodOpen(cfdi.companyId, year, period);
  const polizaId = `pol_${crypto.randomUUID().slice(0, 12)}`;

  const { data: maxRows } = await supabase
    .from('polizas')
    .select('folio')
    .eq('company_id', cfdi.companyId)
    .eq('tipo', plan.polizaType)
    .eq('ejercicio', year)
    .eq('periodo', period)
    .order('folio', { ascending: false })
    .limit(1);

  const nextFolio = (maxRows?.[0]?.folio || 0) + 1;
  const now = new Date().toISOString();

  const polizaData = {
    id: polizaId,
    company_id: cfdi.companyId,
    tipo: plan.polizaType,
    folio: nextFolio,
    fecha: cfdi.fecha,
    ejercicio: year,
    periodo: period,
    concepto: plan.polizaConcept,
    cfdi_uuid: cfdi.uuid,
    origin: 'ADD_AUTO' as const,
    created_at: now
  };
  const { error: polErr } = await supabase.from('polizas').insert(polizaData);
  if (polErr) throw new Error(polErr.message);

  const movementsToInsert = plan.movements.map((m, idx) => ({
    id: `mov_${polizaId}_${idx + 1}`,
    poliza_id: polizaId,
    account_id: m.accountId,
    account_code: m.accountCode,
    account_name: m.accountName,
    referencia: m.referencia || '',
    concepto: m.concepto || plan.polizaConcept,
    cargo: Number(m.cargo || 0),
    abono: Number(m.abono || 0),
    cfdi_uuid: cfdi.uuid
  }));

  if (movementsToInsert.length > 0) {
    const { error: movErr } = await supabase.from('poliza_movements').insert(movementsToInsert);
    if (movErr) {
      await supabase.from('polizas').delete().eq('id', polizaId);
      throw new Error(movErr.message);
    }
  }

  const { error: linkErr } = await supabase
    .from('cfdi_documents')
    .update({ poliza_id: polizaId })
    .eq('id', cfdiId);
  if (linkErr) {
    await supabase.from('polizas').delete().eq('id', polizaId);
    throw new Error(linkErr.message);
  }

  logCompanyAuditEvent({
    companyId: cfdi.companyId,
    action: 'POLIZA_CREATE',
    entityType: 'poliza',
    entityId: polizaId,
    metadata: { origin: 'ADD_AUTO', cfdiUuid: cfdi.uuid, folio: nextFolio, ejercicio: year, periodo: period }
  });

  return mapSupabasePoliza(polizaData, movementsToInsert);
}

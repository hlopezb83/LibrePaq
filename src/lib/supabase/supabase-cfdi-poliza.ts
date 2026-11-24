import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { buildAutoPolizaPlan } from '../../shared/engine/auto-poliza.engine';
import { validateDoubleEntryMovements } from '../../shared/engine/invariants-and-math';
import { parseCalendarDate } from '../../shared/date-utils';
import { MESES_SAT } from '../../shared/sat-constants';
import type { AccountWithBalance, Poliza, ThirdPartyRecord } from '../../shared/types';
import type { AccountingRuleRecord } from '../../shared/types/accounting-rules.types';
import { logCompanyAuditEvent } from './audit-logger';
import { supabaseAccountingRules } from './supabase-accounting-rules';
import { fetchRelatedCfdiOverrides, mapSupabaseCfdi } from './supabase-cfdi-mappers';
import { fetchCompanyAccountsFromDb, mapSupabaseAccount } from './supabase-mappers';
import { fetchAllRows } from './supabase-pagination';
import { assertSupabasePeriodOpen, mapSupabasePoliza } from './supabase-polizas-mappers';

export interface AutoPolizaClientOptions {
  operationAccountCode?: string;
  counterAccountCode?: string;
  deductiblePct?: number;
}

export interface AutoPolizaBatchContext {
  accounts?: AccountWithBalance[];
  rules?: AccountingRuleRecord[];
  thirdParties?: Map<
    string,
    { rol?: ThirdPartyRecord['rol']; cuentaOperacionCode: string; cuentaContrapartidaCode: string }
  >;
  periodLocks?: Map<string, boolean>;
}

const MAX_FOLIO_CONFLICT_RETRIES = 4;

function isUniqueFolioConflict(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '23505') return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('23505') || msg.includes('duplicate key') || msg.includes('uq_polizas_company_folio');
}

/**
 * Precarga catálogos (cuentas, reglas, terceros y candados) una sola vez
 * para evitar refetches por cada CFDI durante contabilización masiva.
 */
export async function preloadAutoPolizaBatchContext(
  companyId: string,
  clientOverride?: SupabaseClient
): Promise<AutoPolizaBatchContext> {
  const client = clientOverride ?? supabase;
  if (!client || !companyId) return {};

  const [accounts, rules, tpRows, lockRes] = await Promise.all([
    clientOverride
      ? fetchAllRows(async (from, to) =>
          clientOverride
            .from('accounts')
            .select('*')
            .eq('company_id', companyId)
            .order('code', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to)
        ).then((rows) => rows.map((r) => mapSupabaseAccount(r)))
      : fetchCompanyAccountsFromDb(companyId),
    supabaseAccountingRules.listAccountingRules(companyId),
    fetchAllRows(async (from, to) =>
      client
        .from('third_parties')
        .select('rfc, rol, cuenta_operacion_code, cuenta_contrapartida_code')
        .eq('company_id', companyId)
        .order('rfc', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    client
      .from('period_locks')
      .select('ejercicio, periodo, is_locked')
      .eq('company_id', companyId)
  ]);

  const thirdParties = new Map<
    string,
    { rol?: ThirdPartyRecord['rol']; cuentaOperacionCode: string; cuentaContrapartidaCode: string }
  >();
  for (const row of tpRows as Array<{
    rfc?: string;
    rol?: string | null;
    cuenta_operacion_code?: string | null;
    cuenta_contrapartida_code?: string | null;
  }>) {
    const rfc = String(row.rfc || '').trim().toUpperCase();
    if (!rfc) continue;
    thirdParties.set(rfc, {
      ...(row.rol ? { rol: row.rol as ThirdPartyRecord['rol'] } : {}),
      cuentaOperacionCode: row.cuenta_operacion_code || '',
      cuentaContrapartidaCode: row.cuenta_contrapartida_code || ''
    });
  }

  const periodLocks = new Map<string, boolean>();
  for (const l of (lockRes.data || []) as Array<{ ejercicio: number; periodo: number; is_locked?: boolean }>) {
    periodLocks.set(`${l.ejercicio}-${l.periodo}`, Boolean(l.is_locked));
  }

  return { accounts, rules, thirdParties, periodLocks };
}

/**
 * Ejecuta la auto-póliza CFDI sobre un cliente Supabase explícito (útil para tests unitarios e inyección).
 */
export async function runAutoPolizaFromCfdiWithClient(
  client: SupabaseClient,
  cfdiId: string,
  options?: AutoPolizaClientOptions,
  batchContext?: AutoPolizaBatchContext
): Promise<Poliza> {
  const { data: cfdiRow, error: cfdiErr } = await client
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

  const counterpartRfc = (cfdi.direction === 'EMITIDO' ? cfdi.receptorRfc : cfdi.emisorRfc).trim().toUpperCase();
  const hasPreloadedTp = batchContext?.thirdParties !== undefined;

  const [tpFetched, rules, accounts] = await Promise.all([
    hasPreloadedTp
      ? Promise.resolve(batchContext.thirdParties?.get(counterpartRfc) ?? null)
      : client
          .from('third_parties')
          .select('rol, cuenta_operacion_code, cuenta_contrapartida_code')
          .eq('company_id', cfdi.companyId)
          .eq('rfc', counterpartRfc)
          .maybeSingle()
          .then((res) => {
            const tpRow = res.data as {
              rol?: string | null;
              cuenta_operacion_code?: string | null;
              cuenta_contrapartida_code?: string | null;
            } | null;
            return tpRow
              ? {
                  ...(tpRow.rol ? { rol: tpRow.rol as ThirdPartyRecord['rol'] } : {}),
                  cuentaOperacionCode: tpRow.cuenta_operacion_code || '',
                  cuentaContrapartidaCode: tpRow.cuenta_contrapartida_code || ''
                }
              : null;
          }),
    batchContext?.rules !== undefined
      ? Promise.resolve(batchContext.rules)
      : supabaseAccountingRules.listAccountingRules(cfdi.companyId),
    batchContext?.accounts !== undefined
      ? Promise.resolve(batchContext.accounts)
      : fetchCompanyAccountsFromDb(cfdi.companyId)
  ]);

  const relatedOverrides = await fetchRelatedCfdiOverrides(client, cfdi);

  const plan = buildAutoPolizaPlan(cfdi, accounts, {
    ...options,
    rules,
    thirdParty: tpFetched,
    ...relatedOverrides
  });

  if (!plan.isBalanced) {
    throw new Error(
      `Póliza automática descuadrada para el CFDI ${cfdi.uuid}: Cargos ($${plan.totalCargo.toFixed(2)}) ≠ Abonos ($${plan.totalAbono.toFixed(2)}).`
    );
  }
  const accMap = new Map(accounts.map((a) => [a.id, a]));
  validateDoubleEntryMovements(plan.movements, accMap);

  const accountingDate =
    (cfdi.tipoComprobante === 'P' || cfdi.tipoComprobante === 'N') && cfdi.fechaPago
      ? cfdi.fechaPago
      : cfdi.fecha;
  const { year, month: period } = parseCalendarDate(accountingDate);
  const lockKey = `${year}-${period}`;
  if (batchContext?.periodLocks?.has(lockKey)) {
    if (batchContext.periodLocks.get(lockKey)) {
      const mesNombre = MESES_SAT.find((m) => m.periodo === period)?.nombre || `Periodo ${period}`;
      throw new Error(
        `El periodo contable ${mesNombre} ${year} está CERRADO con candado fiscal. Ábrelo primero si necesitas registrar, editar o eliminar pólizas.`
      );
    }
  } else {
    await assertSupabasePeriodOpen(cfdi.companyId, year, period);
  }

  const polizaId = `pol_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  let nextFolio = 1;
  let prevFolio = 0;
  let polizaData: {
    id: string;
    company_id: string;
    tipo: typeof plan.polizaType;
    folio: number;
    fecha: string;
    ejercicio: number;
    periodo: number;
    concepto: string;
    cfdi_uuid: string;
    origin: 'ADD_AUTO';
    created_at: string;
  } | null = null;

  for (let attempt = 0; attempt < MAX_FOLIO_CONFLICT_RETRIES; attempt++) {
    const { data: maxRows, error: maxErr } = await client
      .from('polizas')
      .select('folio')
      .eq('company_id', cfdi.companyId)
      .eq('tipo', plan.polizaType)
      .eq('ejercicio', year)
      .eq('periodo', period)
      .order('folio', { ascending: false })
      .limit(1);
    if (maxErr) throw new Error(maxErr.message);

    nextFolio = Math.max(Number(maxRows?.[0]?.folio || 0) + 1, prevFolio + 1);
    const candidate = {
      id: polizaId,
      company_id: cfdi.companyId,
      tipo: plan.polizaType,
      folio: nextFolio,
      fecha: accountingDate,
      ejercicio: year,
      periodo: period,
      concepto: plan.polizaConcept,
      cfdi_uuid: cfdi.uuid,
      origin: 'ADD_AUTO' as const,
      created_at: now
    };
    const { error: polErr } = await client.from('polizas').insert(candidate);
    if (!polErr) {
      polizaData = candidate;
      break;
    }
    if (isUniqueFolioConflict(polErr) && attempt < MAX_FOLIO_CONFLICT_RETRIES - 1) {
      prevFolio = nextFolio;
      continue;
    }
    throw new Error(polErr.message);
  }

  if (!polizaData) {
    throw new Error('No se pudo asignar un folio único para la póliza automática.');
  }

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
    const { error: movErr } = await client.from('poliza_movements').insert(movementsToInsert);
    if (movErr) {
      await client.from('polizas').delete().eq('id', polizaId);
      throw new Error(movErr.message);
    }
  }

  const { data: claimedRows, error: linkErr } = await client
    .from('cfdi_documents')
    .update({ poliza_id: polizaId })
    .eq('id', cfdiId)
    .is('poliza_id', null)
    .select('id');
  if (linkErr) {
    await client.from('polizas').delete().eq('id', polizaId);
    throw new Error(linkErr.message);
  }
  if (!claimedRows || claimedRows.length === 0) {
    await client.from('polizas').delete().eq('id', polizaId);
    throw new Error('Este CFDI ya fue contabilizado concurrentemente por otra operación.');
  }

  try {
    await client.from('poliza_cfdis').insert({
      id: `pc_${crypto.randomUUID().slice(0, 12)}`,
      company_id: cfdi.companyId,
      poliza_id: polizaId,
      cfdi_uuid: cfdi.uuid
    });
  } catch {
    // Ignorar si poliza_cfdis no está disponible en instancias previas a Ronda 4
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

/**
 * Genera y persiste en Supabase una póliza contable automática a partir de un CFDI,
 * aplicando reglas contables aprendidas (`accounting_rules`), padrón fiscal y `deductiblePct`.
 */
export async function runSupabaseAutoPolizaFromCfdi(
  cfdiId: string,
  options?: AutoPolizaClientOptions,
  batchContext?: AutoPolizaBatchContext
): Promise<Poliza> {
  if (!supabase) throw new Error('Supabase no disponible');
  return runAutoPolizaFromCfdiWithClient(supabase, cfdiId, options, batchContext);
}

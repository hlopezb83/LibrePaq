import { supabase } from '../supabase';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-constants';
import { logCompanyAuditEvent } from './audit-logger';
import { chunkArray, fetchAllRows } from './supabase-pagination';

export interface CloudReclassifyAccountInput {
  companyId: string;
  fromAccountId: string;
  toAccountId: string;
  ejercicio: number;
  periodFrom?: number;
  periodTo?: number;
}

export interface CloudReclassifyAccountResult {
  updatedMovementsCount: number;
  affectedPolizasCount: number;
}

export const supabasePolizasReclassify = {
  async reclassifyAccountMovements(
    input: CloudReclassifyAccountInput
  ): Promise<CloudReclassifyAccountResult> {
    if (!supabase) throw new Error('Supabase no disponible');

    assertAccountingInvariant(
      Boolean(input.companyId && input.fromAccountId && input.toAccountId),
      'INVALID_RECLASSIFY_PAYLOAD',
      'Debes seleccionar la empresa, cuenta origen y cuenta destino.'
    );
    assertAccountingInvariant(
      input.fromAccountId !== input.toAccountId,
      'SAME_ACCOUNT_RECLASSIFY',
      'La cuenta origen y la cuenta destino deben ser distintas.'
    );

    const { data: accRows, error: accErr } = await supabase
      .from('accounts')
      .select('id, code, name, is_affectable')
      .eq('company_id', input.companyId)
      .in('id', [input.fromAccountId, input.toAccountId]);

    if (accErr) throw new Error(accErr.message);

    const fromAcc = (accRows || []).find((a) => a.id === input.fromAccountId);
    const toAcc = (accRows || []).find((a) => a.id === input.toAccountId);

    if (!fromAcc) throw new Error('La cuenta origen no existe en el catálogo de esta empresa.');
    if (!toAcc) throw new Error('La cuenta destino no existe en el catálogo de esta empresa.');
    if (!fromAcc.is_affectable) {
      throw new Error(`La cuenta origen ${fromAcc.code} es acumuladora y no afectable.`);
    }
    if (!toAcc.is_affectable) {
      throw new Error(`La cuenta destino ${toAcc.code} es acumuladora y no afectable.`);
    }

    const pFrom = Math.max(1, Math.min(13, input.periodFrom ?? 1));
    const pTo = Math.max(pFrom, Math.min(13, input.periodTo ?? 13));

    const movRows = await fetchAllRows(async (from, to) =>
      supabase!
        .from('poliza_movements')
        .select('id, poliza_id, polizas!inner(id, company_id, ejercicio, periodo)')
        .eq('account_id', input.fromAccountId)
        .eq('polizas.company_id', input.companyId)
        .eq('polizas.ejercicio', input.ejercicio)
        .gte('polizas.periodo', pFrom)
        .lte('polizas.periodo', pTo)
        .order('id', { ascending: true })
        .range(from, to)
    );

    const { data: lockRows, error: lockErr } = await supabase
      .from('period_locks')
      .select('periodo')
      .eq('company_id', input.companyId)
      .eq('ejercicio', input.ejercicio)
      .eq('is_locked', true);

    if (lockErr) throw new Error(lockErr.message);

    const lockedPeriods = new Set((lockRows || []).map((r) => Number(r.periodo)));

    if (movRows.length === 0) {
      if (input.periodFrom !== undefined && input.periodTo !== undefined && pFrom === pTo && lockedPeriods.has(pFrom)) {
        const mesNombre = MESES_SAT.find((m) => m.periodo === pFrom)?.nombre || `Periodo ${pFrom}`;
        throw new Error(
          `El periodo contable ${mesNombre} ${input.ejercicio} está CERRADO con candado fiscal.`
        );
      }
      return { updatedMovementsCount: 0, affectedPolizasCount: 0 };
    }

    const matchingIds: string[] = [];
    const polizaIdSet = new Set<string>();

    for (const row of movRows as Array<{
      id: string;
      poliza_id: string;
      polizas?: { periodo?: number } | Array<{ periodo?: number }>;
    }>) {
      const pol = Array.isArray(row.polizas) ? row.polizas[0] : row.polizas;
      const per = Number(pol?.periodo ?? 0);
      if (lockedPeriods.has(per)) {
        const mesNombre = MESES_SAT.find((m) => m.periodo === per)?.nombre || `Periodo ${per}`;
        throw new Error(
          `El periodo contable ${mesNombre} ${input.ejercicio} está CERRADO con candado fiscal. No es posible reclasificar movimientos en periodos bloqueados.`
        );
      }
      matchingIds.push(row.id);
      polizaIdSet.add(row.poliza_id);
    }

    const updatedChunks: string[][] = [];
    for (const chunk of chunkArray(matchingIds, 100)) {
      const { error: updErr } = await supabase
        .from('poliza_movements')
        .update({
          account_id: toAcc.id,
          account_code: toAcc.code,
          account_name: toAcc.name
        })
        .in('id', chunk);
      if (updErr) {
        for (const prevChunk of updatedChunks) {
          await supabase
            .from('poliza_movements')
            .update({
              account_id: fromAcc.id,
              account_code: fromAcc.code,
              account_name: fromAcc.name
            })
            .in('id', prevChunk);
        }
        throw new Error(updErr.message);
      }
      updatedChunks.push(chunk);
    }

    if (String(fromAcc.code || '').trim().startsWith('102')) {
      for (const idChunk of chunkArray(matchingIds, 100)) {
        const { data: matchRows, error: matchSelErr } = await supabase
          .from('bank_statement_matches')
          .select('bank_line_id')
          .in('movement_id', idChunk);
        if (matchSelErr) throw new Error(matchSelErr.message);

        const lineIds = Array.from(
          new Set(
            ((matchRows || []) as Array<{ bank_line_id?: string | null }>)
              .map((r) => r.bank_line_id)
              .filter((id): id is string => Boolean(id))
          )
        );
        if (lineIds.length > 0) {
          const { error: lineClearErr } = await supabase
            .from('bank_statement_lines')
            .update({ matched_movement_id: null })
            .in('id', lineIds);
          if (lineClearErr) throw new Error(lineClearErr.message);
        }

        const { error: directClearErr } = await supabase
          .from('bank_statement_lines')
          .update({ matched_movement_id: null })
          .in('matched_movement_id', idChunk);
        if (directClearErr) throw new Error(directClearErr.message);

        const { error: delMatchErr } = await supabase
          .from('bank_statement_matches')
          .delete()
          .in('movement_id', idChunk);
        if (delMatchErr) throw new Error(delMatchErr.message);
      }
    }

    logCompanyAuditEvent({
      companyId: input.companyId,
      action: 'ACCOUNT_RECLASSIFY',
      entityType: 'account',
      entityId: fromAcc.id,
      metadata: {
        fromAccountCode: fromAcc.code,
        toAccountCode: toAcc.code,
        ejercicio: input.ejercicio,
        periodFrom: pFrom,
        periodTo: pTo,
        updatedMovementsCount: matchingIds.length,
        affectedPolizasCount: polizaIdSet.size
      }
    });

    return {
      updatedMovementsCount: matchingIds.length,
      affectedPolizasCount: polizaIdSet.size
    };
  }
};

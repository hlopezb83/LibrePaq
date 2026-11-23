import { getRequiredSupabase, supabase } from '../supabase';
import {
  buildBankLinePolizaPlan,
  fromCents,
  sumCents
} from '../../shared/accounting-engine';
import { parseCalendarDate } from '../../shared/date-utils';
import { findBankReconciliationMatches } from '../../shared/engine/bank-and-closing.engine';
import type { BankReconciliationResponse } from '../../shared/types';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { fetchAllRows } from './supabase-pagination';
import { assertSupabasePeriodOpen, supabasePolizas } from './supabase-polizas';

export const supabaseBank = {
  async getBankReconciliation(
    companyId: string, accountId: string, year?: number, period?: number
  ): Promise<BankReconciliationResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    let currentYear = year;
    let currentPeriod = period;
    if (!currentYear || !currentPeriod) {
      const { data: comp } = await supabase
        .from('companies')
        .select('current_year, current_period')
        .eq('id', companyId)
        .maybeSingle();
      currentYear = currentYear || Number(comp?.current_year) || 2026;
      currentPeriod = currentPeriod || Number(comp?.current_period) || 10;
    }
    const accounts = await supabaseCompaniesAndAccounts.getAccounts(companyId, currentYear, currentPeriod);
    const effectiveAcc = accounts.find((a) => a.id === accountId) ||
      accounts.find((a) => a.code.startsWith('102')) || {
        id: accountId || 'acc_bancos', companyId, code: '102-01-001',
        name: 'Bancos Nacionales Moneda Nacional', parentCode: '102-00-000',
        type: 'ACTIVO' as const, nature: 'DEUDORA' as const, level: 3,
        isAffectable: true, satGroupCode: '102.01', currency: 'MXN' as const,
        initialBalance: 0, initialBalanceComputed: 0, periodCharges: 0, periodCredits: 0, finalBalance: 0
      };

    const lines = await fetchAllRows(async (from, to) => {
      let query = getRequiredSupabase()
        .from('bank_statement_lines')
        .select('*')
        .eq('company_id', companyId)
        .eq('ejercicio', currentYear)
        .eq('periodo', currentPeriod);

      if (accountId) query = query.eq('account_id', accountId);
      return query.order('fecha', { ascending: true }).order('id', { ascending: true }).range(from, to);
    });

    const statementLines = lines.map((l: Record<string, unknown>) => ({
      id: String(l.id),
      companyId: String(l.company_id),
      accountId: String(l.account_id || effectiveAcc.id),
      fecha: String(l.fecha),
      ejercicio: Number(l.ejercicio),
      periodo: Number(l.periodo),
      referencia: String(l.referencia || ''),
      descripcion: String(l.descripcion || ''),
      cargoBanco: Number(l.cargo_banco || 0),
      abonoBanco: Number(l.abono_banco || 0),
      matchedMovementId: l.matched_movement_id ? String(l.matched_movement_id) : null,
      matchedPolizaFolio: l.matched_poliza_folio ? String(l.matched_poliza_folio) : null
    }));

    const matchedMovementIds = new Set(
      statementLines.map((l) => l.matchedMovementId).filter(Boolean) as string[]
    );

    const polizas = await supabasePolizas.getPolizas(companyId, currentYear, currentPeriod);
    const bookMovements: BankReconciliationResponse['bookMovements'] = [];
    const movementFolioMap = new Map<string, string>();

    for (const p of polizas) {
      const pFolio = `${p.tipo} #${p.folio}`;
      for (const m of p.movements) {
        movementFolioMap.set(m.id, pFolio);
        if (m.accountId === effectiveAcc.id || m.accountCode === effectiveAcc.code) {
          bookMovements.push({
            movementId: m.id,
            polizaId: p.id,
            polizaFolio: pFolio,
            fecha: p.fecha,
            referencia: m.referencia || '',
            concepto: m.concepto || p.concepto,
            cargoContable: Number(m.cargo || 0),
            abonoContable: Number(m.abono || 0),
            isMatched: matchedMovementIds.has(m.id)
          });
        }
      }
    }

    for (const line of statementLines) {
      if (line.matchedMovementId && !line.matchedPolizaFolio) {
        line.matchedPolizaFolio = movementFolioMap.get(line.matchedMovementId) ?? null;
      }
    }

    const totalDepositosBanco = fromCents(sumCents(statementLines.map((l) => l.abonoBanco)));
    const totalRetirosBanco = fromCents(sumCents(statementLines.map((l) => l.cargoBanco)));

    return {
      account: effectiveAcc,
      ejercicio: currentYear,
      periodo: currentPeriod,
      statementLines,
      bookMovements,
      summary: {
        saldoInicialLibros: effectiveAcc.initialBalanceComputed,
        saldoFinalLibros: effectiveAcc.finalBalance,
        totalDepositosBanco,
        totalRetirosBanco,
        movimientosConciliados: statementLines.filter((s) => s.matchedMovementId).length,
        movimientosPendientesBanco: statementLines.filter((s) => !s.matchedMovementId).length,
        movimientosPendientesLibros: bookMovements.filter((b) => !b.isMatched).length
      }
    };
  },

  async addBankStatementLines(payload: {
    companyId: string;
    accountId: string;
    lines: Array<{
      fecha: string;
      referencia: string;
      descripcion: string;
      cargoBanco: number;
      abonoBanco: number;
    }>;
  }): Promise<BankReconciliationResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    const periodPairs = new Set<string>(
      payload.lines.map((l) => {
        const { year, month } = parseCalendarDate(l.fecha);
        return `${year}:${month}`;
      })
    );
    for (const pair of periodPairs) {
      const [yStr, pStr] = pair.split(':');
      await assertSupabasePeriodOpen(payload.companyId, Number(yStr) || 2026, Number(pStr) || 10);
    }

    const existingLines = await fetchAllRows(async (from, to) =>
      getRequiredSupabase()
        .from('bank_statement_lines')
        .select('id, fecha, referencia, descripcion, cargo_banco, abono_banco')
        .eq('company_id', payload.companyId)
        .eq('account_id', payload.accountId)
        .order('id', { ascending: true })
        .range(from, to)
    );

    const existingSet = new Set(
      existingLines.map(
        (e) =>
          `${e.fecha}|${e.referencia}|${e.descripcion}|${Number(e.cargo_banco).toFixed(2)}|${Number(e.abono_banco).toFixed(2)}`
      )
    );

    const toInsert = payload.lines
      .filter((l) => !existingSet.has(`${l.fecha}|${l.referencia}|${l.descripcion}|${Number(l.cargoBanco || 0).toFixed(2)}|${Number(l.abonoBanco || 0).toFixed(2)}`))
      .map((l) => {
        const { year, month } = parseCalendarDate(l.fecha);
        return {
          id: `bank_${crypto.randomUUID().slice(0, 12)}`,
          company_id: payload.companyId,
          account_id: payload.accountId,
          fecha: l.fecha,
          ejercicio: year,
          periodo: month,
          referencia: l.referencia,
          descripcion: l.descripcion,
          cargo_banco: l.cargoBanco,
          abono_banco: l.abonoBanco
        };
      });

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('bank_statement_lines').insert(toInsert);
      if (insErr) throw new Error(insErr.message);
    }
    const targetPeriod = payload.lines[0]
      ? parseCalendarDate(payload.lines[0].fecha)
      : undefined;
    return this.getBankReconciliation(
      payload.companyId,
      payload.accountId,
      targetPeriod?.year,
      targetPeriod?.month
    );
  },

  async autoMatchBankReconciliation(
    companyId: string,
    accountId: string,
    year?: number,
    period?: number
  ): Promise<{ matchedCount: number; reconciliation: BankReconciliationResponse }> {
    const comp = (await supabaseCompaniesAndAccounts.getCompanies()).find((c) => c.id === companyId);
    const effY = year || comp?.currentYear || 2026;
    const effP = period || comp?.currentPeriod || 10;
    await assertSupabasePeriodOpen(companyId, effY, effP);
    const current = await this.getBankReconciliation(companyId, accountId, effY, effP);
    if (!supabase) return { matchedCount: 0, reconciliation: current };

    const pairs = findBankReconciliationMatches(current.statementLines, current.bookMovements);
    for (const pair of pairs) {
      const { error: updErr } = await supabase
        .from('bank_statement_lines')
        .update({ matched_movement_id: pair.movementId })
        .eq('id', pair.statementLineId);
      if (updErr) throw new Error(updErr.message);
    }

    const updated = await this.getBankReconciliation(companyId, accountId, effY, effP);
    return { matchedCount: pairs.length, reconciliation: updated };
  },

  async unmatchBankLine(
    lineId: string
  ): Promise<{ unmatched: boolean; reconciliation: BankReconciliationResponse }> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { data: bLine, error: fetchErr } = await supabase
      .from('bank_statement_lines')
      .select('company_id, account_id, ejercicio, periodo')
      .eq('id', lineId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!bLine) throw new Error('Movimiento bancario no encontrado');
    const lineYear = Number(bLine.ejercicio) || 2026;
    const linePeriod = Number(bLine.periodo) || 10;
    await assertSupabasePeriodOpen(String(bLine.company_id), lineYear, linePeriod);

    const { error: matchDelErr } = await supabase
      .from('bank_statement_matches')
      .delete()
      .eq('bank_line_id', lineId);
    if (matchDelErr) throw new Error(matchDelErr.message);

    const { error: updErr } = await supabase
      .from('bank_statement_lines')
      .update({ matched_movement_id: null })
      .eq('id', lineId);
    if (updErr) throw new Error(updErr.message);

    const reconciliation = await this.getBankReconciliation(
      String(bLine.company_id),
      String(bLine.account_id),
      lineYear,
      linePeriod
    );
    return { unmatched: true, reconciliation };
  },

  async createPolizaFromBankLine(
    lineId: string,
    options?: { counterAccountCode?: string; desglosarIva?: boolean }
  ): Promise<{ createdPolizaId: string; reconciliation: BankReconciliationResponse }> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { data: bLine, error: fetchErr } = await supabase
      .from('bank_statement_lines')
      .select('*')
      .eq('id', lineId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!bLine) throw new Error('Movimiento bancario no encontrado');
    if (bLine.matched_movement_id) throw new Error('El movimiento ya se encuentra conciliado');

    const companyId = String(bLine.company_id);
    const accountId = String(bLine.account_id);
    const ejercicio = Number(bLine.ejercicio) || 2026;
    const periodo = Number(bLine.periodo) || 10;

    const accounts = await supabaseCompaniesAndAccounts.getAccounts(companyId, ejercicio, periodo);
    const plan = buildBankLinePolizaPlan({
      accounts,
      accountId,
      cargoBanco: Number(bLine.cargo_banco),
      abonoBanco: Number(bLine.abono_banco),
      referencia: String(bLine.referencia || ''),
      descripcion: String(bLine.descripcion || ''),
      desglosarIva: options?.desglosarIva,
      counterAccountCode: options?.counterAccountCode
    });

    const poliza = await supabasePolizas.createPoliza({
      companyId,
      tipo: plan.tipo,
      fecha: String(bLine.fecha),
      ejercicio,
      periodo,
      concepto: String(bLine.descripcion || 'Póliza generada desde estado de cuenta bancario'),
      cfdiUuid: null,
      movements: plan.movements.map((m) => ({
        accountId: m.accountId,
        referencia: m.referencia,
        concepto: m.concepto,
        cargo: m.cargo,
        abono: m.abono
      }))
    });

    const bankMov = poliza.movements.find((m) => m.accountId === plan.bankAcc.id);
    if (bankMov) {
      const { error: updErr } = await supabase
        .from('bank_statement_lines')
        .update({ matched_movement_id: bankMov.id })
        .eq('id', lineId);
      if (updErr) throw new Error(updErr.message);
    }

    const reconciliation = await this.getBankReconciliation(companyId, accountId, ejercicio, periodo);
    return { createdPolizaId: poliza.id, reconciliation };
  }
};

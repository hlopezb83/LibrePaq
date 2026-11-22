import { supabase } from '../supabase';
import {
  fromCents,
  resolveFiscalAccount,
  sumCents,
  toCents
} from '../../shared/accounting-engine';
import type { BankReconciliationResponse } from '../../shared/types';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { supabasePolizasAndCfdi } from './supabase-polizas-cfdi';
import { assertSupabasePeriodOpen } from './supabase-polizas';

export const supabaseBank = {
  async getBankReconciliation(
    companyId: string, accountId: string, year?: number, period?: number
  ): Promise<BankReconciliationResponse> {
    if (!supabase) throw new Error('Supabase no disponible');
    const currentYear = year || 2026;
    const currentPeriod = period || 10;
    const accounts = await supabaseCompaniesAndAccounts.getAccounts(companyId, currentYear, currentPeriod);
    const effectiveAcc = accounts.find((a) => a.id === accountId) ||
      accounts.find((a) => a.code.startsWith('102')) || {
        id: accountId || 'acc_bancos', companyId, code: '102-01-001',
        name: 'Bancos Nacionales Moneda Nacional', parentCode: '102-00-000',
        type: 'ACTIVO' as const, nature: 'DEUDORA' as const, level: 3,
        isAffectable: true, satGroupCode: '102.01', currency: 'MXN' as const,
        initialBalance: 0, initialBalanceComputed: 0, periodCharges: 0, periodCredits: 0, finalBalance: 0
      };

    let query = supabase
      .from('bank_statement_lines')
      .select('*')
      .eq('company_id', companyId)
      .eq('ejercicio', currentYear)
      .eq('periodo', currentPeriod);

    if (accountId) query = query.eq('account_id', accountId);

    const { data: lines } = await query;
    const statementLines = (lines || []).map((l: Record<string, unknown>) => ({
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

    const polizas = await supabasePolizasAndCfdi.getPolizas(companyId, currentYear, currentPeriod);
    const bookMovements: BankReconciliationResponse['bookMovements'] = [];

    for (const p of polizas) {
      for (const m of p.movements) {
        if (m.accountId === effectiveAcc.id || m.accountCode === effectiveAcc.code) {
          bookMovements.push({
            movementId: m.id,
            polizaId: p.id,
            polizaFolio: `${p.tipo} #${p.folio}`,
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
      payload.lines.map((l) => `${new Date(l.fecha).getFullYear() || 2026}:${new Date(l.fecha).getMonth() + 1 || 10}`)
    );
    for (const pair of periodPairs) {
      const [yStr, pStr] = pair.split(':');
      await assertSupabasePeriodOpen(payload.companyId, Number(yStr) || 2026, Number(pStr) || 10);
    }

    const { data: existingLines } = await supabase
      .from('bank_statement_lines')
      .select('fecha, referencia, descripcion, cargo_banco, abono_banco')
      .eq('company_id', payload.companyId)
      .eq('account_id', payload.accountId);

    const existingSet = new Set(
      (existingLines || []).map(
        (e) =>
          `${e.fecha}|${e.referencia}|${e.descripcion}|${Number(e.cargo_banco).toFixed(2)}|${Number(e.abono_banco).toFixed(2)}`
      )
    );

    const toInsert = payload.lines
      .filter((l) => !existingSet.has(`${l.fecha}|${l.referencia}|${l.descripcion}|${Number(l.cargoBanco || 0).toFixed(2)}|${Number(l.abonoBanco || 0).toFixed(2)}`))
      .map((l, idx) => ({
        id: `bank_${Date.now()}_${idx}`,
        company_id: payload.companyId,
        account_id: payload.accountId,
        fecha: l.fecha,
        ejercicio: new Date(l.fecha).getFullYear() || 2026,
        periodo: new Date(l.fecha).getMonth() + 1 || 10,
        referencia: l.referencia,
        descripcion: l.descripcion,
        cargo_banco: l.cargoBanco,
        abono_banco: l.abonoBanco
      }));

    if (toInsert.length > 0) {
      await supabase.from('bank_statement_lines').insert(toInsert);
    }
    return this.getBankReconciliation(payload.companyId, payload.accountId);
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

    const unmatchedBank = current.statementLines.filter((s) => !s.matchedMovementId);
    const unmatchedBooks = [...current.bookMovements.filter((b) => !b.isMatched)];

    let matchedCount = 0;
    for (const bLine of unmatchedBank) {
      const matchIdx = unmatchedBooks.findIndex(
        (bm) =>
          toCents(bm.cargoContable) === toCents(bLine.abonoBanco) &&
          toCents(bm.abonoContable) === toCents(bLine.cargoBanco)
      );
      if (matchIdx !== -1) {
        const matchedBook = unmatchedBooks[matchIdx];
        if (matchedBook) {
          await supabase
            .from('bank_statement_lines')
            .update({ matched_movement_id: matchedBook.movementId })
            .eq('id', bLine.id);
          unmatchedBooks.splice(matchIdx, 1);
          matchedCount += 1;
        }
      }
    }

    const updated = await this.getBankReconciliation(companyId, accountId, effY, effP);
    return { matchedCount, reconciliation: updated };
  },

  async unmatchBankLine(
    lineId: string
  ): Promise<{ unmatched: boolean; reconciliation: BankReconciliationResponse }> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { data: bLine } = await supabase
      .from('bank_statement_lines')
      .select('company_id, account_id, ejercicio, periodo')
      .eq('id', lineId)
      .maybeSingle();

    if (!bLine) throw new Error('Movimiento bancario no encontrado');
    await assertSupabasePeriodOpen(
      String(bLine.company_id),
      Number(bLine.ejercicio) || 2026,
      Number(bLine.periodo) || 10
    );

    await supabase
      .from('bank_statement_lines')
      .update({ matched_movement_id: null })
      .eq('id', lineId);

    const reconciliation = await this.getBankReconciliation(
      String(bLine.company_id),
      String(bLine.account_id)
    );
    return { unmatched: true, reconciliation };
  },

  async createPolizaFromBankLine(
    lineId: string,
    options?: { counterAccountCode?: string; desglosarIva?: boolean }
  ): Promise<{ createdPolizaId: string; reconciliation: BankReconciliationResponse }> {
    if (!supabase) throw new Error('Supabase no disponible');
    const { data: bLine } = await supabase
      .from('bank_statement_lines')
      .select('*')
      .eq('id', lineId)
      .maybeSingle();

    if (!bLine) throw new Error('Movimiento bancario no encontrado');
    if (bLine.matched_movement_id) throw new Error('El movimiento ya se encuentra conciliado');

    const companyId = String(bLine.company_id);
    const accountId = String(bLine.account_id);
    const ejercicio = Number(bLine.ejercicio) || 2026;
    const periodo = Number(bLine.periodo) || 10;

    const accounts = await supabaseCompaniesAndAccounts.getAccounts(companyId, ejercicio, periodo);
    const bankAcc =
      accounts.find((a) => a.id === accountId) ||
      resolveFiscalAccount(accounts, 'BANCO_PRINCIPAL');

    const isWithdrawal = toCents(Number(bLine.cargo_banco)) > 0;
    const amountCents = isWithdrawal
      ? toCents(Number(bLine.cargo_banco))
      : toCents(Number(bLine.abono_banco));
    const desglosarIva = options?.desglosarIva !== undefined ? Boolean(options.desglosarIva) : true;

    const counterAcc = isWithdrawal
      ? resolveFiscalAccount(accounts, 'COMISIONES_BANCARIAS', options?.counterAccountCode)
      : resolveFiscalAccount(accounts, 'INGRESOS_TASA_16', options?.counterAccountCode);

    const ivaAcc = isWithdrawal
      ? resolveFiscalAccount(accounts, 'IVA_ACREDITABLE_PAGADO')
      : resolveFiscalAccount(accounts, 'IVA_TRASLADADO_COBRADO');

    const tipo = isWithdrawal ? 'EGRESO' : 'INGRESO';
    const subtotalCents = desglosarIva ? Math.round(amountCents / 1.16) : amountCents;
    const ivaCents = desglosarIva ? amountCents - subtotalCents : 0;

    const movements = isWithdrawal
      ? [
          {
            accountId: counterAcc.id,
            referencia: String(bLine.referencia || 'MOV-BANCO'),
            concepto: String(bLine.descripcion || 'Gasto registrado desde banco'),
            cargo: fromCents(subtotalCents),
            abono: 0
          },
          ...(ivaCents > 0
            ? [
                {
                  accountId: ivaAcc.id,
                  referencia: String(bLine.referencia || 'IVA'),
                  concepto: 'IVA Acreditable Pagado 16% desglosado de banco',
                  cargo: fromCents(ivaCents),
                  abono: 0
                }
              ]
            : []),
          {
            accountId: bankAcc.id,
            referencia: String(bLine.referencia || 'BANCO'),
            concepto: String(bLine.descripcion || 'Salida de banco'),
            cargo: 0,
            abono: fromCents(amountCents)
          }
        ]
      : [
          {
            accountId: bankAcc.id,
            referencia: String(bLine.referencia || 'BANCO'),
            concepto: String(bLine.descripcion || 'Entrada a banco'),
            cargo: fromCents(amountCents),
            abono: 0
          },
          {
            accountId: counterAcc.id,
            referencia: String(bLine.referencia || 'INGRESO'),
            concepto: String(bLine.descripcion || 'Ingreso cobrado en banco'),
            cargo: 0,
            abono: fromCents(subtotalCents)
          },
          ...(ivaCents > 0
            ? [
                {
                  accountId: ivaAcc.id,
                  referencia: String(bLine.referencia || 'IVA'),
                  concepto: 'IVA Trasladado Cobrado 16% desglosado de banco',
                  cargo: 0,
                  abono: fromCents(ivaCents)
                }
              ]
            : [])
        ];

    const poliza = await supabasePolizasAndCfdi.createPoliza({
      companyId,
      tipo,
      fecha: String(bLine.fecha),
      concepto: String(bLine.descripcion || 'Póliza generada desde estado de cuenta bancario'),
      cfdiUuid: null,
      movements
    });

    const bankMov = poliza.movements.find((m) => m.accountId === bankAcc.id);
    if (bankMov) {
      await supabase
        .from('bank_statement_lines')
        .update({ matched_movement_id: bankMov.id })
        .eq('id', lineId);
    }

    const reconciliation = await this.getBankReconciliation(companyId, accountId, ejercicio, periodo);
    return { createdPolizaId: poliza.id, reconciliation };
  }
};

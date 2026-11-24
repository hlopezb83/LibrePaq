import { buildBankLinePolizaPlan } from '../../shared/accounting-engine';
import { parseCalendarDate } from '../../shared/date-utils';
import { findBankReconciliationMatches } from '../../shared/engine/bank-and-closing.engine';
import type { AccountWithBalance, BankReconciliationResponse } from '../../shared/types';
import type { ImportBankPdfLineInput } from '../api/bank-n1.api';
import { assertDemoPeriodOpen, getGuestDemoState } from './guest-demo-store';
import { guestDemoPolizasCfdi } from './guest-demo-polizas-cfdi';

export function buildGuestDemoBankOps(
  getBankReconciliation: (
    companyId: string,
    accountId?: string,
    year?: number,
    period?: number
  ) => Promise<BankReconciliationResponse>
) {
  return {
    async addBankStatementLines(payload: {
      companyId: string;
      accountId: string;
      lines: Array<{ fecha: string; referencia: string; descripcion: string; cargoBanco: number; abonoBanco: number }>;
    }): Promise<BankReconciliationResponse> {
      const s = getGuestDemoState();
      for (const l of payload.lines) {
        const { year, month } = parseCalendarDate(l.fecha);
        assertDemoPeriodOpen(payload.companyId, year, month);
        s.bankLines.push({
          id: `bank_${crypto.randomUUID().slice(0, 10)}`,
          companyId: payload.companyId,
          accountId: payload.accountId,
          fecha: l.fecha,
          ejercicio: year,
          periodo: month,
          referencia: l.referencia,
          descripcion: l.descripcion,
          cargoBanco: Number(l.cargoBanco || 0),
          abonoBanco: Number(l.abonoBanco || 0),
          matchedMovementId: null,
          matchedPolizaFolio: null
        });
      }
      const first = payload.lines[0] ? parseCalendarDate(payload.lines[0].fecha) : undefined;
      return getBankReconciliation(payload.companyId, payload.accountId, first?.year, first?.month);
    },

    async importBankPdfLines(
      companyId: string,
      accountId: string,
      lines: ReadonlyArray<ImportBankPdfLineInput>
    ): Promise<BankReconciliationResponse> {
      return this.addBankStatementLines({
        companyId,
        accountId,
        lines: lines.map((l) => ({
          fecha: l.fecha,
          referencia: l.referencia || 'MOV-BANCO',
          descripcion: l.descripcion || 'Movimiento PDF bancario',
          cargoBanco: Number(l.cargoBanco ?? l.cargo ?? 0),
          abonoBanco: Number(l.abonoBanco ?? l.abono ?? 0)
        }))
      });
    },

    async extractBankPdfStatement(): Promise<never> {
      throw new Error('DEMO_SANDBOX_UNSUPPORTED: La extracción PDF con IA requiere conexión a la nube.');
    },

    async autoMatchBankReconciliation(companyId: string, accountId: string, year?: number, period?: number) {
      const s = getGuestDemoState();
      const current = await getBankReconciliation(companyId, accountId, year, period);
      assertDemoPeriodOpen(companyId, current.ejercicio, current.periodo);
      const pairs = findBankReconciliationMatches(current.statementLines, current.bookMovements);
      for (const pair of pairs) {
        const line = s.bankLines.find((l) => l.id === pair.statementLineId);
        if (line) line.matchedMovementId = pair.movementId;
      }
      return {
        matchedCount: pairs.length,
        reconciliation: await getBankReconciliation(companyId, accountId, current.ejercicio, current.periodo)
      };
    },

    async manualMatchBankLine(lineId: string, movementId: string) {
      const s = getGuestDemoState();
      const line = s.bankLines.find((l) => l.id === lineId);
      if (!line) throw new Error('Movimiento bancario no encontrado');
      assertDemoPeriodOpen(line.companyId, line.ejercicio, line.periodo);
      line.matchedMovementId = movementId;
      return { matched: true, reconciliation: await getBankReconciliation(line.companyId, line.accountId, line.ejercicio, line.periodo) };
    },

    async unmatchBankLine(lineId: string) {
      const s = getGuestDemoState();
      const line = s.bankLines.find((l) => l.id === lineId);
      if (!line) throw new Error('Movimiento bancario no encontrado');
      assertDemoPeriodOpen(line.companyId, line.ejercicio, line.periodo);
      line.matchedMovementId = null;
      s.bankMatches = s.bankMatches.filter((m) => m.bankLineId !== lineId);
      return { unmatched: true, reconciliation: await getBankReconciliation(line.companyId, line.accountId, line.ejercicio, line.periodo) };
    },

    async deleteBankStatementLine(lineId: string) {
      const s = getGuestDemoState();
      const line = s.bankLines.find((l) => l.id === lineId);
      if (!line) throw new Error('Movimiento bancario no encontrado');
      assertDemoPeriodOpen(line.companyId, line.ejercicio, line.periodo);
      s.bankLines = s.bankLines.filter((l) => l.id !== lineId);
      s.bankMatches = s.bankMatches.filter((m) => m.bankLineId !== lineId);
      return { deleted: true, reconciliation: await getBankReconciliation(line.companyId, line.accountId, line.ejercicio, line.periodo) };
    },

    async createPolizaFromBankLine(lineId: string, options?: { counterAccountCode?: string; desglosarIva?: boolean }) {
      const s = getGuestDemoState();
      const line = s.bankLines.find((l) => l.id === lineId);
      if (!line) throw new Error('Movimiento bancario no encontrado');
      if (line.matchedMovementId) throw new Error('El movimiento ya se encuentra conciliado');
      assertDemoPeriodOpen(line.companyId, line.ejercicio, line.periodo);
      const accounts: AccountWithBalance[] = s.accounts
        .filter((a) => a.companyId === line.companyId)
        .map((a) => ({ ...a, initialBalanceComputed: a.initialBalance, periodCharges: 0, periodCredits: 0, finalBalance: a.initialBalance }));
      const plan = buildBankLinePolizaPlan({
        accounts,
        accountId: line.accountId,
        cargoBanco: line.cargoBanco,
        abonoBanco: line.abonoBanco,
        referencia: line.referencia,
        descripcion: line.descripcion,
        desglosarIva: options?.desglosarIva,
        counterAccountCode: options?.counterAccountCode
      });
      const poliza = await guestDemoPolizasCfdi.createPoliza({
        companyId: line.companyId,
        tipo: plan.tipo,
        fecha: line.fecha,
        ejercicio: line.ejercicio,
        periodo: line.periodo,
        concepto: line.descripcion || 'Póliza desde estado de cuenta bancario',
        movements: plan.movements
      });
      const bankMov = poliza.movements.find((m) => m.accountId === plan.bankAcc.id);
      if (bankMov) line.matchedMovementId = bankMov.id;
      return { createdPolizaId: poliza.id, reconciliation: await getBankReconciliation(line.companyId, line.accountId, line.ejercicio, line.periodo) };
    },

    async saveBankClosureBalance(companyId: string, accountId: string, ejercicio: number, periodo: number, saldoBancoCierre: number) {
      getGuestDemoState().bankClosures[`${companyId}:${accountId}:${ejercicio}:${periodo}`] = saldoBancoCierre;
    },

    async deleteBankClosureBalance(companyId: string, accountId: string, ejercicio: number, periodo: number) {
      delete getGuestDemoState().bankClosures[`${companyId}:${accountId}:${ejercicio}:${periodo}`];
    }
  };
}

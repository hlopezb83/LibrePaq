import { getRequiredSupabase, supabase } from '../supabase';
import { fromCents, toCents } from '../../shared/accounting-engine';
import type {
  AccountLedgerEntry,
  AccountLedgerResponse,
  Company,
  PolizaType
} from '../../shared/types';
import { mapSupabaseCompany, supabaseCompaniesAndAccounts } from './supabase-companies-accounts';
import { chunkArray, fetchAllRows } from './supabase-pagination';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';

export const supabaseAccountLedger = {
  async getAccountLedger(
    companyId: string,
    accountId: string,
    year?: number,
    period?: number
  ): Promise<AccountLedgerResponse | null> {
    if (!supabase) throw new Error('Supabase no disponible');

    let company: Company | undefined;
    if (companyId) {
      const { data: cData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .maybeSingle();
      if (cData) company = mapSupabaseCompany(cData);
    }
    if (!company) {
      const companies = await supabaseCompaniesAndAccounts.getCompanies();
      company = companyId ? companies.find((c) => c.id === companyId) : companies[0];
    }
    if (!company) throw new Error(companyId ? `Empresa no encontrada: ${companyId}` : 'No hay empresas registradas');

    const ejercicio = year || company.currentYear;
    const periodo = period || company.currentPeriod;

    // Obtener balanza calculada para saldos iniciales y finales de la cuenta
    const reports = await supabaseReportsAndDashboard.getReports(company.id, ejercicio, periodo);
    const targetAcc = reports.trialBalance.find(
      (a) => a.id === accountId || a.code === accountId || a.id.endsWith(`_${accountId}`)
    );
    if (!targetAcc) return null;

    // Recolectar códigos y IDs de subcuentas afectables
    const descendantCodes = new Set<string>();
    const descendantIds = new Set<string>();

    if (targetAcc.isAffectable) {
      descendantCodes.add(targetAcc.code);
      descendantIds.add(targetAcc.id);
    } else {
      let prefix = targetAcc.code;
      if (targetAcc.code.endsWith('-00-000')) {
        prefix = targetAcc.level === 1 ? targetAcc.code.slice(0, 1) : `${targetAcc.code.slice(0, 3)}-`;
      } else if (targetAcc.code.endsWith('-000')) {
        prefix = `${targetAcc.code.slice(0, 6)}-`;
      }
      for (const acc of reports.trialBalance) {
        if (acc.isAffectable && acc.code.startsWith(prefix)) {
          descendantCodes.add(acc.code);
          descendantIds.add(acc.id);
        }
      }
    }

    const codesArray = Array.from(descendantCodes);
    if (codesArray.length === 0) {
      return {
        account: targetAcc,
        ejercicio,
        periodo,
        initialBalance: targetAcc.initialBalanceComputed,
        totalCharges: 0,
        totalCredits: 0,
        finalBalance: targetAcc.finalBalance,
        entries: []
      };
    }

    // Consultar movimientos en Supabase paginados y por lotes para evitar el límite de 1,000 filas
    const movementsData: Array<Record<string, unknown>> = [];
    for (const codeChunk of chunkArray(codesArray, 100)) {
      const chunkRows = await fetchAllRows(async (from, to) =>
        getRequiredSupabase()
          .from('poliza_movements')
          .select(`
            id,
            poliza_id,
            account_id,
            account_code,
            account_name,
            referencia,
            concepto,
            cfdi_uuid,
            cargo,
            abono,
            polizas!inner(id, company_id, ejercicio, periodo, tipo, folio, fecha)
          `)
          .eq('polizas.company_id', company.id)
          .eq('polizas.ejercicio', ejercicio)
          .eq('polizas.periodo', periodo)
          .in('account_code', codeChunk)
          .order('id', { ascending: true })
          .range(from, to)
      );
      movementsData.push(...chunkRows);
    }

    interface SupabasePolizaMovementRow {
      id: string;
      poliza_id: string;
      account_id: string;
      account_code: string;
      account_name: string;
      referencia: string | null;
      concepto: string | null;
      cfdi_uuid: string | null;
      cargo: number | string;
      abono: number | string;
      polizas: {
        id: string;
        company_id: string;
        ejercicio: number;
        periodo: number;
        tipo: string;
        folio: number;
        fecha: string;
      } | null;
    }

    const rows = (movementsData || []) as unknown as SupabasePolizaMovementRow[];

    // Ordenar cronológicamente por fecha, folio y movement ID
    rows.sort((a, b) => {
      const fechaA = a.polizas?.fecha || '';
      const fechaB = b.polizas?.fecha || '';
      if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);
      const folioA = a.polizas?.folio || 0;
      const folioB = b.polizas?.folio || 0;
      if (folioA !== folioB) return folioA - folioB;
      return a.id.localeCompare(b.id);
    });

    let runningCents = toCents(targetAcc.initialBalanceComputed);
    const entries: AccountLedgerEntry[] = rows.map((r) => {
      const cargoCents = toCents(Number(r.cargo || 0));
      const abonoCents = toCents(Number(r.abono || 0));

      if (targetAcc.nature === 'DEUDORA') {
        runningCents += cargoCents - abonoCents;
      } else {
        runningCents += abonoCents - cargoCents;
      }

      return {
        movementId: r.id,
        polizaId: r.poliza_id,
        fecha: r.polizas?.fecha ? r.polizas.fecha.slice(0, 10) : `${ejercicio}-${String(periodo).padStart(2, '0')}-01`,
        periodo: Number(r.polizas?.periodo || periodo),
        tipoPoliza: (r.polizas?.tipo as PolizaType) || 'DIARIO',
        folioPoliza: Number(r.polizas?.folio || 0),
        accountCode: r.account_code,
        accountName: r.account_name,
        referencia: r.referencia || '',
        concepto: r.concepto || '',
        cfdiUuid: r.cfdi_uuid || null,
        cargo: fromCents(cargoCents),
        abono: fromCents(abonoCents),
        runningBalance: fromCents(runningCents)
      };
    });

    return {
      account: targetAcc,
      ejercicio,
      periodo,
      initialBalance: targetAcc.initialBalanceComputed,
      totalCharges: targetAcc.periodCharges,
      totalCredits: targetAcc.periodCredits,
      finalBalance: targetAcc.finalBalance,
      entries
    };
  }
};

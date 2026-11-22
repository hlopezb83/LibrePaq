import { supabase } from '../supabase';
import {
  assertAccountingInvariant,
  fromCents,
  resolveFiscalAccount,
  toCents,
  validateDoubleEntryMovements
} from '../../shared/accounting-engine';
import { querySatCfdiStatusSoap } from '../../shared/sat-cfdi-status';
import type { SatCfdiStatusCheckResult } from '../../shared/types';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';
import { supabasePolizas } from './supabase-polizas';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';

export const supabaseClosingAndVerification = {
  async closeYearPoliza(
    companyId: string
  ): Promise<{ closed: boolean; polizaId: string; utilidadTraspasada: number }> {
    if (!supabase) throw new Error('Supabase no disponible');

    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);

    const ejercicio = company.currentYear || 2026;

    // Eliminar pólizas previas de periodo 13 ANTES de calcular saldos para permitir re-ejecución del cierre anual
    const { data: oldPols } = await supabase
      .from('polizas')
      .select('id')
      .eq('company_id', companyId)
      .eq('ejercicio', ejercicio)
      .eq('periodo', 13);

    if (oldPols && oldPols.length > 0) {
      for (const p of oldPols) {
        await supabasePolizas.deletePoliza(p.id);
      }
    }

    const reports = await supabaseReportsAndDashboard.getReports(companyId, ejercicio, 13);
    const tb13 = reports.trialBalance;

    const resultAccounts = tb13.filter(
      (a) =>
        a.isAffectable &&
        (a.type === 'INGRESOS' || a.type === 'COSTOS' || a.type === 'GASTOS') &&
        Math.abs(toCents(a.finalBalance)) >= 1
    );

    assertAccountingInvariant(
      resultAccounts.length > 0,
      'ALREADY_CLOSED_YEAR',
      'Las cuentas de resultados (Ingresos, Costos y Gastos) ya están saldadas en $0.00.'
    );

    const capitalResultAcc = resolveFiscalAccount(tb13, 'RESULTADO_DEL_EJERCICIO');

    const movements: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      referencia: string;
      concepto: string;
      cargo: number;
      abono: number;
    }> = [];

    let sumCargosCents = 0;
    let sumAbonosCents = 0;

    for (const acc of resultAccounts) {
      const balCents = toCents(acc.finalBalance);
      if (acc.nature === 'ACREEDORA') {
        const cargoCents = balCents > 0 ? balCents : 0;
        const abonoCents = balCents < 0 ? Math.abs(balCents) : 0;
        movements.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          referencia: 'CIERRE-13',
          concepto: `Cancelación anual de cuenta de ingresos ${acc.code}`,
          cargo: fromCents(cargoCents),
          abono: fromCents(abonoCents)
        });
        sumCargosCents += cargoCents;
        sumAbonosCents += abonoCents;
      } else {
        const abonoCents = balCents > 0 ? balCents : 0;
        const cargoCents = balCents < 0 ? Math.abs(balCents) : 0;
        movements.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          referencia: 'CIERRE-13',
          concepto: `Cancelación anual de cuenta de egresos ${acc.code}`,
          cargo: fromCents(cargoCents),
          abono: fromCents(abonoCents)
        });
        sumCargosCents += cargoCents;
        sumAbonosCents += abonoCents;
      }
    }

    const netDiffCents = sumCargosCents - sumAbonosCents;
    if (netDiffCents !== 0) {
      movements.push({
        accountId: capitalResultAcc.id,
        accountCode: capitalResultAcc.code,
        accountName: capitalResultAcc.name,
        referencia: 'CIERRE-13',
        concepto: `Traspaso a Resultado del Ejercicio ${ejercicio}`,
        cargo: netDiffCents < 0 ? fromCents(Math.abs(netDiffCents)) : 0,
        abono: netDiffCents > 0 ? fromCents(netDiffCents) : 0
      });
    }

    validateDoubleEntryMovements(movements);

    // Crear la póliza oficial de cierre en mes 13
    const createdPol = await supabasePolizas.createPoliza({
      companyId,
      tipo: 'DIARIO',
      fecha: `${ejercicio}-12-31`,
      concepto: `Póliza de Cierre Anual del Ejercicio ${ejercicio} (Cancelación de Cuentas de Resultados)`,
      cfdiUuid: null,
      origin: 'MANUAL',
      ejercicio,
      periodo: 13,
      movements
    });

    // Actualizar periodo activo de la empresa a 13
    await supabase.from('companies').update({ current_period: 13 }).eq('id', companyId);

    return {
      closed: true,
      polizaId: createdPol.id,
      utilidadTraspasada: fromCents(netDiffCents)
    };
  },

  async verifyCfdiSatStatus(cfdiId: string): Promise<SatCfdiStatusCheckResult> {
    if (!supabase) throw new Error('Supabase no disponible');

    const { data: cfdi, error } = await supabase
      .from('cfdi_documents')
      .select('*')
      .eq('id', cfdiId)
      .single();

    if (error || !cfdi) throw new Error('CFDI no encontrado.');

    const result = await querySatCfdiStatusSoap({
      rfcEmisor: String(cfdi.emisor_rfc || ''),
      rfcReceptor: String(cfdi.receptor_rfc || ''),
      total: Number(cfdi.total || 0),
      uuid: String(cfdi.uuid || ''),
      currentStatus: cfdi.status_sat as 'VIGENTE' | 'CANCELADO'
    });

    await supabase
      .from('cfdi_documents')
      .update({ status_sat: result.estadoSat })
      .eq('id', cfdiId);

    return result;
  }
};

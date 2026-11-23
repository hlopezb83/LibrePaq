import { supabase } from '../supabase';
import { buildYearCloseMovements } from '../../shared/accounting-engine';
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
    const { movements, utilidadTraspasada } = buildYearCloseMovements(
      reports.trialBalance,
      ejercicio,
      'finalBalance'
    );

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
      utilidadTraspasada
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

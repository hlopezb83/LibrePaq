import { supabase } from '../supabase';
import { buildYearCloseMovements } from '../../shared/accounting-engine';
import type { SatCfdiStatusCheckResult } from '../../shared/types';
import { logCompanyAuditEvent } from './audit-logger';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';
import { supabasePolizas, assertSupabasePeriodOpen } from './supabase-polizas';
import { supabaseCompaniesAndAccounts } from './supabase-companies-accounts';

interface SatVerifySingleEdgeItem {
  cfdiId: string;
  uuid: string;
  ok: boolean;
  statusSat: string | null;
  codigoEstatus: string | null;
  esCancelable: string | null;
  estatusCancelacion: string | null;
  validacionEfos: string | null;
  polizaId?: string | null;
  cancelledWithPoliza?: boolean;
  error?: string;
}

interface SatVerifySingleEdgeResponse {
  ok: boolean;
  error?: string;
  results?: SatVerifySingleEdgeItem[];
}

export const supabaseClosingAndVerification = {
  async closeYearPoliza(
    companyId: string,
    switchToPeriod13 = true
  ): Promise<{ closed: boolean; polizaId: string; utilidadTraspasada: number }> {
    if (!supabase) throw new Error('Supabase no disponible');

    const companies = await supabaseCompaniesAndAccounts.getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);

    const ejercicio = company.currentYear || 2026;
    await assertSupabasePeriodOpen(companyId, ejercicio, 13);

    // Calcular balanza pre-cierre (ignorando pólizas CIERRE_ANUAL previas) y validar cuentas/movimientos ANTES de borrar
    const reports = await supabaseReportsAndDashboard.getReports(companyId, ejercicio, 13, {
      ignoreCierreAnual: true
    });
    const { movements, utilidadTraspasada } = buildYearCloseMovements(
      reports.trialBalance,
      ejercicio,
      'finalBalance'
    );

    const { data: oldPols, error: oldPolsErr } = await supabase
      .from('polizas')
      .select('id')
      .eq('company_id', companyId)
      .eq('ejercicio', ejercicio)
      .eq('periodo', 13)
      .eq('origin', 'CIERRE_ANUAL');
    if (oldPolsErr) throw new Error(oldPolsErr.message);

    // Crear nueva póliza primero; si falla, el cierre previo permanece intacto
    const createdPol = await supabasePolizas.createPoliza({
      companyId,
      tipo: 'DIARIO',
      fecha: `${ejercicio}-12-31`,
      concepto: `Póliza de Cierre Anual del Ejercicio ${ejercicio} (Cancelación de Cuentas de Resultados)`,
      cfdiUuid: null,
      origin: 'CIERRE_ANUAL',
      ejercicio,
      periodo: 13,
      movements
    });

    if (oldPols && oldPols.length > 0) {
      try {
        for (const p of oldPols) {
          await supabasePolizas.deletePoliza(p.id);
        }
      } catch (delErr) {
        await supabasePolizas.deletePoliza(createdPol.id).catch(() => {});
        throw delErr;
      }
    }

    if (switchToPeriod13) {
      const { error: updErr } = await supabase
        .from('companies')
        .update({ current_period: 13 })
        .eq('id', companyId);
      if (updErr) throw new Error(updErr.message);
    }

    logCompanyAuditEvent({
      companyId,
      action: 'YEAR_CLOSE',
      entityType: 'poliza',
      entityId: createdPol.id,
      metadata: { ejercicio, utilidadTraspasada }
    });

    return {
      closed: true,
      polizaId: createdPol.id,
      utilidadTraspasada
    };
  },

  /** Verifica el estatus individual de un CFDI ante el SAT via Edge Function `sat-status-verify` (sin CORS). */
  async verifyCfdiSatStatus(
    cfdiId: string
  ): Promise<SatCfdiStatusCheckResult & { cancelledWithPoliza: boolean }> {
    if (!supabase) throw new Error('Supabase no disponible');

    const { data: cfdi, error } = await supabase
      .from('cfdi_documents')
      .select('id, company_id, uuid, emisor_rfc, receptor_rfc, total, status_sat, tipo_comprobante, poliza_id')
      .eq('id', cfdiId)
      .single();

    if (error || !cfdi) throw new Error('CFDI no encontrado.');

    const isPago = String(cfdi.tipo_comprobante || '').toUpperCase() === 'P';

    const { data: edgeData, error: edgeError } =
      await supabase.functions.invoke<SatVerifySingleEdgeResponse>('sat-status-verify', {
        body: {
          action: 'VERIFY_BATCH',
          companyId: String(cfdi.company_id),
          items: [
            {
              cfdiId: String(cfdi.id),
              uuid: String(cfdi.uuid || ''),
              emisorRfc: String(cfdi.emisor_rfc || ''),
              receptorRfc: String(cfdi.receptor_rfc || ''),
              total: isPago ? 0 : Number(cfdi.total || 0)
            }
          ]
        }
      });

    if (edgeError) {
      let msg = edgeError.message;
      try {
        const ctxJson = await (edgeError as { context?: Response }).context?.json();
        if (ctxJson?.error) msg = String(ctxJson.error);
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    if (!edgeData?.ok) {
      throw new Error(edgeData?.error || 'Error verificando estatus del CFDI ante el SAT.');
    }

    const item = edgeData.results?.[0];
    if (!item) {
      throw new Error('La Edge Function sat-status-verify no devolvió resultados para el CFDI.');
    }

    const hadPoliza = Boolean(item.polizaId ?? cfdi.poliza_id);

    if (!item.ok) {
      const offlineEstado: 'VIGENTE' | 'CANCELADO' =
        String(item.statusSat || cfdi.status_sat || 'VIGENTE').toUpperCase() === 'CANCELADO'
          ? 'CANCELADO'
          : 'VIGENTE';
      return {
        uuid: item.uuid || String(cfdi.uuid || ''),
        codigoEstatus: item.codigoEstatus || item.error || 'N - No verificable ante el SAT.',
        estadoSat: offlineEstado,
        esCancelable: item.esCancelable || 'No verificable sin conexión',
        estatusCancelacion: item.estatusCancelacion || 'Sin respuesta del SAT',
        validacionEfos: 'NO_VERIFICADO_TIMEOUT_SAT',
        soapEnvelopeXml: '',
        modoConsulta: 'OFFLINE_UNVERIFIED',
        cancelledWithPoliza:
          Boolean(item.cancelledWithPoliza) || (offlineEstado === 'CANCELADO' && hadPoliza)
      };
    }

    const estadoSat: 'VIGENTE' | 'CANCELADO' =
      String(item.statusSat || '').toUpperCase() === 'CANCELADO' ? 'CANCELADO' : 'VIGENTE';
    const validacionEfos: SatCfdiStatusCheckResult['validacionEfos'] =
      String(item.validacionEfos || '').includes('100')
        ? '100_PRESUNTO_O_DEFINITIVO_69B'
        : '200_LIMPIO';

    return {
      uuid: item.uuid || String(cfdi.uuid || ''),
      codigoEstatus: item.codigoEstatus || 'S - Comprobante obtenido satisfactoriamente.',
      estadoSat,
      esCancelable: item.esCancelable || 'Cancelable con aceptación',
      estatusCancelacion: item.estatusCancelacion || 'Ninguno',
      validacionEfos,
      soapEnvelopeXml: '',
      modoConsulta: 'SAT_LIVE',
      cancelledWithPoliza:
        Boolean(item.cancelledWithPoliza) || (estadoSat === 'CANCELADO' && hadPoliza)
    };
  }
};

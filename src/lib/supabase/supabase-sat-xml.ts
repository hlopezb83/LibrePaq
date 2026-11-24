import {
  buildSatAnexo24Xml,
  type Anexo24CfdiMetadata,
  type SatAnexo24Options,
  type SatXmlType
} from '../../shared/sat-anexo24';
import { supabaseCfdi } from './supabase-cfdi';
import { supabasePolizas } from './supabase-polizas';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';

export async function getSatXml(
  companyId: string,
  type: SatXmlType | string,
  year?: number,
  period?: number,
  options?: Omit<SatAnexo24Options, 'cfdiLookup'>
): Promise<{ filename: string; type: string; xml: string }> {
  const reportData = await supabaseReportsAndDashboard.getReports(companyId, year, period);
  const needsPolizas =
    type === 'polizas' || type === 'auxiliar_folios' || type === 'auxiliar_cuentas';
  const needsCfdiLookup = type === 'polizas' || type === 'auxiliar_folios';

  const polizas = needsPolizas
    ? await supabasePolizas.getPolizas(companyId, reportData.ejercicio, reportData.periodo)
    : [];

  let cfdiLookup: Map<string, Anexo24CfdiMetadata> | undefined;
  if (needsCfdiLookup) {
    const cfdis = await supabaseCfdi.getCfdis(companyId, { includeXml: false });
    cfdiLookup = new Map<string, Anexo24CfdiMetadata>();
    for (const c of cfdis) {
      if (c.uuid) {
        const counterpartRfc = c.direction === 'EMITIDO' ? c.receptorRfc : c.emisorRfc;
        cfdiLookup.set(c.uuid.toUpperCase(), {
          total: c.total,
          rfcContraparte: counterpartRfc,
          moneda: c.moneda,
          tipoCambio: c.tipoCambio,
          formaPago: c.formaPago
        });
      }
    }
  }

  return buildSatAnexo24Xml(
    reportData.company,
    reportData.ejercicio,
    reportData.periodo,
    type,
    reportData.trialBalance,
    polizas,
    { ...options, cfdiLookup }
  );
}

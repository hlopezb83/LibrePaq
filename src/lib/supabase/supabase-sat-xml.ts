import { buildSatAnexo24Xml, type SatXmlType, type Anexo24CfdiMetadata } from '../../shared/sat-anexo24';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';
import { supabaseCfdi } from './supabase-cfdi';
import { supabasePolizas } from './supabase-polizas';

export async function getSatXml(
  companyId: string,
  type: SatXmlType | string,
  year?: number,
  period?: number
): Promise<{ filename: string; type: string; xml: string }> {
  const reportData = await supabaseReportsAndDashboard.getReports(companyId, year, period);
  const polizas =
    type === 'polizas'
      ? await supabasePolizas.getPolizas(companyId, year, period)
      : [];

  let cfdiLookup: Map<string, Anexo24CfdiMetadata> | undefined;
  if (type === 'polizas') {
    const cfdis = await supabaseCfdi.getCfdis(companyId);
    cfdiLookup = new Map<string, Anexo24CfdiMetadata>();
    for (const c of cfdis) {
      if (c.uuid) {
        const counterpartRfc = c.direction === 'EMITIDO' ? c.receptorRfc : c.emisorRfc;
        cfdiLookup.set(c.uuid.toUpperCase(), {
          total: c.total,
          rfcContraparte: counterpartRfc,
          moneda: c.moneda,
          tipoCambio: c.tipoCambio
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
    { cfdiLookup }
  );
}

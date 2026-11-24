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
    ? reportData.periodo === 13
      ? Array.from(
          new Map(
            [
              ...(await supabasePolizas.getPolizas(companyId, reportData.ejercicio, 12)),
              ...(await supabasePolizas.getPolizas(companyId, reportData.ejercicio, 13))
            ].map((p) => [p.id, p])
          ).values()
        )
      : await supabasePolizas.getPolizas(companyId, reportData.ejercicio, reportData.periodo)
    : [];

  let trialBalance = reportData.trialBalance;
  if ((type === 'auxiliar_cuentas' || type === 'xc') && reportData.periodo === 13) {
    const decReport = await supabaseReportsAndDashboard.getReports(
      companyId,
      reportData.ejercicio,
      12
    );
    const decMap = new Map(decReport.trialBalance.map((acc) => [acc.id, acc]));
    trialBalance = reportData.trialBalance.map((acc) => {
      const decAcc = decMap.get(acc.id);
      return decAcc ? { ...acc, initialBalanceComputed: decAcc.initialBalanceComputed } : acc;
    });
  }

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
    trialBalance,
    polizas,
    { ...options, cfdiLookup }
  );
}

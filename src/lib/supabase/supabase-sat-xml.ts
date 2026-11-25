import {
  buildSatAnexo24Xml,
  type Anexo24CfdiMetadata,
  type SatAnexo24Options,
  type SatXmlType
} from '../../shared/sat-anexo24';
import type { Poliza } from '../../shared/types';
import { getRequiredSupabase } from '../supabase';
import { supabaseCfdi } from './supabase-cfdi';
import { chunkArray } from './supabase-pagination';
import { supabasePolizas } from './supabase-polizas';
import { supabaseReportsAndDashboard } from './supabase-reports-dashboard';

async function enrichPolizaBankFields(polizas: Poliza[]): Promise<Poliza[]> {
  if (polizas.length === 0) return polizas;
  const sb = getRequiredSupabase();
  const polizaIds = polizas.map((p) => p.id);
  const movExtraById = new Map<string, Record<string, unknown>>();
  for (const chunk of chunkArray(polizaIds, 100)) {
    const { data } = await sb
      .from('poliza_movements')
      .select(
        'id, payment_method_sat, bank_code_ori, account_ori, bank_code_dest, account_dest, beneficiary_name, beneficiary_rfc, cheque_num'
      )
      .in('poliza_id', chunk);
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      if (row.id) movExtraById.set(String(row.id), row);
    }
  }
  if (movExtraById.size === 0) return polizas;
  const optStr = (v: unknown) => (v ? String(v) : null);
  return polizas.map((p) => ({
    ...p,
    movements: p.movements.map((m) => {
      const ex = movExtraById.get(m.id);
      if (!ex) return m;
      return {
        ...m,
        paymentMethodSat: optStr(ex.payment_method_sat) ?? m.paymentMethodSat,
        bankCodeOri: optStr(ex.bank_code_ori) ?? m.bankCodeOri,
        accountOri: optStr(ex.account_ori) ?? m.accountOri,
        bankCodeDest: optStr(ex.bank_code_dest) ?? m.bankCodeDest,
        accountDest: optStr(ex.account_dest) ?? m.accountDest,
        beneficiaryName: optStr(ex.beneficiary_name) ?? m.beneficiaryName,
        beneficiaryRfc: optStr(ex.beneficiary_rfc) ?? m.beneficiaryRfc,
        chequeNum: optStr(ex.cheque_num) ?? m.chequeNum
      };
    })
  }));
}

export async function getSatXml(
  companyId: string,
  type: SatXmlType | string,
  year?: number,
  period?: number,
  options?: Omit<SatAnexo24Options, 'cfdiLookup'>
): Promise<{ filename: string; type: string; xml: string; warnings?: string[] }> {
  const reportData = await supabaseReportsAndDashboard.getReports(companyId, year, period);
  const needsPolizas =
    type === 'polizas' || type === 'auxiliar_folios' || type === 'auxiliar_cuentas';
  const needsCfdiLookup = type === 'polizas' || type === 'auxiliar_folios';

  let polizas = needsPolizas
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

  if (type === 'polizas' && polizas.length > 0) {
    polizas = await enrichPolizaBankFields(polizas);
  }

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

import { Hono } from 'hono';
import {
  computeTrialBalance,
  db,
  getCfdiDocuments,
  getDiotReport,
  getPolizas
} from '../db';
import { buildFinancialStatementsFromTrialBalance } from '../../shared/engine/financial-reports.engine';
import {
  isValidSatNumOrden,
  isValidSatNumTramite,
  type Anexo24CfdiMetadata,
  type SatAnexo24Options
} from '../../shared/sat-anexo24';
import type { Poliza } from '../../shared/types';
import { buildSatAnexo24Xml, resolveYearAndPeriod } from '../validators';
import { getAuthorizedCompanyForRoute } from './route-helpers';

export const reportsRoutes = new Hono();

function enrichSqlitePolizaBankFields(polizas: Poliza[]): Poliza[] {
  if (polizas.length === 0) return polizas;
  const polizaIds = polizas.map((p) => p.id);
  const placeholders = polizaIds.map(() => '?').join(',');
  type BankMovRow = {
    id: string;
    payment_method_sat?: string | null;
    bank_code_ori?: string | null;
    account_ori?: string | null;
    bank_code_dest?: string | null;
    account_dest?: string | null;
    beneficiary_name?: string | null;
    beneficiary_rfc?: string | null;
    cheque_num?: string | null;
  };
  let rows: BankMovRow[] = [];
  try {
    rows = db
      .query(
        `SELECT id, payment_method_sat, bank_code_ori, account_ori, bank_code_dest, account_dest, beneficiary_name, beneficiary_rfc, cheque_num
         FROM poliza_movements WHERE poliza_id IN (${placeholders})`
      )
      .all(...polizaIds) as BankMovRow[];
  } catch {
    return polizas;
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  return polizas.map((p) => ({
    ...p,
    movements: p.movements.map((m) => {
      const ex = byId.get(m.id);
      if (!ex) return m;
      return {
        ...m,
        paymentMethodSat: ex.payment_method_sat ?? m.paymentMethodSat,
        bankCodeOri: ex.bank_code_ori ?? m.bankCodeOri,
        accountOri: ex.account_ori ?? m.accountOri,
        bankCodeDest: ex.bank_code_dest ?? m.bankCodeDest,
        accountDest: ex.account_dest ?? m.accountDest,
        beneficiaryName: ex.beneficiary_name ?? m.beneficiaryName,
        beneficiaryRfc: ex.beneficiary_rfc ?? m.beneficiaryRfc,
        chequeNum: ex.cheque_num ?? m.chequeNum
      };
    })
  }));
}

reportsRoutes.get('/reports', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );

  const trialBalance = computeTrialBalance(company.id, year, period);
  return c.json(buildFinancialStatementsFromTrialBalance(company, trialBalance, year, period));
});

reportsRoutes.get('/sat-xml', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const type = c.req.query('type') || 'balanza';
  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada o no autorizada' }, 404);

  const rawTipoEnvio = c.req.query('tipoEnvio')?.toUpperCase();
  const tipoEnvio = rawTipoEnvio === 'C' ? 'C' : rawTipoEnvio === 'N' ? 'N' : undefined;
  const fechaModBal = c.req.query('fechaModBal') || undefined;
  const rawBalLvl = c.req.query('balanzaLevel')?.toUpperCase();
  const balanzaLevel = rawBalLvl === 'N2' ? 'N2' : rawBalLvl === 'ALL' ? 'ALL' : undefined;
  const rawOmitZero = c.req.query('omitZeroAccounts')?.toLowerCase();
  const omitZeroAccounts = rawOmitZero === '1' || rawOmitZero === 'true';
  const rawSol = c.req.query('tipoSolicitud')?.toUpperCase();
  const tipoSolicitud =
    rawSol === 'AF' || rawSol === 'FC' || rawSol === 'DE' || rawSol === 'CO' ? rawSol : undefined;
  const numOrden = c.req.query('numOrden')?.trim().toUpperCase() || undefined;
  const numTramite = c.req.query('numTramite')?.trim().toUpperCase() || undefined;

  if (numOrden && !isValidSatNumOrden(numOrden)) {
    return c.json({ error: 'Formato inválido de NumOrden SAT (ej. ABC1234567/01).' }, 400);
  }
  if (numTramite && !isValidSatNumTramite(numTramite)) {
    return c.json({ error: 'Formato inválido de NumTramite SAT (10-14 alfanuméricos).' }, 400);
  }

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  const rawTrialBalance = computeTrialBalance(company.id, year, period);
  const needsPolizas =
    type === 'polizas' || type === 'auxiliar_folios' || type === 'auxiliar_cuentas';
  const needsCfdiLookup = type === 'polizas' || type === 'auxiliar_folios';

  let polizas = needsPolizas
    ? period === 13
      ? Array.from(
          new Map(
            [...getPolizas(company.id, year, 12), ...getPolizas(company.id, year, 13)].map((p) => [
              p.id,
              p
            ])
          ).values()
        )
      : getPolizas(company.id, year, period)
    : [];

  if (type === 'polizas' && polizas.length > 0) {
    polizas = enrichSqlitePolizaBankFields(polizas);
  }

  let trialBalance = rawTrialBalance;
  if ((type === 'auxiliar_cuentas' || type === 'xc') && period === 13) {
    const decMap = new Map(
      computeTrialBalance(company.id, year, 12).map((acc) => [acc.id, acc])
    );
    trialBalance = rawTrialBalance.map((acc) => {
      const decAcc = decMap.get(acc.id);
      return decAcc
        ? { ...acc, initialBalanceComputed: decAcc.initialBalanceComputed }
        : acc;
    });
  }

  let cfdiLookup: Map<string, Anexo24CfdiMetadata> | undefined;
  if (needsCfdiLookup) {
    const cfdis = getCfdiDocuments(company.id);
    cfdiLookup = new Map<string, Anexo24CfdiMetadata>();
    for (const cf of cfdis) {
      if (cf.uuid) {
        cfdiLookup.set(cf.uuid.toUpperCase(), {
          total: cf.total,
          rfcContraparte: cf.direction === 'EMITIDO' ? cf.receptorRfc : cf.emisorRfc,
          moneda: cf.moneda,
          tipoCambio: cf.tipoCambio,
          formaPago: cf.formaPago
        });
      }
    }
  }

  const strictParam = c.req.query('strict')?.toLowerCase();
  const options: SatAnexo24Options = {
    tipoEnvio,
    fechaModBal,
    balanzaLevel,
    omitZeroAccounts,
    tipoSolicitud,
    numOrden,
    numTramite,
    strictSolicitud: strictParam === '1' || strictParam === 'true',
    cfdiLookup
  };
  try {
    return c.json(buildSatAnexo24Xml(company, year, period, type, trialBalance, polizas, options));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Solicitud Anexo 24 inválida.';
    return c.json({ error: message }, 400);
  }
});

reportsRoutes.get('/diot', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  const company = getAuthorizedCompanyForRoute(c, companyId);
  if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

  const { year, period } = resolveYearAndPeriod(
    c.req.query('year'),
    c.req.query('period'),
    company
  );
  return c.json(getDiotReport(company.id, year, period));
});

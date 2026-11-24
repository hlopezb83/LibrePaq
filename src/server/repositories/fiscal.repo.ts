import { db } from '../connection';
import {
  assertAccountingInvariant,
  computeCxcCxpAging,
  computeFiscalWorkpaperFromTrialBalance,
  fromCents,
  toCents
} from '../../shared/accounting-engine';
import { computeDiotReportData } from '../../shared/engine/diot.engine';
import { querySatCfdiStatusSoap } from '../sat-soap';
import type {
  CxcCxpAgingResponse,
  DiotReportResponse,
  FiscalWorkpaperResponse,
  SatBatchVerifyResult,
  TaxParametersRecord
} from '../../shared/types';
import { getCompanyById } from './companies.repo';
import { getCfdiById, getCfdiDocuments } from './cfdi.repo';
import { listAccountingRulesRepo } from './accounting-rules.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { getPolizas } from './polizas.repo';
import { getThirdPartiesByCompany } from './third-parties.repo';
import { computeTrialBalance } from './trial-balance.repo';

export {
  getFixedAssetsResponse,
  createFixedAssetRecord,
  deleteFixedAssetRecord,
  generateMonthlyDepreciationPoliza
} from './fixed-assets.repo';

export function getDiotReport(
  companyId: string,
  ejercicio: number,
  periodo: number
): DiotReportResponse {
  const company = getCompanyById(companyId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const cfdis = getCfdiDocuments(company.id);
  const trialBalance = computeTrialBalance(company.id, ejercicio, periodo);
  const thirdParties = getThirdPartiesByCompany(company.id);

  const polizasPeriodo = (
    db
      .query('SELECT id FROM polizas WHERE company_id = ? AND ejercicio = ? AND periodo = ?')
      .all(company.id, ejercicio, periodo) as Array<{ id: string }>
  );

  return computeDiotReportData({
    company,
    ejercicio,
    periodo,
    cfdis,
    polizaIdsInPeriod: new Set(polizasPeriodo.map((p) => p.id)),
    trialBalance,
    thirdParties
  });
}

export function getTaxParameters(
  companyId: string,
  ejercicio: number,
  periodo = 0
): TaxParametersRecord {
  type TaxParamRow = {
    company_id: string;
    ejercicio: number;
    periodo?: number;
    coeficiente_utilidad: number;
    perdidas_fiscales_pendientes: number;
    pagos_provisionales_anteriores: number;
    saldo_favor_iva_anterior: number;
    tipo_cambio_dof_cierre: number;
    ptu_pagada_ejercicio?: number;
  };

  const rowExact = db
    .query('SELECT * FROM tax_parameters WHERE company_id = ? AND ejercicio = ? AND periodo = ?')
    .get(companyId, ejercicio, periodo) as TaxParamRow | null;

  const rowPrior =
    !rowExact && periodo > 0
      ? (db
          .query(
            'SELECT * FROM tax_parameters WHERE company_id = ? AND ejercicio = ? AND periodo > 0 AND periodo < ? ORDER BY periodo DESC LIMIT 1'
          )
          .get(companyId, ejercicio, periodo) as TaxParamRow | null)
      : null;

  const row =
    rowExact ??
    rowPrior ??
    (periodo !== 0
      ? (db
          .query('SELECT * FROM tax_parameters WHERE company_id = ? AND ejercicio = ? AND periodo = 0')
          .get(companyId, ejercicio) as TaxParamRow | null)
      : null);

  return {
    companyId,
    ejercicio,
    periodo,
    coeficienteUtilidad: Number(row?.coeficiente_utilidad ?? 0),
    perdidasFiscalesPendientes: Number(row?.perdidas_fiscales_pendientes ?? 0),
    pagosProvisionalesAnteriores: Number(row?.pagos_provisionales_anteriores ?? 0),
    saldoFavorIvaAnterior: Number(row?.saldo_favor_iva_anterior ?? 0),
    tipoCambioDofCierre: Number(row?.tipo_cambio_dof_cierre ?? 0),
    ptuPagadaEjercicio: Number(row?.ptu_pagada_ejercicio ?? 0)
  };
}

export function saveTaxParameters(
  companyId: string,
  ejercicio: number,
  input: Partial<Omit<TaxParametersRecord, 'companyId' | 'ejercicio'>>
): TaxParametersRecord {
  const periodo = input.periodo ?? 0;
  if (periodo > 0) {
    assertPeriodOpen(companyId, ejercicio, periodo);
  } else {
    for (let p = 1; p <= 12; p += 1) {
      assertPeriodOpen(companyId, ejercicio, p);
    }
  }
  const current = getTaxParameters(companyId, ejercicio, periodo);
  const next: TaxParametersRecord = {
    companyId,
    ejercicio,
    periodo,
    coeficienteUtilidad: input.coeficienteUtilidad ?? current.coeficienteUtilidad,
    perdidasFiscalesPendientes:
      input.perdidasFiscalesPendientes ?? current.perdidasFiscalesPendientes,
    pagosProvisionalesAnteriores:
      input.pagosProvisionalesAnteriores ?? current.pagosProvisionalesAnteriores,
    saldoFavorIvaAnterior: input.saldoFavorIvaAnterior ?? current.saldoFavorIvaAnterior,
    tipoCambioDofCierre: input.tipoCambioDofCierre ?? current.tipoCambioDofCierre,
    ptuPagadaEjercicio: input.ptuPagadaEjercicio ?? current.ptuPagadaEjercicio ?? 0
  };

  db.prepare(`
    INSERT INTO tax_parameters (
      company_id, ejercicio, periodo, coeficiente_utilidad, perdidas_fiscales_pendientes,
      pagos_provisionales_anteriores, saldo_favor_iva_anterior, tipo_cambio_dof_cierre, ptu_pagada_ejercicio
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, ejercicio, periodo) DO UPDATE SET
      coeficiente_utilidad = excluded.coeficiente_utilidad,
      perdidas_fiscales_pendientes = excluded.perdidas_fiscales_pendientes,
      pagos_provisionales_anteriores = excluded.pagos_provisionales_anteriores,
      saldo_favor_iva_anterior = excluded.saldo_favor_iva_anterior,
      tipo_cambio_dof_cierre = excluded.tipo_cambio_dof_cierre,
      ptu_pagada_ejercicio = excluded.ptu_pagada_ejercicio
  `).run(
    companyId,
    ejercicio,
    periodo,
    next.coeficienteUtilidad,
    fromCents(toCents(next.perdidasFiscalesPendientes)),
    fromCents(toCents(next.pagosProvisionalesAnteriores)),
    fromCents(toCents(next.saldoFavorIvaAnterior)),
    next.tipoCambioDofCierre,
    fromCents(toCents(next.ptuPagadaEjercicio ?? 0))
  );

  return getTaxParameters(companyId, ejercicio, periodo);
}

export function getFiscalWorkpaperReport(
  companyId: string,
  ejercicio: number,
  periodo: number
): FiscalWorkpaperResponse {
  const company = getCompanyById(companyId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const parameters = getTaxParameters(company.id, ejercicio, periodo);
  const trialBalance = computeTrialBalance(company.id, ejercicio, periodo);
  const cfdis = getCfdiDocuments(company.id);
  const rules = listAccountingRulesRepo(company.id);
  const thirdParties = getThirdPartiesByCompany(company.id);
  const periodPolizas = getPolizas(company.id, ejercicio, periodo);
  const cutoffPeriod = periodo === 13 ? 12 : Math.max(1, Math.min(12, periodo));
  const ytdRow = db
    .query(`
      SELECT COALESCE(SUM(m.cargo), 0) as sum_cargo
      FROM poliza_movements m
      INNER JOIN polizas p ON m.poliza_id = p.id
      INNER JOIN accounts a ON m.account_id = a.id
      WHERE p.company_id = ? AND p.ejercicio = ? AND p.periodo >= 1 AND p.periodo <= ?
        AND (a.code = '113-02-001' OR a.sat_group_code = '113.02')
    `)
    .get(company.id, ejercicio, cutoffPeriod) as { sum_cargo: number } | null;
  const ytdIsrRetenidoCharges = fromCents(toCents(ytdRow?.sum_cargo ?? 0));

  return computeFiscalWorkpaperFromTrialBalance({
    company,
    ejercicio,
    periodo,
    parameters,
    trialBalance,
    cfdis,
    rules,
    thirdParties,
    ytdIsrRetenidoCharges,
    periodPolizas
  });
}

export function getCxcCxpAgingRepo(
  companyId: string,
  asOfIso?: string,
  userId?: string | null
): CxcCxpAgingResponse {
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');
  const cfdis = getCfdiDocuments(company.id);
  return computeCxcCxpAging({ companyId: company.id, cfdis, asOfIso });
}

export async function verifyCfdisSatBatchRepo(
  companyId: string,
  cfdiIds: string[],
  userId?: string | null
): Promise<SatBatchVerifyResult> {
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const uniqueIds = Array.from(
    new Set(cfdiIds.map((id) => String(id || '').trim()).filter(Boolean))
  ).slice(0, 50);

  if (uniqueIds.length === 0) {
    return { checkedCount: 0, updatedCount: 0, cancelledWithPolizaCount: 0, items: [] };
  }

  const targets = uniqueIds
    .map((id) => getCfdiById(id))
    .filter((c): c is NonNullable<typeof c> => c !== null && c.companyId === company.id);

  const items: SatBatchVerifyResult['items'] = [];
  let updatedCount = 0;
  const updateStmt = db.prepare(
    'UPDATE cfdi_documents SET status_sat = ? WHERE id = ? AND company_id = ?'
  );
  const efosStmt = db.query('SELECT situacion FROM sat_efos_69b WHERE rfc = ?');

  for (let i = 0; i < targets.length; i += 5) {
    const chunk = targets.slice(i, i + 5);
    const chunkResults = await Promise.all(
      chunk.map(async (cfdi) => {
        const res = await querySatCfdiStatusSoap({
          rfcEmisor: cfdi.emisorRfc,
          rfcReceptor: cfdi.receptorRfc,
          total: cfdi.total,
          uuid: cfdi.uuid,
          currentStatus: cfdi.statusSat
        });

        let validacionEfos: string = res.validacionEfos;
        if (validacionEfos === '200_LIMPIO') {
          const efosRow = efosStmt.get(cfdi.emisorRfc.trim().toUpperCase()) as {
            situacion?: string;
          } | null;
          const sit = String(efosRow?.situacion || '').toUpperCase();
          if (sit.includes('PRESUNTO') || sit.includes('DEFINITIV')) {
            validacionEfos = '100_PRESUNTO_O_DEFINITIVO_69B';
          }
        }

        if (res.modoConsulta !== 'OFFLINE_UNVERIFIED') {
          updateStmt.run(res.estadoSat, cfdi.id, company.id);
          updatedCount += 1;
        }

        const hadPoliza = Boolean(cfdi.polizaId);
        const statusSat = res.estadoSat;
        return {
          cfdiId: cfdi.id,
          uuid: cfdi.uuid,
          statusSat,
          hadPoliza,
          cancelledWithPoliza: statusSat === 'CANCELADO' && hadPoliza,
          validacionEfos
        };
      })
    );
    items.push(...chunkResults);
  }

  return {
    checkedCount: items.length,
    updatedCount,
    cancelledWithPolizaCount: items.filter((item) => item.cancelledWithPoliza).length,
    items
  };
}

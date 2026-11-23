import { db } from '../connection';
import {
  assertAccountingInvariant,
  computeFiscalWorkpaperFromTrialBalance,
  fromCents,
  toCents
} from '../../shared/accounting-engine';
import { computeDiotReportData } from '../../shared/engine/diot.engine';
import type {
  DiotReportResponse,
  FiscalWorkpaperResponse,
  TaxParametersRecord
} from '../../shared/types';
import { getCompanyById } from './companies.repo';
import { getCfdiDocuments } from './cfdi.repo';
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
    trialBalance
  });
}

export function getTaxParameters(companyId: string, ejercicio: number): TaxParametersRecord {
  const row = db
    .query('SELECT * FROM tax_parameters WHERE company_id = ? AND ejercicio = ?')
    .get(companyId, ejercicio) as {
    company_id: string;
    ejercicio: number;
    coeficiente_utilidad: number;
    perdidas_fiscales_pendientes: number;
    pagos_provisionales_anteriores: number;
    saldo_favor_iva_anterior: number;
    tipo_cambio_dof_cierre: number;
  } | null;

  return {
    companyId,
    ejercicio,
    coeficienteUtilidad: Number(row?.coeficiente_utilidad ?? 0.1845),
    perdidasFiscalesPendientes: Number(row?.perdidas_fiscales_pendientes ?? 45000),
    pagosProvisionalesAnteriores: Number(row?.pagos_provisionales_anteriores ?? 128500),
    saldoFavorIvaAnterior: Number(row?.saldo_favor_iva_anterior ?? 0),
    tipoCambioDofCierre: Number(row?.tipo_cambio_dof_cierre ?? 19.865)
  };
}

export function saveTaxParameters(
  companyId: string,
  ejercicio: number,
  input: Partial<Omit<TaxParametersRecord, 'companyId' | 'ejercicio'>>
): TaxParametersRecord {
  const current = getTaxParameters(companyId, ejercicio);
  const next: TaxParametersRecord = {
    companyId,
    ejercicio,
    coeficienteUtilidad: input.coeficienteUtilidad ?? current.coeficienteUtilidad,
    perdidasFiscalesPendientes:
      input.perdidasFiscalesPendientes ?? current.perdidasFiscalesPendientes,
    pagosProvisionalesAnteriores:
      input.pagosProvisionalesAnteriores ?? current.pagosProvisionalesAnteriores,
    saldoFavorIvaAnterior: input.saldoFavorIvaAnterior ?? current.saldoFavorIvaAnterior,
    tipoCambioDofCierre: input.tipoCambioDofCierre ?? current.tipoCambioDofCierre
  };

  db.prepare(`
    INSERT INTO tax_parameters (
      company_id, ejercicio, coeficiente_utilidad, perdidas_fiscales_pendientes,
      pagos_provisionales_anteriores, saldo_favor_iva_anterior, tipo_cambio_dof_cierre
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, ejercicio) DO UPDATE SET
      coeficiente_utilidad = excluded.coeficiente_utilidad,
      perdidas_fiscales_pendientes = excluded.perdidas_fiscales_pendientes,
      pagos_provisionales_anteriores = excluded.pagos_provisionales_anteriores,
      saldo_favor_iva_anterior = excluded.saldo_favor_iva_anterior,
      tipo_cambio_dof_cierre = excluded.tipo_cambio_dof_cierre
  `).run(
    companyId,
    ejercicio,
    next.coeficienteUtilidad,
    fromCents(toCents(next.perdidasFiscalesPendientes)),
    fromCents(toCents(next.pagosProvisionalesAnteriores)),
    fromCents(toCents(next.saldoFavorIvaAnterior)),
    next.tipoCambioDofCierre
  );

  return getTaxParameters(companyId, ejercicio);
}

export function getFiscalWorkpaperReport(
  companyId: string,
  ejercicio: number,
  periodo: number
): FiscalWorkpaperResponse {
  const company = getCompanyById(companyId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const parameters = getTaxParameters(company.id, ejercicio);
  const trialBalance = computeTrialBalance(company.id, ejercicio, periodo);
  const cfdis = getCfdiDocuments(company.id);

  return computeFiscalWorkpaperFromTrialBalance({
    company,
    ejercicio,
    periodo,
    parameters,
    trialBalance,
    cfdis
  });
}

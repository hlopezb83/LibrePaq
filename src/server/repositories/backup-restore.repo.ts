import { db, mapFixedAssetRow, type FixedAssetDbRow } from '../connection';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import type { Company, CompanyBackupBundle, PeriodLock, TaxParametersRecord } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { getCompanyById } from './companies.repo';
import { getCfdiDocuments } from './cfdi.repo';
import { getPolizas } from './polizas.repo';
import { syncThirdPartiesFromCfdis } from './third-parties.repo';
import { getTaxParameters, saveTaxParameters } from './fiscal.repo';
import {
  clearOptionalSqliteBackupTables,
  exportOptionalSqliteBackupTables,
  restoreOptionalSqliteBackupTables,
  type SqliteExtendedBackupBundle
} from './backup-restore-optional.repo';
import {
  assertNoCrossTenantRowId,
  ensureBackupSqliteColumns,
  restoreSqliteAccounts,
  restoreSqliteCfdis,
  restoreSqlitePolizas,
  restoreSqliteThirdPartiesAndBank
} from './backup-restore-helpers.repo';

export function restoreCompanyBackupBundle(bundle: CompanyBackupBundle, actorUserId?: string | null): Company {
  assertAccountingInvariant(Boolean(bundle && bundle.company && bundle.company.rfc), 'INVALID_BACKUP_BUNDLE', 'El archivo de respaldo JSON no tiene una estructura válida de LibrePaq.');

  const comp = bundle.company;
  let resolvedOwner: string | null = null;
  const tx = db.transaction(() => {
    ensureBackupSqliteColumns();
    const existingCompany = db.query('SELECT user_id FROM companies WHERE id = ?').get(comp.id) as { user_id?: string } | null;
    assertAccountingInvariant(!existingCompany || getCompanyById(comp.id, actorUserId) !== null, 'FORBIDDEN_RESTORE', 'No tienes autorización para restaurar esta empresa.');
    const resolvedUserId = actorUserId || existingCompany?.user_id || comp.userId || 'demo';
    resolvedOwner = resolvedUserId;

    db.prepare(`
      INSERT INTO companies (id, name, rfc, regimen_fiscal, codigo_postal, mask_format, current_year, current_period, created_at, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        rfc = excluded.rfc,
        regimen_fiscal = excluded.regimen_fiscal,
        codigo_postal = excluded.codigo_postal,
        current_year = excluded.current_year,
        current_period = excluded.current_period,
        user_id = COALESCE(excluded.user_id, companies.user_id)
    `).run(
      comp.id,
      comp.name,
      comp.rfc,
      comp.regimenFiscal,
      comp.codigoPostal,
      comp.maskFormat || 'XXX-XX-XXX',
      comp.currentYear || 2026,
      comp.currentPeriod || 10,
      comp.createdAt || new Date().toISOString(),
      resolvedUserId
    );

    clearOptionalSqliteBackupTables(comp.id);
    db.prepare('DELETE FROM polizas WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM cfdi_documents WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM bank_statement_lines WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM fixed_assets WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM third_parties WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM period_locks WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM tax_parameters WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM accounts WHERE company_id = ?').run(comp.id);

    if (Array.isArray(bundle.accounts) && bundle.accounts.length > 0) {
      restoreSqliteAccounts(comp.id, bundle.accounts);
    }

    if (Array.isArray(bundle.taxParameters)) {
      for (const tp of bundle.taxParameters) {
        if (tp) {
          saveTaxParameters(comp.id, tp.ejercicio || comp.currentYear, tp);
        }
      }
    }

    if (Array.isArray(bundle.polizas) && bundle.polizas.length > 0) {
      restoreSqlitePolizas(comp.id, bundle.polizas);
    }

    if (Array.isArray(bundle.cfdis) && bundle.cfdis.length > 0) {
      restoreSqliteCfdis(comp.id, bundle.cfdis);
    }

    if (Array.isArray(bundle.fixedAssets) && bundle.fixedAssets.length > 0) {
      const insertFa = db.prepare(`
        INSERT OR REPLACE INTO fixed_assets (
          id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
          monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
          inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code, cuenta_dep_acum_code, cuenta_gasto_dep_code, estatus, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const fa of bundle.fixedAssets) {
        assertNoCrossTenantRowId('fixed_assets', fa.id, comp.id);
        insertFa.run(
          fa.id, comp.id, fa.codigo, fa.nombre, fa.categoria, fa.fechaAdquisicion,
          fa.cfdiUuid || null, fa.montoOriginalInversion, fa.tasaAnualPct,
          fa.mesesDepreciadosPrevios || 0, fa.inpcAdquisicion || 1, fa.inpcMedioPeriodo || 1,
          fa.cuentaActivoCode || '', fa.cuentaDepAcumCode || '', fa.cuentaGastoDepCode || '',
          fa.estatus || 'ACTIVO', fa.createdAt || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(bundle.periodLocks) && bundle.periodLocks.length > 0) {
      const insertLock = db.prepare(`
        INSERT OR REPLACE INTO period_locks (company_id, ejercicio, periodo, is_locked, locked_at, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const pl of bundle.periodLocks) {
        insertLock.run(
          comp.id,
          pl.ejercicio,
          pl.periodo,
          pl.isLocked ? 1 : 0,
          pl.lockedAt || null,
          pl.notes || ''
        );
      }
    }

    restoreSqliteThirdPartiesAndBank(comp.id, bundle);
    restoreOptionalSqliteBackupTables(comp.id, bundle as SqliteExtendedBackupBundle);
  });

  tx();
  const restored = getCompanyById(comp.id, resolvedOwner);
  assertAccountingInvariant(restored !== null, 'RESTORE_FAILED', 'No se pudo restaurar la empresa.');
  return restored;
}

interface BankStatementDbRow {
  id: string;
  company_id: string;
  account_id: string;
  fecha: string;
  ejercicio: number;
  periodo: number;
  referencia: string;
  descripcion: string;
  cargo_banco: number;
  abono_banco: number;
  matched_movement_id: string | null;
}

export function exportCompanyBackupBundle(
  companyId: string,
  userId?: string | null
): SqliteExtendedBackupBundle {
  ensureBackupSqliteColumns();
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const accounts = getAccounts(company.id);
  const cfdis = getCfdiDocuments(company.id, { includeXml: true });
  const polizas = getPolizas(company.id);
  const syncedThirdParties = syncThirdPartiesFromCfdis(company.id);
  const tpExtraRows = db
    .query('SELECT id, deductible_pct FROM third_parties WHERE company_id = ?')
    .all(company.id) as Array<{ id: string; deductible_pct?: number }>;
  const tpDedMap = new Map(tpExtraRows.map((r) => [r.id, Number(r.deductible_pct ?? 100)]));
  const thirdParties = syncedThirdParties.map((tp) => ({
    ...tp,
    deductiblePct: tpDedMap.get(tp.id) ?? 100
  }));

  const fixedAssets = (
    db.query('SELECT * FROM fixed_assets WHERE company_id = ?').all(company.id) as FixedAssetDbRow[]
  ).map(mapFixedAssetRow);
  const lockRows = db
    .query('SELECT * FROM period_locks WHERE company_id = ?')
    .all(company.id) as Array<{
    company_id: string;
    ejercicio: number;
    periodo: number;
    is_locked: number;
    locked_at: string | null;
    notes: string;
  }>;
  const periodLocks: PeriodLock[] = lockRows.map((r) => ({
    companyId: r.company_id,
    ejercicio: Number(r.ejercicio),
    periodo: Number(r.periodo),
    isLocked: Boolean(r.is_locked),
    lockedAt: r.locked_at,
    notes: r.notes
  }));

  const rawTaxRows = db
    .query('SELECT * FROM tax_parameters WHERE company_id = ? ORDER BY ejercicio ASC, periodo ASC')
    .all(company.id) as Array<Record<string, unknown>>;
  const taxParameters: TaxParametersRecord[] =
    rawTaxRows.length > 0
      ? rawTaxRows.map((r) => ({
          companyId: String(r.company_id),
          ejercicio: Number(r.ejercicio),
          periodo: Number(r.periodo ?? 0),
          coeficienteUtilidad: Number(r.coeficiente_utilidad ?? 0),
          perdidasFiscalesPendientes: Number(r.perdidas_fiscales_pendientes ?? 0),
          pagosProvisionalesAnteriores: Number(r.pagos_provisionales_anteriores ?? 0),
          saldoFavorIvaAnterior: Number(r.saldo_favor_iva_anterior ?? 0),
          tipoCambioDofCierre: Number(r.tipo_cambio_dof_cierre ?? 0),
          ptuPagadaEjercicio: Number(r.ptu_pagada_ejercicio ?? 0)
        }))
      : [getTaxParameters(company.id, company.currentYear, 0)];

  const bankRows = db
    .query('SELECT * FROM bank_statement_lines WHERE company_id = ?')
    .all(company.id) as BankStatementDbRow[];
  const bankStatementLines = bankRows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    accountId: r.account_id,
    fecha: r.fecha,
    ejercicio: Number(r.ejercicio),
    periodo: Number(r.periodo),
    referencia: r.referencia,
    descripcion: r.descripcion,
    cargoBanco: Number(r.cargo_banco || 0),
    abonoBanco: Number(r.abono_banco || 0),
    matchedMovementId: r.matched_movement_id,
    matchedPolizaFolio: null
  }));

  const optionalTables = exportOptionalSqliteBackupTables(company.id);

  return {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    company,
    accounts,
    cfdis,
    polizas,
    thirdParties,
    fixedAssets,
    periodLocks,
    taxParameters,
    bankStatementLines,
    ...optionalTables
  };
}

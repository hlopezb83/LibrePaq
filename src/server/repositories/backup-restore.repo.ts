import { db, mapFixedAssetRow, type FixedAssetDbRow } from '../connection';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import type { Company, CompanyBackupBundle, PeriodLock } from '../../shared/types';
import { batchImportAccountsCatalog, getAccounts } from './accounts.repo';
import { getCompanyById } from './companies.repo';
import { getCfdiDocuments } from './cfdi.repo';
import { getPolizas } from './polizas.repo';
import { syncThirdPartiesFromCfdis } from './third-parties.repo';
import { getTaxParameters, saveTaxParameters } from './fiscal.repo';

export function restoreCompanyBackupBundle(
  bundle: CompanyBackupBundle,
  actorUserId?: string | null
): Company {
  assertAccountingInvariant(
    Boolean(bundle && bundle.company && bundle.company.rfc),
    'INVALID_BACKUP_BUNDLE',
    'El archivo de respaldo JSON no tiene una estructura válida de LibrePaq.'
  );

  const comp = bundle.company;
  let resolvedOwner: string | null = null;
  const tx = db.transaction(() => {
    const existingCompany = db.query('SELECT user_id FROM companies WHERE id = ?').get(comp.id) as { user_id?: string } | null;
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

    // R6-CRIT-02: Limpieza atómica de registros hijos previos para evitar datos zombie combinados
    db.prepare('DELETE FROM polizas WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM cfdi_documents WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM bank_statement_lines WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM fixed_assets WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM third_parties WHERE company_id = ?').run(comp.id);
    db.prepare('DELETE FROM period_locks WHERE company_id = ?').run(comp.id);

    if (Array.isArray(bundle.accounts) && bundle.accounts.length > 0) {
      batchImportAccountsCatalog(comp.id, bundle.accounts);
    }

    if (Array.isArray(bundle.taxParameters)) {
      for (const tp of bundle.taxParameters) {
        if (tp) {
          saveTaxParameters(comp.id, tp.ejercicio || comp.currentYear, tp);
        }
      }
    }

    if (Array.isArray(bundle.polizas) && bundle.polizas.length > 0) {
      const insertPol = db.prepare(`
        INSERT OR REPLACE INTO polizas (id, company_id, tipo, folio, fecha, ejercicio, periodo, concepto, cfdi_uuid, origin, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertMov = db.prepare(`
        INSERT OR REPLACE INTO poliza_movements (id, poliza_id, account_id, account_code, account_name, referencia, concepto, cargo, abono, cfdi_uuid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of bundle.polizas) {
        insertPol.run(
          p.id,
          comp.id,
          p.tipo,
          p.folio,
          p.fecha,
          p.ejercicio,
          p.periodo,
          p.concepto,
          p.cfdiUuid || null,
          p.origin || 'MANUAL',
          p.createdAt || new Date().toISOString()
        );
        if (Array.isArray(p.movements)) {
          for (const m of p.movements) {
            insertMov.run(
              m.id,
              p.id,
              m.accountId,
              m.accountCode || '',
              m.accountName || '',
              m.referencia || '',
              m.concepto || '',
              m.cargo || 0,
              m.abono || 0,
              m.cfdiUuid || null
            );
          }
        }
      }
    }

    if (Array.isArray(bundle.cfdis) && bundle.cfdis.length > 0) {
      const insertCfdi = db.prepare(`
        INSERT OR REPLACE INTO cfdi_documents (
          id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio,
          emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre,
          concepto_principal, clave_prod_serv, moneda, tipo_cambio,
          subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total,
          metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id, tax_breakdown, related_docs, xml_raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of bundle.cfdis) {
        insertCfdi.run(
          c.id,
          comp.id,
          c.uuid,
          c.fecha,
          c.tipoComprobante,
          c.direction,
          c.serie || '',
          c.folio || '',
          c.emisorRfc,
          c.emisorNombre,
          c.receptorRfc,
          c.receptorNombre,
          c.conceptoPrincipal,
          c.claveProdServ || '01010101',
          c.moneda || 'MXN',
          c.tipoCambio || 1,
          c.subtotal || 0,
          c.descuento || 0,
          c.ivaTrasladado || 0,
          c.isrRetenido || 0,
          c.ivaRetenido || 0,
          c.total || 0,
          c.metodoPago || 'PUE',
          c.formaPago || '03',
          c.usoCfdi || 'G03',
          c.uuidRelacionado || null,
          c.statusSat || 'VIGENTE',
          c.polizaId || null,
          c.taxBreakdown ? JSON.stringify(c.taxBreakdown) : null,
          c.relatedDocs ? JSON.stringify(c.relatedDocs) : null,
          c.xmlRaw || ''
        );
      }
    }

    if (Array.isArray(bundle.fixedAssets) && bundle.fixedAssets.length > 0) {
      const insertFa = db.prepare(`
        INSERT OR REPLACE INTO fixed_assets (
          id, company_id, codigo, nombre, categoria, fecha_adquisicion, cfdi_uuid,
          monto_original_inversion, tasa_anual_pct, meses_depreciados_previos,
          inpc_adquisicion, inpc_medio_periodo, cuenta_activo_code, cuenta_dep_acum_code, cuenta_gasto_dep_code, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const fa of bundle.fixedAssets) {
        insertFa.run(
          fa.id,
          comp.id,
          fa.codigo,
          fa.nombre,
          fa.categoria,
          fa.fechaAdquisicion,
          fa.cfdiUuid || null,
          fa.montoOriginalInversion,
          fa.tasaAnualPct,
          fa.mesesDepreciadosPrevios || 0,
          fa.inpcAdquisicion || 1,
          fa.inpcMedioPeriodo || 1,
          fa.cuentaActivoCode || '',
          fa.cuentaDepAcumCode || '',
          fa.cuentaGastoDepCode || '',
          fa.createdAt || new Date().toISOString()
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

    if (Array.isArray(bundle.thirdParties) && bundle.thirdParties.length > 0) {
      const insertTp = db.prepare(`
        INSERT OR REPLACE INTO third_parties (
          id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
          tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, estatus_69b, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const tp of bundle.thirdParties) {
        insertTp.run(
          tp.id,
          comp.id,
          tp.rfc,
          tp.nombre,
          tp.rol || 'PROVEEDOR',
          tp.cuentaOperacionCode,
          tp.cuentaContrapartidaCode,
          tp.tipoTerceroDiot || '04',
          tp.tipoOperacionDiot || '85',
          tp.tasaIvaDefault || 16,
          tp.estatus69B || 'LIMPIO',
          tp.updatedAt || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(bundle.bankStatementLines) && bundle.bankStatementLines.length > 0) {
      const insertBsl = db.prepare(`
        INSERT OR REPLACE INTO bank_statement_lines (
          id, company_id, account_id, fecha, ejercicio, periodo, referencia, descripcion,
          cargo_banco, abono_banco, matched_movement_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const b of bundle.bankStatementLines) {
        insertBsl.run(
          b.id,
          comp.id,
          b.accountId,
          b.fecha,
          b.ejercicio || comp.currentYear,
          b.periodo || comp.currentPeriod,
          b.referencia || '',
          b.descripcion || '',
          b.cargoBanco || 0,
          b.abonoBanco || 0,
          b.matchedMovementId || null
        );
      }
    }
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
): CompanyBackupBundle {
  const company = getCompanyById(companyId, userId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const accounts = getAccounts(company.id);
  const cfdis = getCfdiDocuments(company.id);
  const polizas = getPolizas(company.id);
  const thirdParties = syncThirdPartiesFromCfdis(company.id);
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

  const taxYearRows = db
    .query('SELECT DISTINCT ejercicio FROM tax_parameters WHERE company_id = ? ORDER BY ejercicio ASC')
    .all(company.id) as Array<{ ejercicio: number }>;
  const taxYears = taxYearRows.length > 0
    ? taxYearRows.map((r) => Number(r.ejercicio))
    : [company.currentYear];
  const taxParameters = taxYears.map((yr) => getTaxParameters(company.id, yr));
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
    bankStatementLines
  };
}

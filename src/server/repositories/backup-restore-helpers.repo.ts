import { db } from '../connection';
import { assertAccountingInvariant, fromCents, toCents } from '../../shared/accounting-engine';
import type { Account, CfdiDocument, CompanyBackupBundle, Poliza } from '../../shared/types';

export interface SqliteExtendedBackupBundle extends CompanyBackupBundle {
  payrollPeriodSettings?: Array<{
    companyId: string;
    ejercicio: number;
    periodo: number;
    stateCode: string;
    isnRate: number;
    imssPatronal: number;
    rcv: number;
    infonavit: number;
    updatedAt?: string;
  }>;
  polizaCfdis?: Array<{
    id: string;
    companyId: string;
    polizaId: string;
    cfdiUuid: string;
    createdAt?: string;
  }>;
  bankReconciliationClosures?: Array<{
    id: string;
    companyId: string;
    accountId: string;
    ejercicio: number;
    periodo: number;
    saldoBancoCierre: number;
    updatedAt?: string;
  }>;
  deliverableBranding?: Array<{
    id: string;
    scopeKey: string;
    companyId?: string | null;
    organizationId?: string | null;
    firmName: string;
    preparerName: string;
    auditorName: string;
    auditorCedula: string;
    legalRepName: string;
    legalRepTitle: string;
    issuanceCity: string;
    logoDataUrl?: string | null;
    notesText: string;
    updatedAt?: string;
  }>;
}

export function ensureExtendedSqliteBackupTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_reconciliation_closures (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL,
      ejercicio INTEGER NOT NULL,
      periodo INTEGER NOT NULL,
      saldo_banco_cierre REAL NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(company_id, account_id, ejercicio, periodo)
    );
    CREATE TABLE IF NOT EXISTS despacho_deliverable_branding (
      id TEXT PRIMARY KEY,
      scope_key TEXT NOT NULL UNIQUE,
      company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
      organization_id TEXT,
      firm_name TEXT NOT NULL DEFAULT '',
      auditor_name TEXT NOT NULL DEFAULT '',
      auditor_cedula TEXT NOT NULL DEFAULT '',
      preparer_name TEXT NOT NULL DEFAULT 'Auxiliar Contable',
      legal_rep_name TEXT NOT NULL DEFAULT '',
      legal_rep_title TEXT NOT NULL DEFAULT 'Representante Legal',
      issuance_city TEXT NOT NULL DEFAULT 'Ciudad de México',
      logo_data_url TEXT,
      notes_text TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function sqliteTableExists(tableName: string): boolean {
  const row = db
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | null;
  return Boolean(row?.name);
}

export function ensureBackupSqliteColumns(): void {
  const cfdiCols = db.query('PRAGMA table_info(cfdi_documents)').all() as Array<{ name: string }>;
  if (cfdiCols.length > 0 && !cfdiCols.some((c) => c.name === 'fecha_pago')) {
    db.exec('ALTER TABLE cfdi_documents ADD COLUMN fecha_pago TEXT;');
  }
  const tpCols = db.query('PRAGMA table_info(third_parties)').all() as Array<{ name: string }>;
  if (tpCols.length > 0 && !tpCols.some((c) => c.name === 'deductible_pct')) {
    db.exec('ALTER TABLE third_parties ADD COLUMN deductible_pct REAL NOT NULL DEFAULT 100;');
  }
}

export function assertNoCrossTenantRowId(
  table: string,
  rowId: string,
  companyId: string
): void {
  if (!rowId || !sqliteTableExists(table)) return;
  const existing = db
    .query(`SELECT company_id FROM ${table} WHERE id = ?`)
    .get(rowId) as { company_id?: string } | null;
  assertAccountingInvariant(
    !existing || existing.company_id === companyId,
    'CROSS_TENANT_BACKUP_ID',
    `Colisión de ID multi-tenant en tabla ${table}: el ID ${rowId} pertenece a otra empresa.`
  );
}

export function assertNoCrossTenantMovementId(
  movementId: string,
  companyId: string
): void {
  if (!movementId) return;
  const existing = db
    .query(
      'SELECT p.company_id FROM poliza_movements m INNER JOIN polizas p ON m.poliza_id = p.id WHERE m.id = ?'
    )
    .get(movementId) as { company_id?: string } | null;
  assertAccountingInvariant(
    !existing || existing.company_id === companyId,
    'CROSS_TENANT_BACKUP_ID',
    `Colisión de ID multi-tenant en poliza_movements: el ID ${movementId} pertenece a otra empresa.`
  );
}

export function restoreSqliteAccounts(companyId: string, accounts: Account[]): void {
  const stmt = db.prepare(`
    INSERT INTO accounts (
      id, company_id, code, name, parent_code, type, nature, level, is_affectable, sat_group_code, currency, initial_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of accounts) {
    const accId = a.id || `${companyId}_${a.code}`;
    assertNoCrossTenantRowId('accounts', accId, companyId);
    stmt.run(
      accId,
      companyId,
      a.code,
      a.name,
      a.parentCode ?? null,
      a.type,
      a.nature,
      Number(a.level || 1),
      a.isAffectable ? 1 : 0,
      a.satGroupCode || a.code.slice(0, 3),
      a.currency === 'USD' ? 'USD' : 'MXN',
      fromCents(toCents(Number(a.initialBalance || 0)))
    );
  }
}

export function restoreSqlitePolizas(companyId: string, polizas: Poliza[]): void {
  const insertPol = db.prepare(`
    INSERT OR REPLACE INTO polizas (id, company_id, tipo, folio, fecha, ejercicio, periodo, concepto, cfdi_uuid, origin, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMov = db.prepare(`
    INSERT OR REPLACE INTO poliza_movements (id, poliza_id, account_id, account_code, account_name, referencia, concepto, cargo, abono, cfdi_uuid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of polizas) {
    assertNoCrossTenantRowId('polizas', p.id, companyId);
    insertPol.run(
      p.id,
      companyId,
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
        assertNoCrossTenantMovementId(m.id, companyId);
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

export function restoreSqliteCfdis(companyId: string, cfdis: CfdiDocument[]): void {
  const insertCfdi = db.prepare(`
    INSERT OR REPLACE INTO cfdi_documents (
      id, company_id, uuid, fecha, fecha_pago, tipo_comprobante, direction, serie, folio,
      emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre,
      concepto_principal, clave_prod_serv, moneda, tipo_cambio,
      subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total,
      metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id, tax_breakdown, related_docs, xml_raw
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of cfdis) {
    assertNoCrossTenantRowId('cfdi_documents', c.id, companyId);
    insertCfdi.run(
      c.id,
      companyId,
      c.uuid,
      c.fecha,
      c.fechaPago || null,
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

export function restoreSqliteThirdPartiesAndBank(
  companyId: string,
  bundle: CompanyBackupBundle
): void {
  if (Array.isArray(bundle.thirdParties) && bundle.thirdParties.length > 0) {
    const insertTp = db.prepare(`
      INSERT OR REPLACE INTO third_parties (
        id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
        tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, deductible_pct, estatus_69b,
        id_fiscal, pais, jurisdiccion_fiscal, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const tp of bundle.thirdParties) {
      assertNoCrossTenantRowId('third_parties', tp.id, companyId);
      const ext = tp as unknown as Record<string, unknown>;
      const deductiblePct = Math.max(0, Math.min(100, Number(ext.deductiblePct ?? 100)));
      const cleanPais = tp.pais?.trim().toUpperCase() || null;
      insertTp.run(
        tp.id,
        companyId,
        tp.rfc,
        tp.nombre,
        tp.rol || 'PROVEEDOR',
        tp.cuentaOperacionCode,
        tp.cuentaContrapartidaCode,
        tp.tipoTerceroDiot || '04',
        tp.tipoOperacionDiot || '85',
        tp.tasaIvaDefault ?? 16,
        deductiblePct,
        tp.estatus69B || (ext.estatus69b as string) || 'LIMPIO',
        tp.idFiscal?.trim() || null,
        cleanPais,
        cleanPais === 'ZZZ' ? (tp.jurisdiccionFiscal?.trim() || null) : null,
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
      assertNoCrossTenantRowId('bank_statement_lines', b.id, companyId);
      insertBsl.run(
        b.id, companyId, b.accountId, b.fecha, b.ejercicio || bundle.company.currentYear,
        b.periodo || bundle.company.currentPeriod, b.referencia || '', b.descripcion || '',
        b.cargoBanco || 0, b.abonoBanco || 0, b.matchedMovementId || null
      );
    }
  }
}

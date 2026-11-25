import { db } from '../connection';
import type {
  BusinessSegment,
  CfdiDocument,
  CompanyBackupBundle,
  CustomInpcEntry,
  FiscalLossCarryforward,
  FixedAssetRecord,
  Poliza,
  PolizaTemplate,
  PolizaTemplateMovement,
  PolizaType,
  ThirdPartyRecord
} from '../../shared/types';
import {
  assertNoCrossTenantRowId,
  sqliteTableExists
} from './backup-restore-helpers.repo';

export function clearRonda11SqliteBackupTables(companyId: string): void {
  const tables = [
    'poliza_templates',
    'business_segments',
    'custom_inpc_entries',
    'fiscal_loss_carryforwards'
  ];
  for (const table of tables) {
    if (sqliteTableExists(table)) {
      db.prepare(`DELETE FROM ${table} WHERE company_id = ?`).run(companyId);
    }
  }
}

export function restoreRonda11SqliteBackupTables(
  companyId: string,
  bundle: CompanyBackupBundle
): void {
  if (Array.isArray(bundle.businessSegments) && bundle.businessSegments.length > 0 && sqliteTableExists('business_segments')) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO business_segments (
        id, company_id, code, name, parent_id, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const bs of bundle.businessSegments) {
      assertNoCrossTenantRowId('business_segments', bs.id, companyId);
      stmt.run(
        bs.id,
        companyId,
        bs.code,
        bs.name,
        bs.parentId ?? null,
        bs.isActive === false ? 0 : 1,
        bs.createdAt || now,
        bs.updatedAt || now
      );
    }
  }

  if (Array.isArray(bundle.polizaTemplates) && bundle.polizaTemplates.length > 0 && sqliteTableExists('poliza_templates')) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO poliza_templates (
        id, company_id, name, tipo, concepto_default, movements_json, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const pt of bundle.polizaTemplates) {
      assertNoCrossTenantRowId('poliza_templates', pt.id, companyId);
      stmt.run(
        pt.id,
        companyId,
        pt.name,
        pt.tipo || 'DIARIO',
        pt.conceptoDefault || '',
        JSON.stringify(Array.isArray(pt.movementsJson) ? pt.movementsJson : []),
        pt.isActive === false ? 0 : 1,
        pt.createdAt || now,
        pt.updatedAt || now
      );
    }
  }

  if (Array.isArray(bundle.customInpcEntries) && bundle.customInpcEntries.length > 0 && sqliteTableExists('custom_inpc_entries')) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO custom_inpc_entries (
        company_id, year, month, inpc_value, source, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const ci of bundle.customInpcEntries) {
      stmt.run(
        companyId,
        Number(ci.year),
        Number(ci.month),
        Number(ci.inpcValue),
        ci.source || 'MANUAL',
        ci.updatedAt || now
      );
    }
  }

  if (Array.isArray(bundle.fiscalLossCarryforwards) && bundle.fiscalLossCarryforwards.length > 0 && sqliteTableExists('fiscal_loss_carryforwards')) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO fiscal_loss_carryforwards (
        id, company_id, loss_year, original_amount, applied_amount, remaining_amount,
        inpc_first_update_month, inpc_last_applied, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const fl of bundle.fiscalLossCarryforwards) {
      const flId = fl.id || `flc_${companyId}_${fl.lossYear}`;
      assertNoCrossTenantRowId('fiscal_loss_carryforwards', flId, companyId);
      stmt.run(
        flId,
        companyId,
        Number(fl.lossYear),
        Number(fl.originalAmount ?? 0),
        Number(fl.appliedAmount ?? 0),
        Number(fl.remainingAmount ?? 0),
        fl.inpcFirstUpdateMonth ?? null,
        fl.inpcLastApplied ?? null,
        fl.notes || '',
        fl.updatedAt || now
      );
    }
  }
}

export function exportRonda11SqliteBackupTables(companyId: string): {
  businessSegments: BusinessSegment[];
  polizaTemplates: PolizaTemplate[];
  customInpcEntries: CustomInpcEntry[];
  fiscalLossCarryforwards: FiscalLossCarryforward[];
} {
  const businessSegments: BusinessSegment[] = sqliteTableExists('business_segments')
    ? (db.query('SELECT * FROM business_segments WHERE company_id = ? ORDER BY code ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        companyId: String(r.company_id),
        code: String(r.code ?? ''),
        name: String(r.name ?? ''),
        parentId: r.parent_id ? String(r.parent_id) : null,
        isActive: Boolean(r.is_active),
        createdAt: r.created_at ? String(r.created_at) : undefined,
        updatedAt: r.updated_at ? String(r.updated_at) : undefined
      }))
    : [];

  const polizaTemplates: PolizaTemplate[] = sqliteTableExists('poliza_templates')
    ? (db.query('SELECT * FROM poliza_templates WHERE company_id = ? ORDER BY name ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => {
        let movs: PolizaTemplateMovement[] = [];
        try {
          const parsed = typeof r.movements_json === 'string' ? JSON.parse(r.movements_json) : r.movements_json;
          if (Array.isArray(parsed)) movs = parsed as PolizaTemplateMovement[];
        } catch {
          movs = [];
        }
        return {
          id: String(r.id),
          companyId: String(r.company_id),
          name: String(r.name ?? ''),
          tipo: (r.tipo === 'INGRESO' || r.tipo === 'EGRESO' ? r.tipo : 'DIARIO') as PolizaType,
          conceptoDefault: String(r.concepto_default ?? ''),
          movementsJson: movs,
          isActive: Boolean(r.is_active),
          createdAt: r.created_at ? String(r.created_at) : undefined,
          updatedAt: r.updated_at ? String(r.updated_at) : undefined
        };
      })
    : [];

  const customInpcEntries: CustomInpcEntry[] = sqliteTableExists('custom_inpc_entries')
    ? (db.query('SELECT * FROM custom_inpc_entries WHERE company_id = ? ORDER BY year ASC, month ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        companyId: String(r.company_id),
        year: Number(r.year),
        month: Number(r.month),
        inpcValue: Number(r.inpc_value),
        source: r.source ? String(r.source) : 'MANUAL',
        updatedAt: r.updated_at ? String(r.updated_at) : undefined
      }))
    : [];

  const fiscalLossCarryforwards: FiscalLossCarryforward[] = sqliteTableExists('fiscal_loss_carryforwards')
    ? (db.query('SELECT * FROM fiscal_loss_carryforwards WHERE company_id = ? ORDER BY loss_year ASC').all(companyId) as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        companyId: String(r.company_id),
        lossYear: Number(r.loss_year),
        originalAmount: Number(r.original_amount ?? 0),
        appliedAmount: Number(r.applied_amount ?? 0),
        remainingAmount: Number(r.remaining_amount ?? 0),
        inpcFirstUpdateMonth: r.inpc_first_update_month != null ? Number(r.inpc_first_update_month) : null,
        inpcLastApplied: r.inpc_last_applied != null ? Number(r.inpc_last_applied) : null,
        notes: r.notes ? String(r.notes) : '',
        updatedAt: r.updated_at ? String(r.updated_at) : undefined
      }))
    : [];

  return { businessSegments, polizaTemplates, customInpcEntries, fiscalLossCarryforwards };
}

export function enrichRonda11SqliteExport(
  companyId: string,
  cfdis: CfdiDocument[],
  polizas: Poliza[],
  thirdParties: ThirdPartyRecord[],
  fixedAssets: FixedAssetRecord[]
): {
  cfdis: CfdiDocument[];
  polizas: Poliza[];
  thirdParties: ThirdPartyRecord[];
  fixedAssets: FixedAssetRecord[];
} {
  const cfdiRows = db
    .query('SELECT id, validacion_efos, es_cancelable, estatus_cancelacion, deductible_pct, is_foreign_no_cfdi FROM cfdi_documents WHERE company_id = ?')
    .all(companyId) as Array<Record<string, unknown>>;
  const cfdiExtra = new Map(cfdiRows.map((r) => [String(r.id), r]));

  const movRows = db
    .query(`SELECT m.id, m.payment_method_sat, m.bank_code_ori, m.account_ori, m.bank_code_dest,
                   m.account_dest, m.beneficiary_name, m.beneficiary_rfc, m.cheque_num, m.business_segment_id
            FROM poliza_movements m INNER JOIN polizas p ON m.poliza_id = p.id WHERE p.company_id = ?`)
    .all(companyId) as Array<Record<string, unknown>>;
  const movExtra = new Map(movRows.map((r) => [String(r.id), r]));

  const tpRows = db
    .query('SELECT id, deductible_pct, region_fronteriza FROM third_parties WHERE company_id = ?')
    .all(companyId) as Array<Record<string, unknown>>;
  const tpExtra = new Map(tpRows.map((r) => [String(r.id), r]));

  const faRows = db
    .query('SELECT id, fecha_baja, precio_venta, baja_poliza_id, vehicle_cap_type FROM fixed_assets WHERE company_id = ?')
    .all(companyId) as Array<Record<string, unknown>>;
  const faExtra = new Map(faRows.map((r) => [String(r.id), r]));

  return {
    cfdis: cfdis.map((c) => {
      const ex = cfdiExtra.get(c.id);
      if (!ex) return c;
      return {
        ...c,
        validacionEfos: ex.validacion_efos ? String(ex.validacion_efos) : null,
        esCancelable: ex.es_cancelable ? String(ex.es_cancelable) : null,
        estatusCancelacion: ex.estatus_cancelacion ? String(ex.estatus_cancelacion) : null,
        deductiblePct: Number(ex.deductible_pct ?? 100),
        isForeignNoCfdi: Boolean(ex.is_foreign_no_cfdi)
      };
    }),
    polizas: polizas.map((p) => ({
      ...p,
      movements: p.movements.map((m) => {
        const ex = movExtra.get(m.id);
        if (!ex) return m;
        return {
          ...m,
          paymentMethodSat: ex.payment_method_sat ? String(ex.payment_method_sat) : null,
          bankCodeOri: ex.bank_code_ori ? String(ex.bank_code_ori) : null,
          accountOri: ex.account_ori ? String(ex.account_ori) : null,
          bankCodeDest: ex.bank_code_dest ? String(ex.bank_code_dest) : null,
          accountDest: ex.account_dest ? String(ex.account_dest) : null,
          beneficiaryName: ex.beneficiary_name ? String(ex.beneficiary_name) : null,
          beneficiaryRfc: ex.beneficiary_rfc ? String(ex.beneficiary_rfc) : null,
          chequeNum: ex.cheque_num ? String(ex.cheque_num) : null,
          businessSegmentId: ex.business_segment_id ? String(ex.business_segment_id) : null
        };
      })
    })),
    thirdParties: thirdParties.map((tp) => {
      const ex = tpExtra.get(tp.id);
      const region = String(ex?.region_fronteriza ?? tp.regionFronteriza ?? 'NORTE').toUpperCase();
      return {
        ...tp,
        deductiblePct: Math.round(Number(ex?.deductible_pct ?? tp.deductiblePct ?? 100)),
        regionFronteriza: region === 'SUR' ? 'SUR' : 'NORTE'
      };
    }),
    fixedAssets: fixedAssets.map((fa) => {
      const ex = faExtra.get(fa.id);
      if (!ex) return fa;
      return {
        ...fa,
        fechaBaja: ex.fecha_baja ? String(ex.fecha_baja) : null,
        precioVenta: ex.precio_venta != null ? Number(ex.precio_venta) : null,
        bajaPolizaId: ex.baja_poliza_id ? String(ex.baja_poliza_id) : null,
        vehicleCapType: ex.vehicle_cap_type ? String(ex.vehicle_cap_type) : null
      };
    })
  };
}

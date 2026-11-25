import { db, mapCfdiRow, mapThirdPartyRow, type CfdiDbRow, type ThirdPartyDbRow } from '../connection';
import {
  assertAccountingInvariant,
  inferExpenseAccountForCfdi,
  resolveFiscalAccount
} from '../../shared/accounting-engine';
import type { Efos69BStatus, ThirdPartyRecord } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { getCompanyById } from './companies.repo';

type ThirdPartyFullRow = ThirdPartyDbRow & {
  region_fronteriza?: string | null;
  deductible_pct?: number | null;
};

function mapThirdPartyFullRow(r: ThirdPartyFullRow): ThirdPartyRecord {
  const base = mapThirdPartyRow(r);
  const reg = String(r.region_fronteriza ?? 'NORTE').toUpperCase();
  return {
    ...base,
    regionFronteriza: reg === 'SUR' ? 'SUR' : 'NORTE',
    deductiblePct: r.deductible_pct !== undefined && r.deductible_pct !== null ? Number(r.deductible_pct) : 100
  };
}

export function getThirdPartiesByCompany(companyId: string): ThirdPartyRecord[] {
  const rows = db
    .query('SELECT * FROM third_parties WHERE company_id = ? ORDER BY rol DESC, nombre ASC')
    .all(companyId) as ThirdPartyFullRow[];
  return rows.map(mapThirdPartyFullRow);
}

export function getThirdPartyByRfc(companyId: string, rfc: string): ThirdPartyRecord | null {
  const row = db
    .query('SELECT * FROM third_parties WHERE company_id = ? AND rfc = ?')
    .get(companyId, rfc.trim().toUpperCase()) as ThirdPartyFullRow | null;
  return row ? mapThirdPartyFullRow(row) : null;
}

export function syncThirdPartiesFromCfdis(companyId: string): ThirdPartyRecord[] {
  const company = getCompanyById(companyId);
  if (!company) return [];

  const cfdiRows = db
    .query(`
      SELECT id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio,
             emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre, concepto_principal,
             clave_prod_serv, moneda, tipo_cambio, subtotal, descuento, iva_trasladado,
             isr_retenido, iva_retenido, total, metodo_pago, forma_pago, uso_cfdi,
             uuid_relacionado, status_sat, poliza_id, '' as xml_raw
      FROM cfdi_documents WHERE company_id = ? ORDER BY fecha DESC
    `)
    .all(company.id) as CfdiDbRow[];
  const cfdis = cfdiRows.map(mapCfdiRow);
  const accounts = getAccounts(company.id);
  const now = new Date().toISOString();

  const upsertStmt = db.prepare(`
    INSERT OR IGNORE INTO third_parties (
      id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
      tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, estatus_69b, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '04', ?, 16, 'LIMPIO', ?)
  `);

  const tx = db.transaction(() => {
    for (const doc of cfdis) {
      const isRecibido = doc.direction === 'RECIBIDO';
      const rfc = (isRecibido ? doc.emisorRfc : doc.receptorRfc).trim().toUpperCase();
      const nombre = (isRecibido ? doc.emisorNombre : doc.receptorNombre).trim();
      if (!rfc || rfc === company.rfc.toUpperCase()) continue;

      const rol = isRecibido ? 'PROVEEDOR' : 'CLIENTE';
      const opAcc = isRecibido
        ? inferExpenseAccountForCfdi(doc, accounts)
        : resolveFiscalAccount(accounts, 'INGRESOS_TASA_16');
      const counterAcc = isRecibido
        ? resolveFiscalAccount(accounts, 'PROVEEDORES_NACIONALES')
        : resolveFiscalAccount(accounts, 'CLIENTES_NACIONALES');

      const concLower = doc.conceptoPrincipal.toLowerCase();
      let tipoOp: '03' | '06' | '85' = '85';
      if (concLower.includes('arrendamiento') || concLower.includes('renta')) {
        tipoOp = '06';
      } else if (concLower.includes('honorario') || concLower.includes('asesor')) {
        tipoOp = '03';
      }

      upsertStmt.run(
        `tp_${company.id}_${rfc}`,
        company.id,
        rfc,
        nombre,
        rol,
        opAcc.code,
        counterAcc.code,
        tipoOp,
        now
      );
    }
  });
  tx();

  const rows = db
    .query('SELECT * FROM third_parties WHERE company_id = ? ORDER BY rol DESC, nombre ASC')
    .all(company.id) as ThirdPartyFullRow[];
  return rows.map(mapThirdPartyFullRow);
}

export function upsertThirdPartyRecord(
  companyId: string,
  input: {
    rfc: string;
    nombre: string;
    rol: 'PROVEEDOR' | 'CLIENTE' | 'AMBOS';
    cuentaOperacionCode: string;
    cuentaContrapartidaCode: string;
    tipoTerceroDiot: '04' | '05' | '15';
    tipoOperacionDiot: '02' | '03' | '06' | '07' | '08' | '85' | '87';
    tasaIvaDefault: 16 | 8 | 0;
    estatus69B: Efos69BStatus;
    idFiscal?: string | null;
    pais?: string | null;
    jurisdiccionFiscal?: string | null;
    regionFronteriza?: 'NORTE' | 'SUR';
    deductiblePct?: number;
  }
): ThirdPartyRecord {
  const cleanRfc = input.rfc.trim().toUpperCase();
  const cleanNombre = input.nombre.trim();
  const cleanIdFiscal = input.idFiscal?.trim() || null;
  const cleanPais = input.pais?.trim().toUpperCase() || null;
  const cleanJuris = cleanPais === 'ZZZ' ? (input.jurisdiccionFiscal?.trim() || null) : null;
  const cleanRegion = input.regionFronteriza === 'SUR' ? 'SUR' : 'NORTE';
  const cleanDeductiblePct = Math.max(0, Math.min(100, Math.round(Number(input.deductiblePct ?? 100))));
  const now = new Date().toISOString();

  const existing = (input.tipoTerceroDiot === '05'
    ? db
        .query("SELECT id FROM third_parties WHERE company_id = ? AND rfc = ? AND tipo_tercero_diot = '05' AND COALESCE(id_fiscal, '') = ? AND nombre = ?")
        .get(companyId, cleanRfc, cleanIdFiscal ?? '', cleanNombre)
    : db
        .query("SELECT id FROM third_parties WHERE company_id = ? AND rfc = ? AND tipo_tercero_diot <> '05'")
        .get(companyId, cleanRfc)) as { id: string } | null;

  const id = existing?.id ?? (input.tipoTerceroDiot === '05' ? `tp_${companyId}_${cleanRfc}_${crypto.randomUUID().slice(0, 6)}` : `tp_${companyId}_${cleanRfc}`);

  if (existing) {
    db.prepare(`
      UPDATE third_parties SET
        nombre = ?, rol = ?, cuenta_operacion_code = ?, cuenta_contrapartida_code = ?,
        tipo_tercero_diot = ?, tipo_operacion_diot = ?, tasa_iva_default = ?, estatus_69b = ?,
        id_fiscal = ?, pais = ?, jurisdiccion_fiscal = ?, region_fronteriza = ?, deductible_pct = ?, updated_at = ?
      WHERE id = ?
    `).run(
      cleanNombre, input.rol, input.cuentaOperacionCode, input.cuentaContrapartidaCode,
      input.tipoTerceroDiot, input.tipoOperacionDiot, input.tasaIvaDefault, input.estatus69B,
      cleanIdFiscal, cleanPais, cleanJuris, cleanRegion, cleanDeductiblePct, now, id
    );
  } else {
    db.prepare(`
      INSERT INTO third_parties (
        id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
        tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, estatus_69b,
        id_fiscal, pais, jurisdiccion_fiscal, region_fronteriza, deductible_pct, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, companyId, cleanRfc, cleanNombre, input.rol, input.cuentaOperacionCode, input.cuentaContrapartidaCode,
      input.tipoTerceroDiot, input.tipoOperacionDiot, input.tasaIvaDefault, input.estatus69B,
      cleanIdFiscal, cleanPais, cleanJuris, cleanRegion, cleanDeductiblePct, now
    );
  }

  const saved = db.query('SELECT * FROM third_parties WHERE id = ?').get(id) as ThirdPartyFullRow | null;
  assertAccountingInvariant(saved !== null, 'THIRD_PARTY_SAVE_ERROR', 'Error al guardar tercero.');
  return mapThirdPartyFullRow(saved);
}

export function deleteThirdPartyRecord(companyId: string, thirdPartyId: string): boolean {
  const res = db.prepare('DELETE FROM third_parties WHERE id = ? AND company_id = ?').run(thirdPartyId, companyId);
  return res.changes > 0;
}

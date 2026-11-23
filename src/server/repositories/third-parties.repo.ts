import { db, mapCfdiRow, mapThirdPartyRow, type CfdiDbRow, type ThirdPartyDbRow } from '../connection';
import {
  assertAccountingInvariant,
  inferExpenseAccountForCfdi,
  resolveFiscalAccount
} from '../../shared/accounting-engine';
import type { Efos69BStatus, ThirdPartyRecord } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { getCompanyById } from './companies.repo';

export function getThirdPartiesByCompany(companyId: string): ThirdPartyRecord[] {
  const rows = db
    .query('SELECT * FROM third_parties WHERE company_id = ? ORDER BY rol DESC, nombre ASC')
    .all(companyId) as ThirdPartyDbRow[];
  return rows.map(mapThirdPartyRow);
}

export function getThirdPartyByRfc(companyId: string, rfc: string): ThirdPartyRecord | null {
  const row = db
    .query('SELECT * FROM third_parties WHERE company_id = ? AND rfc = ?')
    .get(companyId, rfc.trim().toUpperCase()) as ThirdPartyDbRow | null;
  return row ? mapThirdPartyRow(row) : null;
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
    .all(company.id) as ThirdPartyDbRow[];
  return rows.map(mapThirdPartyRow);
}

export function upsertThirdPartyRecord(
  companyId: string,
  input: {
    rfc: string;
    nombre: string;
    rol: 'PROVEEDOR' | 'CLIENTE' | 'AMBOS';
    cuentaOperacionCode: string;
    cuentaContrapartidaCode: string;
    tipoTerceroDiot: '04' | '05';
    tipoOperacionDiot: '03' | '06' | '85';
    tasaIvaDefault: 16 | 8 | 0;
    estatus69B: Efos69BStatus;
  }
): ThirdPartyRecord {
  const cleanRfc = input.rfc.trim().toUpperCase();
  const id = `tp_${companyId}_${cleanRfc}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO third_parties (
      id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
      tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, estatus_69b, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, rfc) DO UPDATE SET
      nombre = excluded.nombre,
      rol = excluded.rol,
      cuenta_operacion_code = excluded.cuenta_operacion_code,
      cuenta_contrapartida_code = excluded.cuenta_contrapartida_code,
      tipo_tercero_diot = excluded.tipo_tercero_diot,
      tipo_operacion_diot = excluded.tipo_operacion_diot,
      tasa_iva_default = excluded.tasa_iva_default,
      estatus_69b = excluded.estatus_69b,
      updated_at = excluded.updated_at
  `).run(
    id,
    companyId,
    cleanRfc,
    input.nombre.trim(),
    input.rol,
    input.cuentaOperacionCode,
    input.cuentaContrapartidaCode,
    input.tipoTerceroDiot,
    input.tipoOperacionDiot,
    input.tasaIvaDefault,
    input.estatus69B,
    now
  );

  const saved = getThirdPartyByRfc(companyId, cleanRfc);
  assertAccountingInvariant(saved !== null, 'THIRD_PARTY_SAVE_ERROR', 'Error al guardar tercero.');
  return saved;
}

import type { Database } from 'bun:sqlite';
import { buildCfdi40Xml } from '../shared/cfdi-xml';
import { seedAccountsForCompanyOnDb } from './seeds/accounts-seeder';
import { INITIAL_CFDIS_SEED } from './seeds/initial-cfdis.seed';
import { seedInitialPolizasOnDb } from './seeds/initial-polizas.seed';

export { BASE_COMPANY_ACCOUNTS } from '../shared/catalogs/base-accounts.seed';
export { seedAccountsForCompanyOnDb } from './seeds/accounts-seeder';
export { ensureProductionUpgradesOnDb } from './seeds/production-upgrades.seed';

export function seedInitialDataOnDb(db: Database): void {
  const now = new Date().toISOString();
  const c1Id = 'comp_tnn_01';
  const c2Id = 'comp_cib_02';

  const insertCompany = db.prepare(`
    INSERT INTO companies (id, name, rfc, regimen_fiscal, codigo_postal, mask_format, current_year, current_period, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCompany.run(
    c1Id,
    'Tecnologías Nube del Norte S.A. de C.V.',
    'TNN2105148K2',
    '601 - General de Ley Personas Morales',
    '64000',
    'XXX-XX-XXX',
    2026,
    10,
    now
  );
  insertCompany.run(
    c2Id,
    'Comercializadora Industrial del Bajío S.A. de C.V.',
    'CIB190822M94',
    '601 - General de Ley Personas Morales',
    '37000',
    'XXX-XX-XXX',
    2026,
    10,
    now
  );

  seedAccountsForCompanyOnDb(db, c1Id, 1);
  seedAccountsForCompanyOnDb(db, c2Id, 0.65);

  const insertCfdi = db.prepare(`
    INSERT INTO cfdi_documents (
      id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio,
      emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre,
      concepto_principal, clave_prod_serv, moneda, tipo_cambio,
      subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total,
      metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id, xml_raw
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of INITIAL_CFDIS_SEED) {
    const xmlRaw = buildCfdi40Xml(c);
    insertCfdi.run(
      c.id,
      c1Id,
      c.uuid,
      c.fecha,
      c.tipoComprobante,
      c.direction,
      c.serie,
      c.folio,
      c.emisorRfc,
      c.emisorNombre,
      c.receptorRfc,
      c.receptorNombre,
      c.conceptoPrincipal,
      c.claveProdServ,
      c.moneda,
      c.tipoCambio,
      c.subtotal,
      c.descuento,
      c.ivaTrasladado,
      c.isrRetenido,
      c.ivaRetenido,
      c.total,
      c.metodoPago,
      c.formaPago,
      c.usoCfdi,
      c.uuidRelacionado,
      'VIGENTE',
      c.polizaId,
      xmlRaw
    );
  }

  seedInitialPolizasOnDb(db, c1Id, now);
}

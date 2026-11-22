import type { Database } from 'bun:sqlite';
import { buildCfdi40Xml } from '../../shared/cfdi-xml';
import { seedAccountsForCompanyOnDb } from './accounts-seeder';

export function ensureProductionUpgradesOnDb(db: Database, companyIds: readonly string[]): void {
  for (const compId of companyIds) {
    seedAccountsForCompanyOnDb(db, compId, 0);
  }

  const c1Id = 'comp_tnn_01';
  const hasComp1 = db.query('SELECT id FROM companies WHERE id = ?').get(c1Id);
  if (!hasComp1) return;

  const extraCfdis = [
    {
      id: 'cfdi_07_ret',
      uuid: 'B772A1E9-44C2-4D88-9F10-5544332211A7',
      fecha: '2026-10-20',
      tipoComprobante: 'I' as const,
      direction: 'RECIBIDO' as const,
      serie: 'HONPF',
      folio: '309',
      emisorRfc: 'GARM850612H92',
      emisorNombre: 'Mtro. Roberto Garza Martínez (Asesor Fiscal PF)',
      receptorRfc: 'TNN2105148K2',
      receptorNombre: 'Tecnologías Nube del Norte S.A. de C.V.',
      conceptoPrincipal:
        'Honorarios por Consultoría Fiscal y Defensa Tributaria (Con Retenciones ISR 10% e IVA 2/3)',
      claveProdServ: '84111600',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 30000,
      descuento: 0,
      ivaTrasladado: 4800,
      isrRetenido: 3000,
      ivaRetenido: 3200,
      total: 28600,
      metodoPago: 'PUE' as const,
      formaPago: '03',
      usoCfdi: 'G03',
      uuidRelacionado: null,
      polizaId: null
    },
    {
      id: 'cfdi_08_rep',
      uuid: 'C883B2F0-55D3-4E99-8A21-6655443322B8',
      fecha: '2026-10-20',
      tipoComprobante: 'P' as const,
      direction: 'EMITIDO' as const,
      serie: 'REP',
      folio: '88',
      emisorRfc: 'TNN2105148K2',
      emisorNombre: 'Tecnologías Nube del Norte S.A. de C.V.',
      receptorRfc: 'GLP1703198H4',
      receptorNombre: 'Grupo Logístico Pacífico S.A. de C.V.',
      conceptoPrincipal:
        'Complemento de Pago REP 2.0 Liquida Factura PPD FAC-1042 (Reclasifica IVA Pendiente → Cobrado)',
      claveProdServ: '84111506',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 185000,
      descuento: 0,
      ivaTrasladado: 29600,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 214600,
      metodoPago: 'PUE' as const,
      formaPago: '03',
      usoCfdi: 'CP01',
      uuidRelacionado: 'F401A9B2-33C4-4E81-9A11-112233D4E5F4',
      polizaId: null
    }
  ];

  const insertCfdi = db.prepare(`
    INSERT OR IGNORE INTO cfdi_documents (
      id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio,
      emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre,
      concepto_principal, clave_prod_serv, moneda, tipo_cambio,
      subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total,
      metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id, xml_raw
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VIGENTE', ?, ?)
  `);

  for (const c of extraCfdis) {
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
      c.polizaId,
      xmlRaw
    );
  }

  const countBank = db
    .query('SELECT COUNT(*) as c FROM bank_statement_lines WHERE company_id = ?')
    .get(c1Id) as { c: number } | null;

  if (!countBank || countBank.c === 0) {
    const bankAccId = `${c1Id}_102-01-001`;
    const insertBank = db.prepare(`
      INSERT INTO bank_statement_lines (
        id, company_id, account_id, fecha, ejercicio, periodo, referencia, descripcion, cargo_banco, abono_banco, matched_movement_id
      ) VALUES (?, ?, ?, ?, 2026, 10, ?, ?, ?, ?, ?)
    `);

    insertBank.run(
      'bsl_01',
      c1Id,
      bankAccId,
      '2026-10-03',
      'FAC-1041',
      'SPEI RECIBIDO CORPORATIVO ALFA DE MONTERREY FAC-1041',
      0,
      371200,
      'mov_01_1'
    );
    insertBank.run(
      'bsl_02',
      c1Id,
      bankAccId,
      '2026-10-07',
      'AWS-99201',
      'CARGO DOMICILIADO AMAZON WEB SERVICES MEXICO',
      78880,
      0,
      'mov_02_3'
    );
    insertBank.run(
      'bsl_03',
      c1Id,
      bankAccId,
      '2026-10-10',
      'ARR-508',
      'TRANSFERENCIA SPEI INMOBILIARIA REFORMA CENTRO',
      52200,
      0,
      null
    );
    insertBank.run(
      'bsl_04',
      c1Id,
      bankAccId,
      '2026-10-20',
      'COM-OCT',
      'COMISION MANEJO DE CUENTA Y SPEI EMPRESARIAL BBVA (INCLUYE IVA)',
      1160,
      0,
      null
    );
  }
}

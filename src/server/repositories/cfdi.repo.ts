import { db, mapCfdiRow, type CfdiDbRow } from '../connection';
import {
  assertAccountingInvariant,
  buildAutoPolizaPlan,
  validateDoubleEntryMovements,
  type AutoPolizaOverrides
} from '../../shared/accounting-engine';
import {
  parseCfdiXmlString,
  type ParsedCfdiPayload
} from '../../shared/cfdi-xml';
import { SAFETY_BOUNDS } from '../../shared/sat-constants';
import type { CfdiDocument, Company, Poliza } from '../../shared/types';
import { getCompanyById } from './companies.repo';
import { getAccounts } from './accounts.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { getPolizaById, insertMovementStmt, insertPolizaStmt, maxFolioQuery } from './polizas.repo';
import { getThirdPartyByRfc } from './third-parties.repo';

export function getCfdiDocuments(companyId: string, opts?: { includeXml?: boolean }): CfdiDocument[] {
  const projection = opts?.includeXml
    ? 'c.*'
    : `c.id, c.company_id, c.uuid, c.fecha, c.tipo_comprobante, c.direction, c.serie, c.folio,
       c.emisor_rfc, c.emisor_nombre, c.receptor_rfc, c.receptor_nombre, c.concepto_principal,
       c.clave_prod_serv, c.moneda, c.tipo_cambio, c.subtotal, c.descuento, c.iva_trasladado,
       c.isr_retenido, c.iva_retenido, c.total, c.metodo_pago, c.forma_pago, c.uso_cfdi,
       c.uuid_relacionado, c.status_sat, c.poliza_id, '' as xml_raw`;

  const rows = db
    .query(`
      SELECT ${projection}, (p.tipo || '-' || p.folio) as poliza_folio
      FROM cfdi_documents c
      LEFT JOIN polizas p ON c.poliza_id = p.id
      WHERE c.company_id = ?
      ORDER BY c.fecha DESC, c.id DESC
    `)
    .all(companyId) as CfdiDbRow[];

  return rows.map(mapCfdiRow);
}

export function getCfdiXml(cfdiId: string): string | null {
  const row = db
    .query('SELECT xml_raw FROM cfdi_documents WHERE id = ?')
    .get(cfdiId) as { xml_raw: string } | null;
  return row ? row.xml_raw : null;
}

export function getCfdiById(cfdiId: string): CfdiDocument | null {
  const row = db
    .query(`
      SELECT c.*, (p.tipo || '-' || p.folio) as poliza_folio
      FROM cfdi_documents c
      LEFT JOIN polizas p ON c.poliza_id = p.id
      WHERE c.id = ?
    `)
    .get(cfdiId) as CfdiDbRow | null;
  return row ? mapCfdiRow(row) : null;
}

let _insertCfdiStmt: ReturnType<typeof db.prepare> | null = null;
const insertCfdiStmt = {
  run: (...args: unknown[]) => {
    if (!_insertCfdiStmt) {
      _insertCfdiStmt = db.prepare(`
        INSERT INTO cfdi_documents (
          id, company_id, uuid, fecha, tipo_comprobante, direction, serie, folio,
          emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre,
          concepto_principal, clave_prod_serv, moneda, tipo_cambio,
          subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total,
          metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id, xml_raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VIGENTE', NULL, ?)
      `);
    }
    return (_insertCfdiStmt as any).run(...args);
  }
};

export function insertParsedCfdiRecord(
  company: Company,
  parsed: ParsedCfdiPayload
): CfdiDocument {
  const existing = db
    .query('SELECT id FROM cfdi_documents WHERE company_id = ? AND uuid = ?')
    .get(company.id, parsed.uuid) as { id: string } | null;

  assertAccountingInvariant(
    existing === null,
    'DUPLICATE_CFDI_UUID',
    `El CFDI con UUID ${parsed.uuid} ya existe en el ADD.`
  );

  const direction: 'EMITIDO' | 'RECIBIDO' =
    parsed.emisorRfc.toUpperCase() === company.rfc.toUpperCase() ? 'EMITIDO' : 'RECIBIDO';

  const id = `cfdi_${crypto.randomUUID().slice(0, 8)}`;
  insertCfdiStmt.run(
    id,
    company.id,
    parsed.uuid,
    parsed.fecha,
    parsed.tipoComprobante,
    direction,
    parsed.serie,
    parsed.folio,
    parsed.emisorRfc,
    parsed.emisorNombre,
    parsed.receptorRfc,
    parsed.receptorNombre,
    parsed.conceptoPrincipal,
    parsed.claveProdServ,
    parsed.moneda,
    parsed.tipoCambio,
    parsed.subtotal,
    parsed.descuento,
    parsed.ivaTrasladado,
    parsed.isrRetenido,
    parsed.ivaRetenido,
    parsed.total,
    parsed.metodoPago,
    parsed.formaPago,
    parsed.usoCfdi,
    parsed.uuidRelacionado || null,
    parsed.xmlRaw
  );

  const created = getCfdiById(id);
  assertAccountingInvariant(created !== null, 'CFDI_INSERT_FAILED', 'No se pudo registrar el CFDI.');
  return created;
}

/**
 * H-13 (NASA Power of 10 Reglas 2 y 3):
 * Carga masiva atómica de múltiples archivos XML en una sola transacción SQLite.
 */
export function batchUploadCfdiXmlStrings(
  company: Company,
  xmlList: readonly string[]
): { uploaded: CfdiDocument[]; skippedDuplicates: number } {
  const bound = Math.min(xmlList.length, SAFETY_BOUNDS.MAX_BATCH_CFDI);
  const uploaded: CfdiDocument[] = [];
  let skippedDuplicates = 0;

  const checkExistingStmt = db.prepare(
    'SELECT id FROM cfdi_documents WHERE company_id = ? AND uuid = ?'
  );

  const tx = db.transaction(() => {
    for (let i = 0; i < bound; i += 1) {
      const xmlRaw = xmlList[i];
      if (!xmlRaw) continue;
      const parsed = parseCfdiXmlString(xmlRaw);
      const dup = checkExistingStmt.get(company.id, parsed.uuid) as { id: string } | null;
      if (dup) {
        skippedDuplicates += 1;
        continue;
      }
      const doc = insertParsedCfdiRecord(company, parsed);
      uploaded.push(doc);
    }
  });

  tx();
  return { uploaded, skippedDuplicates };
}

export function deleteCfdiRecord(cfdiId: string): {
  found: boolean;
  hasPoliza: boolean;
  deleted: boolean;
} {
  const row = db
    .query('SELECT id, company_id, fecha, poliza_id FROM cfdi_documents WHERE id = ?')
    .get(cfdiId) as { id: string; company_id: string; fecha: string; poliza_id: string | null } | null;

  if (!row) return { found: false, hasPoliza: false, deleted: false };
  if (row.poliza_id) return { found: true, hasPoliza: true, deleted: false };

  const cfdiDate = new Date(row.fecha);
  const year = isNaN(cfdiDate.getFullYear()) ? new Date().getFullYear() : cfdiDate.getFullYear();
  const period = isNaN(cfdiDate.getMonth()) ? new Date().getMonth() + 1 : cfdiDate.getMonth() + 1;
  assertPeriodOpen(row.company_id, year, period);

  const res = db.prepare('DELETE FROM cfdi_documents WHERE id = ?').run(cfdiId);
  return { found: true, hasPoliza: false, deleted: res.changes > 0 };
}

/**
 * H-01, H-04, H-05:
 * Genera una póliza contable desde un CFDI usando el motor compartido `buildAutoPolizaPlan`
 * y verificando invariantes de partida doble antes de insertar en SQLite.
 */
export function generateAutoPolizaFromCfdiId(
  cfdiId: string,
  overrides?: AutoPolizaOverrides
): Poliza {
  const cfdi = getCfdiById(cfdiId);
  assertAccountingInvariant(cfdi !== null, 'CFDI_NOT_FOUND', 'CFDI no encontrado en el ADD.');
  assertAccountingInvariant(
    !cfdi.polizaId,
    'CFDI_ALREADY_ACCOUNTED',
    'Este CFDI ya tiene una póliza contable asociada.'
  );

  const company = getCompanyById(cfdi.companyId);
  assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');

  const cfdiDate = new Date(cfdi.fecha);
  const cfdiYear = isNaN(cfdiDate.getFullYear()) ? company.currentYear : cfdiDate.getFullYear();
  const cfdiPeriod = isNaN(cfdiDate.getMonth()) ? company.currentPeriod : cfdiDate.getMonth() + 1;

  assertPeriodOpen(company.id, cfdiYear, cfdiPeriod);

  const accounts = getAccounts(company.id);
  const accById = new Map(accounts.map((a) => [a.id, a]));

  // Fase 3: Consultar Padrón Fiscal por RFC para asignar cuentas configuradas automáticamente
  const counterpartyRfc =
    cfdi.direction === 'RECIBIDO' ? cfdi.emisorRfc : cfdi.receptorRfc;
  const thirdParty = getThirdPartyByRfc(company.id, counterpartyRfc);

  const plan = buildAutoPolizaPlan(cfdi, accounts, {
    ...overrides,
    thirdParty: overrides?.thirdParty ?? thirdParty
  });
  validateDoubleEntryMovements(plan.movements, accById);

  const maxRow = maxFolioQuery.get(
    company.id,
    plan.polizaType,
    cfdiYear,
    cfdiPeriod
  ) as { max_folio: number } | null;
  const nextFolio = (maxRow?.max_folio ?? 0) + 1;
  const polizaId = `pol_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    insertPolizaStmt.run(
      polizaId,
      company.id,
      plan.polizaType,
      nextFolio,
      cfdi.fecha,
      cfdiYear,
      cfdiPeriod,
      plan.polizaConcept,
      cfdi.uuid,
      'ADD_AUTO',
      now
    );

    for (let idx = 0; idx < plan.movements.length; idx += 1) {
      const m = plan.movements[idx];
      if (!m) continue;
      insertMovementStmt.run(
        `${polizaId}_m${idx + 1}`,
        polizaId,
        m.accountId,
        m.accountCode,
        m.accountName,
        m.referencia,
        m.concepto,
        m.cargo,
        m.abono,
        cfdi.uuid
      );
    }

    db.prepare('UPDATE cfdi_documents SET poliza_id = ? WHERE id = ?').run(polizaId, cfdi.id);
  });

  tx();

  const created = getPolizaById(polizaId);
  assertAccountingInvariant(created !== null, 'AUTO_POLIZA_READ_ERROR', 'No se pudo recuperar la póliza generada.');
  return created;
}

/**
 * H-13 (NASA Power of 10 Reglas 2 y 3):
 * Contabilización masiva en lote dentro de una única transacción SQLite atómica.
 */
export function batchGenerateAutoPolizasFromCfdiIds(
  cfdiIds: readonly string[],
  overrides?: AutoPolizaOverrides
): { createdPolizas: Poliza[]; count: number } {
  const bound = Math.min(cfdiIds.length, SAFETY_BOUNDS.MAX_BATCH_CFDI);
  const createdPolizas: Poliza[] = [];

  const tx = db.transaction(() => {
    for (let i = 0; i < bound; i += 1) {
      const id = cfdiIds[i];
      if (!id) continue;
      const cfdi = getCfdiById(id);
      if (!cfdi || cfdi.polizaId) continue;
      const poliza = generateAutoPolizaFromCfdiId(id, overrides);
      createdPolizas.push(poliza);
    }
  });

  tx();
  return { createdPolizas, count: createdPolizas.length };
}

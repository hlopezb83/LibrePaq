import { db, mapCfdiRow, type CfdiDbRow } from '../connection';
import {
  assertAccountingInvariant,
  buildAutoPolizaPlan,
  validateDoubleEntryMovements,
  type AutoPolizaOverrides
} from '../../shared/accounting-engine';
import type { ParsedCfdiPayload } from '../../shared/cfdi-xml';
import { parseCalendarDate } from '../../shared/date-utils';
import { isCfdiBelongingToCompany } from '../../shared/xml-utils';
import type { CfdiDocument, Company, Poliza } from '../../shared/types';
export { batchGenerateAutoPolizasFromCfdiIds, batchUploadCfdiXmlStrings } from './cfdi-batch.repo';
import { getCompanyById } from './companies.repo';
import { getAccounts } from './accounts.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { getPolizaById, insertMovementStmt, insertPolizaStmt, maxFolioQuery } from './polizas.repo';
import { getThirdPartyByRfc } from './third-parties.repo';
import { listAccountingRulesRepo } from './accounting-rules.repo';

export function getCfdiDocuments(companyId: string, opts?: { includeXml?: boolean }): CfdiDocument[] {
  const projection = opts?.includeXml
    ? 'c.*'
    : `c.id, c.company_id, c.uuid, c.fecha, c.tipo_comprobante, c.direction, c.serie, c.folio,
       c.emisor_rfc, c.emisor_nombre, c.receptor_rfc, c.receptor_nombre, c.concepto_principal,
       c.clave_prod_serv, c.moneda, c.tipo_cambio, c.subtotal, c.descuento, c.iva_trasladado,
       c.isr_retenido, c.iva_retenido, c.total, c.metodo_pago, c.forma_pago, c.uso_cfdi,
       c.uuid_relacionado, c.status_sat, c.poliza_id, c.tax_breakdown, c.related_docs, '' as xml_raw`;

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
          metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id,
          tax_breakdown, related_docs, xml_raw
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VIGENTE', NULL, ?, ?, ?)
      `);
    }
    return (_insertCfdiStmt as any).run(...args);
  }
};

export function insertParsedCfdiRecord(
  company: Company,
  parsed: ParsedCfdiPayload
): CfdiDocument {
  assertAccountingInvariant(
    isCfdiBelongingToCompany(parsed, company.rfc),
    'CFDI_RFC_MISMATCH',
    `El CFDI ${parsed.uuid} (${parsed.emisorRfc} → ${parsed.receptorRfc}) no corresponde al RFC de la empresa (${company.rfc}).`
  );
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
    parsed.taxBreakdown ? JSON.stringify(parsed.taxBreakdown) : null,
    parsed.relatedDocs ? JSON.stringify(parsed.relatedDocs) : null,
    parsed.xmlRaw
  );

  const created = getCfdiById(id);
  assertAccountingInvariant(created !== null, 'CFDI_INSERT_FAILED', 'No se pudo registrar el CFDI.');
  return created;
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

  const now = new Date();
  const { year, month: period } = parseCalendarDate(
    row.fecha,
    now.getFullYear(),
    now.getMonth() + 1
  );
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

  const { year: cfdiYear, month: cfdiPeriod } = parseCalendarDate(
    cfdi.fecha,
    company.currentYear,
    company.currentPeriod
  );

  assertPeriodOpen(company.id, cfdiYear, cfdiPeriod);

  const accounts = getAccounts(company.id);
  const accById = new Map(accounts.map((a) => [a.id, a]));

  // Fase 3: Consultar Padrón Fiscal por RFC y reglas contables aprendidas
  const counterpartyRfc =
    cfdi.direction === 'RECIBIDO' ? cfdi.emisorRfc : cfdi.receptorRfc;
  const thirdParty = getThirdPartyByRfc(company.id, counterpartyRfc);
  const rules = overrides?.rules ?? listAccountingRulesRepo(company.id);

  let relatedOriginalTipoCambioByUuid = overrides?.relatedOriginalTipoCambioByUuid;
  let relatedOriginalTipoCambio = overrides?.relatedOriginalTipoCambio;
  let relatedIsPpd = overrides?.relatedIsPpd;
  let relatedPpdIsrRetenido = overrides?.relatedPpdIsrRetenido;
  let relatedPpdIvaRetenido = overrides?.relatedPpdIvaRetenido;
  let relatedPpdTotal = overrides?.relatedPpdTotal;
  if ((cfdi.tipoComprobante === 'P' || cfdi.tipoComprobante === 'E') && (!relatedOriginalTipoCambioByUuid || relatedIsPpd === undefined)) {
    const relUuids = Array.from(
      new Set(
        [
          ...(cfdi.relatedDocs?.map((d) => d.idDocumento) ?? []),
          ...(cfdi.uuidRelacionado ? [cfdi.uuidRelacionado] : [])
        ]
          .map((u) => u.trim().toUpperCase())
          .filter(Boolean)
      )
    );
    if (relUuids.length > 0) {
      const ph = relUuids.map(() => '?').join(',');
      const relRows = db
        .query(
          `SELECT uuid, moneda, tipo_cambio, metodo_pago, isr_retenido, iva_retenido, total FROM cfdi_documents WHERE company_id = ? AND UPPER(uuid) IN (${ph})`
        )
        .all(company.id, ...relUuids) as Array<{
        uuid: string;
        moneda: string;
        tipo_cambio: number;
        metodo_pago: string;
        isr_retenido: number;
        iva_retenido: number;
        total: number;
      }>;
      const tcMap: Record<string, number> = {};
      for (const r of relRows) {
        const key = String(r.uuid ?? '').trim().toUpperCase();
        if (key && String(r.moneda || 'MXN').toUpperCase() !== 'MXN' && Number(r.tipo_cambio) > 0) {
          tcMap[key] = Number(r.tipo_cambio);
          if (relatedOriginalTipoCambio === undefined) relatedOriginalTipoCambio = Number(r.tipo_cambio);
        }
        if (relatedIsPpd === undefined && String(r.metodo_pago || '').toUpperCase() === 'PPD') {
          relatedIsPpd = true;
        }
        if (cfdi.tipoComprobante === 'P' && String(r.metodo_pago || '').toUpperCase() === 'PPD') {
          relatedPpdIsrRetenido = (relatedPpdIsrRetenido ?? 0) + Number(r.isr_retenido || 0);
          relatedPpdIvaRetenido = (relatedPpdIvaRetenido ?? 0) + Number(r.iva_retenido || 0);
          relatedPpdTotal = (relatedPpdTotal ?? 0) + Number(r.total || 0);
        }
      }
      if (Object.keys(tcMap).length > 0) relatedOriginalTipoCambioByUuid = tcMap;
    }
  }

  const plan = buildAutoPolizaPlan(cfdi, accounts, {
    ...overrides,
    rules,
    thirdParty: overrides?.thirdParty ?? thirdParty,
    ...(relatedOriginalTipoCambio !== undefined ? { relatedOriginalTipoCambio } : {}),
    ...(relatedOriginalTipoCambioByUuid ? { relatedOriginalTipoCambioByUuid } : {}),
    ...(relatedIsPpd !== undefined ? { relatedIsPpd } : {}),
    ...(relatedPpdIsrRetenido ? { relatedPpdIsrRetenido } : {}),
    ...(relatedPpdIvaRetenido ? { relatedPpdIvaRetenido } : {}),
    ...(relatedPpdTotal ? { relatedPpdTotal } : {})
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

import { db } from '../connection';
import {
  assertAccountingInvariant,
  buildAutoPolizaPlan,
  validateDoubleEntryMovements,
  type AutoPolizaOverrides
} from '../../shared/accounting-engine';
import { parseCfdiXmlString } from '../../shared/cfdi-xml';
import {
  normalizeForeignNoCfdiRecord,
  type ForeignNoCfdiPayload
} from '../../shared/cfdi-xml-foreign';
import {
  buildConcentratedBatchGroups,
  checkCfdi69BBlock,
  getCfdiAccountingDate,
  getCfdiCounterpartyRfc,
  type BatchPreparedCfdiPlan
} from '../../shared/engine/auto-poliza-batch';
import { clampDeductiblePct } from '../../shared/engine/auto-poliza-deductible';
import {
  buildRelatedCfdiOverridesFromRows,
  type RelatedCfdiDbRowLike
} from '../../shared/engine/auto-poliza-related';
import { chunkArray } from '../../shared/array-utils';
import { parseCalendarDate } from '../../shared/date-utils';
import { isCfdiBelongingToCompany } from '../../shared/xml-utils';
import type { CfdiDocument, Company, Poliza } from '../../shared/types';
import { getAccounts } from './accounts.repo';
import { listAccountingRulesRepo } from './accounting-rules.repo';
import {
  generateAutoPolizaFromCfdiId,
  getCfdiById,
  insertParsedCfdiRecord
} from './cfdi.repo';
import { getCompanyById } from './companies.repo';
import { assertPeriodOpen } from './period-locks.repo';
import { getPolizaById, insertMovementStmt, insertPolizaStmt, maxFolioQuery } from './polizas.repo';
import { getThirdPartyByRfc } from './third-parties.repo';

/** Registra un Comprobante Extranjero o Gasto Sin CFDI sin UUID SAT falso y sincroniza proveedor DIOT 05. */
export function insertForeignNoCfdiRecord(
  company: Company,
  payload: ForeignNoCfdiPayload
): CfdiDocument {
  const norm = normalizeForeignNoCfdiRecord(payload, company);
  const existing = db
    .query('SELECT id FROM cfdi_documents WHERE company_id = ? AND uuid = ?')
    .get(company.id, norm.uuid) as { id: string } | null;
  assertAccountingInvariant(
    existing === null,
    'DUPLICATE_CFDI_UUID',
    `El comprobante ${norm.uuid} ya existe en el ADD.`
  );

  const id = `cfdi_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO cfdi_documents (
      id, company_id, uuid, fecha, fecha_pago, tipo_comprobante, direction, serie, folio,
      emisor_rfc, emisor_nombre, receptor_rfc, receptor_nombre,
      concepto_principal, clave_prod_serv, moneda, tipo_cambio,
      subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total,
      metodo_pago, forma_pago, uso_cfdi, uuid_relacionado, status_sat, poliza_id,
      deductible_pct, is_foreign_no_cfdi, tax_breakdown, related_docs, xml_raw
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, NULL, 'VIGENTE', NULL, ?, 1, ?, NULL, '')
  `).run(
    id, company.id, norm.uuid, norm.fecha, norm.tipoComprobante, norm.direction, norm.serie, norm.folio,
    norm.emisorRfc, norm.emisorNombre, norm.receptorRfc, norm.receptorNombre,
    norm.conceptoPrincipal, norm.claveProdServ, norm.moneda, norm.tipoCambio,
    norm.subtotal, norm.ivaTrasladado, norm.isrRetenido, norm.ivaRetenido, norm.total,
    norm.metodoPago, norm.formaPago, norm.usoCfdi, norm.deductiblePct,
    JSON.stringify(norm.taxBreakdown)
  );

  if (norm.mode === 'EXTRANJERO' && norm.direction === 'RECIBIDO' && norm.emisorNombre) {
    const existingTp = db
      .query(
        "SELECT id FROM third_parties WHERE company_id = ? AND rfc = ? AND COALESCE(id_fiscal, '') = ? AND nombre = ?"
      )
      .get(company.id, norm.emisorRfc, norm.taxId || '', norm.emisorNombre) as { id: string } | null;
    if (!existingTp) {
      db.prepare(`
        INSERT OR IGNORE INTO third_parties (
          id, company_id, rfc, nombre, rol, cuenta_operacion_code, cuenta_contrapartida_code,
          tipo_tercero_diot, tipo_operacion_diot, tasa_iva_default, estatus_69b,
          id_fiscal, pais, deductible_pct, updated_at
        ) VALUES (?, ?, ?, ?, 'PROVEEDOR', '601-01-003', '201-01-099', '05', ?, 0, 'LIMPIO', ?, ?, ?, ?)
      `).run(
        `tp_${crypto.randomUUID().slice(0, 10)}`,
        company.id,
        norm.emisorRfc,
        norm.emisorNombre,
        norm.tipoOperacionDiot,
        norm.taxId || null,
        norm.country || null,
        norm.deductiblePct,
        new Date().toISOString()
      );
    }
  }

  const created = getCfdiById(id);
  assertAccountingInvariant(created !== null, 'CFDI_INSERT_FAILED', 'No se pudo registrar el comprobante extranjero.');
  return created;
}

export function batchUploadCfdiXmlStrings(
  company: Company,
  xmlList: readonly string[]
): {
  uploaded: CfdiDocument[];
  skippedDuplicates: number;
  rejectedForeign: number;
  rejectedErrors: string[];
} {
  const uploaded: CfdiDocument[] = [];
  let skippedDuplicates = 0;
  let rejectedForeign = 0;
  const rejectedErrors: string[] = [];
  const checkExistingStmt = db.prepare('SELECT id FROM cfdi_documents WHERE company_id = ? AND uuid = ?');

  for (const chunk of chunkArray([...xmlList], 200)) {
    const tx = db.transaction(() => {
      for (const xmlRaw of chunk) {
        if (!xmlRaw) continue;
        try {
          const parsed = parseCfdiXmlString(xmlRaw, { requireStamp: true });
          if (!isCfdiBelongingToCompany(parsed, company.rfc)) {
            rejectedForeign += 1;
            rejectedErrors.push(`RFC ajeno (${parsed.emisorRfc} → ${parsed.receptorRfc}) para UUID ${parsed.uuid}`);
            continue;
          }
          const dup = checkExistingStmt.get(company.id, parsed.uuid) as { id: string } | null;
          if (dup) {
            skippedDuplicates += 1;
            continue;
          }
          uploaded.push(insertParsedCfdiRecord(company, parsed));
        } catch (err) {
          rejectedErrors.push(err instanceof Error ? err.message : String(err));
        }
      }
    });
    tx();
  }
  return { uploaded, skippedDuplicates, rejectedForeign, rejectedErrors };
}

function getDb69BSituacion(rfc: string): string | null {
  try {
    const row = db
      .query('SELECT situacion FROM sat_efos_69b WHERE rfc = ? LIMIT 1')
      .get(rfc) as { situacion?: string } | null;
    return row?.situacion ?? null;
  } catch {
    return null;
  }
}

export function batchGenerateAutoPolizasFromCfdiIds(
  cfdiIds: readonly string[],
  overrides?: AutoPolizaOverrides
): {
  createdPolizas: Poliza[];
  count: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ cfdiId: string; error: string }>;
} {
  const createdPolizas: Poliza[] = [];
  let skipped = 0;
  const errors: Array<{ cfdiId: string; error: string }> = [];
  const groupingMode = overrides?.groupingMode ?? 'PER_CFDI';

  if (groupingMode === 'PER_CFDI') {
    for (const chunk of chunkArray([...cfdiIds], 100)) {
      const tx = db.transaction(() => {
        for (const id of chunk) {
          if (!id) continue;
          const cfdi = getCfdiById(id);
          if (!cfdi || cfdi.polizaId) {
            skipped += 1;
            continue;
          }
          try {
            if (!overrides?.allowEfos69B) {
              const rfc = getCfdiCounterpartyRfc(cfdi);
              const tp = getThirdPartyByRfc(cfdi.companyId, rfc);
              const efos = checkCfdi69BBlock(cfdi, tp?.estatus69B, getDb69BSituacion(rfc));
              if (efos.isBlocked) throw new Error(efos.reason);
            }
            createdPolizas.push(generateAutoPolizaFromCfdiId(id, overrides));
          } catch (err) {
            errors.push({ cfdiId: id, error: err instanceof Error ? err.message : String(err) });
          }
        }
      });
      tx();
    }
    return { createdPolizas, count: createdPolizas.length, created: createdPolizas.length, skipped, failed: errors.length, errors };
  }

  const preparedByCompany = new Map<string, BatchPreparedCfdiPlan[]>();
  for (const id of cfdiIds) {
    if (!id) continue;
    const cfdi = getCfdiById(id);
    if (!cfdi || cfdi.polizaId) {
      skipped += 1;
      continue;
    }
    try {
      const company = getCompanyById(cfdi.companyId);
      assertAccountingInvariant(company !== null, 'COMPANY_NOT_FOUND', 'Empresa no encontrada.');
      const rfc = getCfdiCounterpartyRfc(cfdi);
      const thirdParty = getThirdPartyByRfc(company.id, rfc);
      if (!overrides?.allowEfos69B) {
        const efos = checkCfdi69BBlock(cfdi, thirdParty?.estatus69B, getDb69BSituacion(rfc));
        if (efos.isBlocked) throw new Error(efos.reason);
      }
      const accountingDate = getCfdiAccountingDate(cfdi);
      const { year, month: period } = parseCalendarDate(accountingDate, company.currentYear, company.currentPeriod);
      assertPeriodOpen(company.id, year, period);
      const accounts = getAccounts(company.id);
      const rules = overrides?.rules ?? listAccountingRulesRepo(company.id);
      let derivedRelated: Partial<AutoPolizaOverrides> = {};
      if (cfdi.tipoComprobante === 'P' || cfdi.tipoComprobante === 'E') {
        const relUuids = Array.from(new Set([...(cfdi.relatedDocs?.map((d) => d.idDocumento) ?? []), ...(cfdi.uuidRelacionado ? [cfdi.uuidRelacionado] : [])].map((u) => u.trim().toUpperCase()).filter(Boolean)));
        if (relUuids.length > 0) {
          const ph = relUuids.map(() => '?').join(',');
          const relRows = db.query(`SELECT uuid, moneda, tipo_cambio, metodo_pago, subtotal, descuento, iva_trasladado, isr_retenido, iva_retenido, total, concepto_principal, clave_prod_serv, emisor_nombre, uso_cfdi, deductible_pct, xml_raw FROM cfdi_documents WHERE company_id = ? AND UPPER(uuid) IN (${ph})`).all(company.id, ...relUuids) as RelatedCfdiDbRowLike[];
          derivedRelated = buildRelatedCfdiOverridesFromRows(relRows, cfdi.tipoComprobante, relUuids.length);
        }
      }
      const plan = buildAutoPolizaPlan(cfdi, accounts, { ...derivedRelated, ...overrides, rules, thirdParty: overrides?.thirdParty ?? thirdParty });
      validateDoubleEntryMovements(plan.movements, new Map(accounts.map((a) => [a.id, a])));
      const list = preparedByCompany.get(company.id) ?? [];
      list.push({ cfdi, plan, accountingDate, year, period, counterpartyRfc: rfc });
      preparedByCompany.set(company.id, list);
    } catch (err) {
      errors.push({ cfdiId: id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  for (const [companyId, items] of preparedByCompany.entries()) {
    const groups = buildConcentratedBatchGroups(items, groupingMode);
    for (const grp of groups) {
      try {
        const polizaId = `pol_${crypto.randomUUID().slice(0, 8)}`;
        const now = new Date().toISOString();
        const tx = db.transaction(() => {
          const maxRow = maxFolioQuery.get(companyId, grp.polizaType, grp.year, grp.period) as { max_folio: number } | null;
          const nextFolio = (maxRow?.max_folio ?? 0) + 1;
          insertPolizaStmt.run(polizaId, companyId, grp.polizaType, nextFolio, grp.accountingDate, grp.year, grp.period, grp.concepto, grp.primaryUuid || null, 'ADD_AUTO', now);
          grp.movements.forEach((m, idx) => {
            insertMovementStmt.run(`${polizaId}_m${idx + 1}`, polizaId, m.accountId, m.accountCode, m.accountName, m.referencia, m.concepto, m.cargo, m.abono, m.cfdiUuid);
          });
          const cfdiPh = grp.cfdiIds.map(() => '?').join(',');
          if (overrides?.deductiblePct !== undefined) {
            db.prepare(`UPDATE cfdi_documents SET poliza_id = ?, deductible_pct = ? WHERE id IN (${cfdiPh})`).run(polizaId, clampDeductiblePct(overrides.deductiblePct), ...grp.cfdiIds);
          } else {
            db.prepare(`UPDATE cfdi_documents SET poliza_id = ? WHERE id IN (${cfdiPh})`).run(polizaId, ...grp.cfdiIds);
          }
          const insLink = db.prepare('INSERT OR IGNORE INTO poliza_cfdis (id, company_id, poliza_id, cfdi_uuid) VALUES (?, ?, ?, ?)');
          for (const u of grp.cfdiUuids) {
            insLink.run(`pc_${crypto.randomUUID().slice(0, 12)}`, companyId, polizaId, u);
          }
        });
        tx();
        const pol = getPolizaById(polizaId);
        if (pol) createdPolizas.push(pol);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        for (const cid of grp.cfdiIds) errors.push({ cfdiId: cid, error: msg });
      }
    }
  }

  return { createdPolizas, count: createdPolizas.length, created: createdPolizas.length, skipped, failed: errors.length, errors };
}

import { db } from '../connection';
import type { AutoPolizaOverrides } from '../../shared/accounting-engine';
import { parseCfdiXmlString } from '../../shared/cfdi-xml';
import { chunkArray } from '../../shared/array-utils';
import { isCfdiBelongingToCompany } from '../../shared/xml-utils';
import type { CfdiDocument, Company, Poliza } from '../../shared/types';
import {
  generateAutoPolizaFromCfdiId,
  getCfdiById,
  insertParsedCfdiRecord
} from './cfdi.repo';

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
          const parsed = parseCfdiXmlString(xmlRaw);
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
          createdPolizas.push(generateAutoPolizaFromCfdiId(id, overrides));
        } catch (err) {
          errors.push({ cfdiId: id, error: err instanceof Error ? err.message : String(err) });
        }
      }
    });
    tx();
  }

  return {
    createdPolizas,
    count: createdPolizas.length,
    created: createdPolizas.length,
    skipped,
    failed: errors.length,
    errors
  };
}

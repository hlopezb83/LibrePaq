import type { Database } from 'bun:sqlite';
import {
  getSeedAccountsForPreset,
  type CatalogPreset
} from '../../shared/catalogs/base-accounts.seed';

export function seedAccountsForCompanyOnDb(
  db: Database,
  companyId: string,
  scale = 1,
  preset: CatalogPreset = 'SAT_STANDARD'
): Map<string, string> {
  const insertAcc = db.prepare(`
    INSERT OR IGNORE INTO accounts (
      id, company_id, code, name, parent_code, type, nature, level, is_affectable, sat_group_code, currency, initial_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const codeToId = new Map<string, string>();
  for (const acc of getSeedAccountsForPreset(preset)) {
    const id = `${companyId}_${acc.code}`;
    codeToId.set(acc.code, id);
    insertAcc.run(
      id,
      companyId,
      acc.code,
      acc.name,
      acc.parentCode,
      acc.type,
      acc.nature,
      acc.level,
      acc.isAffectable ? 1 : 0,
      acc.satGroupCode,
      acc.currency,
      Math.round(acc.initialBalance * scale)
    );
  }
  return codeToId;
}

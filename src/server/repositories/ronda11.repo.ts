import { db, mapAccountRow, type AccountDbRow } from '../connection';
import { assertAccountingInvariant } from '../../shared/accounting-engine';
import { computeFinancialStatementsData, type JoinedPolizaMovementInput } from '../../shared/engine/financial-reports.engine';
import type {
  AccountWithBalance,
  BusinessSegment,
  FinancialStatementsResponse,
  PolizaTemplate,
  PolizaTemplateMovement,
  PolizaType
} from '../../shared/types';
import { getCompanyById } from './companies.repo';

export interface Ronda11MovementExtraFields {
  paymentMethodSat?: string | null;
  bankCodeOri?: string | null;
  accountOri?: string | null;
  bankCodeDest?: string | null;
  accountDest?: string | null;
  beneficiaryName?: string | null;
  beneficiaryRfc?: string | null;
  chequeNum?: string | null;
  businessSegmentId?: string | null;
}

const optStr = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function extractRonda11MovementFields(raw: unknown): Ronda11MovementExtraFields {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  return {
    paymentMethodSat: optStr(r.paymentMethodSat),
    bankCodeOri: optStr(r.bankCodeOri),
    accountOri: optStr(r.accountOri),
    bankCodeDest: optStr(r.bankCodeDest),
    accountDest: optStr(r.accountDest),
    beneficiaryName: optStr(r.beneficiaryName),
    beneficiaryRfc: optStr(r.beneficiaryRfc)?.toUpperCase() ?? null,
    chequeNum: optStr(r.chequeNum),
    businessSegmentId: optStr(r.businessSegmentId)
  };
}

function mapTemplateRow(r: Record<string, unknown>): PolizaTemplate {
  let movs: PolizaTemplateMovement[] = [];
  if (typeof r.movements_json === 'string') {
    try {
      movs = JSON.parse(r.movements_json) as PolizaTemplateMovement[];
    } catch {
      movs = [];
    }
  } else if (Array.isArray(r.movements_json)) {
    movs = r.movements_json as PolizaTemplateMovement[];
  }
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    name: String(r.name || ''),
    tipo: String(r.tipo || 'DIARIO') as PolizaType,
    conceptoDefault: String(r.concepto_default || ''),
    movementsJson: movs,
    isActive: Boolean(r.is_active ?? 1),
    createdAt: r.created_at ? String(r.created_at) : undefined,
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  };
}

function mapSegmentRow(r: Record<string, unknown>): BusinessSegment {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    code: String(r.code || ''),
    name: String(r.name || ''),
    parentId: r.parent_id ? String(r.parent_id) : null,
    isActive: Boolean(r.is_active ?? 1),
    createdAt: r.created_at ? String(r.created_at) : undefined,
    updatedAt: r.updated_at ? String(r.updated_at) : undefined
  };
}

export function listPolizaTemplatesRepo(companyId: string): PolizaTemplate[] {
  const rows = db
    .query('SELECT * FROM poliza_templates WHERE company_id = ? AND is_active = 1 ORDER BY name ASC')
    .all(companyId) as Array<Record<string, unknown>>;
  return rows.map(mapTemplateRow);
}

export function createPolizaTemplateRepo(input: {
  companyId: string;
  name: string;
  tipo: PolizaType;
  conceptoDefault: string;
  movementsJson: PolizaTemplateMovement[];
}): PolizaTemplate {
  assertAccountingInvariant(Boolean(input.name?.trim()), 'INVALID_TEMPLATE', 'El nombre de la plantilla es obligatorio.');
  assertAccountingInvariant(Array.isArray(input.movementsJson) && input.movementsJson.length > 0, 'INVALID_TEMPLATE', 'La plantilla debe incluir al menos una partida.');
  const id = `ptpl_${crypto.randomUUID().slice(0, 10)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO poliza_templates (id, company_id, name, tipo, concepto_default, movements_json, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, input.companyId, input.name.trim(), input.tipo, (input.conceptoDefault || '').trim(), JSON.stringify(input.movementsJson), now, now);
  const row = db.query('SELECT * FROM poliza_templates WHERE id = ?').get(id) as Record<string, unknown>;
  return mapTemplateRow(row);
}

export function updatePolizaTemplateRepo(
  id: string,
  companyId: string,
  input: {
    name: string;
    tipo: PolizaType;
    conceptoDefault: string;
    movementsJson: PolizaTemplateMovement[];
  }
): PolizaTemplate | null {
  assertAccountingInvariant(Boolean(input.name?.trim()), 'INVALID_TEMPLATE', 'El nombre de la plantilla es obligatorio.');
  const now = new Date().toISOString();
  const res = db.prepare(`
    UPDATE poliza_templates
    SET name = ?, tipo = ?, concepto_default = ?, movements_json = ?, updated_at = ?
    WHERE id = ? AND company_id = ?
  `).run(input.name.trim(), input.tipo, (input.conceptoDefault || '').trim(), JSON.stringify(input.movementsJson), now, id, companyId);
  if (res.changes === 0) return null;
  const row = db.query('SELECT * FROM poliza_templates WHERE id = ?').get(id) as Record<string, unknown>;
  return mapTemplateRow(row);
}

export function deletePolizaTemplateRepo(id: string, companyId: string): boolean {
  const res = db.prepare('DELETE FROM poliza_templates WHERE id = ? AND company_id = ?').run(id, companyId);
  return res.changes > 0;
}

export function listBusinessSegmentsRepo(companyId: string): BusinessSegment[] {
  const rows = db
    .query('SELECT * FROM business_segments WHERE company_id = ? ORDER BY code ASC')
    .all(companyId) as Array<Record<string, unknown>>;
  return rows.map(mapSegmentRow);
}

export function createBusinessSegmentRepo(input: {
  companyId: string;
  code: string;
  name: string;
  parentId?: string | null;
  isActive?: boolean;
}): BusinessSegment {
  const code = (input.code || '').trim().toUpperCase();
  const name = (input.name || '').trim();
  assertAccountingInvariant(Boolean(code && name), 'INVALID_SEGMENT', 'Código y nombre del segmento son obligatorios.');
  const id = `seg_${crypto.randomUUID().slice(0, 10)}`;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO business_segments (id, company_id, code, name, parent_id, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.companyId, code, name, input.parentId || null, input.isActive ?? true ? 1 : 0, now, now);
  const row = db.query('SELECT * FROM business_segments WHERE id = ?').get(id) as Record<string, unknown>;
  return mapSegmentRow(row);
}

export function updateBusinessSegmentRepo(
  id: string,
  companyId: string,
  input: {
    code: string;
    name: string;
    parentId?: string | null;
    isActive?: boolean;
  }
): BusinessSegment | null {
  const code = (input.code || '').trim().toUpperCase();
  const name = (input.name || '').trim();
  assertAccountingInvariant(Boolean(code && name), 'INVALID_SEGMENT', 'Código y nombre del segmento son obligatorios.');
  const now = new Date().toISOString();
  const res = db.prepare(`
    UPDATE business_segments
    SET code = ?, name = ?, parent_id = ?, is_active = ?, updated_at = ?
    WHERE id = ? AND company_id = ?
  `).run(code, name, input.parentId || null, input.isActive ?? true ? 1 : 0, now, id, companyId);
  if (res.changes === 0) return null;
  const row = db.query('SELECT * FROM business_segments WHERE id = ?').get(id) as Record<string, unknown>;
  return mapSegmentRow(row);
}

export function deleteBusinessSegmentRepo(id: string, companyId: string): boolean {
  db.prepare('UPDATE poliza_movements SET business_segment_id = NULL WHERE business_segment_id = ?').run(id);
  const res = db.prepare('DELETE FROM business_segments WHERE id = ? AND company_id = ?').run(id, companyId);
  return res.changes > 0;
}

export function getSegmentFinancialStatementsRepo(
  companyId: string,
  ejercicio: number,
  periodo: number,
  segmentId: string
): FinancialStatementsResponse | null {
  const company = getCompanyById(companyId);
  if (!company) return null;
  const accRows = db
    .query('SELECT * FROM accounts WHERE company_id = ? ORDER BY code ASC')
    .all(companyId) as AccountDbRow[];
  const accounts: AccountWithBalance[] = accRows.map((r) => {
    const base = mapAccountRow(r);
    return {
      ...base,
      initialBalanceComputed: base.initialBalance,
      periodCharges: 0,
      periodCredits: 0,
      finalBalance: base.initialBalance
    };
  });

  const movRows = db
    .query(`
      SELECT m.account_id, m.cargo, m.abono, m.business_segment_id,
             p.company_id, p.ejercicio, p.periodo, p.origin
      FROM poliza_movements m
      INNER JOIN polizas p ON p.id = m.poliza_id
      WHERE p.company_id = ? AND p.ejercicio <= ? AND m.business_segment_id = ?
    `)
    .all(companyId, ejercicio, segmentId) as Array<{
    account_id: string;
    cargo: number;
    abono: number;
    business_segment_id: string | null;
    company_id: string;
    ejercicio: number;
    periodo: number;
    origin: string | null;
  }>;

  const joined: JoinedPolizaMovementInput[] = movRows.map((m) => ({
    account_id: m.account_id,
    cargo: Number(m.cargo || 0),
    abono: Number(m.abono || 0),
    business_segment_id: m.business_segment_id,
    polizas: { company_id: m.company_id, ejercicio: m.ejercicio, periodo: m.periodo, origin: m.origin }
  }));

  return computeFinancialStatementsData(company, accounts, joined, ejercicio, periodo, {
    businessSegmentId: segmentId
  });
}

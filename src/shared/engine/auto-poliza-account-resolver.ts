import type { Account, CfdiDocument } from '../types';
import type { AccountingRuleRecord } from '../types/accounting-rules.types';
import { FISCAL_ACCOUNT_ROLES, type FiscalAccountRoleKey } from '../sat-constants';
import { assertAccountingInvariant } from './invariants-and-math';

/**
 * NASA Power of 10 - Reglas 8 y 9 (H-02, H-05):
 * Resolución segura de cuentas contables sin usar Non-Null Assertions (`!`).
 */
export function resolveFiscalAccount(
  accounts: readonly Account[],
  roleKey: FiscalAccountRoleKey,
  explicitIdOrCode?: string
): Account {
  assertAccountingInvariant(
    accounts.length > 0,
    'EMPTY_CATALOG',
    'El catálogo de cuentas está vacío para la empresa activa.'
  );

  if (explicitIdOrCode) {
    const explicit = accounts.find(
      (a) => a.id === explicitIdOrCode || a.code === explicitIdOrCode
    );
    if (explicit && explicit.isAffectable) return explicit;
  }

  const role = FISCAL_ACCOUNT_ROLES[roleKey];
  const byExactCode = accounts.find((a) => a.code === role.code && a.isAffectable);
  if (byExactCode) return byExactCode;

  for (const aliasCode of role.aliases) {
    const byAlias = accounts.find((a) => a.code === aliasCode && a.isAffectable);
    if (byAlias) return byAlias;
  }

  const bySatCode = accounts.find(
    (a) => a.isAffectable && a.satGroupCode === role.satGroupCode
  );
  if (bySatCode) return bySatCode;

  const byFallbackType = accounts.find(
    (a) => a.isAffectable && a.type === role.fallbackType
  );
  if (byFallbackType) return byFallbackType;

  const firstAffectable = accounts.find((a) => a.isAffectable) ?? accounts[0];
  assertAccountingInvariant(
    firstAffectable !== undefined,
    'ACCOUNT_NOT_FOUND',
    `No se encontró cuenta contable para el rol ${roleKey} (${role.code}).`
  );
  return firstAffectable;
}

/**
 * Resuelve la cuenta de Gastos No Deducibles (801-01-001 / rol GASTO_NO_DEDUCIBLE o fallback 801).
 */
export function resolveNonDeductibleAccount(accounts: readonly Account[]): Account {
  assertAccountingInvariant(
    accounts.length > 0,
    'EMPTY_CATALOG',
    'El catálogo de cuentas está vacío para la empresa activa.'
  );

  const roles = FISCAL_ACCOUNT_ROLES as Record<
    string,
    { code: string; aliases: readonly string[]; satGroupCode: string; fallbackType: Account['type'] }
  >;
  const role = roles['GASTO_NO_DEDUCIBLE'];
  if (role) {
    const byRole = accounts.find((a) => a.code === role.code && a.isAffectable);
    if (byRole) return byRole;
  }

  const by801Exact = accounts.find((a) => a.code === '801-01-001' && a.isAffectable);
  if (by801Exact) return by801Exact;

  const by801Prefix = accounts.find(
    (a) => (a.code === '801' || a.code.startsWith('801-')) && a.isAffectable
  );
  if (by801Prefix) return by801Prefix;

  return resolveFiscalAccount(accounts, 'GASTO_IMPUESTO_UTILIDAD');
}

/**
 * Selecciona automáticamente la cuenta de gasto/costo más adecuada según el concepto del CFDI.
 */
export function inferExpenseAccountForCfdi(
  cfdi: Pick<CfdiDocument, 'conceptoPrincipal' | 'emisorNombre'>,
  accounts: readonly Account[],
  explicitIdOrCode?: string
): Account {
  if (explicitIdOrCode) {
    const found = accounts.find(
      (a) => (a.id === explicitIdOrCode || a.code === explicitIdOrCode) && a.isAffectable
    );
    if (found) return found;
  }
  const text = `${cfdi.conceptoPrincipal} ${cfdi.emisorNombre}`.toLowerCase();
  if (text.includes('arrendamiento') || text.includes('renta') || text.includes('inmobiliaria')) {
    return resolveFiscalAccount(accounts, 'ARRENDAMIENTO');
  }
  if (text.includes('fibra') || text.includes('internet') || text.includes('telmex') || text.includes('telecom')) {
    return resolveFiscalAccount(accounts, 'TELECOMUNICACIONES');
  }
  if (text.includes('cloud') || text.includes('aws') || text.includes('servidor')) {
    return resolveFiscalAccount(accounts, 'COSTO_CLOUD_SERVIDORES');
  }
  if (text.includes('nómina') || text.includes('sueldo')) {
    return resolveFiscalAccount(accounts, 'SUELDOS_Y_SALARIOS');
  }
  return resolveFiscalAccount(accounts, 'HONORARIOS_SERVICIOS');
}

/**
 * Selecciona la regla contable aprendida de mayor especificidad y prioridad para un CFDI.
 * Precedencia: matchRfc (40) > matchClaveProdServ (20, +5 exacto) > matchUsoCfdi (10), luego priority DESC.
 */
export function resolveMatchingAccountingRule(
  cfdi: Pick<CfdiDocument, 'direction' | 'emisorRfc' | 'receptorRfc' | 'claveProdServ' | 'usoCfdi'>,
  rules?: readonly AccountingRuleRecord[] | null
): AccountingRuleRecord | null {
  if (!rules || rules.length === 0) return null;

  const counterpartyRfc = (
    cfdi.direction === 'RECIBIDO' ? cfdi.emisorRfc : cfdi.receptorRfc
  )
    .trim()
    .toUpperCase();
  const cfdiClave = (cfdi.claveProdServ || '').trim().toUpperCase();
  const cfdiUso = (cfdi.usoCfdi || '').trim().toUpperCase();

  let bestRule: AccountingRuleRecord | null = null;
  let bestScore = -1;

  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (!rule || rule.direction !== cfdi.direction) continue;

    const ruleRfc = rule.matchRfc?.trim().toUpperCase() || '';
    const ruleClave = rule.matchClaveProdServ?.trim().toUpperCase() || '';
    const ruleUso = rule.matchUsoCfdi?.trim().toUpperCase() || '';
    if (!ruleRfc && !ruleClave && !ruleUso) continue;

    if (ruleRfc && ruleRfc !== counterpartyRfc) continue;
    let exactClave = false;
    if (ruleClave) {
      if (cfdiClave === ruleClave) {
        exactClave = true;
      } else if (!(ruleClave.length >= 4 && cfdiClave.startsWith(ruleClave))) {
        continue;
      }
    }
    if (ruleUso && ruleUso !== cfdiUso) continue;

    const specificity =
      (ruleRfc ? 40 : 0) + (ruleClave ? (exactClave ? 25 : 20) : 0) + (ruleUso ? 10 : 0);

    if (
      bestRule === null ||
      specificity > bestScore ||
      (specificity === bestScore && rule.priority > bestRule.priority) ||
      (specificity === bestScore &&
        rule.priority === bestRule.priority &&
        rule.updatedAt > bestRule.updatedAt)
    ) {
      bestRule = rule;
      bestScore = specificity;
    }
  }

  return bestRule;
}

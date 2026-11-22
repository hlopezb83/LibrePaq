import type { Account, CfdiDocument } from '../types';
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

import type { Account } from '../types';
import { BASE_ACCOUNTS_ACTIVO } from './base-accounts-activo.seed';
import { BASE_ACCOUNTS_PASIVO_CAPITAL } from './base-accounts-pasivo-capital.seed';
import { BASE_ACCOUNTS_RESULTADOS } from './base-accounts-resultados.seed';

export type CatalogPreset = 'SAT_STANDARD' | 'RESICO_SIMPLIFIED' | 'CUSTOM';

export const BASE_COMPANY_ACCOUNTS: ReadonlyArray<Omit<Account, 'id' | 'companyId'>> = [
  ...BASE_ACCOUNTS_ACTIVO,
  ...BASE_ACCOUNTS_PASIVO_CAPITAL,
  ...BASE_ACCOUNTS_RESULTADOS
];

export function getSeedAccountsForPreset(
  preset: CatalogPreset = 'SAT_STANDARD'
): ReadonlyArray<Omit<Account, 'id' | 'companyId'>> {
  if (preset === 'RESICO_SIMPLIFIED') {
    return [
      ...BASE_COMPANY_ACCOUNTS.filter(
        (a) => a.code !== '105-01-001' && a.code !== '105-01-002'
      ).map((a) =>
        a.code === '401-01-001'
          ? { ...a, name: 'Ingresos Efectivamente Cobrados RESICO Tasa 16%' }
          : a
      ),
      {
        code: '401-01-003',
        name: 'Ingresos Efectivamente Cobrados Tasa 0% / Exentos RESICO',
        parentCode: '401-00-000',
        type: 'INGRESOS',
        nature: 'ACREEDORA',
        level: 3,
        isAffectable: true,
        satGroupCode: '401.04',
        currency: 'MXN',
        initialBalance: 0
      }
    ];
  }
  if (preset === 'CUSTOM') {
    return BASE_COMPANY_ACCOUNTS.filter(
      (a) =>
        a.code !== '102-01-002' &&
        a.code !== '105-01-001' &&
        a.code !== '105-01-002' &&
        a.code !== '201-01-001' &&
        a.code !== '201-01-002'
    );
  }
  return BASE_COMPANY_ACCOUNTS;
}

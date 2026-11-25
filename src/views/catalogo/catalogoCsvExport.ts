import type { QueryClient } from '@tanstack/react-query';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { downloadCsvFile } from '../../lib/formatters';
import type { AccountWithBalance } from '../../shared/types';
import type { ParsedCatalogoCsvRow } from './catalogoCsvIo';

export function downloadCatalogoTemplateCsv() {
  const headers = [
    'Código Cuenta',
    'Nombre de la Cuenta',
    'Código Agrupador SAT',
    'Rubro',
    'Naturaleza',
    'Nivel',
    'Afectable',
    'Saldo Inicial',
    'Cuenta Padre'
  ];
  const rows = [
    ['601-00-000', 'Gastos Generales', '601.01', 'GASTOS', 'DEUDORA', 2, 'No', 0, '600-00-000'],
    ['601-01-099', 'Gastos de Publicidad Digital', '601.84', 'GASTOS', 'DEUDORA', 3, 'Sí', 0, '601-00-000']
  ];
  downloadCsvFile('Plantilla_Catalogo_Cuentas_SAT.csv', headers, rows);
}

export function exportCatalogoCsv(
  accounts: AccountWithBalance[],
  rfcOrId: string,
  year?: number,
  period?: number
) {
  const headers = [
    'Código Cuenta',
    'Nombre de la Cuenta',
    'Código Agrupador SAT',
    'Rubro',
    'Naturaleza',
    'Nivel',
    'Afectable',
    'Saldo Inicial Acumulado',
    'Saldo Apertura Enero',
    'Cargos del Periodo',
    'Abonos del Periodo',
    'Saldo Final',
    'Cuenta Padre'
  ];
  const rows = accounts.map((a) => [
    a.code,
    a.name,
    a.satGroupCode,
    a.type,
    a.nature,
    a.level,
    a.isAffectable ? 'Sí' : 'No',
    a.initialBalanceComputed,
    a.initialBalance,
    a.periodCharges,
    a.periodCredits,
    a.finalBalance,
    a.parentCode || ''
  ]);
  const pStr = period ? `_P${String(period).padStart(2, '0')}` : '';
  downloadCsvFile(
    `Catalogo_Cuentas_${rfcOrId}_${year || 2026}${pStr}.csv`,
    headers,
    rows
  );
}

export async function confirmImportCatalogoRows(
  parsedRows: ParsedCatalogoCsvRow[],
  companyId: string,
  queryClient: QueryClient,
  toast: { success: (title: string, desc?: string) => void; error: (title: string, desc?: string) => void },
  opts?: { replaceBaseCatalog?: boolean; existingAccounts?: AccountWithBalance[] }
) {
  if (parsedRows.length === 0) {
    toast.error(
      'Importación fallida',
      'No se detectaron cuentas válidas (ej. XXX-XX-XXX o XXXX-XXX-XXXX) en el archivo CSV.'
    );
    return;
  }

  if (opts?.replaceBaseCatalog && opts.existingAccounts && opts.existingAccounts.length > 0) {
    const sortedDesc = [...opts.existingAccounts].sort((a, b) => b.level - a.level);
    const levels = Array.from(new Set(sortedDesc.map((a) => a.level))).sort((a, b) => b - a);
    for (const lvl of levels) {
      const wave = sortedDesc.filter((a) => a.level === lvl);
      for (const acc of wave) {
        if (Math.abs(acc.initialBalance || 0) >= 0.01) {
          await apiClient.updateAccount(acc.id, {
            name: acc.name,
            satGroupCode: acc.satGroupCode,
            type: acc.type,
            nature: acc.nature,
            initialBalance: 0
          });
        }
        await apiClient.deleteAccount(acc.id);
      }
    }
  }

  const res = await apiClient.batchImportAccounts(companyId, parsedRows);
  invalidateAccountingQueries(queryClient, ['accounts', 'reports', 'dashboard']);
  toast.success(
    'Catálogo Importado',
    `${opts?.replaceBaseCatalog ? 'Catálogo base reemplazado. ' : ''}Importación completada: ${res.importedCount} cuentas creadas (${res.updatedCount} actualizadas).`
  );
}

import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { downloadCsvFile } from '../../lib/formatters';
import { splitCsvLine } from '../../shared/csv-bank-parser';
import type { AccountType, AccountWithBalance } from '../../shared/types';
import type { QueryClient } from '@tanstack/react-query';

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
    'Cargos del Periodo',
    'Abonos del Periodo',
    'Saldo Final'
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
    a.periodCharges,
    a.periodCredits,
    a.finalBalance
  ]);
  const pStr = period ? `_P${String(period).padStart(2, '0')}` : '';
  downloadCsvFile(
    `Catalogo_Cuentas_${rfcOrId}_${year || 2026}${pStr}.csv`,
    headers,
    rows
  );
}

export async function importCatalogoCsvFile(
  file: File,
  companyId: string,
  queryClient: QueryClient,
  toast: { success: (title: string, desc?: string) => void; error: (title: string, desc?: string) => void }
) {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parsedRows: Array<{
    code: string;
    name: string;
    satGroupCode?: string;
    type?: AccountType;
    nature?: 'DEUDORA' | 'ACREEDORA';
    initialBalance?: number;
  }> = [];

  for (const line of lines) {
    const cols = splitCsvLine(line);
    const rawInput = (cols[0] ?? '').trim();
    const rawCode = /^\d{8}$/.test(rawInput)
      ? `${rawInput.slice(0, 3)}-${rawInput.slice(3, 5)}-${rawInput.slice(5, 8)}`
      : rawInput;
    const rawName = cols[1] ?? '';
    if (!/^\d{3}-\d{2}-\d{3}$/.test(rawCode) || !rawName) continue;
    const rawSat = cols[2] || undefined;
    const rawType = cols[3] as AccountType | undefined;
    const rawNat = cols[4] === 'ACREEDORA' ? 'ACREEDORA' : 'DEUDORA';
    const rawBal = Number(cols[7] ?? cols[5] ?? 0);
    parsedRows.push({
      code: rawCode,
      name: rawName,
      satGroupCode: rawSat,
      type: rawType,
      nature: rawNat,
      initialBalance: Number.isFinite(rawBal) ? rawBal : 0
    });
  }

  if (parsedRows.length === 0) {
    toast.error(
      'Importación fallida',
      'No se detectaron cuentas con formato XXX-XX-XXX en el archivo CSV.'
    );
    return;
  }

  const res = await apiClient.batchImportAccounts(companyId, parsedRows);
  invalidateAccountingQueries(queryClient, ['accounts', 'reports', 'dashboard']);
  toast.success(
    'Catálogo Importado',
    `Importación completada: ${res.importedCount} cuentas creadas (${res.updatedCount} actualizadas).`
  );
}

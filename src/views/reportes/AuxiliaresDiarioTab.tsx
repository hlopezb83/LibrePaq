import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BookText, Download, FileSpreadsheet, Loader2, Printer, RefreshCw } from 'lucide-react';
import { AccountPickerCombobox } from '../../components/account-picker/AccountPickerCombobox';
import { Button, EmptyState, FormField, LABEL_CLASS, Select, TabBar, type TabBarItem } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { fromCents, sumCents } from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-constants';
import type { AccountWithBalance, Company, Poliza } from '../../shared/types';
import {
  buildAuxiliarAccountBlocks,
  exportAuxiliaresRangeXlsx,
  exportDiarioGeneralXlsx,
  printDiarioOrAuxiliarReport
} from './auxiliaresDiarioExport';
import { AuxiliaresAccountBlocks, DiarioGeneralTable } from './AuxiliaresDiarioTables';

interface AuxiliaresDiarioTabProps {
  company: Company;
  ejercicio: number;
  periodo: number;
  trialBalance: AccountWithBalance[];
  onSelectAccount: (accountId: string) => void;
}

const BOOK_MODES: ReadonlyArray<TabBarItem<'DIARIO' | 'AUXILIAR'>> = [
  { id: 'DIARIO', label: 'Diario General', icon: <BookText className="w-3.5 h-3.5" aria-hidden="true" /> },
  { id: 'AUXILIAR', label: 'Auxiliar por Rango de Cuentas', icon: <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" /> }
];

export function AuxiliaresDiarioTab({
  company,
  ejercicio,
  periodo,
  trialBalance,
  onSelectAccount
}: AuxiliaresDiarioTabProps) {
  const toast = useToast();
  const affectableAccounts = useMemo(
    () => [...trialBalance].filter((a) => a.isAffectable).sort((a, b) => a.code.localeCompare(b.code)),
    [trialBalance]
  );

  const [mode, setMode] = useState<'DIARIO' | 'AUXILIAR'>('DIARIO');
  const [periodFrom, setPeriodFrom] = useState<number>(periodo || 1);
  const [periodTo, setPeriodTo] = useState<number>(periodo || 1);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [codeFrom, setCodeFrom] = useState<string>(() => affectableAccounts[0]?.code ?? '101-01-001');
  const [codeTo, setCodeTo] = useState<string>(
    () => affectableAccounts[affectableAccounts.length - 1]?.code ?? '801-01-002'
  );
  const [onlyWithActivity, setOnlyWithActivity] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const p = periodo || 1;
    setPeriodFrom(p);
    setPeriodTo(p);
    setDateFrom('');
    setDateTo('');
  }, [company.id, ejercicio, periodo]);

  useEffect(() => {
    const firstCode = affectableAccounts[0]?.code;
    const lastCode = affectableAccounts[affectableAccounts.length - 1]?.code;
    if (firstCode && !affectableAccounts.some((a) => a.code === codeFrom)) {
      setCodeFrom(firstCode);
    }
    if (lastCode && !affectableAccounts.some((a) => a.code === codeTo)) {
      setCodeTo(lastCode);
    }
  }, [company.id, affectableAccounts, codeFrom, codeTo]);

  const effectiveFrom = Math.min(periodFrom, periodTo);
  const effectiveTo = Math.max(periodFrom, periodTo);

  const { data: rangeData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['auxiliares-diario', company.id, ejercicio, effectiveFrom, effectiveTo],
    queryFn: async () => {
      const periods: number[] = [];
      for (let p = effectiveFrom; p <= effectiveTo; p += 1) periods.push(p);
      const [startReport, ...polizaLists] = await Promise.all([
        apiClient.getReports(company.id, ejercicio, effectiveFrom),
        ...periods.map((p) => apiClient.getPolizas(company.id, ejercicio, p))
      ]);
      const polizas: Poliza[] = polizaLists
        .flat()
        .sort(
          (a, b) =>
            a.periodo - b.periodo ||
            a.fecha.localeCompare(b.fecha) ||
            a.folio - b.folio ||
            a.id.localeCompare(b.id)
        );
      return { startAccounts: startReport.trialBalance, polizas };
    },
    enabled: Boolean(company.id)
  });

  const rawPolizas = rangeData?.polizas ?? [];
  const polizas = useMemo(() => {
    if (!dateFrom && !dateTo) return rawPolizas;
    return rawPolizas.filter((p) => {
      const f = p.fecha.slice(0, 10);
      if (dateFrom && f < dateFrom) return false;
      if (dateTo && f > dateTo) return false;
      return true;
    });
  }, [rawPolizas, dateFrom, dateTo]);
  const startAccounts = rangeData?.startAccounts ?? trialBalance;

  const diarioTotals = useMemo(
    () => ({
      cargos: fromCents(sumCents(polizas.map((p) => p.totalCargos))),
      abonos: fromCents(sumCents(polizas.map((p) => p.totalAbonos)))
    }),
    [polizas]
  );

  const auxiliarBlocks = useMemo(
    () =>
      buildAuxiliarAccountBlocks({
        accountsStart: startAccounts,
        polizas,
        codeFrom,
        codeTo,
        onlyWithActivity
      }),
    [startAccounts, polizas, codeFrom, codeTo, onlyWithActivity]
  );

  const accountFromId = useMemo(
    () => affectableAccounts.find((a) => a.code === codeFrom)?.id ?? '',
    [affectableAccounts, codeFrom]
  );
  const accountToId = useMemo(
    () => affectableAccounts.find((a) => a.code === codeTo)?.id ?? '',
    [affectableAccounts, codeTo]
  );

  const hasContent = mode === 'DIARIO' ? polizas.length > 0 : auxiliarBlocks.length > 0;
  const emptyExportTitle =
    mode === 'DIARIO'
      ? 'No hay pólizas en el rango seleccionado para exportar'
      : 'No hay movimientos auxiliares en el rango seleccionado para exportar';

  const handleExportXlsx = async () => {
    if (!hasContent) return;
    setIsExporting(true);
    try {
      if (mode === 'DIARIO') {
        await exportDiarioGeneralXlsx({ company, ejercicio, periodFrom: effectiveFrom, periodTo: effectiveTo, polizas });
      } else {
        await exportAuxiliaresRangeXlsx({ company, ejercicio, periodFrom: effectiveFrom, periodTo: effectiveTo, blocks: auxiliarBlocks });
      }
      toast.success('Archivo Excel (.XLSX) descargado');
    } catch {
      toast.error('No se pudo exportar a Excel (.XLSX)');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (!hasContent) return;
    const ok = printDiarioOrAuxiliarReport({
      mode,
      company,
      ejercicio,
      effectiveFrom,
      effectiveTo,
      codeFrom,
      codeTo,
      polizas,
      diarioTotals,
      auxiliarBlocks
    });
    if (!ok) toast.error('Permite ventanas emergentes para imprimir.');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabBar
            mode="group"
            tabs={BOOK_MODES}
            activeId={mode}
            onSelect={setMode}
            idPrefix="aux-mode-"
            ariaLabel="Modo de libro contable"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="export"
              size="sm"
              loading={isExporting}
              disabled={isLoading || !hasContent}
              title={!hasContent ? emptyExportTitle : 'Exportar reporte a Excel (.xlsx)'}
              onClick={() => void handleExportXlsx()}
              leftIcon={
                isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                )
              }
            >
              Excel (.XLSX)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={isLoading || !hasContent}
              title={!hasContent ? emptyExportTitle : 'Imprimir o guardar como PDF'}
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Imprimir / PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-200 items-end">
          <FormField label="Periodo Desde" htmlFor="aux-period-from">
            <Select id="aux-period-from" size="sm" value={periodFrom} onChange={(e) => setPeriodFrom(Number(e.target.value))} className="font-mono">
              {MESES_SAT.map((m) => (
                <option key={m.periodo} value={m.periodo}>P{String(m.periodo).padStart(2, '0')} - {m.nombre}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Periodo Hasta" htmlFor="aux-period-to">
            <Select id="aux-period-to" size="sm" value={periodTo} onChange={(e) => setPeriodTo(Number(e.target.value))} className="font-mono">
              {MESES_SAT.map((m) => (
                <option key={m.periodo} value={m.periodo}>P{String(m.periodo).padStart(2, '0')} - {m.nombre}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Fecha Desde (Opcional)" htmlFor="aux-date-from">
            <input id="aux-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900" />
          </FormField>

          <FormField label="Fecha Hasta (Opcional)" htmlFor="aux-date-to">
            <div className="flex items-center gap-1.5">
              <input id="aux-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900" />
              {(dateFrom || dateTo) && (
                <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-[11px] font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer">Limpiar</button>
              )}
            </div>
          </FormField>

          {mode === 'AUXILIAR' && (
            <>
              <div>
                <span className={LABEL_CLASS}>Cuenta Desde</span>
                <AccountPickerCombobox
                  accounts={affectableAccounts}
                  value={accountFromId}
                  onChange={(accountId) => { const f = affectableAccounts.find((a) => a.id === accountId); if (f) setCodeFrom(f.code); }}
                  ariaLabel="Cuenta Desde"
                  placeholder="Buscar cuenta inicial..."
                />
              </div>
              <div>
                <span className={LABEL_CLASS}>Cuenta Hasta</span>
                <AccountPickerCombobox
                  accounts={affectableAccounts}
                  value={accountToId}
                  onChange={(accountId) => { const f = affectableAccounts.find((a) => a.id === accountId); if (f) setCodeTo(f.code); }}
                  ariaLabel="Cuenta Hasta"
                  placeholder="Buscar cuenta final..."
                />
              </div>
              <label htmlFor="aux-only-activity" className="flex items-center gap-2 pb-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input id="aux-only-activity" type="checkbox" checked={onlyWithActivity} onChange={(e) => setOnlyWithActivity(e.target.checked)} className="rounded border-slate-300 text-blue-700" />
                <span>Solo cuentas con saldo o movimiento</span>
              </label>
            </>
          )}
        </div>
      </div>

      {isError ? (
        <div role="alert">
          <EmptyState
            variant="card"
            tone="red"
            icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
            title="Error al consultar Diario General y Auxiliares"
            description={error instanceof Error ? error.message : 'Error de conexión con el servidor contable.'}
            actions={<Button variant="primary" size="sm" onClick={() => void refetch()} leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}>Reintentar</Button>}
          />
        </div>
      ) : isLoading ? (
        <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700" aria-hidden="true" />
          <span>Generando reporte contable del rango seleccionado...</span>
        </div>
      ) : mode === 'DIARIO' ? (
        <DiarioGeneralTable polizas={polizas} diarioTotals={diarioTotals} onSelectAccount={onSelectAccount} />
      ) : (
        <AuxiliaresAccountBlocks auxiliarBlocks={auxiliarBlocks} onSelectAccount={onSelectAccount} />
      )}
    </div>
  );
}

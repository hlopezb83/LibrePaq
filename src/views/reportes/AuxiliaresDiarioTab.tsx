import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BookText, Download, FileSpreadsheet, Loader2, Printer, RefreshCw } from 'lucide-react';
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

  const polizas = rangeData?.polizas ?? [];
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
          <div role="group" aria-label="Modo de libro contable" className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              type="button"
              aria-pressed={mode === 'DIARIO'}
              onClick={() => setMode('DIARIO')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                mode === 'DIARIO' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <BookText className="w-3.5 h-3.5" aria-hidden="true" />
              Diario General
            </button>
            <button
              type="button"
              aria-pressed={mode === 'AUXILIAR'}
              onClick={() => setMode('AUXILIAR')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                mode === 'AUXILIAR' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              Auxiliar por Rango de Cuentas
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              disabled={isLoading || isExporting || !hasContent}
              title={!hasContent ? emptyExportTitle : 'Exportar reporte a Excel (.xlsx)'}
              onClick={() => void handleExportXlsx()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
              Excel (.XLSX)
            </button>
            <button
              type="button"
              disabled={isLoading || !hasContent}
              title={!hasContent ? emptyExportTitle : 'Imprimir o guardar como PDF'}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              Imprimir / PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs pt-2 border-t border-slate-200">
          <div>
            <label htmlFor="aux-period-from" className="block font-semibold text-slate-700 mb-1">Periodo Desde</label>
            <select id="aux-period-from" value={periodFrom} onChange={(e) => setPeriodFrom(Number(e.target.value))} className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-mono">
              {MESES_SAT.map((m) => <option key={m.periodo} value={m.periodo}>P{String(m.periodo).padStart(2, '0')} - {m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="aux-period-to" className="block font-semibold text-slate-700 mb-1">Periodo Hasta</label>
            <select id="aux-period-to" value={periodTo} onChange={(e) => setPeriodTo(Number(e.target.value))} className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-mono">
              {MESES_SAT.map((m) => <option key={m.periodo} value={m.periodo}>P{String(m.periodo).padStart(2, '0')} - {m.nombre}</option>)}
            </select>
          </div>
          {mode === 'AUXILIAR' && (
            <>
              <div>
                <label htmlFor="aux-code-from" className="block font-semibold text-slate-700 mb-1">Cuenta Desde</label>
                <select id="aux-code-from" value={codeFrom} onChange={(e) => setCodeFrom(e.target.value)} className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-mono">
                  {affectableAccounts.map((a) => <option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="aux-code-to" className="block font-semibold text-slate-700 mb-1">Cuenta Hasta</label>
                <select id="aux-code-to" value={codeTo} onChange={(e) => setCodeTo(e.target.value)} className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white font-mono">
                  {affectableAccounts.map((a) => <option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <label htmlFor="aux-only-activity" className="flex items-center gap-2 self-end pb-1.5 font-semibold text-slate-700 cursor-pointer">
                <input id="aux-only-activity" type="checkbox" checked={onlyWithActivity} onChange={(e) => setOnlyWithActivity(e.target.checked)} className="rounded border-slate-300" />
                Solo cuentas con saldo o movimiento
              </label>
            </>
          )}
        </div>
      </div>

      {isError ? (
        <div role="alert" className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3 shadow-2xs">
          <AlertCircle className="w-7 h-7 text-red-600 mx-auto" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">Error al consultar Diario General y Auxiliares</p>
          <p className="text-xs text-slate-600">{error instanceof Error ? error.message : 'Error de conexión con el servidor contable.'}</p>
          <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Reintentar
          </button>
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

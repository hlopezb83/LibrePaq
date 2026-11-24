import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookText, Download, FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import { fromCents, sumCents } from '../../shared/accounting-engine';
import { MESES_SAT } from '../../shared/sat-constants';
import type { AccountWithBalance, Company, Poliza } from '../../shared/types';
import {
  buildAuxiliarAccountBlocks,
  exportAuxiliaresRangeXlsx,
  exportDiarioGeneralXlsx,
  printReportHtmlDocument
} from './auxiliaresDiarioExport';

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

  const effectiveFrom = Math.min(periodFrom, periodTo);
  const effectiveTo = Math.max(periodFrom, periodTo);

  const { data: rangeData, isLoading } = useQuery({
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
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.folio - b.folio || a.id.localeCompare(b.id));
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

  const handleExportXlsx = async () => {
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
    const pLabel = `P${String(effectiveFrom).padStart(2, '0')} a P${String(effectiveTo).padStart(2, '0')} · Ejercicio ${ejercicio}`;
    if (mode === 'DIARIO') {
      const rowsHtml = polizas
        .flatMap((p) =>
          p.movements.map(
            (m) =>
              `<tr><td class="mono">${p.fecha}</td><td class="mono">${p.tipo} #${p.folio}</td><td class="mono">${m.accountCode}</td><td>${m.accountName}</td><td>${m.concepto || p.concepto}</td><td class="right">${m.cargo > 0 ? formatCurrency(m.cargo) : '—'}</td><td class="right">${m.abono > 0 ? formatCurrency(m.abono) : '—'}</td></tr>`
          )
        )
        .join('');
      const ok = printReportHtmlDocument(
        `Diario General — ${company.name} (${company.rfc})`,
        pLabel,
        `<table><thead><tr><th>Fecha</th><th>Póliza</th><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th class="right">Cargo</th><th class="right">Abono</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr><td colspan="5" class="right">SUMAS IGUALES:</td><td class="right">${formatCurrency(diarioTotals.cargos)}</td><td class="right">${formatCurrency(diarioTotals.abonos)}</td></tr></tfoot></table>`
      );
      if (!ok) toast.error('Permite ventanas emergentes para imprimir.');
      return;
    }

    const bodyHtml = auxiliarBlocks
      .map(
        (b) =>
          `<table><thead><tr><th colspan="6">${b.account.code} — ${b.account.name} (Saldo Inicial: ${formatCurrency(b.initialBalance)})</th></tr><tr><th>Fecha</th><th>Póliza</th><th>Referencia</th><th>Concepto</th><th class="right">Cargo</th><th class="right">Abono / Saldo: ${formatCurrency(b.finalBalance)}</th></tr></thead><tbody>${b.entries
            .map(
              (e) =>
                `<tr><td class="mono">${e.fecha}</td><td class="mono">${e.tipoPoliza} #${e.folioPoliza}</td><td class="mono">${e.referencia}</td><td>${e.concepto}</td><td class="right">${e.cargo > 0 ? formatCurrency(e.cargo) : '—'}</td><td class="right">${e.abono > 0 ? formatCurrency(e.abono) : '—'} (${formatCurrency(e.runningBalance)})</td></tr>`
            )
            .join('')}</tbody><tfoot><tr><td colspan="4" class="right">Totales ${b.account.code}:</td><td class="right">${formatCurrency(b.totalCharges)}</td><td class="right">${formatCurrency(b.totalCredits)} · Final: ${formatCurrency(b.finalBalance)}</td></tr></tfoot></table>`
      )
      .join('');
    const ok = printReportHtmlDocument(
      `Auxiliar de Movimientos — ${company.name} (${company.rfc})`,
      `${pLabel} · Cuentas ${codeFrom} a ${codeTo}`,
      bodyHtml
    );
    if (!ok) toast.error('Permite ventanas emergentes para imprimir.');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setMode('DIARIO')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                mode === 'DIARIO' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookText className="w-3.5 h-3.5" aria-hidden="true" />
              Diario General
            </button>
            <button
              type="button"
              onClick={() => setMode('AUXILIAR')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                mode === 'AUXILIAR' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
              Auxiliar por Rango de Cuentas
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              disabled={isLoading || isExporting}
              onClick={() => void handleExportXlsx()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
              Excel (.XLSX)
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold disabled:opacity-50 cursor-pointer"
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
              <label className="flex items-center gap-2 self-end pb-1.5 font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={onlyWithActivity} onChange={(e) => setOnlyWithActivity(e.target.checked)} className="rounded border-slate-300" />
                Solo cuentas con saldo o movimiento
              </label>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700" aria-hidden="true" />
          <span>Generando reporte contable del rango seleccionado...</span>
        </div>
      ) : mode === 'DIARIO' ? (
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase text-slate-600">
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Póliza</th>
                <th className="py-2.5 px-3">Cuenta</th>
                <th className="py-2.5 px-3">Nombre</th>
                <th className="py-2.5 px-3">Concepto</th>
                <th className="py-2.5 px-3 text-right">Cargo</th>
                <th className="py-2.5 px-3 text-right">Abono</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {polizas.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">Sin pólizas registradas en el rango de periodos.</td></tr>
              ) : (
                polizas.flatMap((p) =>
                  p.movements.map((m) => (
                    <tr key={m.id} className="hover:bg-blue-50/30">
                      <td className="py-2 px-3 font-mono whitespace-nowrap">{formatShortDate(p.fecha)}</td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-900 whitespace-nowrap">{p.tipo} #{p.folio}</td>
                      <td className="py-2 px-3 font-mono">
                        <button type="button" onClick={() => onSelectAccount(m.accountId)} className="text-blue-800 hover:underline font-bold cursor-pointer">
                          {m.accountCode}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-slate-800">{m.accountName}</td>
                      <td className="py-2 px-3 text-slate-600">{m.concepto || p.concepto}</td>
                      <td className="py-2 px-3 text-right font-mono">{m.cargo > 0 ? formatCurrency(m.cargo) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono">{m.abono > 0 ? formatCurrency(m.abono) : '—'}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
            <tfoot className="bg-[#0A1120] text-white font-mono font-bold">
              <tr>
                <td colSpan={5} className="py-2.5 px-3 text-right uppercase">Sumas Iguales ({polizas.length} pólizas):</td>
                <td className="py-2.5 px-3 text-right text-cyan-300">{formatCurrency(diarioTotals.cargos)}</td>
                <td className="py-2.5 px-3 text-right text-cyan-300">{formatCurrency(diarioTotals.abonos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {auxiliarBlocks.length === 0 ? (
            <div className="p-8 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-500">
              No se encontraron cuentas con saldo o movimiento en el rango seleccionado.
            </div>
          ) : (
            auxiliarBlocks.map((b) => (
              <div key={b.account.id} className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-x-auto">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button type="button" onClick={() => onSelectAccount(b.account.id)} className="font-bold text-blue-900 hover:underline cursor-pointer">
                    <span className="font-mono mr-1.5">{b.account.code}</span>{b.account.name}
                  </button>
                  <div className="font-mono flex flex-wrap gap-3 text-[11px]">
                    <span>Inicial: <strong>{formatCurrency(b.initialBalance)}</strong></span>
                    <span>Cargos: <strong>{formatCurrency(b.totalCharges)}</strong></span>
                    <span>Abonos: <strong>{formatCurrency(b.totalCredits)}</strong></span>
                    <span className="text-blue-900">Final: <strong>{formatCurrency(b.finalBalance)}</strong></span>
                  </div>
                </div>
                {b.entries.length > 0 && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                        <th className="py-1.5 px-3">Fecha</th>
                        <th className="py-1.5 px-3">Póliza</th>
                        <th className="py-1.5 px-3">Referencia</th>
                        <th className="py-1.5 px-3">Concepto</th>
                        <th className="py-1.5 px-3 text-right">Cargo</th>
                        <th className="py-1.5 px-3 text-right">Abono</th>
                        <th className="py-1.5 px-3 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {b.entries.map((e) => (
                        <tr key={e.movementId} className="hover:bg-blue-50/30">
                          <td className="py-1.5 px-3 font-mono whitespace-nowrap">{formatShortDate(e.fecha)}</td>
                          <td className="py-1.5 px-3 font-mono font-semibold text-blue-900 whitespace-nowrap">{e.tipoPoliza} #{e.folioPoliza}</td>
                          <td className="py-1.5 px-3 font-mono text-slate-600">{e.referencia}</td>
                          <td className="py-1.5 px-3 text-slate-700">{e.concepto}</td>
                          <td className="py-1.5 px-3 text-right font-mono">{e.cargo > 0 ? formatCurrency(e.cargo) : '—'}</td>
                          <td className="py-1.5 px-3 text-right font-mono">{e.abono > 0 ? formatCurrency(e.abono) : '—'}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold">{formatCurrency(e.runningBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

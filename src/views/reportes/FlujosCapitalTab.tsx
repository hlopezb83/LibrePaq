import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Download, Layers, TrendingUp } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';
import { exportExtendedStatementsXlsx } from '../../lib/excel-export';
import { formatCurrency } from '../../lib/formatters';
import { computeExtendedFinancialStatements } from '../../shared/engine/extended-statements.engine';
import type { AccountWithBalance, Company } from '../../shared/types';
import type { CashFlowLineItem } from '../../shared/types/extended-statements.types';

type SubTabId = 'FLUJOS' | 'CAPITAL' | 'COMPARATIVO';

interface FlujosCapitalTabProps {
  company: Company;
  ejercicio: number;
  periodo?: number;
  mesNombre: string;
  trialBalance: readonly AccountWithBalance[];
  previousTrialBalance?: readonly AccountWithBalance[] | null;
  onSelectAccount?: (accountId: string) => void;
}

const SUB_TABS: ReadonlyArray<{ id: SubTabId; label: string }> = [
  { id: 'FLUJOS', label: 'Flujos de Efectivo (NIF B-2)' },
  { id: 'CAPITAL', label: 'Cambios en el Capital (NIF B-4)' },
  { id: 'COMPARATIVO', label: 'Comparativo vs. Ejercicio Anterior' }
];

function CashFlowSection({ title, items, totalLabel, totalAmount, emptyLabel }: {
  title: string; items: readonly CashFlowLineItem[]; totalLabel: string; totalAmount: number; emptyLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
        <span>{title}</span>
        <span className="font-mono text-[11px] text-slate-600">Importe MXN</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic px-3 py-1.5">{emptyLabel}</p>
      ) : (
        items.map((item) => (
          <div key={`${item.code}-${item.label}`} className="flex items-center justify-between gap-2 text-xs py-1.5 px-3 hover:bg-slate-50 rounded-lg">
            <span className="text-slate-700 min-w-0">
              <span className="font-mono text-[11px] text-blue-800 mr-2">{item.satReference ?? item.code}</span>
              {item.label}
            </span>
            <span className={`font-mono font-semibold shrink-0 tabular-nums ${item.amount < 0 ? 'text-red-700' : 'text-slate-900'}`}>
              {formatCurrency(item.amount)}
            </span>
          </div>
        ))
      )}
      <div className="flex justify-between text-xs font-bold text-slate-900 border-t border-slate-300 pt-2 px-3 bg-slate-50/80 rounded-lg py-1.5">
        <span>{totalLabel}</span>
        <span className={`font-mono tabular-nums ${totalAmount < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{formatCurrency(totalAmount)}</span>
      </div>
    </div>
  );
}

export function FlujosCapitalTab({
  company, ejercicio, periodo, mesNombre, trialBalance, previousTrialBalance, onSelectAccount
}: FlujosCapitalTabProps) {
  const toast = useToast();
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('FLUJOS');
  const [isExporting, setIsExporting] = useState(false);
  const [hideZeroRows, setHideZeroRows] = useState(true);

  const effectivePeriodo = periodo ?? company.currentPeriod ?? 12;
  const data = useMemo(
    () => computeExtendedFinancialStatements({ company, ejercicio, periodo: effectivePeriodo, currentTrialBalance: trialBalance, previousTrialBalance }),
    [company, ejercicio, effectivePeriodo, trialBalance, previousTrialBalance]
  );
  const comparativeRows = useMemo(
    () => (hideZeroRows ? data.comparative.filter((r) => Math.abs(r.currentBalance) >= 0.01 || Math.abs(r.previousBalance) >= 0.01) : data.comparative),
    [data.comparative, hideZeroRows]
  );

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportExtendedStatementsXlsx({ data, mesNombre });
      toast.success('Estados financieros NIF B-2 / B-4 y Comparativo exportados en Excel (.xlsx)');
    } catch {
      toast.error('No se pudo generar el archivo Excel NIF (.xlsx)');
    } finally {
      setIsExporting(false);
    }
  };

  const { cashFlow, equityChanges } = data;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-slate-900 pb-4">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 uppercase tracking-tight truncate">{company.name}</h2>
            <div className="text-xs font-mono text-slate-600 mt-0.5 truncate">
              RFC: <span className="font-semibold">{company.rfc}</span> • {mesNombre} {ejercicio} • Base: {data.previousEjercicioLabel}
            </div>
            <div className="text-xs font-bold text-blue-900 mt-1 uppercase tracking-wide">
              4 Estados Financieros Básicos (NIF B-2 y NIF B-4) y Comparativo Interanual
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-xs font-bold text-white shadow-xs transition cursor-pointer shrink-0 no-print"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{isExporting ? 'Generando Excel...' : 'Exportar Excel NIF (.xlsx)'}</span>
          </button>
        </div>

        <div role="tablist" aria-label="Sub-secciones de estados financieros NIF B-2, NIF B-4 y comparativo" className="flex items-center gap-2 erp-tab-scroller no-print">
          {SUB_TABS.map((tab) => {
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nif-subtab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveSubTab(tab.id)}
                onKeyDown={(e) => handleTablistKeyDown(e, SUB_TABS, activeSubTab, setActiveSubTab, 'nif-subtab-')}
                className={`relative px-3.5 py-2 rounded-t-xl text-xs font-semibold whitespace-nowrap border-b-2 transition cursor-pointer ${
                  isSelected ? 'bg-blue-50 text-blue-900 border-blue-700 font-bold' : 'bg-slate-50 text-slate-700 border-transparent hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" aria-labelledby="nif-subtab-FLUJOS" hidden={activeSubTab !== 'FLUJOS'}>
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-700" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900 uppercase">Estado de Flujos de Efectivo — Método Indirecto (NIF B-2)</h3>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              cashFlow.isReconciled ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {cashFlow.isReconciled ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}
              {cashFlow.isReconciled ? 'Reconciliado con Caja y Bancos' : `Diferencia: ${formatCurrency(cashFlow.diferenciaReconciliacion)}`}
            </span>
          </div>

          <CashFlowSection title="1. Actividades de Operación" items={cashFlow.actividadesOperacion} totalLabel="(=) Flujo Neto de Actividades de Operación" totalAmount={cashFlow.flujoNetoOperacion} emptyLabel="Sin movimientos operativos en el periodo." />
          <CashFlowSection title="2. Actividades de Inversión" items={cashFlow.actividadesInversion} totalLabel="(=) Flujo Neto de Actividades de Inversión" totalAmount={cashFlow.flujoNetoInversion} emptyLabel="Sin adquisiciones o bajas de activos fijos en el periodo." />
          <CashFlowSection title="3. Actividades de Financiamiento" items={cashFlow.actividadesFinanciamiento} totalLabel="(=) Flujo Neto de Actividades de Financiamiento" totalAmount={cashFlow.flujoNetoFinanciamiento} emptyLabel="Sin movimientos de deuda a largo plazo o capital social en el periodo." />

          <div className="p-4 rounded-xl bg-[#0A1120] text-white grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <div className="text-[11px] text-slate-400">Variación Neta de Efectivo</div>
              <div className={`text-base font-bold font-mono tabular-nums ${cashFlow.variacionNetaEfectivo < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatCurrency(cashFlow.variacionNetaEfectivo)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">(+) Efectivo Inicial (101/102)</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-200">{formatCurrency(cashFlow.efectivoInicial)}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] text-slate-400">(=) Efectivo Final en Bancos</div>
              <div className="text-lg font-extrabold font-mono tabular-nums text-blue-300">{formatCurrency(cashFlow.efectivoFinal)}</div>
            </div>
          </div>
        </div>
      </div>

      <div role="tabpanel" aria-labelledby="nif-subtab-CAPITAL" hidden={activeSubTab !== 'CAPITAL'}>
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-700" aria-hidden="true" />
              <h3 id="equity-table-caption" className="text-sm font-bold text-slate-900 uppercase">Estado de Cambios en el Capital Contable (NIF B-4)</h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              equityChanges.isBalanced ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {equityChanges.isBalanced ? 'Cuadre Horizontal/Vertical Verificado ✔' : 'Revisar Cuadre Patrimonial'}
            </span>
          </div>

          <div tabIndex={0} role="region" aria-labelledby="equity-table-caption" className="overflow-x-auto max-w-full rounded-xl border border-slate-200">
            <table className="w-full text-xs border-collapse">
              <caption className="sr-only">Estado de Cambios en el Capital Contable NIF B-4</caption>
              <thead className="sticky top-0 bg-slate-100 text-slate-800 border-b border-slate-200 z-10">
                <tr>
                  <th scope="col" className="text-left px-3 py-2.5 font-bold">Concepto / Movimiento</th>
                  {equityChanges.columns.map((col) => (
                    <th key={col.key} scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">
                      <div>{col.label}</div>
                      <div className="text-[10px] font-mono font-normal text-slate-500">{col.satRef}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equityChanges.rows.map((row) => (
                  <tr key={row.id} className={row.rowType !== 'MOVEMENT' ? 'bg-slate-50 font-bold text-slate-900' : 'text-slate-700 hover:bg-blue-50/30'}>
                    <th scope="row" className="text-left px-3 py-2.5 font-semibold">{row.concepto}</th>
                    <td className="text-right px-3 py-2.5 font-mono tabular-nums">{formatCurrency(row.capitalSocial)}</td>
                    <td className="text-right px-3 py-2.5 font-mono tabular-nums">{formatCurrency(row.reservaLegal)}</td>
                    <td className="text-right px-3 py-2.5 font-mono tabular-nums">{formatCurrency(row.resultadosAcumulados)}</td>
                    <td className="text-right px-3 py-2.5 font-mono tabular-nums">{formatCurrency(row.resultadoEjercicio)}</td>
                    <td className="text-right px-3 py-2.5 font-mono font-bold text-blue-900 tabular-nums">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div role="tabpanel" aria-labelledby="nif-subtab-COMPARATIVO" hidden={activeSubTab !== 'COMPARATIVO'}>
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-700" aria-hidden="true" />
              <h3 id="comparative-table-caption" className="text-sm font-bold text-slate-900 uppercase">
                Comparativo Interanual: Ejercicio {ejercicio} vs. {data.previousEjercicioLabel}
              </h3>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={hideZeroRows} onChange={(e) => setHideZeroRows(e.target.checked)} className="rounded border-slate-300" />
              Ocultar cuentas sin saldo
            </label>
          </div>

          <div tabIndex={0} role="region" aria-labelledby="comparative-table-caption" className="overflow-x-auto max-h-[540px] max-w-full rounded-xl border border-slate-200">
            <table className="w-full text-xs border-collapse">
              <caption className="sr-only">Comparativo Interanual de Balanza</caption>
              <thead className="sticky top-0 bg-slate-100 text-slate-800 border-b border-slate-200 z-10">
                <tr>
                  <th scope="col" className="text-left px-3 py-2.5 font-bold">Código</th>
                  <th scope="col" className="text-left px-3 py-2.5 font-bold">Cuenta Contable</th>
                  <th scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">Ejercicio {ejercicio}</th>
                  <th scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">{data.previousEjercicioLabel}</th>
                  <th scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">Variación $</th>
                  <th scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">Variación %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparativeRows.map((row) => (
                  <tr key={row.code} className={row.level <= 2 ? 'bg-slate-50/90 font-bold text-slate-900' : 'text-slate-700 hover:bg-blue-50/30'}>
                    <th scope="row" className="text-left px-3 py-2 font-mono text-blue-800 whitespace-nowrap">
                      {onSelectAccount ? (
                        <button type="button" onClick={() => onSelectAccount(row.accountId)} className="underline decoration-dotted cursor-pointer">
                          {row.code}
                        </button>
                      ) : row.code}
                    </th>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="text-right px-3 py-2 font-mono tabular-nums">{formatCurrency(row.currentBalance)}</td>
                    <td className="text-right px-3 py-2 font-mono tabular-nums text-slate-600">{formatCurrency(row.previousBalance)}</td>
                    <td className={`text-right px-3 py-2 font-mono tabular-nums ${row.varianceAmount < 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                      {formatCurrency(row.varianceAmount)}
                    </td>
                    <td className="text-right px-3 py-2 font-mono tabular-nums text-slate-600">
                      {row.variancePct === null ? 'N/A' : `${row.variancePct > 0 ? '+' : ''}${row.variancePct.toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

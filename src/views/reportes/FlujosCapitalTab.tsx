import { useId, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Download, Layers, TrendingUp } from 'lucide-react';
import { AlertBanner, Button, EmptyState, KpiCard, StatusBadge, TabBar, type TabBarItem } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { formatBalanceCutoffLabel } from '../../shared/date-utils';
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
  isLoadingPrevReports?: boolean;
  onSelectAccount?: (accountId: string) => void;
}

const SUB_TABS: ReadonlyArray<TabBarItem<SubTabId>> = [
  { id: 'FLUJOS', label: 'Flujos de Efectivo (NIF B-2)' },
  { id: 'CAPITAL', label: 'Cambios en el Capital (NIF B-4)' },
  { id: 'COMPARATIVO', label: 'Comparativo vs. Ejercicio Anterior' }
];

function CashFlowSection({ title, items, totalLabel, totalAmount, emptyLabel }: {
  title: string; items: readonly CashFlowLineItem[]; totalLabel: string; totalAmount: number; emptyLabel: string;
}) {
  const headingId = useId();
  return (
    <section className="space-y-1.5">
      <h4 id={headingId} className="text-xs font-bold uppercase tracking-wider text-slate-800 px-1">{title}</h4>
      <div tabIndex={0} role="region" aria-labelledby={headingId} className="overflow-x-auto max-w-full rounded-xl border border-slate-200">
        <table className="w-full text-xs border-collapse">
          <caption className="visually-hidden">{title}</caption>
          <thead className="bg-slate-100 text-slate-800 border-b border-slate-200">
            <tr>
              <th scope="col" className="text-left px-3 py-2 font-bold">Concepto</th>
              <th scope="col" className="text-right px-3 py-2 font-bold whitespace-nowrap">Importe MXN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={2} className="text-xs text-slate-600 italic px-3 py-2">{emptyLabel}</td></tr>
            ) : (
              items.map((item) => (
                <tr key={`${item.code}-${item.label}`} className="hover:bg-slate-50">
                  <th scope="row" className="text-left font-normal text-slate-700 px-3 py-1.5">
                    <span className="font-mono text-[11px] text-slate-700 font-semibold mr-2">{item.satReference ?? item.code}</span>
                    {item.label}
                  </th>
                  <td className={`text-right font-mono font-semibold tabular-nums whitespace-nowrap px-3 py-1.5 ${item.amount < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-50/90 border-t border-slate-300 font-bold text-slate-900">
            <tr>
              <th scope="row" className="text-left px-3 py-2 font-bold text-slate-900">{totalLabel}</th>
              <td className={`text-right px-3 py-2 font-mono tabular-nums whitespace-nowrap ${totalAmount < 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                {formatCurrency(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function FlujosCapitalTab({
  company, ejercicio, periodo, mesNombre, trialBalance, previousTrialBalance, isLoadingPrevReports = false, onSelectAccount
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
  const prevYearHeader = `Ejercicio ${ejercicio - 1}`;
  const periodBanner = formatBalanceCutoffLabel(ejercicio, effectivePeriodo, mesNombre);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-slate-900 pb-4">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 uppercase tracking-tight truncate">{company.name}</h2>
            <div className="text-xs font-mono text-slate-600 mt-0.5 truncate">
              RFC: <span className="font-semibold">{company.rfc}</span> • {periodBanner} • Base: {prevYearHeader}
            </div>
            <div className="text-xs font-bold text-blue-900 mt-1 uppercase tracking-wide">
              4 Estados Financieros Básicos (NIF B-2 y NIF B-4) y Comparativo Interanual
            </div>
          </div>
          <Button
            variant="export"
            size="md"
            onClick={handleExport}
            loading={isExporting}
            leftIcon={<Download className="w-4 h-4" aria-hidden="true" />}
            className="no-print"
          >
            {isExporting ? 'Generando Excel...' : 'Exportar Excel NIF (.xlsx)'}
          </Button>
        </div>

        <TabBar
          tabs={SUB_TABS}
          activeId={activeSubTab}
          onSelect={setActiveSubTab}
          idPrefix="nif-subtab-"
          ariaLabel="Sub-secciones de estados financieros NIF B-2, NIF B-4 y comparativo"
          panelId={`nif-subpanel-${activeSubTab}`}
          className="no-print"
        />
      </div>

      <div id="nif-subpanel-FLUJOS" role="tabpanel" aria-labelledby="nif-subtab-FLUJOS" hidden={activeSubTab !== 'FLUJOS'}>
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-700" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900 uppercase">Estado de Flujos de Efectivo — Método Indirecto (NIF B-2)</h3>
              </div>
              {data.cashFlowWindowLabel && (
                <p className="text-[11px] text-slate-600 pl-7">Ventana: {data.cashFlowWindowLabel}</p>
              )}
            </div>
            <span role={cashFlow.isReconciled ? 'status' : 'alert'} aria-live={cashFlow.isReconciled ? 'polite' : 'assertive'}>
              <StatusBadge
                tone={cashFlow.isReconciled ? 'emerald' : 'amber'}
                icon={cashFlow.isReconciled ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                {cashFlow.isReconciled ? 'Reconciliado con Caja y Bancos' : `Diferencia: ${formatCurrency(cashFlow.diferenciaReconciliacion)}`}
              </StatusBadge>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard label="Flujo Operación" value={formatCurrency(cashFlow.flujoNetoOperacion)} valueClassName={cashFlow.flujoNetoOperacion < 0 ? 'text-red-700' : 'text-emerald-800'} />
            <KpiCard label="Flujo Inversión" value={formatCurrency(cashFlow.flujoNetoInversion)} valueClassName={cashFlow.flujoNetoInversion < 0 ? 'text-red-700' : 'text-slate-900'} />
            <KpiCard label="Flujo Financiamiento" value={formatCurrency(cashFlow.flujoNetoFinanciamiento)} valueClassName={cashFlow.flujoNetoFinanciamiento < 0 ? 'text-red-700' : 'text-slate-900'} />
          </div>

          <CashFlowSection title="1. Actividades de Operación" items={cashFlow.actividadesOperacion} totalLabel="(=) Flujo Neto de Actividades de Operación" totalAmount={cashFlow.flujoNetoOperacion} emptyLabel="Sin movimientos operativos en el periodo." />
          <CashFlowSection title="2. Actividades de Inversión" items={cashFlow.actividadesInversion} totalLabel="(=) Flujo Neto de Actividades de Inversión" totalAmount={cashFlow.flujoNetoInversion} emptyLabel="Sin adquisiciones o bajas de activos fijos en el periodo." />
          <CashFlowSection title="3. Actividades de Financiamiento" items={cashFlow.actividadesFinanciamiento} totalLabel="(=) Flujo Neto de Actividades de Financiamiento" totalAmount={cashFlow.flujoNetoFinanciamiento} emptyLabel="Sin movimientos de deuda a largo plazo o capital social en el periodo." />

          <div className="p-4 rounded-xl bg-[#0A1120] text-white grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <div className="text-[11px] text-slate-300">Variación Neta de Efectivo</div>
              <div className={`text-base font-bold font-mono tabular-nums ${cashFlow.variacionNetaEfectivo < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {formatCurrency(cashFlow.variacionNetaEfectivo)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-300">(+) Efectivo Inicial (101/102/103)</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-100">{formatCurrency(cashFlow.efectivoInicial)}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-[11px] text-slate-300">(=) Efectivo Final en Bancos</div>
              <div className="text-lg font-extrabold font-mono tabular-nums text-blue-300">{formatCurrency(cashFlow.efectivoFinal)}</div>
            </div>
          </div>
        </div>
      </div>

      <div id="nif-subpanel-CAPITAL" role="tabpanel" aria-labelledby="nif-subtab-CAPITAL" hidden={activeSubTab !== 'CAPITAL'}>
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-700" aria-hidden="true" />
              <h3 id="equity-table-caption" className="text-sm font-bold text-slate-900 uppercase">Estado de Cambios en el Capital Contable (NIF B-4)</h3>
            </div>
            <span role={equityChanges.isBalanced ? 'status' : 'alert'} aria-live={equityChanges.isBalanced ? 'polite' : 'assertive'}>
              <StatusBadge
                tone={equityChanges.isBalanced ? 'emerald' : 'amber'}
                icon={equityChanges.isBalanced ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                {equityChanges.isBalanced ? 'Cuadre Horizontal/Vertical Verificado' : 'Revisar Cuadre Patrimonial'}
              </StatusBadge>
            </span>
          </div>

          <div tabIndex={0} role="region" aria-labelledby="equity-table-caption" className="overflow-x-auto max-w-full rounded-xl border border-slate-200">
            <table className="w-full text-xs border-collapse">
              <caption className="visually-hidden">Estado de Cambios en el Capital Contable NIF B-4</caption>
              <thead className="sticky top-0 bg-slate-100 text-slate-800 border-b border-slate-200 z-10">
                <tr>
                  <th scope="col" className="text-left px-3 py-2.5 font-bold">Concepto / Movimiento</th>
                  {equityChanges.columns.map((col) => (
                    <th key={col.key} scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">
                      <div>{col.label}</div>
                      <div className="text-[11px] font-mono font-normal text-slate-700">{col.satRef}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equityChanges.rows.map((row) => (
                  <tr key={row.id} className={row.rowType !== 'MOVEMENT' ? 'bg-slate-50 font-bold text-slate-900' : 'text-slate-700 hover:bg-blue-50/30'}>
                    <th scope="row" className="text-left px-3 py-2.5 font-semibold">{row.concepto}</th>
                    <td className="text-right px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">{formatCurrency(row.capitalSocial)}</td>
                    <td className="text-right px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">{formatCurrency(row.reservaLegal)}</td>
                    <td className="text-right px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">{formatCurrency(row.resultadosAcumulados)}</td>
                    <td className="text-right px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">{formatCurrency(row.resultadoEjercicio)}</td>
                    <td className="text-right px-3 py-2.5 font-mono font-bold text-blue-900 tabular-nums whitespace-nowrap">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="nif-subpanel-COMPARATIVO" role="tabpanel" aria-labelledby="nif-subtab-COMPARATIVO" hidden={activeSubTab !== 'COMPARATIVO'}>
        <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-700" aria-hidden="true" />
              <h3 id="comparative-table-caption" className="text-sm font-bold text-slate-900 uppercase">
                Comparativo Interanual: Ejercicio {ejercicio} vs. {prevYearHeader}
              </h3>
            </div>
            <label htmlFor="comparative-hide-zero" className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input id="comparative-hide-zero" type="checkbox" checked={hideZeroRows} onChange={(e) => setHideZeroRows(e.target.checked)} className="rounded border-slate-300" />
              Ocultar cuentas sin saldo
            </label>
          </div>

          {isLoadingPrevReports ? (
            <AlertBanner tone="blue" className="aria-busy">
              Consultando saldos comparativos del {prevYearHeader}...
            </AlertBanner>
          ) : !data.hasPreviousComparative ? (
            <AlertBanner tone="warning">
              No existen saldos previos registrados para el {prevYearHeader}; la columna comparativa se muestra en $0.00.
            </AlertBanner>
          ) : null}

          {comparativeRows.length === 0 ? (
            <EmptyState
              variant="dashed"
              tone="slate"
              icon={<ArrowRightLeft className="w-5 h-5" aria-hidden="true" />}
              title="Sin saldos en el comparativo"
              description="No hay cuentas con saldo distinto de cero en este comparativo interanual."
              actions={
                hideZeroRows ? (
                  <Button variant="primary" size="sm" onClick={() => setHideZeroRows(false)}>
                    Mostrar cuentas sin saldo
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div tabIndex={0} role="region" aria-labelledby="comparative-table-caption" className="overflow-x-auto max-h-[540px] max-w-full rounded-xl border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <caption className="visually-hidden">Comparativo Interanual de Balanza</caption>
                <thead className="sticky top-0 bg-slate-100 text-slate-800 border-b border-slate-200 z-10">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2.5 font-bold">Código</th>
                    <th scope="col" className="text-left px-3 py-2.5 font-bold">Cuenta Contable</th>
                    <th scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">Ejercicio {ejercicio}</th>
                    <th scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">{prevYearHeader}</th>
                    <th scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">Variación $</th>
                    <th scope="col" className="text-right px-3 py-2.5 font-bold whitespace-nowrap">Variación %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparativeRows.map((row) => (
                    <tr key={row.code} className={row.level <= 2 ? 'bg-slate-50/90 font-bold text-slate-900' : 'text-slate-700 hover:bg-blue-50/30'}>
                      <th scope="row" className="text-left px-3 py-2 font-mono text-blue-800 whitespace-nowrap">
                        {onSelectAccount ? (
                          <button type="button" onClick={() => onSelectAccount(row.accountId)} aria-label={`Ver auxiliar de la cuenta ${row.code} ${row.name}`} title={`Ver auxiliar contable de ${row.code}`} className="underline decoration-dotted cursor-pointer">
                            {row.code}
                          </button>
                        ) : row.code}
                      </th>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="text-right px-3 py-2 font-mono tabular-nums whitespace-nowrap">{formatCurrency(row.currentBalance)}</td>
                      <td className="text-right px-3 py-2 font-mono tabular-nums whitespace-nowrap text-slate-700">{formatCurrency(row.previousBalance)}</td>
                      <td className={`text-right px-3 py-2 font-mono tabular-nums whitespace-nowrap ${row.varianceAmount < 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                        {formatCurrency(row.varianceAmount)}
                      </td>
                      <td className="text-right px-3 py-2 font-mono tabular-nums whitespace-nowrap text-slate-700">
                        {row.variancePct === null ? <span title="Sin saldo en el ejercicio anterior para calcular variación porcentual">N/A</span> : `${row.variancePct > 0 ? '+' : ''}${row.variancePct.toFixed(2)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

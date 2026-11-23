import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Building2, Calculator, CheckCircle2, RefreshCw, Sparkles, Users } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency, getLastDateForPeriod } from '../../lib/formatters';
import {
  computePayrollPeriodSummary,
  computeSuaAndIsnProvision,
  MEXICO_ISN_RATES
} from '../../shared/engine/payroll-summary.engine';
import type { AccountWithBalance, Company } from '../../shared/types';
import type { SuaAndIsnProvisionResult } from '../../shared/types/payroll-summary.types';

export interface NominaImssTabProps {
  activeCompanyId: string;
  company?: Company | null;
  currentYear?: number;
  currentPeriod?: number;
  isPeriodLocked?: boolean;
  accounts?: readonly AccountWithBalance[];
  onFeedback?: (msg: string, type?: 'success' | 'error') => void;
}

function parseNonNeg(val: string): number {
  const n = Number.parseFloat(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function NominaImssTab({
  activeCompanyId,
  company,
  currentYear,
  currentPeriod,
  isPeriodLocked = false,
  accounts: accountsProp,
  onFeedback
}: NominaImssTabProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const effectiveYear = currentYear ?? company?.currentYear ?? 2026;
  const effectivePeriod = currentPeriod ?? company?.currentPeriod ?? 10;

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (onFeedback) onFeedback(msg, type);
    else if (type === 'error') toast.error(msg);
    else toast.success(msg);
  };

  const { data: cfdis = [], isLoading: loadingCfdis, isError: isErrCfdis, refetch: refetchCfdis } = useQuery({
    queryKey: ['cfdis', activeCompanyId],
    queryFn: () => apiClient.getCfdis(activeCompanyId),
    enabled: Boolean(activeCompanyId)
  });

  const { data: reports, isLoading: loadingRep, isError: isErrRep, refetch: refetchRep } = useQuery({
    queryKey: ['reports', activeCompanyId, effectiveYear, effectivePeriod],
    queryFn: () => apiClient.getReports(activeCompanyId, effectiveYear, effectivePeriod),
    enabled: Boolean(activeCompanyId)
  });

  const trialBalance = reports?.trialBalance ?? [];
  const accounts = accountsProp && accountsProp.length > 0 ? accountsProp : trialBalance;

  const summary = useMemo(
    () => computePayrollPeriodSummary({ cfdis, trialBalance, ejercicio: effectiveYear, periodo: effectivePeriod }),
    [cfdis, trialBalance, effectiveYear, effectivePeriod]
  );

  const [stateCode, setStateCode] = useState<string>('CMX');
  const [baseInput, setBaseInput] = useState<string>('');
  const [imssInput, setImssInput] = useState<string>('0');
  const [rcvInput, setRcvInput] = useState<string>('0');
  const [infonavitInput, setInfonavitInput] = useState<string>('0');
  const resolvedBase = baseInput === '' ? summary.totalPercepciones : parseNonNeg(baseInput);

  const { provision, provisionError } = useMemo<{
    provision: SuaAndIsnProvisionResult | null;
    provisionError: string | null;
  }>(() => {
    if (accounts.length === 0) return { provision: null, provisionError: null };
    try {
      const result = computeSuaAndIsnProvision(
        {
          ejercicio: effectiveYear,
          periodo: effectivePeriod,
          stateCode,
          baseGravableNomina: resolvedBase,
          imssPatronal: parseNonNeg(imssInput),
          rcv: parseNonNeg(rcvInput),
          infonavit: parseNonNeg(infonavitInput)
        },
        accounts
      );
      return { provision: result, provisionError: null };
    } catch (err) {
      return { provision: null, provisionError: err instanceof Error ? err.message : 'Error de cálculo.' };
    }
  }, [accounts, effectiveYear, effectivePeriod, stateCode, resolvedBase, imssInput, rcvInput, infonavitInput]);

  const createPolizaMutation = useMutation({
    mutationFn: (prov: SuaAndIsnProvisionResult) =>
      apiClient.createPoliza({
        companyId: activeCompanyId,
        tipo: prov.polizaTipo,
        fecha: getLastDateForPeriod(effectiveYear, effectivePeriod),
        concepto: prov.polizaConcept,
        origin: 'MANUAL',
        movements: prov.polizaMovements.map((m) => ({
          accountId: m.accountId, referencia: m.referencia, concepto: m.concepto, cargo: m.cargo, abono: m.abono
        }))
      }),
    onSuccess: (poliza) => {
      invalidateAccountingQueries(queryClient, ['polizas', 'accounts', 'account-ledger', 'reports', 'dashboard'], activeCompanyId);
      notify(`Póliza de Provisión SUA + ISN (#${poliza.folio}) registrada y cuadrada.`);
    },
    onError: (err: Error) => notify(`Error al registrar póliza SUA + ISN: ${err.message}`, 'error')
  });

  if (isErrCfdis || isErrRep) {
    return (
      <div role="alert" className="p-8 text-center bg-white rounded-2xl border border-red-200 shadow-2xs space-y-3 max-w-lg mx-auto my-8">
        <AlertCircle className="w-7 h-7 text-red-600 mx-auto" aria-hidden="true" />
        <h2 className="font-bold text-slate-900 text-sm">Error al cargar datos de Nómina 1.2 y Balanza</h2>
        <button type="button" onClick={() => { void refetchCfdis(); void refetchRep(); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Reintentar
        </button>
      </div>
    );
  }

  if (loadingCfdis || loadingRep) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
        Consolidando CFDIs de Nómina 1.2 y balanza de retenciones (216-01-001)...
      </div>
    );
  }

  const periodLabel = `${String(effectivePeriod).padStart(2, '0')}/${effectiveYear}`;
  const kpiCards = [
    { label: 'Recibos Timbrados (Tipo N)', value: String(summary.nominaCount), sub: `Periodo ${periodLabel}`, tone: 'text-slate-900', icon: true },
    { label: 'Total Percepciones', value: formatCurrency(summary.totalPercepciones), sub: `IMSS Obrero est.: ${formatCurrency(summary.imssObreroEstimado)}`, tone: 'text-slate-900' },
    { label: 'Subsidio al Empleo / Otros Pagos', value: formatCurrency(summary.totalSubsidioEmpleo), sub: 'Complemento Nómina 1.2', tone: 'text-blue-700' },
    { label: 'Neto Pagado', value: formatCurrency(summary.totalNetoPagado), sub: `ISR retenido: ${formatCurrency(summary.isrRetenidoCfdis)}`, tone: 'text-emerald-700' }
  ];

  const amarreMeta =
    summary.amarreStatus === 'CUADRADO'
      ? { badge: 'bg-emerald-50 text-emerald-800 border-emerald-300', label: 'CUADRADO vs Libros' }
      : summary.amarreStatus === 'DIFERENCIA'
        ? { badge: 'bg-red-50 text-red-800 border-red-300', label: 'CON DIFERENCIA' }
        : { badge: 'bg-slate-100 text-slate-700 border-slate-300', label: 'SIN NÓMINA EN PERIODO' };

  const amarreRows = [
    { label: 'ISR Retenido CFDIs (Nómina 1.2)', value: formatCurrency(summary.isrRetenidoCfdis), tone: 'text-slate-900' },
    { label: `Saldo Acreedor Libros (${summary.cuentaIsrCode})`, value: formatCurrency(summary.isrRetenidoLibros), tone: 'text-slate-900' },
    { label: 'Diferencia (CFDIs − Libros)', value: formatCurrency(summary.diferenciaIsrAmarre), tone: summary.diferenciaIsrAmarre === 0 ? 'text-emerald-700' : 'text-red-700' }
  ];

  return (
    <div className="space-y-5">
      <section aria-label="Resumen mensual de Nómina 1.2" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white p-4 rounded-2xl border border-slate-300/90 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{k.label}</span>
              {k.icon && <Users className="w-4 h-4 text-blue-600" aria-hidden="true" />}
            </div>
            <p className={`text-xl font-bold mt-1 ${k.tone}`}>{k.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </section>

      <section className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Amarre ISR Retenido por Salarios vs. Contabilidad ({summary.cuentaIsrCode})</h2>
            <p className="text-xs text-slate-500">Compara la suma de ISR retenido en CFDIs Tipo N vigentes contra los abonos del periodo en balanza</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${amarreMeta.badge}`}>
            {summary.amarreStatus === 'CUADRADO' && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
            {summary.amarreStatus === 'DIFERENCIA' && <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />}
            {amarreMeta.label}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {amarreRows.map((row) => (
            <div key={row.label} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 block">{row.label}</span>
              <span className={`text-base font-bold ${row.tone}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-blue-700" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Provisión Mensual SUA (IMSS / RCV / INFONAVIT) e ISN Estatal</h2>
              <p className="text-xs text-slate-500">Calcula el Impuesto Sobre Nómina estatal y genera la póliza de diario cuadrada al centavo</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isPeriodLocked || !provision || createPolizaMutation.isPending}
            onClick={() => provision && createPolizaMutation.mutate(provision)}
            title={isPeriodLocked ? 'Periodo fiscal bloqueado ante el SAT' : 'Registrar póliza de diario en contabilidad'}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {createPolizaMutation.isPending ? 'Registrando Póliza...' : 'Registrar Póliza de Provisión SUA + ISN'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label htmlFor="isn-state-select" className="block font-semibold text-slate-700 mb-1">Estado ISN (32 Entidades)</label>
            <select id="isn-state-select" value={stateCode} onChange={(e) => setStateCode(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900">
              {MEXICO_ISN_RATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name} ({s.ratePct.toFixed(2)}%)</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="isn-base-input" className="font-semibold text-slate-700">Base Gravable ISN ($)</label>
              <button type="button" onClick={() => setBaseInput(String(summary.totalPercepciones))} className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer">Usar nómina</button>
            </div>
            <input id="isn-base-input" type="number" min="0" step="0.01" value={baseInput === '' ? String(summary.totalPercepciones) : baseInput} onChange={(e) => setBaseInput(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900" />
          </div>
          <div>
            <label htmlFor="sua-imss-input" className="block font-semibold text-slate-700 mb-1">IMSS Patronal ($)</label>
            <input id="sua-imss-input" type="number" min="0" step="0.01" value={imssInput} onChange={(e) => setImssInput(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900" />
          </div>
          <div>
            <label htmlFor="sua-rcv-input" className="block font-semibold text-slate-700 mb-1">RCV Patronal ($)</label>
            <input id="sua-rcv-input" type="number" min="0" step="0.01" value={rcvInput} onChange={(e) => setRcvInput(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="sua-infonavit-input" className="font-semibold text-slate-700">INFONAVIT 5% ($)</label>
              <button type="button" onClick={() => setInfonavitInput((resolvedBase * 0.05).toFixed(2))} className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer">Estimar 5%</button>
            </div>
            <input id="sua-infonavit-input" type="number" min="0" step="0.01" value={infonavitInput} onChange={(e) => setInfonavitInput(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900" />
          </div>
        </div>

        {provision ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div><span className="text-slate-500 block">ISN {provision.stateName} ({provision.tasaIsnPct}%)</span><span className="text-sm font-bold text-slate-900">{formatCurrency(provision.isnEstatal)}</span></div>
              <div><span className="text-slate-500 block">Total SUA Patronal (IMSS + RCV + INFONAVIT)</span><span className="text-sm font-bold text-slate-900">{formatCurrency(provision.totalSuaPatronal)}</span></div>
              <div><span className="text-slate-500 block">Provisión Total (Póliza DIARIO)</span><span className="text-sm font-bold text-blue-800">{formatCurrency(provision.totalProvision)}</span></div>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="px-3 py-2">Cuenta</th><th className="px-3 py-2">Concepto</th>
                    <th className="px-3 py-2 text-right">Cargo</th><th className="px-3 py-2 text-right">Abono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {provision.polizaMovements.map((m, idx) => (
                    <tr key={`${m.accountId}-${idx}`}>
                      <td className="px-3 py-2 font-mono text-slate-800">{m.accountCode} · {m.accountName}</td>
                      <td className="px-3 py-2 text-slate-600">{m.concepto}</td>
                      <td className="px-3 py-2 text-right font-mono">{m.cargo > 0 ? formatCurrency(m.cargo) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono">{m.abono > 0 ? formatCurrency(m.abono) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-300">
                  <tr>
                    <td colSpan={2} className="px-3 py-2">Totales Póliza (Debe = Haber)</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(provision.totalCargos)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(provision.totalAbonos)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span>{provisionError ?? 'Captura importes patronales o nómina gravable para previsualizar la póliza.'}</span>
          </div>
        )}
      </section>
    </div>
  );
}

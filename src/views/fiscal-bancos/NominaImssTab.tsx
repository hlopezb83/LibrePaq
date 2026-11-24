import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Building2, Calculator, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency, formatShortDate, getLastDateForPeriod } from '../../lib/formatters';
import {
  computePayrollPeriodSummary,
  computeSuaAndIsnProvision,
  MEXICO_ISN_RATES
} from '../../shared/engine/payroll-summary.engine';
import type { AccountWithBalance, Company } from '../../shared/types';
import type { SuaAndIsnProvisionResult } from '../../shared/types/payroll-summary.types';
import { NominaKpiAmarreSection } from './NominaKpiAmarreSection';
import { NominaProvisionPreviewTable } from './NominaProvisionPreviewTable';
import { useNominaPayrollSettings } from './useNominaPayrollSettings';

export interface NominaImssTabProps {
  activeCompanyId: string;
  company?: Company | null;
  currentYear?: number;
  currentPeriod?: number;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
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
  isReadOnlyClient: isReadOnlyClientProp = false,
  accounts: accountsProp,
  onFeedback
}: NominaImssTabProps) {
  const { isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const isLocked = isPeriodLocked || isReadOnly;
  const lockReason = isPeriodLocked
    ? 'Periodo fiscal bloqueado ante el SAT'
    : isReadOnly
      ? 'Modo solo lectura'
      : null;

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

  const [confirmPoliza, setConfirmPoliza] = useState<boolean>(false);
  const {
    stateCode,
    handleStateChange,
    isnRateInput,
    setIsnRateInput,
    baseInput,
    setBaseInput,
    imssInput,
    setImssInput,
    rcvInput,
    setRcvInput,
    infonavitInput,
    setInfonavitInput,
    saveSettingsMutation
  } = useNominaPayrollSettings({
    companyId: activeCompanyId,
    year: effectiveYear,
    period: effectivePeriod,
    isLocked,
    onNotify: notify
  });

  const resolvedBase = baseInput === null ? summary.totalPercepciones : parseNonNeg(baseInput);
  const selectedState = useMemo(
    () => MEXICO_ISN_RATES.find((s) => s.code === stateCode),
    [stateCode]
  );

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
          tasaIsnPct: parseNonNeg(isnRateInput),
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
  }, [accounts, effectiveYear, effectivePeriod, stateCode, isnRateInput, resolvedBase, imssInput, rcvInput, infonavitInput]);

  const polizaDate = getLastDateForPeriod(effectiveYear, effectivePeriod);

  const createPolizaMutation = useMutation({
    mutationFn: async ({ prov, targetCompanyId }: { prov: SuaAndIsnProvisionResult; targetCompanyId: string }) => {
      if (isLocked) {
        throw new Error('Periodo bloqueado o modo solo lectura: no es posible generar pólizas.');
      }
      await saveSettingsMutation.mutateAsync();
      return apiClient.createPoliza({
        companyId: targetCompanyId,
        tipo: prov.polizaTipo,
        fecha: polizaDate,
        concepto: prov.polizaConcept,
        origin: 'MANUAL',
        ejercicio: effectiveYear,
        periodo: effectivePeriod,
        movements: prov.polizaMovements.map((m) => ({
          accountId: m.accountId, referencia: m.referencia, concepto: m.concepto, cargo: m.cargo, abono: m.abono
        }))
      });
    },
    onSuccess: (poliza, variables) => {
      setConfirmPoliza(false);
      invalidateAccountingQueries(
        queryClient,
        ['polizas', 'accounts', 'account-ledger', 'reports', 'dashboard'],
        variables.targetCompanyId
      );
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
        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-blue-600" aria-hidden="true" />
        Consolidando CFDIs de Nómina 1.2 (XML real) y balanza de retenciones (216-01-001)...
      </div>
    );
  }

  const periodLabel = `${String(effectivePeriod).padStart(2, '0')}/${effectiveYear}`;
  const polizaButtonTitle = lockReason
    ?? (!provision ? 'Captura al menos un importe patronal o base gravable ISN > $0.00' : 'Registrar póliza de diario en contabilidad');

  return (
    <div className="space-y-5">
      <NominaKpiAmarreSection summary={summary} periodLabel={periodLabel} />

      <section aria-labelledby="nomina-sua-isn-heading" className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Calculator className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="nomina-sua-isn-heading" className="text-sm font-bold text-slate-900">Provisión Mensual SUA (IMSS / RCV / INFONAVIT) e ISN Estatal</h2>
              <p className="text-xs text-slate-600">Calcula el Impuesto Sobre Nómina estatal (tasa editable y persistente por periodo) y genera la póliza cuadrada</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isLocked || saveSettingsMutation.isPending}
              onClick={() => saveSettingsMutation.mutate()}
              title={lockReason ?? 'Guardar estado, tasa ISN y cuotas SUA para este periodo'}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              {saveSettingsMutation.isPending ? 'Guardando...' : 'Guardar Parámetros'}
            </button>
            <button
              type="button"
              disabled={isLocked || !provision || createPolizaMutation.isPending}
              onClick={() => provision && setConfirmPoliza(true)}
              title={polizaButtonTitle}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {createPolizaMutation.isPending ? 'Registrando Póliza...' : 'Registrar Póliza de Provisión SUA + ISN'}
            </button>
          </div>
        </div>

        {confirmPoliza && provision && (
          <div role="region" aria-label="Confirmación de póliza SUA e ISN" className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className="text-amber-950 font-medium">
              Se generará una póliza de <strong>DIARIO</strong> por <strong className="font-mono tabular-nums">{formatCurrency(provision.totalProvision)}</strong> con fecha <strong className="font-mono">{formatShortDate(polizaDate)}</strong>. Verifica no haberla registrado previamente para evitar duplicados.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" autoFocus onClick={() => setConfirmPoliza(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                disabled={isLocked || createPolizaMutation.isPending}
                onClick={() => createPolizaMutation.mutate({ prov: provision, targetCompanyId: activeCompanyId })}
                title={lockReason ?? 'Confirmar y registrar póliza de diario'}
                className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createPolizaMutation.isPending ? 'Registrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
          <div>
            <label htmlFor="isn-state-select" className="block font-semibold text-slate-700 mb-1">Estado ISN (32 Entidades)</label>
            <select id="isn-state-select" disabled={isLocked} value={stateCode} onChange={(e) => { handleStateChange(e.target.value); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 disabled:bg-slate-100">
              {MEXICO_ISN_RATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name} ({s.ratePct.toFixed(2)}%)</option>
              ))}
            </select>
            {selectedState?.notes && (
              <p className="mt-1 text-[11px] text-slate-600">{selectedState.notes}</p>
            )}
          </div>
          <div>
            <label htmlFor="isn-rate-input" className="block font-semibold text-slate-700 mb-1">Tasa ISN (%)</label>
            <input
              id="isn-rate-input"
              type="number"
              inputMode="decimal"
              min="0"
              max="10"
              step="0.01"
              disabled={isLocked}
              value={isnRateInput}
              onChange={(e) => { setIsnRateInput(e.target.value); setConfirmPoliza(false); }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-slate-900 disabled:bg-slate-100"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <label htmlFor="isn-base-input" className="font-semibold text-slate-700">Base Gravable ISN ($)</label>
              <button type="button" disabled={isLocked} onClick={() => { setBaseInput(null); setConfirmPoliza(false); }} title={lockReason ?? 'Aplicar total de percepciones de los recibos Tipo N del periodo'} className="text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                Usar nómina
              </button>
            </div>
            <input id="isn-base-input" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} placeholder={String(summary.totalPercepciones)} value={baseInput === null ? String(summary.totalPercepciones) : baseInput} onChange={(e) => { setBaseInput(e.target.value); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
          <div>
            <label htmlFor="sua-imss-input" className="block font-semibold text-slate-700 mb-1">IMSS Patronal ($)</label>
            <input id="sua-imss-input" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} value={imssInput} onChange={(e) => { setImssInput(e.target.value); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
          <div>
            <label htmlFor="sua-rcv-input" className="block font-semibold text-slate-700 mb-1">RCV Patronal ($)</label>
            <input id="sua-rcv-input" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} value={rcvInput} onChange={(e) => { setRcvInput(e.target.value); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <label htmlFor="sua-infonavit-input" className="font-semibold text-slate-700">INFONAVIT 5% ($)</label>
              <button type="button" disabled={isLocked} onClick={() => { setInfonavitInput((resolvedBase * 0.05).toFixed(2)); setConfirmPoliza(false); }} title={lockReason ?? 'Estimar INFONAVIT como 5% de la base gravable ISN'} className="text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                Estimar 5%
              </button>
            </div>
            <input id="sua-infonavit-input" type="number" inputMode="decimal" min="0" step="0.01" disabled={isLocked} value={infonavitInput} onChange={(e) => { setInfonavitInput(e.target.value); setConfirmPoliza(false); }} className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono tabular-nums text-slate-900 disabled:bg-slate-100" />
          </div>
        </div>

        {provision ? (
          <NominaProvisionPreviewTable provision={provision} />
        ) : provisionError ? (
          <div role="alert" className="flex items-center gap-2 text-xs text-red-900 bg-red-50 p-3 rounded-xl border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <span>{provisionError}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <Building2 className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
            <span>Captura importes patronales o nómina gravable para previsualizar la póliza.</span>
          </div>
        )}
      </section>
    </div>
  );
}

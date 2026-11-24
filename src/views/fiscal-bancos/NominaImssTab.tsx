import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Building2, Calculator, CheckCircle2, Loader2, RefreshCw, Save, Sparkles } from 'lucide-react';
import { AlertBanner, Button, EmptyState, StatusBadge } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency, formatShortDate, getLastDateForPeriod } from '../../lib/formatters';
import { computePayrollPeriodSummary, computeSuaAndIsnProvision, MEXICO_ISN_RATES } from '../../shared/engine/payroll-summary.engine';
import type { AccountWithBalance, Company } from '../../shared/types';
import type { SuaAndIsnProvisionResult } from '../../shared/types/payroll-summary.types';
import { NominaKpiAmarreSection } from './NominaKpiAmarreSection';
import { NominaProvisionPreviewTable } from './NominaProvisionPreviewTable';
import { NominaSuaIsnFormGrid } from './NominaSuaIsnFormGrid';
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
  activeCompanyId, company, currentYear, currentPeriod,
  isPeriodLocked = false, isReadOnlyClient: isReadOnlyClientProp = false,
  accounts: accountsProp, onFeedback
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

  const { data: periodPolizas = [] } = useQuery({
    queryKey: ['polizas', activeCompanyId, effectiveYear, effectivePeriod],
    queryFn: () => apiClient.getPolizas(activeCompanyId, effectiveYear, effectivePeriod),
    enabled: Boolean(activeCompanyId)
  });

  const existingSuaPoliza = useMemo(
    () => periodPolizas.find((p) => p.concepto.toUpperCase().includes('SUA') && p.concepto.toUpperCase().includes('ISN')) ?? null,
    [periodPolizas]
  );

  const trialBalance = reports?.trialBalance ?? [];
  const accounts = accountsProp && accountsProp.length > 0 ? accountsProp : trialBalance;
  const isrAccountId = accounts.find((a) => a.code === '216-01-001')?.id;

  const summary = useMemo(
    () => computePayrollPeriodSummary({ cfdis, trialBalance, ejercicio: effectiveYear, periodo: effectivePeriod }),
    [cfdis, trialBalance, effectiveYear, effectivePeriod]
  );

  const [confirmPoliza, setConfirmPoliza] = useState<boolean>(false);
  const {
    stateCode, handleStateChange, isnRateInput, setIsnRateInput,
    baseInput, setBaseInput, imssInput, setImssInput,
    rcvInput, setRcvInput, infonavitInput, setInfonavitInput,
    isDirty, saveSettingsSilently, saveSettingsMutation
  } = useNominaPayrollSettings({
    companyId: activeCompanyId,
    year: effectiveYear,
    period: effectivePeriod,
    isLocked,
    onNotify: notify
  });

  const resolvedBase = baseInput === null ? summary.totalPercepciones : parseNonNeg(baseInput);
  const selectedState = useMemo(() => MEXICO_ISN_RATES.find((s) => s.code === stateCode), [stateCode]);

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
      if (isLocked) throw new Error('Periodo bloqueado o modo solo lectura: no es posible generar pólizas.');
      await saveSettingsSilently();
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
      invalidateAccountingQueries(queryClient, ['polizas', 'accounts', 'account-ledger', 'reports', 'dashboard'], variables.targetCompanyId);
      notify(`Póliza de Provisión SUA + ISN (#${poliza.folio}) registrada y cuadrada.`);
    },
    onError: (err: Error) => notify(`Error al registrar póliza SUA + ISN: ${err.message}`, 'error')
  });

  if (isErrCfdis || isErrRep) {
    return (
      <div role="alert" className="max-w-lg mx-auto my-8">
        <EmptyState
          variant="card"
          tone="red"
          icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
          title="Error al cargar datos de Nómina 1.2 y Balanza"
          actions={
            <Button
              variant="primary"
              onClick={() => { void refetchCfdis(); void refetchRep(); }}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Reintentar
            </Button>
          }
        />
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
      <NominaKpiAmarreSection summary={summary} periodLabel={periodLabel} isrAccountId={isrAccountId} />

      <section aria-labelledby="nomina-sua-isn-heading" className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Calculator className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="nomina-sua-isn-heading" className="text-sm font-bold text-slate-900">Provisión Mensual SUA (IMSS / RCV / INFONAVIT) e ISN Estatal</h2>
                {existingSuaPoliza && (
                  <StatusBadge tone="emerald" icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}>
                    Póliza SUA/ISN (#{existingSuaPoliza.folio})
                  </StatusBadge>
                )}
                {isDirty && <StatusBadge tone="amber">Cambios sin guardar</StatusBadge>}
              </div>
              <p className="text-xs text-slate-600">Calcula el Impuesto Sobre Nómina estatal (tasa editable y persistente por periodo) y genera la póliza cuadrada</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              loading={saveSettingsMutation.isPending}
              disabled={isLocked}
              onClick={() => saveSettingsMutation.mutate()}
              title={lockReason ?? 'Guardar estado, tasa ISN y cuotas SUA para este periodo'}
              leftIcon={saveSettingsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              {saveSettingsMutation.isPending ? 'Guardando...' : 'Guardar Parámetros'}
            </Button>
            <Button
              variant="primary"
              loading={createPolizaMutation.isPending}
              disabled={isLocked || !provision}
              onClick={() => provision && setConfirmPoliza(true)}
              title={polizaButtonTitle}
              leftIcon={createPolizaMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
            >
              {createPolizaMutation.isPending ? 'Registrando Póliza...' : 'Registrar Póliza de Provisión SUA + ISN'}
            </Button>
          </div>
        </div>

        {confirmPoliza && provision && (
          <div
            role="alertdialog"
            aria-label="Confirmación de póliza SUA e ISN"
            onKeyDown={(e) => { if (e.key === 'Escape') setConfirmPoliza(false); }}
          >
            <AlertBanner
              tone="warning"
              action={
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" autoFocus onClick={() => setConfirmPoliza(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={createPolizaMutation.isPending}
                    disabled={isLocked}
                    onClick={() => createPolizaMutation.mutate({ prov: provision, targetCompanyId: activeCompanyId })}
                    title={lockReason ?? 'Confirmar y registrar póliza de diario'}
                    leftIcon={createPolizaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : undefined}
                  >
                    {createPolizaMutation.isPending ? 'Registrando...' : 'Confirmar'}
                  </Button>
                </div>
              }
            >
              {existingSuaPoliza
                ? `Ya existe una póliza SUA/ISN (#${existingSuaPoliza.folio}) en este periodo. ¿Deseas generar otra póliza de DIARIO por `
                : 'Se generará una póliza de DIARIO por '}
              <strong className="font-mono tabular-nums">{formatCurrency(provision.totalProvision)}</strong> con fecha <strong className="font-mono">{formatShortDate(polizaDate)}</strong>.
            </AlertBanner>
          </div>
        )}

        <NominaSuaIsnFormGrid
          isLocked={isLocked}
          lockReason={lockReason}
          stateCode={stateCode}
          selectedStateNotes={selectedState?.notes}
          isnRateInput={isnRateInput}
          baseInput={baseInput}
          totalPercepciones={summary.totalPercepciones}
          resolvedBase={resolvedBase}
          imssInput={imssInput}
          rcvInput={rcvInput}
          infonavitInput={infonavitInput}
          onStateChange={(code) => { handleStateChange(code); setConfirmPoliza(false); }}
          onIsnRateChange={(val) => { setIsnRateInput(val); setConfirmPoliza(false); }}
          onBaseChange={(val) => { setBaseInput(val); setConfirmPoliza(false); }}
          onImssChange={(val) => { setImssInput(val); setConfirmPoliza(false); }}
          onRcvChange={(val) => { setRcvInput(val); setConfirmPoliza(false); }}
          onInfonavitChange={(val) => { setInfonavitInput(val); setConfirmPoliza(false); }}
        />

        {provision ? (
          <NominaProvisionPreviewTable provision={provision} />
        ) : provisionError ? (
          <AlertBanner tone="danger">{provisionError}</AlertBanner>
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

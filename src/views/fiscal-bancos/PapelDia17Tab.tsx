import { AlertCircle, Calculator, Check, Copy, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { AlertBanner, Button, EmptyState, StatusBadge } from '../../components/ui';
import { useCompany } from '../../context/CompanyContext';
import { calculateDia17Deadline } from '../../shared/date-utils';
import {
  PapelDia17IsrCard,
  PapelDia17IvaCard,
  PapelDia17UsdCard
} from './PapelDia17Cards';
import { PapelDia17DypDrawer } from './PapelDia17DypDrawer';
import { PapelDia17ParamsForm } from './PapelDia17ParamsForm';
import { PapelDia17SummaryBar } from './PapelDia17SummaryBar';
import { ResicoCashBasisBanner } from './ResicoCashBasisBanner';
import { usePapelDia17 } from './usePapelDia17';

export interface PapelDia17TabProps {
  companyId: string;
  year: number;
  period: number;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
  onOpenDeliverable?: (tab: 'DOSSIER' | 'BALANZA' | 'RESULTADOS' | 'BALANCE' | 'DIA17' | 'CONFIG') => void;
}

export function PapelDia17Tab({
  companyId,
  year,
  period,
  isPeriodLocked = false,
  isReadOnlyClient: isReadOnlyClientProp = false,
  onFeedback,
  onOpenDeliverable
}: PapelDia17TabProps) {
  const { isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const isWriteLocked = isPeriodLocked || isReadOnly;
  const lockTitle = isReadOnly ? 'Modo solo lectura' : 'Periodo fiscal bloqueado ante el SAT';
  const unsavedTitle = 'Aplica los cambios con Recalcular antes de continuar';

  const {
    workpaper,
    loadingWp,
    isErrorWp,
    errorWp,
    refetchWp,
    draftParams,
    updateDraftField,
    normalizeDraftField,
    hasUnsavedParams,
    resetTaxParams,
    copiedSatDyp,
    handleCopySatDyp,
    saveTaxParamsMutation,
    genTaxProvisionMutation,
    genExchangePolizaMutation
  } = usePapelDia17({ companyId, year, period, isPeriodLocked, isReadOnlyClient: isReadOnly, onFeedback });

  if (isErrorWp) {
    return (
      <div role="alert" className="max-w-lg mx-auto my-12">
        <EmptyState
          variant="card"
          tone="red"
          icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
          title="Error al calcular Papel de Trabajo Día 17"
          description={errorWp instanceof Error ? errorWp.message : 'Error de conexión'}
          actions={
            <Button
              variant="primary"
              onClick={() => void refetchWp()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
            >
              Reintentar cálculo
            </Button>
          }
        />
      </div>
    );
  }

  if (loadingWp || !workpaper) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="p-10 bg-white rounded-2xl border border-slate-300 text-center text-xs text-slate-600">
        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-blue-600" aria-hidden="true" />
        Calculando Papel de Trabajo Fiscal Día 17 (ISR Provisional + IVA Definitivo + Fluctuación Cambiaria)...
      </div>
    );
  }

  const cap = workpaper.resumenLineaCapturaSat;
  const isResico = workpaper.isrProvisional.esResico;
  const isPersonaFisica = workpaper.company.rfc.trim().length === 13;
  const isResicoPf = isResico && isPersonaFisica;
  const isPfGeneral = isPersonaFisica && !isResico;
  const deadline = calculateDia17Deadline(year, period);
  const periodBadge = `P${String(period).padStart(2, '0')}/${year} · Límite SAT: ${deadline.formattedSpanish}`;

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Calculator className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Papel de Trabajo Fiscal Día 17 — Parámetros de Cálculo ({workpaper.company.regimenFiscal})
                </h2>
                <StatusBadge tone="blue" className="font-mono">
                  {periodBadge}
                </StatusBadge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {isResicoPf
                  ? 'RESICO Persona Física (Art. 113-E LISR): tributa sobre ingresos brutos cobrados; ajusta saldo a favor de IVA o tipo de cambio DOF'
                  : isResico
                    ? 'RESICO Persona Moral (Flujo de Efectivo): ajusta pérdidas fiscales por amortizar, pagos provisionales anteriores, saldo a favor de IVA o tipo de cambio DOF'
                    : isPfGeneral
                      ? 'Persona Física (Art. 106 LISR — Tarifa Progresiva): ajusta pérdidas fiscales, pagos provisionales anteriores, saldo a favor de IVA o tipo de cambio DOF'
                      : 'Ajusta el Coeficiente de Utilidad (Art. 14 LISR), pérdidas fiscales por amortizar, saldo a favor de IVA o tipo de cambio DOF'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="visually-hidden" role="status" aria-live="polite">
              {copiedSatDyp ? 'Datos estructurados para Declaraciones y Pagos SAT copiados al portapapeles' : ''}
            </span>
            <Button
              variant="secondary"
              disabled={hasUnsavedParams}
              onClick={handleCopySatDyp}
              title={hasUnsavedParams ? unsavedTitle : 'Copiar datos estructurados para llenar el formulario de Declaraciones y Pagos (DyP) en el portal del SAT'}
              leftIcon={copiedSatDyp ? <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" /> : <Copy className="w-4 h-4 text-slate-600" aria-hidden="true" />}
            >
              <span className={copiedSatDyp ? 'text-emerald-700 font-bold' : ''}>
                {copiedSatDyp ? '¡Copiado para DyP!' : 'Copiar para DyP SAT'}
              </span>
            </Button>

            {onOpenDeliverable && (
              <Button
                variant="secondary"
                disabled={hasUnsavedParams}
                title={hasUnsavedParams ? unsavedTitle : 'Abrir Cédula y Firmas Día 17 para impresión PDF'}
                onClick={() => onOpenDeliverable('DIA17')}
                leftIcon={<FileText className="w-4 h-4 text-blue-700" aria-hidden="true" />}
                className="border-blue-300 text-blue-900"
              >
                Cédula y Firmas Día 17 (PDF)
              </Button>
            )}

            <Button
              variant="primary"
              disabled={genTaxProvisionMutation.isPending || isWriteLocked || hasUnsavedParams}
              aria-busy={genTaxProvisionMutation.isPending}
              title={isWriteLocked ? lockTitle : hasUnsavedParams ? unsavedTitle : 'Contabilizar provisión mensual de ISR e IVA'}
              onClick={() => genTaxProvisionMutation.mutate()}
              leftIcon={
                genTaxProvisionMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  : <Sparkles className="w-4 h-4" aria-hidden="true" />
              }
            >
              {genTaxProvisionMutation.isPending ? 'Contabilizando Provisión...' : 'Generar Póliza de Provisión ISR + IVA'}
            </Button>
          </div>
        </div>

        <PapelDia17ParamsForm
          isResico={isResico}
          isResicoPf={isResicoPf}
          isPfGeneral={isPfGeneral}
          isWriteLocked={isWriteLocked}
          lockTitle={lockTitle}
          draftParams={draftParams}
          updateDraftField={updateDraftField}
          normalizeDraftField={normalizeDraftField}
          hasUnsavedParams={hasUnsavedParams}
          isSaving={saveTaxParamsMutation.isPending}
          onSave={() => saveTaxParamsMutation.mutate()}
          onReset={resetTaxParams}
        />

        {hasUnsavedParams && (
          <AlertBanner tone="warning">
            Tienes parámetros modificados sin aplicar. Haz clic en <strong>Recalcular</strong> para actualizar el ISR, IVA y valuación cambiaria.
          </AlertBanner>
        )}
      </div>

      <PapelDia17SummaryBar
        cap={cap}
        saldoFavorIvaRemanente={workpaper.ivaDefinitivo.saldoFavorIvaRemanente}
        year={year}
        period={period}
        retencionesDesglose={workpaper.retencionesDesglose}
      />

      <PapelDia17DypDrawer
        workpaper={workpaper}
        year={year}
        period={period}
        hasUnsavedParams={hasUnsavedParams}
        onCopyFullGuide={handleCopySatDyp}
        copiedFullGuide={copiedSatDyp}
      />

      <ResicoCashBasisBanner workpaper={workpaper} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <PapelDia17IsrCard workpaper={workpaper} period={period} />
        <PapelDia17IvaCard workpaper={workpaper} />
        <PapelDia17UsdCard
          workpaper={workpaper}
          isPeriodLocked={isPeriodLocked}
          isReadOnlyClient={isReadOnly}
          hasUnsavedParams={hasUnsavedParams}
          genExchangePolizaMutation={genExchangePolizaMutation}
        />
      </div>
    </div>
  );
}

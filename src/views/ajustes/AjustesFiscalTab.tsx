import { Link } from '@tanstack/react-router';
import { ArrowRight, Coins, Loader2, RotateCcw, Save } from 'lucide-react';
import { AlertBanner, Button, FormField, Input, StatusBadge, getButtonClasses } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import { sanitizeFiscalDecimalInput } from './useAjustesFiscalParams';

export interface AjustesFiscalTabProps {
  currentYear: number;
  currentPeriod: number;
  coefUtilidad: string;
  setCoefUtilidad: (v: string) => void;
  tcDof: string;
  setTcDof: (v: string) => void;
  perdidasAnt: string;
  setPerdidasAnt: (v: string) => void;
  pagosAnt: string;
  setPagosAnt: (v: string) => void;
  saldoIvaAnt: string;
  setSaldoIvaAnt: (v: string) => void;
  isFiscalDirty: boolean;
  onResetFiscal: () => void;
  saveFiscalParamsMutation: {
    mutate: () => void;
    isPending: boolean;
  };
  fiscalWp?: {
    isrProvisional: {
      ingresosAcumuladosEjercicio: number;
      utilidadFiscalEstimada: number;
      isrNetoAPagar: number;
    };
    ivaDefinitivo: {
      ivaNetoAPagar: number;
    };
  } | null;
  isLoadingFiscalWp?: boolean;
  isReadOnly?: boolean;
}

function normalizeDecimalDraft(raw: string, max?: number): string {
  const num = Number(raw.replaceAll(',', '.').trim());
  if (!Number.isFinite(num) || num < 0) return '0';
  return String(max !== undefined ? Math.min(max, num) : num);
}

export function AjustesFiscalTab({
  currentYear,
  currentPeriod,
  coefUtilidad,
  setCoefUtilidad,
  tcDof,
  setTcDof,
  perdidasAnt,
  setPerdidasAnt,
  pagosAnt,
  setPagosAnt,
  saldoIvaAnt,
  setSaldoIvaAnt,
  isFiscalDirty,
  onResetFiscal,
  saveFiscalParamsMutation,
  fiscalWp,
  isLoadingFiscalWp = false,
  isReadOnly = false
}: AjustesFiscalTabProps) {
  return (
    <section className="space-y-5">
      {isReadOnly && (
        <AlertBanner tone="info">
          Modo solo consulta: los parámetros fiscales están bloqueados para edición.
        </AlertBanner>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isReadOnly) saveFiscalParamsMutation.mutate();
          }}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                Cálculo de Pagos Provisionales (LISR Art. 14 / RESICO)
              </h2>
              <p className="text-xs text-slate-600">
                Parámetros base utilizados para la Cédula Fiscal y determinación de impuestos a pagar el Día 17.
              </p>
            </div>

            <Link
              to="/fiscal-bancos"
              search={{ tab: 'DIA17' } as unknown as Record<string, string>}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition shrink-0"
            >
              Ver Cédula Día 17
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          {isLoadingFiscalWp ? (
            <div role="status" aria-live="polite" aria-busy="true" className="p-6 text-center text-xs text-slate-600 space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" aria-hidden="true" />
              <p>Cargando parámetros fiscales del periodo...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                htmlFor="p-cu"
                label="Coeficiente de Utilidad (C.U. Art. 14 LISR)"
                required
                hint={
                  <>
                    Margen fiscal equivalente:{' '}
                    <strong className="font-mono text-slate-800">
                      {((Number(coefUtilidad) || 0) * 100).toFixed(2)}%
                    </strong>
                  </>
                }
              >
                <Input
                  id="p-cu"
                  type="text"
                  inputMode="decimal"
                  required
                  disabled={isReadOnly}
                  value={coefUtilidad}
                  onChange={(e) => setCoefUtilidad(sanitizeFiscalDecimalInput(e.target.value))}
                  onBlur={() => setCoefUtilidad(normalizeDecimalDraft(coefUtilidad, 1))}
                  rightAddon={<span className="font-mono font-bold">C.U.</span>}
                  className="pr-12 font-mono font-bold"
                />
              </FormField>

              <FormField
                htmlFor="p-tc"
                label="Tipo de Cambio DOF al Cierre del Mes (USD/MXN)"
                required
                hint="Para valuación de fluctuación cambiaria oficial (0 para empresas solo MXN)."
              >
                <Input
                  id="p-tc"
                  type="text"
                  inputMode="decimal"
                  required
                  disabled={isReadOnly}
                  value={tcDof}
                  onChange={(e) => setTcDof(sanitizeFiscalDecimalInput(e.target.value))}
                  onBlur={() => setTcDof(normalizeDecimalDraft(tcDof))}
                  rightAddon={<span className="font-mono font-bold">MXN/USD</span>}
                  className="pr-20 font-mono font-bold"
                />
              </FormField>

              <FormField
                htmlFor="p-perdidas"
                label="Pérdidas Fiscales de Ejercicios Anteriores Pendientes"
                hint="Amortizables contra la utilidad fiscal estimada."
              >
                <Input
                  id="p-perdidas"
                  type="text"
                  inputMode="decimal"
                  disabled={isReadOnly}
                  value={perdidasAnt}
                  onChange={(e) => setPerdidasAnt(sanitizeFiscalDecimalInput(e.target.value))}
                  onBlur={() => setPerdidasAnt(normalizeDecimalDraft(perdidasAnt))}
                  leftAddon={<span className="font-mono font-bold">$</span>}
                  rightAddon={<span className="font-mono">MXN</span>}
                  className="pr-12 font-mono font-bold"
                />
              </FormField>

              <FormField
                htmlFor="p-pagos-ant"
                label="Pagos Provisionales de ISR Efectuados con Anterioridad"
                hint="Suma de pagos de ISR realizados de enero al mes previo."
              >
                <Input
                  id="p-pagos-ant"
                  type="text"
                  inputMode="decimal"
                  disabled={isReadOnly}
                  value={pagosAnt}
                  onChange={(e) => setPagosAnt(sanitizeFiscalDecimalInput(e.target.value))}
                  onBlur={() => setPagosAnt(normalizeDecimalDraft(pagosAnt))}
                  leftAddon={<span className="font-mono font-bold">$</span>}
                  rightAddon={<span className="font-mono">MXN</span>}
                  className="pr-12 font-mono font-bold"
                />
              </FormField>

              <FormField
                htmlFor="p-iva-ant"
                label="Saldo a Favor de IVA de Meses Anteriores por Acreditar"
                hint="Acreditamiento directo contra el IVA a cargo del periodo."
                className="sm:col-span-2"
              >
                <Input
                  id="p-iva-ant"
                  type="text"
                  inputMode="decimal"
                  disabled={isReadOnly}
                  value={saldoIvaAnt}
                  onChange={(e) => setSaldoIvaAnt(sanitizeFiscalDecimalInput(e.target.value))}
                  onBlur={() => setSaldoIvaAnt(normalizeDecimalDraft(saldoIvaAnt))}
                  leftAddon={<span className="font-mono font-bold">$</span>}
                  rightAddon={<span className="font-mono">MXN</span>}
                  className="pr-12 font-mono font-bold"
                />
              </FormField>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
            <div className="flex items-center gap-2">
              {isFiscalDirty && <StatusBadge tone="amber">Cambios sin guardar</StatusBadge>}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {isFiscalDirty && !isReadOnly && (
                <Button
                  variant="secondary"
                  title="Descartar cambios y restaurar valores guardados"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}
                  onClick={onResetFiscal}
                >
                  Restablecer
                </Button>
              )}
              <Button
                type="submit"
                variant="export"
                disabled={isReadOnly || saveFiscalParamsMutation.isPending || !isFiscalDirty}
                loading={saveFiscalParamsMutation.isPending}
                title={
                  isReadOnly
                    ? 'Solo un Contador o Socio puede modificar parámetros fiscales'
                    : !isFiscalDirty
                      ? 'No hay cambios pendientes por guardar'
                      : 'Guardar parámetros fiscales del periodo'
                }
                leftIcon={
                  saveFiscalParamsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="w-4 h-4" aria-hidden="true" />
                  )
                }
              >
                {saveFiscalParamsMutation.isPending ? 'Guardando...' : 'Guardar Parámetros Fiscales'}
              </Button>
            </div>
          </div>
        </form>

        {/* Tarjeta Informativa de la Cédula Actual */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-blue-700" aria-hidden="true" />
                Cédula Fiscal del Periodo
              </h3>
              <StatusBadge tone="blue" shape="tag">
                P{String(currentPeriod).padStart(2, '0')}/{currentYear}
              </StatusBadge>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Ingresos Acumulados:</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">
                  {formatCurrency(fiscalWp?.isrProvisional.ingresosAcumuladosEjercicio ?? 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Utilidad Estimada:</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">
                  {formatCurrency(fiscalWp?.isrProvisional.utilidadFiscalEstimada ?? 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">ISR Provisional a Pagar:</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700">
                  {formatCurrency(fiscalWp?.isrProvisional.isrNetoAPagar ?? 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">IVA Definitivo a Pagar:</span>
                <span className="font-mono tabular-nums font-bold text-blue-700">
                  {formatCurrency(fiscalWp?.ivaDefinitivo.ivaNetoAPagar ?? 0)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/fiscal-bancos"
                search={{ tab: 'DIA17' } as unknown as Record<string, string>}
                className={getButtonClasses('primary', 'md', 'w-full')}
              >
                Generar Póliza de Provisión
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

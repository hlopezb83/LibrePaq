import { Link } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2, CloudDownload, Loader2, Sparkles } from 'lucide-react';
import { Button, EmptyState, StatusBadge, getButtonClasses } from '../../components/ui';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { CfdiDocument } from '../../shared/types';

export interface DashboardAddAutomationSectionProps {
  pendingCfdis: CfdiDocument[];
  cfdisPendientesContabilizar?: number;
  isBatchPending: boolean;
  onBatchAutoPoliza: (ids: string[]) => void;
  isSinglePending: boolean;
  pendingCfdiId?: string | null;
  onSingleAutoPoliza: (id: string) => void;
  isPeriodLocked?: boolean;
  isReadOnly?: boolean;
  cfdisTotalesPeriodo?: number;
}

export function DashboardAddAutomationSection({
  pendingCfdis,
  cfdisPendientesContabilizar,
  isBatchPending,
  onBatchAutoPoliza,
  isSinglePending,
  pendingCfdiId = null,
  onSingleAutoPoliza,
  isPeriodLocked = false,
  isReadOnly = false,
  cfdisTotalesPeriodo
}: DashboardAddAutomationSectionProps) {
  const totalPending = cfdisPendientesContabilizar ?? pendingCfdis.length;
  const isTruncated = totalPending > pendingCfdis.length && pendingCfdis.length > 0;
  const isWriteSuppressed = isPeriodLocked || isReadOnly;
  const isAnyPending = isBatchPending || isSinglePending;

  return (
    <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-300/90 shadow-2xs flex flex-col min-w-0">
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Contabilizador Automático ADD (CFDI 4.0)
            </h2>
            {totalPending > 0 && (
              <StatusBadge tone="amber" className="font-mono tabular-nums">
                {totalPending} {totalPending === 1 ? 'pendiente' : 'pendientes'}
              </StatusBadge>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Convierte tus archivos XML del SAT en pólizas cuadradas automáticamente sin captura manual
            {isTruncated && (
              <span className="ml-1.5 font-semibold text-amber-800">
                (Mostrando {pendingCfdis.length} de {totalPending} pendientes)
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pendingCfdis.length > 1 && !isWriteSuppressed && (
            <Button
              variant="secondary"
              size="sm"
              loading={isBatchPending}
              disabled={isAnyPending}
              title={
                isAnyPending
                  ? 'Procesando generación de pólizas contables...'
                  : isTruncated
                  ? `Contabilizar lote visible (${pendingCfdis.length} de ${totalPending} pendientes)`
                  : `Contabilizar lote de ${pendingCfdis.length} CFDIs pendientes`
              }
              onClick={() => onBatchAutoPoliza(pendingCfdis.map((c) => c.id))}
              leftIcon={
                isBatchPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                )
              }
            >
              {isBatchPending ? 'Contabilizando...' : `Contabilizar lote (${pendingCfdis.length})`}
            </Button>
          )}
          <Link
            to="/add"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
          >
            Abrir ADD <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="p-5 flex-1">
        {pendingCfdis.length === 0 ? (
          <EmptyState
            tone={(cfdisTotalesPeriodo ?? 0) === 0 ? 'blue' : 'emerald'}
            icon={
              (cfdisTotalesPeriodo ?? 0) === 0 ? (
                <CloudDownload className="w-6 h-6" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              )
            }
            title={
              (cfdisTotalesPeriodo ?? 0) === 0
                ? 'Aún no tienes facturas registradas en este periodo'
                : '¡Todos los CFDIs del ADD están contabilizados!'
            }
            description={
              (cfdisTotalesPeriodo ?? 0) === 0
                ? isWriteSuppressed
                  ? 'Modo solo consulta: no hay comprobantes XML registrados para revisar en este periodo.'
                  : 'Sincroniza automáticamente tus facturas del SAT con tu e.firma o sube tus archivos XML en la Bóveda ADD.'
                : 'Todas tus facturas del periodo cuentan con su póliza contable correspondiente.'
            }
            actions={
              !isWriteSuppressed ? (
                <>
                  <Link
                    to="/add"
                    search={{ sat: 'open' }}
                    className={getButtonClasses('primary', 'md')}
                  >
                    <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Descargar del SAT (e.firma)</span>
                  </Link>
                  <Link to="/add" className={getButtonClasses('secondary', 'md')}>
                    Subir Archivos XML
                  </Link>
                </>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {pendingCfdis.map((cfdi) => {
              const serieFolio = [cfdi.serie, cfdi.folio].filter(Boolean).join('-') || 'S/F';
              const isRowPending = isSinglePending && pendingCfdiId === cfdi.id;
              return (
                <div
                  key={cfdi.id}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge
                        tone={cfdi.direction === 'EMITIDO' ? 'emerald' : 'blue'}
                        shape="tag"
                      >
                        {cfdi.direction} ({cfdi.metodoPago})
                      </StatusBadge>
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {serieFolio}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 truncate min-w-0">
                        {cfdi.direction === 'EMITIDO' ? cfdi.receptorNombre : cfdi.emisorNombre}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate" title={cfdi.conceptoPrincipal}>
                      {cfdi.conceptoPrincipal}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 font-mono">
                      <span title={cfdi.uuid}>UUID: {cfdi.uuid.slice(0, 18)}...</span>
                      <span aria-hidden="true">•</span>
                      <span>{formatShortDate(cfdi.fecha)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrency(cfdi.total)}
                      </div>
                      <div className="text-[10px] text-slate-600 font-mono tabular-nums">
                        IVA: {formatCurrency(cfdi.ivaTrasladado)}
                      </div>
                    </div>
                    {!isWriteSuppressed ? (
                      <Button
                        variant="primary"
                        size="md"
                        loading={isRowPending}
                        disabled={isAnyPending}
                        aria-label={`Generar póliza para CFDI ${serieFolio} (${cfdi.uuid.slice(0, 8)})`}
                        title={
                          isRowPending
                            ? 'Generando póliza contable...'
                            : isAnyPending
                            ? 'Procesando otra póliza contable...'
                            : 'Generar póliza cuadrada desde este CFDI'
                        }
                        onClick={() => onSingleAutoPoliza(cfdi.id)}
                        leftIcon={
                          isRowPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          )
                        }
                      >
                        {isRowPending ? 'Generando...' : 'Generar Póliza'}
                      </Button>
                    ) : (
                      <StatusBadge tone="slate">Solo consulta</StatusBadge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

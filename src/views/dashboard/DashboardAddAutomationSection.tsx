import { Link } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2, CloudDownload, Loader2, Sparkles } from 'lucide-react';
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

  return (
    <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-300/90 shadow-2xs flex flex-col min-w-0">
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Contabilizador Automático ADD (CFDI 4.0)
            </h2>
            {totalPending > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-mono tabular-nums">
                {totalPending} {totalPending === 1 ? 'pendiente' : 'pendientes'}
              </span>
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
          {pendingCfdis.length > 1 && (
            <button
              type="button"
              disabled={isBatchPending || isPeriodLocked || isReadOnly}
              title={
                isReadOnly
                  ? 'Modo solo lectura: no tienes permisos para generar pólizas'
                  : isPeriodLocked
                  ? 'Periodo cerrado con candado fiscal'
                  : isTruncated
                  ? `Contabilizar lote visible (${pendingCfdis.length} de ${totalPending} pendientes)`
                  : `Contabilizar lote de ${pendingCfdis.length} CFDIs pendientes`
              }
              onClick={() => onBatchAutoPoliza(pendingCfdis.map((c) => c.id))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-800 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200 cursor-pointer"
            >
              {isBatchPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {isBatchPending ? 'Contabilizando...' : `Contabilizar lote (${pendingCfdis.length})`}
            </button>
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
          <div className="h-full py-10 text-center space-y-2">
            {(cfdisTotalesPeriodo ?? 0) === 0 ? (
              <>
                <div className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center mx-auto shadow-2xs">
                  <CloudDownload className="w-6 h-6" aria-hidden="true" />
                </div>
                <p className="text-sm font-bold text-slate-900">
                  Aún no tienes facturas registradas en este periodo
                </p>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Sincroniza automáticamente tus facturas del SAT con tu e.firma o sube tus archivos XML en la Bóveda ADD.
                </p>
              </>
            ) : (
              <>
                <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                </div>
                <p className="text-sm font-bold text-slate-900">
                  ¡Todos los CFDIs del ADD están contabilizados!
                </p>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Todas tus facturas del periodo cuentan con su póliza contable correspondiente.
                </p>
              </>
            )}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <Link
                to="/add"
                search={{ sat: 'open' }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
              >
                <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Descargar del SAT (e.firma)</span>
              </Link>
              <Link
                to="/add"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
              >
                Subir Archivos XML
              </Link>
            </div>
          </div>
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
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                          cfdi.direction === 'EMITIDO'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                      >
                        {cfdi.direction} ({cfdi.metodoPago})
                      </span>
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
                    <button
                      type="button"
                      disabled={isSinglePending || isPeriodLocked || isReadOnly}
                      aria-busy={isRowPending}
                      aria-label={`Generar póliza para CFDI ${serieFolio} (${cfdi.uuid.slice(0, 8)})`}
                      title={
                        isReadOnly
                          ? 'Modo solo lectura: no tienes permisos para generar pólizas'
                          : isPeriodLocked
                          ? 'Periodo cerrado con candado fiscal'
                          : isRowPending
                          ? 'Generando póliza contable...'
                          : isSinglePending
                          ? 'Procesando otra póliza contable...'
                          : 'Generar póliza cuadrada desde este CFDI'
                      }
                      onClick={() => onSingleAutoPoliza(cfdi.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                    >
                      {isRowPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>{isRowPending ? 'Generando...' : 'Generar Póliza'}</span>
                    </button>
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

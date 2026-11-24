import { CheckCircle2, Copy, FileCheck, Receipt, Sparkles } from 'lucide-react';
import type { SatDownloadRequestRecord } from '../../../shared/types';
import { useToast } from '../../../context/ToastContext';

export interface SatCelebrationSuccessCardProps {
  latestCompleted: SatDownloadRequestRecord;
  totalDownloaded: number;
  pendingCfdisCount?: number;
  onBatchAutoPoliza?: () => void;
  isBatchAutoPolizaPending?: boolean;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
}

export function SatCelebrationSuccessCard({
  latestCompleted,
  totalDownloaded,
  pendingCfdisCount = 0,
  onBatchAutoPoliza,
  isBatchAutoPolizaPending = false,
  isPeriodLocked = false,
  isReadOnlyClient = false
}: SatCelebrationSuccessCardProps) {
  const toast = useToast();
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;

  const handleCopyFolio = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(latestCompleted.idSolicitudSat);
      toast.success('Folio SAT Copiado', latestCompleted.idSolicitudSat);
    }
  };

  const handleScrollToVault = () => {
    const el = document.getElementById('cfdi-table-wrapper') || document.querySelector('[role="table"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-blue-50/60 border-2 border-emerald-300/80 shadow-xs space-y-3.5">
      {/* Encabezado de Éxito SAT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className="text-xs sm:text-sm font-bold text-emerald-950">
                ¡Sincronización SAT Exitosa!
              </h5>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/80 text-emerald-900 font-mono">
                OFICIAL SAT
              </span>
            </div>
            <p className="text-xs text-emerald-800 mt-0.5">
              {totalDownloaded > 0
                ? `${totalDownloaded} comprobante(s) integrados con éxito a tu Bóveda ADD.`
                : 'El SAT confirmó que no existen comprobantes emitidos ni recibidos en este rango. Tu Bóveda está 100% al corriente.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center font-mono text-[11px] text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200">
          <span>Folio SAT:</span>
          <strong className="text-slate-900 truncate max-w-[120px] sm:max-w-[160px]" title={latestCompleted.idSolicitudSat}>
            {latestCompleted.idSolicitudSat.slice(0, 8)}...
          </strong>
          <button
            type="button"
            onClick={handleCopyFolio}
            title="Copiar Folio SAT"
            aria-label="Copiar Folio SAT al portapapeles"
            className="p-0.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Puente al "Aha! Moment": Contabilización en 1 Clic */}
      {pendingCfdisCount > 0 ? (
        <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-2xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>¿Deseas contabilizar estos comprobantes ahora?</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Tienes <strong className="text-slate-800 font-semibold">{pendingCfdisCount} facturas</strong> sin póliza en este periodo. LibrePaq Pro puede generar sus asientos contables cuadrados en 2 segundos.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onBatchAutoPoliza && (
                <button
                  type="button"
                  disabled={isBatchAutoPolizaPending || isWriteBlocked}
                  title={
                    isReadOnlyClient
                      ? 'Modo solo lectura'
                      : isPeriodLocked
                      ? 'Periodo bloqueado ante el SAT'
                      : undefined
                  }
                  onClick={onBatchAutoPoliza}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" aria-hidden="true" />
                  <span>
                    {isBatchAutoPolizaPending
                      ? 'Generando pólizas...'
                      : isReadOnlyClient
                      ? 'Solo Lectura'
                      : isPeriodLocked
                      ? 'Periodo Bloqueado'
                      : `Generar ${pendingCfdisCount} Auto-Pólizas`}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleScrollToVault}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 transition cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                <span>Ver Facturas</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[11px] text-emerald-900 font-medium pt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span>Todas las facturas de este periodo ya cuentan con póliza contable asociada.</span>
        </div>
      )}
    </div>
  );
}

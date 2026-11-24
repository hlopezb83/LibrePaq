import { Loader2 } from 'lucide-react';
import type { Sat69BParseResult } from '../../shared/sat-69b';

export interface Importar69BStatusPanelsProps {
  parseError: string | null;
  isProcessing: boolean;
  syncProgress: { done: number; total: number } | null;
  syncPct: number;
  parseResult: Sat69BParseResult | null;
}

export function Importar69BStatusPanels({
  parseError,
  isProcessing,
  syncProgress,
  syncPct,
  parseResult
}: Importar69BStatusPanelsProps) {
  return (
    <>
      {parseError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 font-medium">
          {parseError}
        </div>
      )}

      {isProcessing && (
        <div role="status" aria-live="polite" aria-busy="true" className="text-center py-2 text-slate-600 font-semibold">
          Procesando y clasificando registros oficiales del SAT...
        </div>
      )}

      {syncProgress && (
        <div role="status" aria-live="polite" className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-semibold space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              <span>
                Sincronizando en la nube ({syncProgress.done.toLocaleString()} / {syncProgress.total.toLocaleString()} RFCs)
              </span>
            </span>
            <span className="font-mono tabular-nums text-xs">{syncPct}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={syncPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso de sincronización del padrón 69-B"
            className="w-full h-2 rounded-full bg-blue-100 overflow-hidden"
          >
            <div className="h-full bg-blue-700 transition-all duration-200" style={{ width: `${syncPct}%` }} />
          </div>
        </div>
      )}

      {parseResult && !isProcessing && (
        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2.5">
          <div className="font-bold text-slate-800 flex items-center justify-between">
            <span>Resumen del Archivo Importado:</span>
            <span className="font-mono tabular-nums text-slate-900 font-bold">
              {parseResult.total.toLocaleString()} contribuyentes
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {[
              { label: 'Definitivos', val: parseResult.definitivos, cls: 'bg-red-100/70 border-red-200 text-red-900' },
              { label: 'Presuntos', val: parseResult.presuntos, cls: 'bg-amber-100/70 border-amber-200 text-amber-900' },
              { label: 'Desvirtuados', val: parseResult.desvirtuados, cls: 'bg-blue-100/70 border-blue-200 text-blue-900' },
              { label: 'Sentencia Fav.', val: parseResult.favorables, cls: 'bg-emerald-100/70 border-emerald-200 text-emerald-900' }
            ].map((card) => (
              <div key={card.label} className={`border rounded-lg p-2 ${card.cls}`}>
                <div className="font-bold">{card.label}</div>
                <div className="font-mono tabular-nums text-base font-extrabold">{card.val.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

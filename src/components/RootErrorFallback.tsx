import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import type { ErrorComponentProps } from '@tanstack/react-router';

/**
 * RootErrorFallback — Previene pantallas blancas (White Screen of Death)
 * Atrapa cualquier fallo no controlado de render en rutas o vistas secundarias.
 */
export function RootErrorFallback({ error, reset }: ErrorComponentProps) {
  const errorMessage = error instanceof Error ? error.message : String(error || 'Error inesperado');

  return (
    <div
      role="alert"
      className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center bg-slate-900/60 rounded-xl border border-red-500/20 m-4 my-8"
    >
      <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
        <AlertTriangle className="w-7 h-7" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold text-slate-100 mb-2">
        Interrupción en el Módulo Contable
      </h2>
      <p className="text-sm text-slate-300 max-w-md mb-4">
        Ocurrió un error inesperado al procesar la información. Tus datos locales o borradores previos siguen resguardados.
      </p>

      <details className="max-w-lg w-full mb-6 text-left p-3 bg-slate-950/80 rounded-lg border border-slate-800">
        <summary className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
          Ver detalle técnico del error
        </summary>
        <div className="mt-2 pt-2 border-t border-slate-800 text-xs font-mono text-red-300 overflow-x-auto">
          {errorMessage}
        </div>
      </details>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (reset) reset();
            else window.location.reload();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Reintentar Carga
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-colors"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          Ir al Inicio
        </a>
      </div>
    </div>
  );
}

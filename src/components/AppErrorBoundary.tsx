import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[LibrePaq Pro Module Error]', error, errorInfo);
  }

  public reset = () => {
    this.setState({ hasError: false, error: null });
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const msg = this.state.error?.message || 'Error inesperado en el módulo contable';

      return (
        <div
          role="alert"
          className="p-6 my-4 bg-white rounded-2xl border border-red-200 shadow-2xs text-center max-w-xl mx-auto"
        >
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Interrupción en el Módulo Contable
          </h3>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">
            Ocurrió un error inesperado al procesar la vista. Tu empresa activa, menú de navegación y sesión permanecen intactos.
          </p>
          <details className="max-w-md mx-auto mb-4 text-left bg-slate-50 rounded-xl border border-slate-200 p-2.5">
            <summary className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
              Ver detalle técnico del error
            </summary>
            <div className="mt-2 pt-2 border-t border-slate-200 text-xs font-mono text-red-700 overflow-x-auto">
              {msg}
            </div>
          </details>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reintentar Vista</span>
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 transition"
            >
              <Home className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Ir al Tablero</span>
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Building2, Calendar, FileCode2, Keyboard, Sparkles } from 'lucide-react';

export function AjustesAtajosTab() {
  return (
    <section className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-300/90 p-5 shadow-2xs space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-700" aria-hidden="true" />
            Guía de Atajos de Teclado Profesionales para Contadores
          </h2>
          <p className="text-xs text-slate-600">
            Diseñados para acelerar la captura contable masiva sin necesidad de despegar las manos del teclado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Categoría: Navegación */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
              Navegación del Sistema
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-700">Módulos principales (Dashboard a Ajustes)</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold">
                  Alt + 1 .. 7
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-700">Buscador global de cuentas y comandos</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold">
                  Ctrl + K
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Colapsar / Expandir barra lateral</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shrink-0">
                  Ctrl + B
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Abrir guía rápida de atajos / ayuda</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shrink-0">
                  F1
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Cerrar diálogo o cancelar acción inline</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shrink-0">
                  Esc
                </kbd>
              </div>
            </div>
          </div>

          {/* Categoría: Periodos y Ejercicios */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
              Control de Periodos
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Retroceder al mes anterior</span>
                <div className="flex items-center gap-2 shrink-0">
                  <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold">
                    Alt + [
                  </kbd>
                  <span className="text-slate-500 text-[11px]">o</span>
                  <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold">
                    Alt + RePág
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Avanzar al mes siguiente</span>
                <div className="flex items-center gap-2 shrink-0">
                  <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold">
                    Alt + ]
                  </kbd>
                  <span className="text-slate-500 text-[11px]">o</span>
                  <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold">
                    Alt + AvPág
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Categoría: Pólizas */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
              Captura de Pólizas
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Abrir modal de nueva póliza</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shrink-0">
                  Alt + N
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Guardar póliza activa</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shrink-0">
                  Ctrl + Enter
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Auto-cuadre de saldo en renglón</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shrink-0">
                  = (tecla igual)
                </kbd>
              </div>
            </div>
          </div>

          {/* Categoría: Catálogo y ADD */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
              Bóveda ADD y Catálogo
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Subir XML de factura en ADD</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shrink-0">
                  Alt + U
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Abrir captura manual de CFDIs</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shrink-0">
                  Alt + S
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-slate-700">Crear nueva cuenta contable</span>
                <div className="flex items-center gap-2 shrink-0">
                  <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold">
                    Insert
                  </kbd>
                  <span className="text-slate-500 text-[11px]">o</span>
                  <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-mono text-[11px] font-bold">
                    Alt + N
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

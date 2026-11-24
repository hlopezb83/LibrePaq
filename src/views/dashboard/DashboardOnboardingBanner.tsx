import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  Sparkles
} from 'lucide-react';

export interface DashboardOnboardingBannerProps {
  companyName?: string;
  companyRfc?: string;
  regimenFiscal?: string;
  mesActualNombre: string;
  companyYear: number;
  totalPolizasPeriodo: number;
  ingresosPeriodo: number;
  accountsCount?: number;
  pendingCfdisCount?: number;
  isPeriodLocked?: boolean;
  isReadOnly?: boolean;
}

export function DashboardOnboardingBanner({
  companyName = 'Nueva Empresa',
  companyRfc = '',
  regimenFiscal = '',
  mesActualNombre,
  companyYear,
  totalPolizasPeriodo,
  ingresosPeriodo,
  accountsCount = 84,
  pendingCfdisCount = 0,
  isPeriodLocked = false,
  isReadOnly = false
}: DashboardOnboardingBannerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Si la empresa ya tiene operaciones activas (pólizas e ingresos), no mostramos la guía
  if (totalPolizasPeriodo > 0 || ingresosPeriodo > 0) return null;

  const isWriteSuppressed = isPeriodLocked || isReadOnly;

  // Cálculo de progreso del arranque inicial
  const step1Done = true; // Catálogo SAT auto-sembrado
  const step2Done = pendingCfdisCount > 0;
  const step3Done = totalPolizasPeriodo > 0;
  const step4Done = false;
  const completedSteps = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
  const progressPercent = Math.round((completedSteps / 4) * 100);
  const darkFocusRing =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

  return (
    <section
      aria-labelledby="onboarding-guide-heading"
      className="bg-gradient-to-br from-[#0A1120] via-[#0F1B33] to-[#13264A] text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-blue-500/40 relative overflow-hidden transition-all duration-300"
    >
      {/* Resplandor decorativo de fondo */}
      <div
        className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Cabecera Principal de Bienvenida */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-blue-800/50">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/25 text-cyan-300 border border-cyan-400/40">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" aria-hidden="true" />
              Empresa Lista para Operar
            </span>
            {companyRfc && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-white/10 text-slate-200 border border-white/15">
                RFC: {companyRfc}
              </span>
            )}
            {regimenFiscal && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/10 text-slate-300 border border-white/15 hidden lg:inline truncate max-w-xs">
                {regimenFiscal}
              </span>
            )}
            <span className="text-[11px] text-blue-200/80 font-medium hidden sm:inline">
              Progreso de Arranque: <strong className="text-white">{progressPercent}%</strong> (Paso {completedSteps} de 4)
            </span>
          </div>

          <h2
            id="onboarding-guide-heading"
            className="text-lg sm:text-xl font-bold text-white tracking-tight break-words"
          >
            Guía de Inicio Rápido — {companyName}
          </h2>

          <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
            Tu catálogo oficial del SAT Anexo 24 ya está configurado para el periodo{' '}
            <strong className="text-white">{mesActualNombre} {companyYear}</strong>.
            Sigue estos pasos esenciales para arrancar tu contabilidad electrónica:
          </p>
        </div>

        {/* Acciones de la Cabecera */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          {!isWriteSuppressed && (
            <Link
              to="/add"
              search={{ sat: 'open' }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md shadow-blue-900/40 transition cursor-pointer ${darkFocusRing}`}
            >
              <CloudDownload className="w-4 h-4 text-cyan-200" aria-hidden="true" />
              <span>Descargar del SAT (e.firma)</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
            aria-controls="onboarding-guide-steps"
            aria-label={isCollapsed ? 'Expandir guía de inicio rápido' : 'Minimizar guía de inicio rápido'}
            className={`p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition cursor-pointer ${darkFocusRing}`}
            title={isCollapsed ? 'Expandir guía' : 'Minimizar guía'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronUp className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Barra visual de progreso */}
      <div
        role="progressbar"
        aria-label="Avance de configuración inicial"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        className="w-full bg-slate-800/80 h-1.5 rounded-full mt-3 overflow-hidden"
      >
        <div
          className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Contenido expandible con las 4 tarjetas de pasos */}
      {!isCollapsed && (
        <div id="onboarding-guide-steps" className="space-y-4 mt-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Paso 1: Catálogo y Saldos */}
            <Link
              to="/cuentas"
              className={`p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-emerald-500/30 hover:border-emerald-400/50 transition group text-left block relative ${darkFocusRing}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  Listo
                </span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-200 transition flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                Catálogo SAT y Saldos
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Catálogo Anexo 24 activado con {accountsCount} cuentas. Puedes importar tu catálogo desde Excel o CONTPAQi®.
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 mt-2.5 group-hover:underline">
                Revisar Catálogo <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </Link>

            {/* Paso 2: Bóveda Digital ADD & Descarga SAT */}
            <Link
              to="/add"
              search={isWriteSuppressed ? undefined : { sat: 'open' }}
              className={`p-4 rounded-2xl transition group text-left block relative ${darkFocusRing} ${
                step2Done
                  ? 'bg-white/5 hover:bg-white/10 border border-emerald-500/30 hover:border-emerald-400/50'
                  : 'bg-gradient-to-b from-blue-950/70 to-indigo-950/70 hover:from-blue-900/60 hover:to-indigo-900/60 border-2 border-cyan-400/60 hover:border-cyan-300 shadow-lg shadow-blue-950/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                    step2Done
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-xs'
                  }`}
                >
                  2
                </span>
                {step2Done ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    Listo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-200 bg-cyan-950/90 px-2 py-0.5 rounded-full border border-cyan-400/50">
                    <Sparkles className="w-3 h-3 text-cyan-300" aria-hidden="true" />
                    {isWriteSuppressed ? 'Consulta' : 'Recomendado'}
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 transition flex items-center gap-1.5">
                <CloudDownload className="w-4 h-4 text-cyan-400 shrink-0" aria-hidden="true" />
                <span>{isWriteSuppressed ? 'Bóveda Digital ADD (CFDI 4.0)' : 'Descargar del SAT con e.firma'}</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                {step2Done
                  ? `Tienes ${pendingCfdisCount} comprobante(s) XML listos en Bóveda ADD para contabilizar.`
                  : isWriteSuppressed
                  ? 'Consulta los comprobantes XML registrados en Bóveda ADD y su validación Art. 69-B.'
                  : 'Descarga oficial con tu FIEL o arrastra tus XMLs. Clasificación automática en Bóveda ADD y validación 69-B.'}
              </p>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-2.5 group-hover:underline ${step2Done ? 'text-emerald-300' : 'text-cyan-300'}`}>
                {step2Done || isWriteSuppressed ? 'Revisar Bóveda ADD' : 'Conectar e.firma y Descargar'} <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </Link>

            {/* Paso 3: Pólizas Contables */}
            <Link
              to="/polizas"
              className={`p-4 rounded-2xl transition group text-left block relative ${darkFocusRing} ${
                step2Done
                  ? 'bg-gradient-to-b from-blue-950/70 to-indigo-950/70 hover:from-blue-900/60 hover:to-indigo-900/60 border-2 border-cyan-400/60 hover:border-cyan-300 shadow-lg shadow-blue-950/50'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                    step2Done
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-xs'
                      : 'bg-amber-500/25 text-amber-300 border border-amber-400/30'
                  }`}
                >
                  3
                </span>
                {step2Done ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-200 bg-cyan-950/90 px-2 py-0.5 rounded-full border border-cyan-400/50">
                    <Sparkles className="w-3 h-3 text-cyan-300" aria-hidden="true" />
                    Recomendado
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                    En espera de XMLs
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-200 transition flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-400" aria-hidden="true" />
                Pólizas Automáticas
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Genera asientos contables con partida doble cuadrada (Cargos = Abonos) asociando el UUID de cada factura.
              </p>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-2.5 group-hover:underline ${step2Done ? 'text-cyan-300' : 'text-amber-300'}`}>
                Explorar Pólizas <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </Link>

            {/* Paso 4: Balanza y Reportes SAT */}
            <Link
              to="/reportes"
              className={`p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/40 transition group text-left block relative ${darkFocusRing}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-xl bg-purple-500/25 text-purple-300 border border-purple-400/30 flex items-center justify-center font-bold text-xs">
                  4
                </span>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                  Cierre de Mes
                </span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-white group-hover:text-purple-200 transition flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-400" aria-hidden="true" />
                Balanza XML y Día 17
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Descarga tu Balanza Anexo 24 validada para el SAT y calcula tus impuestos provisionales de ISR e IVA.
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-300 mt-2.5 group-hover:underline">
                Ver Balanza y Reportes <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </Link>
          </div>

          {/* Barra inferior de Consejos Contables y Atajos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-blue-900/50 text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <span>
                <strong>Consejo contable:</strong> Puedes arrastrar hasta 500 archivos XML juntos en la Bóveda ADD para contabilizarlos en lote.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-slate-400">
              <span>Atajos:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">
                Ctrl+K
              </kbd>
              <span>Buscar</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px]">
                F1
              </kbd>
              <span>Ayuda</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

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
import { Button, StatusBadge, getButtonClasses } from '../../components/ui';

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

  if (totalPolizasPeriodo > 0 || ingresosPeriodo > 0) return null;

  const isWriteSuppressed = isPeriodLocked || isReadOnly;
  const step1Done = true;
  const step2Done = pendingCfdisCount > 0;
  const step3Done = totalPolizasPeriodo > 0;
  const step4Done = false;
  const completedSteps = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
  const progressPercent = Math.round((completedSteps / 4) * 100);
  const focusRing =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

  return (
    <section
      aria-labelledby="onboarding-guide-heading"
      className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5 transition-all duration-300"
    >
      {/* Cabecera Principal de Bienvenida */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue" icon={<Sparkles className="w-3 h-3" aria-hidden="true" />}>
              Empresa Lista para Operar
            </StatusBadge>
            {companyRfc && (
              <StatusBadge tone="slate" shape="tag">
                RFC: {companyRfc}
              </StatusBadge>
            )}
            {regimenFiscal && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 hidden lg:inline truncate max-w-xs">
                {regimenFiscal}
              </span>
            )}
            <span className="text-[11px] text-slate-600 font-medium hidden sm:inline">
              Progreso de Arranque:{' '}
              <strong className="text-slate-900 font-mono tabular-nums">{progressPercent}%</strong> (Paso{' '}
              {completedSteps} de 4)
            </span>
          </div>

          <h2
            id="onboarding-guide-heading"
            className="text-base sm:text-lg font-bold text-slate-900 tracking-tight break-words"
          >
            Guía de Inicio Rápido — {companyName}
          </h2>

          <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
            Tu catálogo oficial del SAT Anexo 24 ya está configurado para el periodo{' '}
            <strong className="text-slate-900">
              {mesActualNombre} {companyYear}
            </strong>
            . Sigue estos pasos esenciales para arrancar tu contabilidad electrónica:
          </p>
        </div>

        {/* Acciones de la Cabecera */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          {!isWriteSuppressed && (
            <Link
              to="/add"
              search={{ sat: 'open' }}
              className={getButtonClasses('primary', 'md')}
            >
              <CloudDownload className="w-4 h-4" aria-hidden="true" />
              <span>Descargar del SAT (e.firma)</span>
            </Link>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
            aria-controls="onboarding-guide-steps"
            aria-label={
              isCollapsed ? 'Expandir guía de inicio rápido' : 'Minimizar guía de inicio rápido'
            }
            title={isCollapsed ? 'Expandir guía' : 'Minimizar guía'}
            className="p-2"
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Barra visual de progreso */}
      <div
        role="progressbar"
        aria-label="Avance de configuración inicial"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden"
      >
        <div
          className="bg-blue-700 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Contenido expandible con las 4 tarjetas de pasos */}
      {!isCollapsed && (
        <div id="onboarding-guide-steps" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Paso 1: Catálogo y Saldos */}
            <Link
              to="/cuentas"
              className={`p-4 rounded-xl bg-emerald-50/40 hover:bg-emerald-50/70 border border-emerald-200 hover:border-emerald-400 transition group text-left block ${focusRing}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <StatusBadge
                  tone="emerald"
                  icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                >
                  Listo
                </StatusBadge>
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-900 transition flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                <span>Catálogo SAT y Saldos</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Catálogo Anexo 24 activado con {accountsCount} cuentas. Puedes importar tu catálogo
                desde Excel o CONTPAQi®.
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 mt-2.5 group-hover:underline">
                Revisar Catálogo <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </Link>

            {/* Paso 2: Bóveda Digital ADD & Descarga SAT */}
            <Link
              to="/add"
              search={isWriteSuppressed ? undefined : { sat: 'open' }}
              className={`p-4 rounded-xl transition group text-left block ${focusRing} ${
                step2Done
                  ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border border-emerald-200 hover:border-emerald-400'
                  : 'bg-blue-50/50 hover:bg-blue-50/80 border border-blue-300 hover:border-blue-500 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                    step2Done
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-blue-700 text-white shadow-2xs'
                  }`}
                >
                  2
                </span>
                {step2Done ? (
                  <StatusBadge
                    tone="emerald"
                    icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                  >
                    Listo
                  </StatusBadge>
                ) : (
                  <StatusBadge
                    tone="blue"
                    icon={<Sparkles className="w-3 h-3" aria-hidden="true" />}
                  >
                    {isWriteSuppressed ? 'Consulta' : 'Recomendado'}
                  </StatusBadge>
                )}
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-800 transition flex items-center gap-1.5">
                <CloudDownload className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                <span>
                  {isWriteSuppressed
                    ? 'Bóveda Digital ADD (CFDI 4.0)'
                    : 'Descargar del SAT con e.firma'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                {step2Done
                  ? `Tienes ${pendingCfdisCount} comprobante(s) XML listos en Bóveda ADD para contabilizar.`
                  : isWriteSuppressed
                  ? 'Consulta los comprobantes XML registrados en Bóveda ADD y su validación Art. 69-B.'
                  : 'Descarga oficial con tu FIEL o arrastra tus XMLs. Clasificación automática en Bóveda ADD y validación 69-B.'}
              </p>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-2.5 group-hover:underline ${
                  step2Done ? 'text-emerald-800' : 'text-blue-700'
                }`}
              >
                {step2Done || isWriteSuppressed ? 'Revisar Bóveda ADD' : 'Conectar e.firma y Descargar'}{' '}
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </Link>

            {/* Paso 3: Pólizas Contables */}
            <Link
              to="/polizas"
              className={`p-4 rounded-xl transition group text-left block ${focusRing} ${
                step2Done
                  ? 'bg-blue-50/50 hover:bg-blue-50/80 border border-blue-300 hover:border-blue-500 shadow-2xs'
                  : 'bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                    step2Done
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  3
                </span>
                {step2Done ? (
                  <StatusBadge
                    tone="blue"
                    icon={<Sparkles className="w-3 h-3" aria-hidden="true" />}
                  >
                    Recomendado
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="slate">En espera de XMLs</StatusBadge>
                )}
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-800 transition flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                <span>Pólizas Automáticas</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Genera asientos contables con partida doble cuadrada (Cargos = Abonos) asociando el
                UUID de cada factura.
              </p>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-2.5 group-hover:underline ${
                  step2Done ? 'text-blue-700' : 'text-slate-700'
                }`}
              >
                Explorar Pólizas <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </Link>

            {/* Paso 4: Balanza y Reportes SAT */}
            <Link
              to="/reportes"
              className={`p-4 rounded-xl bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200 hover:border-slate-300 transition group text-left block ${focusRing}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 flex items-center justify-center font-bold text-xs">
                  4
                </span>
                <StatusBadge tone="slate">Cierre de Mes</StatusBadge>
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-800 transition flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-700 shrink-0" aria-hidden="true" />
                <span>Balanza XML y Día 17</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Descarga tu Balanza Anexo 24 validada para el SAT y calcula tus impuestos
                provisionales de ISR e IVA.
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 mt-2.5 group-hover:underline">
                Ver Balanza y Reportes <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </span>
            </Link>
          </div>

          {/* Barra inferior de Consejos Contables y Atajos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 text-[11px] text-slate-600">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-slate-900">Consejo contable:</strong> Puedes arrastrar hasta
                500 archivos XML juntos en la Bóveda ADD para contabilizarlos en lote.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-slate-600">
              <span>Atajos:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 font-mono text-[10px]">
                Ctrl+K
              </kbd>
              <span>Buscar</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-800 font-mono text-[10px]">
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

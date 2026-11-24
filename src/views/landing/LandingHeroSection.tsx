import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { User } from '@supabase/supabase-js';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  FileSpreadsheet,
  FlaskConical,
  HardDrive,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';
import { handleTablistKeyDown } from '../../hooks/useTablistKeyboard';
import { LandingInteractivePreview } from './LandingInteractivePreview';

const PREVIEW_TABS = [
  { id: 'polizas', label: 'Póliza Balanceada' },
  { id: 'boveda', label: 'Bóveda CFDI 4.0' },
  { id: 'balanza', label: 'Balanza SAT' },
  { id: 'fiscal', label: 'Día 17 Fiscal' }
] as const;
type HeroPreviewTab = (typeof PREVIEW_TABS)[number]['id'];

interface LandingHeroSectionProps {
  user?: User | null;
  isGuest?: boolean;
  onOpenAuth: () => void;
  onOpenDemo: () => void;
  isOpeningDemo?: boolean;
}

export function LandingHeroSection({
  user = null,
  isGuest = false,
  onOpenAuth,
  onOpenDemo,
  isOpeningDemo = false
}: LandingHeroSectionProps) {
  const [activePreviewTab, setActivePreviewTab] = useState<HeroPreviewTab>('polizas');
  const hasRealSession = Boolean(user && !isGuest);

  return (
    <section className="relative overflow-hidden pt-4 pb-10 sm:pt-6 sm:pb-14 lg:pt-8 lg:pb-20 bg-gradient-to-b from-white via-slate-50/50 to-white">
      {/* Sutiles luces de ambiente */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-blue-500/5 via-cyan-500/5 to-emerald-500/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-10 right-10 w-96 h-96 bg-blue-100/40 blur-3xl pointer-events-none rounded-full" />

      <div className="relative max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 text-center">
        {/* Banner de Promoción y Reemplazo de CONTPAQi */}
        <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 sm:px-4 py-1 rounded-2xl sm:rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] sm:text-xs font-semibold mb-3 sm:mb-4 shadow-xs max-w-full">
          <span aria-hidden="true" className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-mono uppercase font-bold tracking-wider text-emerald-700 shrink-0 inline-flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Promoción de Lanzamiento $0 MXN</span>
          </span>
          <span aria-hidden="true" className="text-slate-300 hidden md:inline">•</span>
          <span className="text-slate-700 hidden md:inline">Nube y Respaldos Incluidos</span>
          <span aria-hidden="true" className="text-slate-300">•</span>
          <span className="text-blue-700 font-bold">Alternativa en la Nube a CONTPAQi®</span>
        </div>

        {/* Titular Principal Claro y Autorizado */}
        <h1 className="text-[1.65rem] min-[400px]:text-3xl sm:text-4xl lg:text-5xl xl:text-[3.25rem] font-extrabold tracking-tight text-slate-900 max-w-5xl mx-auto leading-[1.12] text-balance">
          El Software Contable y Fiscal en la Nube que{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600">
            Reemplaza a CONTPAQi®.
          </span>
        </h1>

        {/* Subtítulo enfocado en dolores reales del contador y despacho */}
        <p className="mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed text-pretty font-normal">
          Opera desde cualquier PC, Mac o laptop sin instalar nada ni pagarle a técnicos al cambiar de equipo,{' '}
          <strong className="text-slate-900 font-semibold">ahorrando más de $20,000 MXN al año</strong> en renovaciones. Descarga tu respaldo contable completo en 1 clic cuando gustes.
        </p>

        {/* Botones de Llamada a la Acción (CTA) */}
        <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          {hasRealSession ? (
            <Link
              to="/"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-sm sm:text-base transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2.5 cursor-pointer group"
            >
              <span>Ir a Mi Despacho</span>
              <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 group-hover:translate-x-1 transition-transform shrink-0" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenAuth}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-sm sm:text-base transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2.5 cursor-pointer group"
              >
                <Sparkles className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-300 group-hover:rotate-12 transition-transform shrink-0" aria-hidden="true" />
                <span>Crear Mi Cuenta Sin Costo</span>
                <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 group-hover:translate-x-1 transition-transform shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                disabled={isOpeningDemo}
                aria-busy={isOpeningDemo}
                title={isOpeningDemo ? 'Preparando entorno demo en vivo...' : undefined}
                onClick={onOpenDemo}
                className="w-full sm:w-auto px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-300 hover:border-blue-600 font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-wait"
              >
                {isOpeningDemo ? (
                  <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 text-blue-700 animate-spin shrink-0" aria-hidden="true" />
                ) : (
                  <FlaskConical className="w-4 sm:w-5 h-4 sm:h-5 text-amber-600 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {isOpeningDemo ? 'Abriendo Demo en Vivo...' : 'Explorar Demo en Vivo (Sin Registro)'}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Micro-promesa de cero fricción */}
        <p className="mt-2.5 text-xs text-slate-600 flex items-center justify-center gap-2 flex-wrap">
          <span>Sin tarjeta de crédito</span>
          <span aria-hidden="true">•</span>
          <span>Nube y Bóveda CFDI 4.0 incluidas</span>
          <span aria-hidden="true">•</span>
          <span>Acceso en 30 segundos</span>
        </p>

        {/* Métricas de Confianza (Trust Pillars con fondo blanco limpio) */}
        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-200 grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto text-left">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs min-w-0">
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold font-mono text-slate-900 tracking-tight">$0.00 Descuadres</p>
              <p className="text-xs text-slate-600">Pólizas y Balanza cuadradas al centavo</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs min-w-0">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 shrink-0">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold font-mono text-slate-900 tracking-tight">100% SAT</p>
              <p className="text-xs text-slate-600">Anexo 24 XML v1.3 y CFDI 4.0 oficial</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs min-w-0">
            <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 shrink-0">
              <Cloud className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold font-mono text-slate-900 tracking-tight">Nube Incluida</p>
              <p className="text-xs text-slate-600">Entra desde tu oficina, casa o laptop</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs min-w-0">
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
              <HardDrive className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold font-mono text-slate-900 tracking-tight">Respaldo 1-Clic</p>
              <p className="text-xs text-slate-600">Descarga a tu PC local cuando gustes</p>
            </div>
          </div>
        </div>

        {/* Badge adicional: Migración fácil desde CONTPAQi */}
        <div className="mt-5 sm:mt-6 flex items-start sm:items-center justify-center gap-2 text-xs text-slate-600 font-medium text-left sm:text-center">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span>¿Ya usas CONTPAQi®? Migra tu catálogo y saldos con CSV, Excel, CT.xml / BN.xml Anexo 24 y catálogo TXT CONTPAQi®.</span>
        </div>
      </div>

      {/* Maqueta Interactiva del Sistema (Mockup en Light Frame) */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 mt-8 sm:mt-12">
        <div className="relative rounded-2xl bg-white border border-slate-300/80 shadow-2xl shadow-slate-300/50 overflow-hidden">
          {/* Barra superior de ventana estilo macOS / Windows */}
          <div className="bg-slate-100/90 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div aria-hidden="true" className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-400 shrink-0" />
              <div aria-hidden="true" className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-400 shrink-0" />
              <div aria-hidden="true" className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400 shrink-0" />
              <span className="ml-1.5 sm:ml-2 text-[11px] sm:text-xs font-mono text-slate-700 font-semibold flex items-center gap-1.5 min-w-0">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">
                  LibrePaq Pro {new Date().getFullYear()} — Grupo Industrial del Norte S.A. de C.V. (GIN940315SAT)
                </span>
              </span>
            </div>

            {/* Pestañas de la maqueta interactiva */}
            <div
              role="tablist"
              aria-label="Vistas previas interactivas del sistema"
              className="grid grid-cols-2 min-[480px]:flex min-[480px]:flex-wrap items-center gap-1 bg-slate-200/80 p-1 rounded-lg text-[11px] sm:text-xs font-medium max-w-full"
            >
              {PREVIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  id={`hero-preview-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activePreviewTab === tab.id}
                  aria-controls={`hero-preview-panel-${tab.id}`}
                  tabIndex={activePreviewTab === tab.id ? 0 : -1}
                  onClick={() => setActivePreviewTab(tab.id)}
                  onKeyDown={(e) =>
                    handleTablistKeyDown(e, PREVIEW_TABS, activePreviewTab, setActivePreviewTab, 'hero-preview-tab-')
                  }
                  className={`min-h-[40px] px-2.5 sm:px-3 py-1 rounded-md transition cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center ${
                    activePreviewTab === tab.id
                      ? 'bg-white text-blue-700 font-bold shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contenido dinámico según la pestaña de vista previa */}
          <div
            role="tabpanel"
            id={`hero-preview-panel-${activePreviewTab}`}
            aria-labelledby={`hero-preview-tab-${activePreviewTab}`}
          >
            <LandingInteractivePreview activePreviewTab={activePreviewTab} />
          </div>
        </div>
      </div>
    </section>
  );
}

import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  FileSpreadsheet,
  FlaskConical,
  HardDrive,
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
  onOpenAuth: () => void;
  onOpenDemo: () => void;
}

export function LandingHeroSection({ onOpenAuth, onOpenDemo }: LandingHeroSectionProps) {
  const [activePreviewTab, setActivePreviewTab] = useState<HeroPreviewTab>('polizas');

  return (
    <section className="relative overflow-hidden pt-6 pb-14 sm:pt-8 sm:pb-16 lg:pt-16 lg:pb-28 bg-gradient-to-b from-white via-slate-50/50 to-white">
      {/* Sutiles luces de ambiente */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-blue-500/5 via-cyan-500/5 to-emerald-500/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-10 right-10 w-96 h-96 bg-blue-100/40 blur-3xl pointer-events-none rounded-full" />

      <div className="relative max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 text-center">
        {/* Banner de Promoción y Reemplazo de CONTPAQi */}
        <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 sm:px-4 py-1.5 rounded-2xl sm:rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] sm:text-xs font-semibold mb-4 sm:mb-6 shadow-xs max-w-full">
          <span aria-hidden="true" className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-mono uppercase font-bold tracking-wider text-emerald-700 shrink-0 inline-flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Promoción $0 MXN</span>
          </span>
          <span aria-hidden="true" className="text-slate-300 hidden md:inline">•</span>
          <span className="text-slate-700 hidden md:inline">Todos los Planes Gratuitos con Nube Incluida</span>
          <span aria-hidden="true" className="text-slate-300">•</span>
          <span className="text-blue-700 font-bold">Alternativa #1 a CONTPAQi®</span>
        </div>

        {/* Titular Principal Claro y Autorizado */}
        <h1 className="text-[1.65rem] min-[400px]:text-3xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-5xl mx-auto leading-[1.15] text-balance">
          El Software Contable y Fiscal en la Nube que{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600">
            Reemplaza a CONTPAQi®.
          </span>
        </h1>

        {/* Subtítulo enfocado en dolores reales del contador y despacho */}
        <p className="mt-4 sm:mt-5 text-sm sm:text-base lg:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed text-pretty font-normal">
          Entra desde cualquier computadora (oficina, casa o Mac) sin instalar nada, sin pagarle a un técnico cada que cambias de laptop y{' '}
          <strong className="text-slate-900 font-semibold">sin gastar más de $20,000 MXN al año</strong> en renovaciones.
          Por promoción de lanzamiento, <strong className="text-emerald-700 font-semibold">todos los planes son 100% gratuitos</strong>. Puedes descargar un respaldo contable completo a tu PC en 1 clic cuando gustes.
        </p>

        {/* Botones de Llamada a la Acción (CTA) */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onOpenAuth}
            className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm sm:text-base transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2.5 cursor-pointer group"
          >
            <Sparkles className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-300 group-hover:rotate-12 transition-transform shrink-0" aria-hidden="true" />
            <span>Crear Cuenta Gratis ($0 MXN)</span>
            <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 group-hover:translate-x-1 transition-transform shrink-0" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onOpenDemo}
            className="w-full sm:w-auto px-5 sm:px-7 py-3.5 sm:py-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-300 font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <FlaskConical className="w-4 sm:w-5 h-4 sm:h-5 text-amber-600 shrink-0" aria-hidden="true" />
            <span>Explorar Demo en Vivo (Sin Registro)</span>
          </button>
        </div>

        {/* Micro-promesa de cero fricción */}
        <p className="mt-3 text-xs text-slate-600 flex items-center justify-center gap-2 flex-wrap">
          <span>Sin tarjeta de crédito</span>
          <span aria-hidden="true">•</span>
          <span>Nube y timbres incluidos</span>
          <span aria-hidden="true">•</span>
          <span>Acceso en 30 segundos</span>
        </p>

        {/* Métricas de Confianza (Trust Pillars con fondo blanco limpio) */}
        <div className="mt-10 sm:mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 max-w-4xl mx-auto text-left">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs min-w-0">
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 tracking-tight">$0.00 Descuadres</p>
              <p className="text-xs text-slate-600">Pólizas y Balanza cuadradas al centavo</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs min-w-0">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 shrink-0">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 tracking-tight">100% SAT</p>
              <p className="text-xs text-slate-600">Anexo 24 XML v1.3 y CFDI 4.0 oficial</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs min-w-0">
            <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-600 shrink-0">
              <Cloud className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 tracking-tight">Nube Incluida</p>
              <p className="text-xs text-slate-600">Entra desde tu oficina, casa o laptop</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs min-w-0">
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 shrink-0">
              <HardDrive className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-bold font-mono text-slate-900 tracking-tight">Respaldo 1-Clic</p>
              <p className="text-xs text-slate-600">Descarga a tu PC local cuando gustes</p>
            </div>
          </div>
        </div>

        {/* Badge adicional: Migración fácil desde CONTPAQi */}
        <div className="mt-6 sm:mt-8 flex items-start sm:items-center justify-center gap-2 text-xs text-slate-600 font-medium text-left sm:text-center">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span>¿Ya usas CONTPAQi®? Importa tu catálogo de cuentas y pólizas en formato Excel o TXT en 1 minuto.</span>
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
                  LibrePaq Pro 2026 — Grupo Industrial del Norte S.A. de C.V. (GIN940315SAT)
                </span>
              </span>
            </div>

            {/* Pestañas de la maqueta interactiva */}
            <div
              role="tablist"
              aria-label="Vistas previas interactivas del sistema"
              className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg text-[11px] sm:text-xs font-medium overflow-x-auto max-w-full"
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
                  className={`px-2.5 sm:px-3 py-1 rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
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

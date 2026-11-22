import { ExternalLink, Target, CheckCircle2 } from 'lucide-react';
import { DEFAULT_WHATSAPP_PHONE } from '../../components/WhatsAppSupportButton';

export function SuperAdminAdsTab() {
  const measurementId =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) ||
    'G-QQFGNPNYNZ';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Adquisición, Tráfico & Campañas Google Ads
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoreo de conversiones, eventos analíticos y canales de captación para librepaq.com
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Google Ads Tag</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Vinculado
              </span>
            </div>
            <p className="font-mono text-sm font-bold text-slate-900">{measurementId}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Etiqueta global activa en todas las vistas de LibrePaq Pro.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Atención WhatsApp</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                En Línea
              </span>
            </div>
            <p className="font-mono text-sm font-bold text-slate-900">+{DEFAULT_WHATSAPP_PHONE}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Widget flotante conectado para soporte directo a prospectos y contadores.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Objetivo de Campaña</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                Smart Bidding
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900">Sign up for product or service</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Optimizado para registros gratuitos en software contable en México.
            </p>
          </div>
        </div>

        {/* Enlaces Rápidos a Consolas Externas */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Consolas de Gestión Externa
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <a
              href="https://ads.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  GAds
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700">Google Ads</p>
                  <p className="text-[10px] text-slate-500">Campañas, palabras clave y presupuesto</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </a>

            <a
              href="https://analytics.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 transition group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                  GA4
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-amber-700">Google Analytics 4</p>
                  <p className="text-[10px] text-slate-500">Métricas en tiempo real y embudo</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
            </a>

            <a
              href="https://console.firebase.google.com/project/librepaq-44516/hosting/sites"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 transition group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                  FB
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-orange-700">Firebase Hosting</p>
                  <p className="text-[10px] text-slate-500">Dominio librepaq.com y SSL</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-orange-600" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

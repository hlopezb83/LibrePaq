import { ExternalLink, Target, CheckCircle2 } from 'lucide-react';
import { DEFAULT_WHATSAPP_PHONE } from '../../components/WhatsAppSupportButton';
import type { AdminCompanySummary, AdminUserSummary } from '../../shared/admin-types';
import { SuperAdminAdsAttributionTable } from './SuperAdminAdsAttributionTable';

export interface SuperAdminAdsTabProps {
  users?: AdminUserSummary[];
  companies?: AdminCompanySummary[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function SuperAdminAdsTab({
  users = [],
  companies = [],
  isLoading = false,
  isError = false,
  onRetry
}: SuperAdminAdsTabProps) {
  const measurementId =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) ||
    'G-QQFGNPNYNZ';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" aria-hidden="true" />
            Adquisición, Tráfico & Campañas Google Ads
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Monitoreo de conversiones, eventos analíticos y canales de captación para librepaq.com
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Google Ads Tag</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                Vinculado
              </span>
            </div>
            <p className="font-mono text-sm font-bold text-slate-900">{measurementId}</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Etiqueta global activa en todas las vistas de LibrePaq Pro.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Atención WhatsApp</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                En Línea
              </span>
            </div>
            <p className="font-mono text-sm font-bold text-slate-900">+{DEFAULT_WHATSAPP_PHONE}</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Widget flotante conectado para soporte directo a prospectos y contadores.
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Objetivo de Campaña</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                Puja inteligente
              </span>
            </div>
            <p className="text-xs font-bold text-slate-900">Registro de nueva cuenta</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Optimizado para registros gratuitos en software contable en México.
            </p>
          </div>
        </div>

        {/* Enlaces Rápidos a Consolas Externas */}
        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Consolas de Gestión Externa
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <a
              href="https://ads.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div className="flex items-center gap-2.5">
                <div aria-hidden="true" className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                  GAds
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                    Google Ads
                    <span className="visually-hidden"> (abre en nueva pestaña)</span>
                  </p>
                  <p className="text-[10px] text-slate-600">Campañas, palabras clave y presupuesto</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-blue-600" aria-hidden="true" />
            </a>

            <a
              href="https://analytics.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 transition group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div className="flex items-center gap-2.5">
                <div aria-hidden="true" className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                  GA4
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-amber-700">
                    Google Analytics 4
                    <span className="visually-hidden"> (abre en nueva pestaña)</span>
                  </p>
                  <p className="text-[10px] text-slate-600">Métricas en tiempo real y embudo</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-amber-600" aria-hidden="true" />
            </a>

            <a
              href="https://console.firebase.google.com/project/librepaq-44516/hosting/sites"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 transition group cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div className="flex items-center gap-2.5">
                <div aria-hidden="true" className="w-8 h-8 rounded-lg bg-orange-100 text-orange-800 flex items-center justify-center font-bold text-xs">
                  FB
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 group-hover:text-orange-700">
                    Firebase Hosting
                    <span className="visually-hidden"> (abre en nueva pestaña)</span>
                  </p>
                  <p className="text-[10px] text-slate-600">Dominio librepaq.com y SSL</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-orange-600" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <SuperAdminAdsAttributionTable
        users={users}
        companies={companies}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
      />
    </div>
  );
}

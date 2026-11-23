import {
  Users,
  Building2,
  ReceiptText,
  FileCode2,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import type { AdminPlatformMetrics } from '../../shared/admin-types';

interface SuperAdminMetricsCardsProps {
  metrics?: AdminPlatformMetrics;
  usersCount?: number;
  companiesCount?: number;
  isLoading: boolean;
}

export function SuperAdminMetricsCards({
  metrics,
  usersCount,
  companiesCount,
  isLoading
}: SuperAdminMetricsCardsProps) {
  const finalUsers = usersCount ?? metrics?.totalUsers;
  const finalCompanies = companiesCount ?? metrics?.totalCompanies;
  const formatMetric = (val?: number) => (isLoading ? '...' : val != null ? val.toLocaleString('es-MX') : '—');

  const cards = [
    {
      title: 'Usuarios Totales',
      value: formatMetric(finalUsers),
      subtitle: 'Cuentas registradas en Supabase Auth',
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Empresas Fiscales',
      value: formatMetric(finalCompanies),
      subtitle: 'Tenants activos en la plataforma',
      icon: Building2,
      color: 'emerald'
    },
    {
      title: 'Pólizas Contables',
      value: formatMetric(metrics?.totalPolizas),
      subtitle: 'Asientos de diario, ingresos y egresos',
      icon: ReceiptText,
      color: 'indigo'
    },
    {
      title: 'CFDI 4.0 Bóveda',
      value: formatMetric(metrics?.totalCfdis),
      subtitle: 'Comprobantes fiscales XML procesados',
      icon: FileCode2,
      color: 'purple'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Banner de Infraestructura en Producción */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-900/60 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white">
                Infraestructura Cloud en Producción
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sistemas Normales
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              librepaq.com · Supabase PostgreSQL · Google Firebase Hosting · SAT Anexo 24
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 transition cursor-pointer"
          >
            Supabase Console
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 transition cursor-pointer"
          >
            Firebase Console
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Grid de 4 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className="bg-white border border-slate-300/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {c.title}
                </p>
                <p className="text-2xl font-black text-slate-900 mt-1">{c.value}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{c.subtitle}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                <Icon className="w-6 h-6" aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { Download, Megaphone, TrendingUp } from 'lucide-react';
import type { AdminCompanySummary, AdminUserSummary } from '../../shared/admin-types';

interface SuperAdminAdsAttributionTableProps {
  users: AdminUserSummary[];
  companies: AdminCompanySummary[];
}

type ChannelKey = 'google_ads' | 'utm' | 'organic';

interface CampaignRow {
  key: string;
  campaign: string;
  term: string;
  channel: ChannelKey;
  usersCount: number;
  gclidCount: number;
  activatedCount: number;
  activationPct: number;
}

const CHANNEL_META: Record<ChannelKey, { label: string; badgeClass: string; barClass: string }> = {
  google_ads: { label: 'Google Ads', badgeClass: 'bg-blue-100 text-blue-900 border-blue-300', barClass: 'bg-blue-600' },
  utm: { label: 'Campañas UTM', badgeClass: 'bg-purple-100 text-purple-900 border-purple-300', barClass: 'bg-purple-600' },
  organic: { label: 'Orgánico / Directo', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300', barClass: 'bg-slate-600' }
};

function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function classifyChannel(user: AdminUserSummary): ChannelKey {
  if (user.acquisitionSource === 'google_ads' || Boolean(user.gclid?.trim())) return 'google_ads';
  if (user.acquisitionSource === 'utm' || Boolean(user.utmCampaign?.trim() || user.utmTerm?.trim())) return 'utm';
  return 'organic';
}

export function SuperAdminAdsAttributionTable({ users, companies }: SuperAdminAdsAttributionTableProps) {
  const { funnelStats, campaignRows, gclidLeads, totalLeads } = useMemo(() => {
    const activeCompanyUserIds = new Set(
      companies.filter((c) => c.ownerType !== 'demo' && Boolean(c.userId)).map((c) => c.userId as string)
    );
    const leads = users.filter((u) => !u.isSuperAdmin);
    const channelTotals: Record<ChannelKey, { count: number; activated: number }> = {
      google_ads: { count: 0, activated: 0 },
      utm: { count: 0, activated: 0 },
      organic: { count: 0, activated: 0 }
    };
    const groups = new Map<string, Omit<CampaignRow, 'activationPct'>>();
    const withGclid: AdminUserSummary[] = [];

    for (const u of leads) {
      const channel = classifyChannel(u);
      const isActivated = u.companiesCount > 0 || activeCompanyUserIds.has(u.id);
      const hasGclid = Boolean(u.gclid?.trim());
      if (hasGclid) withGclid.push(u);

      channelTotals[channel].count += 1;
      if (isActivated) channelTotals[channel].activated += 1;

      const campaign =
        u.utmCampaign?.trim() ||
        (channel === 'google_ads'
          ? 'Google Ads (Sin utm_campaign)'
          : channel === 'utm'
          ? 'Campaña UTM (Sin nombre)'
          : 'Orgánico / Directo');
      const term = u.utmTerm?.trim() || '—';
      const key = `${channel}:::${campaign}:::${term}`;
      const existing = groups.get(key);
      if (existing) {
        existing.usersCount += 1;
        if (hasGclid) existing.gclidCount += 1;
        if (isActivated) existing.activatedCount += 1;
      } else {
        groups.set(key, {
          key,
          campaign,
          term,
          channel,
          usersCount: 1,
          gclidCount: hasGclid ? 1 : 0,
          activatedCount: isActivated ? 1 : 0
        });
      }
    }

    const total = leads.length;
    const funnel = (['google_ads', 'utm', 'organic'] as const).map((channel) => {
      const item = channelTotals[channel];
      return {
        channel,
        ...CHANNEL_META[channel],
        count: item.count,
        activated: item.activated,
        sharePct: total > 0 ? Math.round((item.count / total) * 100) : 0,
        activationPct: item.count > 0 ? Math.round((item.activated / item.count) * 100) : 0
      };
    });

    const rows: CampaignRow[] = Array.from(groups.values())
      .map((g) => ({
        ...g,
        activationPct: g.usersCount > 0 ? Math.round((g.activatedCount / g.usersCount) * 100) : 0
      }))
      .sort((a, b) => b.usersCount - a.usersCount || b.activatedCount - a.activatedCount);

    return { funnelStats: funnel, campaignRows: rows, gclidLeads: withGclid, totalLeads: total };
  }, [users, companies]);

  const handleExportOfflineCsv = () => {
    if (gclidLeads.length === 0) return;
    const header = 'gclid,email,createdAt';
    const lines = gclidLeads.map((u) =>
      [escapeCsvCell(u.gclid?.trim() || ''), escapeCsvCell(u.email), escapeCsvCell(u.createdAt)].join(',')
    );
    const blob = new Blob([`\uFEFF${[header, ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `librepaq-conversiones-offline-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" aria-hidden="true" />
            Embudo de Atribución y Conversiones Offline
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Distribución por canal de {totalLeads.toLocaleString('es-MX')} cuentas de clientes y activación con empresa fiscal
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportOfflineCsv}
          disabled={gclidLeads.length === 0}
          aria-label={`Exportar CSV de conversiones offline con GCLID (${gclidLeads.length} registros)`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-600 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Exportar CSV GCLID ({gclidLeads.length})
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {funnelStats.map((stage) => (
          <div key={stage.channel} className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${stage.badgeClass}`}>
                <Megaphone className="w-3 h-3" aria-hidden="true" />
                {stage.label}
              </span>
              <span className="text-xs font-mono font-bold text-slate-700">{stage.sharePct}% del total</span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-black text-slate-900">{stage.count.toLocaleString('es-MX')}</p>
              <p className="text-xs font-semibold text-slate-700">
                {stage.activated.toLocaleString('es-MX')} activados ({stage.activationPct}%)
              </p>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
              <div className={`h-full rounded-full ${stage.barClass}`} style={{ width: `${stage.sharePct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de atribución por campaña y palabra clave"
        className="overflow-x-auto max-h-[60vh] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <caption className="visually-hidden">
            Atribución de usuarios registrados agrupados por campaña UTM y término de búsqueda
          </caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Campaña (utm_campaign)</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Término (utm_term)</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Canal</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Registros</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Con GCLID</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Activados</th>
              <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">% Activación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {campaignRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-600">
                  Aún no hay registros de clientes disponibles para calcular la atribución.
                </td>
              </tr>
            ) : (
              campaignRows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50/80 transition">
                  <th scope="row" className="py-2.5 px-3.5 font-bold text-slate-900 text-left">{row.campaign}</th>
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">{row.term}</td>
                  <td className="py-2.5 px-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${CHANNEL_META[row.channel].badgeClass}`}>
                      {CHANNEL_META[row.channel].label}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-right font-semibold tabular-nums">{row.usersCount.toLocaleString('es-MX')}</td>
                  <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-700">{row.gclidCount.toLocaleString('es-MX')}</td>
                  <td className="py-2.5 px-3.5 text-right font-semibold tabular-nums">{row.activatedCount.toLocaleString('es-MX')}</td>
                  <td className="py-2.5 px-3.5 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                      row.activationPct >= 50 ? 'bg-emerald-100 text-emerald-900' : row.activationPct > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {row.activationPct}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

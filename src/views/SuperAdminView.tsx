import type { ComponentType } from 'react';
import { Link } from '@tanstack/react-router';
import {
  ShieldAlert,
  Users,
  Building2,
  Target,
  Megaphone,
  LayoutDashboard,
  Crown,
  Loader2
} from 'lucide-react';
import { handleTablistKeyDown } from '../hooks/useTablistKeyboard';
import { SuperAdminMetricsCards } from './admin/SuperAdminMetricsCards';
import { SuperAdminUsersTab } from './admin/SuperAdminUsersTab';
import { SuperAdminCompaniesTab } from './admin/SuperAdminCompaniesTab';
import { SuperAdminAdsTab } from './admin/SuperAdminAdsTab';
import { SuperAdminBroadcastTab } from './admin/SuperAdminBroadcastTab';
import { useSuperAdminManager } from './admin/useSuperAdminManager';

type AdminTab = 'metrics' | 'users' | 'companies' | 'ads' | 'broadcast';

export function SuperAdminView() {
  const {
    user,
    isSuperAdmin,
    authLoading,
    searchQuery,
    activeTab,
    setActiveTab,
    metrics,
    loadingMetrics,
    users,
    loadingUsers,
    companies,
    loadingCompanies
  } = useSuperAdminManager();

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600" aria-hidden="true" />
        <p className="text-xs font-semibold text-slate-600">Verificando permisos administrativos...</p>
      </div>
    );
  }

  // Pantalla de Protección / Control de Acceso RBAC
  if (!isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">
          Acceso Restringido — Solo SuperAdmin
        </h1>
        <p className="text-xs text-slate-600 max-w-md mb-5 leading-relaxed">
          Esta vista es de uso exclusivo para el propietario de la plataforma LibrePaq Pro.
          Tu cuenta actual ({user?.email || 'Visitante'}) no cuenta con privilegios administrativos.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition"
        >
          Volver al Tablero Contable
        </Link>
      </div>
    );
  }

  const nonDemoCompaniesCount = companies.filter((c) => c.ownerType !== 'demo').length;
  const adminTabs: Array<{ id: AdminTab; label: string; icon: ComponentType<{ className?: string }> }> = [
    { id: 'metrics', label: 'Métricas SaaS', icon: LayoutDashboard },
    { id: 'users', label: `Usuarios (${users.length})`, icon: Users },
    { id: 'companies', label: `Empresas (${nonDemoCompaniesCount})`, icon: Building2 },
    { id: 'ads', label: 'Google Ads', icon: Target },
    { id: 'broadcast', label: 'Comunicados', icon: Megaphone }
  ];

  return (
    <div className="space-y-4">
      {/* Header Principal con Tabs */}
      <header className="bg-white border border-slate-300/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
            <Crown className="w-6 h-6 text-amber-600" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                Panel de SuperAdmin LibrePaq Pro
              </h1>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                <Crown className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                Dueño de Plataforma
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Sesión activa: <span className="font-semibold text-slate-800">{user?.email || 'SuperAdmin'}</span> · Control global multi-tenant
            </p>
          </div>
        </div>

        {/* Barra de Tabs */}
        <div
          role="tablist"
          aria-label="Secciones de administración de plataforma"
          className="flex items-center gap-1 erp-tab-scroller max-w-full shrink-0 py-0.5"
        >
          {adminTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`admin-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTablistKeyDown(e, adminTabs, activeTab, setActiveTab, 'admin-tab-')}
                className={`snap-start shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Contenido Dinámico según Tab Activo */}
      <div role="tabpanel" id={`admin-panel-${activeTab}`} aria-labelledby={`admin-tab-${activeTab}`}>
        {activeTab === 'metrics' && (
          <SuperAdminMetricsCards
            metrics={metrics}
            usersCount={users.length}
            companiesCount={metrics?.totalCompanies ?? nonDemoCompaniesCount}
            isLoading={loadingMetrics}
          />
        )}

        {activeTab === 'users' && (
          <SuperAdminUsersTab
            users={users}
            isLoading={loadingUsers}
            onViewUserCompanies={(q) => setActiveTab('companies', q)}
          />
        )}

        {activeTab === 'companies' && (
          <SuperAdminCompaniesTab
            companies={companies}
            users={users}
            isLoading={loadingCompanies}
            initialQuery={searchQuery}
          />
        )}

        {activeTab === 'ads' && <SuperAdminAdsTab />}

        {activeTab === 'broadcast' && <SuperAdminBroadcastTab />}
      </div>
    </div>
  );
}

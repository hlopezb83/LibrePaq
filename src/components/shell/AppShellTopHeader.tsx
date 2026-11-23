import {
  Briefcase,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Loader2,
  Lock,
  LockOpen,
  LogOut,
  Plus
} from 'lucide-react';
import { MESES_SAT } from '../../shared/sat-constants';
import type { Company } from '../../shared/types';
import type { User } from '@supabase/supabase-js';

interface AppShellTopHeaderProps {
  workspaceName?: string;
  activeCompany: Company | null;
  currentTheme: { bg: string; text: string; border: string };
  onOpenCompanySwitcher: () => void;
  onOpenNewCompany: () => void;
  onOpenAuth: () => void;
  stepPeriod: (delta: number) => void;
  updatePeriod: (year: number, period: number) => void;
  isPeriodLocked: boolean;
  isTogglingLock: boolean;
  onTogglePeriodLock: (nextLocked: boolean) => void;
  user: User | null;
  onSignOut: () => void;
}

export function AppShellTopHeader({
  workspaceName,
  activeCompany,
  currentTheme,
  onOpenCompanySwitcher,
  onOpenNewCompany,
  onOpenAuth,
  stepPeriod,
  updatePeriod,
  isPeriodLocked,
  isTogglingLock,
  onTogglePeriodLock,
  user,
  onSignOut
}: AppShellTopHeaderProps) {
  return (
    <header className="@container bg-white/95 backdrop-blur-md border-b border-slate-300/80 px-2 sm:px-3.5 py-1.5 sticky top-0 z-20 shadow-2xs no-print">
      <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-1.5">
        {/* Despacho y Conmutador de Empresa Activa */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 @[600px]:flex-initial">
          {activeCompany ? (
            <button
              type="button"
              onClick={onOpenCompanySwitcher}
              title={`Empresa cliente: ${activeCompany.name} (${activeCompany.rfc}) · Despacho: ${workspaceName || 'Mi Despacho'} (Atajo: Ctrl+E)`}
              aria-label={`Empresa cliente activa: ${activeCompany.name}, RFC: ${activeCompany.rfc}. Despacho: ${workspaceName || 'Mi Despacho'}. Presiona para cambiar de empresa (Ctrl+E)`}
              className="w-full @[600px]:w-auto flex items-center gap-2 bg-slate-50 hover:bg-white border border-slate-300/90 hover:border-blue-500 hover:shadow-xs rounded-xl px-2 py-1 transition group cursor-pointer text-left min-w-0"
            >
              <div
                title={`Empresa cliente activa: ${activeCompany.name} (${activeCompany.rfc})`}
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg ${currentTheme.bg} ${currentTheme.text} font-mono font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs border ${currentTheme.border}`}
              >
                {activeCompany.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 @[600px]:max-w-[280px] @[760px]:max-w-[360px] @[960px]:max-w-[460px] @[1200px]:max-w-[600px]">
                {/* Fila 1: Despacho Contable (Contexto del Despacho) */}
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                    {workspaceName || 'Despacho Contable'}
                  </span>
                </div>
                {/* Fila 2: Empresa Cliente + Badge explícito con su RFC */}
                <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                  <span className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-800 transition leading-tight">
                    {activeCompany.name}
                  </span>
                  <span
                    className="font-mono text-[9px] font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-300/90 shadow-2xs shrink-0 inline-flex items-center gap-0.5"
                    title={`RFC de la empresa cliente: ${activeCompany.rfc}`}
                  >
                    <span className="text-[8px] font-semibold text-slate-600 uppercase">RFC</span>
                    <span>{activeCompany.rfc}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200 text-slate-400 group-hover:text-blue-700 shrink-0">
                <span className="hidden @[760px]:inline text-[10px] font-bold text-slate-600 group-hover:text-blue-700">
                  Cambiar
                </span>
                <kbd className="hidden @[1280px]:inline text-[9px] font-mono bg-white text-slate-600 px-1 py-0.5 rounded border border-slate-300">
                  Ctrl+E
                </kbd>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 min-w-0 flex-1 @[600px]:flex-initial">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                  <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 max-w-[180px] sm:max-w-[240px]">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-blue-700 leading-tight">
                    Despacho Activo
                  </span>
                  <span className="block text-xs font-bold text-slate-900 truncate leading-tight">
                    {workspaceName || 'Mi Despacho Contable'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenNewCompany}
                aria-label="Dar de alta nueva empresa"
                title="Dar de alta nueva empresa"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden @[440px]:inline">Nueva Empresa</span>
              </button>
            </div>
          )}
        </div>

        {/* Controles Superiores: Comandos, Periodo y Sesión */}
        <div
          className={`flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0 ${
            activeCompany
              ? 'w-full @[600px]:w-auto justify-between @[600px]:justify-end'
              : 'shrink-0 ml-auto'
          }`}
        >
          {activeCompany?.currentPeriod === 13 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold shrink-0">
              <Lock className="w-3 h-3 text-amber-800" aria-hidden="true" />
              <span className="hidden @[900px]:inline">MODO CIERRE ANUAL (P13)</span>
              <span className="@[900px]:hidden">P13</span>
            </span>
          )}

          {activeCompany && (
            <div className="flex items-center gap-0.5 bg-slate-50 border border-slate-300/90 rounded-xl px-1 py-0.5 min-w-0 shrink">
              <button
                type="button"
                onClick={() => stepPeriod(-1)}
                disabled={activeCompany.currentPeriod <= 1}
                title={
                  activeCompany.currentPeriod <= 1
                    ? 'Ya estás en el primer periodo del ejercicio (Enero)'
                    : 'Periodo anterior'
                }
                aria-label="Cambiar al periodo contable anterior"
                className="p-0.5 sm:p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              <Calendar className="w-3 h-3 text-blue-700 shrink-0 hidden @[380px]:block mx-0.5" aria-hidden="true" />

              <div className="flex items-center gap-0.5 min-w-0">
                <label htmlFor="period-selector" className="visually-hidden">
                  Periodo Contable
                </label>
                <select
                  id="period-selector"
                  name="currentPeriod"
                  value={activeCompany.currentPeriod}
                  onChange={(e) => updatePeriod(activeCompany.currentYear, Number(e.target.value))}
                  className="text-[11px] sm:text-xs font-bold text-slate-800 bg-transparent cursor-pointer w-[94px] @[420px]:w-[112px] @[760px]:w-[126px] truncate"
                >
                  {MESES_SAT.map((m) => (
                    <option key={m.periodo} value={m.periodo}>
                      P{String(m.periodo).padStart(2, '0')} -{' '}
                      {m.periodo === 13 ? 'Cierre Anual' : m.nombre}
                    </option>
                  ))}
                </select>
                <span className="text-slate-300 text-xs">/</span>
                <label htmlFor="year-selector" className="visually-hidden">
                  Ejercicio Fiscal
                </label>
                <select
                  id="year-selector"
                  name="currentYear"
                  value={activeCompany.currentYear}
                  onChange={(e) => updatePeriod(Number(e.target.value), activeCompany.currentPeriod)}
                  className="text-[11px] sm:text-xs font-bold font-mono text-blue-800 bg-transparent cursor-pointer shrink-0"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => stepPeriod(1)}
                disabled={activeCompany.currentPeriod >= 13}
                title={
                  activeCompany.currentPeriod >= 13
                    ? 'Ya estás en el último periodo (Cierre Anual P13)'
                    : 'Periodo siguiente'
                }
                aria-label="Cambiar al periodo contable siguiente"
                className="p-0.5 sm:p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {activeCompany && (
              <button
                type="button"
                disabled={isTogglingLock}
                aria-pressed={isPeriodLocked}
                aria-busy={isTogglingLock}
                onClick={() => onTogglePeriodLock(!isPeriodLocked)}
                aria-label={isPeriodLocked ? 'Reabrir periodo contable' : 'Bloquear periodo contable'}
                title={
                  isTogglingLock
                    ? 'Actualizando candado de periodo...'
                    : isPeriodLocked
                    ? 'Periodo bloqueado contra cambios. Clic para reabrir periodo.'
                    : 'Periodo abierto para captura. Clic para bloquear tras presentar declaración mensual.'
                }
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0 disabled:opacity-60 disabled:cursor-wait ${
                  isPeriodLocked
                    ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {isTogglingLock ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : isPeriodLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-800" aria-hidden="true" />
                    <span className="hidden @[820px]:inline">Cerrado</span>
                  </>
                ) : (
                  <>
                    <LockOpen className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                    <span className="hidden @[820px]:inline">Abierto</span>
                  </>
                )}
              </button>
            )}

            {user ? (
              <>
                <button
                  type="button"
                  onClick={onOpenAuth}
                  aria-label="Ver perfil y estado de conexión de tu Despacho"
                  title={`Despacho conectado: ${user.email}. Clic para ver perfil.`}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-bold transition cursor-pointer border bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs shrink-0"
                >
                  <Cloud className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                  <span className="hidden @[960px]:inline truncate max-w-[120px]">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Sesión activa" />
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-300 bg-white hover:bg-red-50 hover:border-red-300 text-slate-600 hover:text-red-700 shadow-2xs shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden @[920px]:inline">Salir</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                aria-label="Iniciar sesión"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs"
              >
                <Cloud className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span className="hidden @[700px]:inline">Iniciar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

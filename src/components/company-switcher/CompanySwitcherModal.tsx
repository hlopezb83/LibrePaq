import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  FolderLock,
  Plus,
  Search,
  ShieldCheck,
  X
} from 'lucide-react';
import type { Company } from '../../shared/types';
import { MESES_SAT } from '../../shared/sat-constants';
import { getCompanyInitials, getCompanyTheme, type CompanyTheme } from './companyThemes';
import { CompanySwitchConfirmView } from './CompanySwitchConfirmView';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';

export { getCompanyInitials, getCompanyTheme, type CompanyTheme };

interface CompanySwitcherModalProps {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  companies: Company[];
  activeCompanyId: string;
  onSelectCompany: (company: Company) => void;
  onOpenNewCompanyWizard: () => void;
}

export function CompanySwitcherModal({
  dialogRef,
  companies,
  activeCompanyId,
  onSelectCompany,
  onOpenNewCompanyWizard
}: CompanySwitcherModalProps) {
  const [search, setSearch] = useState('');
  const [pendingTargetCompany, setPendingTargetCompany] = useState<Company | null>(null);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const activeCompany = useMemo(() => {
    return companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null;
  }, [companies, activeCompanyId]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.rfc.toLowerCase().includes(q) ||
        c.regimenFiscal.toLowerCase().includes(q)
    );
  }, [companies, search]);

  const handleClose = () => {
    setPendingTargetCompany(null);
    setHasAcknowledged(false);
    setSearch('');
    dialogRef.current?.close();
  };

  useDialogLightDismiss(dialogRef, handleClose);

  const handleStartSwitch = (target: Company) => {
    if (target.id === activeCompanyId) return;
    setPendingTargetCompany(target);
    setHasAcknowledged(false);
  };

  const handleConfirmSwitch = () => {
    if (!pendingTargetCompany || !hasAcknowledged) return;
    const target = pendingTargetCompany;
    handleClose();
    onSelectCompany(target);
  };

  const currentTheme = activeCompany ? getCompanyTheme(activeCompany.rfc) : getCompanyTheme('');
  const targetTheme = pendingTargetCompany ? getCompanyTheme(pendingTargetCompany.rfc) : null;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={handleClose}
      onCancel={(e) => {
        if (pendingTargetCompany) {
          e.preventDefault();
          setPendingTargetCompany(null);
          setHasAcknowledged(false);
          return;
        }
        handleClose();
      }}
      aria-labelledby="switcher-modal-title"
      className="rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-300 bg-white w-full max-w-2xl max-h-[92dvh] overflow-hidden backdrop:bg-slate-950/60 transition-all p-0"
    >
      <div className="flex flex-col max-h-[92dvh]">
        {/* Cabecera del Conmutador */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-[#0A1120] text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-300 shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="switcher-modal-title" className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Conmutador de Empresa (Multi-RFC)
                </h2>
                <kbd className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  Ctrl+E
                </kbd>
              </div>
              <p className="hidden sm:block text-xs text-slate-400 mt-0.5 truncate">
                Cierra la sesión contable en curso e inicia el espacio de trabajo de la entidad seleccionada.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar conmutador de empresa"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* ================================================================== */}
        {/* VISTA 1: Lista de Empresas para Selección                          */}
        {/* ================================================================== */}
        {!pendingTargetCompany ? (
          <div className="p-3.5 sm:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-3.5">
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && search) {
                    e.stopPropagation();
                    setSearch('');
                  } else if (e.key === 'Enter') {
                    const firstSwitchable = filteredCompanies.find((c) => c.id !== activeCompanyId);
                    if (firstSwitchable) {
                      e.preventDefault();
                      handleStartSwitch(firstSwitchable);
                    }
                  }
                }}
                aria-label="Buscar empresa por Razón Social o RFC"
                placeholder="Buscar empresa por Razón Social o RFC..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-blue-600 focus:border-blue-600 shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpiar búsqueda"
                  title="Limpiar búsqueda"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              <div
                aria-live="polite"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-1"
              >
                Empresas Registradas en tu Despacho ({filteredCompanies.length})
              </div>

              {filteredCompanies.length === 0 && (
                <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">
                    {companies.length === 0
                      ? 'Tu Despacho aún no tiene empresas fiscales registradas.'
                      : 'No se encontraron empresas con ese criterio de búsqueda.'}
                  </p>
                  {companies.length === 0 ? (
                    <p className="text-[11px] text-slate-600">
                      Usa el botón «+ Nueva Empresa» abajo para registrar tu primera razón social o RFC.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      Limpiar búsqueda
                    </button>
                  )}
                </div>
              )}

              {filteredCompanies.map((comp) => {
                const isActive = comp.id === activeCompanyId;
                const theme = getCompanyTheme(comp.rfc);
                const mesNombre =
                  MESES_SAT.find((m) => m.periodo === comp.currentPeriod)?.nombre ||
                  `P${comp.currentPeriod}`;

                return (
                  <div
                    key={comp.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-slate-50/90 border-emerald-300 shadow-2xs'
                        : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        aria-hidden="true"
                        className={`w-9 h-9 rounded-xl ${theme.bg} ${theme.text} font-mono font-bold text-xs flex items-center justify-center shrink-0 border ${theme.border} shadow-2xs mt-0.5`}
                      >
                        {getCompanyInitials(comp.name)}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {comp.name}
                          </span>
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                            {comp.rfc}
                          </span>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
                              SESIÓN EN CURSO
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="truncate max-w-xs">{comp.regimenFiscal}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono font-semibold text-blue-900 bg-blue-50/80 px-1.5 py-0.2 rounded border border-blue-200/60">
                            P{String(comp.currentPeriod).padStart(2, '0')} ({mesNombre}) / {comp.currentYear}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 self-end sm:self-center">
                      {isActive ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                          <span>Empresa Activa</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartSwitch(comp)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer shadow-2xs"
                        >
                          <span>Cambiar a esta Empresa</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================================================================== */
          /* VISTA 2: Paso de Fricción y Confirmación de Responsabilidad Fiscal */
          /* ================================================================== */
          targetTheme && (
            <CompanySwitchConfirmView
              activeCompany={activeCompany}
              pendingTargetCompany={pendingTargetCompany}
              currentTheme={currentTheme}
              targetTheme={targetTheme}
              hasAcknowledged={hasAcknowledged}
              setHasAcknowledged={setHasAcknowledged}
            />
          )
        )}

        {/* Barra de Acciones Inferior */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {!pendingTargetCompany ? (
            <>
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onOpenNewCompanyWizard();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-800 bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-300 transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Nueva Empresa</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 cursor-pointer"
              >
                Cerrar (Esc)
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setPendingTargetCompany(null);
                  setHasAcknowledged(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
              >
                ← Volver a la Lista
              </button>

              <button
                type="button"
                data-confirm-switch="true"
                disabled={!hasAcknowledged}
                title={
                  !hasAcknowledged
                    ? 'Marca la casilla de confirmación fiscal arriba para continuar'
                    : undefined
                }
                onClick={handleConfirmSwitch}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
              >
                <FolderLock className="w-4 h-4" aria-hidden="true" />
                <span>Confirmar y Abrir Empresa</span>
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

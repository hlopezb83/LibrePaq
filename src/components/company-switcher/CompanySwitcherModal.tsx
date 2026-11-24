import React, { useMemo, useState } from 'react';
import { ArrowRight, Building2, FolderLock, Plus, ShieldCheck } from 'lucide-react';
import type { Company } from '../../shared/types';
import { MESES_SAT } from '../../shared/sat-constants';
import { getCompanyInitials, getCompanyTheme, type CompanyTheme } from './companyThemes';
import { CompanySwitchConfirmView } from './CompanySwitchConfirmView';
import {
  Button,
  ClearFiltersButton,
  EmptyState,
  ModalShell,
  SearchInput,
  StatusBadge
} from '../ui';

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

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null,
    [companies, activeCompanyId]
  );

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
    if (dialogRef.current?.open) dialogRef.current.close();
  };

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
    <ModalShell
      dialogRef={dialogRef}
      isOpen={true}
      onClose={handleClose}
      noPrint
      maxWidth="2xl"
      titleId="switcher-modal-title"
      closeLabel="Cerrar conmutador de empresa"
      icon={<Building2 className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Conmutador de Empresa (Multi-RFC)"
      subtitle="Cierra la sesión contable en curso e inicia el espacio de trabajo de la entidad seleccionada."
      headerExtra={
        <kbd className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
          Ctrl+E
        </kbd>
      }
      footerJustify="between"
      footer={
        !pendingTargetCompany ? (
          <>
            <Button
              variant="secondary"
              leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={() => {
                handleClose();
                onOpenNewCompanyWizard();
              }}
            >
              Nueva Empresa
            </Button>
            <Button variant="ghost" onClick={handleClose}>
              Cerrar (Esc)
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setPendingTargetCompany(null);
                setHasAcknowledged(false);
              }}
            >
              ← Volver a la Lista
            </Button>
            <Button
              variant="primary"
              data-confirm-switch="true"
              disabled={!hasAcknowledged}
              title={
                !hasAcknowledged
                  ? 'Marca la casilla de confirmación fiscal arriba para continuar'
                  : undefined
              }
              leftIcon={<FolderLock className="w-4 h-4" aria-hidden="true" />}
              onClick={handleConfirmSwitch}
            >
              Confirmar y Abrir Empresa
            </Button>
          </>
        )
      }
    >
      {!pendingTargetCompany ? (
        <div className="space-y-4">
          <SearchInput
            autoFocus
            value={search}
            onChange={setSearch}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const firstSwitchable = filteredCompanies.find((c) => c.id !== activeCompanyId);
                if (firstSwitchable) {
                  e.preventDefault();
                  handleStartSwitch(firstSwitchable);
                }
              }
            }}
            aria-label="Buscar empresa por Razón Social o RFC"
            placeholder="Buscar empresa por Razón Social o RFC..."
          />

          <div className="space-y-2.5">
            <div
              aria-live="polite"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-1"
            >
              Empresas Registradas en tu Despacho ({filteredCompanies.length})
            </div>

            {filteredCompanies.length === 0 && (
              <EmptyState
                variant="dashed"
                tone="slate"
                icon={<Building2 className="w-5 h-5" aria-hidden="true" />}
                title={
                  companies.length === 0
                    ? 'Tu Despacho aún no tiene empresas fiscales registradas.'
                    : 'No se encontraron empresas con ese criterio de búsqueda.'
                }
                description={
                  companies.length === 0
                    ? 'Usa el botón «Nueva Empresa» abajo para registrar tu primera razón social o RFC.'
                    : undefined
                }
                actions={
                  companies.length > 0 ? (
                    <ClearFiltersButton onClick={() => setSearch('')} label="Limpiar búsqueda" />
                  ) : undefined
                }
              />
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
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs'
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
                        <StatusBadge tone="slate" shape="tag">
                          {comp.rfc}
                        </StatusBadge>
                        {isActive && (
                          <StatusBadge tone="emerald" dot>
                            SESIÓN EN CURSO
                          </StatusBadge>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="truncate max-w-xs">{comp.regimenFiscal}</span>
                        <span className="text-slate-300" aria-hidden="true">•</span>
                        <StatusBadge tone="blue" shape="tag">
                          P{String(comp.currentPeriod).padStart(2, '0')} ({mesNombre}) / {comp.currentYear}
                        </StatusBadge>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 self-end sm:self-center">
                    {isActive ? (
                      <StatusBadge
                        tone="emerald"
                        icon={<ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />}
                        className="px-3 py-1.5"
                      >
                        Empresa Activa
                      </StatusBadge>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
                        onClick={() => handleStartSwitch(comp)}
                      >
                        Cambiar a esta Empresa
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
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
    </ModalShell>
  );
}

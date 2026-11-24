import { useState } from 'react';
import { Activity, Building2, LayoutGrid, Plus, Search, Users } from 'lucide-react';
import { Button, ClearFiltersButton, EmptyState, SearchInput, StatusBadge } from '../../components/ui';
import { useUIModal } from '../../context/UIModalContext';
import type { Company } from '../../shared/types';
import { AjustesDirectorioCompanyCard } from './AjustesDirectorioCompanyCard';
import { ConfirmDeleteCompanyModal } from './ConfirmDeleteCompanyModal';
import { DespachoMonitorPanel } from './DespachoMonitorPanel';

export interface AjustesDirectorioTabProps {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompanyId: (id: string) => void;
  deleteCompanyMutation: {
    mutate: (id: string, options?: { onSuccess?: () => void }) => void;
    isPending: boolean;
  };
  confirmDeleteCompany: boolean;
  setConfirmDeleteCompany: (val: boolean) => void;
  onConfigureFicha: () => void;
  onOpenEfirma?: () => void;
  canDeleteCompany?: boolean;
  canCreateCompany?: boolean;
  canViewDespachoMonitor?: boolean;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export function AjustesDirectorioTab({
  companies,
  activeCompany,
  setActiveCompanyId,
  deleteCompanyMutation,
  confirmDeleteCompany,
  setConfirmDeleteCompany,
  onConfigureFicha,
  onOpenEfirma,
  canDeleteCompany = true,
  canCreateCompany = true,
  canViewDespachoMonitor = false,
  toast
}: AjustesDirectorioTabProps) {
  const { openCompanyWizard } = useUIModal();
  const [companySearch, setCompanySearch] = useState('');
  const [viewMode, setViewMode] = useState<'tarjetas' | 'semaforo'>('tarjetas');
  const [companyPendingDelete, setCompanyPendingDelete] = useState<Company | null>(null);
  const targetDeleteCompany =
    companyPendingDelete ??
    (confirmDeleteCompany && companies.length > 1 && activeCompany ? activeCompany : null);

  const filteredCompanies = companies.filter((c) => {
    if (!companySearch.trim()) return true;
    const q = companySearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.rfc.toLowerCase().includes(q) ||
      c.regimenFiscal.toLowerCase().includes(q)
    );
  });

  const handleSelectCompany = (companyId: string, name: string, rfc: string) => {
    setActiveCompanyId(companyId);
    toast.success(`Cambiado a: ${name} (${rfc})`);
  };

  return (
    <section className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-300/90 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="w-5 h-5 text-blue-700 shrink-0" aria-hidden="true" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Directorio de Empresas Registradas (Multi-RFC)
              </h2>
              <StatusBadge tone="blue" shape="tag" className="px-2.5 py-0.5 rounded-full text-xs">
                {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}
              </StatusBadge>
            </div>
            <p className="text-xs text-slate-500">
              {canViewDespachoMonitor || canCreateCompany
                ? 'Conmuta al instante entre razones sociales o supervisa el semáforo fiscal y contable de todo tu despacho.'
                : 'Consulta las empresas autorizadas para tu usuario en modo solo lectura.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 min-w-0">
            {canViewDespachoMonitor && companies.length > 0 && (
              <div
                role="group"
                aria-label="Modo de vista del directorio"
                className="inline-flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs shrink-0"
              >
                <button
                  type="button"
                  aria-pressed={viewMode === 'tarjetas'}
                  onClick={() => setViewMode('tarjetas')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    viewMode === 'tarjetas' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tarjetas</span>
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === 'semaforo'}
                  onClick={() => setViewMode('semaforo')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                    viewMode === 'semaforo' ? 'bg-white text-blue-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tablero Semáforo</span>
                </button>
              </div>
            )}

            <SearchInput
              id="directorio-company-search"
              name="companySearch"
              aria-label="Buscar empresa por razón social, RFC o régimen fiscal"
              value={companySearch}
              onChange={setCompanySearch}
              placeholder="Buscar por nombre o RFC..."
              clearLabel="Limpiar búsqueda de empresas"
              containerClassName="flex-1 min-w-0 sm:min-w-[180px] sm:max-w-xs"
            />

            {canCreateCompany && (
              <Button
                variant="primary"
                title="Registrar una nueva empresa en el despacho"
                leftIcon={<Plus className="w-4 h-4 shrink-0" aria-hidden="true" />}
                onClick={openCompanyWizard}
              >
                Dar de Alta Empresa
              </Button>
            )}
          </div>
        </div>
        {companySearch.trim() && (
          <p className="mt-2.5 text-[11px] text-slate-600 font-medium" aria-live="polite">
            Mostrando {filteredCompanies.length} de {companies.length}{' '}
            {companies.length === 1 ? 'empresa' : 'empresas'} para &ldquo;{companySearch.trim()}&rdquo;
          </p>
        )}
      </div>

      {companies.length === 0 ? (
        <EmptyState
          variant="card"
          tone="blue"
          icon={<Building2 className="w-5 h-5" aria-hidden="true" />}
          title="Aún no hay empresas registradas"
          description={
            canCreateCompany
              ? 'Da de alta tu primera empresa o cliente del despacho para comenzar a importar CFDIs, generar pólizas y emitir reportes NIF.'
              : 'Aún no tienes empresas asignadas para consultar.'
          }
          actions={
            canCreateCompany ? (
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                onClick={openCompanyWizard}
              >
                Dar de Alta Primera Empresa
              </Button>
            ) : undefined
          }
        />
      ) : filteredCompanies.length === 0 ? (
        <EmptyState
          variant="card"
          tone="slate"
          icon={<Search className="w-5 h-5" aria-hidden="true" />}
          title={`No se encontraron empresas para “${companySearch.trim()}”`}
          description="Verifica el RFC (12 o 13 caracteres) o la razón social, o limpia el filtro para ver todo tu directorio."
          actions={<ClearFiltersButton label="Limpiar búsqueda" onClick={() => setCompanySearch('')} />}
        />
      ) : canViewDespachoMonitor && viewMode === 'semaforo' ? (
        <DespachoMonitorPanel
          companies={filteredCompanies}
          activeCompanyId={activeCompany?.id ?? ''}
          onSelectCompany={handleSelectCompany}
          onOpenEfirma={onOpenEfirma}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCompanies.map((c) => (
            <AjustesDirectorioCompanyCard
              key={c.id}
              company={c}
              isCurrent={c.id === activeCompany?.id}
              companiesCount={companies.length}
              canDeleteCompany={canDeleteCompany}
              isReadOnly={!canCreateCompany}
              confirmDeleteCompany={confirmDeleteCompany}
              setConfirmDeleteCompany={setConfirmDeleteCompany}
              onSelectCompany={(comp) => handleSelectCompany(comp.id, comp.name, comp.rfc)}
              onConfigureFicha={onConfigureFicha}
              onRequestDeleteCompany={setCompanyPendingDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDeleteCompanyModal
        targetCompany={targetDeleteCompany}
        isDeleting={deleteCompanyMutation.isPending}
        onClose={() => {
          setConfirmDeleteCompany(false);
          setCompanyPendingDelete(null);
        }}
        onConfirmDelete={(companyId) => {
          deleteCompanyMutation.mutate(companyId, {
            onSuccess: () => {
              setConfirmDeleteCompany(false);
              setCompanyPendingDelete(null);
            }
          });
        }}
      />
    </section>
  );
}

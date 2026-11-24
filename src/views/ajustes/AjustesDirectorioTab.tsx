import { useState } from 'react';
import { Activity, Building2, LayoutGrid, Plus, Search, Users, X } from 'lucide-react';
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
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap shrink-0">
                {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Conmuta al instante entre razones sociales o supervisa el semáforo fiscal y contable de todo tu despacho.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
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

            <search className="relative flex-1 sm:w-60">
              <label htmlFor="directorio-company-search" className="visually-hidden">
                Buscar empresa por razón social, RFC o régimen fiscal
              </label>
              <Search
                className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="directorio-company-search"
                name="companySearch"
                type="search"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && companySearch) {
                    e.preventDefault();
                    setCompanySearch('');
                  }
                }}
                placeholder="Buscar por nombre o RFC..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-500 focus:outline-blue-700 focus:border-blue-700"
              />
              {companySearch && (
                <button
                  type="button"
                  onClick={() => setCompanySearch('')}
                  aria-label="Limpiar búsqueda de empresas"
                  title="Limpiar búsqueda (Esc)"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </search>

            <button
              type="button"
              disabled={!canCreateCompany}
              title={
                !canCreateCompany
                  ? 'Solo un usuario con permisos de edición puede dar de alta empresas'
                  : 'Registrar una nueva empresa en el despacho'
              }
              onClick={openCompanyWizard}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Dar de Alta Empresa</span>
            </button>
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
        <div className="bg-white rounded-2xl border border-slate-300/90 p-8 text-center space-y-3 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center mx-auto">
            <Building2 className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <p className="text-sm font-bold text-slate-900">Aún no hay empresas registradas</p>
            <p className="text-xs text-slate-600">
              Da de alta tu primera empresa o cliente del despacho para comenzar a importar CFDIs, generar pólizas y emitir reportes NIF.
            </p>
          </div>
          <button
            type="button"
            disabled={!canCreateCompany}
            title={!canCreateCompany ? 'Modo solo lectura: no tienes permisos para crear empresas' : undefined}
            onClick={openCompanyWizard}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Dar de Alta Primera Empresa</span>
          </button>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-300/90 p-8 text-center space-y-3 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center mx-auto">
            <Search className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <p className="text-sm font-bold text-slate-900">
              No se encontraron empresas para &ldquo;{companySearch.trim()}&rdquo;
            </p>
            <p className="text-xs text-slate-600">
              Verifica el RFC (12 o 13 caracteres) o la razón social, o limpia el filtro para ver todo tu directorio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCompanySearch('')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Limpiar búsqueda</span>
          </button>
        </div>
      ) : canViewDespachoMonitor && viewMode === 'semaforo' ? (
        <DespachoMonitorPanel
          companies={filteredCompanies}
          activeCompanyId={activeCompany?.id ?? ''}
          onSelectCompany={handleSelectCompany}
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

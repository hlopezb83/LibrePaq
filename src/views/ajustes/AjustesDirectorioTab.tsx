import { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { validateRfcModulo11 } from '../../shared/accounting-engine';
import { useUIModal } from '../../context/UIModalContext';
import type { Company } from '../../shared/types';
import { ConfirmDeleteCompanyModal } from './ConfirmDeleteCompanyModal';

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
  toast
}: AjustesDirectorioTabProps) {
  const { openCompanyWizard } = useUIModal();
  const [companySearch, setCompanySearch] = useState('');
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

  return (
    <section className="space-y-5">
      {/* Barra Superior del Directorio: Búsqueda y Botón de Alta */}
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
              Conmuta al instante entre razones sociales o da de alta una nueva entidad contable para tu despacho.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <search className="relative flex-1 sm:w-64">
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

      {/* Grid de Empresas o Estado Vacío Accionable */}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCompanies.map((c) => {
            const isCurrent = c.id === activeCompany?.id;
            const m11 = validateRfcModulo11(c.rfc);
            return (
              <div
                key={c.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-br from-emerald-50/50 via-white to-blue-50/40 border-emerald-300 ring-2 ring-emerald-500/30 shadow-xs'
                    : 'bg-white border-slate-300/90 hover:border-slate-400 hover:shadow-xs'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 leading-snug">
                          {c.name}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                            Activa en Uso
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-1">
                        {c.regimenFiscal}
                      </p>
                    </div>

                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-slate-50 border-slate-200 text-slate-600">
                      <Building2 className="w-4 h-4" aria-hidden="true" />
                    </div>
                  </div>

                  {/* Chips de Datos Fiscales */}
                  <div className="flex items-center gap-2 text-xs font-mono flex-wrap pt-1">
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-800 font-bold flex items-center gap-1">
                      RFC: {c.rfc}
                      {m11.isValidCheckDigit ? (
                        <span
                          title="Dígito verificador SAT Módulo 11 válido"
                          className="text-emerald-700 text-[10px] ml-0.5 cursor-help"
                        >
                          ✓ M11
                        </span>
                      ) : m11.expectedCheckDigit ? (
                        <span
                          title={`Dígito verificador SAT Módulo 11 esperado: ${m11.expectedCheckDigit}`}
                          className="text-amber-700 text-[10px] ml-0.5 cursor-help"
                        >
                          ⚠ M11:{m11.expectedCheckDigit}
                        </span>
                      ) : null}
                    </span>
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                      CP: {c.codigoPostal || 'Sin C.P.'}
                    </span>
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                      Ejercicio: {c.currentYear}
                    </span>
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                      Periodo: P{String(c.currentPeriod || 1).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Acciones de la Empresa */}
                <div className="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isCurrent ? (
                      <>
                        <span className="text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Activa en uso
                        </span>
                        <button
                          type="button"
                          onClick={onConfigureFicha}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                        >
                          <span>Configurar Ficha Fiscal</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCompanyId(c.id);
                          toast.success(`Cambiado a: ${c.name} (${c.rfc})`);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-2xs transition cursor-pointer"
                      >
                        <span>Abrir Empresa</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isCurrent && canDeleteCompany && (
                      <button
                        type="button"
                        onClick={() => setCompanyPendingDelete(c)}
                        aria-label={`Eliminar empresa ${c.name}`}
                        title={`Eliminar empresa ${c.name}`}
                        className="p-2 min-w-9 min-h-9 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                    {isCurrent && companies.length > 1 && canDeleteCompany && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCompany(!confirmDeleteCompany)}
                        className="text-[11px] text-slate-500 hover:text-red-700 font-semibold underline cursor-pointer py-1"
                      >
                        Opciones de baja
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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

import { ArrowDownWideNarrow, ArrowUpNarrowWide, Building2, Download } from 'lucide-react';
import { Button, Select } from '../../components/ui';
import type { AdminCompaniesPageQuery } from '../../shared/admin-types';
import type { CompanySort } from './adminCompaniesHelpers';
import { AdminSearchInput } from './AdminSearchInput';

interface AdminCompaniesFilterBarProps {
  total: number;
  query: AdminCompaniesPageQuery;
  sortBy: CompanySort;
  sortDir: 'asc' | 'desc';
  isFetching: boolean;
  canExport: boolean;
  exportCount: number;
  onQueryChange: (next: AdminCompaniesPageQuery) => void;
  onExportCsv: () => void;
}

const OWNER_FILTERS = [
  { id: 'ALL', label: 'Todas' },
  { id: 'user', label: 'De Usuarios' },
  { id: 'superadmin', label: 'SuperAdmin' },
  { id: 'demo', label: 'Demo' }
] as const;

const FIEL_FILTERS = [
  { id: 'ALL', label: 'Cualquier FIEL' },
  { id: 'WITH_FIEL', label: 'Con e.firma' },
  { id: 'WITHOUT_FIEL', label: 'Sin e.firma' }
] as const;

export function AdminCompaniesFilterBar({
  total,
  query,
  sortBy,
  sortDir,
  isFetching,
  canExport,
  exportCount,
  onQueryChange,
  onExportCsv
}: AdminCompaniesFilterBarProps) {
  const ownerFilter = query.ownerType || 'ALL';
  const fielFilter = query.fielFilter || 'ALL';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            Directorio Global de Empresas Fiscales y Usuarios Asignados
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Consulta en tiempo real, cuotas de despacho y diagnóstico en Modo Soporte
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span role="status" aria-live="polite" className="text-[11px] font-mono tabular-nums text-slate-600 whitespace-nowrap">
            {total.toLocaleString('es-MX')} empresas encontradas
          </span>

          <div className="inline-flex items-center gap-1">
            <label htmlFor="admin-companies-sort" className="visually-hidden">Ordenar empresas</label>
            <Select
              size="sm"
              id="admin-companies-sort"
              value={sortBy}
              onChange={(e) => onQueryChange({ ...query, page: 1, sortBy: e.target.value as CompanySort, sortDir })}
              className="font-semibold text-slate-700"
            >
              <option value="createdAt">Fecha creación</option>
              <option value="polizasCount">Pólizas</option>
              <option value="cfdisCount">CFDIs</option>
            </Select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onQueryChange({ ...query, page: 1, sortBy, sortDir: sortDir === 'desc' ? 'asc' : 'desc' })}
              aria-label={`Cambiar orden a ${sortDir === 'desc' ? 'ascendente' : 'descendente'}`}
              title={sortDir === 'desc' ? 'Orden descendente (clic para cambiar a ascendente)' : 'Orden ascendente (clic para cambiar a descendente)'}
              className="px-2"
            >
              {sortDir === 'desc' ? (
                <ArrowDownWideNarrow className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ArrowUpNarrowWide className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </Button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            disabled={!canExport}
            title={!canExport ? 'No hay empresas en la página actual para exportar' : `Exportar ${exportCount} empresas de la página actual en CSV`}
            leftIcon={<Download className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={onExportCsv}
          >
            Exportar CSV
          </Button>

          <AdminSearchInput
            id="admin-companies-search"
            label="Buscar por RFC, razón social o correo electrónico"
            value={query.search || ''}
            onDebouncedChange={(search) => onQueryChange({ ...query, page: 1, search })}
            placeholder="Buscar RFC, empresa o correo... (/)"
            clearAriaLabel="Limpiar búsqueda de empresas"
            isFetching={isFetching}
            className="w-full sm:w-60"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar empresas por propietario" className="inline-flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold gap-1">
          {OWNER_FILTERS.map((btn) => (
            <button
              key={btn.id}
              type="button"
              aria-pressed={ownerFilter === btn.id}
              onClick={() => onQueryChange({ ...query, page: 1, ownerType: btn.id })}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                ownerFilter === btn.id ? (btn.id === 'user' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-white text-slate-900 shadow-2xs') : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Filtrar empresas por vigencia e.firma" className="inline-flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold gap-1">
          {FIEL_FILTERS.map((btn) => (
            <button
              key={btn.id}
              type="button"
              aria-pressed={fielFilter === btn.id}
              onClick={() => onQueryChange({ ...query, page: 1, fielFilter: btn.id })}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                fielFilter === btn.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

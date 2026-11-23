import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import type { AccountWithBalance, Efos69BStatus } from '../../shared/types';
import { Importar69BModal } from './Importar69BModal';
import { PadronProveedoresTable } from './PadronProveedoresTable';
import { usePadronProveedores } from './usePadronProveedores';

export interface PadronProveedoresTabProps {
  companyId: string;
  accounts: AccountWithBalance[];
  isReadOnlyClient?: boolean;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
}

export function PadronProveedoresTab({
  companyId,
  accounts,
  isReadOnlyClient: isReadOnlyClientProp = false,
  onFeedback
}: PadronProveedoresTabProps) {
  const { isReadOnlyClient, isReadOnlySupportMode } = useCompany();
  const isReadOnly = Boolean(isReadOnlyClientProp) || isReadOnlyClient || isReadOnlySupportMode;
  const {
    affectableAccounts,
    thirdParties,
    filteredThirdParties,
    searchQuery,
    setSearchQuery,
    selectThirdPartyForEdit,
    resetForm,
    loadingTp,
    isErrorTp,
    refetchTp,
    tpRfc,
    tpNombre,
    setTpNombre,
    tpOperacion,
    setTpOperacion,
    tpExpenseAcc,
    setTpExpenseAcc,
    tpIvaRate,
    setTpIvaRate,
    tpEfos,
    setTpEfos,
    is69BModalOpen,
    setIs69BModalOpen,
    tpRfcRes,
    handleRfcChange,
    handle69BImportComplete,
    saveThirdPartyMutation
  } = usePadronProveedores({ companyId, accounts, isReadOnlyClient: isReadOnly, onFeedback });

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-700" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Padrón Fiscal por RFC, Cuentas Contables Predeterminadas y Lista 69-B SAT
              </h2>
              <p className="text-xs text-slate-500">
                Asigna la cuenta de gasto/ingreso por proveedor o cliente para que el Contabilizador Automático de CFDIs use cuentas específicas
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => { if (!isReadOnly) setIs69BModalOpen(true); }}
            title={isReadOnly ? 'Modo solo lectura' : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <ShieldAlert className="w-4 h-4 text-red-600" aria-hidden="true" />
            Importar Lista 69-B del SAT (.CSV)
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isReadOnly) saveThirdPartyMutation.mutate();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="tp-rfc" className="block text-[11px] font-bold text-slate-700">
                RFC Proveedor / Cliente *
              </label>
              {tpRfcRes && tpRfcRes.isValidFormat && (
                <div className="flex items-center gap-1">
                  {tpRfcRes.isValidCheckDigit ? (
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" /> M11 OK
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" aria-hidden="true" /> M11: {tpRfcRes.expectedCheckDigit}
                      {tpRfcRes.expectedRfc && (
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => handleRfcChange(tpRfcRes.expectedRfc!)}
                          className="underline text-blue-700 hover:text-blue-900 disabled:opacity-50 cursor-pointer font-bold"
                        >
                          Corregir
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
            <input
              id="tp-rfc"
              type="text"
              required
              disabled={isReadOnly}
              minLength={12}
              maxLength={13}
              value={tpRfc}
              onChange={(e) => handleRfcChange(e.target.value)}
              placeholder="TLE180920K71"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono uppercase bg-white disabled:bg-slate-100"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="tp-nombre" className="block text-[11px] font-bold text-slate-700 mb-1">
              Razón Social *
            </label>
            <input
              id="tp-nombre"
              type="text"
              required
              disabled={isReadOnly}
              value={tpNombre}
              onChange={(e) => setTpNombre(e.target.value)}
              placeholder="Transportes y Logística Empresarial SA de CV"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
            />
          </div>

          <div>
            <label htmlFor="tp-expense-acc" className="block text-[11px] font-bold text-slate-700 mb-1">
              Cuenta Gasto / Operación
            </label>
            <select
              id="tp-expense-acc"
              disabled={isReadOnly}
              value={tpExpenseAcc}
              onChange={(e) => setTpExpenseAcc(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white disabled:bg-slate-100"
            >
              {affectableAccounts.map((acc) => (
                <option key={acc.id} value={acc.code}>
                  {acc.code} - {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tp-iva-rate" className="block text-[11px] font-bold text-slate-700 mb-1">
              Tasa IVA / Op. DIOT
            </label>
            <div className="flex gap-1.5">
              <select
                id="tp-iva-rate"
                aria-label="Tasa de IVA"
                disabled={isReadOnly}
                value={tpIvaRate}
                onChange={(e) => setTpIvaRate(Number(e.target.value) as 16 | 8 | 0)}
                className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white disabled:bg-slate-100"
              >
                <option value={16}>16%</option>
                <option value={8}>8% Frontera</option>
                <option value={0}>0%</option>
              </select>
              <select
                id="tp-operacion-diot"
                aria-label="Tipo de Operación DIOT"
                disabled={isReadOnly}
                value={tpOperacion}
                onChange={(e) => setTpOperacion(e.target.value as '03' | '06' | '85')}
                className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white disabled:bg-slate-100"
              >
                <option value="03">03 Serv. Prof.</option>
                <option value="06">06 Arrend.</option>
                <option value="85">85 Otros</option>
              </select>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="tp-efos" className="block text-[11px] font-bold text-slate-700 mb-1">
                Lista 69-B
              </label>
              <select
                id="tp-efos"
                disabled={isReadOnly}
                value={tpEfos}
                onChange={(e) => setTpEfos(e.target.value as Efos69BStatus)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
              >
                <option value="LIMPIO">Limpio</option>
                <option value="PRESUNTO_EFOS">Presunto</option>
                <option value="DEFINITIVO_EFOS">Definitivo</option>
                <option value="DESVIRTUADO">Desvirtuado</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saveThirdPartyMutation.isPending || isReadOnly}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Guardar
            </button>
            {(tpRfc || tpNombre) && (
              <button
                type="button"
                disabled={isReadOnly}
                onClick={resetForm}
                title="Limpiar formulario"
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  e.preventDefault();
                  setSearchQuery('');
                }
              }}
              aria-label="Buscar proveedor o cliente por RFC, Razón Social o cuenta"
              placeholder="Buscar RFC, razón social o cuenta..."
              className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda de padrón"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-600">
            Mostrando <strong>{filteredThirdParties.length}</strong> de {thirdParties.length} terceros
          </span>
        </div>

        {isErrorTp ? (
          <div role="alert" className="p-6 text-center rounded-xl border border-red-200 bg-red-50/70 space-y-2.5">
            <AlertCircle className="w-6 h-6 text-red-600 mx-auto" aria-hidden="true" />
            <p className="text-xs font-bold text-red-900">Error al cargar el padrón fiscal de terceros</p>
            <button
              type="button"
              onClick={() => void refetchTp()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : loadingTp ? (
          <div role="status" aria-live="polite" aria-busy="true" className="p-8 text-center text-xs text-slate-600">
            Cargando padrón fiscal de terceros...
          </div>
        ) : (
          <PadronProveedoresTable
            thirdParties={filteredThirdParties}
            totalCount={thirdParties.length}
            editingRfc={tpRfc}
            isReadOnlyClient={isReadOnly}
            onEditThirdParty={selectThirdPartyForEdit}
            onClearSearch={() => setSearchQuery('')}
          />
        )}
      </div>

      <Importar69BModal
        isOpen={!isReadOnly && is69BModalOpen}
        onClose={() => setIs69BModalOpen(false)}
        onImportComplete={handle69BImportComplete}
      />
    </div>
  );
}

import { useEffect, useRef } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { checkRfcsAgainstCloud69B } from '../../lib/supabase/supabase-cxc-sat';
import type { AccountWithBalance } from '../../shared/types';
import { Importar69BModal } from './Importar69BModal';
import { PadronProveedoresForm } from './PadronProveedoresForm';
import { PadronProveedoresTable } from './PadronProveedoresTable';
import { usePadronProveedores } from './usePadronProveedores';

export interface PadronProveedoresTabProps {
  companyId: string;
  accounts: AccountWithBalance[];
  isReadOnlyClient?: boolean;
  onFeedback: (msg: string, type?: 'success' | 'error') => void;
  initialRfcToClassify?: { rfc: string; nombre?: string; tipoTercero?: '04' | '05' | '15'; tipoOperacion?: '03' | '06' | '85' } | null;
  onClearInitialClassify?: () => void;
}

export function PadronProveedoresTab({
  companyId,
  accounts,
  isReadOnlyClient: isReadOnlyClientProp = false,
  onFeedback,
  initialRfcToClassify,
  onClearInitialClassify
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
    isEditing,
    loadingTp,
    isErrorTp,
    refetchTp,
    tpRfc,
    tpNombre,
    setTpNombre,
    tpRol,
    setTpRol,
    tpTipoTercero,
    setTpTipoTercero,
    tpIdFiscal,
    setTpIdFiscal,
    tpPais,
    setTpPais,
    tpJurisdiccionFiscal,
    setTpJurisdiccionFiscal,
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

  const checkedCloudKeyRef = useRef<string>('');
  useEffect(() => {
    if (!companyId || thirdParties.length === 0) return;
    const rfcs = thirdParties.map((tp) => tp.rfc).filter((r) => r.length >= 12);
    const key = `${companyId}::${rfcs.join(',')}`;
    if (rfcs.length === 0 || checkedCloudKeyRef.current === key) return;
    checkedCloudKeyRef.current = key;
    void checkRfcsAgainstCloud69B(rfcs, companyId)
      .then((res) => {
        if (res.matches.length > 0) void refetchTp();
      })
      .catch(() => undefined);
  }, [companyId, thirdParties, refetchTp]);

  useEffect(() => {
    if (!initialRfcToClassify) return;
    const match = thirdParties.find((tp) => tp.rfc === initialRfcToClassify.rfc);
    if (match) {
      selectThirdPartyForEdit(match);
    } else if (!loadingTp) {
      handleRfcChange(initialRfcToClassify.rfc);
      if (initialRfcToClassify.nombre) setTpNombre(initialRfcToClassify.nombre);
      if (initialRfcToClassify.tipoTercero) setTpTipoTercero(initialRfcToClassify.tipoTercero);
      if (initialRfcToClassify.tipoOperacion) setTpOperacion(initialRfcToClassify.tipoOperacion);
      document.getElementById('tp-operacion-diot')?.focus();
    }
    if (!loadingTp) {
      onClearInitialClassify?.();
    }
  }, [
    initialRfcToClassify,
    thirdParties,
    loadingTp,
    selectThirdPartyForEdit,
    handleRfcChange,
    setTpNombre,
    setTpTipoTercero,
    setTpOperacion,
    onClearInitialClassify
  ]);

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
              <p className="text-xs text-slate-600">
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

        <PadronProveedoresForm
          isReadOnly={isReadOnly}
          isEditing={isEditing}
          isPending={saveThirdPartyMutation.isPending}
          affectableAccounts={affectableAccounts}
          tpRfc={tpRfc}
          onRfcChange={handleRfcChange}
          tpRfcRes={tpRfcRes}
          tpNombre={tpNombre}
          setTpNombre={setTpNombre}
          tpRol={tpRol}
          setTpRol={setTpRol}
          tpTipoTercero={tpTipoTercero}
          setTpTipoTercero={setTpTipoTercero}
          tpIdFiscal={tpIdFiscal}
          setTpIdFiscal={setTpIdFiscal}
          tpPais={tpPais}
          setTpPais={setTpPais}
          tpJurisdiccionFiscal={tpJurisdiccionFiscal}
          setTpJurisdiccionFiscal={setTpJurisdiccionFiscal}
          tpExpenseAcc={tpExpenseAcc}
          setTpExpenseAcc={setTpExpenseAcc}
          tpIvaRate={tpIvaRate}
          setTpIvaRate={setTpIvaRate}
          tpOperacion={tpOperacion}
          setTpOperacion={setTpOperacion}
          tpEfos={tpEfos}
          setTpEfos={setTpEfos}
          onSubmit={() => saveThirdPartyMutation.mutate()}
          onReset={resetForm}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-80">
            <label htmlFor="padron-search" className="visually-hidden">
              Buscar proveedor o cliente por RFC, Razón Social o cuenta
            </label>
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id="padron-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  e.preventDefault();
                  setSearchQuery('');
                }
              }}
              placeholder="Buscar RFC, razón social o cuenta..."
              className="w-full pl-8 pr-9 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda de padrón"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 min-h-[28px] min-w-[28px] flex items-center justify-center rounded cursor-pointer"
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

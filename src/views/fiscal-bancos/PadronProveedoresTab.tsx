import { useEffect, useRef } from 'react';
import { AlertCircle, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { Button, ClearFiltersButton, EmptyState, SearchInput } from '../../components/ui';
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
    tpContrapartidaAcc,
    setTpContrapartidaAcc,
    tpOperacion,
    setTpOperacion,
    tpExpenseAcc,
    setTpExpenseAcc,
    tpIvaRate,
    setTpIvaRate,
    tpRegionFronteriza,
    setTpRegionFronteriza,
    tpDeductiblePct,
    setTpDeductiblePct,
    tpEfos,
    setTpEfos,
    is69BModalOpen,
    setIs69BModalOpen,
    tpRfcRes,
    handleRfcChange,
    handle69BImportComplete,
    saveThirdPartyMutation,
    deleteThirdPartyMutation
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
          <Button
            variant="danger-outline"
            size="sm"
            disabled={isReadOnly}
            onClick={() => { if (!isReadOnly) setIs69BModalOpen(true); }}
            title={isReadOnly ? 'Modo solo lectura' : undefined}
            leftIcon={<ShieldAlert className="w-4 h-4" aria-hidden="true" />}
          >
            Importar Lista 69-B del SAT (.CSV)
          </Button>
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
          tpContrapartidaAcc={tpContrapartidaAcc}
          setTpContrapartidaAcc={setTpContrapartidaAcc}
          tpExpenseAcc={tpExpenseAcc}
          setTpExpenseAcc={setTpExpenseAcc}
          tpIvaRate={tpIvaRate}
          setTpIvaRate={setTpIvaRate}
          tpRegionFronteriza={tpRegionFronteriza}
          setTpRegionFronteriza={setTpRegionFronteriza}
          tpDeductiblePct={tpDeductiblePct}
          setTpDeductiblePct={setTpDeductiblePct}
          tpOperacion={tpOperacion}
          setTpOperacion={setTpOperacion}
          tpEfos={tpEfos}
          setTpEfos={setTpEfos}
          onSubmit={() => saveThirdPartyMutation.mutate()}
          onReset={resetForm}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="w-full sm:w-80">
              <label htmlFor="padron-search" className="visually-hidden">
                Buscar proveedor o cliente por RFC, Razón Social o cuenta
              </label>
              <SearchInput
                id="padron-search"
                size="sm"
                value={searchQuery}
                onChange={setSearchQuery}
                clearLabel="Limpiar búsqueda de padrón"
                placeholder="Buscar RFC, razón social o cuenta..."
              />
            </div>
            {searchQuery.trim() !== '' && (
              <ClearFiltersButton
                onClick={() => setSearchQuery('')}
                label={`Limpiar (${filteredThirdParties.length}/${thirdParties.length})`}
              />
            )}
          </div>
          <span role="status" aria-live="polite" className="text-[11px] font-mono text-slate-600">
            Mostrando <strong>{filteredThirdParties.length}</strong> de {thirdParties.length} terceros
          </span>
        </div>

        {isErrorTp ? (
          <div role="alert">
            <EmptyState
              variant="dashed"
              tone="red"
              icon={<AlertCircle className="w-6 h-6" aria-hidden="true" />}
              title="Error al cargar el padrón fiscal de terceros"
              actions={
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void refetchTp()}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
                >
                  Reintentar
                </Button>
              }
            />
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
            isDeleting={deleteThirdPartyMutation.isPending}
            onEditThirdParty={selectThirdPartyForEdit}
            onDeleteThirdParty={(id) => deleteThirdPartyMutation.mutate(id)}
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

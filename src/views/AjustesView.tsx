import { useRef, type ComponentType, type KeyboardEvent } from 'react';
import {
  Building2,
  Coins,
  HardDrive,
  KeyRound,
  Keyboard,
  ShieldCheck,
  Sliders,
  Users
} from 'lucide-react';
import { AjustesDirectorioTab } from './ajustes/AjustesDirectorioTab';
import { AjustesEmpresaTab } from './ajustes/AjustesEmpresaTab';
import { AjustesEfirmaTab } from './ajustes/AjustesEfirmaTab';
import { AjustesEquipoTab } from './ajustes/AjustesEquipoTab';
import { AjustesFiscalTab } from './ajustes/AjustesFiscalTab';
import { AjustesRespaldosTab } from './ajustes/AjustesRespaldosTab';
import { AjustesAtajosTab } from './ajustes/AjustesAtajosTab';
import { useAjustesState, type AjustesTab } from './ajustes/useAjustesState';

const AJUSTES_TABS: Array<{
  id: AjustesTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'directorio', label: '1. Directorio', icon: Users },
  { id: 'empresa', label: '2. Empresa', icon: Building2 },
  { id: 'efirma', label: '3. e.Firma / SAT', icon: KeyRound },
  { id: 'fiscal', label: '4. Cédula Día 17', icon: Coins },
  { id: 'respaldos', label: '5. Respaldos', icon: HardDrive },
  { id: 'atajos', label: '6. Atajos F1', icon: Keyboard },
  { id: 'equipo', label: '7. Equipo RBAC', icon: ShieldCheck }
];

export function AjustesView() {
  const state = useAjustesState();
  const {
    companies,
    activeCompany,
    setActiveCompanyId,
    activeTab,
    setActiveTab,
    compName,
    setCompName,
    compRfc,
    setCompRfc,
    compRegimen,
    setCompRegimen,
    compCp,
    setCompCp,
    compMask,
    isRfcValid,
    isCpValid,
    isCompanyDirty,
    resetCompanyForm,
    rfcModulo11,
    updateCompanyMutation,
    confirmDeleteCompany,
    setConfirmDeleteCompany,
    deleteCompanyMutation,
    periodLock,
    togglePeriodLockMutation,
    fielStatus,
    soapRequests,
    cerFile,
    setCerFile,
    keyFile,
    setKeyFile,
    fielPass,
    setFielPass,
    showFielPass,
    setShowFielPass,
    isUploadingFiel,
    handleUploadFiel,
    handleGenerateTestFiel,
    currentYear,
    currentPeriod,
    coefUtilidad,
    setCoefUtilidad,
    tcDof,
    setTcDof,
    perdidasAnt,
    setPerdidasAnt,
    pagosAnt,
    setPagosAnt,
    saldoIvaAnt,
    setSaldoIvaAnt,
    isFiscalDirty,
    resetFiscalForm,
    saveFiscalParamsMutation,
    fiscalWp,
    accountsList,
    polizasData,
    cfdisList,
    isExportingBackup,
    isRestoringBackup,
    pendingRestore,
    confirmRestoreBackup,
    cancelRestoreBackup,
    handleExportBackup,
    handleRestoreBackupFile,
    handleImportCsvCatalog,
    restoreInputRef,
    csvCatalogInputRef,
    toast
  } = state;

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selectAndFocusTab = (nextTab: AjustesTab) => {
    setActiveTab(nextTab);
    const btn = tabRefs.current[nextTab];
    btn?.focus();
    btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = AJUSTES_TABS.length - 1;
    let targetIndex: number | null = null;
    if (e.key === 'ArrowRight') targetIndex = index === lastIndex ? 0 : index + 1;
    else if (e.key === 'ArrowLeft') targetIndex = index === 0 ? lastIndex : index - 1;
    else if (e.key === 'Home') targetIndex = 0;
    else if (e.key === 'End') targetIndex = lastIndex;
    if (targetIndex !== null) {
      e.preventDefault();
      const targetTab = AJUSTES_TABS[targetIndex];
      if (targetTab) selectAndFocusTab(targetTab.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado con Tabs */}
      <header className="bg-white border border-slate-300/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3.5">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900">
                Configuración y Ajustes del Despacho
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap shrink-0">
                {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Identidad fiscal, e.firma SAT Anexo 24, parámetros y respaldos
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Secciones de configuración del despacho"
          className="flex items-center gap-1 erp-tab-scroller max-w-full shrink-0 py-0.5"
        >
          {AJUSTES_TABS.map((tab, index) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={`ajustes-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`ajustes-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectAndFocusTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={`snap-start shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
                {tab.id === 'efirma' && fielStatus?.hasCredentials && (
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                    role="img"
                    aria-label="e.firma activa"
                    title="e.firma activa"
                  />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Renderizado de Pestañas Modulares */}
      <div
        role="tabpanel"
        id={`ajustes-panel-${activeTab}`}
        aria-labelledby={`ajustes-tab-${activeTab}`}
      >
        {activeTab === 'directorio' && (
        <AjustesDirectorioTab
          companies={companies}
          activeCompany={activeCompany}
          setActiveCompanyId={setActiveCompanyId}
          deleteCompanyMutation={deleteCompanyMutation}
          confirmDeleteCompany={confirmDeleteCompany}
          setConfirmDeleteCompany={setConfirmDeleteCompany}
          onConfigureFicha={() => setActiveTab('empresa')}
          toast={toast}
        />
      )}

      {activeTab === 'empresa' && activeCompany && (
        <AjustesEmpresaTab
          activeCompany={activeCompany}
          compName={compName}
          setCompName={setCompName}
          compRfc={compRfc}
          setCompRfc={setCompRfc}
          compRegimen={compRegimen}
          setCompRegimen={setCompRegimen}
          compCp={compCp}
          setCompCp={setCompCp}
          compMask={compMask}
          isRfcValid={isRfcValid}
          isCpValid={isCpValid}
          isCompanyDirty={isCompanyDirty}
          onResetCompany={resetCompanyForm}
          rfcModulo11={rfcModulo11}
          updateCompanyMutation={updateCompanyMutation}
          periodLock={periodLock}
          togglePeriodLockMutation={togglePeriodLockMutation}
        />
      )}

      {activeTab === 'efirma' && activeCompany && (
        <AjustesEfirmaTab
          activeCompany={activeCompany}
          fielStatus={fielStatus}
          soapRequests={soapRequests}
          isUploadingFiel={isUploadingFiel}
          handleGenerateTestFiel={handleGenerateTestFiel}
          handleUploadFiel={handleUploadFiel}
          cerFile={cerFile}
          setCerFile={setCerFile}
          keyFile={keyFile}
          setKeyFile={setKeyFile}
          fielPass={fielPass}
          setFielPass={setFielPass}
          showFielPass={showFielPass}
          setShowFielPass={setShowFielPass}
        />
      )}

      {activeTab === 'fiscal' && activeCompany && (
        <AjustesFiscalTab
          currentYear={currentYear}
          currentPeriod={currentPeriod}
          coefUtilidad={coefUtilidad}
          setCoefUtilidad={setCoefUtilidad}
          tcDof={tcDof}
          setTcDof={setTcDof}
          perdidasAnt={perdidasAnt}
          setPerdidasAnt={setPerdidasAnt}
          pagosAnt={pagosAnt}
          setPagosAnt={setPagosAnt}
          saldoIvaAnt={saldoIvaAnt}
          setSaldoIvaAnt={setSaldoIvaAnt}
          isFiscalDirty={isFiscalDirty}
          onResetFiscal={resetFiscalForm}
          saveFiscalParamsMutation={saveFiscalParamsMutation}
          fiscalWp={fiscalWp}
        />
      )}

      {activeTab === 'respaldos' && activeCompany && (
        <AjustesRespaldosTab
          activeCompany={activeCompany}
          accountsList={accountsList}
          polizasData={polizasData}
          cfdisList={cfdisList}
          isExportingBackup={isExportingBackup}
          isRestoringBackup={isRestoringBackup}
          pendingRestore={pendingRestore}
          confirmRestoreBackup={confirmRestoreBackup}
          cancelRestoreBackup={cancelRestoreBackup}
          handleExportBackup={handleExportBackup}
          handleRestoreBackupFile={handleRestoreBackupFile}
          handleImportCsvCatalog={handleImportCsvCatalog}
          restoreInputRef={restoreInputRef}
          csvCatalogInputRef={csvCatalogInputRef}
        />
      )}

        {activeTab === 'atajos' && <AjustesAtajosTab />}

        {activeTab === 'equipo' && (
          <AjustesEquipoTab
            activeCompany={activeCompany}
            companies={companies}
            toast={toast}
          />
        )}
      </div>
    </div>
  );
}

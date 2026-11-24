import { useCallback, useEffect, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
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
  { id: 'equipo', label: '7. Equipo y Bitácora', icon: ShieldCheck }
];

export function AjustesView() {
  const s = useAjustesState();
  const { activeTab, setActiveTab, activeCompany, companies, companiesLoading } = s;

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const [tabScrollState, setTabScrollState] = useState({ left: false, right: false });

  const updateTabScrollState = useCallback(() => {
    const el = tabListRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setTabScrollState((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    updateTabScrollState();
    window.addEventListener('resize', updateTabScrollState);
    return () => window.removeEventListener('resize', updateTabScrollState);
  }, [updateTabScrollState]);

  const scrollTabsBy = (delta: number) => {
    tabListRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

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

  const needsActiveCompany =
    activeTab === 'empresa' ||
    activeTab === 'efirma' ||
    activeTab === 'fiscal' ||
    activeTab === 'respaldos';

  return (
    <div className="space-y-4">
      {/* Encabezado con Tabs */}
      <header className="bg-white border border-slate-300/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3">
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
              Identidad fiscal, e.firma SAT Anexo 24, reglas contables, equipo y bitácora
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-1 max-w-full min-w-0">
          {tabScrollState.left && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Desplazar pestañas a la izquierda"
              onClick={() => scrollTabsBy(-160)}
              className="shrink-0 w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          <div
            ref={tabListRef}
            onScroll={updateTabScrollState}
            role="tablist"
            aria-label="Secciones de configuración del despacho"
            className="flex flex-nowrap items-center gap-1 erp-tab-scroller max-w-full min-w-0 flex-1 py-0.5"
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
                  className={`snap-start shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {tab.id === 'efirma' && s.fielStatus?.hasCredentials && (
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
          {tabScrollState.right && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Desplazar pestañas a la derecha"
              onClick={() => scrollTabsBy(160)}
              className="shrink-0 w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer shadow-2xs"
            >
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* Renderizado de Pestañas Modulares */}
      <div
        role="tabpanel"
        id={`ajustes-panel-${activeTab}`}
        aria-labelledby={`ajustes-tab-${activeTab}`}
      >
        {needsActiveCompany && companiesLoading && (
          <div role="status" aria-live="polite" aria-busy="true" className="bg-white rounded-2xl border border-slate-300 p-10 text-center text-xs text-slate-600">
            Cargando información de la empresa seleccionada...
          </div>
        )}

        {needsActiveCompany && !companiesLoading && !activeCompany && (
          <div role="status" className="bg-white rounded-2xl border border-slate-300 p-8 text-center space-y-3">
            <Building2 className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-900">No hay empresa activa seleccionada</p>
            <p className="text-xs text-slate-600">
              Selecciona o registra una empresa en el Directorio para configurar esta sección.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('directorio')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
            >
              Ir al Directorio
            </button>
          </div>
        )}

        {activeTab === 'directorio' && (
          <AjustesDirectorioTab
            companies={companies}
            activeCompany={activeCompany}
            setActiveCompanyId={s.setActiveCompanyId}
            deleteCompanyMutation={s.deleteCompanyMutation}
            confirmDeleteCompany={s.confirmDeleteCompany}
            setConfirmDeleteCompany={s.setConfirmDeleteCompany}
            onConfigureFicha={() => setActiveTab('empresa')}
            canDeleteCompany={s.canDeleteOrRestore}
            canCreateCompany={!s.isReadOnlySupportMode}
            toast={s.toast}
          />
        )}

        {activeTab === 'empresa' && activeCompany && (
          <AjustesEmpresaTab
            activeCompany={activeCompany}
            compName={s.compName}
            setCompName={s.setCompName}
            compRfc={s.compRfc}
            setCompRfc={s.setCompRfc}
            compRegimen={s.compRegimen}
            setCompRegimen={s.setCompRegimen}
            compCp={s.compCp}
            setCompCp={s.setCompCp}
            compMask={s.compMask}
            isRfcValid={s.isRfcValid}
            isCpValid={s.isCpValid}
            isCompanyDirty={s.isCompanyDirty}
            onResetCompany={s.resetCompanyForm}
            rfcModulo11={s.rfcModulo11}
            updateCompanyMutation={s.updateCompanyMutation}
            periodLock={s.periodLock}
            togglePeriodLockMutation={s.togglePeriodLockMutation}
            isReadOnly={!s.canEditFiscalConfig}
          />
        )}

        {activeTab === 'efirma' && activeCompany && (
          <AjustesEfirmaTab
            activeCompany={activeCompany}
            fielStatus={s.fielStatus}
            soapRequests={s.soapRequests}
            isUploadingFiel={s.isUploadingFiel}
            handleGenerateTestFiel={s.handleGenerateTestFiel}
            handleUploadFiel={s.handleUploadFiel}
            cerFile={s.cerFile}
            setCerFile={s.setCerFile}
            keyFile={s.keyFile}
            setKeyFile={s.setKeyFile}
            fielPass={s.fielPass}
            setFielPass={s.setFielPass}
            showFielPass={s.showFielPass}
            setShowFielPass={s.setShowFielPass}
            isReadOnly={!s.canEditFiscalConfig}
          />
        )}

        {activeTab === 'fiscal' && activeCompany && (
          <AjustesFiscalTab
            currentYear={s.currentYear}
            currentPeriod={s.currentPeriod}
            coefUtilidad={s.coefUtilidad}
            setCoefUtilidad={s.setCoefUtilidad}
            tcDof={s.tcDof}
            setTcDof={s.setTcDof}
            perdidasAnt={s.perdidasAnt}
            setPerdidasAnt={s.setPerdidasAnt}
            pagosAnt={s.pagosAnt}
            setPagosAnt={s.setPagosAnt}
            saldoIvaAnt={s.saldoIvaAnt}
            setSaldoIvaAnt={s.setSaldoIvaAnt}
            isFiscalDirty={s.isFiscalDirty}
            onResetFiscal={s.resetFiscalForm}
            saveFiscalParamsMutation={s.saveFiscalParamsMutation}
            fiscalWp={s.fiscalWp}
            isReadOnly={!s.canEditFiscalConfig}
          />
        )}

        {activeTab === 'respaldos' && activeCompany && (
          <AjustesRespaldosTab
            activeCompany={activeCompany}
            accountsList={s.accountsList}
            polizasData={s.polizasData}
            cfdisList={s.cfdisList}
            isExportingBackup={s.isExportingBackup}
            isRestoringBackup={s.isRestoringBackup}
            pendingRestore={s.pendingRestore}
            confirmRestoreBackup={s.confirmRestoreBackup}
            cancelRestoreBackup={s.cancelRestoreBackup}
            handleExportBackup={s.handleExportBackup}
            handleRestoreBackupFile={s.handleRestoreBackupFile}
            handleImportCsvCatalog={s.handleImportCsvCatalog}
            restoreInputRef={s.restoreInputRef}
            csvCatalogInputRef={s.csvCatalogInputRef}
            canRestoreBackup={s.canDeleteOrRestore}
            canImportCsv={s.canWriteAccounts}
          />
        )}

        {activeTab === 'atajos' && <AjustesAtajosTab />}

        {activeTab === 'equipo' && (
          <AjustesEquipoTab
            activeCompany={activeCompany}
            companies={companies}
            toast={s.toast}
          />
        )}
      </div>
    </div>
  );
}

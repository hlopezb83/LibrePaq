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
import { Button, EmptyState, PageHeader, StatusBadge, TabBar, type TabBarItem } from '../components/ui';
import { AjustesDirectorioTab } from './ajustes/AjustesDirectorioTab';
import { AjustesEmpresaTab } from './ajustes/AjustesEmpresaTab';
import { AjustesEfirmaTab } from './ajustes/AjustesEfirmaTab';
import { AjustesEquipoTab } from './ajustes/AjustesEquipoTab';
import { AjustesFiscalTab } from './ajustes/AjustesFiscalTab';
import { AjustesRespaldosTab } from './ajustes/AjustesRespaldosTab';
import { AjustesAtajosTab } from './ajustes/AjustesAtajosTab';
import { useAjustesState, type AjustesTab } from './ajustes/useAjustesState';

export function AjustesView() {
  const s = useAjustesState();
  const { activeTab, setActiveTab, activeCompany, companies, companiesLoading } = s;

  const ajustesTabs: Array<TabBarItem<AjustesTab>> = [
    { id: 'directorio', label: 'Directorio', icon: <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    { id: 'empresa', label: 'Empresa y Reglas', icon: <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    {
      id: 'efirma',
      label: 'e.Firma / SAT',
      icon: <KeyRound className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />,
      count: s.fielStatus?.hasCredentials ? 'Activa' : undefined
    },
    { id: 'fiscal', label: 'Cédula Día 17', icon: <Coins className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    { id: 'respaldos', label: 'Respaldos', icon: <HardDrive className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    { id: 'atajos', label: 'Atajos F1', icon: <Keyboard className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
    { id: 'equipo', label: 'Equipo y Bitácora', icon: <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> }
  ];

  const needsActiveCompany =
    activeTab === 'empresa' ||
    activeTab === 'efirma' ||
    activeTab === 'fiscal' ||
    activeTab === 'respaldos';

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<Sliders className="w-5 h-5" aria-hidden="true" />}
        iconTone="blue"
        title="Configuración y Ajustes del Despacho"
        titleBadge={
          <StatusBadge tone="slate">
            {companies.length} {companies.length === 1 ? 'empresa' : 'empresas'}
          </StatusBadge>
        }
        subtitle="Identidad fiscal, e.firma SAT Anexo 24, reglas contables, equipo y bitácora"
        tabs={
          <TabBar
            tabs={ajustesTabs}
            activeId={activeTab}
            onSelect={setActiveTab}
            idPrefix="ajustes-tab-"
            panelId={`ajustes-panel-${activeTab}`}
            ariaLabel="Secciones de configuración del despacho"
          />
        }
      />

      {/* Renderizado de Pestañas Modulares */}
      <div
        role="tabpanel"
        id={`ajustes-panel-${activeTab}`}
        aria-labelledby={`ajustes-tab-${activeTab}`}
      >
        {needsActiveCompany && companiesLoading && (
          <div role="status" aria-live="polite" aria-busy="true" className="bg-white rounded-2xl border border-slate-300/90 p-10 text-center text-xs text-slate-600 shadow-2xs">
            Cargando información de la empresa seleccionada...
          </div>
        )}

        {needsActiveCompany && !companiesLoading && !activeCompany && (
          <EmptyState
            variant="card"
            tone="slate"
            icon={<Building2 className="w-6 h-6" aria-hidden="true" />}
            title="No hay empresa activa seleccionada"
            description="Selecciona o registra una empresa en el Directorio para configurar esta sección."
            actions={
              <Button variant="primary" onClick={() => setActiveTab('directorio')}>
                Ir al Directorio
              </Button>
            }
          />
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
            onOpenEfirma={() => setActiveTab('efirma')}
            canDeleteCompany={s.canDeleteOrRestore}
            canCreateCompany={!s.isReadOnlySupportMode && !s.isReadOnlyClient && s.effectiveCompanyRole !== 'CLIENTE_LECTURA'}
            canViewDespachoMonitor={
              !s.isReadOnlyClient &&
              (s.effectiveCompanyRole === 'OWNER' ||
                s.effectiveCompanyRole === 'SOCIO' ||
                s.effectiveCompanyRole === 'CONTADOR')
            }
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
            canEditRules={!s.isReadOnlySupportMode && !s.isReadOnlyClient}
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
            isLoadingFiscalWp={s.isLoadingFiscalWp}
            isReadOnly={!s.canEditFiscalConfig}
          />
        )}

        {activeTab === 'respaldos' && activeCompany && (
          <AjustesRespaldosTab
            activeCompany={activeCompany}
            accountsList={s.accountsList}
            polizasData={s.polizasData}
            cfdisList={s.cfdisList}
            isLoadingMetrics={s.isLoadingMetrics}
            isErrorMetrics={s.isErrorMetrics}
            refetchMetrics={s.refetchMetrics}
            isExportingBackup={s.isExportingBackup}
            isRestoringBackup={s.isRestoringBackup}
            isImportingCsv={s.isImportingCsv}
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

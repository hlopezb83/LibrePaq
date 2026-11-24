import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { annualTaxClient } from '../../lib/annual-tax-client';
import { apiClient } from '../../lib/api-client';
import { downloadBlobFile, downloadCsvFile } from '../../lib/formatters';
import { getTodayLocalIso } from '../../shared/date-utils';
import {
  isValidSatNumOrden,
  isValidSatNumTramite,
  type SatXmlType
} from '../../shared/sat-anexo24';
import type { Anexo24UiOptions } from './Anexo24OptionsBar';
import type { ReportTabId } from './ReportesHeaderBar';

const VALID_REPORT_TABS: readonly ReportTabId[] = [
  'BALANZA',
  'RESULTADOS',
  'BALANCE',
  'AUXILIARES',
  'FLUJOS_CAPITAL',
  'ANUAL',
  'ANEXO24',
  'ENTREGABLES'
];

function resolveReportTab(raw: unknown): ReportTabId | null {
  if (typeof raw !== 'string') return null;
  const param = raw.toUpperCase() as ReportTabId;
  return VALID_REPORT_TABS.includes(param) ? param : null;
}

function getInitialReportTab(): ReportTabId {
  if (typeof window !== 'undefined' && window.location.search) {
    const resolved = resolveReportTab(new URLSearchParams(window.location.search).get('tab'));
    if (resolved) return resolved;
  }
  return 'BALANZA';
}

export function useReportesManager() {
  const { activeCompany, activeCompanyId } = useCompany();
  const toast = useToast();
  const currentYear = activeCompany?.currentYear;
  const currentPeriod = activeCompany?.currentPeriod;

  const urlTab = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)?.tab
  });

  const [activeTab, setActiveTab] = useState<ReportTabId>(
    () => resolveReportTab(urlTab) ?? getInitialReportTab()
  );
  const [satXmlType, setSatXmlType] = useState<SatXmlType>('balanza');
  const [anexo24Options, setAnexo24Options] = useState<Anexo24UiOptions>({
    tipoEnvio: 'N',
    fechaModBal: getTodayLocalIso(),
    tipoSolicitud: 'AF',
    numOrden: '',
    numTramite: ''
  });

  useEffect(() => {
    const next = resolveReportTab(urlTab);
    if (next) setActiveTab(next);
  }, [urlTab]);

  const { data: periodLock } = useQuery({
    queryKey: ['period-lock', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getPeriodLock(activeCompanyId, currentYear ?? 2026, currentPeriod ?? 10),
    enabled: Boolean(activeCompanyId && currentYear && currentPeriod)
  });
  const isPeriodLocked = Boolean(periodLock?.isLocked);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['reports', activeCompanyId, currentYear, currentPeriod],
    queryFn: () => apiClient.getReports(activeCompanyId, currentYear, currentPeriod),
    enabled: Boolean(activeCompanyId)
  });

  const { data: prevReports, isLoading: isLoadingPrevReports } = useQuery({
    queryKey: ['reports', activeCompanyId, currentYear ? currentYear - 1 : undefined, currentPeriod],
    queryFn: () => apiClient.getReports(activeCompanyId, (currentYear ?? 2026) - 1, currentPeriod),
    enabled: Boolean(
      activeCompanyId && activeTab === 'FLUJOS_CAPITAL' && currentYear && currentYear > 2000
    )
  });

  const { data: annualTaxData } = useQuery({
    queryKey: ['annual-tax', activeCompanyId, currentYear ?? 2026],
    queryFn: () => annualTaxClient.getAnnualTaxSummary(activeCompanyId, currentYear ?? 2026),
    enabled: Boolean(activeCompanyId && activeTab === 'ANUAL')
  });

  const validOrdenQuery =
    !anexo24Options.numOrden.trim() || isValidSatNumOrden(anexo24Options.numOrden)
      ? anexo24Options.numOrden.trim().toUpperCase() || undefined
      : undefined;
  const validTramiteQuery =
    !anexo24Options.numTramite.trim() || isValidSatNumTramite(anexo24Options.numTramite)
      ? anexo24Options.numTramite.trim().toUpperCase() || undefined
      : undefined;

  const {
    data: satXmlData,
    isLoading: isLoadingXml,
    isError: isErrorXml,
    error: xmlError,
    refetch: refetchXml
  } = useQuery({
    queryKey: [
      'sat-xml',
      activeCompanyId,
      satXmlType,
      currentYear,
      currentPeriod,
      anexo24Options.tipoEnvio,
      anexo24Options.fechaModBal,
      anexo24Options.tipoSolicitud,
      validOrdenQuery,
      validTramiteQuery
    ],
    queryFn: () =>
      apiClient.getSatXml(activeCompanyId, satXmlType, currentYear, currentPeriod, {
        tipoEnvio: anexo24Options.tipoEnvio,
        fechaModBal: anexo24Options.fechaModBal,
        tipoSolicitud: anexo24Options.tipoSolicitud,
        numOrden: validOrdenQuery,
        numTramite: validTramiteQuery
      }),
    enabled: Boolean(activeCompanyId && activeTab === 'ANEXO24')
  });

  const handleDownloadXml = () => {
    if (!satXmlData) return;
    downloadBlobFile(satXmlData.filename, satXmlData.xml, 'application/xml;charset=utf-8');
    toast.success(`XML Anexo 24 descargado: ${satXmlData.filename}`);
  };

  const handleExportBalanzaCsv = () => {
    if (!data) return;
    const periodCode = `P${String(data.periodo).padStart(2, '0')}`;
    if (activeTab === 'RESULTADOS') {
      const base = data.incomeStatement.totalIngresos || 0;
      const pct = (val: number) => (base !== 0 ? `${((val / base) * 100).toFixed(1)}%` : '0.0%');
      downloadCsvFile(
        `Estado_Resultados_${data.company.rfc}_${data.ejercicio}_${periodCode}.csv`,
        ['Rubro Contable', 'Código', 'Nombre Cuenta', 'Importe MXN', '% s/Ventas'],
        [
          ...data.incomeStatement.ingresos.map((a) => ['INGRESOS', a.code, a.name, a.finalBalance, pct(a.finalBalance)]),
          ['TOTAL INGRESOS', '', 'Ventas Netas del Periodo', data.incomeStatement.totalIngresos, '100.0%'],
          ...data.incomeStatement.costos.map((a) => ['COSTOS', a.code, a.name, a.finalBalance, pct(a.finalBalance)]),
          ['UTILIDAD BRUTA', '', 'Utilidad Bruta Operativa', data.incomeStatement.utilidadBruta, pct(data.incomeStatement.utilidadBruta)],
          ...data.incomeStatement.gastos.map((a) => ['GASTOS', a.code, a.name, a.finalBalance, pct(a.finalBalance)]),
          ['UTILIDAD NETA', '', 'Resultado Neto del Periodo', data.incomeStatement.utilidadNeta, pct(data.incomeStatement.utilidadNeta)]
        ]
      );
      toast.success('Estado de Resultados exportado en CSV');
      return;
    }
    if (activeTab === 'BALANCE') {
      downloadCsvFile(
        `Balance_General_${data.company.rfc}_${data.ejercicio}_${periodCode}.csv`,
        ['Clasificación', 'Código', 'Nombre Cuenta', 'Saldo Final MXN'],
        [
          ...data.balanceSheet.activos.map((a) => ['ACTIVO', a.code, a.name, a.finalBalance]),
          ['TOTAL ACTIVO', '100', 'Total Activo', data.balanceSheet.totalActivo],
          ...data.balanceSheet.pasivos.map((a) => ['PASIVO', a.code, a.name, a.finalBalance]),
          ['TOTAL PASIVO', '200', 'Total Pasivo', data.balanceSheet.totalPasivo],
          ...data.balanceSheet.capital.map((a) => ['CAPITAL', a.code, a.name, a.finalBalance]),
          ['UTILIDAD EJERCICIO', '305', 'Resultado del Ejercicio Actual', data.balanceSheet.utilidadEjercicio],
          ['PASIVO + CAPITAL', '', 'Suma Pasivo y Capital Contable', data.balanceSheet.totalPasivoMasCapital]
        ]
      );
      toast.success('Balance General exportado en CSV');
      return;
    }
    if (activeTab === 'ANUAL') {
      if (!annualTaxData) {
        toast.info('Calculando resumen de Declaración Anual, intenta nuevamente en un segundo.');
        return;
      }
      const { reconciliation: rec, determination: det, inflation: inf } = annualTaxData;
      downloadCsvFile(
        `Declaracion_Anual_${data.company.rfc}_${annualTaxData.ejercicio}.csv`,
        ['Sección', 'Concepto', 'Importe / Valor'],
        [
          ['Conciliación Contable-Fiscal', 'Utilidad / Pérdida Contable', rec.utilidadContable],
          ['Conciliación Contable-Fiscal', '(+) Ingresos Fiscales No Contables', rec.ingresosFiscalesNoContables],
          ['Conciliación Contable-Fiscal', '(+) Deducciones Contables No Fiscales', rec.deduccionesContablesNoFiscales],
          ['Conciliación Contable-Fiscal', '(-) Deducciones Fiscales No Contables', -rec.deduccionesFiscalesNoContables],
          ['Conciliación Contable-Fiscal', '(-) PTU Pagada en el Ejercicio', -rec.ptuPagadaEjercicio],
          ['Conciliación Contable-Fiscal', '(=) Utilidad / Pérdida Fiscal', rec.utilidadFiscal],
          ['Conciliación Contable-Fiscal', '(-) Pérdidas Fiscales Aplicadas', -rec.perdidasFiscalesAplicadas],
          ['Conciliación Contable-Fiscal', '(=) Resultado Fiscal Gravable', rec.resultadoFiscal],
          ['Ajuste Anual por Inflación', 'Promedio Anual de Créditos', inf.promedioCreditos],
          ['Ajuste Anual por Inflación', 'Promedio Anual de Deudas', inf.promedioDeudas],
          ['Ajuste Anual por Inflación', `Efecto (${inf.tipo})`, inf.tipo === 'ACUMULABLE' ? inf.ajusteAcumulable : inf.tipo === 'DEDUCIBLE' ? -inf.ajusteDeducible : 0],
          ['Determinación ISR Anual', 'ISR Anual Causado', det.isrAnualCausado],
          ['Determinación ISR Anual', '(-) Pagos Provisionales Efectuados', -det.pagosProvisionalesEfectuados],
          ['Determinación ISR Anual', '(-) ISR Retenido Acreditable', -det.isrRetenidoAcreditable],
          ['Determinación ISR Anual', det.isrAnualCargoFavor >= 0 ? '(=) ISR Anual a Cargo' : '(=) Saldo a Favor de ISR', det.isrAnualCargoFavor >= 0 ? det.isrACargo : det.isrAFavor],
          ['Determinación ISR Anual', 'PTU por Pagar (10%)', det.ptuPorPagar10Pct],
          ['Determinación ISR Anual', 'Nuevo Coeficiente de Utilidad', det.nuevoCoeficienteUtilidad.toFixed(4)],
          ['CUCA y CUFIN', 'CUCA Final Actualizada', det.cucaFinal],
          ['CUCA y CUFIN', 'CUFIN Final Actualizada', det.cufinFinal]
        ]
      );
      toast.success('Declaración Anual exportada en CSV');
      return;
    }
    const headers = [
      'Código Cuenta', 'Nombre de la Cuenta', 'Agrupador SAT', 'Naturaleza',
      'Nivel', 'Saldo Inicial', 'Cargos (Debe)', 'Abonos (Haber)', 'Saldo Final'
    ];
    const rows = data.trialBalance.map((r) => [
      r.code, r.name, r.satGroupCode, r.nature, r.level,
      r.initialBalanceComputed, r.periodCharges, r.periodCredits, r.finalBalance
    ]);
    downloadCsvFile(`Balanza_${data.company.rfc}_${data.ejercicio}_${periodCode}.csv`, headers, rows);
    toast.success('Balanza de Comprobación exportada en CSV');
  };

  return {
    activeTab,
    setActiveTab,
    satXmlType,
    setSatXmlType,
    anexo24Options,
    setAnexo24Options,
    data,
    prevReports,
    isLoadingPrevReports,
    isLoading,
    isError,
    error,
    refetch,
    isPeriodLocked,
    satXmlData,
    isLoadingXml,
    isErrorXml,
    xmlError,
    refetchXml,
    handleDownloadXml,
    handleExportBalanzaCsv
  };
}

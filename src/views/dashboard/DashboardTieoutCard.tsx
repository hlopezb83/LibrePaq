import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Scale,
  ShieldAlert
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { formatCurrency } from '../../lib/formatters';
import { computeThreeWayTieout } from '../../shared/engine/three-way-tieout.engine';
import type { Company } from '../../shared/types';
import { DashboardTieoutDetail } from './DashboardTieoutDetail';

interface DashboardTieoutCardProps {
  company: Company;
  mesActualNombre: string;
}

export function DashboardTieoutCard({ company, mesActualNombre }: DashboardTieoutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const ejercicio = company.currentYear;
  const periodo = company.currentPeriod;

  const {
    data: accounts = [],
    isLoading: loadingAcc,
    isError: errorAcc,
    isFetching: fetchingAcc,
    refetch: refetchAcc
  } = useQuery({
    queryKey: ['accounts', company.id, ejercicio, periodo],
    queryFn: () => apiClient.getAccounts(company.id, ejercicio, periodo),
    enabled: Boolean(company.id)
  });

  const {
    data: cfdis = [],
    isLoading: loadingCfdi,
    isError: errorCfdi,
    isFetching: fetchingCfdi,
    refetch: refetchCfdi
  } = useQuery({
    queryKey: ['cfdis', company.id],
    queryFn: () => apiClient.getCfdis(company.id),
    enabled: Boolean(company.id)
  });

  const {
    data: polizas = [],
    isLoading: loadingPol,
    isError: errorPol,
    isFetching: fetchingPol,
    refetch: refetchPol
  } = useQuery({
    queryKey: ['polizas', company.id, ejercicio, periodo],
    queryFn: () => apiClient.getPolizas(company.id, ejercicio, periodo),
    enabled: Boolean(company.id)
  });

  const {
    data: diotReport,
    isLoading: loadingDiot,
    isError: errorDiot,
    isFetching: fetchingDiot,
    refetch: refetchDiot
  } = useQuery({
    queryKey: ['diot', company.id, ejercicio, periodo],
    queryFn: () => apiClient.getDiotReport(company.id, ejercicio, periodo),
    enabled: Boolean(company.id)
  });

  const isLoading = loadingAcc || loadingCfdi || loadingPol || loadingDiot;
  const isError = errorAcc || errorCfdi || errorPol || errorDiot;
  const isFetching = fetchingAcc || fetchingCfdi || fetchingPol || fetchingDiot;

  const handleRetry = () => {
    void Promise.all([refetchAcc(), refetchCfdi(), refetchPol(), refetchDiot()]);
  };

  const tieout = useMemo(
    () =>
      computeThreeWayTieout({
        company,
        ejercicio,
        periodo,
        cfdis,
        polizas,
        trialBalance: accounts,
        diotReport
      }),
    [company, ejercicio, periodo, cfdis, polizas, accounts, diotReport]
  );

  const hasTieoutActivity =
    polizas.length > 0 ||
    tieout.satAdd.pendingCfdisCount > 0 ||
    tieout.diot.suppliersCount > 0 ||
    tieout.causes.length > 0 ||
    [
      tieout.satAdd.ingresosNetos,
      tieout.satAdd.gastosNetos,
      tieout.satAdd.ivaTrasladado,
      tieout.satAdd.ivaAcreditable,
      tieout.contabilidad.ingresos401_402,
      tieout.contabilidad.gastos501_601,
      tieout.contabilidad.ivaCobrado208,
      tieout.contabilidad.ivaPagado118,
      tieout.contabilidad.bancos102Cargos,
      tieout.contabilidad.bancos102Abonos,
      tieout.diot.actosPagadosTotal
    ].some((v) => Math.abs(v) >= 0.01);

  const badgeStyle = isLoading
    ? 'bg-slate-100 text-slate-700 border-slate-300'
    : isError
      ? 'bg-red-50 text-red-800 border-red-300'
      : !hasTieoutActivity
        ? 'bg-slate-100 text-slate-700 border-slate-300'
        : tieout.status === 'VERDE'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : tieout.status === 'AMARILLO'
            ? 'bg-amber-50 text-amber-900 border-amber-300'
            : 'bg-red-50 text-red-800 border-red-300';

  const statusLabel = isLoading
    ? 'Calculando amarre...'
    : isError
      ? 'Error al consultar amarre'
      : !hasTieoutActivity
        ? 'Sin movimientos en el periodo'
        : tieout.status === 'VERDE'
          ? 'Amarre 3-Vías Cuadrado ($0.00)'
          : tieout.status === 'AMARILLO'
            ? 'Amarre con Observaciones'
            : 'Discrepancia ADD ↔ Libros ↔ DIOT';

  const deltaPills = [
    { label: 'Dif. Ing', value: tieout.deltas.deltaIngresos },
    { label: 'Dif. Gas', value: tieout.deltas.deltaGastos },
    { label: 'Dif. IVA Acred', value: tieout.deltas.deltaIvaAcreditable },
    { label: 'Dif. IVA Tras', value: tieout.deltas.deltaIvaTrasladado }
  ];

  return (
    <section
      aria-label="Amarre Integral 3-Vías SAT ADD, Contabilidad y DIOT"
      className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden"
    >
      <div className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900">
                Amarre Integral 3-Vías ({mesActualNombre} {ejercicio})
              </h2>
              <span
                role="status"
                aria-live="polite"
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle}`}
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" aria-hidden="true" />
                ) : isError ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                ) : !hasTieoutActivity ? (
                  <Scale className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                ) : tieout.status === 'VERDE' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                ) : tieout.status === 'AMARILLO' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                )}
                <span>{statusLabel}</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Cruce automático en pesos ($): <strong>SAT ADD</strong> (PUE+REP neto NC) vs <strong>Contabilidad</strong> (401/501/601/208/118/102) vs <strong>DIOT</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums min-w-0">
            {deltaPills.map((pill) => {
              const hasDiff = Math.abs(pill.value) >= 0.01;
              const isHigh = hasDiff && tieout.status === 'ROJO';
              const pillClass = !hasDiff
                ? 'bg-slate-100 border-slate-200 text-slate-800'
                : isHigh
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900';
              return (
                <span
                  key={pill.label}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${pillClass}`}
                >
                  {hasDiff && (
                    <AlertTriangle
                      className={`w-3 h-3 shrink-0 ${isHigh ? 'text-red-600' : 'text-amber-600'}`}
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {pill.label}: <strong>{formatCurrency(pill.value)}</strong>
                  </span>
                </span>
              );
            })}
          </div>

          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="dashboard-tieout-detail"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer shrink-0"
          >
            <span>{expanded ? 'Ocultar detalle' : 'Ver detalle 3-Vías'}</span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {isError && (
        <div
          role="alert"
          className="mx-4 mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-2 text-xs text-red-900"
        >
          <span>No fue posible consultar todas las fuentes del amarre 3-Vías (Balanza, ADD, Pólizas o DIOT).</span>
          <button
            type="button"
            disabled={isFetching}
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-red-100 border border-red-300 font-bold text-red-800 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isFetching ? 'Reintentando...' : 'Reintentar'}</span>
          </button>
        </div>
      )}

      {expanded && <DashboardTieoutDetail tieout={tieout} hasTieoutActivity={hasTieoutActivity} />}
    </section>
  );
}

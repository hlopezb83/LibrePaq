import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Scale,
  ShieldAlert
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { formatCurrency } from '../../lib/formatters';
import { computeThreeWayTieout } from '../../shared/engine/three-way-tieout.engine';
import type { Company } from '../../shared/types';

interface DashboardTieoutCardProps {
  company: Company;
  mesActualNombre: string;
}

export function DashboardTieoutCard({ company, mesActualNombre }: DashboardTieoutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const ejercicio = company.currentYear;
  const periodo = company.currentPeriod;

  const { data: accounts = [], isLoading: loadingAcc } = useQuery({
    queryKey: ['accounts', company.id, ejercicio, periodo],
    queryFn: () => apiClient.getAccounts(company.id, ejercicio, periodo),
    enabled: Boolean(company.id)
  });

  const { data: cfdis = [], isLoading: loadingCfdi } = useQuery({
    queryKey: ['cfdis', company.id],
    queryFn: () => apiClient.getCfdis(company.id),
    enabled: Boolean(company.id)
  });

  const { data: polizas = [], isLoading: loadingPol } = useQuery({
    queryKey: ['polizas', company.id, ejercicio, periodo],
    queryFn: () => apiClient.getPolizas(company.id, ejercicio, periodo),
    enabled: Boolean(company.id)
  });

  const { data: diotReport, isLoading: loadingDiot } = useQuery({
    queryKey: ['diot', company.id, ejercicio, periodo],
    queryFn: () => apiClient.getDiotReport(company.id, ejercicio, periodo),
    enabled: Boolean(company.id)
  });

  const isLoading = loadingAcc || loadingCfdi || loadingPol || loadingDiot;

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

  const badgeStyle =
    tieout.status === 'VERDE'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : tieout.status === 'AMARILLO'
        ? 'bg-amber-50 text-amber-900 border-amber-300'
        : 'bg-red-50 text-red-800 border-red-300';

  const statusLabel =
    tieout.status === 'VERDE'
      ? 'Amarre 3-Vías Cuadrado ($0.00)'
      : tieout.status === 'AMARILLO'
        ? 'Amarre con Observaciones'
        : 'Discrepancia ADD ↔ Libros ↔ DIOT';

  return (
    <section
      aria-label="Amarre Integral 3-Vías SAT ADD, Contabilidad y DIOT"
      className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden"
    >
      <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900">
                Amarre Integral 3-Vías ({mesActualNombre} {ejercicio})
              </h2>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle}`}>
                {tieout.status === 'VERDE' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                ) : tieout.status === 'AMARILLO' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                )}
                <span>{isLoading ? 'Calculando...' : statusLabel}</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Cruce automático en pesos ($): <strong>SAT ADD</strong> (PUE+REP neto NC) vs <strong>Contabilidad</strong> (401/501/601/208/118/102) vs <strong>DIOT</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
              Δ Ing: <strong>{formatCurrency(tieout.deltas.deltaIngresos)}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
              Δ Gas: <strong>{formatCurrency(tieout.deltas.deltaGastos)}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
              Δ IVA Acred: <strong>{formatCurrency(tieout.deltas.deltaIvaAcreditable)}</strong>
            </span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
              Δ IVA Tras: <strong>{formatCurrency(tieout.deltas.deltaIvaTrasladado)}</strong>
            </span>
          </div>

          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
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

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-1.5">
              <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                1. SAT ADD (Flujo PUE + REP)
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ingresos cobrados netos:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.satAdd.ingresosNetos)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Gastos pagados netos:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.satAdd.gastosNetos)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">IVA Trasladado ADD:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.satAdd.ivaTrasladado)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">IVA Acreditable ADD:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.satAdd.ivaAcreditable)}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-1.5">
              <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                2. Contabilidad (Libros)
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ingresos (401/402):</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.contabilidad.ingresos401_402)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Costos y Gastos (501/601):</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.contabilidad.gastos501_601)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">IVA Cobrado (208):</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.contabilidad.ivaCobrado208)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">IVA Pagado (118):</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.contabilidad.ivaPagado118)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-600">Flujo Bancos (102 Neto):</span>
                <span className="font-mono font-bold text-blue-900">{formatCurrency(tieout.contabilidad.bancos102Neto)}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-1.5">
              <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                3. DIOT ({tieout.diot.suppliersCount} proveedores)
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Actos pagados totales:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.diot.actosPagadosTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Actos gravados 16%/8%:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.diot.actosGravados16y8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">IVA Acreditable DIOT:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.diot.ivaAcreditablePagado)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-600">Δ IVA Libros vs DIOT:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(tieout.deltas.deltaIvaAcreditableDiot)}</span>
              </div>
            </div>
          </div>

          {tieout.causes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800">Causas accionables detectadas:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {tieout.causes.map((cause) => (
                  <div
                    key={cause.code}
                    className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
                      cause.severity === 'HIGH'
                        ? 'bg-red-50/80 border-red-200 text-red-950'
                        : 'bg-amber-50/80 border-amber-200 text-amber-950'
                    }`}
                  >
                    <div className="space-y-0.5 text-xs min-w-0">
                      <p className="font-bold">{cause.title}</p>
                      <p className="text-[11px] opacity-90">{cause.detail}</p>
                    </div>
                    <Link
                      to={cause.targetRoute}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-bold text-slate-800 hover:bg-slate-100 shrink-0"
                    >
                      <span>Revisar</span>
                      <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>Sin discrepancias entre SAT ADD, Contabilidad y DIOT para el periodo activo.</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

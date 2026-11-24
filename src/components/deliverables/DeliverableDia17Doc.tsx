import { formatCurrency } from '../../lib/formatters';
import type { Company } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface FiscalData {
  isrProvisional: {
    esResico?: boolean;
    ingresosPeriodo: number;
    ingresosAcumuladosEjercicio: number;
    deduccionesAutorizadasPeriodo: number;
    coeficienteUtilidadAplicado: number;
    utilidadFiscalEstimada: number;
    perdidasFiscalesAplicadas: number;
    baseGravableIsr: number;
    tasaIsrPct: number;
    isrCausado: number;
    pagosProvisionalesPrevios: number;
    isrRetenidoPeriodo: number;
    isrNetoAPagar: number;
  };
  ivaDefinitivo: {
    actosGravadosCobrado16: number;
    ivaTrasladadoCobrado: number;
    ivaAcreditablePagado: number;
    saldoFavorIvaAcreditable: number;
    ivaNetoAPagar: number;
    saldoFavorIvaRemanente: number;
  };
  resumenLineaCapturaSat: {
    isrProvisionalAPagar: number;
    ivaDefinitivoAPagar: number;
    retencionesIsrPorEnterar: number;
    retencionesIvaPorEnterar: number;
    totalEstimadoDia17: number;
  };
}

interface DeliverableDia17DocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  issuanceCity?: string;
  issuanceDate: string;
  fechaVencimientoDia17: string;
  fiscalData: FiscalData;
  isrSaldoNoAplicado: number;
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

export function DeliverableDia17Doc({
  company,
  year,
  period,
  mesNombre,
  firmName,
  issuanceCity,
  issuanceDate,
  fechaVencimientoDia17,
  fiscalData,
  isrSaldoNoAplicado,
  auditorName,
  auditorCedula,
  legalRepName,
  legalRepTitle
}: DeliverableDia17DocProps) {
  return (
    <article className="max-w-5xl mx-auto bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-8 space-y-5">
      <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {firmName}
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mt-0.5">
            {company.name}
          </h2>
          <div className="text-xs font-mono text-slate-600">
            RFC: <span className="font-bold text-slate-900">{company.rfc}</span> • {company.regimenFiscal}
          </div>
          <div className="text-xs font-bold text-blue-900 mt-1 uppercase">
            Papel de Trabajo de Impuestos Federales (Cédula Día 17 SAT)
          </div>
          <div className="text-[11px] text-slate-500">
            Determinación Provisional de ISR y Definitiva de IVA • Periodo: <strong>{mesNombre} {year}</strong>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOC-FIS-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
          <div className="text-amber-800 font-bold mt-1">Vencimiento: {fechaVencimientoDia17}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs dia17-grid">
        {/* 1. Determinación ISR Provisional (renglón por renglón, cuadra aritméticamente) */}
        <div className="border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between bg-white dia17-card">
          <div>
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded mb-2 dia17-card-title">
              {fiscalData.isrProvisional.esResico
                ? '1. ISR Provisional (RESICO)'
                : '1. ISR Provisional (Art. 14 LISR)'}
            </div>
            <div className="space-y-1 tabular-nums">
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>Ingresos nominales del mes</span>
                <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.ingresosPeriodo)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>Ingresos acumulados (P01–P{String(Math.min(period, 12)).padStart(2, '0')})</span>
                <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.ingresosAcumuladosEjercicio)}</span>
              </div>
              {fiscalData.isrProvisional.esResico ? (
                <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                  <span>(−) Deducciones autorizadas</span>
                  <span className="font-mono">-{formatCurrency(fiscalData.isrProvisional.deduccionesAutorizadasPeriodo)}</span>
                </div>
              ) : (
                <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                  <span>(×) Coeficiente de utilidad</span>
                  <span className="font-mono">{fiscalData.isrProvisional.coeficienteUtilidadAplicado.toFixed(4)}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 text-slate-900 font-semibold dia17-row">
                <span>(=) Utilidad fiscal estimada</span>
                <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.utilidadFiscalEstimada)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>(−) Pérdidas fiscales aplicadas</span>
                <span className="font-mono">-{formatCurrency(fiscalData.isrProvisional.perdidasFiscalesAplicadas)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-900 font-semibold dia17-row">
                <span>(=) Base gravable</span>
                <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.baseGravableIsr)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>(×) Tasa de ISR</span>
                <span className="font-mono">{fiscalData.isrProvisional.tasaIsrPct.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-900 font-semibold dia17-row">
                <span>(=) ISR causado</span>
                <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.isrCausado)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>(−) Pagos provisionales anteriores</span>
                <span className="font-mono">-{formatCurrency(fiscalData.isrProvisional.pagosProvisionalesPrevios)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>(−) ISR retenido acreditable</span>
                <span className="font-mono">-{formatCurrency(fiscalData.isrProvisional.isrRetenidoPeriodo)}</span>
              </div>
            </div>
          </div>
          <div className="mt-2">
            <div className="pt-1.5 border-t-2 border-slate-800 font-bold flex justify-between text-slate-900 bg-slate-50 p-1.5 rounded">
              <span>(=) ISR a cargo</span>
              <span className="font-mono text-blue-900 font-extrabold">
                {formatCurrency(fiscalData.isrProvisional.isrNetoAPagar)}
              </span>
            </div>
            {isrSaldoNoAplicado > 0 && (
              <p className="mt-1 text-[10px] leading-snug text-slate-500">
                Los acreditamientos exceden el ISR causado por {formatCurrency(isrSaldoNoAplicado)}; no hay pago a cargo en el periodo.
              </p>
            )}
          </div>
        </div>

        {/* Columna derecha: IVA definitivo + Retenciones */}
        <div className="flex flex-col gap-4 dia17-col-right">
          {/* 2. Determinación IVA Definitivo */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-white dia17-card">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded mb-2 dia17-card-title">
              2. IVA definitivo (Art. 5-D LIVA)
            </div>
            <div className="space-y-1 tabular-nums">
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>Actos gravados cobrados al 16%</span>
                <span className="font-mono">{formatCurrency(fiscalData.ivaDefinitivo.actosGravadosCobrado16)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>IVA trasladado cobrado</span>
                <span className="font-mono">{formatCurrency(fiscalData.ivaDefinitivo.ivaTrasladadoCobrado)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>(−) IVA acreditable pagado</span>
                <span className="font-mono">-{formatCurrency(fiscalData.ivaDefinitivo.ivaAcreditablePagado)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>(−) Saldo a favor de periodos anteriores</span>
                <span className="font-mono">-{formatCurrency(fiscalData.ivaDefinitivo.saldoFavorIvaAcreditable)}</span>
              </div>
            </div>
            <div className="mt-2 pt-1.5 border-t-2 border-slate-800 font-bold flex justify-between text-slate-900 bg-slate-50 p-1.5 rounded">
              <span>(=) IVA a cargo</span>
              <span className="font-mono text-blue-900 font-extrabold">
                {formatCurrency(fiscalData.ivaDefinitivo.ivaNetoAPagar)}
              </span>
            </div>
            {fiscalData.ivaDefinitivo.saldoFavorIvaRemanente > 0 && (
              <p className="mt-1 text-[10px] leading-snug text-emerald-800">
                Saldo a favor remanente: {formatCurrency(fiscalData.ivaDefinitivo.saldoFavorIvaRemanente)}
              </p>
            )}
          </div>

          {/* 3. Retenciones Federales a Enterar */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-white dia17-card">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded mb-2 dia17-card-title">
              3. Retenciones por enterar
            </div>
            <div className="space-y-1 tabular-nums">
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>ISR retenido (salarios y honorarios)</span>
                <span className="font-mono">{formatCurrency(fiscalData.resumenLineaCapturaSat.retencionesIsrPorEnterar)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>IVA retenido (Art. 1-A LIVA)</span>
                <span className="font-mono">{formatCurrency(fiscalData.resumenLineaCapturaSat.retencionesIvaPorEnterar)}</span>
              </div>
            </div>
            <div className="mt-2 pt-1.5 border-t-2 border-slate-800 font-bold flex justify-between text-slate-900 bg-slate-50 p-1.5 rounded">
              <span>(=) Total retenciones</span>
              <span className="font-mono text-blue-900 font-extrabold">
                {formatCurrency(
                  fiscalData.resumenLineaCapturaSat.retencionesIsrPorEnterar +
                  fiscalData.resumenLineaCapturaSat.retencionesIvaPorEnterar
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Total Proyección Línea de Captura Día 17 */}
      <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm font-bold font-mono shadow-sm">
        <div>
          <div className="text-[11px] text-slate-400 font-normal uppercase tracking-wider">
            Línea de Captura Portal SAT (DyP)
          </div>
          <div className="uppercase tracking-wide text-xs sm:text-sm text-slate-100">
            TOTAL ESTIMADO A PAGAR DÍA 17:
          </div>
        </div>
        <div className="text-right tabular-nums">
          <div className="text-amber-300 text-lg sm:text-xl font-extrabold font-mono whitespace-nowrap">
            {formatCurrency(fiscalData.resumenLineaCapturaSat.totalEstimadoDia17)}
          </div>
          <div className="text-[10px] text-slate-400 font-normal">
            (ISR: {formatCurrency(fiscalData.resumenLineaCapturaSat.isrProvisionalAPagar)} + IVA: {formatCurrency(fiscalData.resumenLineaCapturaSat.ivaDefinitivoAPagar)} + Retenciones: {formatCurrency(fiscalData.resumenLineaCapturaSat.retencionesIsrPorEnterar + fiscalData.resumenLineaCapturaSat.retencionesIvaPorEnterar)})
          </div>
        </div>
      </div>

      {/* Bloque de Firmas */}
      <DeliverableSignaturesBlock
        auditorName={auditorName}
        auditorCedula={auditorCedula}
        legalRepName={legalRepName}
        legalRepTitle={legalRepTitle}
      />
    </article>
  );
}

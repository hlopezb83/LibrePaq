import { formatCurrency } from '../../lib/formatters';
import type { Company, FiscalWorkpaperResponse } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableDia17DocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  preparerName?: string;
  logoDataUrl?: string;
  issuanceCity?: string;
  issuanceDate: string;
  fechaVencimientoDia17: string;
  fiscalData: FiscalWorkpaperResponse;
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
  preparerName,
  logoDataUrl,
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
  const isPersonaFisica = company.rfc.trim().length === 13;
  const isResico = fiscalData.isrProvisional.esResico;
  const isResicoPf = isResico && isPersonaFisica;
  const isResicoPm = isResico && !isPersonaFisica;
  const isPfGeneral = isPersonaFisica && !isResico;

  const isrSectionTitle = isResicoPf
    ? '1. ISR Mensual (PF RESICO Art. 113-E)'
    : isResicoPm
      ? '1. ISR Provisional (PM RESICO Flujo)'
      : isPfGeneral
        ? '1. ISR Provisional (PF Art. 106 LISR)'
        : '1. ISR Provisional (PM Art. 14 LISR)';

  const dedAcum =
    fiscalData.isrProvisional.deduccionesAcumuladasEjercicio ??
    fiscalData.isrProvisional.deduccionesAutorizadasPeriodo;
  const pCode = `P${String(Math.min(period, 12)).padStart(2, '0')}`;
  const ivaRetAcred = fiscalData.ivaDefinitivo.ivaRetenidoAcreditable ?? 0;
  const retDesglose = fiscalData.retencionesDesglose ?? [];
  const totalRetenciones =
    fiscalData.resumenLineaCapturaSat.retencionesIsrPorEnterar +
    fiscalData.resumenLineaCapturaSat.retencionesIvaPorEnterar;

  return (
    <article className="max-w-5xl mx-auto bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-8 space-y-5">
      <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {logoDataUrl && (
            <img src={logoDataUrl} alt={`Logo ${firmName}`} className="max-h-12 w-auto object-contain rounded shrink-0" />
          )}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{firmName}</div>
            <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mt-0.5">{company.name}</h2>
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
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOC-FIS-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
          <div className="text-amber-800 font-bold mt-1">Vencimiento: {fechaVencimientoDia17}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs dia17-grid">
        <div className="border border-slate-200 rounded-lg p-3.5 flex flex-col justify-between bg-white dia17-card">
          <div>
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded mb-2 dia17-card-title">
              {isrSectionTitle}
            </div>
            <div className="space-y-1 tabular-nums">
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>Ingresos cobrados / nominales del mes</span>
                <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.ingresosPeriodo)}</span>
              </div>
              {!isResicoPf && (
                <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                  <span>Ingresos acumulados (P01–{pCode})</span>
                  <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.ingresosAcumuladosEjercicio)}</span>
                </div>
              )}
              {(isResicoPm || isPfGeneral) ? (
                <>
                  <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                    <span>(−) Deducciones del mes</span>
                    <span className="font-mono">-{formatCurrency(fiscalData.isrProvisional.deduccionesAutorizadasPeriodo)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                    <span>(−) Deducciones acumuladas (P01–{pCode})</span>
                    <span className="font-mono">-{formatCurrency(dedAcum)}</span>
                  </div>
                </>
              ) : !isResicoPf ? (
                <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                  <span>(×) Coeficiente de utilidad (Art. 14)</span>
                  <span className="font-mono">{fiscalData.isrProvisional.coeficienteUtilidadAplicado.toFixed(4)}</span>
                </div>
              ) : null}

              {!isResicoPf && (
                <>
                  <div className="flex justify-between gap-3 text-slate-900 font-semibold dia17-row">
                    <span>(=) Utilidad fiscal estimada</span>
                    <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.utilidadFiscalEstimada)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                    <span>(−) Pérdidas fiscales aplicadas</span>
                    <span className="font-mono">-{formatCurrency(fiscalData.isrProvisional.perdidasFiscalesAplicadas)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between gap-3 text-slate-900 font-semibold dia17-row">
                <span>(=) Base gravable ISR</span>
                <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.baseGravableIsr)}</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                <span>{isPfGeneral ? 'Tasa efectiva Tarifa Art. 106' : '(×) Tasa de ISR'}</span>
                <span className="font-mono">{fiscalData.isrProvisional.tasaIsrPct.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between gap-3 text-slate-900 font-semibold dia17-row">
                <span>(=) ISR causado</span>
                <span className="font-mono">{formatCurrency(fiscalData.isrProvisional.isrCausado)}</span>
              </div>
              {!isResicoPf && (
                <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                  <span>(−) Pagos provisionales anteriores</span>
                  <span className="font-mono">-{formatCurrency(fiscalData.isrProvisional.pagosProvisionalesPrevios)}</span>
                </div>
              )}
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

        <div className="flex flex-col gap-4 dia17-col-right">
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
                <span>(−) IVA retenido acreditable (por clientes)</span>
                <span className="font-mono">-{formatCurrency(ivaRetAcred)}</span>
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

          <div className="border border-slate-200 rounded-lg p-3.5 bg-white dia17-card">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded mb-2 dia17-card-title">
              3. Retenciones por enterar (Desglose SAT)
            </div>
            <div className="space-y-1 tabular-nums">
              {retDesglose.length > 0 ? (
                retDesglose.map((r) => (
                  <div key={`${r.code}-${r.tipo}`} className="flex justify-between gap-3 text-slate-700 dia17-row">
                    <span>
                      <span className="font-mono text-[10px] text-slate-500 mr-1">{r.code}</span>
                      {r.name}
                    </span>
                    <span className="font-mono">{formatCurrency(r.amount)}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                    <span>ISR retenido por enterar</span>
                    <span className="font-mono">{formatCurrency(fiscalData.resumenLineaCapturaSat.retencionesIsrPorEnterar)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-700 dia17-row">
                    <span>IVA retenido (Art. 1-A LIVA)</span>
                    <span className="font-mono">{formatCurrency(fiscalData.resumenLineaCapturaSat.retencionesIvaPorEnterar)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-2 pt-1.5 border-t-2 border-slate-800 font-bold flex justify-between text-slate-900 bg-slate-50 p-1.5 rounded">
              <span>(=) Total retenciones</span>
              <span className="font-mono text-blue-900 font-extrabold">{formatCurrency(totalRetenciones)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm font-bold font-mono shadow-sm">
        <div>
          <div className="text-[11px] text-slate-400 font-normal uppercase tracking-wider">Línea de Captura Portal SAT (DyP)</div>
          <div className="uppercase tracking-wide text-xs sm:text-sm text-slate-100">TOTAL ESTIMADO A PAGAR DÍA 17:</div>
        </div>
        <div className="text-right tabular-nums">
          <div className="text-amber-300 text-lg sm:text-xl font-extrabold font-mono whitespace-nowrap">
            {formatCurrency(fiscalData.resumenLineaCapturaSat.totalEstimadoDia17)}
          </div>
          <div className="text-[10px] text-slate-400 font-normal">
            (ISR: {formatCurrency(fiscalData.resumenLineaCapturaSat.isrProvisionalAPagar)} + IVA: {formatCurrency(fiscalData.resumenLineaCapturaSat.ivaDefinitivoAPagar)} + Retenciones: {formatCurrency(totalRetenciones)})
          </div>
        </div>
      </div>

      <DeliverableSignaturesBlock
        preparerName={preparerName}
        auditorName={auditorName}
        auditorCedula={auditorCedula}
        legalRepName={legalRepName}
        legalRepTitle={legalRepTitle}
      />
    </article>
  );
}

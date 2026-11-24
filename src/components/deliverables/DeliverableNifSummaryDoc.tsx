import { formatCurrency } from '../../lib/formatters';
import { formatBalanceCutoffLabel } from '../../shared/date-utils';
import type { Company, CxcCxpAgingResponse } from '../../shared/types';
import type { ExtendedFinancialStatementsResponse } from '../../shared/types/extended-statements.types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableNifSummaryDocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  preparerName?: string;
  logoDataUrl?: string;
  issuanceCity?: string;
  issuanceDate: string;
  extendedStatements: ExtendedFinancialStatementsResponse;
  agingData?: CxcCxpAgingResponse | null;
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

export function DeliverableNifSummaryDoc({
  company, year, period, mesNombre, firmName, preparerName, logoDataUrl,
  issuanceCity, issuanceDate, extendedStatements, agingData,
  auditorName, auditorCedula, legalRepName, legalRepTitle
}: DeliverableNifSummaryDocProps) {
  const { cashFlow, equityChanges, cashFlowWindowLabel } = extendedStatements;
  const cutoff = formatBalanceCutoffLabel(year, period, mesNombre);

  return (
    <article className="max-w-5xl mx-auto bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-8 space-y-5 print-page-break mb-8">
      <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {logoDataUrl && (
            <img src={logoDataUrl} alt={`Logo ${firmName}`} className="max-h-12 w-auto object-contain rounded shrink-0" />
          )}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{firmName}</div>
            <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mt-0.5">{company.name}</h2>
            <div className="text-xs font-mono text-slate-600">RFC: <span className="font-bold text-slate-900">{company.rfc}</span> • {cutoff}</div>
            <div className="text-xs font-bold text-blue-900 mt-1 uppercase">
              Flujos de Efectivo (NIF B-2), Capital Contable (NIF B-4) y Antigüedad CxC/CxP
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOC-NIF-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
        </div>
      </div>

      <section className="border border-slate-200 rounded-lg overflow-hidden text-xs">
        <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-900 flex flex-wrap justify-between gap-2">
          <span>1. Estado de Flujos de Efectivo — Método Indirecto (NIF B-2)</span>
          <span className="font-normal text-slate-600">{cashFlowWindowLabel}</span>
        </div>
        <div className="p-3 space-y-1.5 font-mono tabular-nums">
          <div className="flex justify-between">
            <span className="font-sans text-slate-700">Utilidad (o Pérdida) Neta Base</span>
            <span>{formatCurrency(cashFlow.utilidadNeta)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans text-slate-700">(+) Partidas Virtuales (Depreciación)</span>
            <span>{formatCurrency(cashFlow.totalPartidasVirtuales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans text-slate-700">(+/-) Cambios en Capital de Trabajo</span>
            <span>{formatCurrency(cashFlow.totalCambiosCapitalTrabajo)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
            <span className="font-sans text-slate-900">Flujo Neto de Actividades de Operación</span>
            <span>{formatCurrency(cashFlow.flujoNetoOperacion)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans text-slate-700">Flujo Neto de Actividades de Inversión</span>
            <span>{formatCurrency(cashFlow.flujoNetoInversion)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-sans text-slate-700">Flujo Neto de Actividades de Financiamiento</span>
            <span>{formatCurrency(cashFlow.flujoNetoFinanciamiento)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t-2 border-slate-800 font-bold text-slate-900">
            <div>Variación: {formatCurrency(cashFlow.variacionNetaEfectivo)}</div>
            <div className="sm:text-center">Inicial (101-103): {formatCurrency(cashFlow.efectivoInicial)}</div>
            <div className="sm:text-right text-blue-900">Final: {formatCurrency(cashFlow.efectivoFinal)}</div>
          </div>
        </div>
      </section>

      <section className="border border-slate-200 rounded-lg overflow-hidden text-xs">
        <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-900">
          2. Estado de Cambios en el Capital Contable (NIF B-4)
        </div>
        <div tabIndex={0} role="region" aria-label="Estado de Cambios en el Capital Contable NIF B-4" className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="visually-hidden">Estado de Cambios en el Capital Contable (NIF B-4)</caption>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-700">
              <th scope="col" className="text-left px-2.5 py-1.5">Concepto</th>
              {equityChanges.columns.map((c) => (
                <th scope="col" key={c.key} className="text-right px-2.5 py-1.5 whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
            {equityChanges.rows.map((r) => (
              <tr key={r.id} className={r.rowType !== 'MOVEMENT' ? 'bg-slate-50 font-bold text-slate-900' : 'text-slate-700'}>
                <th scope="row" className="text-left font-sans font-normal px-2.5 py-1.5">{r.concepto}</th>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(r.capitalSocial)}</td>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(r.reservaLegal)}</td>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(r.resultadosAcumulados)}</td>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(r.resultadoEjercicio)}</td>
                <td className="text-right px-2.5 py-1.5 font-bold whitespace-nowrap">{formatCurrency(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {agingData && (
        <section className="border border-slate-200 rounded-lg overflow-hidden text-xs avoid-page-break">
          <div className="bg-slate-100 px-3 py-1.5 font-bold uppercase text-[11px] text-slate-900 flex justify-between gap-2">
            <span>3. Antigüedad de Saldos PPD (CxC Clientes y CxP Proveedores)</span>
            <span className="font-mono text-[10px] text-slate-600 shrink-0">Corte: {agingData.asOfDate}</span>
          </div>
          <div tabIndex={0} role="region" aria-label="Antigüedad de Saldos PPD" className="overflow-x-auto">
          <table className="w-full border-collapse font-mono tabular-nums">
            <caption className="visually-hidden">Antigüedad de Saldos PPD (CxC y CxP)</caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-700 font-sans">
                <th scope="col" className="text-left px-3 py-1.5">Cartera</th>
                <th scope="col" className="text-right px-2.5 py-1.5 whitespace-nowrap">0–30 días</th>
                <th scope="col" className="text-right px-2.5 py-1.5 whitespace-nowrap">31–60 días</th>
                <th scope="col" className="text-right px-2.5 py-1.5 whitespace-nowrap">61–90 días</th>
                <th scope="col" className="text-right px-2.5 py-1.5 whitespace-nowrap">+90 días</th>
                <th scope="col" className="text-right px-3 py-1.5 whitespace-nowrap">Saldo Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <th scope="row" className="text-left font-sans font-semibold px-3 py-1.5 whitespace-nowrap">CxC Clientes ({agingData.cxcItems.length})</th>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(agingData.cxcBuckets['0_30'])}</td>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(agingData.cxcBuckets['31_60'])}</td>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(agingData.cxcBuckets['61_90'])}</td>
                <td className="text-right px-2.5 py-1.5 text-red-700 whitespace-nowrap">{formatCurrency(agingData.cxcBuckets['90_PLUS'])}</td>
                <td className="text-right px-3 py-1.5 font-bold text-blue-900 whitespace-nowrap">{formatCurrency(agingData.cxcTotal)}</td>
              </tr>
              <tr>
                <th scope="row" className="text-left font-sans font-semibold px-3 py-1.5 whitespace-nowrap">CxP Proveedores ({agingData.cxpItems.length})</th>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(agingData.cxpBuckets['0_30'])}</td>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(agingData.cxpBuckets['31_60'])}</td>
                <td className="text-right px-2.5 py-1.5 whitespace-nowrap">{formatCurrency(agingData.cxpBuckets['61_90'])}</td>
                <td className="text-right px-2.5 py-1.5 text-red-700 whitespace-nowrap">{formatCurrency(agingData.cxpBuckets['90_PLUS'])}</td>
                <td className="text-right px-3 py-1.5 font-bold text-slate-900 whitespace-nowrap">{formatCurrency(agingData.cxpTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </section>
      )}

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

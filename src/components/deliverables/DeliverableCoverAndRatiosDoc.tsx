import { formatCurrency } from '../../lib/formatters';
import { formatBalanceCutoffLabel } from '../../shared/date-utils';
import { computeExecutiveFinancialRatios } from '../../shared/engine/financial-ratios.engine';
import type { Company, FinancialStatementsResponse, FiscalWorkpaperResponse } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableCoverAndRatiosDocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  preparerName?: string;
  logoDataUrl?: string;
  accountantNotes?: string;
  issuanceCity?: string;
  issuanceDate: string;
  reportsData: FinancialStatementsResponse;
  fiscalData?: FiscalWorkpaperResponse | null;
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

const fmtRatio = (val: number | null, suffix: string) =>
  val === null ? 'S/D' : `${val.toFixed(suffix === '%' ? 1 : 2)}${suffix}`;

export function DeliverableCoverAndRatiosDoc({
  company, year, period, mesNombre, firmName, preparerName, logoDataUrl,
  accountantNotes, issuanceCity, issuanceDate, reportsData, fiscalData,
  auditorName, auditorCedula, legalRepName, legalRepTitle
}: DeliverableCoverAndRatiosDocProps) {
  const ratios = computeExecutiveFinancialRatios(reportsData);
  const cutoff = formatBalanceCutoffLabel(year, period, mesNombre);
  const er = reportsData.incomeStatement;
  const bs = reportsData.balanceSheet;

  const kpiCards = [
    { label: 'Ingresos Netos (YTD)', val: formatCurrency(er.totalIngresos), tone: 'text-slate-900' },
    { label: er.utilidadNeta < 0 ? 'Pérdida Neta (YTD)' : 'Utilidad Neta (YTD)', val: formatCurrency(er.utilidadNeta), tone: er.utilidadNeta < 0 ? 'text-red-700' : 'text-emerald-800' },
    { label: 'Total Activo (NIF B-6)', val: formatCurrency(bs.totalActivo), tone: 'text-blue-900' },
    { label: 'Obligación SAT Día 17', val: formatCurrency(fiscalData?.resumenLineaCapturaSat.totalEstimadoDia17 ?? 0), tone: 'text-amber-800' }
  ];

  const ratioRows = [
    { name: 'Razón de Liquidez (Circulante)', formula: 'Activo Circulante / Pasivo Corto Plazo', value: fmtRatio(ratios.razonCirculante, 'x'), note: 'Capacidad de pago inmediato' },
    { name: 'Prueba Ácida', formula: '(Activo Circulante − Inventarios) / Pasivo CP', value: fmtRatio(ratios.pruebaAcida, 'x'), note: 'Liquidez sin depender de inventario' },
    { name: 'Capital de Trabajo Neto', formula: 'Activo Circulante − Pasivo Corto Plazo', value: formatCurrency(ratios.capitalTrabajoNeto), note: 'Colchón operativo de corto plazo' },
    { name: 'Nivel de Endeudamiento', formula: 'Pasivo Total / Activo Total', value: fmtRatio(ratios.endeudamientoPct, '%'), note: 'Proporción financiada por terceros' },
    { name: 'Apalancamiento Financiero', formula: 'Pasivo Total / Capital Contable', value: fmtRatio(ratios.apalancamiento, 'x'), note: 'Relación deuda vs patrimonio' },
    { name: 'Margen Bruto (NIF B-3)', formula: 'Utilidad Bruta / Ventas Netas', value: fmtRatio(ratios.margenBrutoPct, '%'), note: 'Rentabilidad directa tras costo' },
    { name: 'Margen Operativo (NIF B-3)', formula: 'Utilidad de Operación / Ventas Netas', value: fmtRatio(ratios.margenOperativoPct, '%'), note: 'Eficiencia operativa antes de RIF/ISR' },
    { name: 'Margen Neto (NIF B-3)', formula: 'Utilidad Neta / Ventas Netas', value: fmtRatio(ratios.margenNetoPct, '%'), note: 'Rendimiento final para socios' },
    { name: 'Rendimiento s/Capital (ROE)', formula: 'Utilidad Neta / Capital Contable', value: fmtRatio(ratios.roePct, '%'), note: 'Retorno patrimonial acumulado' }
  ];

  return (
    <article className="max-w-5xl mx-auto bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-8 space-y-5 print-page-break mb-8">
      <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {logoDataUrl && (
            <img src={logoDataUrl} alt={`Logo ${firmName}`} className="max-h-14 w-auto object-contain rounded shrink-0" />
          )}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-blue-900">{firmName}</div>
            <h2 className="text-2xl font-extrabold text-slate-900 uppercase tracking-tight mt-0.5">{company.name}</h2>
            <div className="text-xs font-mono text-slate-600 mt-0.5">
              RFC: <span className="font-bold text-slate-900">{company.rfc}</span> • {company.regimenFiscal} • CP {company.codigoPostal}
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1.5 uppercase">
              Informe Ejecutivo a Socios, Razones Financieras y Notas Contables
            </div>
            <div className="text-[11px] text-slate-600">{cutoff} • Cifras en Pesos Mexicanos (MXN)</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOSSIER-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {kpiCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-600">{c.label}</div>
            <div className={`mt-1 text-base font-extrabold font-mono tabular-nums ${c.tone}`}>{c.val}</div>
          </div>
        ))}
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
        <div className="bg-slate-100 px-3.5 py-2 font-bold uppercase text-[11px] text-slate-900 border-b border-slate-200">
          Indicadores y Razones Financieras Clave (NIF A-3)
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-600">
              <th className="text-left py-1.5 px-3">Razón Financiera</th>
              <th className="text-left py-1.5 px-3">Fórmula</th>
              <th className="text-right py-1.5 px-3">Resultado</th>
              <th className="text-left py-1.5 px-3 hidden sm:table-cell">Interpretación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ratioRows.map((r) => (
              <tr key={r.name}>
                <td className="py-1.5 px-3 font-semibold text-slate-900">{r.name}</td>
                <td className="py-1.5 px-3 text-slate-600 font-mono text-[11px]">{r.formula}</td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-blue-900 tabular-nums whitespace-nowrap">{r.value}</td>
                <td className="py-1.5 px-3 text-slate-600 hidden sm:table-cell">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-1.5 avoid-page-break">
        <div className="font-bold uppercase text-[11px] text-slate-900">
          Notas y Revelaciones del Contador Público
        </div>
        <p className="text-slate-700 whitespace-pre-line leading-relaxed">
          {accountantNotes?.trim()
            ? accountantNotes.trim()
            : `Los estados financieros adjuntos al ${cutoff.toLowerCase()} fueron preparados conforme a las Normas de Información Financiera (NIF B-2, B-3, B-4 y B-6) y conciliados contra los CFDI 4.0 vigentes en la Bóveda ADD y la Cédula de Impuestos Federales Día 17.`}
        </p>
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

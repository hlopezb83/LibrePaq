import { formatCurrency } from '../../lib/formatters';
import { formatBalanceCutoffLabel } from '../../shared/date-utils';
import type { Company, AccountWithBalance, FinancialStatementsResponse } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableBalanceDocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  preparerName?: string;
  logoDataUrl?: string;
  issuanceCity?: string;
  issuanceDate: string;
  hideZeroAccounts?: boolean;
  balanceSheet: FinancialStatementsResponse['balanceSheet'];
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

export function DeliverableBalanceDoc({
  company, year, period, mesNombre, firmName, preparerName, logoDataUrl,
  issuanceCity, issuanceDate, hideZeroAccounts = false, balanceSheet,
  auditorName, auditorCedula, legalRepName, legalRepTitle
}: DeliverableBalanceDocProps) {
  const cutoffLabel = formatBalanceCutoffLabel(year, period, mesNombre);
  const isBalanced = Math.abs(balanceSheet.totalActivo - balanceSheet.totalPasivoMasCapital) < 0.05;
  const isLoss = balanceSheet.utilidadEjercicio < 0;
  const totalCapital = balanceSheet.totalPasivoMasCapital - balanceSheet.totalPasivo;

  const nif = balanceSheet.nifB6;
  const actCirc = nif?.activoCirculante ?? balanceSheet.activos;
  const actNoCirc = nif?.activoNoCirculante ?? [];
  const pasCp = nif?.pasivoCortoPlazo ?? balanceSheet.pasivos;
  const pasLp = nif?.pasivoLargoPlazo ?? [];
  const capContrib = nif?.capitalContribuido ?? balanceSheet.capital;
  const capGanado = nif?.capitalGanado ?? [];

  const renderSectionRows = (items: AccountWithBalance[], expectedNature: 'DEUDORA' | 'ACREEDORA') =>
    items
      .filter((a) => !hideZeroAccounts || Math.abs(a.finalBalance) >= 0.01)
      .map((a) => {
        const displayBal = a.nature !== expectedNature ? -a.finalBalance : a.finalBalance;
        return (
          <div
            key={a.id}
            className={`flex justify-between gap-2 py-0.5 balance-row ${
              a.level === 2 ? 'font-bold text-slate-900 bg-slate-100/70 rounded px-1.5 mt-0.5' : 'pl-5 pr-1 text-slate-700'
            }`}
          >
            <span className={`min-w-0 ${a.level === 2 ? 'font-semibold' : 'text-slate-600'}`}>
              <span className="font-mono whitespace-nowrap mr-1.5">{a.code}</span>
              <span>— {a.name}</span>
            </span>
            <span className={`font-mono tabular-nums whitespace-nowrap shrink-0 ${displayBal < 0 ? 'text-red-700 font-semibold' : a.level === 2 ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
              {formatCurrency(displayBal)}
            </span>
          </div>
        );
      });

  const renderSubtotal = (label: string, val: number) => (
    <div className="pt-1 border-t border-slate-200 font-bold flex justify-between text-slate-800 bg-slate-50/70 px-1.5 rounded balance-row">
      <span>{label}:</span>
      <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(val)}</span>
    </div>
  );

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
            <div className="text-xs font-mono text-slate-600">
              RFC: <span className="font-bold text-slate-900">{company.rfc}</span> • {company.regimenFiscal}
            </div>
            <div className="text-xs font-bold text-blue-900 mt-1 uppercase">Estado de Situación Financiera / Balance General (NIF B-6)</div>
            <div className="text-[11px] text-slate-500">{cutoffLabel} • Cifras en Pesos Mexicanos (MXN)</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOC-SIT-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
          <div className={`${isBalanced ? 'text-emerald-800' : 'text-amber-800'} font-bold mt-1`}>
            {isBalanced ? 'Ecuación A = P + C Verificada' : `Diferencia: ${formatCurrency(Math.abs(balanceSheet.totalActivo - balanceSheet.totalPasivoMasCapital))}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs balance-grid">
        <div className="border border-slate-200 rounded-lg p-3 space-y-2.5 balance-card">
          <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded">100 — ACTIVO (Bienes y Derechos)</div>
          <div className="text-[10px] font-bold uppercase text-blue-900 px-1">Activo Circulante</div>
          {renderSectionRows(actCirc, 'DEUDORA')}
          {nif && renderSubtotal('Total Activo Circulante', nif.totalActivoCirculante)}
          <div className="text-[10px] font-bold uppercase text-blue-900 px-1 pt-1">Activo No Circulante</div>
          {renderSectionRows(actNoCirc, 'DEUDORA')}
          {nif && renderSubtotal('Total Activo No Circulante', nif.totalActivoNoCirculante)}
          <div className="pt-2 border-t-2 border-slate-800 font-bold flex justify-between text-slate-900 balance-total">
            <span>TOTAL ACTIVO:</span>
            <span className="font-mono tabular-nums whitespace-nowrap text-blue-950 font-extrabold">{formatCurrency(balanceSheet.totalActivo)}</span>
          </div>
        </div>

        <div className="space-y-4 balance-col-right">
          <div className="border border-slate-200 rounded-lg p-3 space-y-2 balance-card">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded">200 — PASIVO (Obligaciones y Deudas)</div>
            <div className="text-[10px] font-bold uppercase text-blue-900 px-1">Pasivo a Corto Plazo</div>
            {renderSectionRows(pasCp, 'ACREEDORA')}
            {nif && renderSubtotal('Total Pasivo Corto Plazo', nif.totalPasivoCortoPlazo)}
            {(pasLp.length > 0 || (nif && Math.abs(nif.totalPasivoLargoPlazo) >= 0.01)) && (
              <>
                <div className="text-[10px] font-bold uppercase text-blue-900 px-1 pt-1">Pasivo a Largo Plazo</div>
                {renderSectionRows(pasLp, 'ACREEDORA')}
                {nif && renderSubtotal('Total Pasivo Largo Plazo', nif.totalPasivoLargoPlazo)}
              </>
            )}
            <div className="pt-1 border-t border-slate-300 font-bold flex justify-between text-slate-800 balance-total">
              <span>Total Pasivo:</span>
              <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(balanceSheet.totalPasivo)}</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 space-y-2 balance-card">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded">300 — CAPITAL CONTABLE (Patrimonio)</div>
            <div className="text-[10px] font-bold uppercase text-blue-900 px-1">Capital Contribuido</div>
            {renderSectionRows(capContrib, 'ACREEDORA')}
            {nif && renderSubtotal('Total Capital Contribuido', nif.totalCapitalContribuido)}
            <div className="text-[10px] font-bold uppercase text-blue-900 px-1 pt-1">Capital Ganado</div>
            {renderSectionRows(capGanado, 'ACREEDORA')}
            <div className={`flex justify-between px-1 py-0.5 font-semibold balance-row ${isLoss ? 'text-red-700' : 'text-blue-900'}`}>
              <span>305-01-001 — {isLoss ? 'Pérdida del Ejercicio Actual:' : 'Utilidad del Ejercicio Actual:'}</span>
              <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(balanceSheet.utilidadEjercicio)}</span>
            </div>
            {nif && renderSubtotal('Total Capital Ganado', nif.totalCapitalGanado)}
            <div className="pt-1 border-t border-slate-300 font-bold flex justify-between text-slate-800 balance-row">
              <span>Total Capital Contable:</span>
              <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(totalCapital)}</span>
            </div>
            <div className="pt-2 border-t-2 border-slate-800 font-bold flex justify-between text-slate-900 balance-total">
              <span>TOTAL PASIVO + CAPITAL:</span>
              <span className="font-mono tabular-nums whitespace-nowrap text-emerald-950 font-extrabold">{formatCurrency(balanceSheet.totalPasivoMasCapital)}</span>
            </div>
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

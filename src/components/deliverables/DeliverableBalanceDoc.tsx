import { formatCurrency } from '../../lib/formatters';
import type { Company, AccountWithBalance } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableBalanceDocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  issuanceCity?: string;
  issuanceDate: string;
  hideZeroAccounts?: boolean;
  balanceSheet: {
    activos: AccountWithBalance[];
    pasivos: AccountWithBalance[];
    capital: AccountWithBalance[];
    totalActivo: number;
    totalPasivo: number;
    totalCapital?: number;
    utilidadEjercicio: number;
    totalPasivoMasCapital: number;
  };
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

export function DeliverableBalanceDoc({
  company,
  year,
  period,
  mesNombre,
  firmName,
  issuanceCity,
  issuanceDate,
  hideZeroAccounts = false,
  balanceSheet,
  auditorName,
  auditorCedula,
  legalRepName,
  legalRepTitle
}: DeliverableBalanceDocProps) {
  const lastDay = new Date(year, Math.min(12, Math.max(1, period)), 0).getDate();
  const isBalanced =
    Math.abs(balanceSheet.totalActivo - balanceSheet.totalPasivoMasCapital) < 0.05;
  const isLoss = balanceSheet.utilidadEjercicio < 0;
  const totalCapital =
    balanceSheet.totalCapital ??
    (balanceSheet.totalPasivoMasCapital - balanceSheet.totalPasivo);

  const renderSectionRows = (
    items: AccountWithBalance[],
    expectedNature: 'DEUDORA' | 'ACREEDORA'
  ) =>
    items
      .filter((a) => !hideZeroAccounts || Math.abs(a.finalBalance) >= 0.01)
      .map((a) => {
        const displayBal = a.nature !== expectedNature ? -a.finalBalance : a.finalBalance;
        return (
          <div
            key={a.id}
            className={`flex justify-between gap-2 py-0.5 balance-row ${
              a.level === 2
                ? 'font-bold text-slate-900 bg-slate-100/70 rounded px-1.5 mt-0.5'
                : 'pl-5 pr-1 text-slate-700'
            }`}
          >
            <span className={`min-w-0 ${a.level === 2 ? 'font-semibold' : 'text-slate-600'}`}>
              <span className="font-mono whitespace-nowrap mr-1.5">{a.code}</span>
              <span>— {a.name}</span>
            </span>
            <span
              className={`font-mono tabular-nums whitespace-nowrap shrink-0 ${
                displayBal < 0
                  ? 'text-red-700 font-semibold'
                  : a.level === 2
                    ? 'font-bold text-slate-900'
                    : 'text-slate-700'
              }`}
            >
              {formatCurrency(displayBal)}
            </span>
          </div>
        );
      });

  return (
    <article className="max-w-5xl mx-auto bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-8 space-y-5 print-page-break mb-8">
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
            Estado de Situación Financiera / Balance General (NIF B-6)
          </div>
          <div className="text-[11px] text-slate-500">
            Al {String(lastDay).padStart(2, '0')} de {mesNombre} de {year} • Cifras en Pesos Mexicanos (MXN)
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOC-SIT-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
          <div className={`${isBalanced ? 'text-emerald-800' : 'text-amber-800'} font-bold mt-1`}>
            {isBalanced
              ? 'Ecuación A = P + C Verificada'
              : `Diferencia: ${formatCurrency(Math.abs(balanceSheet.totalActivo - balanceSheet.totalPasivoMasCapital))}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs balance-grid">
        <div className="border border-slate-200 rounded-lg p-3 space-y-2 balance-card">
          <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded">
            100 — ACTIVO (Bienes y Derechos)
          </div>
          {renderSectionRows(balanceSheet.activos, 'DEUDORA')}
          <div className="pt-2 border-t-2 border-slate-800 font-bold flex justify-between text-slate-900 balance-total">
            <span>TOTAL ACTIVO:</span>
            <span className="font-mono tabular-nums whitespace-nowrap text-blue-950 font-extrabold">
              {formatCurrency(balanceSheet.totalActivo)}
            </span>
          </div>
        </div>

        <div className="space-y-4 balance-col-right">
          <div className="border border-slate-200 rounded-lg p-3 space-y-2 balance-card">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded">
              200 — PASIVO (Obligaciones y Deudas)
            </div>
            {renderSectionRows(balanceSheet.pasivos, 'ACREEDORA')}
            <div className="pt-1 border-t border-slate-300 font-bold flex justify-between text-slate-800 balance-total">
              <span>Total Pasivo:</span>
              <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(balanceSheet.totalPasivo)}</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 space-y-2 balance-card">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 bg-slate-100 p-1.5 rounded">
              300 — CAPITAL CONTABLE (Patrimonio)
            </div>
            {renderSectionRows(balanceSheet.capital, 'ACREEDORA')}
            <div className={`flex justify-between px-1 py-0.5 font-semibold balance-row ${isLoss ? 'text-red-700' : 'text-blue-900'}`}>
              <span>{isLoss ? 'Pérdida del Ejercicio Actual:' : 'Utilidad del Ejercicio Actual:'}</span>
              <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(balanceSheet.utilidadEjercicio)}</span>
            </div>
            <div className="pt-1 border-t border-slate-300 font-bold flex justify-between text-slate-800 balance-row">
              <span>Total Capital Contable:</span>
              <span className="font-mono tabular-nums whitespace-nowrap">{formatCurrency(totalCapital)}</span>
            </div>
            <div className="pt-2 border-t-2 border-slate-800 font-bold flex justify-between text-slate-900 balance-total">
              <span>TOTAL PASIVO + CAPITAL:</span>
              <span className="font-mono tabular-nums whitespace-nowrap text-emerald-950 font-extrabold">
                {formatCurrency(balanceSheet.totalPasivoMasCapital)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <DeliverableSignaturesBlock
        auditorName={auditorName}
        auditorCedula={auditorCedula}
        legalRepName={legalRepName}
        legalRepTitle={legalRepTitle}
      />
    </article>
  );
}

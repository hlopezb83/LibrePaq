import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { formatBalanceCutoffLabel } from '../../shared/date-utils';
import type { Company, AccountWithBalance } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableBalanzaDocProps {
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
  trialBalance: AccountWithBalance[];
  totals: {
    initialDeudor: number;
    initialAcreedor?: number;
    totalCargos: number;
    totalAbonos: number;
    finalDeudor: number;
    finalAcreedor?: number;
  };
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

export function DeliverableBalanzaDoc({
  company, year, period, mesNombre, firmName, preparerName, logoDataUrl,
  issuanceCity, issuanceDate, hideZeroAccounts = false, trialBalance, totals,
  auditorName, auditorCedula, legalRepName, legalRepTitle
}: DeliverableBalanzaDocProps) {
  const affectableAcreedor = trialBalance.filter((r) => r.isAffectable && r.nature === 'ACREEDORA');
  const initialAcreedor =
    totals.initialAcreedor ?? affectableAcreedor.reduce((s, r) => s + r.initialBalanceComputed, 0);
  const finalAcreedor =
    totals.finalAcreedor ?? affectableAcreedor.reduce((s, r) => s + r.finalBalance, 0);

  const maxPairDiff = Math.max(
    Math.abs(totals.initialDeudor - initialAcreedor),
    Math.abs(totals.totalCargos - totals.totalAbonos),
    Math.abs(totals.finalDeudor - finalAcreedor)
  );
  const isBalanced = maxPairDiff < 0.01;
  const periodLabel = period === 13 ? formatBalanceCutoffLabel(year, period, mesNombre) : `${mesNombre} ${year}`;

  const visibleRows = trialBalance.filter((r) => {
    if (!(r.isAffectable || r.level <= 2)) return false;
    if (!hideZeroAccounts) return true;
    return (
      Math.abs(r.initialBalanceComputed) >= 0.01 ||
      Math.abs(r.periodCharges) >= 0.01 ||
      Math.abs(r.periodCredits) >= 0.01 ||
      Math.abs(r.finalBalance) >= 0.01
    );
  });

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
              RFC: <span className="font-bold text-slate-900">{company.rfc}</span> • {company.regimenFiscal} • CP {company.codigoPostal}
            </div>
            <div className="text-xs font-bold text-blue-900 mt-1 uppercase">
              Balanza de Comprobación (Anexo 24 R.M.F. / NIF B-1)
            </div>
            <div className="text-[11px] text-slate-500">
              Periodo Contable: <strong>{periodLabel}</strong> • Cifras en Pesos Mexicanos (MXN)
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 font-mono shrink-0">
          <div>Folio: DOC-BAL-{year}-{String(period).padStart(2, '0')}</div>
          <div>{issuanceCity ? `${issuanceCity}, ` : ''}{issuanceDate}</div>
          {isBalanced ? (
            <div className="inline-flex items-center gap-1 text-emerald-800 font-bold mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sumas Iguales (3/3)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 text-amber-800 font-bold mt-1">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Diferencia: {formatCurrency(maxPairDiff)}</span>
            </div>
          )}
        </div>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de Balanza de Comprobación Anexo 24"
        className="overflow-x-auto"
      >
        <table className="w-full text-left border-collapse text-xs">
          <caption className="visually-hidden">Balanza de Comprobación de {company.name} — {periodLabel}</caption>
          <thead>
            <tr className="border-b-2 border-slate-800 bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-700">
              <th scope="col" className="py-2 px-2.5">Código</th>
              <th scope="col" className="py-2 px-2.5">Nombre de la Cuenta</th>
              <th scope="col" className="py-2 px-2 text-center">SAT</th>
              <th scope="col" className="py-2 px-1.5 text-center">Nat.</th>
              <th scope="col" className="py-2 px-2.5 text-right">Saldo Inicial</th>
              <th scope="col" className="py-2 px-2.5 text-right">Cargos (Debe)</th>
              <th scope="col" className="py-2 px-2.5 text-right">Abonos (Haber)</th>
              <th scope="col" className="py-2 px-2.5 text-right">Saldo Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className={
                  row.level === 1
                    ? 'bg-slate-100 font-bold text-slate-900'
                    : row.level === 2
                      ? 'bg-slate-50/70 font-semibold text-slate-800'
                      : 'text-slate-700'
                }
              >
                <th scope="row" className="py-1 px-2.5 font-mono text-[11px] whitespace-nowrap tabular-nums text-left font-normal">{row.code}</th>
                <td className={`py-1 px-2.5 ${row.level === 3 ? 'pl-6' : ''}`}>{row.name}</td>
                <td className="py-1 px-2 text-center font-mono text-[10px] text-slate-600 whitespace-nowrap tabular-nums">{row.satGroupCode}</td>
                <td className="py-1 px-1.5 text-center font-mono text-[10px] font-bold text-slate-700 whitespace-nowrap">{row.nature === 'DEUDORA' ? 'D' : 'A'}</td>
                <td className="py-1 px-2.5 text-right font-mono whitespace-nowrap tabular-nums">{formatCurrency(row.initialBalanceComputed)}</td>
                <td className="py-1 px-2.5 text-right font-mono whitespace-nowrap tabular-nums">{row.periodCharges > 0 ? formatCurrency(row.periodCharges) : '—'}</td>
                <td className="py-1 px-2.5 text-right font-mono whitespace-nowrap tabular-nums">{row.periodCredits > 0 ? formatCurrency(row.periodCredits) : '—'}</td>
                <td className="py-1 px-2.5 text-right font-mono font-semibold whitespace-nowrap tabular-nums">{formatCurrency(row.finalBalance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900 bg-slate-100 font-bold font-mono text-xs text-slate-900">
              <td colSpan={4} className="py-2 px-2.5 text-right uppercase">Sumas Iguales (Afectables):</td>
              <td className="py-2 px-2.5 text-right text-[11px] whitespace-nowrap tabular-nums">
                <div>D: {formatCurrency(totals.initialDeudor)}</div>
                <div className="text-slate-600">A: {formatCurrency(initialAcreedor)}</div>
              </td>
              <td className="py-2 px-2.5 text-right text-blue-900 whitespace-nowrap tabular-nums">{formatCurrency(totals.totalCargos)}</td>
              <td className="py-2 px-2.5 text-right text-blue-900 whitespace-nowrap tabular-nums">{formatCurrency(totals.totalAbonos)}</td>
              <td className="py-2 px-2.5 text-right text-[11px] whitespace-nowrap tabular-nums">
                <div>D: {formatCurrency(totals.finalDeudor)}</div>
                <div className="text-slate-600">A: {formatCurrency(finalAcreedor)}</div>
              </td>
            </tr>
          </tfoot>
        </table>
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

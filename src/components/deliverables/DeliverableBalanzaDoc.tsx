import { CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { Company, AccountWithBalance } from '../../shared/types';
import { DeliverableSignaturesBlock } from './DeliverableSignaturesBlock';

interface DeliverableBalanzaDocProps {
  company: Company;
  year: number;
  period: number;
  mesNombre: string;
  firmName: string;
  issuanceDate: string;
  trialBalance: AccountWithBalance[];
  totals: {
    initialDeudor: number;
    totalCargos: number;
    totalAbonos: number;
    finalDeudor: number;
  };
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
}

export function DeliverableBalanzaDoc({
  company,
  year,
  period,
  mesNombre,
  firmName,
  issuanceDate,
  trialBalance,
  totals,
  auditorName,
  auditorCedula,
  legalRepName,
  legalRepTitle
}: DeliverableBalanzaDocProps) {
  return (
    <article className="max-w-5xl mx-auto bg-white rounded-xl shadow-xs border border-slate-300 p-6 sm:p-8 space-y-5 print-page-break mb-8">
      {/* Membrete Oficial del Documento */}
      <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {firmName}
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mt-0.5">
            {company.name}
          </h2>
          <div className="text-xs font-mono text-slate-600">
            RFC: <span className="font-bold text-slate-900">{company.rfc}</span> • {company.regimenFiscal} • CP {company.codigoPostal}
          </div>
          <div className="text-xs font-bold text-blue-900 mt-1 uppercase">
            Balanza de Comprobación (Anexo 24 R.M.F. / NIF B-1)
          </div>
          <div className="text-[11px] text-slate-500">
            Periodo Contable: <strong>{mesNombre} {year}</strong> • Cifras en Pesos Mexicanos (MXN)
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-500 font-mono shrink-0">
          <div>Folio: DOC-BAL-{year}-{String(period).padStart(2, '0')}</div>
          <div>Emisión: {issuanceDate}</div>
          <div className="inline-flex items-center gap-1 text-emerald-800 font-bold mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Partida Doble Cuadrada</span>
          </div>
        </div>
      </div>

      {/* Tabla de Balanza */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-slate-800 bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-700">
              <th className="py-2 px-2.5">Código</th>
              <th className="py-2 px-2.5">Nombre de la Cuenta</th>
              <th className="py-2 px-2 text-center">SAT</th>
              <th className="py-2 px-2.5 text-right">Saldo Inicial</th>
              <th className="py-2 px-2.5 text-right">Cargos (Debe)</th>
              <th className="py-2 px-2.5 text-right">Abonos (Haber)</th>
              <th className="py-2 px-2.5 text-right">Saldo Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {trialBalance
              .filter((r) => r.isAffectable || r.level <= 2)
              .map((row) => (
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
                  <td className="py-1 px-2.5 font-mono text-[11px]">{row.code}</td>
                  <td className={`py-1 px-2.5 ${row.level === 3 ? 'pl-6' : ''}`}>
                    {row.name}
                  </td>
                  <td className="py-1 px-2 text-center font-mono text-[10px] text-slate-500">
                    {row.satGroupCode}
                  </td>
                  <td className="py-1 px-2.5 text-right font-mono">
                    {formatCurrency(row.initialBalanceComputed)}
                  </td>
                  <td className="py-1 px-2.5 text-right font-mono">
                    {row.periodCharges > 0 ? formatCurrency(row.periodCharges) : '—'}
                  </td>
                  <td className="py-1 px-2.5 text-right font-mono">
                    {row.periodCredits > 0 ? formatCurrency(row.periodCredits) : '—'}
                  </td>
                  <td className="py-1 px-2.5 text-right font-mono font-semibold">
                    {formatCurrency(row.finalBalance)}
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900 bg-slate-100 font-bold font-mono text-xs text-slate-900">
              <td colSpan={3} className="py-2 px-2.5 text-right uppercase">
                Sumas Iguales:
              </td>
              <td className="py-2 px-2.5 text-right">
                {formatCurrency(totals.initialDeudor)}
              </td>
              <td className="py-2 px-2.5 text-right text-blue-900">
                {formatCurrency(totals.totalCargos)}
              </td>
              <td className="py-2 px-2.5 text-right text-blue-900">
                {formatCurrency(totals.totalAbonos)}
              </td>
              <td className="py-2 px-2.5 text-right">
                {formatCurrency(totals.finalDeudor)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bloque de Firmas de Auditoría */}
      <DeliverableSignaturesBlock
        auditorName={auditorName}
        auditorCedula={auditorCedula}
        legalRepName={legalRepName}
        legalRepTitle={legalRepTitle}
      />
    </article>
  );
}

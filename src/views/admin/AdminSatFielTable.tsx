import { Check, Copy, FileKey2 } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import type { AdminSatHealthResponse } from '../../shared/admin-types';
import { formatAdminDateTime } from './adminFormatters';

interface SatCompanyRfcCellProps {
  companyName: string;
  companyRfc?: string | null;
  onInspectCompanyRfc?: (rfc: string) => void;
}

export function SatCompanyRfcCell({ companyName, companyRfc, onInspectCompanyRfc }: SatCompanyRfcCellProps) {
  return (
    <th scope="row" className="py-2.5 px-3.5 text-left font-normal">
      <p className="font-bold text-slate-900">{companyName}</p>
      <div className="flex flex-wrap items-center gap-2 mt-0.5">
        <span className="font-mono text-[11px] text-slate-600">{companyRfc}</span>
        {onInspectCompanyRfc && companyRfc && (
          <button
            type="button"
            onClick={() => onInspectCompanyRfc(companyRfc)}
            aria-label={`Ver empresa ${companyRfc} en directorio`}
            className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 rounded"
          >
            Ver empresa
          </button>
        )}
      </div>
    </th>
  );
}

function getFielExpiryBadge(daysRemaining: number): { label: string; className: string } {
  if (daysRemaining < 0) return { label: `Vencida (${Math.abs(daysRemaining)}d)`, className: 'bg-red-100 text-red-900 border-red-300' };
  if (daysRemaining === 0) return { label: 'Vence hoy', className: 'bg-red-100 text-red-900 border-red-300' };
  if (daysRemaining <= 15) return { label: `Crítico: ${daysRemaining}d`, className: 'bg-red-100 text-red-900 border-red-300' };
  if (daysRemaining <= 30) return { label: `Por vencer: ${daysRemaining}d`, className: 'bg-amber-100 text-amber-950 border-amber-300' };
  return { label: `${daysRemaining}d restantes`, className: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
}

interface AdminSatFielTableProps {
  expiringFiels?: AdminSatHealthResponse['expiringFiels'];
  onInspectCompanyRfc?: (rfc: string) => void;
}

export function AdminSatFielTable({ expiringFiels, onInspectCompanyRfc }: AdminSatFielTableProps) {
  const { copiedKey: copiedSerie, copy: copySerie } = useCopyToClipboard<string>(1800);

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FileKey2 className="w-4 h-4 text-teal-700" aria-hidden="true" />
          Certificados e.firma (FIEL) Próximos a Vencer o Vencidos
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">Empresas que requieren renovación ante el SAT para no interrumpir descargas XML</p>
      </div>

      {!expiringFiels || expiringFiels.length === 0 ? (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">
          No hay certificados e.firma vencidos o próximos a vencer registrados.
        </p>
      ) : (
        <div tabIndex={0} role="region" aria-label="Certificados e.firma próximos a vencer" className="overflow-x-auto max-h-[45vh] border border-slate-200 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <caption className="visually-hidden">Certificados e.firma próximos a vencer o vencidos por empresa</caption>
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Empresa / RFC</th>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">RFC Titular</th>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">No. Serie</th>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50">Vence</th>
                <th scope="col" className="py-2.5 px-3.5 border-b border-slate-200 bg-slate-50 text-right">Vigencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {expiringFiels.map((fiel) => {
                const badge = getFielExpiryBadge(fiel.daysRemaining);
                const copyKey = `${fiel.companyId}-${fiel.numeroSerie}`;
                const isCopied = copiedSerie === copyKey;
                return (
                  <tr key={copyKey} className="hover:bg-slate-50/80">
                    <SatCompanyRfcCell companyName={fiel.companyName} companyRfc={fiel.companyRfc} onInspectCompanyRfc={onInspectCompanyRfc} />
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">{fiel.rfcTitular}</td>
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">
                      <div className="inline-flex items-center gap-1.5">
                        <span>{fiel.numeroSerie}</span>
                        {fiel.numeroSerie && (
                          <button
                            type="button"
                            onClick={() => void copySerie(fiel.numeroSerie, copyKey)}
                            aria-label={`Copiar número de serie ${fiel.numeroSerie}`}
                            title={isCopied ? 'Copiado' : 'Copiar número de serie'}
                            className="p-1 rounded hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700">{formatAdminDateTime(fiel.validTo)}</td>
                    <td className="py-2.5 px-3.5 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        {copiedSerie ? 'Número de serie copiado al portapapeles' : ''}
      </span>
    </div>
  );
}

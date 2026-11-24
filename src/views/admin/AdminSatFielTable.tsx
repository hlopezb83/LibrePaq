import { Check, Copy, FileKey2 } from 'lucide-react';
import { EmptyState, StatusBadge, type BadgeTone } from '../../components/ui';
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
    <th scope="row" className="py-2.5 px-3.5 text-left font-normal border-b border-slate-200">
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

function getFielExpiryBadge(daysRemaining: number): { label: string; tone: BadgeTone } {
  if (daysRemaining < 0) return { label: `Vencida (${Math.abs(daysRemaining)}d)`, tone: 'red' };
  if (daysRemaining === 0) return { label: 'Vence hoy', tone: 'red' };
  if (daysRemaining <= 15) return { label: `Crítico: ${daysRemaining}d`, tone: 'red' };
  if (daysRemaining <= 30) return { label: `Por vencer: ${daysRemaining}d`, tone: 'amber' };
  return { label: `${daysRemaining}d restantes`, tone: 'emerald' };
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
          <FileKey2 className="w-4 h-4 text-blue-700" aria-hidden="true" />
          Certificados e.firma (FIEL) Próximos a Vencer o Vencidos
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">Empresas que requieren renovación ante el SAT para no interrumpir descargas XML</p>
      </div>

      {!expiringFiels || expiringFiels.length === 0 ? (
        <EmptyState
          variant="dashed"
          tone="emerald"
          icon={<FileKey2 className="w-5 h-5" aria-hidden="true" />}
          title="Sin certificados e.firma por vencer"
          description="No hay certificados e.firma vencidos o próximos a vencer registrados."
        />
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
            <tbody className="text-slate-800">
              {expiringFiels.map((fiel) => {
                const badge = getFielExpiryBadge(fiel.daysRemaining);
                const copyKey = `${fiel.companyId}-${fiel.numeroSerie}`;
                const isCopied = copiedSerie === copyKey;
                return (
                  <tr key={copyKey} className="hover:bg-slate-50/80">
                    <SatCompanyRfcCell companyName={fiel.companyName} companyRfc={fiel.companyRfc} onInspectCompanyRfc={onInspectCompanyRfc} />
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700 border-b border-slate-200">{fiel.rfcTitular}</td>
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700 border-b border-slate-200">
                      <div className="inline-flex items-center gap-1.5">
                        <span>{fiel.numeroSerie}</span>
                        {fiel.numeroSerie && (
                          <button
                            type="button"
                            onClick={() => void copySerie(fiel.numeroSerie, copyKey)}
                            aria-label={`Copiar número de serie ${fiel.numeroSerie}`}
                            title={isCopied ? 'Copiado' : 'Copiar número de serie'}
                            className="min-h-7 min-w-7 inline-flex items-center justify-center rounded hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 border-b border-slate-200 whitespace-nowrap">{formatAdminDateTime(fiel.validTo)}</td>
                    <td className="py-2.5 px-3.5 text-right border-b border-slate-200">
                      <StatusBadge tone={badge.tone} className="font-mono tabular-nums">{badge.label}</StatusBadge>
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

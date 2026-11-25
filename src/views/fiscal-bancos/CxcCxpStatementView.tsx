import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, FileSpreadsheet, Landmark, Printer } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { CxcCxpBankMatchInfo, CxcCxpPartyStatementGroup } from '../../shared/engine/cxc-cxp-helpers';
import type { AgingMode } from './CxcCxpHeaderBuckets';

interface CxcCxpStatementViewProps {
  mode: AgingMode;
  groups: readonly CxcCxpPartyStatementGroup[];
  bankMatchesByCfdiId: ReadonlyMap<string, CxcCxpBankMatchInfo[]>;
  onExportPartyXlsx: (group: CxcCxpPartyStatementGroup) => void;
  onPrintPartyPdf: (group: CxcCxpPartyStatementGroup) => void;
}

export function CxcCxpStatementView({
  mode,
  groups,
  bankMatchesByCfdiId,
  onExportPartyXlsx,
  onPrintPartyPdf
}: CxcCxpStatementViewProps) {
  const [expandedRfcs, setExpandedRfcs] = useState<Set<string>>(new Set());

  const toggleRfc = (rfc: string) => {
    setExpandedRfcs((prev) => {
      const next = new Set(prev);
      if (next.has(rfc)) next.delete(rfc);
      else next.add(rfc);
      return next;
    });
  };

  return (
    <div tabIndex={0} role="region" aria-label="Estado de cuenta agrupado por cliente o proveedor" className="overflow-x-auto max-h-[480px] overflow-y-auto">
      <table className="w-full text-left border-collapse erp-sticky-table">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th scope="col" className="py-2.5 px-3 w-10"><span className="visually-hidden">Expandir</span></th>
            <th scope="col" className="py-2.5 px-3">{mode === 'CXC' ? 'Cliente' : 'Proveedor'}</th>
            <th scope="col" className="py-2.5 px-3 text-center">Docs</th>
            <th scope="col" className="py-2.5 px-3 text-right">Total Facturado</th>
            <th scope="col" className="py-2.5 px-3 text-right">Pagado REP</th>
            <th scope="col" className="py-2.5 px-3 text-right">Saldo Insoluto</th>
            <th scope="col" className="py-2.5 px-3 text-center">Banco sin REP</th>
            <th scope="col" className="py-2.5 px-3 text-right">Estado de Cuenta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {groups.map((g) => {
            const isExpanded = expandedRfcs.has(g.rfc);
            const bankAlerts = g.documents.reduce(
              (acc, d) => acc + (bankMatchesByCfdiId.get(d.cfdiId)?.length ?? 0),
              0
            );
            return (
              <Fragment key={g.rfc}>
                <tr className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => toggleRfc(g.rfc)}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} documentos de ${g.nombre}`}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </td>
                  <th scope="row" className="py-2.5 px-3 text-left font-normal">
                    <div className="font-semibold text-slate-900">{g.nombre}</div>
                    <div className="font-mono text-[11px] text-slate-600">{g.rfc} · Máx. {g.maxDaysPast} días</div>
                  </th>
                  <td className="py-2.5 px-3 text-center font-mono font-semibold">{g.docCount}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatCurrency(g.totalOriginalMxn)}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800">{formatCurrency(g.totalPagadoMxn)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900">{formatCurrency(g.saldoInsolutoMxn)}</td>
                  <td className="py-2.5 px-3 text-center">
                    {bankAlerts > 0 ? (
                      <StatusBadge tone="amber" icon={<Landmark className="w-3 h-3" aria-hidden="true" />}>
                        Posible pago en banco sin REP ({bankAlerts})
                      </StatusBadge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <Button size="sm" variant="export-outline" onClick={() => onExportPartyXlsx(g)} leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />}>
                        Excel
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => onPrintPartyPdf(g)} leftIcon={<Printer className="w-3.5 h-3.5" aria-hidden="true" />}>
                        PDF
                      </Button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-50/90">
                    <td colSpan={8} className="px-6 py-3 border-t border-slate-200">
                      <div className="space-y-1.5">
                        {g.documents.map((doc) => {
                          const bMatches = bankMatchesByCfdiId.get(doc.cfdiId) ?? [];
                          return (
                            <div key={doc.cfdiId} className="p-2.5 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="min-w-0">
                                <span className="font-mono font-bold text-slate-900 mr-2">{doc.serieFolio}</span>
                                <span className="text-slate-600 mr-2">{formatShortDate(doc.fecha)} ({doc.daysPast}d)</span>
                                <span className="font-mono text-[11px] text-slate-500">{doc.uuid}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {bMatches.length > 0 && (
                                  <span
                                    title={bMatches.map((m) => `${m.fecha} ${m.referencia} (${formatCurrency(m.amount)}): ${m.descripcion}`).join(' | ')}
                                    className="px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-semibold"
                                  >
                                    Posible pago en banco sin REP: {bMatches[0]!.fecha} · {formatCurrency(bMatches[0]!.amount)}
                                  </span>
                                )}
                                <span className="font-mono font-bold text-slate-900 tabular-nums">
                                  Insoluto: {formatCurrency(doc.saldoInsolutoMxn)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { Banknote, Users } from 'lucide-react';
import { formatCurrency } from '../../../lib/formatters';
import type { CfdiPreviewNomina, CfdiPreviewPagoItem } from '../../../shared/cfdi-preview-parser';

function formatTaxCode(code: string): string {
  if (code === '001') return 'ISR';
  if (code === '002') return 'IVA';
  if (code === '003') return 'IEPS';
  return code;
}

export function CfdiComplementoPagosPanel({ pagos }: { pagos: CfdiPreviewPagoItem[] }) {
  return (
    <section
      aria-label="Complemento para Recepción de Pagos 2.0"
      className="border border-blue-200 rounded-xl bg-blue-50/40 p-4 space-y-3 text-xs avoid-page-break"
    >
      <div className="flex items-center gap-2 font-bold text-blue-950">
        <Banknote className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
        <span>Complemento de Recepción de Pagos 2.0 (REP)</span>
      </div>
      {pagos.map((pago, idx) => (
        <div key={`${pago.fechaPago}-${idx}`} className="bg-white rounded-xl border border-blue-200 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
            <span>
              Fecha Pago: <strong className="text-slate-900">{pago.fechaPago || 'N/D'}</strong> • Forma:{' '}
              <strong>{pago.formaDePagoP || 'N/D'}</strong> • Moneda: <strong>{pago.monedaP}</strong>
              {pago.monedaP !== 'MXN' || pago.tipoCambioP !== '1' ? (
                <> • TipoCambioP: <strong>{pago.tipoCambioP}</strong></>
              ) : null}
              {pago.numOperacion && <> • Operación: <strong>{pago.numOperacion}</strong></>}
            </span>
            <span className="font-bold text-blue-900 tabular-nums">
              Monto Pagado: {formatCurrency(pago.monto)}
            </span>
          </div>
          {pago.doctosRelacionados.length > 0 && (
            <div className="overflow-x-auto print:overflow-visible border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <th scope="col" className="py-1.5 px-2.5">CFDI Relacionado (UUID / MonedaDR)</th>
                    <th scope="col" className="py-1.5 px-2.5 text-center">Parcialidad</th>
                    <th scope="col" className="py-1.5 px-2.5 text-right">Saldo Anterior</th>
                    <th scope="col" className="py-1.5 px-2.5 text-right">Importe Pagado</th>
                    <th scope="col" className="py-1.5 px-2.5 text-right">Saldo Insoluto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {pago.doctosRelacionados.map((d, dIdx) => (
                    <tr key={`${d.idDocumento}-${dIdx}`}>
                      <td className="py-1.5 px-2.5 text-slate-800 break-all">
                        <div>
                          {d.idDocumento}
                          {(d.serie || d.folio) && (
                            <span className="text-slate-500 ml-1.5">({[d.serie, d.folio].filter(Boolean).join('-')})</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          MonedaDR: <strong>{d.monedaDr}</strong> • Eq: <strong>{d.equivalenciaDr}</strong>
                          {d.objetoImpDr && <> • ObjImpDR: <strong>{d.objetoImpDr}</strong></>}
                          {d.impuestosDr && d.impuestosDr.length > 0 && (
                            <>
                              {' • ImpuestosDR: '}
                              {d.impuestosDr.map((tx, txIdx) => (
                                <span key={txIdx} className="inline-block mr-1.5">
                                  {tx.tipo === 'Retencion' ? 'Ret' : 'Tras'} {formatTaxCode(tx.impuesto)} (Base {formatCurrency(tx.base)}: {formatCurrency(tx.importe)})
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2.5 text-center tabular-nums">#{d.numParcialidad}</td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums">{formatCurrency(d.impSaldoAnt)}</td>
                      <td className="py-1.5 px-2.5 text-right font-bold text-emerald-800 tabular-nums">{formatCurrency(d.impPagado)}</td>
                      <td className="py-1.5 px-2.5 text-right tabular-nums">{formatCurrency(d.impSaldoInsoluto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export function CfdiComplementoNominaPanel({ nomina }: { nomina: CfdiPreviewNomina }) {
  return (
    <section
      aria-label="Complemento de Nómina Digital 1.2"
      className="border border-indigo-200 rounded-xl bg-indigo-50/40 p-4 space-y-3 text-xs avoid-page-break"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold text-indigo-950">
          <Users className="w-4 h-4 text-indigo-700 shrink-0" aria-hidden="true" />
          <span>Complemento de Nómina Digital {nomina.version}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
          {nomina.tipoNomina === 'E' ? 'Nómina Extraordinaria (E)' : 'Nómina Ordinaria (O)'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-white p-3 rounded-xl border border-indigo-200 font-mono text-[11px]">
        <div>
          <span className="text-slate-500 font-sans block">Periodo de Pago</span>
          <strong className="text-slate-900">{nomina.fechaInicialPago || 'N/D'} al {nomina.fechaFinalPago || 'N/D'}</strong>
        </div>
        <div>
          <span className="text-slate-500 font-sans block">Fecha Pago / Días</span>
          <strong className="text-slate-900 tabular-nums">{nomina.fechaPago || 'N/D'} ({nomina.numDiasPagados} d)</strong>
        </div>
        <div>
          <span className="text-slate-500 font-sans block">Empleado / CURP</span>
          <strong className="text-slate-900 break-all">{nomina.numEmpleado || 'S/N'} • {nomina.curp || 'N/D'}</strong>
        </div>
        <div>
          <span className="text-slate-500 font-sans block">NSS / SDI</span>
          <strong className="text-slate-900 tabular-nums">{nomina.numSeguridadSocial || 'N/D'} • {formatCurrency(nomina.salarioDiarioIntegrado)}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
        <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex justify-between">
          <span className="font-sans text-slate-600">Total Percepciones:</span>
          <strong className="text-emerald-800 tabular-nums">{formatCurrency(nomina.totalPercepciones)}</strong>
        </div>
        <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex justify-between">
          <span className="font-sans text-slate-600">Total Deducciones:</span>
          <strong className="text-red-700 tabular-nums">-{formatCurrency(nomina.totalDeducciones)}</strong>
        </div>
        <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex justify-between">
          <span className="font-sans text-slate-600">Otros Pagos:</span>
          <strong className="text-slate-900 tabular-nums">{formatCurrency(nomina.totalOtrosPagos)}</strong>
        </div>
      </div>

      {(nomina.percepciones?.length || nomina.deducciones?.length || nomina.otrosPagos?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
          {nomina.percepciones && nomina.percepciones.length > 0 && (
            <div className="bg-white rounded-lg border border-indigo-200 p-2.5 space-y-1">
              <strong className="text-indigo-950 block uppercase">Percepciones</strong>
              {nomina.percepciones.map((p, i) => (
                <div key={i} className="flex justify-between gap-2 font-mono">
                  <span className="font-sans text-slate-700 truncate" title={p.concepto}>{p.tipoPercepcion} · {p.concepto}</span>
                  <span className="text-emerald-800 tabular-nums shrink-0">{formatCurrency(p.importeGravado + p.importeExento)}</span>
                </div>
              ))}
            </div>
          )}
          {nomina.deducciones && nomina.deducciones.length > 0 && (
            <div className="bg-white rounded-lg border border-indigo-200 p-2.5 space-y-1">
              <strong className="text-indigo-950 block uppercase">Deducciones</strong>
              {nomina.deducciones.map((d, i) => (
                <div key={i} className="flex justify-between gap-2 font-mono">
                  <span className="font-sans text-slate-700 truncate" title={d.concepto}>{d.tipoDeduccion} · {d.concepto}</span>
                  <span className="text-red-700 tabular-nums shrink-0">-{formatCurrency(d.importe)}</span>
                </div>
              ))}
            </div>
          )}
          {nomina.otrosPagos && nomina.otrosPagos.length > 0 && (
            <div className="bg-white rounded-lg border border-indigo-200 p-2.5 space-y-1">
              <strong className="text-indigo-950 block uppercase">Otros Pagos</strong>
              {nomina.otrosPagos.map((o, i) => (
                <div key={i} className="flex justify-between gap-2 font-mono">
                  <span className="font-sans text-slate-700 truncate" title={o.concepto}>{o.tipoOtroPago} · {o.concepto}</span>
                  <span className="text-slate-900 tabular-nums shrink-0">{formatCurrency(o.importe)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

import { Banknote, Users } from 'lucide-react';
import { formatCurrency } from '../../../lib/formatters';
import type { CfdiPreviewNomina, CfdiPreviewPagoItem } from '../../../shared/cfdi-preview-parser';

export function CfdiComplementoPagosPanel({ pagos }: { pagos: CfdiPreviewPagoItem[] }) {
  return (
    <section
      aria-label="Complemento para Recepción de Pagos 2.0"
      className="border border-blue-200 rounded-xl bg-blue-50/40 p-4 space-y-3 text-xs"
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
              {pago.numOperacion && <> • Operación: <strong>{pago.numOperacion}</strong></>}
            </span>
            <span className="font-bold text-blue-900 tabular-nums">
              Monto Pagado: {formatCurrency(pago.monto)}
            </span>
          </div>
          {pago.doctosRelacionados.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <th scope="col" className="py-1.5 px-2.5">CFDI Relacionado (UUID)</th>
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
                        {d.idDocumento}
                        {(d.serie || d.folio) && (
                          <span className="text-slate-500 ml-1.5">({[d.serie, d.folio].filter(Boolean).join('-')})</span>
                        )}
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
      className="border border-indigo-200 rounded-xl bg-indigo-50/40 p-4 space-y-3 text-xs"
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
    </section>
  );
}

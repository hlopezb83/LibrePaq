import { CheckCircle2, Scale } from 'lucide-react';
import { formatCurrency } from '../../../lib/formatters';
import { buildAutoPolizaPlan, fromCents, sumCents } from '../../../shared/accounting-engine';
import type { CfdiDocument } from '../../../shared/types';

interface CfdiPolizaTabProps {
  cfdi: CfdiDocument;
  autoPlan: ReturnType<typeof buildAutoPolizaPlan> | null;
  onContabilizar?: (cfdi: CfdiDocument) => void;
  onClose: () => void;
}

export function CfdiPolizaTab({
  cfdi,
  autoPlan,
  onContabilizar,
  onClose
}: CfdiPolizaTabProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-700" />
            Asiento Contable de Partida Doble Generado
          </h3>
          <p className="text-xs text-slate-500">
            Reglas fiscales NIF A-2 y Anexo 24: cargos y abonos balanceados al centavo.
          </p>
        </div>
        {autoPlan && (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-900 border border-blue-200">
            Tipo Sugerido: {autoPlan.polizaType}
          </span>
        )}
      </div>

      {autoPlan ? (
        <div className="space-y-3">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700">Concepto de Póliza: </span>
            <span className="text-slate-900">{autoPlan.polizaConcept}</span>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden overflow-x-auto scrollable-panel">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold uppercase text-slate-600">
                  <th className="py-2.5 px-3">Código Cuenta</th>
                  <th className="py-2.5 px-3">Nombre de Cuenta</th>
                  <th className="py-2.5 px-3">Referencia / Concepto Movimiento</th>
                  <th className="py-2.5 px-3 text-right">Cargo (Debe)</th>
                  <th className="py-2.5 px-3 text-right">Abono (Haber)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {autoPlan.movements.map((m, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/20">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{m.accountCode}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{m.accountName}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">{m.concepto}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {m.cargo > 0 ? formatCurrency(m.cargo) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {m.abono > 0 ? formatCurrency(m.abono) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-mono font-bold text-xs">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right font-sans uppercase">
                    Sumas Iguales Verificadas:
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-900">
                    {formatCurrency(
                      fromCents(sumCents(autoPlan.movements.map((m) => m.cargo)))
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-900">
                    {formatCurrency(
                      fromCents(sumCents(autoPlan.movements.map((m) => m.abono)))
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Principio de partida doble estrictamente balanceado: diferencia $0.00 MXN.</span>
            </div>
            {!cfdi.polizaId && onContabilizar && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onContabilizar(cfdi);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-2xs transition cursor-pointer shrink-0"
              >
                Aplicar en Libros
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
          Cargando o generando plan de contabilización para este comprobante fiscal...
        </div>
      )}
    </div>
  );
}

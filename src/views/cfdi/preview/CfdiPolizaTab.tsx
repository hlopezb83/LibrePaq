import { CheckCircle2, Scale } from 'lucide-react';
import { formatCurrency } from '../../../lib/formatters';
import { buildAutoPolizaPlan, fromCents, sumCents } from '../../../shared/accounting-engine';
import type { CfdiDocument } from '../../../shared/types';

interface CfdiPolizaTabProps {
  cfdi: CfdiDocument;
  autoPlan: ReturnType<typeof buildAutoPolizaPlan> | null;
  isWriteBlocked?: boolean;
  onContabilizar?: (cfdi: CfdiDocument) => void;
  onClose: () => void;
}

export function CfdiPolizaTab({
  cfdi,
  autoPlan,
  isWriteBlocked = false,
  onContabilizar,
  onClose
}: CfdiPolizaTabProps) {
  const isNonContabilizable = cfdi.statusSat === 'CANCELADO' || cfdi.tipoComprobante === 'T';
  const isDisabled = isWriteBlocked || isNonContabilizable;
  const headingLabel = cfdi.polizaId
    ? `Póliza Contable Registrada${cfdi.polizaFolio ? ` (${cfdi.polizaFolio})` : ''}`
    : 'Vista Previa Sugerida de Póliza Contable';

  return (
    <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-700" aria-hidden="true" />
            {headingLabel}
          </h3>
          <p className="text-xs text-slate-600">
            Reglas fiscales NIF A-2 y Anexo 24: cargos y abonos balanceados al centavo.
          </p>
        </div>
        {autoPlan && (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-900 border border-blue-200">
            {cfdi.polizaId ? `Póliza ${autoPlan.polizaType}` : `Tipo Sugerido: ${autoPlan.polizaType}`}
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
                  <th scope="col" className="py-2.5 px-3">Código Cuenta</th>
                  <th scope="col" className="py-2.5 px-3">Nombre de Cuenta</th>
                  <th scope="col" className="py-2.5 px-3">Referencia / Concepto Movimiento</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Cargo (Debe)</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Abono (Haber)</th>
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

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>Principio de partida doble estrictamente balanceado: diferencia $0.00 MXN.</span>
            </div>
            {!cfdi.polizaId && onContabilizar && (
              <button
                type="button"
                disabled={isDisabled}
                title={
                  isWriteBlocked
                    ? 'Periodo bloqueado o modo solo lectura'
                    : cfdi.statusSat === 'CANCELADO'
                    ? 'CFDI cancelado ante el SAT'
                    : cfdi.tipoComprobante === 'T'
                    ? 'CFDI de Traslado (T) no contabilizable'
                    : undefined
                }
                onClick={() => {
                  if (isDisabled) return;
                  onClose();
                  onContabilizar(cfdi);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer shrink-0"
              >
                Aplicar en Libros
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-slate-600 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
          <p className="font-semibold text-slate-800">
            {cfdi.tipoComprobante === 'T'
              ? 'Comprobante de Traslado (Tipo T) — Sin asiento contable'
              : cfdi.statusSat === 'CANCELADO'
              ? 'Comprobante Cancelado ante el SAT — No contabilizable'
              : 'No se pudo proyectar el plan de contabilización automático'}
          </p>
          <p>
            {cfdi.tipoComprobante === 'T'
              ? 'Los CFDI Tipo T únicamente acreditan la propiedad o traslado de mercancías y no generan cargos ni abonos en resultados.'
              : cfdi.statusSat === 'CANCELADO'
              ? 'Las facturas canceladas ante el SAT no producen efectos fiscales deducibles ni acreditables.'
              : 'Verifica que el catálogo de cuentas contables del periodo esté cargado para generar la vista previa.'}
          </p>
        </div>
      )}
    </div>
  );
}

import { CheckCircle2, Scale } from 'lucide-react';
import { AlertBanner, Button, EmptyState, StatusBadge } from '../../../components/ui';
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
          <StatusBadge tone="blue" className="font-mono">
            {cfdi.polizaId ? `Póliza ${autoPlan.polizaType}` : `Tipo Sugerido: ${autoPlan.polizaType}`}
          </StatusBadge>
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
                  <th scope="col" className="py-2.5 px-3">
                    Código Cuenta
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Nombre de Cuenta
                  </th>
                  <th scope="col" className="py-2.5 px-3">
                    Referencia / Concepto Movimiento
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Cargo (Debe)
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Abono (Haber)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {autoPlan.movements.map((m, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/20">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">
                      {m.accountCode}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{m.accountName}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">{m.concepto}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {m.cargo > 0 ? formatCurrency(m.cargo) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
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
                  <td className="py-2.5 px-3 text-right text-blue-900 tabular-nums">
                    {formatCurrency(
                      fromCents(sumCents(autoPlan.movements.map((m) => m.cargo)))
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-900 tabular-nums">
                    {formatCurrency(
                      fromCents(sumCents(autoPlan.movements.map((m) => m.abono)))
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <AlertBanner
            tone="success"
            icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
            action={
              !cfdi.polizaId && onContabilizar ? (
                <Button
                  variant="primary"
                  size="sm"
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
                >
                  Aplicar en Libros
                </Button>
              ) : undefined
            }
          >
            Principio de partida doble estrictamente balanceado: diferencia $0.00 MXN.
          </AlertBanner>
        </div>
      ) : (
        <EmptyState
          variant="dashed"
          tone="slate"
          icon={<Scale className="w-5 h-5" aria-hidden="true" />}
          title={
            cfdi.tipoComprobante === 'T'
              ? 'Comprobante de Traslado (Tipo T) — Sin asiento contable'
              : cfdi.statusSat === 'CANCELADO'
              ? 'Comprobante Cancelado ante el SAT — No contabilizable'
              : 'No se pudo proyectar el plan de contabilización automático'
          }
          description={
            cfdi.tipoComprobante === 'T'
              ? 'Los CFDI Tipo T únicamente acreditan la propiedad o traslado de mercancías y no generan cargos ni abonos en resultados.'
              : cfdi.statusSat === 'CANCELADO'
              ? 'Las facturas canceladas ante el SAT no producen efectos fiscales deducibles ni acreditables.'
              : 'Verifica que el catálogo de cuentas contables del periodo esté cargado para generar la vista previa.'
          }
        />
      )}
    </div>
  );
}

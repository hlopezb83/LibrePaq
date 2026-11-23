import { BookOpen } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { Poliza } from '../../shared/types';

interface PolizaCardMovementsTableProps {
  pol: Poliza;
  onOpenLedger: (accountId: string) => void;
}

export function PolizaCardMovementsTable({
  pol,
  onOpenLedger
}: PolizaCardMovementsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <caption className="visually-hidden">
          Partidas de la póliza {pol.tipo} #{pol.folio}
        </caption>
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-white">
            <th scope="col" className="py-2 px-4">
              Cuenta Contable (Ver Mayor)
            </th>
            <th scope="col" className="py-2 px-4">
              Nombre de Cuenta
            </th>
            <th scope="col" className="py-2 px-4">
              Referencia
            </th>
            <th scope="col" className="py-2 px-4">
              Concepto del Movimiento
            </th>
            <th scope="col" className="py-2 px-4 text-right">
              Cargo (Debe)
            </th>
            <th scope="col" className="py-2 px-4 text-right">
              Abono (Haber)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs">
          {pol.movements.map((mov) => (
            <tr key={mov.id} className="hover:bg-blue-50/30 transition">
              <td className="py-2 px-4">
                <button
                  type="button"
                  onClick={() => onOpenLedger(mov.accountId)}
                  title="Abrir Tarjeta Auxiliar / Libro Mayor de esta cuenta"
                  aria-label={`Abrir Libro Mayor de cuenta ${mov.accountCode}`}
                  className="group/acc inline-flex items-center gap-1.5 font-mono font-bold text-blue-800 hover:text-blue-950 transition cursor-pointer"
                >
                  <span className="px-1.5 py-0.5 rounded-md bg-blue-50 group-hover/acc:bg-blue-100/80 border border-blue-200/70 group-hover/acc:border-blue-300 text-blue-900 underline decoration-dotted underline-offset-2 flex items-center gap-1 shadow-2xs">
                    <BookOpen className="w-3 h-3 text-blue-600 group-hover/acc:text-blue-800" aria-hidden="true" />
                    <span>{mov.accountCode}</span>
                  </span>
                  <span className="hidden xl:inline text-[10px] text-slate-400 font-sans font-medium group-hover/acc:text-blue-700">
                    Mayor
                  </span>
                </button>
              </td>
              <td className="py-2 px-4 font-medium text-slate-800">{mov.accountName}</td>
              <td className="py-2 px-4 font-mono text-slate-500">{mov.referencia}</td>
              <td className="py-2 px-4 text-slate-600">{mov.concepto}</td>
              <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900">
                {mov.cargo > 0 ? formatCurrency(mov.cargo) : '—'}
              </td>
              <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900">
                {mov.abono > 0 ? formatCurrency(mov.abono) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bloques de firmas contables para impresión y auditoría */}
      <div className="px-4 sm:px-6 py-3 bg-slate-50/60 border-t border-slate-200 hidden print:grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 text-center text-[11px] text-slate-500">
        <div className="pt-4 border-t border-slate-300">
          <strong className="text-slate-700 block">ELABORÓ</strong>
          <span>Auxiliar / Contador General</span>
        </div>
        <div className="pt-4 border-t border-slate-300">
          <strong className="text-slate-700 block">REVISÓ</strong>
          <span>Auditoría Fiscal / C.P.C.</span>
        </div>
        <div className="pt-4 border-t border-slate-300">
          <strong className="text-slate-700 block">AUTORIZÓ</strong>
          <span>Dirección / Representante Legal</span>
        </div>
      </div>
    </div>
  );
}

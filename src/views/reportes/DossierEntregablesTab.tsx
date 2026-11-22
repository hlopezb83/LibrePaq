import { FileCheck2, Printer } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

interface DossierEntregablesTabProps {
  mesNombre: string;
  ejercicio: number;
  totals: { finalDeudor: number };
  incomeStatement: { utilidadNeta: number };
  balanceSheet: { totalActivo: number };
  onOpenDeliverablesModal: () => void;
}

export function DossierEntregablesTab({
  mesNombre,
  ejercicio,
  totals,
  incomeStatement,
  balanceSheet,
  onOpenDeliverablesModal
}: DossierEntregablesTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-[#0A1120] rounded-2xl p-6 text-white border border-blue-900 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <FileCheck2 className="w-3.5 h-3.5" />
              Dossier Oficial de Entregables
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Carpeta de Cierre Contable y Fiscal — {mesNombre} {ejercicio}
            </h2>
            <p className="text-xs text-slate-300">
              Paquete integral de estados financieros dictaminados bajo NIF mexicanas, cédula fiscal Día 17 y papeles de trabajo para dirección y auditores.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDeliverablesModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Abrir Centro de Impresión / PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
            1
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Balanza de Comprobación</h3>
            <p className="text-xs text-slate-500 mt-0.5">Anexo 24 R.M.F. / NIF B-1</p>
          </div>
          <div className="text-xs font-mono text-slate-700 pt-2 border-t border-slate-100 flex justify-between">
            <span>Sumas Iguales:</span>
            <strong className="text-emerald-800">{formatCurrency(totals.finalDeudor)}</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200">
            2
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Estado de Resultados</h3>
            <p className="text-xs text-slate-500 mt-0.5">NIF B-3 Integral con Análisis %</p>
          </div>
          <div className="text-xs font-mono text-slate-700 pt-2 border-t border-slate-100 flex justify-between">
            <span>Utilidad Neta:</span>
            <strong className="text-slate-900">{formatCurrency(incomeStatement.utilidadNeta)}</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200">
            3
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Balance General</h3>
            <p className="text-xs text-slate-500 mt-0.5">NIF B-6 Posición Financiera</p>
          </div>
          <div className="text-xs font-mono text-slate-700 pt-2 border-t border-slate-100 flex justify-between">
            <span>Total Activo:</span>
            <strong className="text-slate-900">{formatCurrency(balanceSheet.totalActivo)}</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-300/90 shadow-2xs space-y-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs border border-amber-200">
            4
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Cédula Fiscal Día 17</h3>
            <p className="text-xs text-slate-500 mt-0.5">ISR Art. 14 / RESICO e IVA</p>
          </div>
          <div className="text-xs font-mono text-slate-700 pt-2 border-t border-slate-100 flex justify-between">
            <span>Vencimiento:</span>
            <strong className="text-amber-800">Día 17 del mes</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

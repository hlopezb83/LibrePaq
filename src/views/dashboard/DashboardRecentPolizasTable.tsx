import { Link } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { Poliza } from '../../shared/types';

export interface DashboardRecentPolizasTableProps {
  totalPolizasPeriodo: number;
  recentPolizas: Poliza[];
}

export function DashboardRecentPolizasTable({
  totalPolizasPeriodo,
  recentPolizas
}: DashboardRecentPolizasTableProps) {
  return (
    <section className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Pólizas Recientes del Periodo ({totalPolizasPeriodo})
          </h2>
          <p className="text-xs text-slate-500">
            Movimientos en diario, ingresos y egresos verificados con Partida Doble
          </p>
        </div>
        <Link
          to="/polizas"
          className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
        >
          Ver todas las pólizas <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse erp-sticky-table">
          <caption className="visually-hidden">Pólizas recientes del periodo</caption>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th scope="col" className="py-3 px-4">Póliza</th>
              <th scope="col" className="py-3 px-4">Fecha</th>
              <th scope="col" className="py-3 px-4">Concepto Contable</th>
              <th scope="col" className="py-3 px-4">Origen / CFDI</th>
              <th scope="col" className="py-3 px-4 text-right">Cargos (Debe)</th>
              <th scope="col" className="py-3 px-4 text-right">Abonos (Haber)</th>
              <th scope="col" className="py-3 px-4 text-center">Estado</th>
              <th scope="col" className="py-3 px-4 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {recentPolizas.map((pol) => (
              <tr key={pol.id} className="hover:bg-blue-50/40 transition">
                <td className="py-3 px-4 font-mono font-bold text-slate-900">
                  <Link
                    to="/polizas"
                    search={{ search: String(pol.folio) } as unknown as Record<string, string>}
                    title={`Consultar póliza ${pol.tipo} #${pol.folio} en Pólizas Contables`}
                    className={`inline-block px-2.5 py-0.5 rounded text-[11px] border hover:shadow-xs transition ${
                      pol.tipo === 'INGRESO'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        : pol.tipo === 'EGRESO'
                        ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                        : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    {pol.tipo} #{pol.folio}
                  </Link>
                </td>
                <td className="py-3 px-4 font-mono text-slate-600">
                  {formatShortDate(pol.fecha)}
                </td>
                <td className="py-3 px-4 font-medium text-slate-800 max-w-md truncate">
                  {pol.concepto}
                </td>
                <td className="py-3 px-4">
                  {pol.origin === 'ADD_AUTO' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      Auto ADD
                    </span>
                  ) : (
                    <span className="text-slate-600">Captura Manual</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                  {formatCurrency(pol.totalCargos)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                  {formatCurrency(pol.totalAbonos)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    Cuadrada
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <Link
                    to="/polizas"
                    search={{ search: String(pol.folio) } as unknown as Record<string, string>}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                    title="Abrir asiento contable completo"
                  >
                    <span>Ver Asiento</span>
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

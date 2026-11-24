import { Link } from '@tanstack/react-router';
import { AlertCircle, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
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
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
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
            {recentPolizas.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-700">
                    Sin pólizas registradas en este periodo contable
                  </p>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    Captura una póliza manual o sube facturas XML en la Bóveda ADD para generar asientos automáticamente.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Link
                      to="/polizas"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition"
                    >
                      Capturar Póliza
                    </Link>
                    <Link
                      to="/add"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold transition"
                    >
                      Ir a Bóveda ADD
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              recentPolizas.map((pol) => {
                const isBalanced = Math.abs(pol.totalCargos - pol.totalAbonos) < 0.01;
                return (
              <tr key={pol.id} className="hover:bg-blue-50/40 transition">
                <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                  <Link
                    to="/polizas"
                    search={{ search: `${pol.tipo} #${pol.folio}` } as unknown as Record<string, string>}
                    title={`Consultar póliza ${pol.tipo} #${pol.folio} en Pólizas Contables`}
                    className={`inline-block px-2.5 py-0.5 rounded text-[11px] border hover:shadow-xs transition whitespace-nowrap ${
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
                <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                  {formatShortDate(pol.fecha)}
                </td>
                <td
                  title={pol.concepto}
                  className="py-3 px-4 font-medium text-slate-800 max-w-md truncate"
                >
                  {pol.concepto}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {pol.origin === 'ADD_AUTO' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
                      <Sparkles className="w-3 h-3" aria-hidden="true" />
                      Auto ADD
                    </span>
                  ) : (
                    <span className="text-slate-600">Captura Manual</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                  {formatCurrency(pol.totalCargos)}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                  {formatCurrency(pol.totalAbonos)}
                </td>
                <td className="py-3 px-4 text-center whitespace-nowrap">
                  {isBalanced ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      Cuadrada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                      <AlertCircle className="w-3 h-3" aria-hidden="true" />
                      Descuadrada
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <Link
                    to="/polizas"
                    search={{ search: `${pol.tipo} #${pol.folio}` } as unknown as Record<string, string>}
                    aria-label={`Ver asiento de póliza ${pol.tipo} folio ${pol.folio}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition whitespace-nowrap"
                    title="Abrir asiento contable completo"
                  >
                    <span>Ver Asiento</span>
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

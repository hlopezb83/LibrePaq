import { Link } from '@tanstack/react-router';
import { AlertCircle, ArrowRight, CheckCircle2, ReceiptText, Sparkles } from 'lucide-react';
import { EmptyState, StatusBadge, getButtonClasses } from '../../components/ui';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import type { Poliza } from '../../shared/types';

export interface DashboardRecentPolizasTableProps {
  totalPolizasPeriodo: number;
  recentPolizas: Poliza[];
  isPeriodLocked?: boolean;
  isReadOnly?: boolean;
}

export function DashboardRecentPolizasTable({
  totalPolizasPeriodo,
  recentPolizas,
  isPeriodLocked = false,
  isReadOnly = false
}: DashboardRecentPolizasTableProps) {
  const isWriteSuppressed = isPeriodLocked || isReadOnly;

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

      {recentPolizas.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="w-5 h-5" aria-hidden="true" />}
          tone="blue"
          title="Sin pólizas registradas en este periodo contable"
          description={
            isWriteSuppressed
              ? 'Modo solo consulta: no hay pólizas contables capturadas en este periodo.'
              : 'Captura una póliza manual o sube facturas XML en la Bóveda ADD para generar asientos automáticamente.'
          }
          actions={
            !isWriteSuppressed ? (
              <>
                <Link to="/polizas" className={getButtonClasses('primary', 'md')}>
                  Capturar Póliza
                </Link>
                <Link to="/add" className={getButtonClasses('secondary', 'md')}>
                  Ir a Bóveda ADD
                </Link>
              </>
            ) : undefined
          }
        />
      ) : (
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Pólizas recientes del periodo"
        >
          <table className="w-full text-left border-collapse erp-sticky-table">
            <caption className="visually-hidden">Pólizas recientes del periodo</caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th scope="col" className="py-3 px-4">
                  Póliza
                </th>
                <th scope="col" className="py-3 px-4">
                  Fecha
                </th>
                <th scope="col" className="py-3 px-4">
                  Concepto Contable
                </th>
                <th scope="col" className="py-3 px-4">
                  Origen / CFDI
                </th>
                <th scope="col" className="py-3 px-4 text-right">
                  Cargos (Debe)
                </th>
                <th scope="col" className="py-3 px-4 text-right">
                  Abonos (Haber)
                </th>
                <th scope="col" className="py-3 px-4 text-center">
                  Estado
                </th>
                <th scope="col" className="py-3 px-4 text-right">
                  Detalle
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {recentPolizas.map((pol) => {
                const isBalanced = Math.abs(pol.totalCargos - pol.totalAbonos) < 0.01;
                const polizaTone =
                  pol.tipo === 'INGRESO'
                    ? 'emerald'
                    : pol.tipo === 'EGRESO'
                    ? 'amber'
                    : 'blue';
                return (
                  <tr key={pol.id} className="hover:bg-blue-50/40 transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Link
                        to="/polizas"
                        search={
                          { search: `${pol.tipo} #${pol.folio}` } as unknown as Record<
                            string,
                            string
                          >
                        }
                        title={`Consultar póliza ${pol.tipo} #${pol.folio} en Pólizas Contables`}
                        className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      >
                        <StatusBadge tone={polizaTone} shape="tag">
                          {pol.tipo} #{pol.folio}
                        </StatusBadge>
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
                        <StatusBadge
                          tone="blue"
                          icon={<Sparkles className="w-3 h-3" aria-hidden="true" />}
                        >
                          Auto ADD
                        </StatusBadge>
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
                      <StatusBadge
                        tone={isBalanced ? 'emerald' : 'red'}
                        icon={
                          isBalanced ? (
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="w-3 h-3" aria-hidden="true" />
                          )
                        }
                      >
                        {isBalanced ? 'Cuadrada' : 'Descuadrada'}
                      </StatusBadge>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        to="/polizas"
                        search={
                          { search: `${pol.tipo} #${pol.folio}` } as unknown as Record<
                            string,
                            string
                          >
                        }
                        aria-label={`Ver asiento de póliza ${pol.tipo} folio ${pol.folio}`}
                        title="Abrir asiento contable completo"
                        className={getButtonClasses('secondary', 'sm')}
                      >
                        <span>Ver Asiento</span>
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

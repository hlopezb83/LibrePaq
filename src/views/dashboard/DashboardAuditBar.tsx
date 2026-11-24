import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  FileCode2,
  Landmark,
  Loader2,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type {
  BankReconciliationResponse,
  CfdiDocument,
  DashboardSummary,
  DashboardTrialBalanceSummary
} from '../../shared/types';
import { DashboardAuditCard, type AuditCardTone } from './DashboardAuditCard';
import type { EfosDashboardSummary } from './dashboardHelpers';

export interface DashboardAuditBarProps {
  mesActualNombre: string;
  companyYear: number;
  kpis: DashboardSummary['kpis'];
  isBankReconciled: boolean;
  bankRec: BankReconciliationResponse | null | undefined;
  isBankRecLoading?: boolean;
  isBankRecError?: boolean;
  isTrialBalanced: boolean;
  trialBalanceSummary: DashboardTrialBalanceSummary | null | undefined;
  pendingCfdis: CfdiDocument[];
  efosSummary?: EfosDashboardSummary;
  isBatchAutoPolizaPending: boolean;
  isSingleAutoPolizaPending?: boolean;
  onBatchAutoPoliza: (ids: string[]) => void;
  isPeriodLocked?: boolean;
  isReadOnly?: boolean;
}

export function DashboardAuditBar({
  mesActualNombre,
  companyYear,
  kpis,
  isBankReconciled,
  bankRec,
  isBankRecLoading = false,
  isBankRecError = false,
  isTrialBalanced,
  trialBalanceSummary,
  pendingCfdis,
  efosSummary,
  isBatchAutoPolizaPending,
  isSingleAutoPolizaPending = false,
  onBatchAutoPoliza,
  isPeriodLocked = false,
  isReadOnly = false
}: DashboardAuditBarProps) {
  const hasActivity = kpis.totalPolizasPeriodo > 0 || kpis.cfdisTotalesPeriodo > 0;
  const hasBankActivity = Boolean(
    bankRec && (bankRec.statementLines.length > 0 || bankRec.bookMovements.length > 0)
  );
  const isTruncatedPending =
    pendingCfdis.length > 0 && kpis.cfdisPendientesContabilizar > pendingCfdis.length;
  const efosCount = efosSummary?.efosCount ?? 0;

  const addTone: AuditCardTone =
    kpis.cfdisPendientesContabilizar > 0
      ? 'warning'
      : kpis.cfdisTotalesPeriodo === 0
      ? 'neutral'
      : 'success';

  const bankTone: AuditCardTone =
    isBankRecLoading || isBankRecError || !hasBankActivity
      ? 'neutral'
      : !isBankReconciled
      ? 'warning'
      : 'success';

  const trialTone: AuditCardTone = !isTrialBalanced
    ? 'danger'
    : !hasActivity
    ? 'neutral'
    : 'success';

  return (
    <section
      aria-label="Accesos directos a módulos pendientes y auditoría fiscal"
      className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 shrink-0 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
            <Zap className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">
              Auditoría y Tareas Prioritarias del Periodo ({mesActualNombre} {companyYear})
            </h2>
            <p className="text-[11px] text-slate-600">
              Acceso directo en 1 clic a los módulos con comprobantes o partidas pendientes
            </p>
          </div>
        </div>

        <Link
          to="/fiscal-bancos"
          search={{ tab: 'PADRON_RFC' } as unknown as Record<string, string>}
          title={
            efosCount > 0
              ? `Se detectaron ${efosCount} RFC(s) señalados en lista negra SAT Art. 69-B. Haz clic para auditar en Padrón RFC.`
              : 'Consultar Padrón RFC y verificación preventiva Lista 69-B del SAT'
          }
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition shrink-0 ${
            efosCount > 0
              ? 'bg-red-50 hover:bg-red-100 text-red-900 border-red-300'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
          }`}
        >
          {efosCount > 0 ? (
            <ShieldAlert className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
          )}
          <span>{efosCount > 0 ? `Alerta Art. 69-B: ${efosCount} EFOS` : 'Padrón Art. 69-B: 0 EFOS'}</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <DashboardAuditCard
          icon={FileCode2}
          title="CFDIs en Bóveda ADD"
          tone={addTone}
          badgeText={
            kpis.cfdisPendientesContabilizar > 0
              ? `${kpis.cfdisPendientesContabilizar} pendientes`
              : kpis.cfdisTotalesPeriodo === 0
              ? 'Sin CFDIs'
              : '100% Contabilizado'
          }
          description={
            kpis.cfdisPendientesContabilizar > 0 ? (
              <>
                Existen{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {kpis.cfdisPendientesContabilizar}
                </strong>{' '}
                archivos XML esperando ser contabilizados en póliza.
                {isTruncatedPending && (
                  <span className="block mt-1 text-[11px] font-medium text-amber-900">
                    Mostrando {pendingCfdis.length} de {kpis.cfdisPendientesContabilizar} pendientes.
                  </span>
                )}
              </>
            ) : kpis.cfdisTotalesPeriodo === 0 ? (
              'Aún no hay archivos XML CFDI 4.0 registrados en este periodo contable.'
            ) : (
              'Todos los archivos XML CFDI 4.0 del periodo han sido transformados en pólizas cuadradas.'
            )
          }
          footerLeft={
            kpis.cfdisPendientesContabilizar >= 1 && pendingCfdis.length > 0 ? (
              <button
                type="button"
                disabled={isBatchAutoPolizaPending || isSingleAutoPolizaPending || isPeriodLocked || isReadOnly}
                aria-busy={isBatchAutoPolizaPending}
                onClick={() => onBatchAutoPoliza(pendingCfdis.map((c) => c.id))}
                title={
                  isReadOnly
                    ? 'Modo solo lectura: no tienes permisos para generar pólizas'
                    : isPeriodLocked
                    ? 'Periodo cerrado con candado fiscal'
                    : isSingleAutoPolizaPending || isBatchAutoPolizaPending
                    ? 'Procesando generación de pólizas contables...'
                    : isTruncatedPending
                    ? `Generar pólizas del lote mostrado (${pendingCfdis.length} de ${kpis.cfdisPendientesContabilizar} pendientes)`
                    : `Generar pólizas de los ${pendingCfdis.length} archivos XML pendientes en 1 clic`
                }
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
              >
                {isBatchAutoPolizaPending ? (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-100" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-3 h-3 text-amber-100" aria-hidden="true" />
                )}
                <span>
                  {isBatchAutoPolizaPending
                    ? 'Contabilizando...'
                    : `Contabilizar lote (${pendingCfdis.length})`}
                </span>
              </button>
            ) : (
              <span className="text-[10px] font-mono text-slate-600">
                Atajo: <kbd className="bg-white px-1 rounded border border-slate-300">Alt+2</kbd>
              </span>
            )
          }
          footerRight={
            <Link
              to="/add"
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                kpis.cfdisPendientesContabilizar > 0
                  ? 'bg-white hover:bg-amber-100 text-amber-900 border-amber-300'
                  : kpis.cfdisTotalesPeriodo === 0
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}
            >
              <span>Ir al ADD (Alt+2)</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          }
        />

        <DashboardAuditCard
          icon={Landmark}
          title="Conciliación Bancaria"
          tone={bankTone}
          badgeText={
            isBankRecLoading
              ? 'Verificando...'
              : isBankRecError
              ? 'No disponible'
              : !hasBankActivity
              ? 'Sin movimientos'
              : !isBankReconciled
              ? `${
                  (bankRec?.summary.movimientosPendientesBanco ?? 0) +
                  (bankRec?.summary.movimientosPendientesLibros ?? 0)
                } por conciliar`
              : 'Conciliado 100%'
          }
          description={
            isBankRecLoading ? (
              'Consultando extractos bancarios y movimientos en libros del periodo...'
            ) : isBankRecError ? (
              'No fue posible obtener el estado de conciliación bancaria en este momento.'
            ) : !hasBankActivity ? (
              'Importa tu estado de cuenta bancario o registra pólizas de bancos para conciliar el periodo.'
            ) : !isBankReconciled ? (
              'Partidas bancarias pendientes de cruzar con libros. Cruza depósitos y cheques para cerrar bancos.'
            ) : (
              <>
                Extracto bancario verificado contra libro mayor. Saldo disponible:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatCurrency(kpis.efectivoBancos)}
                </strong>
                .
              </>
            )
          }
          footerLeft={
            <span className="text-[10px] font-mono text-slate-600">
              Atajo: <kbd className="bg-white px-1 rounded border border-slate-300">Alt+5</kbd>
            </span>
          }
          footerRight={
            <Link
              to="/fiscal-bancos"
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                bankTone === 'neutral'
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : bankTone === 'warning'
                  ? 'bg-amber-700 hover:bg-amber-800 text-white border-amber-800'
                  : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}
            >
              <span>
                {bankTone === 'neutral'
                  ? 'Ir a Bancos'
                  : bankTone === 'warning'
                  ? 'Conciliar Bancos'
                  : 'Ver Cédula Bancaria'}
              </span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          }
        />

        <DashboardAuditCard
          icon={Scale}
          title="Balanza de Comprobación"
          tone={trialTone}
          badgeText={
            !isTrialBalanced
              ? 'Descuadrada'
              : !hasActivity
              ? 'Sin movimientos'
              : 'Partida Doble ✔'
          }
          description={
            !isTrialBalanced ? (
              <>
                Alerta: Existe una discrepancia de{' '}
                <strong className="font-mono tabular-nums text-red-900">
                  {formatCurrency(trialBalanceSummary?.difference || 0)}
                </strong>{' '}
                entre cargos y abonos del mes.
              </>
            ) : !hasActivity ? (
              'Captura pólizas o contabiliza archivos XML para generar movimientos en tu Balanza de Comprobación.'
            ) : (
              'Sumas iguales en Cargos y Abonos verificadas. Lista para exportar en XML SAT Anexo 24.'
            )
          }
          footerLeft={
            <span className="text-[10px] font-mono text-slate-600">
              Atajo: <kbd className="bg-white px-1 rounded border border-slate-300">Alt+6</kbd>
            </span>
          }
          footerRight={
            <Link
              to="/reportes"
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                !isTrialBalanced
                  ? 'bg-red-700 hover:bg-red-800 text-white border-red-800'
                  : !hasActivity
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}
            >
              <span>{!isTrialBalanced ? 'Auditar Descuadre' : 'Ver Balanza Anexo 24'}</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
          }
        />
      </div>
    </section>
  );
}

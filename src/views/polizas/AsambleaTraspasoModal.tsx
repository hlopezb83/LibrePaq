import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { AlertBanner, Button, ModalShell, StatusBadge } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { apiClient, invalidateAccountingQueries } from '../../lib/api-client';
import { formatCurrency } from '../../lib/formatters';
import { analyzeAsambleaTraspaso } from '../../shared/engine/asamblea-traspaso.engine';
import type { AccountWithBalance } from '../../shared/types';

interface AsambleaTraspasoModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  currentYear: number;
  currentPeriod: number;
  isPeriodLocked: boolean;
  isReadOnlyClient: boolean;
  accounts: AccountWithBalance[];
}

export function AsambleaTraspasoModal({
  isOpen,
  onClose,
  companyId,
  currentYear,
  currentPeriod,
  isPeriodLocked,
  isReadOnlyClient,
  accounts
}: AsambleaTraspasoModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose, { isOpen });
  const toast = useToast();
  const queryClient = useQueryClient();
  const [allowOverrideManual, setAllowOverrideManual] = useState(false);

  const { data: yearPolizas = [], isLoading } = useQuery({
    queryKey: ['polizas', companyId, currentYear, 'ALL', 'asamblea'],
    queryFn: () => apiClient.getPolizas(companyId, currentYear, 'ALL'),
    enabled: isOpen && Boolean(companyId)
  });

  const analysis = useMemo(
    () =>
      analyzeAsambleaTraspaso({
        companyId,
        ejercicio: currentYear,
        periodo: currentPeriod,
        accounts,
        polizasInYear: yearPolizas
      }),
    [companyId, currentYear, currentPeriod, accounts, yearPolizas]
  );

  const createMutation = useMutation({
    mutationFn: () => {
      if (!analysis.suggestedDraft) throw new Error('No hay borrador de traspaso disponible.');
      return apiClient.createPoliza({
        ...analysis.suggestedDraft,
        origin: 'MANUAL'
      });
    },
    onSuccess: (saved) => {
      invalidateAccountingQueries(queryClient, ['polizas', 'accounts', 'reports', 'dashboard']);
      toast.success(`Traspaso de Asamblea ${saved.tipo} #${saved.folio} generado`);
      onClose();
    },
    onError: (err: Error) => toast.error('Error al generar traspaso', err.message)
  });

  if (!isOpen) return null;

  const canSubmit =
    !isReadOnlyClient &&
    !isPeriodLocked &&
    Boolean(analysis.suggestedDraft) &&
    analysis.isJanuary &&
    (!analysis.hasExistingManualPoliza || allowOverrideManual);

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={isOpen}
      onClose={onClose}
      usePortal
      maxWidth="2xl"
      titleId="asamblea-traspaso-title"
      closeLabel="Cerrar traspaso de resultados de asamblea"
      icon={<ArrowRightLeft className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title={`Traspaso de Resultados (Asamblea) — Enero ${currentYear}`}
      subtitle="Traslada el saldo de 305-01-001 (Resultado del Ejercicio) a 301-02-001 (Resultados Acumulados)."
      bodyClassName="space-y-4 text-xs scrollable-panel"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button
            variant="primary"
            loading={createMutation.isPending}
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Generar Póliza de Traspaso
          </Button>
        </>
      }
    >
      {!analysis.isJanuary && (
        <AlertBanner tone="warning" icon={<AlertTriangle className="w-4 h-4" aria-hidden="true" />}>
          El Traspaso de Resultados de Asamblea se aplica en <strong>Periodo 01 (Enero)</strong>. Cambia al periodo Enero {currentYear} para registrarlo.
        </AlertBanner>
      )}

      {isLoading ? (
        <p className="text-slate-600">Verificando pólizas existentes sobre 305-01-001 / 301-02-001...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[11px] font-semibold text-slate-600">Cuenta Origen (305-01-001)</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                {analysis.sourceAccount ? `${analysis.sourceAccount.code} · ${analysis.sourceAccount.name}` : 'No encontrada'}
              </div>
              <div className="text-sm font-mono font-extrabold text-blue-900 mt-1">
                {formatCurrency(analysis.saldo305)} ({analysis.direction})
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[11px] font-semibold text-slate-600">Cuenta Destino (Resultados Acumulados)</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                {analysis.targetAccount ? `${analysis.targetAccount.code} · ${analysis.targetAccount.name}` : 'No encontrada'}
              </div>
            </div>
          </div>

          {analysis.hasExistingManualPoliza ? (
            <AlertBanner tone="warning" title="Detección anti-doble conteo">
              <p>
                Se detectaron pólizas previas sobre <strong>305-01-001 / 301-02-001</strong> en {currentYear}:
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-0.5 font-mono text-[11px]">
                {analysis.matchingPolizas.map((m) => (
                  <li key={m.polizaId}>
                    {m.tipo} #{m.folio} ({m.fecha}) — {m.concepto} ({formatCurrency(m.amount)})
                  </li>
                ))}
              </ul>
              <label className="mt-2 inline-flex items-center gap-1.5 font-sans font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOverrideManual}
                  onChange={(e) => setAllowOverrideManual(e.target.checked)}
                />
                <span>Confirmo que requiero generar un traspaso adicional</span>
              </label>
            </AlertBanner>
          ) : analysis.blockReason ? (
            <AlertBanner tone="info">{analysis.blockReason}</AlertBanner>
          ) : (
            <AlertBanner tone="success" icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}>
              Sin pólizas previas sobre 305-01-001 / 301-02-001 en {currentYear}. Listo para traspasar sin duplicidad.
            </AlertBanner>
          )}

          {analysis.suggestedDraft && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 px-3 py-1.5 font-bold flex items-center justify-between">
                <span>Vista previa de asiento de traspaso</span>
                <StatusBadge tone="blue" shape="tag">{analysis.suggestedDraft.fecha}</StatusBadge>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600">
                    <th scope="col" className="py-1.5 px-3">Cuenta</th>
                    <th scope="col" className="py-1.5 px-3">Concepto</th>
                    <th scope="col" className="py-1.5 px-3 text-right">Cargo</th>
                    <th scope="col" className="py-1.5 px-3 text-right">Abono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {analysis.suggestedDraft.movements.map((m) => (
                    <tr key={m.accountCode}>
                      <td className="py-1.5 px-3 font-bold">{m.accountCode} — <span className="font-sans font-normal">{m.accountName}</span></td>
                      <td className="py-1.5 px-3 font-sans">{m.concepto}</td>
                      <td className="py-1.5 px-3 text-right">{m.cargo > 0 ? formatCurrency(m.cargo) : '—'}</td>
                      <td className="py-1.5 px-3 text-right">{m.abono > 0 ? formatCurrency(m.abono) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}

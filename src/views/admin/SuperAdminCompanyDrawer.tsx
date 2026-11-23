import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  AlertTriangle, Building2, Calendar, CheckCircle2, Eye, FileCode2,
  KeyRound, Landmark, Layers, Loader2, Lock, LockOpen, ReceiptText, ShieldCheck, Trash2, X
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { startSupportSession } from '../../lib/support-impersonation';
import { canManageBillingAndQuotas } from '../../shared/superadmin';
import type { PlatformRole } from '../../shared/admin-types';
import { useToast } from '../../context/ToastContext';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { SuperAdminQuotaCard } from './SuperAdminQuotaCard';

interface SuperAdminCompanyDrawerProps {
  companyId: string | null;
  platformRole?: PlatformRole;
  workspaceIdHint?: string;
  onClose: () => void;
  onDeleteCompany?: (companyId: string) => Promise<void> | void;
  isDeletingCompany?: boolean;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function SuperAdminCompanyDrawer({
  companyId,
  platformRole = 'NONE',
  workspaceIdHint,
  onClose,
  onDeleteCompany,
  isDeletingCompany = false
}: SuperAdminCompanyDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmRfc, setConfirmRfc] = useState('');
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [supportLogged, setSupportLogged] = useState(false);
  const [enteringSupport, setEnteringSupport] = useState(false);

  useDialogLightDismiss(dialogRef, onClose, { isOpen: Boolean(companyId) });

  useEffect(() => {
    setConfirmRfc('');
    setShowDeleteZone(false);
    setSupportLogged(false);
  }, [companyId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (companyId && !dialog.open) dialog.showModal();
    else if (!companyId && dialog.open) dialog.close();
  }, [companyId]);

  const { data: detail, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-company-detail', companyId],
    queryFn: () => apiClient.getAdminCompanyDetail(companyId!),
    enabled: Boolean(companyId)
  });

  const inspectMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !detail) return;
      await apiClient.recordAdminAuditLog({
        action: 'INSPECT_TENANT',
        targetType: 'company',
        targetId: companyId,
        metadata: { rfc: detail.company.rfc, name: detail.company.name }
      });
    },
    onSuccess: () => {
      setSupportLogged(true);
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
      toast.success('Inspección registrada en auditoría', 'El evento Modo Soporte quedó asentado en la bitácora.');
    },
    onError: (err: unknown) => toast.error('Error al registrar inspección', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const handleOpenSupportView = async () => {
    if (!companyId || !detail || enteringSupport) return;
    setEnteringSupport(true);
    try {
      await apiClient.recordAdminAuditLog({
        action: 'START_SUPPORT_IMPERSONATION',
        targetType: 'company',
        targetId: companyId,
        metadata: { rfc: detail.company.rfc, name: detail.company.name, ownerEmail: detail.company.userEmail ?? null }
      });
    } catch { /* best-effort audit */ }
    startSupportSession({
      companyId,
      companyName: detail.company.name,
      companyRfc: detail.company.rfc,
      ownerEmail: detail.company.userEmail
    });
    void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
    setEnteringSupport(false);
    onClose();
    void navigate({ to: '/' });
  };

  const handleDelete = async () => {
    if (!companyId || !detail || !onDeleteCompany || confirmRfc.trim() !== detail.company.rfc) return;
    await onDeleteCompany(companyId);
    onClose();
  };

  if (typeof document === 'undefined') return null;

  const isRfcMatch = Boolean(detail && confirmRfc.trim() === detail.company.rfc);
  const resolvedWsId =
    workspaceIdHint ||
    (detail?.company.userId ? `ws_${detail.company.userId.slice(0, 8)}` : detail ? `ws_${detail.company.id.slice(0, 8)}` : '');
  const stats = detail
    ? [
        { label: 'Cuentas', value: detail.accountsCount, icon: Layers },
        { label: 'Pólizas', value: detail.polizasCount, icon: ReceiptText },
        { label: 'CFDIs', value: detail.cfdisCount, icon: FileCode2 },
        { label: 'Mov. Bancarios', value: detail.bankLinesCount, icon: Landmark }
      ]
    : [];

  return createPortal(
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="company-drawer-title"
      className="ml-auto mr-0 sm:mr-4 my-auto rounded-2xl shadow-2xl border border-slate-300 bg-white w-full max-w-2xl max-h-[92dvh] overflow-hidden backdrop:bg-slate-900/60"
    >
      <div className="flex flex-col max-h-[92dvh]">
        <header className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-white shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="company-drawer-title" className="text-base font-bold text-slate-900 truncate">
                {detail?.company.name || 'Inspección de Tenant Fiscal'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                {detail && <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{detail.company.rfc}</span>}
                <span className="font-mono text-[11px] text-slate-500">ID: {companyId || '—'}</span>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar panel de inspección" className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer shrink-0">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </header>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-600">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" aria-hidden="true" />
              <p className="text-xs font-semibold">Cargando telemetría del tenant...</p>
            </div>
          ) : isError || !detail ? (
            <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center justify-between gap-3">
              <span>No se pudo cargar el detalle fiscal de esta empresa.</span>
              <button type="button" onClick={() => void refetch()} className="px-3 py-1.5 rounded-lg bg-red-700 text-white font-bold hover:bg-red-800 cursor-pointer shrink-0">Reintentar</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-semibold">{stat.label}</span>
                        <Icon className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                      </div>
                      <p className="text-lg font-black text-slate-900">{stat.value.toLocaleString('es-MX')}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-indigo-600" aria-hidden="true" /> Estatus e.firma (FIEL)</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Certificado:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${detail.hasFiel ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{detail.hasFiel ? 'Cargada' : 'Sin e.firma'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">Serie:</span>
                    <span className="font-mono text-[11px] text-slate-900 truncate">{detail.fielNumeroSerie || 'N/D'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Vigencia:</span>
                    <span className="font-semibold text-slate-900">{formatDate(detail.fielValidTo)}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-blue-600" aria-hidden="true" /> Periodo y Actividad Reciente</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Candado Periodo:</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${detail.isCurrentPeriodLocked ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-700'}`}>
                      {detail.isCurrentPeriodLocked ? <Lock className="w-3 h-3" aria-hidden="true" /> : <LockOpen className="w-3 h-3" aria-hidden="true" />}
                      P{String(detail.company.currentPeriod).padStart(2, '0')}/{detail.company.currentYear} {detail.isCurrentPeriodLocked ? 'Cerrado' : 'Abierto'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between"><span className="text-slate-600">Última póliza:</span><span className="font-semibold text-slate-900">{formatDate(detail.lastPolizaAt)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-600">Último CFDI:</span><span className="font-semibold text-slate-900">{formatDate(detail.lastCfdiDate)}</span></div>
                </div>
              </div>

              {resolvedWsId && <SuperAdminQuotaCard workspaceId={resolvedWsId} userId={detail.company.userId} canEdit={canManageBillingAndQuotas(platformRole)} />}

              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <p className="font-bold text-blue-950 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-blue-700" aria-hidden="true" /> Modo Soporte en Vivo y Trazabilidad</p>
                  <p className="text-blue-900/80 mt-0.5">Abre las vistas del cliente bloqueando escrituras y registrando el acceso en auditoría.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button type="button" disabled={inspectMutation.isPending} onClick={() => inspectMutation.mutate()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-300 bg-white hover:bg-blue-100 text-blue-900 text-xs font-bold transition cursor-pointer disabled:opacity-60">
                    {inspectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : supportLogged ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> : <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span>{supportLogged ? 'Registrada' : 'Solo Registrar'}</span>
                  </button>
                  <button type="button" disabled={enteringSupport} onClick={() => void handleOpenSupportView()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer">
                    {enteringSupport ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span>Abrir en Modo Soporte</span>
                  </button>
                </div>
              </div>

              {onDeleteCompany && (
                <section className="p-4 rounded-xl border border-red-200 bg-red-50/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <h3 className="font-bold text-red-900 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-red-700" aria-hidden="true" /> Zona Peligrosa — Depuración de Tenant</h3>
                      <p className="text-red-800 mt-0.5">Elimina permanentemente la empresa, pólizas, cuentas, CFDIs y conciliaciones.</p>
                    </div>
                    {!showDeleteZone && (
                      <button type="button" onClick={() => setShowDeleteZone(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-300 text-red-800 hover:bg-red-100 text-xs font-bold transition cursor-pointer shrink-0">
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Depurar / Eliminar Empresa
                      </button>
                    )}
                  </div>
                  {showDeleteZone && (
                    <div onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowDeleteZone(false); setConfirmRfc(''); } }} className="p-3 rounded-lg bg-white border border-red-200 space-y-2.5 text-xs">
                      <label htmlFor="confirm-delete-rfc" className="block font-semibold text-slate-800">Escribe el RFC exacto <span className="font-mono font-bold text-red-700">{detail.company.rfc}</span> para confirmar:</label>
                      <input id="confirm-delete-rfc" type="text" value={confirmRfc} onChange={(e) => setConfirmRfc(e.target.value)} placeholder={detail.company.rfc} autoComplete="off" className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" />
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" autoFocus onClick={() => { setShowDeleteZone(false); setConfirmRfc(''); }} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer">Cancelar</button>
                        <button type="button" disabled={!isRfcMatch || isDeletingCompany} onClick={() => void handleDelete()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold cursor-pointer">
                          {isDeletingCompany && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />} Confirmar Eliminación
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>,
    document.body
  );
}

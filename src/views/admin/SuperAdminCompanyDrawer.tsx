import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Calendar, Check, Copy, FileCode2, KeyRound, Landmark, Layers, Loader2, Lock, LockOpen, ReceiptText, X
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { canManageBillingAndQuotas } from '../../shared/superadmin';
import type { PlatformRole } from '../../shared/admin-types';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { SuperAdminQuotaCard } from './SuperAdminQuotaCard';
import { AdminCompanySupportBar } from './AdminCompanySupportBar';
import { AdminCompanyDeleteZone } from './AdminCompanyDeleteZone';
import { formatAdminDate } from './adminFormatters';

interface SuperAdminCompanyDrawerProps {
  companyId: string | null;
  platformRole?: PlatformRole;
  workspaceIdHint?: string;
  onClose: () => void;
  onDeleteCompany?: (companyId: string) => Promise<void> | void;
  isDeletingCompany?: boolean;
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
  const { copiedKey, copy, reset: resetCopy } = useCopyToClipboard<'rfc' | 'fiel'>();

  useDialogLightDismiss(dialogRef, onClose, { isOpen: Boolean(companyId) });

  useEffect(() => {
    resetCopy();
  }, [companyId, resetCopy]);

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

  if (typeof document === 'undefined') return null;

  const resolvedWsId =
    detail?.company.userWorkspaceId ||
    workspaceIdHint ||
    (detail?.company.userId ? `ws_${detail.company.userId.slice(0, 8)}` : '');
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
                {detail?.company.name || 'Expediente de Empresa Fiscal'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                {detail && (
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {detail.company.rfc}
                    <button
                      type="button"
                      onClick={() => void copy(detail.company.rfc, 'rfc')}
                      aria-label="Copiar RFC"
                      title={copiedKey === 'rfc' ? 'RFC copiado' : 'Copiar RFC'}
                      className="min-h-7 min-w-7 inline-flex items-center justify-center p-0.5 rounded text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                    >
                      {copiedKey === 'rfc' ? <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                    </button>
                  </span>
                )}
                <span className="font-mono text-[11px] text-slate-600">ID: {companyId || '—'}</span>
              </p>
            </div>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="Cerrar expediente de empresa" className="p-1.5 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer shrink-0">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-600">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" aria-hidden="true" />
              <p className="text-xs font-semibold">Cargando expediente fiscal de la empresa...</p>
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
                      <div className="flex items-center justify-between text-slate-600 mb-1">
                        <span className="text-[11px] font-semibold">{stat.label}</span>
                        <Icon className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                      </div>
                      <p className="text-lg font-black text-slate-900 tabular-nums">{stat.value.toLocaleString('es-MX')}</p>
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
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-mono text-[11px] text-slate-900 truncate">{detail.fielNumeroSerie || 'N/D'}</span>
                      {detail.fielNumeroSerie && (
                        <button
                          type="button"
                          onClick={() => void copy(detail.fielNumeroSerie!, 'fiel')}
                          aria-label="Copiar número de serie e.firma"
                          title={copiedKey === 'fiel' ? 'Número de serie copiado' : 'Copiar número de serie e.firma'}
                          className="min-h-7 min-w-7 inline-flex items-center justify-center p-0.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shrink-0"
                        >
                          {copiedKey === 'fiel' ? <Check className="w-3 h-3 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">Vigencia:</span>
                    {detail.hasFiel && detail.fielValidTo ? (
                      <span
                        className={`font-semibold ${
                          new Date(detail.fielValidTo).getTime() < Date.now()
                            ? 'text-red-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {new Date(detail.fielValidTo).getTime() < Date.now()
                          ? `Vencida (${formatAdminDate(detail.fielValidTo)})`
                          : formatAdminDate(detail.fielValidTo)}
                      </span>
                    ) : (
                      <span className="text-slate-600">Sin certificado vigente</span>
                    )}
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
                  <div className="flex items-center justify-between"><span className="text-slate-600">Última póliza:</span><span className="font-semibold text-slate-900">{formatAdminDate(detail.lastPolizaAt)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-600">Último CFDI:</span><span className="font-semibold text-slate-900">{formatAdminDate(detail.lastCfdiDate)}</span></div>
                </div>
              </div>

              {detail.company.ownerType !== 'demo' && resolvedWsId && (
                <SuperAdminQuotaCard workspaceId={resolvedWsId} userId={detail.company.userId} canEdit={canManageBillingAndQuotas(platformRole)} />
              )}

              {companyId && (
                <AdminCompanySupportBar
                  companyId={companyId}
                  companyName={detail.company.name}
                  companyRfc={detail.company.rfc}
                  ownerEmail={detail.company.userEmail}
                  onCloseDrawer={onClose}
                />
              )}

              {companyId && onDeleteCompany && (
                <AdminCompanyDeleteZone
                  companyId={companyId}
                  companyRfc={detail.company.rfc}
                  isDeleting={isDeletingCompany}
                  onDeleteCompany={onDeleteCompany}
                  onDeleted={onClose}
                />
              )}
            </>
          )}
        </div>
        <span className="visually-hidden" aria-live="polite">
          {copiedKey === 'rfc' ? 'RFC copiado al portapapeles' : copiedKey === 'fiel' ? 'Número de serie e.firma copiado al portapapeles' : ''}
        </span>
      </div>
    </dialog>,
    document.body
  );
}

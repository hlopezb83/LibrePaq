import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Eye, Loader2, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { startSupportSession, useSupportSession } from '../../lib/support-impersonation';
import { useToast } from '../../context/ToastContext';

interface AdminCompanySupportBarProps {
  companyId: string;
  companyName: string;
  companyRfc: string;
  ownerEmail?: string | null;
  onCloseDrawer: () => void;
}

export function AdminCompanySupportBar({
  companyId,
  companyName,
  companyRfc,
  ownerEmail,
  onCloseDrawer
}: AdminCompanySupportBarProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const supportSession = useSupportSession();
  const [supportLogged, setSupportLogged] = useState(false);
  const [enteringSupport, setEnteringSupport] = useState(false);

  const isActiveSupportForCompany = supportSession?.companyId === companyId;

  useEffect(() => {
    setSupportLogged(false);
  }, [companyId]);

  const inspectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.recordAdminAuditLog({
        action: 'INSPECT_TENANT',
        targetType: 'company',
        targetId: companyId,
        metadata: { rfc: companyRfc, name: companyName }
      });
    },
    onSuccess: () => {
      setSupportLogged(true);
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
      toast.success('Inspección registrada en auditoría', 'El evento Modo Soporte quedó asentado en la bitácora.');
    },
    onError: (err: unknown) => toast.error('Error al registrar inspección', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const isBusy = inspectMutation.isPending || enteringSupport;

  const handleOpenSupportView = async () => {
    if (isBusy || isActiveSupportForCompany) return;
    setEnteringSupport(true);
    try {
      await apiClient.recordAdminAuditLog({
        action: 'START_SUPPORT_IMPERSONATION',
        targetType: 'company',
        targetId: companyId,
        metadata: { rfc: companyRfc, name: companyName, ownerEmail: ownerEmail ?? null }
      });
    } catch {
      toast.warning(
        'Modo Soporte abierto sin registro en bitácora',
        'No se pudo guardar el evento de auditoría previo; la vista continúa en solo lectura.'
      );
    }
    startSupportSession({
      companyId,
      companyName,
      companyRfc,
      ownerEmail: ownerEmail ?? undefined
    });
    void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
    setEnteringSupport(false);
    onCloseDrawer();
    void navigate({ to: '/' });
  };

  return (
    <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-xs space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-blue-950 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-700" aria-hidden="true" />
            Modo Soporte en Vivo y Trazabilidad
          </p>
          {isActiveSupportForCompany && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" aria-hidden="true" />
              Sesión activa en esta empresa
            </span>
          )}
        </div>
        <p className="text-blue-900/80">
          Abre las vistas del cliente bloqueando escrituras y registrando el acceso en auditoría.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={isBusy}
          aria-busy={inspectMutation.isPending}
          title={isBusy ? 'Acción de soporte en curso...' : 'Asentar en bitácora la inspección administrativa sin cambiar de pantalla'}
          onClick={() => inspectMutation.mutate()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-300 bg-white hover:bg-blue-100 text-blue-900 text-xs font-bold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {inspectMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : supportLogged ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{supportLogged ? 'Registrada' : 'Registrar en bitácora'}</span>
        </button>
        <button
          type="button"
          disabled={isBusy || isActiveSupportForCompany}
          aria-busy={enteringSupport}
          title={
            isActiveSupportForCompany
              ? 'Ya tienes abierta una sesión de soporte en esta empresa'
              : isBusy
                ? 'Acción de soporte en curso...'
                : 'Abrir las vistas contables del cliente en Modo Soporte de solo lectura'
          }
          onClick={() => void handleOpenSupportView()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition cursor-pointer"
        >
          {enteringSupport ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{isActiveSupportForCompany ? 'Modo Soporte Activo' : 'Abrir en Modo Soporte'}</span>
        </button>
      </div>
    </div>
  );
}

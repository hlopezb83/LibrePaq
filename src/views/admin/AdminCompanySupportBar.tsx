import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Eye, Loader2, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { startSupportSession } from '../../lib/support-impersonation';
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
  const [supportLogged, setSupportLogged] = useState(false);
  const [enteringSupport, setEnteringSupport] = useState(false);

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

  const handleOpenSupportView = async () => {
    if (enteringSupport) return;
    setEnteringSupport(true);
    try {
      await apiClient.recordAdminAuditLog({
        action: 'START_SUPPORT_IMPERSONATION',
        targetType: 'company',
        targetId: companyId,
        metadata: { rfc: companyRfc, name: companyName, ownerEmail: ownerEmail ?? null }
      });
    } catch { /* best-effort audit */ }
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
      <div className="text-xs">
        <p className="font-bold text-blue-950 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-700" aria-hidden="true" />
          Modo Soporte en Vivo y Trazabilidad
        </p>
        <p className="text-blue-900/80 mt-0.5">
          Abre las vistas del cliente bloqueando escrituras y registrando el acceso en auditoría.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={inspectMutation.isPending}
          aria-busy={inspectMutation.isPending}
          onClick={() => inspectMutation.mutate()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-300 bg-white hover:bg-blue-100 text-blue-900 text-xs font-bold transition cursor-pointer disabled:opacity-60"
        >
          {inspectMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : supportLogged ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>{supportLogged ? 'Registrada' : 'Solo Registrar'}</span>
        </button>
        <button
          type="button"
          disabled={enteringSupport}
          aria-busy={enteringSupport}
          onClick={() => void handleOpenSupportView()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer"
        >
          {enteringSupport ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>Abrir en Modo Soporte</span>
        </button>
      </div>
    </div>
  );
}

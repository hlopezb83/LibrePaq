import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../lib/api-client';
import type { PlatformAlertStatus, PlatformRole } from '../../shared/admin-types';
import { ADMIN_ROLE_OPTIONS } from './adminFormatters';

export function useSuperAdminMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidateAuditAndUsers = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-users-paginated'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
  };

  const updateUserStatusMutation = useMutation({
    mutationFn: (v: { userId: string; status: 'ACTIVO' | 'SUSPENDIDO'; reason?: string }) =>
      apiClient.setAdminUserStatus(v.userId, { status: v.status, reason: v.reason }),
    onSuccess: (res) => {
      invalidateAuditAndUsers();
      toast.success(
        res.status === 'SUSPENDIDO' ? 'Usuario suspendido' : 'Usuario reactivado',
        res.status === 'SUSPENDIDO' ? 'Acceso bloqueado para esta cuenta.' : 'La cuenta puede iniciar sesión nuevamente.'
      );
    },
    onError: (err: unknown) =>
      toast.error('No se pudo actualizar el usuario', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: (v: { userId: string; platformRole: PlatformRole }) => apiClient.setAdminUserRole(v.userId, v.platformRole),
    onSuccess: (res) => {
      invalidateAuditAndUsers();
      const roleLabel = ADMIN_ROLE_OPTIONS.find((opt) => opt.value === res.platformRole)?.label ?? res.platformRole;
      toast.success('Rol de plataforma actualizado', `Nuevo rol asignado: ${roleLabel}`);
    },
    onError: (err: unknown) =>
      toast.error('No se pudo actualizar el rol', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: (companyId: string) => apiClient.deleteAdminCompany(companyId),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-companies-paginated'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      invalidateAuditAndUsers();
      void queryClient.removeQueries({ queryKey: ['admin-company-detail', res.companyId] });
      toast.success('Empresa eliminada', 'La empresa fiscal y sus registros han sido depurados.');
    },
    onError: (err: unknown) =>
      toast.error('No se pudo eliminar la empresa', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const scanAlertsMutation = useMutation({
    mutationFn: () => apiClient.runAdminHealthScan(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sat-health'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
      toast.success('Escaneo de salud completado', `${res.alertsCreated} alertas nuevas · ${res.openAlertsCount} abiertas.`);
    },
    onError: (err: unknown) =>
      toast.error('Error al ejecutar escaneo', err instanceof Error ? err.message : 'Error inesperado.')
  });

  const updateAlertStatusMutation = useMutation({
    mutationFn: (v: { alertId: string; status: PlatformAlertStatus }) =>
      apiClient.updateAdminPlatformAlertStatus(v.alertId, v.status),
    onSuccess: (_res, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
      const label =
        vars.status === 'resolved'
          ? 'La alerta quedó marcada como resuelta.'
          : vars.status === 'acknowledged'
            ? 'La alerta quedó marcada como reconocida.'
            : 'La alerta fue reabierta para seguimiento.';
      toast.success('Estatus de alerta actualizado', label);
    },
    onError: (err: unknown) =>
      toast.error('Error al actualizar alerta', err instanceof Error ? err.message : 'Error inesperado.')
  });

  return {
    updateUserStatusMutation,
    updateUserRoleMutation,
    deleteCompanyMutation,
    scanAlertsMutation,
    updateAlertStatusMutation
  };
}

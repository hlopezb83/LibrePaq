import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { endSupportSession } from '../../lib/support-impersonation';
import type { SupportImpersonationSession } from '../../shared/admin-types';

interface UseSupportModeExitParams {
  supportSession: SupportImpersonationSession | null;
  isReadOnlySupportMode: boolean;
  currentPath: string;
  authLoading: boolean;
  queryClient: QueryClient;
  navigateToCompanies: () => void;
}

/**
 * Encapsula la salida manual y automática del Modo Soporte cuando el administrador
 * regresa a /admin, evitando bucles infinitos o doble registro de auditoría.
 */
export function useSupportModeExit({
  supportSession,
  isReadOnlySupportMode,
  currentPath,
  authLoading,
  queryClient,
  navigateToCompanies
}: UseSupportModeExitParams) {
  const [isExitingSupport, setIsExitingSupport] = useState(false);
  const exitingSupportRef = useRef(false);
  const prevPathRef = useRef<string | null>(null);
  const autoEndedSupportKeyRef = useRef<string | null>(null);
  const wasNullOnAdminRef = useRef(false);

  const exitSupportMode = useCallback(
    async (redirectToCompanies: boolean) => {
      if (!supportSession || exitingSupportRef.current) return;
      exitingSupportRef.current = true;
      setIsExitingSupport(true);
      try {
        await apiClient.recordAdminAuditLog({
          action: 'END_SUPPORT_IMPERSONATION',
          targetType: 'company',
          targetId: supportSession.companyId,
          metadata: { rfc: supportSession.companyRfc, name: supportSession.companyName }
        });
      } catch {
        // best-effort audit
      } finally {
        endSupportSession();
        void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] });
        exitingSupportRef.current = false;
        setIsExitingSupport(false);
        if (redirectToCompanies) navigateToCompanies();
      }
    },
    [supportSession, queryClient, navigateToCompanies]
  );

  const handleExitSupportMode = useCallback(() => exitSupportMode(true), [exitSupportMode]);

  useEffect(() => {
    if (authLoading) return;
    const prevPath = prevPathRef.current;
    prevPathRef.current = currentPath;
    if (!currentPath.startsWith('/admin')) {
      autoEndedSupportKeyRef.current = null;
      wasNullOnAdminRef.current = false;
      return;
    }
    if (!supportSession) {
      wasNullOnAdminRef.current = true;
      return;
    }
    if (!isReadOnlySupportMode || exitingSupportRef.current) return;
    if (prevPath?.startsWith('/admin') && wasNullOnAdminRef.current) return;
    const sessionKey = `${supportSession.companyId}:${supportSession.startedAt}`;
    if (autoEndedSupportKeyRef.current === sessionKey) return;
    autoEndedSupportKeyRef.current = sessionKey;
    void exitSupportMode(false);
  }, [authLoading, currentPath, isReadOnlySupportMode, supportSession, exitSupportMode]);

  return { isExitingSupport, handleExitSupportMode };
}

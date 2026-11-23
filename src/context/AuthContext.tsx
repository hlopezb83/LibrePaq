import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { toast as sonnerToast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setApiAuthUser } from '../lib/api/api-helpers';
import { captureAdAttributionOnLanding, trackAnalyticsEvent } from '../lib/analytics';
import { endSupportSession } from '../lib/support-impersonation';
import {
  getSuperAdminEmails,
  hasPlatformAdminAccess,
  isSuperAdminEmail,
  normalizePlatformRole
} from '../shared/superadmin';
import type { PlatformRole } from '../shared/admin-types';

export const SUPERADMIN_EMAILS = getSuperAdminEmails();
export const GUEST_DEMO_KEY = 'librepaq_guest_demo_active';

const SUSPENDED_ACCOUNT_MESSAGE =
  'Tu cuenta ha sido suspendida por un administrador. Contacta a soporte para reactivar tu acceso.';

export const GUEST_DEMO_USER: User = {
  id: 'usr_guest_demo',
  app_metadata: { provider: 'guest_demo' },
  user_metadata: {
    full_name: 'Demostración en Vivo',
    workspace_name: 'Despacho Contable (Demo)',
    workspace_id: 'ws_demo',
    is_guest: true
  },
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@librepaq.com',
  created_at: new Date().toISOString()
};

export function checkIsSuperAdmin(user: User | null): boolean {
  if (!user || user.user_metadata?.is_guest) return false;
  if (isSuperAdminEmail(user.email)) return true;
  return user.app_metadata?.role === 'superadmin';
}

interface UserAccessCheck {
  suspended: boolean;
  platformRole: PlatformRole;
}

async function fetchUserAccessCheck(sessionUser: User): Promise<UserAccessCheck> {
  const fallbackRole = normalizePlatformRole(
    String(sessionUser.app_metadata?.platform_role || ''),
    sessionUser.app_metadata?.role === 'superadmin',
    sessionUser.email
  );
  if (sessionUser.user_metadata?.is_guest) return { suspended: false, platformRole: 'NONE' };
  if (!supabase || !isSupabaseConfigured || typeof supabase.from !== 'function') {
    return { suspended: false, platformRole: fallbackRole };
  }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('status, platform_role, is_superadmin')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (error || !data) return { suspended: false, platformRole: fallbackRole };
    const row = data as { status?: unknown; platform_role?: unknown; is_superadmin?: unknown };
    const role = normalizePlatformRole(
      row.platform_role ? String(row.platform_role) : null,
      Boolean(row.is_superadmin) || sessionUser.app_metadata?.role === 'superadmin',
      sessionUser.email
    );
    const suspended = role !== 'SUPERADMIN' && String(row.status ?? '').toUpperCase() === 'SUSPENDIDO';
    return { suspended, platformRole: role };
  } catch {
    return { suspended: false, platformRole: fallbackRole };
  }
}

function notifySuspendedAccount(): void {
  try {
    if (typeof window !== 'undefined') {
      sonnerToast.error('Cuenta suspendida', {
        description: SUSPENDED_ACCOUNT_MESSAGE,
        duration: 10000
      });
    }
  } catch {
    // Ignorar en entornos sin DOM/Toaster
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  isSuperAdmin: boolean;
  platformRole: PlatformRole;
  hasAdminAccess: boolean;
  isGuest: boolean;
  isSuspended: boolean;
  suspendedMessage: string | null;
  startGuestDemo: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<{ error: Error | null; data?: { user: User | null; session?: Session | null } }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [platformRole, setPlatformRole] = useState<PlatformRole>('NONE');
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);
  const authCheckSeqRef = useRef(0);

  const clearSuspension = useCallback(() => {
    setIsSuspended(false);
    setSuspendedMessage(null);
  }, []);

  const enforceSuspension = useCallback(
    async (client: NonNullable<typeof supabase>) => {
      setIsSuspended(true);
      setSuspendedMessage(SUSPENDED_ACCOUNT_MESSAGE);
      setPlatformRole('NONE');
      setSession(null);
      setUser(null);
      setApiAuthUser(null);
      queryClient.clear();
      try {
        await client.auth.signOut();
      } catch {
        // Ignorar error de cierre de sesión suspendida
      }
      notifySuspendedAccount();
    },
    [queryClient]
  );

  useEffect(() => {
    captureAdAttributionOnLanding();
    const isGuestActive = localStorage.getItem(GUEST_DEMO_KEY) === 'true';

    const activateGuestDemo = () => {
      setPlatformRole('NONE');
      setUser(GUEST_DEMO_USER);
      setApiAuthUser(GUEST_DEMO_USER);
    };

    if (!supabase || !isSupabaseConfigured) {
      if (isGuestActive) activateGuestDemo();
      setPlatformRole('NONE');
      setLoading(false);
      return;
    }

    const client = supabase;
    let isMounted = true;

    const commitSession = (activeSession: Session, role: PlatformRole) => {
      const wasGuest = localStorage.getItem(GUEST_DEMO_KEY) === 'true';
      localStorage.removeItem(GUEST_DEMO_KEY);
      if (wasGuest) queryClient.clear();
      clearSuspension();
      setPlatformRole(role);
      setSession(activeSession);
      setUser(activeSession.user);
      setApiAuthUser(activeSession.user, activeSession.access_token);
      setLoading(false);
    };

    const applyAuthenticatedSession = async (activeSession: Session, seq: number) => {
      const access = await fetchUserAccessCheck(activeSession.user);
      if (!isMounted || seq !== authCheckSeqRef.current) return;
      if (access.suspended) {
        await enforceSuspension(client);
        if (isMounted && seq === authCheckSeqRef.current) setLoading(false);
        return;
      }
      commitSession(activeSession, access.platformRole);
    };

    const initialSeq = ++authCheckSeqRef.current;
    client.auth
      .getSession()
      .then(async ({ data: { session: initialSession } }) => {
        if (!isMounted || initialSeq !== authCheckSeqRef.current) return;
        if (initialSession?.user && !initialSession.user.user_metadata?.is_guest) {
          await applyAuthenticatedSession(initialSession, initialSeq);
          return;
        }
        if (initialSession?.user) {
          commitSession(initialSession, 'NONE');
          return;
        }
        if (isGuestActive) activateGuestDemo();
        setLoading(false);
      })
      .catch((err) => {
        console.error('[AuthContext] Error al recuperar sesión inicial:', err);
        if (!isMounted || initialSeq !== authCheckSeqRef.current) return;
        if (isGuestActive) activateGuestDemo();
        setLoading(false);
      });

    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      const seq = ++authCheckSeqRef.current;
      if (nextSession?.user && !nextSession.user.user_metadata?.is_guest) {
        if (event !== 'TOKEN_REFRESHED') setLoading(true);
        setTimeout(() => {
          if (!isMounted || seq !== authCheckSeqRef.current) return;
          void applyAuthenticatedSession(nextSession, seq).catch(() => {
            if (isMounted && seq === authCheckSeqRef.current) setLoading(false);
          });
        }, 0);
        return;
      }

      if (nextSession?.user) {
        commitSession(nextSession, 'NONE');
        return;
      }
      if (localStorage.getItem(GUEST_DEMO_KEY) === 'true') {
        activateGuestDemo();
      } else if (event === 'SIGNED_OUT') {
        endSupportSession();
        setPlatformRole('NONE');
        setSession(null);
        setUser(null);
        setApiAuthUser(null);
        queryClient.clear();
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient, enforceSuspension, clearSuspension]);

  const startGuestDemo = useCallback(async () => {
    clearSuspension();
    try {
      const { provisionSandboxDemoCompany } = await import('../lib/sandbox-demo-seeder');
      await provisionSandboxDemoCompany();
    } catch { /* demo company already exists */ }
    localStorage.setItem(GUEST_DEMO_KEY, 'true');
    setUser(GUEST_DEMO_USER);
    setApiAuthUser(GUEST_DEMO_USER);
    void queryClient.invalidateQueries({ queryKey: ['companies'] });
    trackAnalyticsEvent('start_guest_demo', { location: 'landing' });
  }, [queryClient, clearSuspension]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase no está configurado') };
    clearSuspension();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, [clearSuspension]);

  const signUpWithEmail = useCallback(async (email: string, password: string, fullName?: string) => {
    if (!supabase) return { error: new Error('Supabase no está configurado') };
    clearSuspension();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: fullName || email.split('@')[0] } }
    });
    return { data, error };
  }, [clearSuspension]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: new Error('Supabase no está configurado') };
    clearSuspension();
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    return { error };
  }, [clearSuspension]);

  const signOut = useCallback(async () => {
    clearSuspension();
    localStorage.removeItem(GUEST_DEMO_KEY);
    endSupportSession();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('librepaq_') && key !== 'librepaq_theme') localStorage.removeItem(key);
      }
      if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
    } catch { /* Ignore storage errors in restricted contexts */ }
    void queryClient.cancelQueries();
    queryClient.clear();
    try {
      if (supabase) await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setApiAuthUser(null);
      queryClient.clear();
    }
    return { error: null };
  }, [queryClient, clearSuspension]);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return { error: new Error('Supabase no está configurado') };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    return { error };
  }, []);

  const isSuperAdmin = useMemo(() => checkIsSuperAdmin(user) || platformRole === 'SUPERADMIN', [user, platformRole]);
  const hasAdminAccess = useMemo(() => isSuperAdmin || hasPlatformAdminAccess(platformRole), [isSuperAdmin, platformRole]);
  const isGuest = useMemo(() => Boolean(user?.user_metadata?.is_guest), [user]);

  const value = useMemo(
    () => ({
      user, session, loading, isConfigured: isSupabaseConfigured,
      isSuperAdmin, platformRole, hasAdminAccess, isGuest, isSuspended, suspendedMessage,
      startGuestDemo, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPassword
    }),
    [user, session, loading, isSuperAdmin, platformRole, hasAdminAccess, isGuest, isSuspended, suspendedMessage, startGuestDemo, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  return context;
}

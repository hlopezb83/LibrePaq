import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { toast as sonnerToast } from 'sonner';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { setApiAuthUser } from '../lib/api/api-helpers';
import { captureAdAttributionOnLanding, trackAnalyticsEvent } from '../lib/analytics';
import { getSuperAdminEmails, isSuperAdminEmail } from '../shared/superadmin';

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

async function checkIfUserSuspended(sessionUser: User): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured || typeof supabase.from !== 'function') return false;
  if (sessionUser.user_metadata?.is_guest || checkIsSuperAdmin(sessionUser)) return false;

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('status')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (error || !data) return false;
    return String((data as { status?: unknown }).status ?? '').toUpperCase() === 'SUSPENDIDO';
  } catch {
    return false;
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
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);

  const enforceSuspension = useCallback(
    async (client: NonNullable<typeof supabase>) => {
      setIsSuspended(true);
      setSuspendedMessage(SUSPENDED_ACCOUNT_MESSAGE);
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

    if (!supabase || !isSupabaseConfigured) {
      if (isGuestActive) {
        setUser(GUEST_DEMO_USER);
        setApiAuthUser(GUEST_DEMO_USER);
      }
      setLoading(false);
      return;
    }

    const client = supabase;

    client.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (session?.user) {
          if (await checkIfUserSuspended(session.user)) {
            await enforceSuspension(client);
            return;
          }
          setIsSuspended(false);
          setSuspendedMessage(null);
          localStorage.removeItem(GUEST_DEMO_KEY);
          setSession(session);
          setUser(session.user);
          setApiAuthUser(session.user, session.access_token);
        } else if (isGuestActive) {
          setUser(GUEST_DEMO_USER);
          setApiAuthUser(GUEST_DEMO_USER);
        }
      })
      .catch((err) => {
        console.error('[AuthContext] Error al recuperar sesión inicial:', err);
        if (isGuestActive) {
          setUser(GUEST_DEMO_USER);
          setApiAuthUser(GUEST_DEMO_USER);
        }
      })
      .finally(() => setLoading(false));

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const wasGuest = localStorage.getItem(GUEST_DEMO_KEY) === 'true';
        localStorage.removeItem(GUEST_DEMO_KEY);
        if (wasGuest) queryClient.clear();
        setIsSuspended(false);
        setSuspendedMessage(null);
        setSession(session);
        setUser(session.user);
        setApiAuthUser(session.user, session.access_token);

        if (!checkIsSuperAdmin(session.user) && !session.user.user_metadata?.is_guest) {
          const activeUser = session.user;
          setTimeout(() => {
            void checkIfUserSuspended(activeUser).then((suspended) => {
              if (suspended) void enforceSuspension(client);
            });
          }, 0);
        }
      } else if (localStorage.getItem(GUEST_DEMO_KEY) === 'true') {
        setUser(GUEST_DEMO_USER);
        setApiAuthUser(GUEST_DEMO_USER);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setApiAuthUser(null);
        queryClient.clear();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient, enforceSuspension]);

  const startGuestDemo = useCallback(async () => {
    setIsSuspended(false);
    setSuspendedMessage(null);
    try {
      const { provisionSandboxDemoCompany } = await import('../lib/sandbox-demo-seeder');
      await provisionSandboxDemoCompany();
    } catch {
      // Si la empresa de ejemplo ya existía, se continúa normalmente
    }
    localStorage.setItem(GUEST_DEMO_KEY, 'true');
    setUser(GUEST_DEMO_USER);
    setApiAuthUser(GUEST_DEMO_USER);
    void queryClient.invalidateQueries({ queryKey: ['companies'] });
    trackAnalyticsEvent('start_guest_demo', { location: 'landing' });
  }, [queryClient]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase no está configurado') };
    setIsSuspended(false);
    setSuspendedMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, fullName?: string) => {
    if (!supabase) return { error: new Error('Supabase no está configurado') };
    setIsSuspended(false);
    setSuspendedMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName || email.split('@')[0] }
      }
    });
    return { data, error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: new Error('Supabase no está configurado') };
    setIsSuspended(false);
    setSuspendedMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    setIsSuspended(false);
    setSuspendedMessage(null);
    localStorage.removeItem(GUEST_DEMO_KEY);
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('librepaq_') && key !== 'librepaq_theme') {
          localStorage.removeItem(key);
        }
      }
      if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
    } catch {
      // Ignore storage errors in restricted contexts
    }
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
  }, [queryClient]);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return { error: new Error('Supabase no está configurado') };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return { error };
  }, []);

  const isSuperAdmin = useMemo(() => checkIsSuperAdmin(user), [user]);
  const isGuest = useMemo(() => Boolean(user?.user_metadata?.is_guest), [user]);

  const value = useMemo(
    () => ({
      user, session, loading, isConfigured: isSupabaseConfigured,
      isSuperAdmin, isGuest, isSuspended, suspendedMessage,
      startGuestDemo, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPassword
    }),
    [user, session, loading, isSuperAdmin, isGuest, isSuspended, suspendedMessage, startGuestDemo, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  return context;
}

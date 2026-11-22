export async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `Error HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType && !contentType.includes('application/json')) {
    throw new Error(
      `Servidor no devolvió JSON (recibido ${contentType}). Endpoint no disponible.`
    );
  }
  return res.json() as Promise<T>;
}

export const DEFAULT_API_TIMEOUT_MS = 25000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_API_TIMEOUT_MS
): Promise<Response> {
  let signal = init?.signal;
  if (!signal && typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    signal = AbortSignal.timeout(timeoutMs);
  }
  return fetch(input, {
    ...init,
    signal: signal ?? init?.signal
  });
}

export function buildPeriodQuery(companyId: string, year?: number, period?: number): string {
  const params = new URLSearchParams({ companyId });
  if (year) params.set('year', String(year));
  if (period) params.set('period', String(period));
  return params.toString();
}

let activeUser: { id: string; email?: string; fullName?: string; accessToken?: string } | null = null;

export function setApiAuthUser(
  user: { id: string; email?: string; user_metadata?: { full_name?: string } } | null,
  accessToken?: string
): void {
  if (!user) {
    activeUser = null;
  } else {
    activeUser = {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name,
      accessToken
    };
  }
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (activeUser?.id) {
    headers['X-User-Id'] = activeUser.id;
    if (activeUser.email) headers['X-User-Email'] = activeUser.email;
    if (activeUser.fullName) headers['X-User-Name'] = activeUser.fullName;
    if (activeUser.accessToken) headers['Authorization'] = `Bearer ${activeUser.accessToken}`;
    return headers;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            const user = parsed?.user;
            if (parsed?.access_token) {
              headers['Authorization'] = `Bearer ${parsed.access_token}`;
            }
            if (user?.id) {
              headers['X-User-Id'] = user.id;
              if (user.email) headers['X-User-Email'] = user.email;
              if (user.user_metadata?.full_name) {
                headers['X-User-Name'] = user.user_metadata.full_name;
              }
              break;
            }
          }
        }
      }
    }
  } catch {
    // Ignorar errores de acceso a almacenamiento
  }

  return headers;
}

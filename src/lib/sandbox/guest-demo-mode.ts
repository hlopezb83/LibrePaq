const GUEST_DEMO_STORAGE_KEY = 'librepaq_guest_demo_active';

let guestDemoEnabled = false;

export function setGuestDemoMode(enabled: boolean): void {
  guestDemoEnabled = enabled;
  if (!enabled && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(GUEST_DEMO_STORAGE_KEY);
    } catch {
      // Ignorar errores de almacenamiento en contextos restringidos
    }
  }
}

export function isGuestDemoMode(): boolean {
  if (guestDemoEnabled) return true;
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(GUEST_DEMO_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

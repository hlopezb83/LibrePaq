/**
 * Traductor amigable de errores de autenticación y red.
 * Convierte mensajes técnicos en inglés en lenguaje claro y profesional para contadores.
 */
export function translateAuthError(rawMessage: string): string {
  const msg = rawMessage.toLowerCase();

  if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('invalid_grant')) {
    return 'Correo o contraseña incorrectos. Si eres nuevo, pulsa «Crear Cuenta Gratis».';
  }
  if (msg.includes('user not found')) {
    return 'No encontramos una cuenta registrada con ese correo electrónico.';
  }
  if (msg.includes('already registered') || msg.includes('user already exists')) {
    return 'Este correo ya tiene una cuenta registrada. Pulsa «Iniciar Sesión» o recupera tu contraseña.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada o carpeta de Spam.';
  }
  if (msg.includes('signup disabled') || msg.includes('signups not allowed')) {
    return 'El registro de nuevas cuentas está temporalmente deshabilitado.';
  }
  if (msg.includes('same password') || msg.includes('should be different')) {
    return 'La nueva contraseña debe ser distinta a la contraseña actual.';
  }
  if (msg.includes('password should be at least') || msg.includes('weak password') || msg.includes('weak_password')) {
    return 'Por seguridad fiscal, la contraseña debe tener al menos 6 caracteres.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('once every')) {
    return 'Demasiados intentos seguidos. Por seguridad, espera 60 segundos antes de reintentar.';
  }
  if (msg.includes('invalid format') || msg.includes('valid email')) {
    return 'El formato de correo no es válido. Ingresa uno como contador@despacho.mx';
  }
  if (msg.includes('expired') || msg.includes('invalid token') || msg.includes('session_not_found')) {
    return 'El enlace o sesión expiró. Inicia sesión o solicita un nuevo enlace.';
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) {
    return 'La solicitud tardó demasiado. Verifica tu conexión e inténtalo de nuevo.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet.';
  }
  if (msg.includes('popup closed') || msg.includes('cancelled')) {
    return 'El inicio de sesión con Google fue cancelado antes de completarse.';
  }
  if (msg.includes('supabase') || msg.includes('not configured')) {
    return 'El servicio de acceso en la nube no está disponible en este momento.';
  }

  return rawMessage;
}

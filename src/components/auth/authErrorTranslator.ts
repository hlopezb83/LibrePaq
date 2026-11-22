/**
 * Traductor amigable de errores de autenticación (Supabase / Red)
 * Convierte mensajes técnicos en inglés en lenguaje claro y profesional para contadores.
 */
export function translateAuthError(rawMessage: string): string {
  const msg = rawMessage.toLowerCase();

  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return 'Correo o contraseña incorrectos. Si eres nuevo, pulsa «Crear Cuenta Gratis».';
  }
  if (msg.includes('already registered') || msg.includes('user already exists')) {
    return 'Este correo ya tiene una cuenta registrada. Pulsa «Iniciar Sesión» o recupera tu contraseña.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada o carpeta de Spam.';
  }
  if (msg.includes('password should be at least') || msg.includes('weak password')) {
    return 'Por seguridad fiscal, la contraseña debe tener al menos 6 caracteres.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('once every')) {
    return 'Demasiados intentos seguidos. Por seguridad, espera 60 segundos antes de reintentar.';
  }
  if (msg.includes('invalid format') || msg.includes('valid email')) {
    return 'El formato de correo no es válido. Ingresa uno como contador@despacho.mx';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet.';
  }
  if (msg.includes('popup closed') || msg.includes('cancelled')) {
    return 'El inicio de sesión con Google fue cancelado antes de completarse.';
  }

  return rawMessage;
}

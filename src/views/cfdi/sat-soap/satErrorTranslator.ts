export interface SatErrorTranslation {
  code: string;
  shortLabel: string;
  title: string;
  explanation: string;
  hint: string;
}

const SAT_ERROR_DICTIONARY: Record<string, Omit<SatErrorTranslation, 'code'>> = {
  '300': {
    shortLabel: 'Usuario o FIEL no válidos (300)',
    title: 'Autenticación rechazada por el SAT (Código 300)',
    explanation: 'El SAT no pudo validar la firma electrónica o el token de sesión.',
    hint: 'Verifica que la contraseña de tu clave privada (.key) y el archivo .cer correspondan entre sí y vuelve a guardar tu e.firma.'
  },
  '301': {
    shortLabel: 'Fecha futura o XML inválido (301)',
    title: 'Rango de fechas o estructura XML rechazada (Código 301)',
    explanation: 'La fecha final solicitada supera la fecha actual del servidor SAT o la petición SOAP tiene un parámetro fuera de rango.',
    hint: 'Asegúrate de que la Fecha Final no sea posterior a hoy ni anterior a la Fecha Inicial.'
  },
  '302': {
    shortLabel: 'Sello inválido (302)',
    title: 'Sello digital de la petición inválido (Código 302)',
    explanation: 'La firma criptográfica generada con la llave privada no coincidió con el certificado cargado.',
    hint: 'Vuelve a cargar el par .cer + .key original de tu e.firma y verifica tu contraseña.'
  },
  '303': {
    shortLabel: 'Certificado no es FIEL (303)',
    title: 'El certificado no corresponde a una e.firma (Código 303)',
    explanation: 'Es posible que hayas cargado un Certificado de Sello Digital (CSD) en lugar de tu e.firma (FIEL).',
    hint: 'Para descargar facturas del SAT debes usar tu e.firma (FIEL), no tu CSD de facturación.'
  },
  '304': {
    shortLabel: 'FIEL revocada o caduca (304)',
    title: 'Certificado e.firma revocado o vencido (Código 304)',
    explanation: 'El certificado X.509 de la empresa expiró o fue revocado ante el SAT.',
    hint: 'Renueva tu e.firma en el portal del SAT o Certifica y carga los nuevos archivos.'
  },
  '305': {
    shortLabel: 'FIEL caduca / fecha inválida (305)',
    title: 'Certificado e.firma fuera de vigencia (Código 305)',
    explanation: 'La fecha de vigencia de tu certificado e.firma ya expiró o aún no inicia según el reloj oficial del SAT.',
    hint: 'Revisa la fecha de vencimiento de tu archivo .cer y actualiza tu e.firma vigente.'
  },
  '5': {
    shortLabel: 'Solicitud duplicada o rechazada (5)',
    title: 'Solicitud ya atendida o rechazada por el SAT (Código 5)',
    explanation: 'El SAT rechaza solicitudes repetidas para el mismo rango de fechas y tipo cuando ya existe una petición reciente.',
    hint: 'Si tus comprobantes ya están en Bóveda ADD no repitas la descarga; si necesitas facturas de hoy, ajusta el rango de fechas.'
  },
  '5000': {
    shortLabel: 'Solicitud recibida (5000)',
    title: 'Solicitud aceptada por el SAT (Código 5000)',
    explanation: 'La petición fue recibida correctamente por el Web Service del SAT.',
    hint: 'Espera unos minutos y presiona "Comprobar con el SAT" para descargar los paquetes.'
  },
  '5001': {
    shortLabel: 'Tercero no autorizado / RFC distinto (5001)',
    title: 'RFC del certificado no coincide con la empresa (Código 5001)',
    explanation: 'El RFC titular de la e.firma cargada no corresponde al RFC de la empresa activa en el ERP.',
    hint: 'Verifica que estés cargando los archivos .cer y .key de la misma razón social.'
  },
  '5002': {
    shortLabel: 'Límite de solicitudes / duplicada (5002)',
    title: 'Límite de solicitudes similares alcanzado (Código 5002)',
    explanation: 'El SAT limita el número de solicitudes idénticas para el mismo rango y tipo de comprobantes.',
    hint: 'Usa la bitácora inferior para verificar tus solicitudes previas o ajusta el rango de fechas.'
  },
  '5003': {
    shortLabel: 'Excede límite de 200 mil CFDIs (5003)',
    title: 'El rango excede el límite máximo de comprobantes (Código 5003)',
    explanation: 'La consulta supera el tope máximo permitido por el SAT en una sola petición.',
    hint: 'Divide tu descarga en quincenas o semanas usando los selectores de fecha.'
  },
  '5004': {
    shortLabel: 'Sin CFDIs en el rango (5004)',
    title: 'No se encontraron comprobantes en el rango (Código 5004)',
    explanation: 'El SAT confirmó que no existen facturas emitidas o recibidas registradas en esas fechas.',
    hint: 'Verifica el rango de fechas o cambia entre Emitidas y Recibidas.'
  },
  '5005': {
    shortLabel: 'Solicitud ya registrada (5005)',
    title: 'Ya existe una solicitud vigente para este rango (Código 5005)',
    explanation: 'El SAT detectó una solicitud en proceso o recién atendida con los mismos parámetros.',
    hint: 'Consulta la bitácora de solicitudes y presiona "Comprobar con el SAT".'
  },
  '404': {
    shortLabel: 'Servicio SAT no disponible (404)',
    title: 'Servicio del SAT temporalmente no disponible (404)',
    explanation: 'No se pudo localizar el paquete o el servicio del SAT está en mantenimiento.',
    hint: 'Intenta nuevamente en unos minutos o sube tus archivos XML manualmente.'
  }
};

export function translateSatErrorCode(
  rawCode?: string | null,
  fallbackMessage?: string | null
): SatErrorTranslation {
  const cleaned = String(rawCode || '').trim().replace(/^SAT\s*C[oó]digo\s*/i, '');
  const match = cleaned.match(/\b(\d{1,4})\b/);
  const code = match?.[1] || cleaned || '5';
  const entry = SAT_ERROR_DICTIONARY[code];
  if (entry) {
    return { code, ...entry };
  }
  return {
    code,
    shortLabel: `Rechazada (${code})`,
    title: `Respuesta del SAT (Código ${code})`,
    explanation:
      fallbackMessage ||
      'El servicio de Descarga Masiva del SAT devolvió una advertencia para esta solicitud.',
    hint: 'Puedes ajustar el rango de fechas, comprobar la vigencia de tu e.firma o arrastrar tus XML manualmente.'
  };
}

export function getSatDownloadDisabledReason(params: {
  isReadOnlyClient: boolean;
  hasCredentials: boolean;
  activePendingId?: string;
  isDateRangeInvalid: boolean;
  isPending: boolean;
}): string | undefined {
  if (params.isReadOnlyClient) return 'Modo solo lectura: descarga SAT deshabilitada';
  if (!params.hasCredentials) return 'Conecta y valida tu e.firma (.cer y .key) primero';
  if (params.activePendingId) {
    return `Ya existe una solicitud en curso (${params.activePendingId.slice(0, 8)}...)`;
  }
  if (params.isDateRangeInvalid) {
    return 'Corrige el rango de fechas: la fecha inicial es posterior a la final';
  }
  if (params.isPending) return 'Transmitiendo solicitud firmada al SAT...';
  return undefined;
}

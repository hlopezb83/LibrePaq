import type { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildSatAutenticaSoapXml,
  decryptPrivateKeyIfNeeded
} from './crypto-helpers.ts';

export type SupabaseClient = ReturnType<typeof createClient>;

export interface SatRequestPayload {
  action?: 'store-fiel' | 'solicita-descarga' | 'verifica-descarga';
  companyId: string;
  passphrase?: string;
  cerBase64?: string;
  keyBase64?: string;
  companyRfc?: string;
  companyName?: string;
  tipoSolicitud?: 'RECIBIDOS' | 'EMITIDOS' | 'AMBOS';
  fechaInicial?: string;
  fechaFinal?: string;
  modoEjecucion?: 'SAT_LIVE' | 'SANDBOX_CRYPTO';
  idSolicitudSat?: string;
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

export async function getSatAuthToken(cerBase64: string, privateKeyPem: string): Promise<string> {
  const { soapXml } = buildSatAutenticaSoapXml({
    certificateBase64: cerBase64,
    privateKeyPem
  });

  const res = await fetch(
    'https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: 'http://DescargaMasivaTerceros.gob.mx/IAutenticacion/Autentica'
      },
      body: soapXml,
      signal: AbortSignal.timeout(9000)
    }
  );

  if (!res.ok) {
    throw new Error(`Error HTTP ${res.status} al autenticar con el SAT.`);
  }

  const text = await res.text();
  const tokenMatch = text.match(/<AutenticaResult>(.*?)<\/AutenticaResult>/i);
  if (!tokenMatch || !tokenMatch[1]) {
    throw new Error('El SAT no devolvió un token de sesión válido.');
  }

  return tokenMatch[1];
}

export async function resolveCompanyFielCredentials(
  supabase: SupabaseClient,
  companyId: string,
  initialRfc = ''
): Promise<{ cerBase64: string; privateKeyPem: string; companyRfc: string }> {
  let cerBase64 = '';
  let privateKeyPem = '';

  const { data: creds } = await supabase
    .from('fiel_credentials')
    .select('cer_base64, private_key_pem, rfc_titular')
    .eq('company_id', companyId)
    .maybeSingle();

  if (creds) {
    cerBase64 = creds.cer_base64 || '';
    privateKeyPem = creds.private_key_pem
      ? await decryptPrivateKeyIfNeeded(creds.private_key_pem)
      : '';
  }

  let dbRfc = creds?.rfc_titular || '';
  if (!dbRfc) {
    const { data: comp } = await supabase
      .from('companies')
      .select('rfc')
      .eq('id', companyId)
      .maybeSingle();
    if (comp?.rfc) dbRfc = comp.rfc;
  }

  const companyRfc = dbRfc || initialRfc;

  return { cerBase64, privateKeyPem, companyRfc };
}

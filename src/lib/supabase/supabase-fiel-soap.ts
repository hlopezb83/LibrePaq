import { parseSatCertificate } from '../../shared/sat-certificate-parser';
import type {
  CfdiDocument,
  FielCredentialStatus,
  SatDownloadRequestRecord
} from '../../shared/types';
import { supabase } from '../supabase';
import { supabaseSoapDownload } from './supabase-soap-download';

const STORAGE_FIEL_KEY = 'librepaq_fiel_credentials_';

export const supabaseFielAndSoap = {
  async getFielStatus(companyId: string): Promise<FielCredentialStatus> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('fiel_credentials')
          .select('company_id, rfc_titular, nombre_titular, numero_serie, valid_from, valid_to, sha1_fingerprint, cer_base64, updated_at')
          .eq('company_id', companyId)
          .maybeSingle();

        if (!error && data) {
          const validTo = data.valid_to || new Date().toISOString();
          const s: FielCredentialStatus = {
            companyId: data.company_id,
            hasCredentials: true,
            hasPrivateKey: true,
            rfcTitular: data.rfc_titular,
            nombreTitular: data.nombre_titular,
            numeroSerieCertificado: data.numero_serie,
            validFrom: data.valid_from,
            validTo,
            isExpired: new Date(validTo).getTime() < Date.now(),
            sha1Fingerprint: data.sha1_fingerprint,
            certificateBase64: data.cer_base64,
            updatedAt: data.updated_at
          };
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(`${STORAGE_FIEL_KEY}${companyId}`, JSON.stringify(s));
          }
          return s;
        }
      } catch {
        // Fallback a localStorage
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(`${STORAGE_FIEL_KEY}${companyId}`);
      if (stored) {
        try {
          return JSON.parse(stored) as FielCredentialStatus;
        } catch {
          // Fallback
        }
      }
    }

    return {
      companyId,
      hasCredentials: false,
      rfcTitular: null,
      nombreTitular: null,
      numeroSerieCertificado: null,
      validFrom: null,
      validTo: null,
      isExpired: false,
      sha1Fingerprint: null,
      certificateBase64: null,
      updatedAt: null
    };
  },

  async saveFielCredentials(payload: {
    companyId: string;
    cerBase64?: string;
    keyBase64?: string;
    passphrase: string;
  }): Promise<FielCredentialStatus> {
    if (supabase) {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke<{
        ok: boolean;
        message?: string;
        error?: string;
        fielStatus?: FielCredentialStatus;
      }>('sat-soap-sync', {
        body: {
          action: 'store-fiel',
          companyId: payload.companyId,
          cerBase64: payload.cerBase64,
          keyBase64: payload.keyBase64,
          passphrase: payload.passphrase
        }
      });

      if (edgeError) {
        let errorMsg = edgeError.message;
        try {
          const ctxJson = await (edgeError as { context?: Response }).context?.json();
          if (ctxJson?.error) {
            errorMsg = ctxJson.error;
          }
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      if (edgeData?.fielStatus) {
        const s = edgeData.fielStatus;
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`${STORAGE_FIEL_KEY}${payload.companyId}`, JSON.stringify(s));
        }
        return s;
      }
    }

    let rfcTitular = 'XAXX010101000';
    let nombreTitular = 'Contribuyente Oficial';
    const parsed = payload.cerBase64
      ? await parseSatCertificate(payload.cerBase64, rfcTitular, nombreTitular)
      : {
          rfcTitular,
          nombreTitular,
          numeroSerie: '00001000000000000000',
          validFrom: new Date().toISOString(),
          validTo: new Date(Date.now() + 365 * 86400000).toISOString(),
          isExpired: false,
          sha1Fingerprint: 'UNKNOWN'
        };

    const nowIso = new Date().toISOString();
    const status: FielCredentialStatus = {
      companyId: payload.companyId,
      hasCredentials: true,
      hasPrivateKey: true,
      rfcTitular: parsed.rfcTitular,
      nombreTitular: parsed.nombreTitular,
      numeroSerieCertificado: parsed.numeroSerie,
      validFrom: parsed.validFrom,
      validTo: parsed.validTo,
      isExpired: parsed.isExpired,
      sha1Fingerprint: parsed.sha1Fingerprint,
      certificateBase64: payload.cerBase64 || null,
      updatedAt: nowIso
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        `${STORAGE_FIEL_KEY}${payload.companyId}`,
        JSON.stringify(status)
      );
    }

    return status;
  },

  async generateTestFiel(
    companyId: string,
    passphrase: string = 'Contpaq2026'
  ): Promise<{
    status: FielCredentialStatus;
    generatedFiles: { cerBase64: string; keyBase64: string; passphrase: string };
  }> {
    let isAllowedDemo = false;
    if (supabase) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('rfc, name')
          .eq('id', companyId)
          .maybeSingle();
        if (comp && (comp.name.startsWith('[DEMO]') || comp.rfc === 'CEJ2106158A0' || companyId.includes('demo'))) {
          isAllowedDemo = true;
        }
      } catch {
        isAllowedDemo = false;
      }
    } else {
      isAllowedDemo = companyId.includes('demo') || companyId.startsWith('sandbox_');
    }

    if (!isAllowedDemo) {
      throw new Error(
        'Por seguridad fiscal, no se pueden generar datos o certificados de prueba en una empresa real de producción. Carga los archivos oficiales .cer y .key de tu cliente.'
      );
    }

    const status: FielCredentialStatus = {
      companyId,
      hasCredentials: true,
      rfcTitular: 'CEJ2106158A0',
      nombreTitular: '[DEMO] Comercializadora Ejemplo S.A. de C.V.',
      numeroSerieCertificado: '20000100000050000889',
      validFrom: '2024-01-01T00:00:00.000Z',
      validTo: '2028-12-31T23:59:59.000Z',
      isExpired: false,
      sha1Fingerprint: '8F9012345678A1B2C3D4E5F60718293A4B5C6D7E',
      certificateBase64: 'MIIEPjCCAyagAwIBAgIUMzAwMDEwMDAwMDA1MDAwMDM0MTIwDQYJKoZIhvcNAQELBQAw',
      updatedAt: new Date().toISOString()
    };

    const generatedFiles = {
      cerBase64: 'MIIEPjCCAyagAwIBAgIUMzAwMDEwMDAwMDA1MDAwMDM0MTIwDQYJKoZIhvcNAQELBQAw',
      keyBase64: 'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC4XwR+b84G3K1y90b8',
      passphrase
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`${STORAGE_FIEL_KEY}${companyId}`, JSON.stringify(status));
    }

    return { status, generatedFiles };
  },

  getSatDownloadRequests(companyId: string): Promise<SatDownloadRequestRecord[]> {
    return supabaseSoapDownload.getSatDownloadRequests(companyId);
  },

  executeSatSoapDownload(payload: {
    companyId: string;
    tipoSolicitud: 'EMITIDOS' | 'RECIBIDOS';
    fechaInicial: string;
    fechaFinal: string;
    modoEjecucion?: 'SAT_LIVE' | 'SANDBOX_CRYPTO';
    isDemoCompany?: boolean;
  }): Promise<{
    requestRecord: SatDownloadRequestRecord;
    downloadedCfdis: CfdiDocument[];
  }> {
    return supabaseSoapDownload.executeSatSoapDownload(payload);
  },

  verifyPendingSatRequests(companyId: string) {
    return supabaseSoapDownload.verifyPendingSatRequests(companyId);
  }
};

import { supabase } from '../supabase';
import { isGuestDemoMode } from '../sandbox/guest-demo-mode';
import { getReadOnlyWriteErrorMessage, isReadOnlyWriteBlocked } from '../support-impersonation';

export interface DeliverableBrandingConfig {
  firmName: string;
  preparerName: string;
  auditorName: string;
  auditorCedula: string;
  legalRepName: string;
  legalRepTitle: string;
  issuanceCity: string;
  logoDataUrl: string;
  accountantNotes: string;
}

export const DEFAULT_DELIVERABLE_CONFIG: DeliverableBrandingConfig = {
  firmName: 'Despacho Contable y Fiscal Integral S.C.',
  preparerName: 'Auxiliar Contable',
  auditorName: 'C.P.C. María Elena Gómez Garza',
  auditorCedula: 'Céd. Prof. 4829103',
  legalRepName: 'Ing. Alejandro Garza Martínez',
  legalRepTitle: 'Representante Legal',
  issuanceCity: 'Monterrey, Nuevo León',
  logoDataUrl: '',
  accountantNotes: ''
};

export function hasAnyDefaultSignature(
  cfg: Pick<
    DeliverableBrandingConfig,
    'firmName' | 'auditorName' | 'auditorCedula' | 'legalRepName'
  >
): boolean {
  return (
    cfg.firmName === DEFAULT_DELIVERABLE_CONFIG.firmName ||
    cfg.auditorName.includes('María Elena Gómez Garza') ||
    cfg.auditorCedula.includes('4829103') ||
    cfg.legalRepName.includes('Alejandro Garza Martínez')
  );
}

const getStorageKey = (companyId: string) => `librepaq_deliverable_config_${companyId}`;

export function readLocalDeliverableBranding(
  companyId: string
): DeliverableBrandingConfig {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_DELIVERABLE_CONFIG };
    const raw = localStorage.getItem(getStorageKey(companyId));
    if (!raw) return { ...DEFAULT_DELIVERABLE_CONFIG };
    const parsed = JSON.parse(raw) as Partial<DeliverableBrandingConfig>;
    return {
      firmName: parsed.firmName || DEFAULT_DELIVERABLE_CONFIG.firmName,
      preparerName: parsed.preparerName || DEFAULT_DELIVERABLE_CONFIG.preparerName,
      auditorName: parsed.auditorName || DEFAULT_DELIVERABLE_CONFIG.auditorName,
      auditorCedula: parsed.auditorCedula || DEFAULT_DELIVERABLE_CONFIG.auditorCedula,
      legalRepName: parsed.legalRepName || DEFAULT_DELIVERABLE_CONFIG.legalRepName,
      legalRepTitle: parsed.legalRepTitle || DEFAULT_DELIVERABLE_CONFIG.legalRepTitle,
      issuanceCity: parsed.issuanceCity || DEFAULT_DELIVERABLE_CONFIG.issuanceCity,
      logoDataUrl: parsed.logoDataUrl || '',
      accountantNotes: parsed.accountantNotes || ''
    };
  } catch {
    return { ...DEFAULT_DELIVERABLE_CONFIG };
  }
}

export function writeLocalDeliverableBranding(
  companyId: string,
  config: DeliverableBrandingConfig
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(getStorageKey(companyId), JSON.stringify(config));
  } catch {
    // Ignorar error de cuota en localStorage (ej. logo muy pesado)
  }
}

function mapSupabaseBrandingRow(
  row: Record<string, unknown>,
  fallback: DeliverableBrandingConfig
): DeliverableBrandingConfig {
  const str = (key: string, fb: string) => {
    const val = row[key];
    return typeof val === 'string' && val.trim().length > 0 ? val : fb;
  };
  return {
    firmName: str('firm_name', fallback.firmName),
    preparerName: str('preparer_name', fallback.preparerName),
    auditorName: str('auditor_name', fallback.auditorName),
    auditorCedula: str('auditor_cedula', fallback.auditorCedula),
    legalRepName: str('legal_rep_name', fallback.legalRepName),
    legalRepTitle: str('legal_rep_title', fallback.legalRepTitle),
    issuanceCity: str('issuance_city', fallback.issuanceCity),
    logoDataUrl:
      typeof row.logo_data_url === 'string'
        ? row.logo_data_url
        : typeof row.logo_url === 'string'
          ? row.logo_url
          : fallback.logoDataUrl,
    accountantNotes:
      typeof row.notes_text === 'string'
        ? row.notes_text
        : typeof row.accountant_notes === 'string'
          ? row.accountant_notes
          : fallback.accountantNotes
  };
}

/**
 * Carga la configuración de membrete, firmas, logo y notas del despacho desde Supabase
 * (`despacho_deliverable_branding`) con respaldo automático a localStorage para modo local/demo.
 * Garantiza que usuarios CLIENTE_LECTURA visualicen el membrete real guardado por el despacho.
 */
export async function loadDeliverableBranding(
  companyId: string
): Promise<DeliverableBrandingConfig> {
  const local = readLocalDeliverableBranding(companyId);
  if (!companyId || !supabase || isGuestDemoMode()) return local;

  try {
    const { data, error } = await supabase
      .from('despacho_deliverable_branding')
      .select('*')
      .eq('scope_key', `comp_${companyId}`)
      .maybeSingle();

    if (error || !data) return local;

    const merged = mapSupabaseBrandingRow(data as Record<string, unknown>, local);
    writeLocalDeliverableBranding(companyId, merged);
    return merged;
  } catch {
    return local;
  }
}

/**
 * Persiste el membrete, firmas, cédula, logo y notas del contador en Supabase
 * (`despacho_deliverable_branding`) y en localStorage. Bloquea escritura en modo solo lectura.
 */
export async function saveDeliverableBranding(
  companyId: string,
  config: DeliverableBrandingConfig,
  options?: { isReadOnly?: boolean; organizationId?: string | null }
): Promise<{ savedToCloud: boolean }> {
  if (isReadOnlyWriteBlocked()) {
    throw new Error(getReadOnlyWriteErrorMessage());
  }
  if (!companyId || options?.isReadOnly) return { savedToCloud: false };

  writeLocalDeliverableBranding(companyId, config);

  if (!supabase || isGuestDemoMode()) {
    return { savedToCloud: false };
  }

  try {
    const { error } = await supabase.from('despacho_deliverable_branding').upsert(
      {
        id: `brand_${companyId}`,
        scope_key: `comp_${companyId}`,
        company_id: companyId,
        organization_id: options?.organizationId ?? null,
        firm_name: config.firmName,
        preparer_name: config.preparerName,
        auditor_name: config.auditorName,
        auditor_cedula: config.auditorCedula,
        legal_rep_name: config.legalRepName,
        legal_rep_title: config.legalRepTitle,
        issuance_city: config.issuanceCity,
        logo_data_url: config.logoDataUrl || null,
        notes_text: config.accountantNotes || '',
        updated_at: new Date().toISOString()
      },
      { onConflict: 'scope_key' }
    );
    return { savedToCloud: !error };
  } catch {
    return { savedToCloud: false };
  }
}

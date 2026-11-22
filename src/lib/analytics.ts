/**
 * LibrePaq Pro - Google Analytics & Google Ads Event & Attribution Engine
 * Envia eventos seguros a GA4 (G-QQFGNPNYNZ) y Google Ads (AW-18538290375) sin bloquear la UI,
 * preservando el clic original de Google Ads (gclid / utm_*) durante redirecciones OAuth.
 */

export const GA_MEASUREMENT_ID = 'G-QQFGNPNYNZ';
export const GOOGLE_ADS_ID = 'AW-18538290375';
export const OFFICIAL_GOOGLE_ADS_SIGNUP_LABEL = 'AdpFCLTsx64dEMe534dF';
export const OFFICIAL_GOOGLE_ADS_SIGNUP_SEND_TO = `${GOOGLE_ADS_ID}/${OFFICIAL_GOOGLE_ADS_SIGNUP_LABEL}`;
const ATTRIBUTION_STORAGE_KEY = 'librepaq_ad_attribution';

export interface AdAttributionData {
  source: 'google_ads' | 'utm' | 'organic_or_direct';
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPath?: string;
  referrer?: string;
  capturedAt: string;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackAnalyticsEvent(
  eventName: string,
  params: Record<string, string | number | boolean | null | undefined> = {}
): void {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  } catch (err) {
    console.debug('[Analytics] Error al emitir evento:', err);
  }
}

/**
 * Emite una conversión directa hacia Google Ads (ej. cuando se configure una etiqueta de conversión específica).
 */
export function trackAdsConversion(
  conversionLabel: string,
  value = 0,
  currency = 'MXN'
): void {
  if (!conversionLabel) return;
  const sendTo = conversionLabel.startsWith('AW-')
    ? conversionLabel
    : `${GOOGLE_ADS_ID}/${conversionLabel}`;
  trackAnalyticsEvent('conversion', {
    send_to: sendTo,
    value,
    currency
  });
}

/**
 * Captura parámetros de Google Ads (gclid, gbraid, wbraid) y UTMs al aterrizar en librepaq.com.
 * Se persiste en localStorage para sobrevivir el viaje de ida y vuelta a Google OAuth.
 */
export function captureAdAttributionOnLanding(): AdAttributionData | null {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const gclid = params.get('gclid')?.trim() || undefined;
    const gbraid = params.get('gbraid')?.trim() || undefined;
    const wbraid = params.get('wbraid')?.trim() || undefined;
    const utmSource = params.get('utm_source')?.trim() || undefined;
    const utmMedium = params.get('utm_medium')?.trim() || undefined;
    const utmCampaign = params.get('utm_campaign')?.trim() || undefined;
    const utmTerm = params.get('utm_term')?.trim() || undefined;
    const utmContent = params.get('utm_content')?.trim() || undefined;

    const isGoogleAds = Boolean(
      gclid ||
        gbraid ||
        wbraid ||
        utmMedium?.toLowerCase() === 'cpc' ||
        utmMedium?.toLowerCase() === 'ppc' ||
        utmSource?.toLowerCase() === 'google_ads'
    );
    const hasAnyUtm = Boolean(utmSource || utmMedium || utmCampaign || utmTerm || utmContent);

    if (isGoogleAds || hasAnyUtm) {
      const record: AdAttributionData = {
        source: isGoogleAds ? 'google_ads' : 'utm',
        gclid,
        gbraid,
        wbraid,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        landingPath: typeof window !== 'undefined' ? window.location.pathname : '/',
        referrer: (typeof document !== 'undefined' ? document.referrer : undefined) || undefined,
        capturedAt: new Date().toISOString()
      };
      localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(record));
      return record;
    }

    const existing = getStoredAdAttribution();
    if (existing) return existing;

    const organicRecord: AdAttributionData = {
      source: 'organic_or_direct',
      landingPath: typeof window !== 'undefined' ? window.location.pathname : '/',
      referrer: (typeof document !== 'undefined' ? document.referrer : undefined) || undefined,
      capturedAt: new Date().toISOString()
    };
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(organicRecord));
    return organicRecord;
  } catch {
    return null;
  }
}

export function getStoredAdAttribution(): AdAttributionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdAttributionData;
  } catch {
    return null;
  }
}

/**
 * Se dispara una sola vez cuando el contador completa su registro real y se crea su Workspace.
 */
export function trackWorkspaceSignupConversion(
  method: string,
  attribution: AdAttributionData | null
): void {
  const payload = {
    method,
    acquisition_source: attribution?.source || 'organic_or_direct',
    gclid: attribution?.gclid || undefined,
    utm_source: attribution?.utmSource || undefined,
    utm_campaign: attribution?.utmCampaign || undefined,
    utm_term: attribution?.utmTerm || undefined
  };

  trackAnalyticsEvent('sign_up', payload);
  trackAnalyticsEvent('workspace_created', payload);

  const signupLabel =
    (import.meta.env.VITE_GOOGLE_ADS_SIGNUP_LABEL as string | undefined) ||
    OFFICIAL_GOOGLE_ADS_SIGNUP_LABEL;
  trackAdsConversion(signupLabel, 1.0, 'MXN');
}

export function trackDirectGoogleAdsSignupConversion(method = 'direct'): void {
  const attribution = getStoredAdAttribution();
  trackWorkspaceSignupConversion(method, attribution);
}

/**
 * Se dispara cuando el usuario da de alta su primera empresa en el Workspace.
 */
export function trackFirstCompanyCreatedConversion(params: {
  isDemo: boolean;
  creationFlow: 'express' | 'wizard' | 'xml_autofill' | 'sandbox_demo';
}): void {
  const attribution = getStoredAdAttribution();
  trackAnalyticsEvent('first_company_created', {
    is_demo: params.isDemo,
    creation_flow: params.creationFlow,
    acquisition_source: attribution?.source || 'organic_or_direct',
    gclid: attribution?.gclid || undefined
  });

  const companyLabel = (import.meta.env.VITE_GOOGLE_ADS_COMPANY_LABEL as string | undefined) || '';
  if (!params.isDemo && companyLabel) {
    trackAdsConversion(companyLabel, 1, 'MXN');
  }
}

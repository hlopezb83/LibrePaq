import { describe, expect, test, beforeEach } from 'bun:test';
import {
  captureAdAttributionOnLanding,
  getStoredAdAttribution,
  trackWorkspaceSignupConversion,
  trackFirstCompanyCreatedConversion,
  OFFICIAL_GOOGLE_ADS_SIGNUP_LABEL,
  OFFICIAL_GOOGLE_ADS_SIGNUP_SEND_TO,
  GOOGLE_ADS_ID,
  GA_MEASUREMENT_ID
} from '../src/lib/analytics';

describe('Google Ads & Attribution Engine — Pre-Launch Smoke Suite', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }

    // Mock localStorage
    globalThis.localStorage = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
      clear: () => {
        for (const k of Object.keys(mockStorage)) delete mockStorage[k];
      },
      length: 0,
      key: () => null
    } as unknown as Storage;

    // Default window mock
    globalThis.window = {
      location: {
        search: '?gclid=test_gclid_12345&utm_source=google_ads&utm_medium=cpc&utm_campaign=reemplazo_contpaqi',
        pathname: '/'
      } as unknown as Location,
      gtag: undefined
    } as unknown as Window & typeof globalThis;
  });

  test('1. Captures Google Ads parameters (gclid, utm_*) and persists in localStorage', () => {
    const record = captureAdAttributionOnLanding();
    expect(record).not.toBeNull();
    expect(record?.source).toBe('google_ads');
    expect(record?.gclid).toBe('test_gclid_12345');
    expect(record?.utmSource).toBe('google_ads');
    expect(record?.utmMedium).toBe('cpc');
    expect(record?.utmCampaign).toBe('reemplazo_contpaqi');

    const stored = getStoredAdAttribution();
    expect(stored).toEqual(record);
  });

  test('2. Preserves attribution during OAuth return without query params', () => {
    // 1st visit with Ads click
    captureAdAttributionOnLanding();

    // 2nd visit: user redirected from Google OAuth without gclid in URL
    (globalThis.window.location as unknown as { search: string }).search = '';
    const stored = getStoredAdAttribution();
    expect(stored?.gclid).toBe('test_gclid_12345');
    expect(stored?.source).toBe('google_ads');
  });

  test('3. Emits official Google Ads Signup Conversion tag (AW-18538290375) upon workspace creation', () => {
    const emittedEvents: Array<{ name: string; params: Record<string, unknown> }> = [];

    (globalThis.window as unknown as { gtag?: (c: string, e: string, p: Record<string, unknown>) => void }).gtag = (
      command: string,
      eventName: string,
      params: Record<string, unknown>
    ) => {
      if (command === 'event') {
        emittedEvents.push({ name: eventName, params });
      }
    };

    const attribution = captureAdAttributionOnLanding();
    trackWorkspaceSignupConversion('google_oauth', attribution);

    // Debe emitir sign_up en GA4
    const signupEvent = emittedEvents.find((e) => e.name === 'sign_up');
    expect(signupEvent).toBeDefined();
    expect(signupEvent?.params.acquisition_source).toBe('google_ads');
    expect(signupEvent?.params.gclid).toBe('test_gclid_12345');

    // Debe emitir conversion hacia Google Ads con la etiqueta oficial
    const adsConversionEvent = emittedEvents.find((e) => e.name === 'conversion');
    expect(adsConversionEvent).toBeDefined();
    expect(adsConversionEvent?.params.send_to).toBe(OFFICIAL_GOOGLE_ADS_SIGNUP_SEND_TO);
    expect(adsConversionEvent?.params.send_to).toBe('AW-18538290375/AdpFCLTsx64dEMe534dF');
  });

  test('4. Safely handles missing window.gtag without throwing errors', () => {
    (globalThis.window as unknown as { gtag?: unknown }).gtag = undefined;

    expect(() => {
      const attribution = captureAdAttributionOnLanding();
      trackWorkspaceSignupConversion('email', attribution);
      trackFirstCompanyCreatedConversion({ isDemo: false, creationFlow: 'wizard' });
    }).not.toThrow();
  });

  test('5. Constants and Tag IDs match official Google accounts', () => {
    expect(GOOGLE_ADS_ID).toBe('AW-18538290375');
    expect(GA_MEASUREMENT_ID).toBe('G-QQFGNPNYNZ');
    expect(OFFICIAL_GOOGLE_ADS_SIGNUP_LABEL).toBe('AdpFCLTsx64dEMe534dF');
  });
});

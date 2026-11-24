import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getCompanyInitials } from '../src/components/company-switcher/companyThemes';
import { translateAuthError } from '../src/components/auth/authErrorTranslator';
import { extractCompanyFromCsfText } from '../src/shared/sat-csf-extractor';
import { validateStringSearch } from '../src/router';
import { parseNavTarget } from '../src/components/shell/parseNavTarget';
import { getQuickActionItems } from '../src/components/command-palette/commandPaletteQuickActions';

describe('Ronda 6 — Ola 1 UI/UX, Accesibilidad y Utilidades', () => {
  it('getCompanyInitials limpia prefijos [DEMO] / [EJEMPLO] en avatares', () => {
    expect(getCompanyInitials('[DEMO] Grupo Industrial del Norte')).toBe('GR');
    expect(getCompanyInitials('[EJEMPLO] Despacho Fiscal Alfa')).toBe('DE');
    expect(getCompanyInitials('[DEMO] [PRUEBA] Comercial Mexicana')).toBe('CO');
    expect(getCompanyInitials('Acme Contadores S.C.')).toBe('AC');
    expect(getCompanyInitials('')).toBe('EM');
  });

  it('translateAuthError traduce session missing y fallback genérico 100% al español', () => {
    const missing = translateAuthError('Auth session missing!');
    expect(missing.toLowerCase()).toContain('sesión');
    expect(missing.toLowerCase()).toContain('solicita un nuevo enlace');

    const fallback = translateAuthError('Unhandled internal upstream failure 502');
    expect(fallback).toBe(
      'No pudimos completar tu solicitud en este momento. Verifica tus datos e inténtalo de nuevo.'
    );
    expect(fallback).not.toContain('Unhandled');
  });

  it('extractCompanyFromCsfText retorna CP vacío "" cuando la CSF no trae Código Postal', () => {
    const csfSinCp = `
      SERVICIO DE ADMINISTRACIÓN TRIBUTARIA
      RFC: BBA830831LJ2
      Denominación/Razón Social: ASESORES CONTABLES DEL CENTRO
      Regímenes:
      Régimen General de Ley Personas Morales
    `;
    const result = extractCompanyFromCsfText(csfSinCp);
    expect(result).not.toBeNull();
    expect(result?.rfc).toBe('BBA830831LJ2');
    expect(result?.codigoPostal).toBe('');
  });

  it('validateStringSearch y parseNavTarget normalizan ?dossier sin comillas extra', () => {
    expect(validateStringSearch({ tab: 'DOSSIER', dossier: '"true"' })).toEqual({
      tab: 'DOSSIER',
      dossier: 'true'
    });
    expect(validateStringSearch({ tab: 'DIOT', dossier: true, page: 2 })).toEqual({
      tab: 'DIOT',
      dossier: 'true',
      page: '2'
    });
    expect(parseNavTarget('/reportes?tab=DOSSIER&dossier=%22true%22')).toEqual({
      to: '/reportes',
      search: { tab: 'DOSSIER', dossier: 'true' }
    });
  });

  it('getQuickActionItems abre Dossier directamente con onOpenDeliverables cuando está disponible', () => {
    let routed = false;
    let openedDeliverables = false;
    const items = getQuickActionItems(
      'dossier',
      () => {
        routed = true;
      },
      undefined,
      undefined,
      () => {
        openedDeliverables = true;
      }
    );
    const dossierAction = items.find((i) => i.id === 'act-deliverables');
    expect(dossierAction).toBeDefined();
    dossierAction?.action();
    expect(openedDeliverables).toBe(true);
    expect(routed).toBe(false);
  });

  it('styles.css aplica table thead th, .erp-tabbar-wrap, foco oscuro y thumbs de 24px', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toContain('table thead th');
    expect(css).not.toMatch(/^table\s+th\s*\{/m);
    expect(css).toContain('.erp-tabbar-wrap [role="tablist"]');
    expect(css).toContain('.dark-focus-ring:focus-visible');
    expect(css).toContain('input[type="range"]::-webkit-slider-thumb');
    expect(css).toContain('input[type="range"]::-moz-range-thumb');
    expect(css).toContain('width: 24px;');
    expect(css).toContain('height: 24px;');
  });
});

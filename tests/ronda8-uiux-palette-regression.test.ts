import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSrc(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf8');
}

describe('Ronda 8 — Regresión Landing, Funnel, Legal, Index y Palette UI/UX', () => {
  it('LandingPageView navega a "/" tras startGuestDemo y renderiza CTA dentro de <main>', () => {
    const landingPage = readSrc('src/views/LandingPageView.tsx');
    expect(landingPage).toContain('await startGuestDemo()');
    expect(landingPage).toContain("await navigate({ to: '/' })");
    expect(landingPage).toContain('user={user}');
    expect(landingPage).toContain('isGuest={isGuest}');

    const mainCloseIdx = landingPage.indexOf('</main>');
    const ctaIdx = landingPage.indexOf('<LandingCtaSection');
    const footerIdx = landingPage.indexOf('<LandingFooterSection');
    expect(mainCloseIdx).toBeGreaterThan(-1);
    expect(ctaIdx).toBeGreaterThan(-1);
    expect(ctaIdx).toBeLessThan(mainCloseIdx);
    expect(footerIdx).toBeGreaterThan(mainCloseIdx);
  });

  it('LandingNavbar corrige enlace de logo a "/", etiqueta "Preguntas", targets >=40px y logout accesible', () => {
    const navbar = readSrc('src/views/landing/LandingNavbar.tsx');
    expect(navbar).toContain('to="/"');
    expect(navbar).not.toContain('to="/landing"');
    expect(navbar).toContain('Preguntas');
    expect(navbar).not.toContain('>FAQ<');
    expect(navbar).toContain('min-h-[40px]');
    expect(navbar).toContain("aria-label={isSigningOut ? 'Cerrando sesión...' : 'Cerrar sesión'}");
    expect(navbar).toContain('p-2 sm:px-3 sm:py-2');
    expect(navbar).toContain('await signOut()');
    expect(navbar).toContain('flex-wrap');
  });

  it('LandingHeroSection protege sesiones reales y evita recorte de pestañas en móvil', () => {
    const hero = readSrc('src/views/landing/LandingHeroSection.tsx');
    expect(hero).toContain('Alternativa en la Nube a CONTPAQi®');
    expect(hero).not.toContain('Alternativa #1 a CONTPAQi®');
    expect(hero).toContain('Boolean(user && !isGuest)');
    expect(hero).toContain('Ir a Mi Despacho');
    expect(hero).toContain('grid-cols-2');
    expect(hero).toContain('min-h-[40px]');
  });

  it('LandingFooterSection cumple contraste AA, terminología SAT, landmarks h2 y clearance FAB', () => {
    const footer = readSrc('src/views/landing/LandingFooterSection.tsx');
    expect(footer).toContain('from-blue-700');
    expect(footer).toContain('text-blue-50');
    expect(footer).toContain('Comienza en menos de 30 segundos');
    expect(footer).toContain(
      'Sistema Contable y Fiscal en la Nube con Contabilidad Electrónica SAT Anexo 24 y Bóveda CFDI 4.0.'
    );
    expect(footer).toContain('<h2 className="font-bold text-white text-sm mb-3">');
    expect(footer).not.toContain('<h3');
    expect(footer).toContain('pb-24 sm:pb-20');
    expect(footer).toContain('soporte@librepaq.com');
    expect(footer).not.toContain('hlopezb@gmail.com');
  });

  it('LandingInteractivePreview corrige CFDI I, aritmética Día 17, P10 dinámico y hints móviles', () => {
    const preview = readSrc('src/views/landing/LandingInteractivePreview.tsx');
    expect(preview).toContain('CFDI I (Emitido)');
    expect(preview).toContain('CFDI I (Recibido · Gasto)');
    expect(preview).not.toContain('CFDI E (Gasto)');
    expect(preview).toContain('$42,358.57');
    expect(preview).toContain('Causado $96,000.00 - Acreditable $77,550.00');
    expect(preview).toContain('$18,450.00');
    expect(preview).toContain('Periodo P10 (Octubre {new Date().getFullYear()})');
    expect(preview).not.toContain('Octubre 2026');
    expect(preview).toContain('Desliza para ver importes →');
  });

  it('LandingComparisonSection y LandingFeaturesSection aplican tabla sticky, scroll-mt y bancos PDF/CSV', () => {
    const comparison = readSrc('src/views/landing/LandingComparisonSection.tsx');
    expect(comparison).toContain('landing-table');
    expect(comparison).toContain('px-3 sm:px-6');
    expect(comparison).toContain('sticky left-0 z-10');
    expect(comparison).toContain('archivos XML');
    expect(comparison).not.toContain('XMLs');
    expect(comparison).toContain('scroll-mt-16');

    const features = readSrc('src/views/landing/LandingFeaturesSection.tsx');
    expect(features).toContain('(BBVA, Banorte, Santander, Banamex en PDF o CSV)');
    expect(features).toContain('scroll-mt-16');
    for (const id of ['#mod-polizas', '#mod-boveda', '#mod-catalogo', '#mod-bancos', '#mod-activos', '#mod-cierre']) {
      const bareId = id.slice(1);
      expect(features).toMatch(new RegExp(`id="${bareId}"[^>]*scroll-mt-24`));
    }
  });

  it('Calculadora ROI, Precios y FAQ cumplen gramática singular, disclaimer, garantía y FAQs clave', () => {
    const roi = readSrc('src/views/landing/LandingRoiCalculator.tsx');
    expect(roi).toContain("numRfcs === 1 ? '1 RFC' : `${numRfcs} RFCs`");
    expect(roi).toContain('1 empresa o RFC administrado');
    expect(roi).toContain('Estimación referencial anual: licencias, módulos, usuarios extra y soporte');
    expect(roi).toContain('min-h-[40px]');
    expect(roi).toContain('scroll-mt-16');

    const pricing = readSrc('src/views/landing/LandingPricingSection.tsx');
    expect(pricing).toContain('mt-3 md:mt-0');
    expect(pricing).toContain('Nube Segura y Soporte Prioritario para Equipos');
    expect(pricing).toContain('Crear Cuenta y Probar Respaldo');
    expect(pricing).toContain('30 días de aviso');
    expect(pricing).toContain('exportación completa');
    expect(pricing).toContain('scroll-mt-16');

    const faq = readSrc('src/views/landing/LandingFaqSection.tsx');
    expect(faq).toContain('py-14 sm:py-20 lg:py-24');
    expect(faq).toContain('e.firma');
    expect(faq).toContain('.cer');
    expect(faq).toContain('.key');
    expect(faq).toContain('promoción de lanzamiento');
    expect(faq).toContain('scroll-mt-16');
  });

  it('PrivacyPolicyView, TermsOfServiceView e IndexView cumplen landmarks, skip links, FAB clearance y motion-reduce', () => {
    const privacy = readSrc('src/views/PrivacyPolicyView.tsx');
    expect(privacy).toContain('Saltar al contenido principal');
    expect(privacy).toContain('id="main-content"');
    expect(privacy).toContain('<footer');
    expect(privacy).toContain('pb-24 sm:pb-20');
    expect(privacy).toContain('text-2xl sm:text-3xl');
    expect(privacy).toContain('privacidad@librepaq.com');
    expect(privacy).not.toContain('hlopezb@gmail.com');

    const terms = readSrc('src/views/TermsOfServiceView.tsx');
    expect(terms).toContain('Saltar al contenido principal');
    expect(terms).toContain('id="main-content"');
    expect(terms).toContain('<footer');
    expect(terms).toContain('pb-24 sm:pb-20');
    expect(terms).toContain('text-2xl sm:text-3xl');

    const indexView = readSrc('src/views/IndexView.tsx');
    expect(indexView).toContain('<main');
    expect(indexView).toContain('px-4 text-center');
    expect(indexView).toContain('motion-reduce:animate-none');
  });

  it('ResetPasswordView escucha eventos de autenticación con onAuthStateChange', () => {
    const resetView = readSrc('src/views/ResetPasswordView.tsx');
    expect(resetView).toContain('onAuthStateChange');
  });

  it('Módulos Fiscal-Bancos preservan mejoras Palette de teclado, ARIA live y carga', () => {
    const conciliacion = readSrc('src/views/fiscal-bancos/ConciliacionBancosTab.tsx');
    expect(conciliacion).toContain("e.key !== 'Escape'");
    expect(conciliacion).toContain('aria-live="polite"');
    expect(conciliacion).toContain('Esc');

    const cxc = readSrc('src/views/fiscal-bancos/CxcCxpTab.tsx');
    expect(cxc).toContain("e.key === 'Escape'");
    expect(cxc).toContain('Limpiar búsqueda de cartera');

    const dia17 = readSrc('src/views/fiscal-bancos/PapelDia17Tab.tsx');
    expect(dia17).toContain('aria-busy={genTaxProvisionMutation.isPending}');
    expect(dia17).toContain('Loader2');

    const bookTable = readSrc('src/views/fiscal-bancos/BankBookMovementsTable.tsx');
    expect(bookTable).toContain('aria-selected=');

    const stmtTable = readSrc('src/views/fiscal-bancos/BankStatementTable.tsx');
    expect(stmtTable).toContain('aria-selected=');
    expect(stmtTable).toContain('autoFocus');
  });

  it('Todos los archivos editados en Ola 5 respetan <= 350 líneas y cero ": any"', () => {
    const ownedFiles = [
      'src/views/LandingPageView.tsx',
      'src/views/landing/LandingNavbar.tsx',
      'src/views/landing/LandingHeroSection.tsx',
      'src/views/landing/LandingComparisonSection.tsx',
      'src/views/landing/LandingInteractivePreview.tsx',
      'src/views/landing/LandingFeaturesSection.tsx',
      'src/views/landing/LandingRoiCalculator.tsx',
      'src/views/landing/LandingPricingSection.tsx',
      'src/views/landing/LandingFaqSection.tsx',
      'src/views/landing/LandingFooterSection.tsx',
      'src/views/PrivacyPolicyView.tsx',
      'src/views/TermsOfServiceView.tsx',
      'src/views/IndexView.tsx'
    ];

    for (const file of ownedFiles) {
      const content = readSrc(file);
      const lineCount = content.split('\n').length;
      expect(lineCount).toBeLessThanOrEqual(350);
      expect(content).not.toMatch(/:\s*any\b/);
    }
  });
});

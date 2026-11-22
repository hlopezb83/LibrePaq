import puppeteer from 'puppeteer-core';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function generate() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 1. Generate 1200x628 Marketing Banner (Landscape 1.91:1)
  await page.setViewport({ width: 1200, height: 628, deviceScaleFactor: 1 });
  const bannerHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      body {
        width: 1200px;
        height: 628px;
        background: linear-gradient(135deg, #0B1120 0%, #0F172A 40%, #1E293B 100%);
        color: #F8FAFC;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 60px 70px;
        position: relative;
        overflow: hidden;
      }
      /* Background ambient glows */
      .glow-1 {
        position: absolute;
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, rgba(37, 99, 235, 0) 70%);
        top: -150px;
        left: -100px;
        pointer-events: none;
      }
      .glow-2 {
        position: absolute;
        width: 600px;
        height: 600px;
        background: radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0) 70%);
        bottom: -200px;
        right: -100px;
        pointer-events: none;
      }

      .left-col {
        width: 580px;
        z-index: 10;
      }
      .brand-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(30, 58, 138, 0.5);
        border: 1px solid rgba(56, 189, 248, 0.4);
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        color: #38BDF8;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-bottom: 24px;
      }
      .badge-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10B981;
        box-shadow: 0 0 10px #10B981;
      }
      .title {
        font-size: 44px;
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.8px;
        margin-bottom: 16px;
      }
      .title-accent {
        background: linear-gradient(90deg, #38BDF8 0%, #818CF8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .subtitle {
        font-size: 18px;
        line-height: 1.5;
        color: #94A3B8;
        margin-bottom: 28px;
      }
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .tag {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        color: #E2E8F0;
      }

      .right-col {
        width: 440px;
        z-index: 10;
      }
      .preview-card {
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 18px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
        padding: 24px;
        backdrop-filter: blur(12px);
      }
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        padding-bottom: 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .card-logo {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .card-logo-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #06B6D4 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        font-size: 18px;
      }
      .card-logo-text {
        font-size: 16px;
        font-weight: 700;
        color: white;
      }
      .stat-pill {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #34D399;
        font-size: 12px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 20px;
      }
      .feature-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        margin-bottom: 8px;
      }
      .feature-name {
        font-size: 13px;
        font-weight: 500;
        color: #CBD5E1;
      }
      .feature-status {
        font-size: 12px;
        font-weight: 600;
        color: #38BDF8;
      }
      .cta-box {
        margin-top: 18px;
        background: linear-gradient(135deg, #2563EB 0%, #0284C7 100%);
        border-radius: 10px;
        padding: 12px;
        text-align: center;
        font-weight: 700;
        font-size: 14px;
        color: white;
        letter-spacing: 0.2px;
        box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4);
      }
    </style>
  </head>
  <body>
    <div class="glow-1"></div>
    <div class="glow-2"></div>

    <div class="left-col">
      <div class="brand-badge">
        <span class="badge-dot"></span>
        SaaS Contable 100% Mexicano
      </div>
      <h1 class="title">
        Software Contable en la Nube <span class="title-accent">LibrePaq Pro</span>
      </h1>
      <p class="subtitle">
        La alternativa moderna a CONTPAQi®. Sin pagar licencias anuales de $20,000 MXN. Contabilidad electrónica, pólizas y CFDI 4.0 automatizados.
      </p>
      <div class="tags">
        <div class="tag">✓ SAT Anexo 24 v1.3</div>
        <div class="tag">✓ Balanza y Catálogo XML</div>
        <div class="tag">✓ Lista Negra EFOS 69-B</div>
        <div class="tag">✓ Multiempresa Ilimitada</div>
      </div>
    </div>

    <div class="right-col">
      <div class="preview-card">
        <div class="card-header">
          <div class="card-logo">
            <div class="card-logo-icon">LP</div>
            <div>
              <div class="card-logo-text">LibrePaq Pro</div>
              <div style="font-size: 11px; color: #64748B;">librepaq.com</div>
            </div>
          </div>
          <span class="stat-pill">Activo & En Línea</span>
        </div>

        <div class="feature-row">
          <span class="feature-name">Descarga Masiva SAT</span>
          <span class="feature-status">Sincronizado</span>
        </div>
        <div class="feature-row">
          <span class="feature-name">Validación CFDI 4.0</span>
          <span class="feature-status">100% Válido</span>
        </div>
        <div class="feature-row">
          <span class="feature-name">Generador XML Anexo 24</span>
          <span class="feature-status">Oficial SAT</span>
        </div>
        <div class="feature-row">
          <span class="feature-name">Conciliación Bancaria</span>
          <span class="feature-status">Automática</span>
        </div>

        <div class="cta-box">
          Comenzar Gratis en librepaq.com
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(bannerHtml);
  const bannerPath = path.resolve('public/librepaq-ads-horizontal-1200x628.png');
  await page.screenshot({ path: bannerPath, type: 'png' });
  console.log('Saved:', bannerPath);

  // 2. Generate 1200x628 Horizontal Brand Logo (Landscape Logo 1.91:1)
  const logoBannerHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      body {
        width: 1200px;
        height: 628px;
        background: #FFFFFF;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 20px;
      }
      .logo-container {
        display: flex;
        align-items: center;
        gap: 32px;
      }
      .brand-icon {
        width: 180px;
        height: 180px;
        border-radius: 44px;
        background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 40%, #06B6D4 100%);
        box-shadow: 0 20px 40px -10px rgba(37, 99, 235, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .brand-icon svg {
        width: 110px;
        height: 110px;
      }
      .brand-name {
        font-size: 76px;
        font-weight: 800;
        color: #0F172A;
        letter-spacing: -2px;
        line-height: 1;
      }
      .brand-pro {
        color: #2563EB;
        font-size: 76px;
        font-weight: 800;
      }
      .brand-subtitle {
        font-size: 24px;
        font-weight: 600;
        color: #64748B;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-top: 10px;
      }
    </style>
  </head>
  <body>
    <div class="logo-container">
      <div class="brand-icon">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 14.5 13.5 C 14.5 12.1 15.6 11 17 11 L 19 11 C 20.4 11 21.5 12.1 21.5 13.5 L 21.5 30.5 L 33 30.5 C 34.4 30.5 35.5 31.6 35.5 33 L 35.5 33.5 C 35.5 34.9 34.4 36 33 36 L 17 36 C 15.6 36 14.5 34.9 14.5 33.5 Z" fill="#FFFFFF"/>
          <path d="M 21.5 13.5 C 21.5 12.1 22.6 11 24 11 L 29.5 11 C 33.6 11 36.5 13.9 36.5 18 C 36.5 22.1 33.6 25 29.5 25 L 21.5 25 Z" fill="#38BDF8"/>
          <circle cx="36" cy="11.5" r="2.75" fill="#10B981" stroke="#FFFFFF" stroke-width="1" />
        </svg>
      </div>
      <div>
        <div class="brand-name">LibrePaq <span class="brand-pro">Pro</span></div>
        <div class="brand-subtitle">Software Contable en la Nube · México</div>
      </div>
    </div>
  </body>
  </html>
  `;
  await page.setContent(logoBannerHtml);
  const logoBannerPath = path.resolve('public/librepaq-ads-logo-horizontal-1200x628.png');
  await page.screenshot({ path: logoBannerPath, type: 'png' });
  console.log('Saved:', logoBannerPath);

  // 3. Generate 1200x1200 Square Logo (1:1 Ratio)
  await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 1 });
  const squareLogoHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
      body {
        width: 1200px;
        height: 1200px;
        background: #FFFFFF;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 40px;
      }
      .brand-icon {
        width: 520px;
        height: 520px;
        border-radius: 128px;
        background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 40%, #06B6D4 100%);
        box-shadow: 0 40px 80px -20px rgba(37, 99, 235, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .brand-icon svg {
        width: 340px;
        height: 340px;
      }
      .brand-name {
        font-size: 88px;
        font-weight: 800;
        color: #0F172A;
        letter-spacing: -2px;
      }
      .brand-pro {
        color: #2563EB;
      }
    </style>
  </head>
  <body>
    <div class="brand-icon">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 14.5 13.5 C 14.5 12.1 15.6 11 17 11 L 19 11 C 20.4 11 21.5 12.1 21.5 13.5 L 21.5 30.5 L 33 30.5 C 34.4 30.5 35.5 31.6 35.5 33 L 35.5 33.5 C 35.5 34.9 34.4 36 33 36 L 17 36 C 15.6 36 14.5 34.9 14.5 33.5 Z" fill="#FFFFFF"/>
        <path d="M 21.5 13.5 C 21.5 12.1 22.6 11 24 11 L 29.5 11 C 33.6 11 36.5 13.9 36.5 18 C 36.5 22.1 33.6 25 29.5 25 L 21.5 25 Z" fill="#38BDF8"/>
        <circle cx="36" cy="11.5" r="2.75" fill="#10B981" stroke="#FFFFFF" stroke-width="1" />
      </svg>
    </div>
    <div class="brand-name">LibrePaq <span class="brand-pro">Pro</span></div>
  </body>
  </html>
  `;
  await page.setContent(squareLogoHtml);
  const squareLogoPath = path.resolve('public/librepaq-ads-logo-square-1200x1200.png');
  await page.screenshot({ path: squareLogoPath, type: 'png' });
  console.log('Saved:', squareLogoPath);

  await browser.close();
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});

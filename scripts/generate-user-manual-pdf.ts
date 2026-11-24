import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT_DIR = process.cwd();
const OUTPUT_PDF = path.join(ROOT_DIR, 'docs', 'Manual_Usuario_LibrePaq_Pro.pdf');
const PUBLIC_PDF = path.join(ROOT_DIR, 'public', 'Manual_Usuario_LibrePaq_Pro.pdf');
const LOGO_PATH = path.join(ROOT_DIR, 'public', 'librepaq-app-logo-120.png');

function findBrowserExecutable(): string {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('No se encontró Chrome ni Edge instalado para generar el PDF.');
}

function loadLogoDataUri(): string {
  if (!fs.existsSync(LOGO_PATH)) return '';
  const buf = fs.readFileSync(LOGO_PATH);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function buildManualHtml(logoDataUri: string): string {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8" />
<title>Manual de Usuario — LibrePaq Pro</title>
<style>
  @page {
    size: Letter;
    margin: 0.62in 0.54in 0.62in 0.54in;
    @top-left {
      content: 'LibrePaq Pro — Manual de Usuario';
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 0.5pt solid #e2e8f0;
      padding-bottom: 4pt;
      margin-bottom: 8pt;
      vertical-align: bottom;
    }
    @top-right {
      content: 'Contabilidad Electrónica SAT • CFDI 4.0 & Anexo 24';
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 7.5pt;
      color: #64748b;
      border-bottom: 0.5pt solid #e2e8f0;
      padding-bottom: 4pt;
      margin-bottom: 8pt;
      vertical-align: bottom;
    }
    @bottom-left {
      content: 'librepaq.com • Horario Oficial del Centro de México (CDMX)';
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 7.5pt;
      color: #64748b;
      border-top: 0.5pt solid #e2e8f0;
      padding-top: 4pt;
      margin-top: 8pt;
      vertical-align: top;
    }
    @bottom-right {
      content: 'Página ' counter(page) ' de ' counter(pages);
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 7.5pt;
      color: #475569;
      font-weight: 600;
      border-top: 0.5pt solid #e2e8f0;
      padding-top: 4pt;
      margin-top: 8pt;
      vertical-align: top;
    }
  }
  @page :first {
    size: Letter;
    margin: 0;
    @top-left { content: none; }
    @top-right { content: none; }
    @bottom-left { content: none; }
    @bottom-right { content: none; }
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    font-size: 9.6pt;
    line-height: 1.5;
    background: #ffffff;
  }

  /* ===== PORTADA FULL-BLEED ===== */
  .cover {
    width: 8.5in;
    height: 11in;
    background: linear-gradient(155deg, #070d1a 0%, #0a1428 52%, #0f2347 100%);
    color: #f8fafc;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.75in 0.72in 0.65in 0.72in;
    page-break-after: always;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -1.4in;
    right: -1.4in;
    width: 5.2in;
    height: 5.2in;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.28) 0%, rgba(14, 165, 233, 0.08) 45%, transparent 72%);
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -1.6in;
    left: -1.2in;
    width: 4.8in;
    height: 4.8in;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16, 185, 129, 0.16) 0%, transparent 70%);
  }
  .cover-top, .cover-mid, .cover-bottom {
    position: relative;
    z-index: 2;
  }
  .cover-brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .cover-logo {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(148, 163, 184, 0.28);
    padding: 6px;
    object-fit: contain;
  }
  .brand-name {
    font-size: 20pt;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
  }
  .brand-badge {
    display: inline-block;
    margin-left: 8px;
    padding: 2px 9px;
    border-radius: 999px;
    background: #2563eb;
    color: #ffffff;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    vertical-align: middle;
  }
  .brand-sub {
    font-size: 9pt;
    color: #94a3b8;
    margin-top: 2px;
  }
  .cover-pill {
    display: inline-block;
    padding: 5px 14px;
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.22);
    border: 1px solid rgba(96, 165, 250, 0.45);
    color: #93c5fd;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 18px;
  }
  .cover-title {
    font-size: 33pt;
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.025em;
    margin: 0 0 16px 0;
    color: #ffffff;
  }
  .cover-title span {
    color: #60a5fa;
  }
  .cover-desc {
    font-size: 11.3pt;
    line-height: 1.55;
    color: #cbd5e1;
    max-width: 6.3in;
    margin: 0 0 28px 0;
  }
  .cover-pillars {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-top: 8px;
  }
  .pillar {
    background: rgba(15, 23, 42, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 12px;
    padding: 13px 15px;
  }
  .pillar-title {
    font-size: 9.5pt;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 4px;
  }
  .pillar-text {
    font-size: 8.3pt;
    color: #94a3b8;
    line-height: 1.4;
  }
  .cover-footer {
    border-top: 1px solid rgba(148, 163, 184, 0.22);
    padding-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 8.5pt;
    color: #94a3b8;
  }
  .cover-footer strong {
    color: #e2e8f0;
  }

  /* ===== CONTENIDO ===== */
  .page-break {
    page-break-before: always;
  }

  .chapter-header {
    border-bottom: 2px solid #2563eb;
    padding-bottom: 5px;
    margin: 0 0 10px 0;
    break-after: avoid;
  }
  .chapter-kicker {
    font-size: 7.6pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #2563eb;
    margin-bottom: 2px;
  }
  h1.chapter-title {
    font-size: 15.5pt;
    font-weight: 800;
    color: #0a1120;
    margin: 0;
    letter-spacing: -0.015em;
  }
  h2 {
    font-size: 10.9pt;
    font-weight: 700;
    color: #0f172a;
    margin: 11px 0 5px 0;
    break-after: avoid;
  }
  h3 {
    font-size: 9.6pt;
    font-weight: 700;
    color: #1e293b;
    margin: 9px 0 4px 0;
    break-after: avoid;
  }
  p {
    margin: 0 0 7px 0;
    color: #334155;
  }
  ul, ol {
    margin: 4px 0 9px 0;
    padding-left: 18px;
    color: #334155;
  }
  li {
    margin-bottom: 3.5px;
  }

  /* ===== ÍNDICE ===== */
  .toc-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
    margin-top: 10px;
  }
  .toc-card {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 9px 12px;
    background: #f8fafc;
    break-inside: avoid;
  }
  .toc-num {
    display: inline-block;
    font-size: 7.4pt;
    font-weight: 800;
    color: #2563eb;
    background: #dbeafe;
    padding: 1px 7px;
    border-radius: 999px;
    margin-bottom: 3px;
  }
  .toc-title {
    font-size: 9.4pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 2px;
  }
  .toc-desc {
    font-size: 8pt;
    color: #475569;
    line-height: 1.35;
  }

  /* ===== CALLOUTS & PASOS ===== */
  .callout {
    border-radius: 10px;
    padding: 8px 12px;
    margin: 7px 0 9px 0;
    font-size: 8.6pt;
    break-inside: avoid;
  }
  .callout-blue {
    background: #eff6ff;
    border-left: 4px solid #2563eb;
    color: #1e3a8a;
  }
  .callout-emerald {
    background: #ecfdf5;
    border-left: 4px solid #059669;
    color: #064e3b;
  }
  .callout-amber {
    background: #fffbeb;
    border-left: 4px solid #d97706;
    color: #78350f;
  }
  .callout-title {
    font-weight: 800;
    margin-bottom: 2px;
    font-size: 8.8pt;
  }

  .step-list {
    list-style: none;
    padding: 0;
    margin: 6px 0 9px 0;
  }
  .step-list li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 6.5px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 9px;
    background: #ffffff;
    margin-bottom: 5.5px;
    break-inside: avoid;
  }
  .step-num {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: #0a1120;
    color: #ffffff;
    font-size: 8.5pt;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }
  .step-body strong {
    color: #0f172a;
  }

  .card-grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 9px;
    margin: 6px 0 9px 0;
  }
  .card-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 6px 0 9px 0;
  }
  .info-card {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 8px 10.5px;
    background: #f8fafc;
    break-inside: avoid;
  }
  .info-card-title {
    font-size: 9.1pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
  }
  .info-card p {
    font-size: 8.3pt;
    margin: 0;
    color: #475569;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 9px 0;
    font-size: 8.4pt;
  }
  thead th {
    background: #0f172a;
    color: #f8fafc;
    text-align: left;
    padding: 5.5px 8px;
    font-weight: 700;
    font-size: 7.8pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  thead th:first-child { border-top-left-radius: 6px; }
  thead th:last-child { border-top-right-radius: 6px; }
  tbody td {
    padding: 4.5px 8px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
    color: #334155;
  }
  tbody tr:nth-child(even) {
    background: #f8fafc;
  }
  tr {
    break-inside: avoid;
  }

  kbd {
    display: inline-block;
    padding: 1px 5px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 7.9pt;
    font-weight: 700;
    color: #0f172a;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-bottom-width: 2px;
    border-radius: 4px;
    white-space: nowrap;
  }
  code {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 8.3pt;
    background: #f1f5f9;
    color: #1d4ed8;
    padding: 1px 4px;
    border-radius: 4px;
  }
  .badge {
    display: inline-block;
    padding: 1.5px 7px;
    border-radius: 999px;
    font-size: 7.4pt;
    font-weight: 700;
  }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
  .badge-emerald { background: #d1fae5; color: #047857; }
  .badge-amber { background: #fef3c7; color: #b45309; }
  .badge-slate { background: #e2e8f0; color: #334155; }

  .flow-strip {
    display: flex;
    align-items: stretch;
    gap: 6px;
    margin: 9px 0 12px 0;
    break-inside: avoid;
  }
  .flow-step {
    flex: 1;
    border: 1px solid #bfdbfe;
    background: #eff6ff;
    border-radius: 9px;
    padding: 8px 8px;
    text-align: center;
  }
  .flow-step-num {
    font-size: 7.4pt;
    font-weight: 800;
    color: #2563eb;
    text-transform: uppercase;
  }
  .flow-step-label {
    font-size: 8.5pt;
    font-weight: 700;
    color: #0f172a;
    margin: 2px 0;
  }
  .flow-step-sub {
    font-size: 7.4pt;
    color: #475569;
  }

  .checklist {
    list-style: none;
    padding: 0;
    margin: 4px 0 8px 0;
  }
  .checklist li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 3.5px 8px;
    border-bottom: 1px dashed #e2e8f0;
    font-size: 8.4pt;
    break-inside: avoid;
  }
  .chk-box {
    width: 13px;
    height: 13px;
    border: 1.5px solid #2563eb;
    border-radius: 3px;
    flex-shrink: 0;
    margin-top: 2px;
  }
</style>
</head>
<body>

<!-- ==================== PORTADA ==================== -->
<section class="cover">
  <div class="cover-top">
    <div class="cover-brand">
      ${logoDataUri ? `<img src="${logoDataUri}" alt="LibrePaq Pro" class="cover-logo" />` : ''}
      <div>
        <div class="brand-name">LibrePaq <span class="brand-badge">PRO</span></div>
        <div class="brand-sub">Sistema Contable y Fiscal Inteligente en la Nube</div>
      </div>
    </div>
  </div>

  <div class="cover-mid">
    <div class="cover-pill">Guía Práctica de Inicio y Operación</div>
    <h1 class="cover-title">Manual de Usuario<br /><span>LibrePaq Pro</span></h1>
    <p class="cover-desc">
      Todo lo que necesitas para operar tu despacho contable, empresas PyME o contribuyentes RESICO:
      descarga masiva del SAT, Auto-Póliza inteligente, conciliación bancaria múltiple con IA,
      cierre fiscal del Día 17, 4 Estados Financieros NIF, Declaración Anual y Anexo 24 en .zip oficial.
    </p>

    <div class="cover-pillars">
      <div class="pillar">
        <div class="pillar-title">1. Alta con CSF/XML y Equipo del Despacho</div>
        <div class="pillar-text">Crea empresas en segundos desde tu CSF (PDF) o CFDI 4.0 con catálogo SAT o RESICO, e invita a tu equipo o clientes por rol.</div>
      </div>
      <div class="pillar">
        <div class="pillar-title">2. Bóveda ADD, 69-B y Reglas IA</div>
        <div class="pillar-text">Descarga Emitidos + Recibidos del SAT, valida estatus en lote y Padrón 69-B en la nube, y automatiza pólizas por RFC y No Deducibles (801).</div>
      </div>
      <div class="pillar">
        <div class="pillar-title">3. Bancos Varios a 1, CxC/CxP y Nómina</div>
        <div class="pillar-text">Importa estados de cuenta PDF con IA, concilia múltiples pólizas (Varios a 1), controla cartera PPD por antigüedad y amarra Nómina 1.2, SUA e ISN.</div>
      </div>
      <div class="pillar">
        <div class="pillar-title">4. Día 17 RESICO, NIF y Anual</div>
        <div class="pillar-text">Flujo de efectivo RESICO con semáforo de topes, prorrateo IVA Art. 5, 4 Estados NIF, Declaración Anual y Anexo 24 en .zip oficial.</div>
      </div>
    </div>
  </div>

  <div class="cover-bottom">
    <div class="cover-footer">
      <div>
        <strong>Edición Noviembre 2026 • Actualizada</strong> • Plataforma Web Multi-RFC<br />
        Normativa SAT: CFDI 4.0 • Complemento Pagos 2.0 • Nómina 1.2 • Anexo 24
      </div>
      <div style="text-align: right;">
        <strong>librepaq.com</strong><br />
        Horario oficial: América / Ciudad de México (CDMX)
      </div>
    </div>
  </div>
</section>

<!-- ==================== ÍNDICE Y VISIÓN GENERAL ==================== -->
<div class="chapter-header">
  <div class="chapter-kicker">Mapa del Manual</div>
  <h1 class="chapter-title">Contenido y Ruta Recomendada de Aprendizaje</h1>
</div>

<p>
  Este manual está diseñado para contadores, auxiliares y dueños de negocio que inician en <strong>LibrePaq Pro</strong>.
  Sigue los capítulos en orden para configurar tu primera empresa, descargar tus CFDIs y emitir tus primeros reportes en menos de 15 minutos.
</p>

<div class="toc-grid">
  <div class="toc-card">
    <div class="toc-num">Capítulo 1</div>
    <div class="toc-title">Registro, Acceso y Navegación</div>
    <div class="toc-desc">Creación de cuenta, espacios multi-RFC, periodos contables (P01–P13), candado SAT y Paleta de Comandos.</div>
  </div>
  <div class="toc-card">
    <div class="toc-num">Capítulo 2</div>
    <div class="toc-title">Alta de tu Primera Empresa Fiscal</div>
    <div class="toc-desc">Asistente guiado de 5 pasos, autocompletado con CSF PDF o CFDI XML, catálogo base y e.firma opcional.</div>
  </div>
  <div class="toc-card">
    <div class="toc-num">Capítulo 3</div>
    <div class="toc-title">Tablero Fiscal y Ciclo de Cierre</div>
    <div class="toc-desc">Lectura de indicadores clave del mes, alertas de pendientes, checklist de cierre y Dossier Ejecutivo.</div>
  </div>
  <div class="toc-card">
    <div class="toc-num">Capítulo 4</div>
    <div class="toc-title">Bóveda Digital (ADD) y Descarga SAT</div>
    <div class="toc-desc">Descarga SAT Emitidos + Recibidos en paquetes grandes, validación en lote (canceladas con póliza) y Padrón 69-B en la nube.</div>
  </div>
  <div class="toc-card">
    <div class="toc-num">Capítulo 5</div>
    <div class="toc-title">Auto-Póliza, Reglas y Partida Doble</div>
    <div class="toc-desc">Reglas aprendidas por RFC/ClaveProdServ, separación a No Deducibles (801), atajos contables y Cierre Anual (Periodo 13).</div>
  </div>
  <div class="toc-card">
    <div class="toc-num">Capítulo 6</div>
    <div class="toc-title">Catálogo de Cuentas y Libro Mayor</div>
    <div class="toc-desc">Árbol jerárquico Anexo 24, códigos agrupadores SAT, importación CSV y auxiliar interactivo.</div>
  </div>
  <div class="toc-card">
    <div class="toc-num">Capítulo 7</div>
    <div class="toc-title">Bancos, CxC/CxP, Nómina, Inventario y Día 17</div>
    <div class="toc-desc">PDF bancario con IA, conciliación múltiple (Varios a 1), PPD por antigüedad, Nómina/SUA/ISN, Inventario y Cédula Día 17 RESICO e IVA.</div>
  </div>
  <div class="toc-card">
    <div class="toc-num">Capítulo 8</div>
    <div class="toc-title">4 Estados NIF, Anual y Anexo 24 .zip</div>
    <div class="toc-desc">Flujos NIF B-2, Capital NIF B-4, Comparativo, Declaración Anual (INPC, PTU, ISR Neto, CUCA/CUFIN) y Anexo 24 en .zip oficial.</div>
  </div>
  <div class="toc-card">
    <div class="toc-num">Capítulo 9</div>
    <div class="toc-title">Equipo del Despacho, Bitácora y Respaldos</div>
    <div class="toc-desc">Acceso por roles (Socio, Contador, Auxiliar, Cliente (Solo lectura)), permisos por empresa, bitácora en español, e.firma y respaldos integrales.</div>
  </div>
  <div class="toc-card">
    <div class="toc-num">Capítulo 10</div>
    <div class="toc-title">Atajos de Teclado y Checklist</div>
    <div class="toc-desc">Tabla maestra imprimible de atajos, lista de arranque rápido, cierre mensual y soporte técnico.</div>
  </div>
</div>

<h2>Flujo de Trabajo Mensual en LibrePaq Pro</h2>
<div class="flow-strip">
  <div class="flow-step">
    <div class="flow-step-num">Paso 1</div>
    <div class="flow-step-label">Descarga / Carga</div>
    <div class="flow-step-sub">XML CFDI 4.0 al ADD</div>
  </div>
  <div class="flow-step">
    <div class="flow-step-num">Paso 2</div>
    <div class="flow-step-label">Auto-Póliza</div>
    <div class="flow-step-sub">Contabilización cuadrada</div>
  </div>
  <div class="flow-step">
    <div class="flow-step-num">Paso 3</div>
    <div class="flow-step-label">Bancos y DIOT</div>
    <div class="flow-step-sub">Conciliación y proveedores</div>
  </div>
  <div class="flow-step">
    <div class="flow-step-num">Paso 4</div>
    <div class="flow-step-label">Cédula Día 17</div>
    <div class="flow-step-sub">Determinación ISR e IVA</div>
  </div>
  <div class="flow-step">
    <div class="flow-step-num">Paso 5</div>
    <div class="flow-step-label">Reportes y Cierre</div>
    <div class="flow-step-sub">Anexo 24, Excel y Candado</div>
  </div>
</div>

<!-- ==================== CAPÍTULO 1 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 1</div>
  <h1 class="chapter-title">Registro, Acceso y Conceptos Clave</h1>
</div>

<h2>1.1 Creación de Cuenta e Inicio de Sesión</h2>
<p>
  Ingresa a <strong>https://librepaq.com</strong> desde cualquier navegador moderno (Chrome, Edge, Safari o Firefox). Funciona directo en la nube desde Windows, Mac o móvil, sin instalaciones ni servidores locales.
</p>
<ol class="step-list">
  <li>
    <div class="step-num">1</div>
    <div class="step-body"><strong>Elige tu método de acceso:</strong> haz clic en <em>Iniciar Sesión / Crear Cuenta</em>. Puedes acceder en un clic con <strong>Continuar con Google</strong> o registrarte con tu correo electrónico y contraseña.</div>
  </li>
  <li>
    <div class="step-num">2</div>
    <div class="step-body"><strong>Confirma tu correo (registro tradicional):</strong> si te registraste con correo y contraseña, revisa tu bandeja de entrada y abre el enlace de confirmación para activar tu despacho en la nube.</div>
  </li>
  <li>
    <div class="step-num">3</div>
    <div class="step-body"><strong>Recuperación segura:</strong> si olvidas tu contraseña, utiliza el enlace <em>¿Olvidaste tu contraseña?</em> dentro de la ventana de acceso para recibir un enlace de restablecimiento.</div>
  </li>
</ol>

<h2>1.2 Entorno Multi-RFC, Periodos y Horario Oficial</h2>
<div class="card-grid-3">
  <div class="info-card">
    <div class="info-card-title">Despacho Multi-RFC (<kbd>Ctrl</kbd>+<kbd>E</kbd>)</div>
    <p>Administra múltiples personas físicas o morales bajo una sola cuenta. Cada empresa cuenta con su propia bóveda, catálogo, pólizas y bancos totalmente aislados.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Periodos P01–P12 y P13</div>
    <p>Cambia de mes desde la barra superior o con <kbd>Alt</kbd>+<kbd>[</kbd> y <kbd>Alt</kbd>+<kbd>]</kbd>. Incluye <strong>Periodo 13 (Ajuste/Cierre Anual)</strong> para traspasar resultados del ejercicio.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Horario Oficial CDMX</div>
    <p>Todas las fechas calendario, vencimientos del Día 17 y límites de descarga SAT operan sobre el <strong>Horario Oficial del Centro de México (CDMX)</strong>, evitando desfases tras las 18:00 h.</p>
  </div>
</div>

<h2>1.3 Mapa de los 7 Módulos Principales</h2>
<table style="margin: 4px 0 6px 0; font-size: 8.1pt;">
  <thead>
    <tr>
      <th style="width: 11%;">Atajo</th>
      <th style="width: 27%;">Módulo</th>
      <th>Función Principal</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 3.5px 7px;"><kbd>Alt</kbd>+<kbd>1</kbd></td>
      <td style="padding: 3.5px 7px;"><strong>Tablero Fiscal</strong></td>
      <td style="padding: 3.5px 7px;">Indicadores clave del mes, ruta de arranque, ciclo de cierre y acceso al panel de Entregables Ejecutivos.</td>
    </tr>
    <tr>
      <td style="padding: 3.5px 7px;"><kbd>Alt</kbd>+<kbd>2</kbd></td>
      <td style="padding: 3.5px 7px;"><strong>Bóveda Digital (ADD)</strong></td>
      <td style="padding: 3.5px 7px;">Descarga Masiva SAT (Emitidos + Recibidos), validación SAT en lote, Padrón 69-B en la nube y Auto-Póliza con reglas.</td>
    </tr>
    <tr>
      <td style="padding: 3.5px 7px;"><kbd>Alt</kbd>+<kbd>3</kbd></td>
      <td style="padding: 3.5px 7px;"><strong>Pólizas Contables</strong></td>
      <td style="padding: 3.5px 7px;">Captura y edición de pólizas de Ingresos, Egresos, Diario y Periodo 13 con cuadre automático y No Deducibles (801).</td>
    </tr>
    <tr>
      <td style="padding: 3.5px 7px;"><kbd>Alt</kbd>+<kbd>4</kbd></td>
      <td style="padding: 3.5px 7px;"><strong>Catálogo de Cuentas</strong></td>
      <td style="padding: 3.5px 7px;">Árbol de cuentas Anexo 24 con código agrupador SAT, importación CSV y Libro Mayor.</td>
    </tr>
    <tr>
      <td style="padding: 3.5px 7px;"><kbd>Alt</kbd>+<kbd>5</kbd></td>
      <td style="padding: 3.5px 7px;"><strong>Bancos, DIOT y Fiscal</strong></td>
      <td style="padding: 3.5px 7px;">Conciliación múltiple (Varios a 1) y PDF con IA, DIOT (.txt oficial SAT), Padrón 69-B, Activos INPC, Cédula Día 17 RESICO, CxC/CxP PPD, Nómina/ISN e Inventario.</td>
    </tr>
    <tr>
      <td style="padding: 3.5px 7px;"><kbd>Alt</kbd>+<kbd>6</kbd></td>
      <td style="padding: 3.5px 7px;"><strong>Estados Financieros</strong></td>
      <td style="padding: 3.5px 7px;">4 Estados NIF (incl. Flujos B-2, Capital B-4 y Comparativo), Declaración Anual, Anexo 24 en .zip, Dossier de Cierre y Dossier Ejecutivo (.xlsx / Paquete .ZIP / PDF).</td>
    </tr>
    <tr>
      <td style="padding: 3.5px 7px;"><kbd>Alt</kbd>+<kbd>7</kbd></td>
      <td style="padding: 3.5px 7px;"><strong>Configuración y Empresa</strong></td>
      <td style="padding: 3.5px 7px;">Directorio multi-RFC, reglas contables, candado mensual, e.firma, parámetros Día 17, respaldos integrales y 7. Equipo y Bitácora.</td>
    </tr>
  </tbody>
</table>

<div class="callout callout-blue" style="margin: 5px 0 0 0; padding: 7px 11px;">
  <div class="callout-title">Tip de Productividad: Paleta de Comandos (<kbd>Ctrl</kbd>+<kbd>K</kbd>), Candado y Modo Cliente (Solo Lectura)</div>
  Presiona <kbd>Ctrl</kbd>+<kbd>K</kbd> en cualquier pantalla para buscar cuentas, saltar entre módulos o ejecutar acciones sin soltar el teclado. Activa el <strong>Candado de Periodo</strong> desde la cabecera o en <em>Configuración y Empresa</em> al cerrar un mes ante el SAT. Si ingresas con rol <strong>Cliente (Solo lectura)</strong>, verás el aviso superior informativo y podrás navegar por todos los periodos, pólizas, XML y reportes en consulta sin riesgo de alterar la contabilidad.
</div>

<!-- ==================== CAPÍTULO 2 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 2</div>
  <h1 class="chapter-title">Alta de tu Primera Empresa Fiscal (Asistente de 5 Pasos)</h1>
</div>

<p>
  Al ingresar por primera vez con tu cuenta nueva, verás la pantalla de bienvenida para registrar tu primera empresa fiscal. También puedes agregar más empresas en cualquier momento desde el selector de empresa (<kbd>Ctrl</kbd>+<kbd>E</kbd>) o desde <strong>Configuración → 1. Directorio</strong>.
</p>

<ol class="step-list">
  <li>
    <div class="step-num">1</div>
    <div class="step-body">
      <strong>Paso 1 — Identidad SAT (Alta Manual, CSF PDF o XML CFDI):</strong><br />
      Puedes teclear los datos manualmente o acelerar el registro arrastrando tu <strong>Constancia de Situación Fiscal (PDF)</strong> o cualquier <strong>factura XML CFDI 4.0</strong> de la empresa. LibrePaq extraerá automáticamente el <strong>RFC</strong> (con verificación automática del dígito verificador SAT), <strong>Razón Social</strong>, <strong>Tipo de Persona</strong> (Moral o Física), <strong>Régimen Fiscal SAT</strong> y <strong>Código Postal</strong>. Define el <em>Ejercicio</em> y <em>Periodo</em> inicial.<br />
      <span class="badge badge-emerald">Atajo</span> Si deseas empezar de inmediato, haz clic en <strong>Creación Rápida</strong> desde este mismo paso; podrás ajustar bancos y e.firma después.
    </div>
  </li>
  <li>
    <div class="step-num">2</div>
    <div class="step-body">
      <strong>Paso 2 — Catálogo Contable Anexo 24 o Simplificado RESICO:</strong><br />
      Selecciona el <strong>Catálogo General SAT Anexo 24</strong> (PyMEs y Régimen General) o el <strong>Catálogo Simplificado RESICO / Servicios</strong> (optimizado para flujo de efectivo, retención 1.25% y operación ágil). Todas las cuentas ya incluyen su <strong>Código Agrupador SAT</strong> y naturaleza contable listos para emitir Anexo 24 y automatizar pólizas.
    </div>
  </li>
  <li>
    <div class="step-num">3</div>
    <div class="step-body">
      <strong>Paso 3 — Tesorería y Cuenta Bancaria Inicial (Opcional):</strong><br />
      Captura el nombre del banco, número de cuenta o CLABE y el saldo inicial. Si marcas la casilla <strong>Generar Póliza de Apertura</strong>, el sistema registrará automáticamente el asiento contable de apertura cuadrado.
    </div>
  </li>
  <li>
    <div class="step-num">4</div>
    <div class="step-body">
      <strong>Paso 4 — Vinculación de e.firma / FIEL (Opcional):</strong><br />
      Sube tus archivos <code>.cer</code>, <code>.key</code> y contraseña para habilitar la <strong>Descarga Masiva directa del SAT</strong>. El sistema verifica matemáticamente que el certificado y la llave coincidan y resguarda la llave cifrada. Si no tienes los archivos a la mano, selecciona omitir y cárgala después en <em>Configuración y Empresa → 3. e.Firma / SAT</em>.
    </div>
  </li>
  <li>
    <div class="step-num">5</div>
    <div class="step-body">
      <strong>Paso 5 — Revisión Final y Creación:</strong><br />
      Verifica el resumen de identidad fiscal, catálogo y periodo de inicio, y confirma. En segundos se creará el entorno contable de tu empresa y entrarás al <strong>Tablero Fiscal</strong>.
    </div>
  </li>
</ol>

<div class="callout callout-amber">
  <div class="callout-title">Validación de RFC y Régimen Fiscal</div>
  Seleccionar correctamente si la empresa es <strong>Persona Moral (ej. 601 General de Ley, 626 RESICO PM)</strong> o <strong>Persona Física (ej. 612 Actividades Empresariales, 626 RESICO PF)</strong> determina el motor de cálculo automático del ISR provisional en la Cédula del Día 17.
</div>

<!-- ==================== CAPÍTULO 3 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 3</div>
  <h1 class="chapter-title">Tablero Fiscal (<kbd>Alt</kbd>+<kbd>1</kbd>) y Ciclo de Cierre Mensual</h1>
</div>

<p>
  El <strong>Tablero Fiscal</strong> es tu centro de mando para supervisar la salud financiera y el avance del cierre del mes activo sin navegar por múltiples pantallas.
</p>

<h2>3.1 Componentes Principales del Tablero</h2>
<div class="card-grid-2">
  <div class="info-card">
    <div class="info-card-title">Indicadores Clave del Periodo</div>
    <p>Muestra en tiempo real <strong>Ingresos del periodo</strong>, <strong>Egresos / Costos</strong>, <strong>Utilidad Operativa y Margen %</strong>, <strong>Saldo en Bancos</strong> y el contador de <strong>CFDIs pendientes por contabilizar</strong>. Haz clic en cualquier cifra clave para consultar su auxiliar de Libro Mayor.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Ruta de Arranque y Auditoría Rápida</div>
    <p>Cuando la empresa es nueva, la <strong>Ruta de Arranque Guiada</strong> te lleva paso a paso desde la carga de tus primeros XML hasta tu primera balanza. La barra de auditoría resalta pendientes críticos antes de declarar.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Ciclo de Cierre Mensual</div>
    <p>Evalúa automáticamente los controles clave del mes: balanza cuadrada, CFDIs contabilizados, conciliación bancaria y determinación fiscal, indicando el porcentaje de avance del cierre.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Tendencia y Acceso a Entregables</div>
    <p>Visualiza la evolución mensual de ingresos vs. gastos, revisa las pólizas recientes del periodo y abre el panel de <strong>Entregables Ejecutivos</strong> en 1 clic desde el encabezado.</p>
  </div>
</div>

<h2>3.2 Cómo Interpretar el Avance de Cierre antes de Declarar</h2>
<table>
  <thead>
    <tr>
      <th style="width: 28%;">Control Supervisado</th>
      <th>Qué valida automáticamente LibrePaq Pro</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Bóveda ADD sin pendientes</strong></td>
      <td>Que todos los CFDIs Emitidos y Recibidos de Ingreso/Egreso del mes tengan póliza contable asociada (excluyendo traslados en $0.00 y cancelados).</td>
    </tr>
    <tr>
      <td><strong>Partida Doble y Balanza</strong></td>
      <td>Que la suma total de cargos y abonos de todas las pólizas del periodo mantenga diferencia exacta de <code>$0.00</code>.</td>
    </tr>
    <tr>
      <td><strong>Conciliación Bancaria</strong></td>
      <td>Que los movimientos cargados en el estado de cuenta CSV o PDF del mes estén empatados contra pólizas de bancos.</td>
    </tr>
    <tr>
      <td><strong>Provisión Fiscal Día 17</strong></td>
      <td>Que la determinación de ISR provisional e IVA definitivo se haya revisado y provisionado antes del vencimiento legal.</td>
    </tr>
  </tbody>
</table>

<div class="callout callout-blue">
  <div class="callout-title">Acceso Directo a Póliza Automática y Auxiliares</div>
  Desde el propio Tablero puedes contabilizar facturas pendientes de forma individual o en lote sin cambiar de módulo, o hacer clic sobre las pólizas recientes para auditar sus cargos y abonos en el acto.
</div>

<!-- ==================== CAPÍTULO 4 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 4</div>
  <h1 class="chapter-title">Bóveda Digital (ADD) y Descarga Masiva SAT (<kbd>Alt</kbd>+<kbd>2</kbd>)</h1>
</div>

<p>
  El módulo <strong>Bóveda Digital (ADD)</strong> centraliza todos los comprobantes <strong>CFDI 4.0</strong> (Ingresos, Egresos/Notas de Crédito, Complementos de Pagos 2.0, Nómina 1.2 y Traslados) y los conecta directamente con tu contabilidad y validaciones fiscales ante el SAT.
</p>

<h2>4.1 Dos Formas de Alimentar tu Bóveda ADD</h2>
<div class="card-grid-2">
  <div class="info-card">
    <div class="info-card-title">A. Carga Manual de XML o ZIP (<kbd>Alt</kbd>+<kbd>U</kbd>)</div>
    <p>Arrastra archivos <code>.xml</code> o paquetes <code>.zip</code> sobre la zona superior o presiona <kbd>Alt</kbd>+<kbd>U</kbd> (usa <kbd>Alt</kbd>+<kbd>S</kbd> para captura manual). Detecta si el CFDI es <strong>Emitido</strong> o <strong>Recibido</strong> por RFC, evita duplicados por UUID y desglosa IVA y retenciones.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">B. Descarga SAT EMITIDOS + RECIBIDOS (Paquetes Grandes)</div>
    <p>Abre el panel <strong>Descarga Masiva directa del SAT</strong> con tu e.firma. Elige <em>Recibidos</em>, <em>Emitidos</em> o <strong>Ambos (EMITIDOS + RECIBIDOS)</strong>, selecciona rangos rápidos (<em>Mes Actual</em>, <em>Mes Anterior</em>, <em>Bimestre</em>) y solicita la descarga. Al verificar, integra incluso <strong>paquetes ZIP grandes del SAT</strong> sin interrupciones ni duplicados.</p>
  </div>
</div>

<div class="callout callout-emerald">
  <div class="callout-title">Protección Automática contra Error 301 del SAT</div>
  El SAT rechaza solicitudes cuya fecha final sea posterior al día de hoy. LibrePaq ajusta automáticamente los rangos usando el <strong>horario oficial de la Ciudad de México</strong> para evitar rechazos incluso al trabajar por la noche después de las 18:00 horas.
</div>

<h2>4.2 Validación de Estatus SAT en Lote, Padrón 69-B y Visor CFDI 4.0</h2>
<ul>
  <li><strong>Validación de estatus SAT en lote:</strong> selecciona varios comprobantes (o todo el mes) y haz clic en <strong>Validar SAT en Lote</strong>. LibrePaq consulta la vigencia oficial (<em>Vigente</em> o <em>Cancelado</em>) y, si detecta facturas canceladas con póliza activa, muestra una alerta con el botón <strong>Localizar cancelado</strong> para ubicarlas al instante. Los CFDIs cancelados (<code>CANCELADO</code>) o de Traslado (<code>T</code>) quedan protegidos contra contabilización accidental.</li>
  <li><strong>Padrón 69-B completo en la nube:</strong> cada RFC emisor o receptor se cruza automáticamente contra el padrón oficial del <strong>Artículo 69-B del CFF (EFOS)</strong>, mostrando alertas preventivas en la tabla, en la vista previa y al contabilizar.</li>
  <li><strong>Visor CFDI 4.0 y verificación directa en el SAT:</strong> abre la vista previa desde cualquier comprobante para revisar la validación del dígito verificador del RFC (<em>RFC Válido / Revisar</em>), inspeccionar nodos XML (con aviso explícito si es reconstruido), consultar el <strong>Sello Digital real</strong> o abrir el portal del SAT. Filtra por periodo, tipo o método (<code>PUE</code>/<code>PPD</code>) y busca con <kbd>/</kbd> o <kbd>Alt</kbd>+<kbd>F</kbd>.</li>
</ul>

<h2>4.3 Auto-Póliza en 1 Clic o en Lote</h2>
<ol class="step-list">
  <li>
    <div class="step-num">1</div>
    <div class="step-body"><strong>Contabilización individual (<kbd>C</kbd>):</strong> haz clic en <em>Contabilizar</em> en cualquier CFDI pendiente. La vista previa valida <strong>Sumas Iguales Verificadas</strong> en tiempo real, te permite ajustar cuentas y porcentaje deducible (<code>801</code>) y aplica los cambios de inmediato al confirmar.</div>
  </li>
  <li>
    <div class="step-num">2</div>
    <div class="step-body"><strong>Contabilización masiva en lote:</strong> marca múltiples comprobantes pendientes y ejecútalos en lote aplicando automáticamente tus <strong>reglas contables y % deducible (801)</strong>. El motor resuelve <strong>moneda extranjera (USD/EUR)</strong>, <strong>Nómina 1.2</strong> y <strong>Complementos de Pago 2.0</strong> (incluyendo tasas exentas mixtas e IEPS en notas de crédito).</div>
  </li>
</ol>

<!-- ==================== CAPÍTULO 5 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 5</div>
  <h1 class="chapter-title">Auto-Póliza Inteligente, Reglas Aprendidas y Pólizas (<kbd>Alt</kbd>+<kbd>3</kbd>)</h1>
</div>

<p>
  Combina la automatización de <strong>reglas contables aprendidas</strong> con la captura ergonómica de <strong>Pólizas Contables</strong> (<em>Ingreso</em>, <em>Egreso</em>, <em>Diario</em> y <em>Periodo 13 de Cierre</em>). El sistema impide guardar pólizas descuadradas, asegurando equilibrio estricto (<em>Debe = Haber</em>).
</p>

<h2>5.1 Reglas Aprendidas por RFC / ClaveProdServ y No Deducibles (801)</h2>
<div class="card-grid-2">
  <div class="info-card">
    <div class="info-card-title">Reglas Recordadas por RFC y ClaveProdServ</div>
    <p>Al contabilizar un CFDI en la Bóveda ADD, activa la casilla <strong>Recordar regla contable para este RFC</strong>. En futuras facturas del mismo RFC o <code>ClaveProdServ</code>, LibrePaq aplicará la cuenta contable aprendida de forma automática. También puedes crear y priorizar reglas desde <em>Configuración → 2. Empresa</em>.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">División Automática a No Deducibles (801)</div>
    <p>En gastos parcialmente deducibles conforme al <strong>Art. 28 LISR</strong> (ej. consumos, viáticos o automóviles), elige el <strong>% Deducible</strong> (<code>100%</code>, <code>50%</code>, <code>25%</code>, <code>10%</code> o <code>0%</code>). El porcentaje elegido se refleja en la vista previa y se aplica al contabilizar (incluso si no guardas la regla permanente).</p>
  </div>
</div>

<h2>5.2 Captura Manual de Póliza Paso a Paso (Sin Soltar el Teclado)</h2>
<ol class="step-list">
  <li>
    <div class="step-num">1</div>
    <div class="step-body"><strong>Abre el editor (<kbd>Alt</kbd>+<kbd>N</kbd> o <kbd>Insert</kbd>):</strong> elige tipo de póliza, fecha dentro del periodo activo y concepto. El folio consecutivo se asigna automáticamente.</div>
  </li>
  <li>
    <div class="step-num">2</div>
    <div class="step-body"><strong>Asientos Tipo y captura rápida:</strong> presiona <kbd>Alt</kbd>+<kbd>1</kbd> (Cobro), <kbd>Alt</kbd>+<kbd>2</kbd> (Pago) o <kbd>Alt</kbd>+<kbd>3</kbd> (Nómina) para precargar cuentas. Navega con <kbd>Tab</kbd>, busca cuentas con <kbd>F2</kbd>, copia el concepto superior con <kbd>"</kbd>/<kbd>F3</kbd>, desglosa <strong>IVA 16%</strong> con <kbd>F4</kbd> y auto-cuadra con <kbd>=</kbd>.</div>
  </li>
  <li>
    <div class="step-num">3</div>
    <div class="step-body"><strong>Vincula CFDI / Pedimento y guarda (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>):</strong> asocia un UUID o un <strong>Pedimento de Importación</strong>; cuando la diferencia sea <code>$0.00</code>, presiona <kbd>Ctrl</kbd>+<kbd>Enter</kbd> para guardar y actualizar saldos al instante.</div>
  </li>
</ol>

<h2>5.3 Herramientas Avanzadas en el Listado de Pólizas</h2>
<table>
  <thead>
    <tr>
      <th style="width: 28%;">Herramienta</th>
      <th>Descripción y Beneficio</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Duplicar Póliza (<kbd>Ctrl</kbd>+<kbd>D</kbd>)</strong></td>
      <td>Clona los movimientos de una póliza recurrente (ej. renta, depreciación, nómina quincenal) asignándole un nuevo folio consecutivo.</td>
    </tr>
    <tr>
      <td><strong>Filtros y Modo Compacto</strong></td>
      <td>Filtra por tipo (Ingreso/Egreso/Diario), origen (Manual o Auto-Póliza ADD) o texto libre; activa <em>Modo Compacto</em> para auditar decenas de pólizas por pantalla.</td>
    </tr>
    <tr>
      <td><strong>Consulta directa al Libro Mayor</strong></td>
      <td>Haz clic sobre cualquier cuenta dentro de una póliza para abrir al instante su auxiliar histórico sin salir del módulo.</td>
    </tr>
    <tr>
      <td><strong>Póliza de Cierre Anual (Periodo 13)</strong></td>
      <td>Al posicionarte en el cierre del ejercicio, utiliza <strong>Cierre Anual</strong> para saldar automáticamente cuentas de resultados contra <em>Resultado del Ejercicio (301-02-001)</em> en el Periodo 13.</td>
    </tr>
    <tr>
      <td><strong>Exportación CSV</strong></td>
      <td>Descarga las pólizas filtradas en archivo CSV compatible con Excel para revisiones o auditorías externas.</td>
    </tr>
  </tbody>
</table>

<!-- ==================== CAPÍTULO 6 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 6</div>
  <h1 class="chapter-title">Catálogo de Cuentas Anexo 24 y Libro Mayor (<kbd>Alt</kbd>+<kbd>4</kbd>)</h1>
</div>

<p>
  El <strong>Catálogo de Cuentas</strong> organiza la estructura contable de tu empresa conforme a la taxonomía del <strong>Anexo 24 del SAT</strong> (ya sea en modalidad General o Simplificada RESICO), manteniendo visibles los saldos acumulados y movimientos del periodo activo.
</p>

<div class="card-grid-2">
  <div class="info-card">
    <div class="info-card-title">Alta y Subcuentas Consecutivas (<kbd>Insert</kbd>)</div>
    <p>Selecciona cualquier cuenta acumuladora y presiona <kbd>Insert</kbd> (o <kbd>Alt</kbd>+<kbd>N</kbd> para cuenta nueva) y el sistema sugiere automáticamente el siguiente código consecutivo respetando la máscara de la empresa (ej. <code>105-01-002</code>) heredando tipo y naturaleza.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Navegación en Árbol y Filtros</div>
    <p>Busca con <kbd>F3</kbd>, muévete con <kbd>↑</kbd> / <kbd>↓</kbd>, pliega o despliega con <kbd>←</kbd> / <kbd>→</kbd>, edita con <kbd>Enter</kbd> o <kbd>F2</kbd> y abre el auxiliar con <kbd>Espacio</kbd>. Filtra por rubro o por cuentas con movimientos.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Importación y Exportación CSV</div>
    <p>Si migras desde otro sistema contable, importa tu catálogo de cuentas en formato CSV o exporta el actual como respaldo o plantilla de trabajo.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Auxiliar / Libro Mayor Instantáneo</div>
    <p>Haz clic en el saldo o botón de auxiliar de cualquier cuenta para abrir la ventana de <strong>Libro Mayor</strong> con saldo inicial, cargos, abonos, saldo corrido y referencia directa a cada póliza.</p>
  </div>
</div>

<h2>6.1 Estructura Base por Rubros y Códigos Agrupadores SAT</h2>
<table>
  <thead>
    <tr>
      <th style="width: 16%;">Rango</th>
      <th style="width: 28%;">Rubro Contable</th>
      <th>Uso principal en la automatización fiscal y contable</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>100 – 199</code></td>
      <td><strong>Activo</strong></td>
      <td>Bancos (<code>102</code>), Clientes (<code>105</code>), Inventarios (<code>115</code>), IVA acreditable/pendiente y Activos Fijos con depreciación acumulada.</td>
    </tr>
    <tr>
      <td><code>200 – 299</code></td>
      <td><strong>Pasivo</strong></td>
      <td>Proveedores (<code>201</code>), Acreedores, Impuestos por pagar (ISR/IVA/ISN/IMSS) e IVA trasladado cobrado vs. pendiente.</td>
    </tr>
    <tr>
      <td><code>300 – 399</code></td>
      <td><strong>Capital Contable</strong></td>
      <td>Capital social, Reservas, Resultados de ejercicios anteriores y Resultado del Ejercicio (<code>301-02-001</code>) para cierre en Periodo 13.</td>
    </tr>
    <tr>
      <td><code>400 – 699</code></td>
      <td><strong>Ingresos, Costos y Gastos</strong></td>
      <td>Ventas/Servicios, Costo de Ventas (<code>501</code>), Gastos Generales (<code>601</code>), Sueldos/IMSS y cuentas vinculadas a reglas por RFC.</td>
    </tr>
    <tr>
      <td><code>801</code></td>
      <td><strong>No Deducibles</strong></td>
      <td>Cuenta receptora automática de la proporción no deducible en gastos parciales (Art. 28 LISR) y conciliación fiscal anual.</td>
    </tr>
  </tbody>
</table>

<div class="callout callout-blue">
  <div class="callout-title">Integridad Referencial, Inventarios (115) y Confirmación Segura</div>
  Las cuentas con movimientos quedan protegidas contra eliminación accidental, los catálogos incluyen cuentas base de <strong>Almacén / Inventarios (<code>115-00-000</code> y <code>115-01-001</code>)</strong> para Costo de Ventas, y toda eliminación de cuenta en el árbol solicita confirmación en línea antes de ejecutarse.
</div>

<!-- ==================== CAPÍTULO 7 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 7</div>
  <h1 class="chapter-title">Bancos, CxC/CxP, Nómina, Inventario y Día 17 (<kbd>Alt</kbd>+<kbd>5</kbd>)</h1>
</div>

<p>
  Este módulo organiza en <strong>8 pestañas</strong> la operación de tesorería, cartera PPD, nómina, inventarios y determinación de impuestos provisionales para Régimen General, Persona Física y RESICO:
</p>

<h2>7.1 Las 8 Pestañas Operativas y Tesorería</h2>
<table>
  <thead>
    <tr>
      <th style="width: 25%;">Pestaña / Área</th>
      <th>Capacidades prácticas paso a paso</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>1. Conciliación Bancos</strong></td>
      <td>
        Importa estados de cuenta en <strong>CSV</strong> o mediante <strong>Importar PDF Bancario</strong> (hasta <code>7.5 MB</code>), con edición en línea, sumas de control (<em>Total Cargos / Abonos</em>) y alertas por fila. Ejecuta <strong>Conciliar Automáticamente</strong> (1-a-1) o <strong>Conciliar Múltiples Pólizas</strong> (<em>Varios a 1</em>) con confirmación segura y creación rápida de pólizas faltantes.
      </td>
    </tr>
    <tr>
      <td><strong>2. DIOT (.txt) y 3. Padrón 69-B</strong></td>
      <td>
        Desglosa actos pagados al 16%, 8% frontera, 0%, exento, notas de crédito y extranjeros (excluyendo Nómina <code>N</code>) y descarga el archivo <strong><code>.txt</code> oficial SAT</strong>. En <strong>Padrón 69-B</strong> administra terceros (<code>04</code>, <code>05</code>, <code>15</code>) con cruce en la nube contra listas EFOS.
      </td>
    </tr>
    <tr>
      <td><strong>4. Activos Fijos (INPC)</strong></td>
      <td>
        Calcula depreciación contable y deducción fiscal actualizada con INPC aplicando automáticamente los <strong>topes del Art. 36 LISR</strong> (<code>$175,000</code> MOI combustión y <code>$250,000</code> eléctricos/híbridos) y genera la póliza mensual.
      </td>
    </tr>
    <tr>
      <td><strong>5. Cédula Día 17</strong></td>
      <td>
        Determina pagos provisionales de ISR y definitivos de IVA (Régimen General, PF y RESICO), calcula prorrateo Art. 5 LIVA, fluctuación cambiaria USD y genera las pólizas de provisión con fecha límite en día hábil.
      </td>
    </tr>
    <tr>
      <td><strong>6. CxC / CxP (PPD)</strong></td>
      <td>
        Controla facturas Emitidas y Recibidas en <code>PPD</code> descontando abonos de <strong>Pagos 2.0</strong> (con conversión multimoneda USD exacta). Filtra por antigüedad interactiva (<code>0–30</code>, <code>31–60</code>, <code>61–90</code>, <code>+90</code> días), busca por RFC/nombre/folio y copia el UUID en 1 clic.
      </td>
    </tr>
    <tr>
      <td><strong>7. Nómina / IMSS / ISN</strong></td>
      <td>
        Amarra CFDIs de <strong>Nómina 1.2</strong> contra la contabilidad y el Día 17, edita libremente la <strong>Base Gravable ISN ($)</strong> (con botón <em>Usar nómina</em> y catálogo de los 32 estados), valida la tabla previa y confirma antes de emitir la póliza de provisión SUA + ISN.
      </td>
    </tr>
    <tr>
      <td><strong>8. Inventario / Costo</strong></td>
      <td>
        Registra inventario inicial y final en Almacén (<code>115</code>) bajo método <em>Analítico</em> o <em>Perpetuo</em> tomando automáticamente las compras de la balanza, alerta si el inventario final excede la mercancía disponible y solicita confirmación si ya existe una póliza vinculada.
      </td>
    </tr>
  </tbody>
</table>

<h2>7.2 Detalle de Cédula Día 17: Flujo RESICO, Topes e IVA Multi-Tasa</h2>
<div class="card-grid-2">
  <div class="info-card">
    <div class="info-card-title">Base Devengada vs. Flujo de Efectivo RESICO</div>
    <p>Para contribuyentes RESICO (PF 626 / PM 626), compara la <strong>Base Contable Devengada</strong> frente al <strong>Flujo de Efectivo</strong> (ingresos cobrados <code>PUE + Pago 2.0</code> sin duplicar notas de crédito <code>E</code> sobre <code>PPD</code>), acreditando la <strong>retención de ISR 1.25%</strong> (Art. 113-J LISR). El <em>Coeficiente de Utilidad</em> se marca como <em>No aplica en RESICO</em>.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Semáforo de Topes RESICO ($3.5M / $35M)</div>
    <p>Supervisa ingresos acumulados del ejercicio con un semáforo preventivo (<code>OK</code>, <code>Precaución ≥ 80%</code>, <code>Crítica ≥ 95%</code> y <code>Excedido</code>) sobre el tope anual de <strong><code>$3.5 MDP</code> (PF)</strong> y <strong><code>$35 MDP</code> (PM)</strong>; en régimen 612 muestra el desglose de flujo sin alertas RESICO.</p>
  </div>
</div>

<div class="callout callout-emerald">
  <div class="callout-title">IVA Multi-Tasa, Prorrateo Art. 5 LIVA, Fluctuación USD y Provisiones</div>
  La Cédula Día 17 desglosa bases al <strong>16%</strong>, <strong>8% frontera</strong>, <strong>0%</strong>, <strong>Exento</strong> e <strong>IEPS acreditable</strong> (incluyendo traslados exentos en CFDIs mixtos), calcula el <strong>Factor de Prorrateo (Art. 5 LIVA)</strong>, evalúa fluctuación cambiaria USD en Complementos de Pago parciales o que liquidan varias facturas con corte mensual y provisiona pólizas con límite recorrido a día hábil.
</div>

<!-- ==================== CAPÍTULO 8 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 8</div>
  <h1 class="chapter-title">4 Estados NIF, Declaración Anual y Anexo 24 .zip (<kbd>Alt</kbd>+<kbd>6</kbd>)</h1>
</div>

<p>
  En <strong>Estados Financieros</strong> obtienes los reportes financieros NIF completos, la preparación de la Declaración Anual y la descarga oficial de Contabilidad Electrónica SAT en tiempo real a partir de tus pólizas.
</p>

<h2>8.1 Los 4 Estados Financieros NIF y Comparativo Interanual</h2>
<div class="card-grid-2">
  <div class="info-card">
    <div class="info-card-title">1. Balanza de Comprobación</div>
    <p>Saldo inicial, debe, haber y saldo final por cuenta con barra de sumas iguales, filtro por nivel, exportación CSV y clic directo al <strong>Libro Mayor</strong>.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">2. Estado de Resultados (NIF B-3)</div>
    <p>Ingresos, Costo de Ventas, Utilidad Bruta, Gastos de Operación, RIF y Utilidad Neta del periodo y acumulada con <strong>análisis vertical (%)</strong> sobre ventas.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">3. Balance General (NIF B-1 / B-6)</div>
    <p>Activo Circulante/No Circulante (incluyendo depreciaciones con signo natural), Pasivo y Capital Contable validando <code>Activo = Pasivo + Capital</code>.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">4. Flujos de Efectivo (B-2), Capital (B-4) y Comparativo</div>
    <p>En la pestaña <strong>Flujos y Capital (NIF)</strong> consulta el <em>Estado de Flujos de Efectivo (NIF B-2)</em>, el <em>Estado de Cambios en el Capital Contable (NIF B-4)</em> y el <em>Comparativo vs. Ejercicio Anterior</em>, con exportación dedicada a Excel (<code>.xlsx</code>).</p>
  </div>
</div>

<h2>8.2 Pestaña Declaración Anual (Cierre Fiscal del Ejercicio)</h2>
<p>
  La pestaña <strong>Declaración Anual</strong> excluye automáticamente la Póliza de Cierre Anual (Periodo 13) para conservar intactos tus ingresos y costos acumulados. Captura índices INPC (<code>Índice</code>), PTU pagada, no deducibles manuales, capital y dividendos (<code>MXN $</code>) —con indicador de <em>cambios sin guardar</em> y exportación dedicada <strong>Anual (.CSV)</strong>— para determinar:
</p>
<ul>
  <li><strong>Ajuste Anual por Inflación (solo PM Régimen General):</strong> promedio anual de créditos vs. deudas aplicando el factor INPC, clasificado claramente como <em>Ingreso Acumulable</em>, <em>Deducción Autorizada</em> o <em>Sin Efecto</em> (exento automáticamente en RESICO / PF).</li>
  <li><strong>Conciliación Contable-Fiscal, PTU 10% e ISR Neto:</strong> calcula la utilidad fiscal gravable y desglosa la <strong>Determinación de ISR Anual a Cargo / Favor</strong> (<code>ISR Causado − Pagos Provisionales Efectuados − ISR Retenido Acreditable</code>).</li>
  <li><strong>Nuevo Coeficiente de Utilidad, CUCA y CUFIN:</strong> determina el C.U. del siguiente ejercicio (con aviso aclaratorio cuando aplica a PM Régimen General) y actualiza saldos de <strong>CUCA</strong> (Art. 78 LISR) y <strong>CUFIN</strong> (Art. 77 LISR).</li>
</ul>

<h2>8.3 Anexo 24 en .zip Oficial SAT, Dossier de Cierre y Entregables</h2>
<div class="callout callout-blue">
  <div class="callout-title">Anexo 24 v1.3 en .zip Oficial SAT y Dossier Ejecutivo (.xlsx / Paquete .ZIP / PDF)</div>
  En <strong>XML SAT Anexo 24</strong> descarga directamente el paquete comprimido <strong><code>.zip</code> oficial SAT</strong> (Regla 2.8.1.5 RMF) para <em>Catálogo (CT)</em>, <em>Balanza (BN Normal/Complementaria)</em> y <em>Pólizas (PL)</em> —recordando sustituir el número de orden o trámite de ejemplo en el archivo de Pólizas (<code>PL</code>) por el folio oficial del requerimiento SAT—. Desde la pestaña <strong>Dossier de Cierre</strong> o el botón <strong>Entregables Ejecutivos</strong> exporta el libro <strong>Excel (<code>.xlsx</code>)</strong>, el <strong>Paquete .ZIP (CSV)</strong> identificado por periodo (<code>_P01.._P13</code>) o el PDF (con alerta si siguen activas las firmas o cédula de ejemplo en <em>Firmas y Membrete</em>).
</div>

<!-- ==================== CAPÍTULO 9 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 9</div>
  <h1 class="chapter-title">Configuración y Empresa, Equipo, Bitácora y Respaldos (<kbd>Alt</kbd>+<kbd>7</kbd>)</h1>
</div>

<p>
  El módulo <strong>Configuración y Empresa</strong> se organiza en <strong>7 pestañas</strong> para administrar cada RFC, las reglas contables, tu equipo de trabajo y la seguridad del despacho:
</p>

<table>
  <thead>
    <tr>
      <th style="width: 24%;">Pestaña</th>
      <th>Qué configurar aquí</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>1. Directorio</strong></td>
      <td>Consulta todas las empresas fiscales del despacho, cambia la empresa activa y da de alta nuevos RFCs con el asistente de 5 pasos.</td>
    </tr>
    <tr>
      <td><strong>2. Empresa</strong></td>
      <td>Edita razón social, RFC, régimen fiscal, código postal, activa o retira el <strong>Candado de Periodo</strong> y administra tus <strong>Reglas Contables por RFC / ClaveProdServ y No Deducibles (801)</strong> (con confirmación segura antes de eliminar).</td>
    </tr>
    <tr>
      <td><strong>3. e.Firma / SAT</strong></td>
      <td>Carga o renueva tus archivos <code>.cer</code>, <code>.key</code> y contraseña cifrada. Visualiza vigencia del certificado e historial de solicitudes SAT.</td>
    </tr>
    <tr>
      <td><strong>4. Cédula Día 17</strong></td>
      <td>Configura parámetros fiscales: Coeficiente de Utilidad, Tipo de Cambio DOF, pérdidas por amortizar, pagos provisionales y saldo a favor de IVA previo.</td>
    </tr>
    <tr>
      <td><strong>5. Respaldos</strong></td>
      <td>Descarga o restaura un <strong>respaldo integral de la empresa</strong> (incluyendo XML originales, desgloses de impuestos, reglas contables, inventarios, activos fijos y parámetros anuales); también importa catálogos CSV.</td>
    </tr>
    <tr>
      <td><strong>6. Atajos F1</strong></td>
      <td>Consulta interactiva de todos los atajos de teclado de la plataforma.</td>
    </tr>
    <tr>
      <td><strong>7. Equipo y Bitácora</strong></td>
      <td>Autoriza colaboradores o clientes por rol, delimita acceso por RFC con nombres comerciales visibles y consulta la <strong>Bitácora de Auditoría</strong> en español contable.</td>
    </tr>
  </tbody>
</table>

<h2>9.1 Equipo del Despacho, Permisos por Empresa y Bitácora</h2>
<div class="card-grid-2">
  <div class="info-card">
    <div class="info-card-title">Roles Granulares e Invitación Directa</div>
    <p>En <strong>7. Equipo y Bitácora</strong> autoriza por correo uno de 4 roles (con guía descriptiva): <strong>Socio</strong>, <strong>Contador</strong>, <strong>Auxiliar</strong> o <strong>Cliente (Solo lectura)</strong>. Al autorizar un correo, usa el botón <strong>Copiar enlace e instrucciones</strong> y compártelo con el usuario: su acceso se activará al iniciar sesión en <code>librepaq.com</code> con ese mismo correo. Revocar accesos incluye confirmación en línea.</p>
  </div>
  <div class="info-card">
    <div class="info-card-title">Acceso por Empresa y Bitácora en Español</div>
    <p>Delimita qué empresas (<code>RFC · Razón Social</code>) puede ver cada integrante. En la <strong>Bitácora de Auditoría</strong> consulta quién creó pólizas, contabilizó CFDIs, ajustó reglas o cerró periodos en etiquetas claras en español contable, con filtro instantáneo y fecha/hora oficial CDMX.</p>
  </div>
</div>

<!-- ==================== CAPÍTULO 10 ==================== -->
<div class="page-break"></div>
<div class="chapter-header">
  <div class="chapter-kicker">Capítulo 10</div>
  <h1 class="chapter-title">Referencia Rápida de Atajos y Checklist Operativo</h1>
</div>

<h2>10.1 Tabla Maestra de Atajos de Teclado</h2>
<table style="margin: 4px 0 6px 0; font-size: 8.1pt;">
  <thead>
    <tr>
      <th style="width: 14%;">Contexto</th>
      <th style="width: 30%;">Atajo</th>
      <th>Acción</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><span class="badge badge-slate">Global</span></td>
      <td><kbd>Ctrl</kbd>+<kbd>K</kbd></td>
      <td>Abrir Paleta de Comandos / Buscador Universal.</td>
    </tr>
    <tr>
      <td><span class="badge badge-slate">Global</span></td>
      <td><kbd>Ctrl</kbd>+<kbd>E</kbd></td>
      <td>Cambiar de empresa fiscal (Selector de Empresas Multi-RFC).</td>
    </tr>
    <tr>
      <td><span class="badge badge-slate">Global</span></td>
      <td><kbd>Alt</kbd>+<kbd>1</kbd> .. <kbd>Alt</kbd>+<kbd>7</kbd></td>
      <td>Saltar directamente a cada uno de los 7 módulos principales.</td>
    </tr>
    <tr>
      <td><span class="badge badge-slate">Global</span></td>
      <td><kbd>Alt</kbd>+<kbd>[</kbd> / <kbd>Alt</kbd>+<kbd>]</kbd></td>
      <td>Retroceder o avanzar periodo contable (hasta Periodo 13 de Cierre Anual).</td>
    </tr>
    <tr>
      <td><span class="badge badge-slate">Global</span></td>
      <td><kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>F1</kbd> / <kbd>Esc</kbd></td>
      <td>Colapsar barra lateral / Abrir guía de atajos / Cerrar ventana activa.</td>
    </tr>
    <tr>
      <td><span class="badge badge-blue">ADD CFDI</span></td>
      <td><kbd>Alt</kbd>+<kbd>U</kbd> / <kbd>Alt</kbd>+<kbd>S</kbd> / <kbd>/</kbd></td>
      <td>Cargar XML/ZIP / Captura manual de CFDI / Enfocar buscador de facturas.</td>
    </tr>
    <tr>
      <td><span class="badge badge-emerald">Pólizas</span></td>
      <td><kbd>Alt</kbd>+<kbd>N</kbd> / <kbd>Insert</kbd></td>
      <td>Nueva póliza (en listado) o agregar renglón (en editor).</td>
    </tr>
    <tr>
      <td><span class="badge badge-emerald">Pólizas</span></td>
      <td><kbd>F2</kbd> / <kbd>F4</kbd> / <kbd>=</kbd> / <kbd>"</kbd></td>
      <td>Buscar cuenta / Desglosar IVA 16% / Auto-cuadrar / Copiar renglón superior.</td>
    </tr>
    <tr>
      <td><span class="badge badge-emerald">Pólizas</span></td>
      <td><kbd>Alt</kbd>+<kbd>1..3</kbd> / <kbd>Ctrl</kbd>+<kbd>Enter</kbd></td>
      <td>Plantilla Asiento Tipo (Cobro, Pago, Nómina) / Guardar póliza cuadrada.</td>
    </tr>
    <tr>
      <td><span class="badge badge-amber">Catálogo</span></td>
      <td><kbd>F3</kbd> / <kbd>↑↓</kbd> / <kbd>← →</kbd> / <kbd>Insert</kbd> / <kbd>F2</kbd></td>
      <td>Buscar / Navegar árbol / Plegar o desplegar / + Subcuenta / Editar (<kbd>Espacio</kbd> Mayor).</td>
    </tr>
  </tbody>
</table>

<h2 style="margin: 8px 0 3px 0;">10.2 Checklist de Arranque (Tus Primeros 15 Minutos)</h2>
<ul class="checklist" style="margin: 2px 0 6px 0;">
  <li><span class="chk-box"></span><span><strong>Crea tu cuenta</strong> en <code>librepaq.com</code> (con Google o correo/contraseña) y verifica tu acceso.</span></li>
  <li><span class="chk-box"></span><span><strong>Registra tu primera empresa</strong> usando el Asistente de 5 Pasos (CSF PDF o XML CFDI 4.0 y catálogo General SAT o RESICO).</span></li>
  <li><span class="chk-box"></span><span><strong>Sube tu e.firma (FIEL)</strong> en <em>Configuración y Empresa → 3. e.Firma / SAT</em> e invita a tu equipo en <em>7. Equipo y Bitácora</em> si trabajas en despacho.</span></li>
  <li><span class="chk-box"></span><span><strong>Descarga Emitidos + Recibidos del SAT</strong> en la <em>Bóveda Digital (ADD)</em>, ejecuta <em>Validar SAT en Lote</em> y contabiliza con <em>Reglas Aprendidas</em>.</span></li>
</ul>

<h2 style="margin: 8px 0 3px 0;">10.3 Checklist de Cierre Contable y Fiscal Mensual</h2>
<ul class="checklist" style="margin: 2px 0 6px 0;">
  <li><span class="chk-box"></span><span><strong>Bóveda ADD y 69-B al 100%:</strong> estatus SAT validado en lote (cero canceladas con póliza activa), sin alertas 69-B y 0 CFDIs pendientes.</span></li>
  <li><span class="chk-box"></span><span><strong>Bancos Varios a 1, CxC/CxP y Nómina:</strong> estado de cuenta CSV o PDF (IA) conciliado (1-a-1 y múltiple), cartera PPD y Nómina 1.2 + SUA/ISN.</span></li>
  <li><span class="chk-box"></span><span><strong>Cédula Día 17 y Provisiones:</strong> flujo de efectivo / semáforo RESICO, prorrateo IVA Art. 5, depreciación LISR e inventario; pólizas de provisión.</span></li>
  <li><span class="chk-box"></span><span><strong>DIOT, 4 Estados NIF y Anexo 24 .zip:</strong> archivo <code>.txt</code> oficial DIOT, Estados Financieros NIF (Flujos B-2 y Capital B-4) y paquete <code>.zip</code> Anexo 24.</span></li>
  <li><span class="chk-box"></span><span><strong>Dossier, Bitácora y Candado:</strong> <em>Paquete .ZIP (CSV)</em> / Excel <code>.xlsx</code> con firmas reales exportado, respaldo integral guardado, bitácora revisada y <strong>Candado de Periodo activado</strong>.</span></li>
</ul>

<div class="callout callout-emerald" style="margin: 6px 0 0 0; padding: 7px 11px;">
  <div class="callout-title">Soporte Técnico y Ayuda en Línea</div>
  ¿Tienes dudas durante tu configuración inicial? Dentro de la aplicación cuentas con el botón de <strong>Soporte por WhatsApp</strong> en la esquina inferior derecha y la guía interactiva de atajos pulsando <kbd>F1</kbd> en cualquier momento. También puedes visitar <strong>https://librepaq.com</strong>.
</div>

</body>
</html>`;
}

async function main() {
  const executablePath = findBrowserExecutable();
  const logoDataUri = loadLogoDataUri();
  const html = buildManualHtml(logoDataUri);

  fs.mkdirSync(path.dirname(OUTPUT_PDF), { recursive: true });

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    await page.pdf({
      path: OUTPUT_PDF,
      preferCSSPageSize: true,
      printBackground: true
    });

    fs.mkdirSync(path.dirname(PUBLIC_PDF), { recursive: true });
    fs.copyFileSync(OUTPUT_PDF, PUBLIC_PDF);

    const stats = fs.statSync(OUTPUT_PDF);
    console.log(`PDF generado exitosamente: ${OUTPUT_PDF} (${(stats.size / 1024).toFixed(1)} KB)`);
    console.log(`Copia pública sincronizada: ${PUBLIC_PDF}`);
  } finally {
    await browser.close();
  }
}

await main();

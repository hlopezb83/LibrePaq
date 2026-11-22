# Roadmap de Mejoras Mayores — LibrePaq Pro ERP

Este documento concentra las iniciativas de **mayor alcance** (nuevas funcionalidades, automatizaciones de fondo, integraciones externas, infraestructura CI/CD y escalabilidad multiusuario).  
Se mantienen separadas del ciclo YAGNI inmediato para implementarlas de forma incremental cuando la operación del despacho o del producto las requiera.

> **Convención para agregar nuevas ideas:** añadir una ficha usando la plantilla al final del archivo con su identificador correlativo (`MAY-XX`), el detonador de negocio (*cuándo conviene construirla*) y las áreas del repositorio impactadas.

---

## Backlog Priorizado de Mejoras Mayores

### [MAY-01] Orquestación SAT Desatendida de Punta a Punta (SOAP + Lista 69-B + Estatus CFDI)
* **Estado:** Pendiente / Diseño inicial existente
* **Categoría:** Automatización Fiscal / Backend Cloud
* **Detonador de negocio:** Despachos con múltiples RFCs activos que requieran descargas masivas nocturnas y monitoreo automático sin intervención manual del contador.
* **Qué requiere construir:**
  * Evolucionar [.github/workflows/sat-sync-cron.yml](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/.github/workflows/sat-sync-cron.yml), [scripts/sat-cron-worker.ts](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/scripts/sat-cron-worker.ts) y la Edge Function [supabase/functions/sat-soap-sync/index.ts](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/supabase/functions/sat-soap-sync/index.ts) hacia una cola persistente con reintentos exponenciales, división real de solicitudes `'AMBOS'` (`EMITIDOS` + `RECIBIDOS`), manejo de paquetes grandes (`>500 XMLs`) sin marcar `'TERMINADA'` cuando fallan lotes, y flujo completo en modo SQLite local.
  * Reemplazar los parsers basados en regex/binario crudo (`parseCfdiQuick` en `supabase/functions/sat-soap-sync/crypto-helpers.ts` y `sat-certificate-parser.ts`) por parsers XML y X.509 reales compartidos, además de un proxy servidor para `ConsultaCFDIService.svc` (`sat-cfdi-status.ts`) sin bloqueos CORS.
  * Almacenar el padrón completo EFOS Anexo 69-B (`>10,000` registros) en tabla PostgreSQL (eliminando el truncamiento a `2,000` filas en `localStorage`) con actualización automática programada y re-validación periódica de estatus (`VIGENTE` / `CANCELADO`) en `cfdi_documents`.
* **Áreas relacionadas:** `supabase/functions/sat-soap-sync/`, `scripts/sat-cron-worker.ts`, `src/server/repositories/sat-soap-download.service.ts`, `src/shared/sat-69b.ts`, `src/shared/sat-cfdi-status.ts`, `src/shared/sat-certificate-parser.ts`, `src/lib/supabase/supabase-soap-download.ts`.

---

### [MAY-02] Motor Configurable de Reglas Contables y Conciliación Bancaria Avanzada
* **Estado:** Pendiente
* **Categoría:** Automatización Contable / Producto Core
* **Detonador de negocio:** Clientes recurrentes con alto volumen de facturas o múltiples cuentas bancarias donde el mapeo fijo por defecto ya no basta.
* **Qué requiere construir:**
  * Plantillas de contabilización persistidas en base de datos por empresa/despacho (reglas por RFC proveedor/cliente, `claveProdServ`, `usoCfdi` y prorrateos de IVA / retenciones / IEPS) sobre [auto-poliza-rules.ts](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/src/shared/engine/auto-poliza-rules.ts).
  * Motor de conciliación bancaria muchos-a-uno (`N` CFDIs ↔ `1` movimiento bancario o viceversa), tolerancias configurables y soporte integral de parcialidades PPD / Complementos de Pago (`pago20:DoctoRelacionado`) para saldos insolutos reales en DIOT y fluctuación cambiaria NIF B-15.
  * Importación directa de estados de cuenta bancarios en PDF / conectores bancarios (Open Finance).
* **Áreas relacionadas:** `src/shared/engine/auto-poliza-rules.ts`, `src/shared/engine/bank-and-closing.engine.ts`, `src/shared/engine/fiscal.engine.ts`, `supabase/migrations/`, `src/views/fiscal-bancos/`.

---

### [MAY-03] Multiusuario Real para Despachos Contables (RBAC, Revisiones y Bitácora)
* **Estado:** Pendiente (hoy existe aislamiento por `user_id` + `is_superadmin`)
* **Categoría:** Seguridad / Colaboración B2B
* **Detonador de negocio:** Despachos con varios auxiliares, contadores senior y clientes que necesitan acceso concurrente y diferenciado a las mismas empresas.
* **Qué requiere construir:**
  * Modelo de organizaciones/despachos y membresías por empresa con roles granulares (`Socio`, `Contador`, `Auxiliar`, `Cliente Solo Lectura`) reforzados mediante políticas RLS en PostgreSQL (`supabase/migrations/`).
  * Flujo de invitaciones por correo y transferencia segura de propiedad de empresas.
  * Bitácora inmutable de auditoría (`audit_logs`) para cambios en pólizas, catálogo y candados de periodo (`period_locks`), más flujo opcional de revisión previa antes del cierre mensual y tabla global persistente en Supabase para comunicados SuperAdmin ([SuperAdminBroadcastTab.tsx](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/src/views/admin/SuperAdminBroadcastTab.tsx), hoy local al navegador).
* **Áreas relacionadas:** `supabase/migrations/`, `src/context/AuthContext.tsx`, `src/context/CompanyContext.tsx`, `src/views/SuperAdminView.tsx`, `src/views/admin/SuperAdminBroadcastTab.tsx`.

---

### [MAY-04] Suite E2E en Navegador y Despliegue Automatizado a Firebase Hosting + Previews
* **Estado:** Pendiente (`puppeteer-core` ya está en `devDependencies`, deploy actual es manual vía CLI)
* **Categoría:** QA / DevOps / CI-CD
* **Detonador de negocio:** Frecuencia semanal/diaria de releases donde el riesgo de regresiones visuales, de ruteo SPA o de RLS supera el tiempo de prueba manual.
* **Qué requiere construir:**
  * Tests E2E reales en navegador usando `puppeteer-core` o Playwright cubriendo el camino crítico (`Auth` → `Alta/Onboarding CSF` → `Carga XML CFDI` → `Contabilización/Póliza` → `Anexo 24 / Día 17`) y cobertura de hooks React y rutas HTTP Hono.
  * Integración en [.github/workflows/ci.yml](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/.github/workflows/ci.yml) de verificación de tipos/lint para Edge Functions Deno (`supabase/functions/`) y `server.ts`, canales *preview* en Pull Requests y despliegue automático a producción en Firebase Hosting ([firebase.json](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/firebase.json)) al aprobar merges en `main`.
* **Áreas relacionadas:** `.github/workflows/ci.yml`, `supabase/functions/`, `server.ts`, `firebase.json`, `package.json`.

---

### [MAY-05] Validación XSD Oficial de Anexo 24 y Cumplimiento Fiscal Extendido (Nómina 1.2 / Activos / Alertas)
* **Estado:** Pendiente
* **Categoría:** Cumplimiento SAT / Reporteo Contable
* **Detonador de negocio:** Auditorías formales ante el SAT o empresas con plantilla laboral e inventarios importantes de activo fijo.
* **Qué requiere construir:**
  * Validación automatizada de `CT.xml`, `BN.xml` y `PL.xml` contra los esquemas XSD oficiales v1.3 de Contabilidad Electrónica SAT dentro de la suite de pruebas y pre-exportación.
  * Soporte completo de ingesta y contabilización de CFDI Nómina 1.2 (percepciones, deducciones, ISR retenido, IMSS patronal, ISN estatal).
  * Generación automática mensual de pólizas de depreciación fiscal desde `fixed_assets` y recordatorios programados de vencimientos fiscales (Día 17, DIOT, Cierre Anual).
* **Áreas relacionadas:** `src/shared/sat-anexo24.ts`, `src/shared/engine/fixed-assets.engine.ts`, `src/shared/engine/tax-provision.engine.ts`.

---

### [MAY-06] Observabilidad Operativa, Telemetría y Respaldos Programados en la Nube
* **Estado:** Pendiente
* **Categoría:** Confiabilidad / SRE
* **Detonador de negocio:** Tráfico continuo de usuarios de pago donde detectar fallos silenciosos en clientes o Edge Functions antes de recibir tickets de soporte es crítico.
* **Qué requiere construir:**
  * Telemetría estructurada de errores frontend y Edge Functions (ej. Sentry o OpenTelemetry) con correlación por empresa/usuario sin exponer credenciales `.key` o secretos FIEL.
  * Alertas automáticas ante fallos en [sat-sync-cron.yml](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/.github/workflows/sat-sync-cron.yml) o degradación en llamadas SOAP/REST del SAT.
  * Exportación y almacenamiento periódico cifrado de respaldos JSON/SQL por empresa en Supabase Storage con verificación automatizada de restauración.
* **Áreas relacionadas:** `src/components/RootErrorFallback.tsx`, `src/components/AppErrorBoundary.tsx`, `supabase/functions/`, `src/lib/supabase/supabase-backup-restore.ts`.

---

### [MAY-07] Unificación Dual-Backend, RPCs Transaccionales en Postgres y Bóveda Cifrada FIEL
* **Estado:** Propuesta
* **Categoría:** Arquitectura / Seguridad / Base de Datos
* **Detonador de negocio:** Crecimiento de empresas activas en producción cloud donde las escrituras multi-tabla desde cliente (`polizas`, `cfdi_documents`, respaldos JSON), el límite de `1,000` filas de PostgREST o el despliegue de `server.ts` como API pública exijan atomicidad y autorización estricta.
* **Qué requiere construir:**
  * Middleware JWT de Supabase y validación estricta multi-tenant en todas las rutas Hono (`src/server/routes/*`), unificando el cálculo compartido (por ejemplo en `reports.routes.ts` y `financial-reports.engine.ts`) para eliminar divergencias entre repositorios SQLite y adaptadores Supabase.
  * Funciones RPC transaccionales en PostgreSQL para mutaciones multi-tabla críticas (`createPoliza`, `updatePoliza`, `deletePoliza`, `closeYearPoliza`, `restoreCompanyBackup`) evitando estados parciales o pérdida de ligas.
  * Revocar permisos directos de escritura desde cliente (`INSERT`/`UPDATE`/`DELETE`) sobre `fiel_credentials` y cifrar `private_key_pem` en reposo con KMS/AES-GCM gestionado exclusivamente en Edge Functions y cron worker.
* **Áreas relacionadas:** `src/server/routes/`, `src/lib/supabase/`, `supabase/migrations/`, `supabase/functions/sat-soap-sync/`.

---

### [MAY-08] Cumplimiento Fiscal SAT Multi-tasa, DIOT A-29 y Ciclo Multi-Ejercicio / Periodo 13
* **Estado:** Propuesta
* **Categoría:** Cumplimiento Fiscal / Contabilidad Core
* **Detonador de negocio:** Despachos y empresas con operaciones en Zona Fronteriza (`8%`), tasas mixtas (`16%`/`0%`/exento), IEPS, múltiples ejercicios históricos o procesos formales de cierre anual contable y fiscal.
* **Qué requiere construir:**
  * Soporte en motores fiscales ([diot.engine.ts](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/src/shared/engine/diot.engine.ts), [fiscal.engine.ts](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/src/shared/engine/fiscal.engine.ts), [sat-dyp-formatter.ts](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/src/shared/engine/sat-dyp-formatter.ts)) para desglose de impuestos multi-tasa, layout oficial vigente DIOT (24 campos / formato DEM A-29, retenciones en Notas de Crédito `E` y sanitización de `|`).
  * Historial de parámetros fiscales (`tax_parameters`) y pagos provisionales/depreciación acumulada por ejercicio y periodo.
  * Soporte integral de **Periodo 13 (Cierre Anual)** de punta a punta: cierre no destructivo que conserve pólizas manuales de ajuste en M13, exclusión/inclusión correcta en `monthlyTrend` del Dashboard, presets SAT SOAP, reevaluación USD por periodo y encabezados de Estados Financieros.
* **Áreas relacionadas:** `src/shared/engine/diot.engine.ts`, `src/shared/engine/fiscal.engine.ts`, `src/shared/engine/sat-dyp-formatter.ts`, `src/lib/supabase/supabase-closing-verification.ts`, `src/lib/supabase/supabase-reports-dashboard.ts`, `src/views/reportes/`.

---

### [MAY-09] Motor Fiel de Representación Impresa XML (CFDI 4.0) y Exportación Agrupada `.zip`
* **Estado:** Propuesta
* **Categoría:** Producto / Experiencia del Contador
* **Detonador de negocio:** Contadores que auditan CFDIs a detalle contra el `xmlRaw` real del SAT o que descargan paquetes completos de cierre mensual sin bloqueos por descargas múltiples del navegador.
* **Qué requiere construir:**
  * Reconstruir la previsualización impresa y pestaña XML ([CfdiFacturaTab.tsx](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/src/views/cfdi/preview/CfdiFacturaTab.tsx), [CfdiXmlTab.tsx](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/src/views/cfdi/preview/CfdiXmlTab.tsx)) parseando el `xmlRaw` real (conceptos, impuestos trasladados/retenidos, timbrado y complementos) en lugar de valores sintéticos.
  * Empaquetar entregables múltiples ([deliverableCsvExport.ts](file:///c:/Users/torta/OneDrive/Documents/Libre%20Contpaq/src/components/deliverables/deliverableCsvExport.ts)) y lotes XML en un único archivo `.zip` (usando `fflate`) o `.xlsx` multi-hoja.
* **Áreas relacionadas:** `src/views/cfdi/preview/`, `src/components/deliverables/deliverableCsvExport.ts`, `src/lib/excel-export.ts`, `src/shared/cfdi-xml.ts`.

---

## Plantilla para Nuevas Mejoras Mayores

```markdown
### [MAY-XX] Título de la Iniciativa
* **Estado:** Propuesta / En evaluación / En progreso / Completada
* **Categoría:** Producto / Automatización / Seguridad / Infraestructura / Fiscal
* **Detonador de negocio:** Qué necesidad real o volumen justifica construirla
* **Qué requiere construir:**
  * Punto técnico 1
  * Punto técnico 2
* **Áreas relacionadas:** `ruta/al/archivo`, `otra/carpeta/`
```

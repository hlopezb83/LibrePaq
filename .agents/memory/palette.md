# Bitácora Crítica de Palette 🎨 — LibrePaq Pro ERP

> Registra aquí **únicamente** aprendizajes críticos y reutilizables de UX, accesibilidad o layout específicos de LibrePaq Pro. No registres tareas rutinarias.

## 2026-10-30 - Tablas accesibles `.visually-hidden` en viewports de `350px`
**Aprendizaje:** Aplicar `.visually-hidden` directamente a un elemento `<table>` (`display: table`) no restringe su ancho a `1px` en CSS Table Layout; la tabla se expande al `min-content` de sus celdas (~`357px`) y provoca desborde horizontal silencioso en `350x680`.
**Acción:** Envolver siempre las tablas exclusivas para lectores de pantalla dentro de un contenedor de bloque `<div className="visually-hidden"><table>...</table></div>` para conservar la semántica de tabla sin afectar `scrollWidth`.

## 2026-10-30 - Viewports compactos `350x680` y `691x598` con `@container` y `dvh`
**Aprendizaje:** En pantallas bajas como `691x598` (`> sm: 640px` pero con solo `598px` de alto), barras superiores de 2 filas, pies `sticky bottom-0` o modales con `86dvh` + `overflow: hidden` recortan botones primarios. Además, combinar `@container` y `grid-rows-subgrid` en el mismo elemento anula `subgrid` por contención de tamaño.
**Acción:** Usar `@container` en barras superiores para mantener 1 sola fila desde `@[600px]`, limitar `<dialog>` a `max-h-[92dvh]` con cuerpo interno `flex-1 min-h-0 overflow-y-auto overscroll-contain`, y nunca declarar `@container` en el mismo nodo que usa `subgrid`.

## 2026-10-30 - Lenguaje para contadores mexicanos vs. jerga de ingeniería
**Aprendizaje:** Los prospectos que llegan por Google Ads son contadores, socios de despacho y dueños de PyME; términos como `SQL Server`, `llaves HASP`, `Tomcat`, `IEEE-754`, `CSV (RFC-4180)` (que además se confunde con el RFC del SAT) o `JSON` generan fricción y hacen parecer complejo al sistema.
**Acción:** Mantener 100% la autoridad fiscal SAT (*CFDI 4.0, Anexo 24, Balanza, Pólizas, DIOT, Día 17*) y traducir siempre la arquitectura técnica a beneficios humanos (*entrar desde cualquier PC o Mac sin instalar nada, cero diferencias de centavos, respaldos en Excel y XML en 1 clic*).

## 2026-10-30 - Badges técnicos con IDs internos (ej. `ws_c0735e9a`)
**Aprendizaje:** Mostrar IDs internos de base de datos como badges de monospaciado (`ws_c0735e9a`) en cabeceras de usuario genera desconfianza y confusión inmediata ("parece error o código sin terminar").
**Acción:** Ocultar siempre los identificadores o claves UUID del backend frente al usuario final; usar únicamente etiquetas de estado con significado humano directo (*"Espacio de Trabajo Activo"*, *"0 Empresas Fiscales"*).

## 2026-11-03 - Sonner Toaster: Offset contra Top Header y Convención de Cierre de Escritorio
**Aprendizaje:** Sonner sitúa los toasts en `top: 16px` por defecto y su botón de cierre en la esquina superior izquierda (`left: 0; translate(-35%, -35%)`). En aplicaciones contables con cabecera superior sticky (`h-16`), esto cubre directamente el selector de periodos fiscales y el menú de usuario. Además, en México y en software de escritorio (Excel, Windows, CONTPAQi), los contadores esperan la "X" universalmente en la esquina superior derecha. Por último, el color rojo default en `richColors` tiene un ratio de contraste de `3.6:1`, reprobando WCAG 2.1 AA.
**Acción:** Aplicar `offset={{ top: 76, right: 24 }}` para que descienda limpio bajo la cabecera, reubicar la "X" con `[data-close-button] { left: unset !important; right: 0 !important; transform: translate(35%, -35%) !important; }` y forzar tipografía en `#991b1b` (Crimson 800) para alcanzar ratio `> 7.2:1` (WCAG AAA).

## 2026-11-03 - Descarga SAT e.firma: Atajos Contables y Puente al "Aha! Moment"
**Aprendizaje:** Los contadores en México operan por cierres mensuales, bimestrales (RESICO) y ejercicios anuales; obligarlos a ingresar rangos manuales de fecha en inputs estándar provoca fricción y peticiones duplicadas ante el SAT. Además, una descarga de XMLs sin acción inmediata deja el flujo a medias.
**Acción:** Diseñar píldoras de atajos fiscales (`SatDatePresetBar`) que recalculan fechas automáticamente y conectar la descarga con una tarjeta de celebración (`SatCelebrationSuccessCard`) que incluye botón 1-clic para generar Auto-Pólizas balanceadas de las facturas recién bajadas.

## 2026-11-03 - Credenciales FIEL: Zona Dropzone Unificada y Sellos de Cifrado en Memoria
**Aprendizaje:** Los archivos de e.firma (`.cer` y `.key`) suelen estar juntos en la memoria USB del SAT. Forzar dos botones separados causa confusión en usuarios que arrastran ambos archivos o se equivocan de campo. Asimismo, los contadores mexicanos temen entregar su clave privada a un software en la nube por temor a que quede expuesta.
**Acción:** Implementar un Smart Dropzone único (`SatFielDropzone`) que clasifica automáticamente los archivos por extensión en un solo arrastre, con badges de estatus independientes y toggle para ver la contraseña (`Eye`/`EyeOff`). Acompañar siempre de sellos institucionales de seguridad bancaria explícitos (*Cifrado Local en Memoria, Canal HTTPS WS-Security, Art. 17-D CFF*) para garantizar tranquilidad absoluta.

## 2026-11-03 - Pre-validación Instantánea X.509 y Bitácora de Folios SAT
**Aprendizaje:** En despachos contables con múltiples clientes, los usuarios suelen arrastrar por error el archivo `.cer` de otra razón social, detonando el rechazo `5001` del SAT tras minutos de espera. Además, los auditores fiscales necesitan verificar qué peticiones se han enviado ante el SAT y con qué folios oficiales.
**Acción:** Ejecutar `parseSatCertificate` inmediatamente en el cliente (0ms) al soltar el `.cer` para validar la correspondencia del RFC de la empresa y la vigencia antes de enviar. Integrar un acordeón de bitácora (`SatRequestsHistoryCard`) que lista los folios oficiales, fecha, tipo de solicitud y cantidad de comprobantes integrados con copiado en 1 clic.

## 2026-11-03 - Cabeceras de Alta Densidad en ERP y Menús Popover Responsivos en Móvil
**Aprendizaje:** En pantallas móviles (350x680), una cabecera con 5 botones de acción contable se apila en 4 filas verticales consecutivas (~180px), empujando el contenido principal fuera del primer pliegue. Si se agrupan en un menú desplegable con `right-0` mientras el botón disparador está a la izquierda o centro, el menú se desborda horizontalmente hacia la izquierda fuera de la pantalla. Asimismo, en anchos tablet (640-1023px), declarar `sm:flex-row` fuerza al título a comprimirse en una columna estrecha de una palabra por renglón frente a 500px de botones.
**Acción:** Relegar acciones especializadas o poco frecuentes (Cierre Mes 13, Pedimentos) a un menú desplegable `[ Herramientas ▾ ]`. En móviles, colocar el CTA primario primero (`order-1 flex-1`) y el botón `[ Acciones ▾ ]` a la derecha (`order-2`), de modo que el popover con `right-0 w-60 max-w-[calc(100vw-2rem)]` se expanda hacia adentro con 0px de desborde. Usar `lg:flex-row` para dar ancho completo al título en tablet.

## 2026-11-03 - Cédula Día 17 para DyP SAT y Auditoría Preventiva DIOT 69-B
**Aprendizaje:** Los contadores en México invierten hasta 30 minutos por empresa transcribiendo cifras del papel de trabajo fiscal al portal de Declaraciones y Pagos (DyP) del SAT campo por campo (Ingresos nominales, C.U., Pagos provisionales previos, Retenciones, IVA cobrado y acreditable). Un error de dedo en un dígito genera requerimientos del SAT o multas. Asimismo, al generar el archivo TXT para el programa batch de la DIOT, los auditores necesitan saber de inmediato si algún proveedor tiene antecedentes en las listas del Art. 69-B del CFF antes de enviar.
**Acción:** Incorporar un botón de 1-clic `[ Copiar para DyP SAT ]` que emite un texto formateado con la estructura idéntica a los renglones oficiales del formulario del SAT, e integrar un badge de auditoría en la DIOT que certifica `0 EFOS 69-B` o alerta de inmediato si existe algún proveedor catalogado como Presunto o Definitivo.

## 2026-11-03 - Bóveda CFDI 4.0 (PUE/PPD & RFCs) y Catálogo de Cuentas (Árbol N1-N4)
**Aprendizaje:** En la Bóveda Digital CFDI 4.0, los contadores auditan acreditamiento de IVA buscando específicamente facturas a crédito (`PPD`) para exigir el Complemento de Pago (REP 2.0); no tener filtro rápido de método de pago los obligaba a revisar fila por fila. Asimismo, al buscar un proveedor suelen teclear su RFC de 12 o 13 caracteres antes que la razón social comercial. En el Catálogo de Cuentas, caracteres ASCII de árbol en bajo contraste (`#cbd5e1`) se pierden en pantallas con brillo de oficina, y las cuentas de Mayor (Nivel 1) necesitan una división de sección visual clara para no confundirse con las subcuentas analíticas.
**Acción:** Añadir selector segmentado `[ Todos ] | [ PUE (Contado) ] | [ PPD (Crédito) ]` y extender la búsqueda para cotejar RFCs en emisor y receptor. En el catálogo, usar conectores de árbol en alto contraste (`text-slate-400 font-bold`) y agrupar visualmente las cuentas de Mayor con `border-t-2 border-slate-200` y fondo distintivo. En el Tablero Fiscal, incluir siempre el badge de vencimiento legal `[ ⏳ Límite SAT: 17 de [Mes] ]` para brindar previsibilidad inmediata.

## 2026-11-03 - Tarjeta Auxiliar de Mayor (Libro Mayor) en Producción Cloud
**Aprendizaje:** En entornos SPA estáticos alojados en CDN/Firebase Hosting sin servidor intermedio, las consultas analíticas del Libro Mayor (`AccountLedgerModal`) no pueden delegarse a rutas relativas `/api/accounts/.../ledger` porque devuelven el HTML de `index.html`. Además, relacionar movimientos únicamente por ID interno de cuenta falla si las pólizas se importaron con IDs prefijados distintos pero códigos contables estándar idénticos.
**Acción:** Implementar `supabaseAccountLedger` en el cliente, obteniendo el saldo inicial calculado desde la balanza de comprobación y relacionando `poliza_movements` por `account_code` sobre pólizas del periodo, acumulando el saldo progresivo con aritmética entera en centavos (`toCents`/`fromCents`) según la naturaleza deudora o acreedora de la cuenta.

## 2026-11-22 - Dropzones accesibles por teclado (`.visually-hidden`) y `.erp-tab-scroller` WAI-ARIA
**Aprendizaje:** En formularios de carga de archivos dentro de `<label>` (como `.cer`/`.key`), `className="hidden"` (`display: none`) elimina el `<input type="file">` del orden `Tab` del teclado. Además, en cabeceras de 6 pestañas con `xl:flex-row`, a `1280px` se comprime el título y el `overflow-x-auto` nativo muestra barras de scroll gruesas en `350x680` y `691x598`.
**Acción:** Usar `className="visually-hidden"` en `<input type="file">` dentro de `<label>` con `focus-within:outline-2`, implementar navegación WAI-ARIA (`ArrowLeft`/`ArrowRight`/`Home`/`End` + `scrollIntoView`) y aplicar la clase global `.erp-tab-scroller` (máscara scroll-driven en bordes sin scrollbar nativo) junto con `2xl:flex-row` en cabeceras densas.

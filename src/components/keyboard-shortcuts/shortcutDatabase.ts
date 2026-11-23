export interface ShortcutItem {
  id: string;
  category: 'global' | 'cuentas' | 'polizas' | 'cfdi';
  categoryLabel: string;
  keys: string[];
  action: string;
  description: string;
  scope: string;
  targetRoute?: string;
}

export const SHORTCUT_DATABASE: ShortcutItem[] = [
  // 1. Globales
  {
    id: 'g-cmd',
    category: 'global',
    categoryLabel: 'Globales del Sistema',
    keys: ['Ctrl', 'K'],
    action: 'Paleta de Comandos y Buscador Universal',
    description: 'Abre el buscador Spotlight para saltar a cuentas, pólizas, empresas o acciones rápidas.',
    scope: 'Toda la aplicación'
  },
  {
    id: 'g-empresa',
    category: 'global',
    categoryLabel: 'Globales del Sistema',
    keys: ['Ctrl', 'E'],
    action: 'Cambio Rápido de Empresa (Multi-RFC)',
    description: 'Abre el conmutador seguro para alternar de entidad fiscal con confirmación obligatoria.',
    scope: 'Toda la aplicación'
  },
  {
    id: 'g-shortcuts',
    category: 'global',
    categoryLabel: 'Globales del Sistema',
    keys: ['F1'],
    action: 'Centro de Atajos de Teclado',
    description: 'Despliega esta guía interactiva con todos los atajos de teclado contables.',
    scope: 'Toda la aplicación'
  },
  {
    id: 'g-shortcuts-alt',
    category: 'global',
    categoryLabel: 'Globales del Sistema',
    keys: ['?'],
    action: 'Centro de Atajos de Teclado (Alternativo)',
    description: 'Invocable pulsando el signo de interrogación cuando no estés editando un campo de texto.',
    scope: 'Toda la aplicación'
  },
  {
    id: 'g-sidebar',
    category: 'global',
    categoryLabel: 'Globales del Sistema',
    keys: ['Ctrl', 'B'],
    action: 'Colapsar / Expandir Menú Lateral',
    description: 'Alterna entre el menú lateral compacto para maximizar el área de trabajo contable.',
    scope: 'Toda la aplicación'
  },
  {
    id: 'g-nav-modules',
    category: 'global',
    categoryLabel: 'Globales del Sistema',
    keys: ['Alt', '1..7'],
    action: 'Navegación Rápida a Módulos',
    description: 'Alt+1 Tablero, Alt+2 ADD, Alt+3 Pólizas, Alt+4 Cuentas, Alt+5 Bancos, Alt+6 Reportes, Alt+7 Ajustes.',
    scope: 'Navegación Contable'
  },
  {
    id: 'g-prev-period',
    category: 'global',
    categoryLabel: 'Globales del Sistema',
    keys: ['Alt', '['],
    action: 'Periodo Contable Anterior',
    description: 'Retrocede un mes contable (también con Alt+RePág cuando no se editan inputs).',
    scope: 'Periodo SAT'
  },
  {
    id: 'g-next-period',
    category: 'global',
    categoryLabel: 'Globales del Sistema',
    keys: ['Alt', ']'],
    action: 'Periodo Contable Siguiente',
    description: 'Avanza al siguiente periodo contable hasta el Cierre Anual P13 (también con Alt+AvPág).',
    scope: 'Periodo SAT'
  },
  {
    id: 'g-esc',
    category: 'global',
    categoryLabel: 'Globales del Sistema',
    keys: ['Esc'],
    action: 'Cerrar Diálogos y Modales',
    description: 'Cancela y cierra el modal o diálogo activo devolviendo el foco a la vista.',
    scope: 'Modales'
  },

  // 2. Catálogo de Cuentas
  {
    id: 'c-navigate',
    category: 'cuentas',
    categoryLabel: 'Catálogo de Cuentas',
    keys: ['↑', '↓'],
    action: 'Navegar Árbol de Cuentas',
    description: 'Desplazamiento vertical entre los renglones del catálogo contable en pantalla.',
    scope: 'Catálogo de Cuentas',
    targetRoute: '/cuentas'
  },
  {
    id: 'c-edit',
    category: 'cuentas',
    categoryLabel: 'Catálogo de Cuentas',
    keys: ['F2'],
    action: 'Editar Cuenta Seleccionada',
    description: 'Abre la edición de nombre, agrupador SAT, rubro y naturaleza de la cuenta.',
    scope: 'Catálogo de Cuentas',
    targetRoute: '/cuentas'
  },
  {
    id: 'c-edit-enter',
    category: 'cuentas',
    categoryLabel: 'Catálogo de Cuentas',
    keys: ['Enter'],
    action: 'Abrir Detalle / Edición',
    description: 'Accede a la ficha técnica o edición de la cuenta en foco.',
    scope: 'Catálogo de Cuentas',
    targetRoute: '/cuentas'
  },
  {
    id: 'c-subaccount',
    category: 'cuentas',
    categoryLabel: 'Catálogo de Cuentas',
    keys: ['Ctrl', 'D'],
    action: 'Crear Subcuenta Inmediata',
    description: 'Sugiere automáticamente el siguiente código consecutivo hijo respetando la jerarquía.',
    scope: 'Catálogo de Cuentas',
    targetRoute: '/cuentas'
  },
  {
    id: 'c-insert',
    category: 'cuentas',
    categoryLabel: 'Catálogo de Cuentas',
    keys: ['Insert'],
    action: 'Alta de Cuenta / Subcuenta',
    description: 'Abre el formulario para registrar una nueva cuenta contable según el nivel actual.',
    scope: 'Catálogo de Cuentas',
    targetRoute: '/cuentas'
  },
  {
    id: 'c-expand',
    category: 'cuentas',
    categoryLabel: 'Catálogo de Cuentas',
    keys: ['+'],
    action: 'Expandir Todo el Árbol',
    description: 'Despliega todas las ramas y subcuentas del catálogo de cuentas Anexo 24.',
    scope: 'Catálogo de Cuentas',
    targetRoute: '/cuentas'
  },
  {
    id: 'c-collapse',
    category: 'cuentas',
    categoryLabel: 'Catálogo de Cuentas',
    keys: ['-'],
    action: 'Contraer Todo el Árbol',
    description: 'Oculta las subcuentas mostrando únicamente las cuentas acumuladoras de nivel 1.',
    scope: 'Catálogo de Cuentas',
    targetRoute: '/cuentas'
  },

  // 3. Pólizas Contables
  {
    id: 'p-new',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['Alt', 'N'],
    action: 'Capturar Nueva Póliza Contable',
    description: 'Abre el modal de captura de pólizas con asignación automática de folio por tipo.',
    scope: 'Pólizas Contables',
    targetRoute: '/polizas'
  },
  {
    id: 'p-insert-row',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['Insert'],
    action: 'Nueva Póliza / Agregar Renglón',
    description: 'En el listado abre nueva póliza; dentro del editor añade un nuevo renglón de partida.',
    scope: 'Pólizas Contables',
    targetRoute: '/polizas'
  },
  {
    id: 'p-save',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['Ctrl', 'Enter'],
    action: 'Guardar Póliza Cuadrada',
    description: 'Verifica la partida doble y guarda la póliza actualizando saldos en tiempo real.',
    scope: 'Editor de Póliza',
    targetRoute: '/polizas'
  },
  {
    id: 'p-calc-iva',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['F4'],
    action: 'Calcular y Desglosar IVA 16%',
    description: 'Calcula automáticamente el 16% de IVA sobre el importe base del renglón en foco.',
    scope: 'Editor de Póliza',
    targetRoute: '/polizas'
  },
  {
    id: 'p-duplicate',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['Ctrl', 'D'],
    action: 'Duplicar Póliza Contable',
    description: 'Clona los movimientos de una póliza recurrente asignándole un nuevo folio consecutivo.',
    scope: 'Pólizas Contables',
    targetRoute: '/polizas'
  },
  {
    id: 'p-autobalance',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['='],
    action: 'Auto-cuadrar Partida Doble',
    description: 'Aplica el monto exacto de la diferencia en el Debe o Haber del renglón actual (también con Espacio).',
    scope: 'Editor de Póliza',
    targetRoute: '/polizas'
  },
  {
    id: 'p-copy-above',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['"'],
    action: 'Copiar Campo del Renglón Superior',
    description: 'Duplica el concepto o referencia de la partida previa (también con la tecla F3).',
    scope: 'Editor de Póliza',
    targetRoute: '/polizas'
  },
  {
    id: 'p-advance',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['Tab'],
    action: 'Avanzar al Siguiente Campo',
    description: 'Flujo ergonómico sin ratón: Cuenta → Referencia → Concepto → Cargo / Abono.',
    scope: 'Editor de Póliza',
    targetRoute: '/polizas'
  },
  {
    id: 'p-sat-catalog-f2',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['F2'],
    action: 'Búsqueda Rápida en Catálogo de Cuentas',
    description: 'Abre el selector de cuentas en tiempo real filtrando por código, nombre o código agrupador SAT.',
    scope: 'Editor de Póliza',
    targetRoute: '/polizas'
  },
  {
    id: 'p-asientos-tipo',
    category: 'polizas',
    categoryLabel: 'Pólizas Contables',
    keys: ['Alt', '1..3'],
    action: 'Plantillas de Asiento Tipo Preconfigurados',
    description: 'Aplica en 1 tecla la estructura de cuentas para: Alt+1 Cobro/Cliente, Alt+2 Pago/Proveedor, Alt+3 Nómina.',
    scope: 'Editor de Póliza',
    targetRoute: '/polizas'
  },

  // 4. CFDI y Bóveda Digital (ADD)
  {
    id: 'f-view-pdf',
    category: 'cfdi',
    categoryLabel: 'CFDI y Bóveda (ADD)',
    keys: ['Espacio'],
    action: 'Ver Factura PDF / Representación Gráfica',
    description: 'Abre la vista previa oficial del comprobante CFDI 4.0 con QR y desglose de impuestos.',
    scope: 'Bóveda Digital (ADD)',
    targetRoute: '/add'
  },
  {
    id: 'f-view-enter',
    category: 'cfdi',
    categoryLabel: 'CFDI y Bóveda (ADD)',
    keys: ['Enter'],
    action: 'Abrir Vista Previa / Detalle',
    description: 'Inspecciona los conceptos, sellos digitales y complementos del comprobante.',
    scope: 'Bóveda Digital (ADD)',
    targetRoute: '/add'
  },
  {
    id: 'f-download-xml',
    category: 'cfdi',
    categoryLabel: 'CFDI y Bóveda (ADD)',
    keys: ['D'],
    action: 'Descargar Archivo XML Certificado',
    description: 'Descarga al equipo local el archivo XML original sellado por el SAT.',
    scope: 'Bóveda Digital (ADD)',
    targetRoute: '/add'
  },
  {
    id: 'f-upload-xml',
    category: 'cfdi',
    categoryLabel: 'CFDI y Bóveda (ADD)',
    keys: ['U'],
    action: 'Cargar Archivos XML al ADD',
    description: 'Abre el explorador de archivos para importar facturas de ingresos, gastos o nóminas.',
    scope: 'Bóveda Digital (ADD)',
    targetRoute: '/add'
  },
  {
    id: 'f-autopoliza',
    category: 'cfdi',
    categoryLabel: 'CFDI y Bóveda (ADD)',
    keys: ['C'],
    action: 'Contabilizar CFDI Automáticamente',
    description: 'Convierte el comprobante XML en póliza cuadrada de ingresos, egresos o diario en 1 clic.',
    scope: 'Bóveda Digital (ADD)',
    targetRoute: '/add'
  }
];

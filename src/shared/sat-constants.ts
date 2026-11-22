export interface SatGroupCodeItem {
  code: string;
  name: string;
  type: 'ACTIVO' | 'PASIVO' | 'CAPITAL' | 'INGRESOS' | 'COSTOS' | 'GASTOS';
  nature: 'DEUDORA' | 'ACREEDORA';
}

/**
 * NASA JPL Power of 10 - Regla 2 (H-07):
 * Cotas superiores estáticas obligatorias para todos los bucles de procesamiento.
 */
export const SAFETY_BOUNDS = {
  MAX_XML_CONCEPTOS: 1000,
  MAX_XML_TAGS: 2500,
  MAX_XML_BYTES: 5 * 1024 * 1024,
  MAX_ZIP_UNCOMPRESSED_BYTES: 50 * 1024 * 1024,
  MAX_CSV_ROWS: 5000,
  MAX_CSV_LINE_LENGTH: 8192,
  MAX_BATCH_CFDI: 250,
  MAX_ACCOUNT_LEVEL: 5,
  MAX_POLIZA_MOVEMENTS: 500
} as const;

/**
 * NASA JPL Power of 10 - Regla 8 (H-02):
 * Diccionario centralizado de roles contables fiscales para eliminar "Magic Strings"
 * dispersos entre Backend y Frontend.
 */
export const FISCAL_ACCOUNT_ROLES = {
  BANCO_PRINCIPAL: {
    code: '102-01-001',
    aliases: ['102-01-002'],
    satGroupCode: '102.01',
    fallbackType: 'ACTIVO' as const
  },
  BANCO_SECUNDARIO: {
    code: '102-01-002',
    aliases: ['102-01-001'],
    satGroupCode: '102.01',
    fallbackType: 'ACTIVO' as const
  },
  CLIENTES_NACIONALES: {
    code: '105-01-099',
    aliases: ['105-01-001', '105-01-002'],
    satGroupCode: '105.01',
    fallbackType: 'ACTIVO' as const
  },
  ISR_ACREDITABLE_RETENIDO: {
    code: '113-02-001',
    aliases: [],
    satGroupCode: '113.02',
    fallbackType: 'ACTIVO' as const
  },
  IVA_ACREDITABLE_PAGADO: {
    code: '118-01-001',
    aliases: [],
    satGroupCode: '118.01',
    fallbackType: 'ACTIVO' as const
  },
  IVA_PENDIENTE_PAGO: {
    code: '119-01-001',
    aliases: [],
    satGroupCode: '119.01',
    fallbackType: 'ACTIVO' as const
  },
  PROVEEDORES_NACIONALES: {
    code: '201-01-099',
    aliases: ['201-01-001', '201-01-002'],
    satGroupCode: '201.01',
    fallbackType: 'PASIVO' as const
  },
  SUELDOS_POR_PAGAR: {
    code: '216-01-001',
    aliases: ['201-01-099', '201-01-001'],
    satGroupCode: '216.04',
    fallbackType: 'PASIVO' as const
  },
  IVA_TRASLADADO_COBRADO: {
    code: '208-01-001',
    aliases: [],
    satGroupCode: '208.01',
    fallbackType: 'PASIVO' as const
  },
  IVA_TRASLADADO_NO_COBRADO: {
    code: '209-01-001',
    aliases: [],
    satGroupCode: '209.01',
    fallbackType: 'PASIVO' as const
  },
  ISR_RETENIDO_POR_PAGAR: {
    code: '216-01-001',
    aliases: [],
    satGroupCode: '216.04',
    fallbackType: 'PASIVO' as const
  },
  IVA_RETENIDO_POR_PAGAR: {
    code: '216-01-002',
    aliases: ['216-02-001', '216-01-001'],
    satGroupCode: '216.10',
    fallbackType: 'PASIVO' as const
  },
  RESULTADO_DEL_EJERCICIO: {
    code: '301-02-001',
    aliases: ['301-01-001'],
    satGroupCode: '304.01',
    fallbackType: 'CAPITAL' as const
  },
  INGRESOS_TASA_16: {
    code: '401-01-001',
    aliases: ['401-01-002'],
    satGroupCode: '401.01',
    fallbackType: 'INGRESOS' as const
  },
  DEVOLUCIONES_DESCUENTOS: {
    code: '401-01-001',
    aliases: ['401-01-002'],
    satGroupCode: '401.01',
    fallbackType: 'INGRESOS' as const
  },
  COSTO_CLOUD_SERVIDORES: {
    code: '501-01-001',
    aliases: ['601-01-004'],
    satGroupCode: '501.02',
    fallbackType: 'COSTOS' as const
  },
  SUELDOS_Y_SALARIOS: {
    code: '601-01-001',
    aliases: [],
    satGroupCode: '601.01',
    fallbackType: 'GASTOS' as const
  },
  ARRENDAMIENTO: {
    code: '601-01-002',
    aliases: [],
    satGroupCode: '601.45',
    fallbackType: 'GASTOS' as const
  },
  HONORARIOS_SERVICIOS: {
    code: '601-01-003',
    aliases: [],
    satGroupCode: '601.32',
    fallbackType: 'GASTOS' as const
  },
  TELECOMUNICACIONES: {
    code: '601-01-004',
    aliases: ['601-01-003'],
    satGroupCode: '601.50',
    fallbackType: 'GASTOS' as const
  },
  COMISIONES_BANCARIAS: {
    code: '601-01-005',
    aliases: ['601-01-003'],
    satGroupCode: '701.10',
    fallbackType: 'GASTOS' as const
  },
  DEPRECIACION_ACUMULADA: {
    code: '171-01-001',
    aliases: ['156-01-001'],
    satGroupCode: '171',
    fallbackType: 'ACTIVO' as const
  },
  GASTO_DEPRECIACION: {
    code: '601-01-006',
    aliases: ['601-01-003', '601-01-002'],
    satGroupCode: '601.84',
    fallbackType: 'GASTOS' as const
  },
  GASTO_IMPUESTO_UTILIDAD: {
    code: '801-01-001',
    aliases: ['601-01-099', '601-01-003'],
    satGroupCode: '611.01',
    fallbackType: 'GASTOS' as const
  },
  IVA_A_FAVOR: {
    code: '113-01-001',
    aliases: ['118-01-001'],
    satGroupCode: '113.01',
    fallbackType: 'ACTIVO' as const
  },
  IVA_ACREDITABLE_RETENIDO: {
    code: '113-01-002',
    aliases: [],
    satGroupCode: '113.01',
    fallbackType: 'ACTIVO' as const
  },
  OTRAS_CUENTAS_POR_PAGAR: {
    code: '216-01-001',
    aliases: ['201-01-099', '201-01-001'],
    satGroupCode: '216.04',
    fallbackType: 'PASIVO' as const
  },
  PROVISION_ISR_POR_PAGAR: {
    code: '213-01-002',
    aliases: ['216-01-001', '201-01-099'],
    satGroupCode: '213.03',
    fallbackType: 'PASIVO' as const
  },
  PROVISION_IVA_POR_PAGAR: {
    code: '213-01-001',
    aliases: ['208-01-001'],
    satGroupCode: '213.01',
    fallbackType: 'PASIVO' as const
  },
  UTILIDAD_CAMBIARIA: {
    code: '702-01-001',
    aliases: ['401-01-001', '401-01-002'],
    satGroupCode: '702.01',
    fallbackType: 'INGRESOS' as const
  },
  PERDIDA_CAMBIARIA: {
    code: '701-01-001',
    aliases: ['601-01-005', '601-01-003'],
    satGroupCode: '701.01',
    fallbackType: 'GASTOS' as const
  }
} as const;

export type FiscalAccountRoleKey = keyof typeof FISCAL_ACCOUNT_ROLES;

export const SAT_GROUP_CODES: SatGroupCodeItem[] = [
  { code: '101', name: 'Caja', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '101.01', name: 'Caja y efectivo', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '102', name: 'Bancos', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '102.01', name: 'Bancos nacionales', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '102.02', name: 'Bancos extranjeros', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '105', name: 'Clientes', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '105.01', name: 'Clientes nacionales', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '107', name: 'Deudores diversos', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '107.01', name: 'Funcionarios y empleados', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '113', name: 'Impuestos a favor', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '113.01', name: 'IVA a favor', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '113.02', name: 'ISR a favor / Retenciones acreditables', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '115', name: 'Inventario', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '115.01', name: 'Inventario / Almacén general', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '118', name: 'Impuestos acreditables pagados', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '118.01', name: 'IVA acreditable pagado', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '119', name: 'Impuestos acreditables por pagar', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '119.01', name: 'IVA pendiente de pago', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '151', name: 'Terrenos', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '154', name: 'Automóviles, autobuses, camiones de carga', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '156', name: 'Equipo de cómputo', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '156.01', name: 'Equipo de cómputo', type: 'ACTIVO', nature: 'DEUDORA' },
  { code: '171', name: 'Depreciación acumulada de activos fijos', type: 'ACTIVO', nature: 'ACREEDORA' },
  { code: '201', name: 'Proveedores', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '201.01', name: 'Proveedores nacionales', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '205', name: 'Acreedores diversos a corto plazo', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '205.01', name: 'Socios, accionistas o representante legal', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '208', name: 'Impuestos trasladados cobrados', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '208.01', name: 'IVA trasladado cobrado', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '209', name: 'Impuestos trasladados no cobrados', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '209.01', name: 'IVA trasladado no cobrado', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '213', name: 'Impuestos y derechos por pagar', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '213.01', name: 'IVA por pagar', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '213.03', name: 'ISR por pagar', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '216', name: 'Impuestos retenidos', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '216.01', name: 'Impuestos retenidos de ISR por sueldos y salarios', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '216.03', name: 'Impuestos retenidos de ISR por arrendamiento', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '216.04', name: 'Impuestos retenidos de ISR por servicios profesionales', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '216.10', name: 'Impuestos retenidos de IVA', type: 'PASIVO', nature: 'ACREEDORA' },
  { code: '301', name: 'Capital social', type: 'CAPITAL', nature: 'ACREEDORA' },
  { code: '301.01', name: 'Capital fijo', type: 'CAPITAL', nature: 'ACREEDORA' },
  { code: '301.02', name: 'Capital variable', type: 'CAPITAL', nature: 'ACREEDORA' },
  { code: '304', name: 'Resultado de ejercicios anteriores', type: 'CAPITAL', nature: 'ACREEDORA' },
  { code: '304.01', name: 'Utilidad de ejercicios anteriores', type: 'CAPITAL', nature: 'ACREEDORA' },
  { code: '305', name: 'Resultado del ejercicio', type: 'CAPITAL', nature: 'ACREEDORA' },
  { code: '305.01', name: 'Utilidad del ejercicio', type: 'CAPITAL', nature: 'ACREEDORA' },
  { code: '401', name: 'Ingresos', type: 'INGRESOS', nature: 'ACREEDORA' },
  { code: '401.01', name: 'Ventas y/o servicios gravados a la tasa general', type: 'INGRESOS', nature: 'ACREEDORA' },
  { code: '401.04', name: 'Ventas y/o servicios gravados al 0%', type: 'INGRESOS', nature: 'ACREEDORA' },
  { code: '402', name: 'Devoluciones, descuentos o bonificaciones sobre ingresos', type: 'INGRESOS', nature: 'DEUDORA' },
  { code: '501', name: 'Costo de venta y/o servicio', type: 'COSTOS', nature: 'DEUDORA' },
  { code: '501.01', name: 'Costo de venta', type: 'COSTOS', nature: 'DEUDORA' },
  { code: '501.02', name: 'Servicios y/o mano de obra directa', type: 'COSTOS', nature: 'DEUDORA' },
  { code: '601', name: 'Gastos generales', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '601.01', name: 'Sueldos y salarios', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '601.32', name: 'Servicios administrativos y honorarios', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '601.45', name: 'Arrendamiento a personas morales residentes nacionales', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '601.50', name: 'Teléfono, internet y telecomunicaciones', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '601.51', name: 'Agua y energía eléctrica', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '601.55', name: 'Papelería y artículos de oficina', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '601.84', name: 'Otros gastos generales (Suscripciones Cloud / Software)', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '611', name: 'Impuesto Sobre la Renta', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '611.01', name: 'Impuesto Sobre la Renta del ejercicio', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '701', name: 'Gastos financieros', type: 'GASTOS', nature: 'DEUDORA' },
  { code: '701.10', name: 'Comisiones bancarias', type: 'GASTOS', nature: 'DEUDORA' }
];

export const MESES_SAT: Array<{ periodo: number; nombre: string; corto: string }> = [
  { periodo: 1, nombre: 'Enero', corto: 'Ene' },
  { periodo: 2, nombre: 'Febrero', corto: 'Feb' },
  { periodo: 3, nombre: 'Marzo', corto: 'Mar' },
  { periodo: 4, nombre: 'Abril', corto: 'Abr' },
  { periodo: 5, nombre: 'Mayo', corto: 'May' },
  { periodo: 6, nombre: 'Junio', corto: 'Jun' },
  { periodo: 7, nombre: 'Julio', corto: 'Jul' },
  { periodo: 8, nombre: 'Agosto', corto: 'Ago' },
  { periodo: 9, nombre: 'Septiembre', corto: 'Sep' },
  { periodo: 10, nombre: 'Octubre', corto: 'Oct' },
  { periodo: 11, nombre: 'Noviembre', corto: 'Nov' },
  { periodo: 12, nombre: 'Diciembre', corto: 'Dic' },
  { periodo: 13, nombre: 'Ajuste / Cierre del Ejercicio (Mes 13)', corto: 'Cierre' }
];

export const REGIMENES_FISCALES_SAT = [
  '601 - General de Ley Personas Morales',
  '603 - Personas Morales con Fines no Lucrativos',
  '612 - Personas Físicas con Actividades Empresariales y Profesionales',
  '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  '626 - Régimen Simplificado de Confianza (RESICO)'
];

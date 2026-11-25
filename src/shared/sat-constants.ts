import { SAT_GROUP_CODES, type SatGroupCodeItem } from './sat-group-codes-catalog';

export { SAT_GROUP_CODES, type SatGroupCodeItem };

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
  SUBSIDIO_EMPLEO_POR_APLICAR: {
    code: '110-01-001',
    aliases: [],
    satGroupCode: '110.01',
    fallbackType: 'ACTIVO' as const
  },
  IMPUESTOS_LOCALES_RETENIDOS_ACREDITABLES: {
    code: '113-03-001',
    aliases: [],
    satGroupCode: '113.03',
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
    code: '210-01-001',
    aliases: ['216-01-001', '201-01-099', '201-01-001'],
    satGroupCode: '210.01',
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
  IEPS_TRASLADADO_COBRADO: {
    code: '208-02-001',
    aliases: ['208-01-001'],
    satGroupCode: '208.02',
    fallbackType: 'PASIVO' as const
  },
  IEPS_TRASLADADO_NO_COBRADO: {
    code: '209-02-001',
    aliases: ['209-01-001'],
    satGroupCode: '209.02',
    fallbackType: 'PASIVO' as const
  },
  IEPS_ACREDITABLE_PAGADO: {
    code: '118-03-001',
    aliases: ['118-01-001'],
    satGroupCode: '118.03',
    fallbackType: 'ACTIVO' as const
  },
  IEPS_PENDIENTE_PAGO: {
    code: '119-03-001',
    aliases: ['119-01-001'],
    satGroupCode: '119.03',
    fallbackType: 'ACTIVO' as const
  },
  ISR_RETENIDO_POR_PAGAR: {
    code: '216-01-001',
    aliases: [],
    satGroupCode: '216.01',
    fallbackType: 'PASIVO' as const
  },
  ISR_RETENIDO_SALARIOS: {
    code: '216-01-001',
    aliases: [],
    satGroupCode: '216.01',
    fallbackType: 'PASIVO' as const
  },
  ISR_RETENIDO_ASIMILADOS: {
    code: '216-01-006',
    aliases: [],
    satGroupCode: '216.02',
    fallbackType: 'PASIVO' as const
  },
  ISR_RETENIDO_HONORARIOS: {
    code: '216-01-004',
    aliases: [],
    satGroupCode: '216.04',
    fallbackType: 'PASIVO' as const
  },
  IVA_RETENIDO_POR_PAGAR: {
    code: '216-01-002',
    aliases: [],
    satGroupCode: '216.10',
    fallbackType: 'PASIVO' as const
  },
  RESULTADO_DEL_EJERCICIO: {
    code: '305-01-001',
    aliases: ['301-02-001'],
    satGroupCode: '305.01',
    fallbackType: 'CAPITAL' as const
  },
  INGRESOS_TASA_16: {
    code: '401-01-001',
    aliases: ['401-01-002'],
    satGroupCode: '401.01',
    fallbackType: 'INGRESOS' as const
  },
  DEVOLUCIONES_DESCUENTOS: {
    code: '402-01-001',
    aliases: ['401-01-001', '401-01-002'],
    satGroupCode: '402.01',
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
  GASTO_NO_DEDUCIBLE: {
    code: '801-01-002',
    aliases: ['801-01-001'],
    satGroupCode: '601.84',
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
    code: '211-01-001',
    aliases: ['201-01-099', '201-01-001'],
    satGroupCode: '211.01',
    fallbackType: 'PASIVO' as const
  },
  PROVISION_ISR_POR_PAGAR: {
    code: '213-01-002',
    aliases: ['201-01-099'],
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
  '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios',
  '606 - Arrendamiento',
  '607 - Régimen de Enajenación o Adquisición de Bienes',
  '608 - Demás ingresos',
  '610 - Residentes en el Extranjero sin Establecimiento Permanente en México',
  '611 - Ingresos por Dividendos (socios y accionistas)',
  '612 - Personas Físicas con Actividades Empresariales y Profesionales',
  '614 - Ingresos por intereses',
  '615 - Régimen de los ingresos por obtención de premios',
  '616 - Sin obligaciones fiscales',
  '620 - Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
  '621 - Incorporación Fiscal',
  '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
  '623 - Opcional para Grupos de Sociedades',
  '624 - Coordinados',
  '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  '626 - Régimen Simplificado de Confianza (RESICO)'
];

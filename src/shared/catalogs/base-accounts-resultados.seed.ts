import type { Account, AccountNature, AccountType } from '../types';

type SeedAccount = Omit<Account, 'id' | 'companyId'>;

function acc(
  type: AccountType,
  nature: AccountNature,
  code: string,
  name: string,
  parentCode: string | null,
  level: number,
  isAffectable: boolean,
  satGroupCode: string,
  initialBalance = 0
): SeedAccount {
  return {
    code,
    name,
    parentCode,
    type,
    nature,
    level,
    isAffectable,
    satGroupCode,
    currency: 'MXN',
    initialBalance
  };
}

export const BASE_ACCOUNTS_RESULTADOS: ReadonlyArray<SeedAccount> = [
  // INGRESOS
  acc('INGRESOS', 'ACREEDORA', '400-00-000', 'INGRESOS', null, 1, false, '400'),
  acc('INGRESOS', 'ACREEDORA', '401-00-000', 'Ingresos por Ventas y Servicios Gravados', '400-00-000', 2, false, '401'),
  acc('INGRESOS', 'ACREEDORA', '401-01-001', 'Ventas y Servicios Gravados Tasa 16%', '401-00-000', 3, true, '401.01'),
  acc('INGRESOS', 'ACREEDORA', '401-01-002', 'Servicios Profesionales y Consultoría Tasa 16%', '401-00-000', 3, true, '401.01'),
  acc('INGRESOS', 'DEUDORA', '402-00-000', 'Devoluciones, Descuentos y Bonificaciones s/Ingresos', '400-00-000', 2, false, '402'),
  acc('INGRESOS', 'DEUDORA', '402-01-001', 'Devoluciones, Descuentos o Bonificaciones sobre Ventas', '402-00-000', 3, true, '402.01'),
  // COSTOS
  acc('COSTOS', 'DEUDORA', '500-00-000', 'COSTOS', null, 1, false, '500'),
  acc('COSTOS', 'DEUDORA', '501-00-000', 'Costo de Venta y Servicios', '500-00-000', 2, false, '501'),
  acc('COSTOS', 'DEUDORA', '501-01-001', 'Costo de Ventas y Servicios Directos', '501-00-000', 3, true, '501.02'),
  // GASTOS
  acc('GASTOS', 'DEUDORA', '600-00-000', 'GASTOS DE OPERACIÓN', null, 1, false, '600'),
  acc('GASTOS', 'DEUDORA', '601-00-000', 'Gastos Generales de Administración', '600-00-000', 2, false, '601'),
  acc('GASTOS', 'DEUDORA', '601-01-001', 'Sueldos y Salarios Administrativos', '601-00-000', 3, true, '601.01'),
  acc('GASTOS', 'DEUDORA', '601-01-002', 'Arrendamiento de Inmuebles y Oficinas', '601-00-000', 3, true, '601.45'),
  acc('GASTOS', 'DEUDORA', '601-01-003', 'Honorarios Contables, Legales y Servicios Generales', '601-00-000', 3, true, '601.32'),
  acc('GASTOS', 'DEUDORA', '601-01-004', 'Telecomunicaciones, Internet y Software', '601-00-000', 3, true, '601.50'),
  acc('GASTOS', 'DEUDORA', '601-01-005', 'Comisiones Bancarias y Financieras', '601-00-000', 3, true, '701.10'),
  acc('GASTOS', 'DEUDORA', '601-01-006', 'Depreciación Contable de Activos Fijos', '601-00-000', 3, true, '601.84'),
  acc('GASTOS', 'DEUDORA', '601-01-007', 'Cuotas Patronales IMSS', '601-00-000', 3, true, '601.26'),
  acc('GASTOS', 'DEUDORA', '601-01-008', 'Aportaciones INFONAVIT y SAR / RCV', '601-00-000', 3, true, '601.27'),
  acc('GASTOS', 'DEUDORA', '601-01-009', 'Combustibles y Lubricantes', '601-00-000', 3, true, '601.48'),
  acc('GASTOS', 'DEUDORA', '601-01-010', 'Energía Eléctrica, Agua y Servicios', '601-00-000', 3, true, '601.52'),
  // CUENTAS COMPLEMENTARIAS DE ACTIVO / PROVISIÓN IMPUESTOS / FINANCIERAS
  acc('ACTIVO', 'ACREEDORA', '171-00-000', 'Depreciación Acumulada de Activos Fijos', '100-00-000', 2, false, '171'),
  acc('ACTIVO', 'ACREEDORA', '171-01-001', 'Depreciación Acumulada de Activos Fijos', '171-00-000', 3, true, '171', 65000),
  acc('PASIVO', 'ACREEDORA', '213-00-000', 'Impuestos y Derechos por Pagar', '200-00-000', 2, false, '213'),
  acc('PASIVO', 'ACREEDORA', '213-01-001', 'IVA Definitivo por Pagar del Periodo', '213-00-000', 3, true, '213.01'),
  acc('PASIVO', 'ACREEDORA', '213-01-002', 'ISR Provisional por Pagar del Periodo', '213-00-000', 3, true, '213.03'),
  acc('GASTOS', 'DEUDORA', '701-01-001', 'Pérdida Cambiaria (Fluctuación Moneda Extranjera)', '601-00-000', 3, true, '701.01'),
  acc('INGRESOS', 'ACREEDORA', '702-01-001', 'Utilidad Cambiaria (Productos Financieros)', '401-00-000', 3, true, '702.01'),
  // PARTIDAS NO DEDUCIBLES / PROVISIÓN ISR
  acc('GASTOS', 'DEUDORA', '801-00-000', 'Impuesto Sobre la Renta y No Deducibles', null, 1, false, '611'),
  acc('GASTOS', 'DEUDORA', '801-01-000', 'ISR del Ejercicio y Partidas No Deducibles', '801-00-000', 2, false, '611'),
  acc('GASTOS', 'DEUDORA', '801-01-001', 'Provisión de ISR Ejercicio (No Deducible Art. 28 LISR)', '801-01-000', 3, true, '611.01'),
  acc('GASTOS', 'DEUDORA', '801-01-002', 'Gastos No Deducibles (Art. 28 LISR)', '801-01-000', 3, true, '601.74')
];

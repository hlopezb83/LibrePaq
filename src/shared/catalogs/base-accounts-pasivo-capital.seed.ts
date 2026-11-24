import type { Account, AccountNature, AccountType } from '../types';

type SeedAccount = Omit<Account, 'id' | 'companyId'>;

function acc(
  type: AccountType,
  code: string,
  name: string,
  parentCode: string | null,
  level: number,
  isAffectable: boolean,
  satGroupCode: string,
  initialBalance = 0,
  nature: AccountNature = 'ACREEDORA'
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

export const BASE_ACCOUNTS_PASIVO_CAPITAL: ReadonlyArray<SeedAccount> = [
  // PASIVO
  acc('PASIVO', '200-00-000', 'PASIVO', null, 1, false, '200'),
  acc('PASIVO', '201-00-000', 'Proveedores Nacionales', '200-00-000', 2, false, '201'),
  acc('PASIVO', '201-01-001', 'Proveedores Nacionales de Servicios', '201-00-000', 3, true, '201.01', 120000),
  acc('PASIVO', '201-01-002', 'Proveedores Nacionales de Bienes / Arrendamiento', '201-00-000', 3, true, '201.01'),
  acc('PASIVO', '201-01-099', 'Proveedores Nacionales General (ADD)', '201-00-000', 3, true, '201.01'),
  acc('PASIVO', '205-00-000', 'Acreedores Diversos a Corto Plazo', '200-00-000', 2, false, '205'),
  acc('PASIVO', '205-01-001', 'Acreedores Diversos Nacionales', '205-00-000', 3, true, '205.02'),
  acc('PASIVO', '208-00-000', 'Impuestos Trasladados Cobrados', '200-00-000', 2, false, '208'),
  acc('PASIVO', '208-01-001', 'IVA Trasladado Cobrado 16%', '208-00-000', 3, true, '208.01', 92000),
  acc('PASIVO', '208-02-001', 'IEPS Trasladado Cobrado', '208-00-000', 3, true, '208.02'),
  acc('PASIVO', '209-00-000', 'Impuestos Trasladados No Cobrados', '200-00-000', 2, false, '209'),
  acc('PASIVO', '209-01-001', 'IVA Trasladado Pendiente de Cobro 16%', '209-00-000', 3, true, '209.01', 56000),
  acc('PASIVO', '209-02-001', 'IEPS Trasladado Pendiente de Cobro', '209-00-000', 3, true, '209.02'),
  acc('PASIVO', '210-00-000', 'Sueldos y Salarios por Pagar', '200-00-000', 2, false, '210'),
  acc('PASIVO', '210-01-001', 'Sueldos y Salarios por Pagar', '210-00-000', 3, true, '210.01'),
  acc('PASIVO', '211-00-000', 'Provisiones y Cuotas de Seguridad Social por Pagar', '200-00-000', 2, false, '211'),
  acc('PASIVO', '211-01-001', 'Cuotas IMSS / Infonavit / RCV por Pagar', '211-00-000', 3, true, '211.01'),
  acc('PASIVO', '216-00-000', 'Impuestos Retenidos por Pagar', '200-00-000', 2, false, '216'),
  acc('PASIVO', '216-01-001', 'Retenciones de ISR por Sueldos y Salarios', '216-00-000', 3, true, '216.01', 15200),
  acc('PASIVO', '216-01-002', 'Retenciones de IVA por Pagar', '216-00-000', 3, true, '216.10'),
  acc('PASIVO', '216-01-003', 'Retenciones de ISR por Arrendamiento', '216-00-000', 3, true, '216.03'),
  acc('PASIVO', '216-01-004', 'Retenciones de ISR por Servicios Profesionales (Honorarios)', '216-00-000', 3, true, '216.04'),
  acc('PASIVO', '216-01-005', 'Retenciones de ISR RESICO por Pagar', '216-00-000', 3, true, '216.11'),
  // CAPITAL
  acc('CAPITAL', '300-00-000', 'CAPITAL CONTABLE', null, 1, false, '300'),
  acc('CAPITAL', '301-00-000', 'Capital Social y Resultados Acumulados', '300-00-000', 2, false, '301'),
  acc('CAPITAL', '301-01-001', 'Capital Social Fijo', '301-00-000', 3, true, '301.01', 1500000),
  acc('CAPITAL', '301-02-001', 'Utilidades Acumuladas de Ejercicios Anteriores', '301-00-000', 3, true, '304.01', 875000)
];

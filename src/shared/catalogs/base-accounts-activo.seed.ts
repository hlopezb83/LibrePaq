import type { Account, AccountNature, AccountType } from '../types';

type SeedAccount = Omit<Account, 'id' | 'companyId'>;

function acc(
  code: string,
  name: string,
  parentCode: string | null,
  level: number,
  isAffectable: boolean,
  satGroupCode: string,
  initialBalance = 0,
  nature: AccountNature = 'DEUDORA',
  type: AccountType = 'ACTIVO'
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

export const BASE_ACCOUNTS_ACTIVO: ReadonlyArray<SeedAccount> = [
  acc('100-00-000', 'ACTIVO', null, 1, false, '100'),
  acc('101-00-000', 'Caja y Efectivo', '100-00-000', 2, false, '101'),
  acc('101-01-001', 'Caja General', '101-00-000', 3, true, '101.01'),
  acc('102-00-000', 'Bancos Nacionales', '100-00-000', 2, false, '102'),
  acc('102-01-001', 'Banco Nacional Cuenta Principal MXN', '102-00-000', 3, true, '102.01', 1450000),
  acc('102-01-002', 'Banco Nacional Cuenta Secundaria / Nómina MXN', '102-00-000', 3, true, '102.01', 420000),
  acc('105-00-000', 'Clientes Nacionales', '100-00-000', 2, false, '105'),
  acc('105-01-001', 'Clientes Nacionales General', '105-00-000', 3, true, '105.01', 290000),
  acc('105-01-002', 'Clientes Nacionales Crédito PPD', '105-00-000', 3, true, '105.01', 116000),
  acc('105-01-099', 'Clientes Nacionales Mostrador / ADD', '105-00-000', 3, true, '105.01'),
  acc('107-00-000', 'Deudores Diversos', '100-00-000', 2, false, '107'),
  acc('107-01-001', 'Deudores Diversos, Funcionarios y Empleados', '107-00-000', 3, true, '107.01'),
  acc('113-00-000', 'Impuestos a Favor y Retenciones Acreditables', '100-00-000', 2, false, '113'),
  acc('113-01-001', 'IVA a Favor del Periodo', '113-00-000', 3, true, '113.01'),
  acc('113-01-002', 'IVA Retenido por Clientes (Acreditable)', '113-00-000', 3, true, '113.01'),
  acc('113-02-001', 'ISR Retenido por Clientes / Subsidio Acreditable', '113-00-000', 3, true, '113.02'),
  acc('115-00-000', 'Inventarios', '100-00-000', 2, false, '115'),
  acc('115-01-001', 'Almacén / Inventario de Mercancías', '115-00-000', 3, true, '115.01'),
  acc('118-00-000', 'Impuestos Acreditables Pagados', '100-00-000', 2, false, '118'),
  acc('118-01-001', 'IVA Acreditable Pagado 16%', '118-00-000', 3, true, '118.01', 48000),
  acc('118-03-001', 'IEPS Acreditable Pagado', '118-00-000', 3, true, '118.03'),
  acc('119-00-000', 'Impuestos Acreditables Pendientes', '100-00-000', 2, false, '119'),
  acc('119-01-001', 'IVA Pendiente de Acreditar 16%', '119-00-000', 3, true, '119.01', 19200),
  acc('119-03-001', 'IEPS Pendiente de Acreditar', '119-00-000', 3, true, '119.03'),
  acc('153-00-000', 'Maquinaria y Equipo', '100-00-000', 2, false, '153'),
  acc('153-01-001', 'Maquinaria y Equipo de Operación', '153-00-000', 3, true, '153.01'),
  acc('154-00-000', 'Equipo de Transporte', '100-00-000', 2, false, '154'),
  acc('154-01-001', 'Automóviles y Equipo de Transporte', '154-00-000', 3, true, '154.01'),
  acc('155-00-000', 'Mobiliario y Equipo de Oficina', '100-00-000', 2, false, '155'),
  acc('155-01-001', 'Mobiliario y Equipo de Oficina', '155-00-000', 3, true, '155.01'),
  acc('156-00-000', 'Equipo de Cómputo y Tecnología', '100-00-000', 2, false, '156'),
  acc('156-01-001', 'Equipo de Cómputo y Servidores', '156-00-000', 3, true, '156.01', 380000)
];

import type { Account } from '../types';
import { FISCAL_ACCOUNT_ROLES } from '../sat-constants';

export function createMockCatalog(): { accounts: Account[]; byId: Map<string, Account> } {
  const baseAccounts: Array<
    Pick<
      Account,
      'id' | 'code' | 'name' | 'satGroupCode' | 'type' | 'nature' | 'level' | 'parentCode' | 'isAffectable'
    >
  > = [
    {
      id: 'acc-100',
      code: '100-00-000',
      name: 'ACTIVO',
      satGroupCode: '100',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 1,
      parentCode: null,
      isAffectable: false
    },
    {
      id: 'acc-bancos',
      code: FISCAL_ACCOUNT_ROLES.BANCO_PRINCIPAL.code,
      name: 'BBVA Bancomer Cuenta Maestra MXN',
      satGroupCode: '102.01',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      parentCode: '102-00-000',
      isAffectable: true
    },
    {
      id: 'acc-clientes',
      code: FISCAL_ACCOUNT_ROLES.CLIENTES_NACIONALES.code,
      name: 'Clientes Nacionales General',
      satGroupCode: '105.01',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      parentCode: '105-00-000',
      isAffectable: true
    },
    {
      id: 'acc-iva-acreditable',
      code: FISCAL_ACCOUNT_ROLES.IVA_ACREDITABLE_PAGADO.code,
      name: 'IVA Acreditable Pagado 16%',
      satGroupCode: '118.01',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      parentCode: '118-00-000',
      isAffectable: true
    },
    {
      id: 'acc-iva-pend-acred',
      code: FISCAL_ACCOUNT_ROLES.IVA_PENDIENTE_PAGO.code,
      name: 'IVA Pendiente de Pago (PPD)',
      satGroupCode: '119.01',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      parentCode: '119-00-000',
      isAffectable: true
    },
    {
      id: 'acc-proveedores',
      code: FISCAL_ACCOUNT_ROLES.PROVEEDORES_NACIONALES.code,
      name: 'Proveedores Nacionales General',
      satGroupCode: '201.01',
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 3,
      parentCode: '201-00-000',
      isAffectable: true
    },
    {
      id: 'acc-iva-trasladado',
      code: FISCAL_ACCOUNT_ROLES.IVA_TRASLADADO_COBRADO.code,
      name: 'IVA Trasladado Cobrado 16%',
      satGroupCode: '208.01',
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 3,
      parentCode: '208-00-000',
      isAffectable: true
    },
    {
      id: 'acc-iva-pend-trasl',
      code: FISCAL_ACCOUNT_ROLES.IVA_TRASLADADO_NO_COBRADO.code,
      name: 'IVA Pendiente de Cobro (PPD)',
      satGroupCode: '209.01',
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 3,
      parentCode: '209-00-000',
      isAffectable: true
    },
    {
      id: 'acc-ret-isr',
      code: FISCAL_ACCOUNT_ROLES.ISR_RETENIDO_POR_PAGAR.code,
      name: 'Retención de ISR por Pagar',
      satGroupCode: '216.04',
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 3,
      parentCode: '216-00-000',
      isAffectable: true
    },
    {
      id: 'acc-ret-iva',
      code: FISCAL_ACCOUNT_ROLES.IVA_RETENIDO_POR_PAGAR.code,
      name: 'Retención de IVA por Pagar',
      satGroupCode: '216.10',
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 3,
      parentCode: '216-00-000',
      isAffectable: true
    },
    {
      id: 'acc-ventas',
      code: FISCAL_ACCOUNT_ROLES.INGRESOS_TASA_16.code,
      name: 'Ventas y Servicios Gravados al 16%',
      satGroupCode: '401.01',
      type: 'INGRESOS',
      nature: 'ACREEDORA',
      level: 3,
      parentCode: '401-00-000',
      isAffectable: true
    },
    {
      id: 'acc-costo-cloud',
      code: FISCAL_ACCOUNT_ROLES.COSTO_CLOUD_SERVIDORES.code,
      name: 'Costo de Infraestructura Cloud y Servidores',
      satGroupCode: '501.02',
      type: 'COSTOS',
      nature: 'DEUDORA',
      level: 3,
      parentCode: '501-00-000',
      isAffectable: true
    },
    {
      id: 'acc-sueldos',
      code: FISCAL_ACCOUNT_ROLES.SUELDOS_Y_SALARIOS.code,
      name: 'Sueldos y Salarios',
      satGroupCode: '601.01',
      type: 'GASTOS',
      nature: 'DEUDORA',
      level: 3,
      parentCode: '601-00-000',
      isAffectable: true
    },
    {
      id: 'acc-honorarios',
      code: FISCAL_ACCOUNT_ROLES.HONORARIOS_SERVICIOS.code,
      name: 'Honorarios y Servicios Profesionales',
      satGroupCode: '601.32',
      type: 'GASTOS',
      nature: 'DEUDORA',
      level: 3,
      parentCode: '601-00-000',
      isAffectable: true
    }
  ];

  const accounts: Account[] = baseAccounts.map((a) => ({
    ...a,
    companyId: 'comp-test',
    currency: 'MXN',
    initialBalance: 0
  }));

  const byId = new Map<string, Account>();
  for (const acc of accounts) {
    byId.set(acc.id, acc);
  }

  return { accounts, byId };
}

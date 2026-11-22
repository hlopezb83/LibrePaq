import { describe, expect, test } from 'bun:test';
import { buildSatAnexo24Xml } from '../sat-anexo24';
import type { AccountWithBalance, Company, Poliza } from '../types';

describe('SAT Anexo 24 v1.3 — Generador Oficial de Contabilidad Electrónica', () => {
  const testCompany: Company = {
    id: 'comp_sat_test',
    name: 'CONTABILIDAD Y AUDITORIA DEL NORTE S.A. DE C.V.',
    rfc: 'CAN2001019K2',
    regimenFiscal: '601 - General de Ley Personas Morales',
    codigoPostal: '64000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 10,
    createdAt: '2026-01-01'
  };

  const testAccounts: AccountWithBalance[] = [
    {
      id: 'acc_100',
      companyId: 'comp_sat_test',
      code: '100-00-000',
      name: 'ACTIVO CIRCULANTE',
      parentCode: null,
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 1,
      isAffectable: false,
      satGroupCode: '100',
      currency: 'MXN',
      initialBalance: 0,
      initialBalanceComputed: 150000,
      periodCharges: 50000,
      periodCredits: 20000,
      finalBalance: 180000
    },
    {
      id: 'acc_102',
      companyId: 'comp_sat_test',
      code: '102-01-001',
      name: 'BBVA Cuenta Maestra & Fondos',
      parentCode: '100-00-000',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 2,
      isAffectable: true,
      satGroupCode: '102.01',
      currency: 'MXN',
      initialBalance: 150000,
      initialBalanceComputed: 150000,
      periodCharges: 50000,
      periodCredits: 20000,
      finalBalance: 180000
    },
    {
      id: 'acc_201',
      companyId: 'comp_sat_test',
      code: '201-01-001',
      name: 'Proveedores Nacionales',
      parentCode: null,
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 1,
      isAffectable: true,
      satGroupCode: '201.01',
      currency: 'MXN',
      initialBalance: 80000,
      initialBalanceComputed: 80000,
      periodCharges: 15000,
      periodCredits: 35000,
      finalBalance: 100000
    }
  ];

  const testPolizas: Poliza[] = [
    {
      id: 'pol_01',
      companyId: 'comp_sat_test',
      tipo: 'INGRESO',
      folio: 101,
      fecha: '2026-10-15',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Cobro de Factura CFDI con IVA',
      cfdiUuid: 'C1234567-89AB-CDEF-0123-456789ABCDEF',
      origin: 'MANUAL',
      totalCargos: 58000,
      totalAbonos: 58000,
      isBalanced: true,
      createdAt: '2026-10-15',
      movements: [
        {
          id: 'mov_01',
          polizaId: 'pol_01',
          accountId: 'acc_102',
          accountCode: '102-01-001',
          accountName: 'BBVA Cuenta Maestra & Fondos',
          referencia: 'DEP-9812',
          concepto: 'Depósito cliente',
          cargo: 58000,
          abono: 0,
          cfdiUuid: 'C1234567-89AB-CDEF-0123-456789ABCDEF'
        },
        {
          id: 'mov_02',
          polizaId: 'pol_01',
          accountId: 'acc_201',
          accountCode: '201-01-001',
          accountName: 'Proveedores Nacionales',
          referencia: 'DEP-9812',
          concepto: 'Contrapartida',
          cargo: 0,
          abono: 58000,
          cfdiUuid: null
        }
      ]
    }
  ];

  test('1. Catálogo de Cuentas (CT.xml): Nomenclatura oficial, XSD v1.3 y jerarquía de cuentas', () => {
    const res = buildSatAnexo24Xml(testCompany, 2026, 10, 'catalogo', testAccounts);

    // Nomenclatura oficial: [RFC][AAAA][MM]CT.xml
    expect(res.filename).toBe('CAN2001019K2202610CT.xml');
    expect(res.type).toContain('Catálogo de Cuentas');

    // Declaración XML y namespaces XSD 1.3
    expect(res.xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
    expect(res.xml).toContain('<catalogocuentas:Catalogo');
    expect(res.xml).toContain('xmlns:catalogocuentas="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/CatalogoCuentas"');
    expect(res.xml).toContain('Version="1.3"');
    expect(res.xml).toContain('RFC="CAN2001019K2"');
    expect(res.xml).not.toContain('TotalCtas=');
    expect(res.xml).toContain('Mes="10"');
    expect(res.xml).toContain('Anio="2026"');

    // Elementos de cuentas
    expect(res.xml).toContain('NumCta="100-00-000"');
    expect(res.xml).toContain('CodAgrup="100"');
    expect(res.xml).toContain('Natur="D"');

    // Subcuenta con parentCode
    expect(res.xml).toContain('NumCta="102-01-001"');
    expect(res.xml).toContain('SubCtaDe="100-00-000"');
    expect(res.xml).toContain('Nivel="2"');

    // Cuenta acreedora
    expect(res.xml).toContain('NumCta="201-01-001"');
    expect(res.xml).toContain('Natur="A"');

    // Cierre del tag raíz
    expect(res.xml).toEndWith('</catalogocuentas:Catalogo>');
  });

  test('2. Balanza de Comprobación Mensual (BN.xml): TipoEnvio="N", sin atributo obsoleto TotalCtas y saldos con 2 decimales', () => {
    const res = buildSatAnexo24Xml(testCompany, 2026, 10, 'balanza', testAccounts);

    // Nomenclatura oficial: [RFC][AAAA][MM]BN.xml
    expect(res.filename).toBe('CAN2001019K2202610BN.xml');
    expect(res.type).toContain('Balanza de Comprobación');

    // Atributos obligatorios
    expect(res.xml).toContain('<BCE:Balanza');
    expect(res.xml).toContain('xmlns:BCE="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion"');
    expect(res.xml).toContain('Version="1.3"');
    expect(res.xml).toContain('TipoEnvio="N"');
    expect(res.xml).not.toContain('TotalCtas=');
    expect(res.xml).toContain('Mes="10"');
    expect(res.xml).toContain('Anio="2026"');

    // Saldos formateados con 2 decimales estrictos
    expect(res.xml).toContain('NumCta="102-01-001"');
    expect(res.xml).toContain('SaldoIni="150000.00"');
    expect(res.xml).toContain('Debe="50000.00"');
    expect(res.xml).toContain('Haber="20000.00"');
    expect(res.xml).toContain('SaldoFin="180000.00"');

    expect(res.xml).toEndWith('</BCE:Balanza>');
  });

  test('3. Balanza de Cierre Anual: Mes 13 genera sufijo 13BN.xml con TipoEnvio="N" por defecto o 13BC.xml con "C"', () => {
    const resNormal = buildSatAnexo24Xml(testCompany, 2026, 13, 'balanza', testAccounts);
    expect(resNormal.filename).toBe('CAN2001019K2202613BN.xml');
    expect(resNormal.xml).toContain('TipoEnvio="N"');
    expect(resNormal.xml).toContain('Mes="13"');
    expect(resNormal.xml).not.toContain('TotalCtas=');
    expect(resNormal.xml).not.toContain('FechaModBal=');

    const resComp = buildSatAnexo24Xml(testCompany, 2026, 13, 'balanza', testAccounts, [], {
      tipoEnvio: 'C',
      fechaModBal: '2027-04-15'
    });
    expect(resComp.filename).toBe('CAN2001019K2202613BC.xml');
    expect(resComp.xml).toContain('TipoEnvio="C"');
    expect(resComp.xml).toContain('FechaModBal="2027-04-15"');
  });

  test('4. Pólizas del Periodo (PL.xml): Nomenclatura, transacciones y soporte de CompNal CFDI con RFC contraparte', () => {
    const res = buildSatAnexo24Xml(testCompany, 2026, 10, 'polizas', testAccounts, testPolizas);

    // Nomenclatura oficial: [RFC][AAAA][MM]PL.xml
    expect(res.filename).toBe('CAN2001019K2202610PL.xml');
    expect(res.type).toContain('Pólizas del Periodo');

    // Esquema XSD de Pólizas
    expect(res.xml).toContain('<PLZ:Polizas');
    expect(res.xml).toContain('xmlns:PLZ="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/PolizasPeriodo"');
    expect(res.xml).toContain('Version="1.3"');
    expect(res.xml).toContain('TipoSolicitud="AF"');

    // Nodo de Póliza
    expect(res.xml).toContain('NumUnIdenPol="INGRESO-101"');
    expect(res.xml).toContain('Fecha="2026-10-15"');

    // Transacción y comprobante fiscal digital con RFC de contraparte (no el propio RFC CAN2001019K2)
    expect(res.xml).toContain('<PLZ:Transaccion NumCta="102-01-001"');
    expect(res.xml).toContain('Debe="58000.00"');
    expect(res.xml).toContain('<PLZ:CompNal UUID_CFDI="C1234567-89AB-CDEF-0123-456789ABCDEF"');
    expect(res.xml).toContain('RFC="XAXX010101000"');

    expect(res.xml).toEndWith('</PLZ:Polizas>');
  });

  test('5. Sanitización estricta de caracteres especiales (&, <, >, ", \') en XML', () => {
    const res = buildSatAnexo24Xml(testCompany, 2026, 10, 'catalogo', testAccounts);

    // 'BBVA Cuenta Maestra & Fondos' debe ser escapada como '&amp;'
    expect(res.xml).toContain('BBVA Cuenta Maestra &amp; Fondos');
    expect(res.xml).not.toContain('BBVA Cuenta Maestra & Fondos');
  });

  test('6. Catálogo de Cuentas: periodo 13 se acota a Mes="12" y Pólizas soporta NumTramite en DE', () => {
    const resCat13 = buildSatAnexo24Xml(testCompany, 2026, 13, 'catalogo', testAccounts);
    expect(resCat13.filename).toBe('CAN2001019K2202612CT.xml');
    expect(resCat13.xml).toContain('Mes="12"');

    const resPolDE = buildSatAnexo24Xml(testCompany, 2026, 10, 'polizas', testAccounts, testPolizas, {
      tipoSolicitud: 'DE',
      numTramite: 'DE1234567890'
    });
    expect(resPolDE.xml).toContain('TipoSolicitud="DE"');
    expect(resPolDE.xml).toContain('NumTramite="DE1234567890"');
  });
});

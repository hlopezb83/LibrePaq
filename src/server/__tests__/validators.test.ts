import { describe, expect, test } from 'bun:test';
import {
  buildSatAnexo24Xml,
  resolveYearAndPeriod,
  validateAccountCreatePayload,
  validateAccountUpdatePayload,
  validatePeriodPayload,
  validatePolizaPayload
} from '../validators';
import { AccountingInvariantError } from '../../shared/accounting-engine';
import type { AccountWithBalance, Company } from '../../shared/types';

describe('validators — Year, Period & Financial Range Resolvers', () => {
  const mockCompany: Company = {
    id: 'comp-1',
    name: 'EMPRESA TEST',
    rfc: 'AAA010101AAA',
    regimenFiscal: '601',
    codigoPostal: '01000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 10,
    createdAt: '2026-01-01'
  };

  test('resolveYearAndPeriod extracts valid query params', () => {
    expect(resolveYearAndPeriod('2025', '3', mockCompany)).toEqual({
      year: 2025,
      period: 3
    });
  });

  test('resolveYearAndPeriod falls back to company defaults on missing or invalid params', () => {
    expect(resolveYearAndPeriod(undefined, undefined, mockCompany)).toEqual({
      year: 2026,
      period: 10
    });
    expect(resolveYearAndPeriod('not-a-year', '99', mockCompany)).toEqual({
      year: 2026,
      period: 10
    });
  });

  test('validatePeriodPayload validates valid periods and throws on out-of-range values', () => {
    expect(validatePeriodPayload({ currentYear: 2026, currentPeriod: 12 })).toEqual({
      currentYear: 2026,
      currentPeriod: 12
    });
    expect(() => validatePeriodPayload({ currentYear: 1899, currentPeriod: 5 })).toThrow(
      AccountingInvariantError
    );
    expect(() => validatePeriodPayload({ currentYear: 2026, currentPeriod: 14 })).toThrow(
      AccountingInvariantError
    );
  });
});

describe('validators — Account & Poliza Payloads', () => {
  test('validateAccountCreatePayload validates and normalizes account data', () => {
    const valid = validateAccountCreatePayload({
      companyId: 'comp-1',
      code: '102-01-001',
      name: 'Banco BBVA',
      parentCode: '102-00-000',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      isAffectable: true,
      satGroupCode: '102.01',
      initialBalance: 15000
    });

    expect(valid.code).toBe('102-01-001');
    expect(valid.name).toBe('Banco BBVA');
    expect(valid.level).toBe(3);
    expect(valid.initialBalance).toBe(15000);
  });

  test('validateAccountCreatePayload throws on missing code or name', () => {
    expect(() => validateAccountCreatePayload({ code: '' })).toThrow(
      AccountingInvariantError
    );
    expect(() => validateAccountCreatePayload({ code: '101-00-000', name: '' })).toThrow(
      AccountingInvariantError
    );
  });

  test('validateAccountUpdatePayload validates update fields', () => {
    const updated = validateAccountUpdatePayload({
      name: 'Caja Chica Modificada',
      satGroupCode: '101.01',
      nature: 'DEUDORA',
      type: 'ACTIVO',
      initialBalance: 2000
    });
    expect(updated.name).toBe('Caja Chica Modificada');
    expect(updated.initialBalance).toBe(2000);
  });

  test('validatePolizaPayload verifies concept and movements structure', () => {
    const poliza = validatePolizaPayload({
      companyId: 'comp-1',
      tipo: 'INGRESO',
      fecha: '2026-10-15',
      concepto: 'Cobro de factura F-100',
      cfdiUuid: 'ABCD-1234',
      movements: [
        { accountId: 'acc-1', cargo: 1000, abono: 0 },
        { accountId: 'acc-2', cargo: 0, abono: 1000 }
      ]
    });

    expect(poliza.tipo).toBe('INGRESO');
    expect(poliza.concepto).toBe('Cobro de factura F-100');
    expect(poliza.movements).toHaveLength(2);
    expect(poliza.movements[0]?.cargo).toBe(1000);
  });

  test('validatePolizaPayload throws if concepto is missing', () => {
    expect(() =>
      validatePolizaPayload({
        companyId: 'comp-1',
        concepto: '',
        movements: []
      })
    ).toThrow(AccountingInvariantError);
  });
});

describe('validators — SAT Anexo 24 XML Generation', () => {
  const mockCompany: Company = {
    id: 'comp-1',
    name: 'SOLUCIONES TECNOLOGICAS SA DE CV',
    rfc: 'STN190822M94',
    regimenFiscal: '601',
    codigoPostal: '01000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 10,
    createdAt: '2026-01-01'
  };

  const mockTrialBalance: AccountWithBalance[] = [
    {
      id: 'acc-100',
      companyId: 'comp-1',
      code: '100-00-000',
      name: 'ACTIVO',
      parentCode: null,
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 1,
      isAffectable: false,
      satGroupCode: '100',
      currency: 'MXN',
      initialBalance: 0,
      initialBalanceComputed: 100000,
      periodCharges: 25000,
      periodCredits: 10000,
      finalBalance: 115000
    },
    {
      id: 'acc-102',
      companyId: 'comp-1',
      code: '102-01-001',
      name: 'BBVA Bancomer Cta 1234',
      parentCode: '100-00-000',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 2,
      isAffectable: true,
      satGroupCode: '102.01',
      currency: 'MXN',
      initialBalance: 100000,
      initialBalanceComputed: 100000,
      periodCharges: 25000,
      periodCredits: 10000,
      finalBalance: 115000
    }
  ];

  test('buildSatAnexo24Xml creates compliant Catálogo de Cuentas XML (v1.3)', () => {
    const res = buildSatAnexo24Xml(mockCompany, 2026, 10, 'catalogo', mockTrialBalance);
    expect(res.filename).toBe('STN190822M94202610CT.xml');
    expect(res.xml).toContain('catalogocuentas:Catalogo');
    expect(res.xml).toContain('Version="1.3"');
    expect(res.xml).toContain('RFC="STN190822M94"');
    expect(res.xml).not.toContain('NumCta="100-00-000"');
    expect(res.xml).toContain('NumCta="102-01-001"');
    expect(res.xml).toContain('CodAgrup="102.01"');
    expect(res.xml).toContain('Natur="D"');
  });

  test('buildSatAnexo24Xml creates compliant Balanza de Comprobación XML (v1.3)', () => {
    const res = buildSatAnexo24Xml(mockCompany, 2026, 10, 'balanza', mockTrialBalance);
    expect(res.filename).toBe('STN190822M94202610BN.xml');
    expect(res.xml).toContain('BCE:Balanza');
    expect(res.xml).toContain('TipoEnvio="N"');
    expect(res.xml).toContain('SaldoIni="100000.00"');
    expect(res.xml).toContain('Debe="25000.00"');
    expect(res.xml).toContain('Haber="10000.00"');
    expect(res.xml).toContain('SaldoFin="115000.00"');
  });

  test('buildSatAnexo24Xml sets 13BN.xml for Normal or 13BC.xml for Complementaria in period 13', () => {
    const res = buildSatAnexo24Xml(mockCompany, 2026, 13, 'balanza', mockTrialBalance);
    expect(res.filename).toBe('STN190822M94202613BN.xml');
    expect(res.xml).toContain('TipoEnvio="N"');
    expect(res.xml).not.toContain('TotalCtas=');

    const resComp = buildSatAnexo24Xml(mockCompany, 2026, 13, 'balanza', mockTrialBalance, [], {
      tipoEnvio: 'C',
      fechaModBal: '2027-04-15'
    });
    expect(resComp.filename).toBe('STN190822M94202613BC.xml');
    expect(resComp.xml).toContain('TipoEnvio="C"');
    expect(resComp.xml).toContain('FechaModBal="2027-04-15"');
  });
});

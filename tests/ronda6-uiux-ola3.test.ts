import { describe, expect, test } from 'bun:test';
import { filterAccountPickerOptions } from '../src/components/account-picker/accountPickerSearch';
import { getLedgerNatureLabels } from '../src/components/account-ledger/AccountLedgerKpiGrid';
import { buildLedgerPeriodSuffix } from '../src/components/account-ledger/useAccountLedger';
import {
  buildCatalogoImportPreview,
  exportCatalogoCsv,
  parseCatalogoCsvWithReport
} from '../src/views/catalogo/catalogoCsvIo';
import { filterSatGroupCodes } from '../src/views/catalogo/SatGroupCodePicker';
import {
  filterPolizas,
  hasPolizaCfdi,
  isPolizaDateInDifferentPeriod
} from '../src/views/polizas/filterPolizas';
import {
  createPolizaSnapshot,
  isPolizaSnapshotDirty,
  isValidSatUuid,
  shouldTriggerDittoKey
} from '../src/views/polizas/polizaDirtyCheck';
import type { AccountWithBalance, Poliza } from '../src/shared/types';

function makeAccount(overrides: Partial<AccountWithBalance> = {}): AccountWithBalance {
  return {
    id: 'acc-1',
    companyId: 'c1',
    code: '102-01-001',
    name: 'Bancos Nacionales Santander',
    parentCode: '102-00-000',
    type: 'ACTIVO',
    nature: 'DEUDORA',
    level: 3,
    isAffectable: true,
    satGroupCode: '102.01',
    currency: 'MXN',
    initialBalance: 1000,
    initialBalanceComputed: 5500,
    periodCharges: 2000,
    periodCredits: 500,
    finalBalance: 7000,
    ...overrides
  };
}

describe('Ronda 6 Ola 3 — UI/UX, WCAG 2.1 AA y Ergonomía Contable', () => {
  test('1. isDirty en modo edición compara snapshot completo (tipo, fecha, concepto, cfdiUuids y partidas) + ditto " y UUID', () => {
    const initial = createPolizaSnapshot({
      tipo: 'EGRESO',
      fecha: '2026-10-15',
      concepto: 'Pago de honorarios',
      cfdiUuids: ['550e8400-e29b-41d4-a716-446655440000'],
      movements: [
        {
          accountId: 'acc-1',
          referencia: 'REF-01',
          concepto: 'Honorarios',
          cargo: 1000,
          abono: 0,
          cfdiUuid: '550e8400-e29b-41d4-a716-446655440000'
        },
        {
          accountId: 'acc-2',
          referencia: 'REF-01',
          concepto: 'Bancos',
          cargo: 0,
          abono: 1000,
          cfdiUuid: null
        }
      ]
    });

    // Sin cambios (incluso con diferencia de mayúsculas/espacios en UUID) -> no dirty
    const unchanged = createPolizaSnapshot({
      tipo: 'EGRESO',
      fecha: '2026-10-15',
      concepto: 'Pago de honorarios',
      cfdiUuids: ['550E8400-E29B-41D4-A716-446655440000'],
      movements: [
        {
          accountId: 'acc-1',
          referencia: 'REF-01',
          concepto: 'Honorarios',
          cargo: 1000,
          abono: 0,
          cfdiUuid: '550E8400-E29B-41D4-A716-446655440000'
        },
        {
          accountId: 'acc-2',
          referencia: 'REF-01',
          concepto: 'Bancos',
          cargo: 0,
          abono: 1000,
          cfdiUuid: null
        }
      ]
    });
    expect(isPolizaSnapshotDirty(initial, unchanged)).toBe(false);

    // Cambio en tipo, concepto, cfdiUuids o importe de partida -> dirty
    expect(isPolizaSnapshotDirty(initial, { ...unchanged, tipo: 'DIARIO' })).toBe(true);
    expect(isPolizaSnapshotDirty(initial, { ...unchanged, concepto: 'Pago editado' })).toBe(true);
    expect(isPolizaSnapshotDirty(initial, { ...unchanged, cfdiUuids: [] })).toBe(true);
    expect(
      isPolizaSnapshotDirty(initial, {
        ...unchanged,
        movements: [{ ...unchanged.movements[0]!, cargo: 1200 }, unchanged.movements[1]!]
      })
    ).toBe(true);

    // Ditto " solo cuando vacío o todo seleccionado; F3 en cualquier posición
    expect(shouldTriggerDittoKey('"', '', 0, 0)).toBe(true);
    expect(shouldTriggerDittoKey('"', 'REF-01', 0, 6)).toBe(true);
    expect(shouldTriggerDittoKey('"', 'Tubería 2', 9, 9)).toBe(false);
    expect(shouldTriggerDittoKey('"', 'Factura ', 8, 8)).toBe(false);
    expect(shouldTriggerDittoKey('F3', 'Tubería 2', 4, 4)).toBe(true);

    // Validación inline UUID SAT
    expect(isValidSatUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    expect(isValidSatUuid('uuid-invalido')).toBe(false);
  });

  test('2. isPolizaDateInDifferentPeriod en Mes 13 (diciembre válido) y filtro unificado hasPolizaCfdi', () => {
    // En Mes 13 (Cierre Anual), diciembre del año activo es válido
    expect(isPolizaDateInDifferentPeriod('2026-12-31', 2026, 13)).toBe(false);
    expect(isPolizaDateInDifferentPeriod('2026-11-30', 2026, 13)).toBe(true);
    expect(isPolizaDateInDifferentPeriod('2025-12-31', 2026, 13)).toBe(true);
    // Periodos ordinarios
    expect(isPolizaDateInDifferentPeriod('2026-10-15', 2026, 10)).toBe(false);
    expect(isPolizaDateInDifferentPeriod('2026-09-15', 2026, 10)).toBe(true);

    const polMoveOnlyUuid: Poliza = {
      id: 'p1',
      companyId: 'c1',
      tipo: 'DIARIO',
      folio: 1,
      fecha: '2026-10-10',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Póliza con CFDI solo en partida',
      cfdiUuid: null,
      origin: 'MANUAL',
      totalCargos: 100,
      totalAbonos: 100,
      isBalanced: true,
      createdAt: '2026-10-10',
      movements: [
        {
          id: 'm1',
          polizaId: 'p1',
          accountId: 'a1',
          accountCode: '102-01-001',
          accountName: 'Bancos',
          referencia: 'REF',
          concepto: 'Mov',
          cargo: 100,
          abono: 0,
          cfdiUuid: '550E8400-E29B-41D4-A716-446655440000'
        }
      ]
    };

    expect(hasPolizaCfdi(polMoveOnlyUuid)).toBe(true);
    expect(filterPolizas([polMoveOnlyUuid], 'ALL', 'WITH_CFDI', '')).toHaveLength(1);
    expect(filterPolizas([polMoveOnlyUuid], 'ALL', 'MANUAL', '')).toHaveLength(0);
  });

  test('3. Libro Mayor: signos según naturaleza Acreedora vs Deudora y rango en nombre CSV', () => {
    expect(getLedgerNatureLabels('DEUDORA')).toEqual({
      chargesLabel: '(+) Cargos del Periodo',
      creditsLabel: '(-) Abonos del Periodo'
    });
    expect(getLedgerNatureLabels('ACREEDORA')).toEqual({
      chargesLabel: '(-) Cargos del Periodo',
      creditsLabel: '(+) Abonos del Periodo'
    });

    expect(buildLedgerPeriodSuffix(1, 10)).toBe('P01-P10');
    expect(buildLedgerPeriodSuffix(10, 10)).toBe('P10');
  });

  test('4. Normalización sin acentos ni guiones en AccountPicker y SatGroupCodePicker', () => {
    const accounts = [
      makeAccount({ id: 'a1', code: '102-01-001', name: 'Bancos Nacionales', satGroupCode: '102.01' }),
      makeAccount({ id: 'a2', code: '601-01-003', name: 'Comisión Bancaria y Nómina', satGroupCode: '601.84' })
    ];

    const byCompactCode = filterAccountPickerOptions(accounts, '10201');
    expect(byCompactCode.map((a) => a.id)).toEqual(['a1']);

    const byNoAccent = filterAccountPickerOptions(accounts, 'comision');
    expect(byNoAccent.map((a) => a.id)).toEqual(['a2']);

    const byNomina = filterAccountPickerOptions(accounts, 'nomina');
    expect(byNomina.map((a) => a.id)).toEqual(['a2']);

    // SatGroupCodePicker normaliza acentos NFD
    const satMatches = filterSatGroupCodes('comision');
    expect(satMatches.length).toBeGreaterThan(0);
    const satEmpty = filterSatGroupCodes('zzzzz-inexistente-999');
    expect(satEmpty).toHaveLength(0);
  });

  test('5. Preview CSV detecta nuevas, actualizaciones y filas omitidas con línea/motivo, y exporta initialBalanceComputed real', () => {
    const csv = [
      'Código Cuenta,Nombre de la Cuenta,Código Agrupador SAT,Rubro,Naturaleza,Nivel,Afectable,Saldo Inicial',
      '102-01-001,Bancos Actualizado,102.01,ACTIVO,DEUDORA,3,Sí,0',
      '601-01-099,Gastos Publicidad,601.84,GASTOS,DEUDORA,3,Sí,0',
      'INVALIDO,Cuenta Mala,601.84,GASTOS,DEUDORA,3,Sí,0',
      '601-01-100,,601.84,GASTOS,DEUDORA,3,Sí,0'
    ].join('\n');

    const existing = [makeAccount({ code: '102-01-001', initialBalance: 1000, initialBalanceComputed: 5500 })];
    const report = parseCatalogoCsvWithReport(csv);
    expect(report.rows).toHaveLength(2);
    expect(report.skipped).toHaveLength(2);
    expect(report.skipped[0]?.lineNumber).toBe(4);
    expect(report.skipped[1]?.lineNumber).toBe(5);

    const preview = buildCatalogoImportPreview('catalogo.csv', csv, existing);
    expect(preview.toUpdate.map((r) => r.code)).toEqual(['102-01-001']);
    expect(preview.toCreate.map((r) => r.code)).toEqual(['601-01-099']);
    expect(preview.skipped).toHaveLength(2);

    // Verifica que exportCatalogoCsv incluya initialBalanceComputed (5500) además de initialBalance (1000)
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalDoc = globalThis.document;
    let capturedCsv = '';

    class MockBlob {
      constructor(parts: BlobPart[]) {
        capturedCsv = parts.map((p) => String(p)).join('');
      }
    }
    const OriginalBlob = globalThis.Blob;
    globalThis.Blob = MockBlob as unknown as typeof Blob;
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => {};
    globalThis.document = {
      createElement: () => ({
        href: '',
        download: '',
        click: () => {}
      })
    } as unknown as Document;

    try {
      exportCatalogoCsv(existing, 'XAXX010101000', 2026, 10);
      expect(capturedCsv).toContain('Saldo Inicial Acumulado');
      expect(capturedCsv).toContain('Saldo Apertura Enero');
      expect(capturedCsv).toContain('5500');
      expect(capturedCsv).toContain('1000');
    } finally {
      globalThis.Blob = OriginalBlob;
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      globalThis.document = originalDoc;
    }
  });
});

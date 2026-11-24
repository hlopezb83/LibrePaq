import './setup-test-db';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  computeFielTrafficLight,
  computeOverallClientTrafficLight
} from '../src/lib/supabase/supabase-despacho-monitor';
import { getAccounts } from '../src/server/repositories/accounts.repo';
import { createCompanyRecord, deleteCompanyRecord } from '../src/server/repositories/companies.repo';
import { setPeriodLock } from '../src/server/repositories/period-locks.repo';
import { reclassifyAccountMovements } from '../src/server/repositories/polizas-reclassify.repo';
import { createPolizaTransaction, getPolizas } from '../src/server/repositories/polizas.repo';
import { initDatabase } from '../src/server/schema';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';
import { computeDiotReportData } from '../src/shared/engine/diot.engine';
import { buildInversePolizaDraft } from '../src/shared/engine/poliza-productivity';
import { computeThreeWayTieout } from '../src/shared/engine/three-way-tieout.engine';
import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  Poliza
} from '../src/shared/types';
import { buildCatalogoImportPreview } from '../src/views/catalogo/catalogoCsvIo';
import {
  parseAnexo24XmlCatalogOrBalanza,
  parseContpaqiTxtCatalog
} from '../src/views/catalogo/catalogoMigrationParsers';
import { filterPolizas } from '../src/views/polizas/filterPolizas';

const TEST_COMPANY: Company = {
  id: 'comp_r7_ola5',
  name: 'COMERCIALIZADORA OLA 5 S.A. DE C.V.',
  rfc: 'COL220510AB1',
  regimenFiscal: '601 - General de Ley Personas Morales',
  codigoPostal: '64000',
  maskFormat: 'XXX-XX-XXX',
  currentYear: 2026,
  currentPeriod: 10,
  createdAt: '2026-01-01T00:00:00.000Z'
};

function makeTrialBalance(overrides: Record<string, { charges?: number; credits?: number }> = {}): AccountWithBalance[] {
  return getSeedAccountsForPreset('SAT_STANDARD').map((a) => {
    const ov = overrides[a.code] ?? {};
    const charges = ov.charges ?? 0;
    const credits = ov.credits ?? 0;
    return {
      ...a,
      id: `${TEST_COMPANY.id}_${a.code}`,
      companyId: TEST_COMPANY.id,
      initialBalance: 0,
      initialBalanceComputed: 0,
      periodCharges: charges,
      periodCredits: credits,
      finalBalance: a.nature === 'DEUDORA' ? charges - credits : credits - charges
    };
  });
}

function makeCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_1',
    companyId: TEST_COMPANY.id,
    uuid: 'AAAA1111-1111-4111-8111-111111111111',
    fecha: '2026-10-10',
    tipoComprobante: 'I',
    direction: 'EMITIDO',
    serie: 'A',
    folio: '100',
    emisorRfc: TEST_COMPANY.rfc,
    emisorNombre: TEST_COMPANY.name,
    receptorRfc: 'XAXX010101000',
    receptorNombre: 'PUBLICO EN GENERAL',
    conceptoPrincipal: 'Venta de mercancías',
    claveProdServ: '43211500',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 10000,
    descuento: 0,
    ivaTrasladado: 1600,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 11600,
    metodoPago: 'PUE',
    formaPago: '03',
    usoCfdi: 'G03',
    statusSat: 'VIGENTE',
    polizaId: 'pol_1',
    xmlRaw: '',
    ...overrides
  };
}

describe('Ronda 7 — Ola 5: Sustitución CONTPAQi Contabilidad Básico', () => {
  let createdCompanyId = '';

  beforeAll(() => {
    initDatabase();
    const created = createCompanyRecord({
      name: 'DESPACHO OLA 5 TEST S.A.',
      rfc: 'DOT240101XY9',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 10,
      userId: 'usr_ola5_test'
    });
    createdCompanyId = created.id;
  });

  afterAll(() => {
    if (createdCompanyId) {
      deleteCompanyRecord(createdCompanyId, 'usr_ola5_test', 'ola5@test.mx');
    }
  });

  test('1. Amarre Integral 3-Vías cuadra en VERDE cuando ADD, Contabilidad y DIOT coinciden', () => {
    const cfdiIng = makeCfdi({
      id: 'cfdi_ing',
      uuid: '11111111-1111-4111-8111-111111111111',
      direction: 'EMITIDO',
      subtotal: 10000,
      ivaTrasladado: 1600,
      total: 11600,
      polizaId: 'pol_ing_1'
    });
    const cfdiGas = makeCfdi({
      id: 'cfdi_gas',
      uuid: '22222222-2222-4222-8222-222222222222',
      direction: 'RECIBIDO',
      emisorRfc: 'PROV900101AA1',
      emisorNombre: 'PROVEEDOR UNO SA',
      receptorRfc: TEST_COMPANY.rfc,
      subtotal: 4000,
      ivaTrasladado: 640,
      total: 4640,
      polizaId: 'pol_gas_1'
    });

    const tb = makeTrialBalance({
      '102-01-001': { charges: 11600, credits: 4640 },
      '401-01-001': { credits: 10000 },
      '208-01-001': { credits: 1600 },
      '601-01-001': { charges: 4000 },
      '118-01-001': { charges: 640 }
    });

    const polizas: Poliza[] = [
      {
        id: 'pol_ing_1',
        companyId: TEST_COMPANY.id,
        tipo: 'INGRESO',
        folio: 1,
        fecha: '2026-10-10',
        ejercicio: 2026,
        periodo: 10,
        concepto: 'Cobro factura',
        cfdiUuid: cfdiIng.uuid,
        origin: 'ADD_AUTO',
        totalCargos: 11600,
        totalAbonos: 11600,
        isBalanced: true,
        createdAt: '2026-10-10T00:00:00Z',
        movements: []
      },
      {
        id: 'pol_gas_1',
        companyId: TEST_COMPANY.id,
        tipo: 'EGRESO',
        folio: 1,
        fecha: '2026-10-12',
        ejercicio: 2026,
        periodo: 10,
        concepto: 'Pago proveedor',
        cfdiUuid: cfdiGas.uuid,
        origin: 'ADD_AUTO',
        totalCargos: 4640,
        totalAbonos: 4640,
        isBalanced: true,
        createdAt: '2026-10-12T00:00:00Z',
        movements: []
      }
    ];

    const diot = computeDiotReportData({
      company: TEST_COMPANY,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [cfdiIng, cfdiGas],
      polizaIdsInPeriod: new Set(['pol_ing_1', 'pol_gas_1']),
      trialBalance: tb
    });

    const tieout = computeThreeWayTieout({
      company: TEST_COMPANY,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [cfdiIng, cfdiGas],
      polizas,
      trialBalance: tb,
      diotReport: diot
    });

    expect(tieout.status).toBe('VERDE');
    expect(tieout.deltas.deltaIngresos).toBe(0);
    expect(tieout.deltas.deltaGastos).toBe(0);
    expect(tieout.deltas.deltaIvaAcreditable).toBe(0);
    expect(tieout.deltas.deltaIvaTrasladado).toBe(0);
    expect(tieout.deltas.deltaIvaAcreditableDiot).toBe(0);
    expect(tieout.causes).toHaveLength(0);
  });

  test('2. Amarre 3-Vías detecta póliza manual con IVA sin CFDI y CFDIs pendientes vs ADD/DIOT', () => {
    const cfdiPendiente = makeCfdi({
      id: 'cfdi_pend',
      uuid: '33333333-3333-4333-8333-333333333333',
      direction: 'RECIBIDO',
      emisorRfc: 'PROV900101AA1',
      subtotal: 2000,
      ivaTrasladado: 320,
      total: 2320,
      polizaId: null
    });

    // Contabilidad tiene una póliza manual de IVA acreditable por $500 que NO está en ADD ni DIOT
    const tb = makeTrialBalance({
      '601-01-001': { charges: 3125 },
      '118-01-001': { charges: 500 },
      '102-01-001': { credits: 3625 }
    });

    const manualPoliza: Poliza = {
      id: 'pol_manual_iva',
      companyId: TEST_COMPANY.id,
      tipo: 'EGRESO',
      folio: 9,
      fecha: '2026-10-15',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Gasto manual con IVA sin XML',
      cfdiUuid: null,
      origin: 'MANUAL',
      totalCargos: 3625,
      totalAbonos: 3625,
      isBalanced: true,
      createdAt: '2026-10-15T00:00:00Z',
      movements: [
        {
          id: 'm1',
          polizaId: 'pol_manual_iva',
          accountId: 'acc_601',
          accountCode: '601-01-001',
          accountName: 'Gastos Generales',
          referencia: 'E-9',
          concepto: 'Gasto',
          cargo: 3125,
          abono: 0,
          cfdiUuid: null
        },
        {
          id: 'm2',
          polizaId: 'pol_manual_iva',
          accountId: 'acc_118',
          accountCode: '118-01-001',
          accountName: 'IVA Acreditable Pagado',
          referencia: 'E-9',
          concepto: 'IVA manual sin CFDI',
          cargo: 500,
          abono: 0,
          cfdiUuid: null
        },
        {
          id: 'm3',
          polizaId: 'pol_manual_iva',
          accountId: 'acc_102',
          accountCode: '102-01-001',
          accountName: 'Bancos',
          referencia: 'E-9',
          concepto: 'Pago',
          cargo: 0,
          abono: 3625,
          cfdiUuid: null
        }
      ]
    };

    const diot = computeDiotReportData({
      company: TEST_COMPANY,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [cfdiPendiente],
      polizaIdsInPeriod: new Set(['pol_manual_iva']),
      trialBalance: tb
    });

    const tieout = computeThreeWayTieout({
      company: TEST_COMPANY,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [cfdiPendiente],
      polizas: [manualPoliza],
      trialBalance: tb,
      diotReport: diot
    });

    expect(tieout.status).toBe('ROJO');
    expect(tieout.deltas.deltaIvaAcreditable).toBe(180); // 500 libros - 320 ADD
    expect(tieout.deltas.deltaIvaAcreditableDiot).toBe(500); // 500 libros - 0 DIOT
    expect(tieout.causes.some((c) => c.code === 'MANUAL_IVA_SIN_CFDI')).toBe(true);
    expect(tieout.causes.some((c) => c.code === 'CFDIS_PENDIENTES')).toBe(true);
    expect(tieout.causes.some((c) => c.code === 'DISCREPANCIA_DIOT_LIBROS')).toBe(true);
  });

  test('3. Póliza Inversa intercambia cargo <-> abono, cuadra al centavo y evita duplicar cfdiUuid', () => {
    const original: Poliza = {
      id: 'pol_orig_42',
      companyId: TEST_COMPANY.id,
      tipo: 'EGRESO',
      folio: 42,
      fecha: '2026-10-08',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Compra papelería proveedor XYZ',
      cfdiUuid: '99999999-9999-4999-8999-999999999999',
      cfdiUuids: ['99999999-9999-4999-8999-999999999999'],
      origin: 'ADD_AUTO',
      totalCargos: 1160.35,
      totalAbonos: 1160.35,
      isBalanced: true,
      createdAt: '2026-10-08T00:00:00Z',
      movements: [
        {
          id: 'm1',
          polizaId: 'pol_orig_42',
          accountId: 'acc_gasto',
          accountCode: '601-01-001',
          accountName: 'Gastos',
          referencia: 'F-42',
          concepto: 'Subtotal',
          cargo: 1000.3,
          abono: 0,
          cfdiUuid: '99999999-9999-4999-8999-999999999999'
        },
        {
          id: 'm2',
          polizaId: 'pol_orig_42',
          accountId: 'acc_iva',
          accountCode: '118-01-001',
          accountName: 'IVA Acreditable',
          referencia: 'F-42',
          concepto: 'IVA 16%',
          cargo: 160.05,
          abono: 0,
          cfdiUuid: '99999999-9999-4999-8999-999999999999'
        },
        {
          id: 'm3',
          polizaId: 'pol_orig_42',
          accountId: 'acc_bancos',
          accountCode: '102-01-001',
          accountName: 'Bancos',
          referencia: 'F-42',
          concepto: 'Salida',
          cargo: 0,
          abono: 1160.35,
          cfdiUuid: '99999999-9999-4999-8999-999999999999'
        }
      ]
    };

    const inv = buildInversePolizaDraft(original, { fecha: '2026-10-20', periodo: 10 });
    expect(inv.concepto).toBe('Reverso de EGRESO #42: Compra papelería proveedor XYZ');
    expect(inv.cfdiUuid).toBeNull();
    expect(inv.cfdiUuids).toEqual([]);
    expect(inv.isBalanced).toBe(true);
    expect(inv.totalCargos).toBe(1160.35);
    expect(inv.totalAbonos).toBe(1160.35);
    expect(inv.movements[0]?.cargo).toBe(0);
    expect(inv.movements[0]?.abono).toBe(1000.3);
    expect(inv.movements[0]?.cfdiUuid).toBeNull();
    expect(inv.movements[2]?.cargo).toBe(1160.35);
    expect(inv.movements[2]?.abono).toBe(0);
  });

  test('4. Reclasificación Masiva traslada poliza_movements y respeta candado fiscal period_locks', () => {
    const accounts = getAccounts(createdCompanyId);
    const affectables = accounts.filter((a) => a.isAffectable);
    const bankAcc = affectables.find((a) => a.code.startsWith('102'))!;
    const gastoA = affectables.find((a) => a.code.startsWith('601'))!;
    const gastoB = affectables.find((a) => a.code.startsWith('601') && a.id !== gastoA.id) ??
      affectables.find((a) => a.code.startsWith('501'))!;
    const nonAffectable = accounts.find((a) => !a.isAffectable)!;

    const pol = createPolizaTransaction({
      companyId: createdCompanyId,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'EGRESO',
      fecha: '2026-10-05',
      concepto: 'Gasto a reclasificar',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: gastoA.id, cargo: 2500, abono: 0, concepto: 'Renglón A' },
        { accountId: bankAcc.id, cargo: 0, abono: 2500, concepto: 'Pago banco' }
      ]
    });

    // Rechaza cuenta acumuladora (no afectable)
    expect(() =>
      reclassifyAccountMovements({
        companyId: createdCompanyId,
        fromAccountId: gastoA.id,
        toAccountId: nonAffectable.id,
        ejercicio: 2026,
        periodFrom: 10,
        periodTo: 10
      })
    ).toThrow(/acumuladora/i);

    // Bloquea periodo 10 y verifica rechazo por period_locks
    setPeriodLock(createdCompanyId, 2026, 10, true, 'Cierre prueba');
    expect(() =>
      reclassifyAccountMovements({
        companyId: createdCompanyId,
        fromAccountId: gastoA.id,
        toAccountId: gastoB.id,
        ejercicio: 2026,
        periodFrom: 10,
        periodTo: 10
      })
    ).toThrow(/CERRADO|candado/i);

    // Abre periodo 10 y ejecuta reclasificación masiva exitosa
    setPeriodLock(createdCompanyId, 2026, 10, false, 'Reapertura prueba');
    const res = reclassifyAccountMovements({
      companyId: createdCompanyId,
      fromAccountId: gastoA.id,
      toAccountId: gastoB.id,
      ejercicio: 2026,
      periodFrom: 10,
      periodTo: 10
    });

    expect(res.updatedMovementsCount).toBe(1);
    expect(res.affectedPolizasCount).toBe(1);

    const updatedPol = getPolizas(createdCompanyId, 2026, 10).find((p) => p.id === pol.id)!;
    expect(updatedPol.movements.some((m) => m.accountId === gastoB.id && m.accountCode === gastoB.code)).toBe(true);
    expect(updatedPol.movements.some((m) => m.accountId === gastoA.id)).toBe(false);
  });

  test('5. filterPolizas soporta búsqueda avanzada por monto mínimo y máximo', () => {
    const sample: Poliza[] = [
      {
        id: 'p1', companyId: TEST_COMPANY.id, tipo: 'DIARIO', folio: 1, fecha: '2026-10-01',
        ejercicio: 2026, periodo: 10, concepto: 'Chica', cfdiUuid: null, origin: 'MANUAL',
        totalCargos: 500, totalAbonos: 500, isBalanced: true, createdAt: '', movements: []
      },
      {
        id: 'p2', companyId: TEST_COMPANY.id, tipo: 'INGRESO', folio: 2, fecha: '2026-10-02',
        ejercicio: 2026, periodo: 10, concepto: 'Media', cfdiUuid: null, origin: 'MANUAL',
        totalCargos: 2500.5, totalAbonos: 2500.5, isBalanced: true, createdAt: '', movements: []
      },
      {
        id: 'p3', companyId: TEST_COMPANY.id, tipo: 'EGRESO', folio: 3, fecha: '2026-10-03',
        ejercicio: 2026, periodo: 10, concepto: 'Alta', cfdiUuid: null, origin: 'MANUAL',
        totalCargos: 15000, totalAbonos: 15000, isBalanced: true, createdAt: '', movements: []
      }
    ];

    const filtered = filterPolizas(sample, 'ALL', 'ALL', '', {
      minAmount: 1000,
      maxAmount: 5000
    });
    expect(filtered.map((p) => p.id)).toEqual(['p2']);
  });

  test('6. Migración CONTPAQi TXT, Anexo 24 CT.xml y BN.xml con validación Deudor === Acreedor', () => {
    const txtContpaqi = [
      'C\t10000000\tACTIVO\t\tAD',
      'C\t10201001\tBancos Nacionales\t10000000\tAD\t102.01\t50000',
      'C 601-01-099 Gastos de Viaje 601.84'
    ].join('\n');

    const txtRes = parseContpaqiTxtCatalog(txtContpaqi);
    expect(txtRes.format).toBe('CONTPAQI_TXT');
    expect(txtRes.rows).toHaveLength(3);
    expect(txtRes.rows[1]?.code).toBe('102-01-001');
    expect(txtRes.rows[1]?.satGroupCode).toBe('102.01');
    expect(txtRes.rows[1]?.initialBalance).toBe(50000);
    expect(txtRes.rows[2]?.code).toBe('601-01-099');
    expect(txtRes.rows[2]?.satGroupCode).toBe('601.84');

    const ctXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalogocuentas:Catalogo Version="1.3" RFC="DOT240101XY9" Mes="01" Anio="2026">
  <catalogocuentas:Ctas CodAgrup="102.01" NumCta="102-01-001" Desc="BBVA Bancomer" Nivel="3" Natur="D"/>
  <catalogocuentas:Ctas CodAgrup="301.01" NumCta="301-01-001" Desc="Capital Social" Nivel="3" Natur="A"/>
</catalogocuentas:Catalogo>`;

    const ctPreview = buildCatalogoImportPreview('DOT240101XY9202601CT.xml', ctXml, []);
    expect(ctPreview.fileFormat).toBe('ANEXO24_CT_XML');
    expect(ctPreview.fechaInicioOperaciones).toBe('2026-01');
    expect(ctPreview.allValidRows).toHaveLength(2);
    expect(ctPreview.allValidRows[1]?.nature).toBe('ACREEDORA');

    const bnXmlBalanced = `<?xml version="1.0" encoding="UTF-8"?>
<BCE:Balanza Version="1.3" RFC="DOT240101XY9" Mes="01" Anio="2026" TipoEnvio="N">
  <BCE:Ctas NumCta="102-01-001" SaldoIni="100000.00" Debe="5000.00" Haber="0.00" SaldoFin="105000.00"/>
  <BCE:Ctas NumCta="301-01-001" SaldoIni="100000.00" Debe="0.00" Haber="0.00" SaldoFin="100000.00"/>
  <BCE:Ctas NumCta="401-01-001" SaldoIni="0.00" Debe="0.00" Haber="5000.00" SaldoFin="5000.00"/>
</BCE:Balanza>`;

    const bnOk = parseAnexo24XmlCatalogOrBalanza(bnXmlBalanced);
    expect(bnOk.format).toBe('ANEXO24_BN_XML');
    expect(bnOk.balanzaValidation?.isBalanced).toBe(true);
    expect(bnOk.balanzaValidation?.totalDeudor).toBe(100000);
    expect(bnOk.balanzaValidation?.totalAcreedor).toBe(100000);
    expect(bnOk.balanzaValidation?.totalDebe).toBe(5000);
    expect(bnOk.balanzaValidation?.totalHaber).toBe(5000);

    const bnXmlUnbalanced = `<?xml version="1.0" encoding="UTF-8"?>
<BCE:Balanza Version="1.3" RFC="DOT240101XY9" Mes="01" Anio="2026" TipoEnvio="N">
  <BCE:Ctas NumCta="102-01-001" SaldoIni="100000.00" Debe="0.00" Haber="0.00" SaldoFin="100000.00"/>
  <BCE:Ctas NumCta="301-01-001" SaldoIni="90000.00" Debe="0.00" Haber="0.00" SaldoFin="90000.00"/>
</BCE:Balanza>`;

    const bnBad = parseAnexo24XmlCatalogOrBalanza(bnXmlUnbalanced);
    expect(bnBad.balanzaValidation?.isBalanced).toBe(false);
    expect(bnBad.balanzaValidation?.difference).toBe(10000);
  });

  test('7. Tablero Semáforo Despacho evalúa vigencia e.firma y estatus global VERDE/AMARILLO/ROJO', () => {
    const now = Date.UTC(2026, 9, 15);
    const in60Days = new Date(now + 60 * 86_400_000).toISOString();
    const in10Days = new Date(now + 10 * 86_400_000).toISOString();
    const expired = new Date(now - 2 * 86_400_000).toISOString();

    expect(computeFielTrafficLight(in60Days, true, now).status).toBe('VIGENTE');
    expect(computeFielTrafficLight(in10Days, true, now).status).toBe('POR_VENCER');
    expect(computeFielTrafficLight(expired, true, now).status).toBe('VENCIDA');
    expect(computeFielTrafficLight(null, false, now).status).toBe('SIN_FIEL');

    expect(
      computeOverallClientTrafficLight({
        fielStatus: 'VIGENTE',
        pendingCfdisCount: 0,
        pendingBankLinesCount: 0,
        periodLockStatus: 'ABIERTO',
        dia17Ready: true
      })
    ).toBe('VERDE');

    expect(
      computeOverallClientTrafficLight({
        fielStatus: 'POR_VENCER',
        pendingCfdisCount: 0,
        pendingBankLinesCount: 0,
        periodLockStatus: 'ABIERTO',
        dia17Ready: true
      })
    ).toBe('AMARILLO');

    expect(
      computeOverallClientTrafficLight({
        fielStatus: 'VENCIDA',
        pendingCfdisCount: 0,
        pendingBankLinesCount: 0,
        periodLockStatus: 'ABIERTO',
        dia17Ready: true
      })
    ).toBe('ROJO');
  });
});

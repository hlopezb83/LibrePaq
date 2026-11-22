import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../schema';
import { createCompanyRecord, deleteCompanyRecord } from '../repositories/companies.repo';
import {
  createFixedAssetRecord,
  deleteFixedAssetRecord,
  generateMonthlyDepreciationPoliza,
  getFixedAssetsResponse
} from '../repositories/fixed-assets.repo';
import {
  getDiotReport,
  getFiscalWorkpaperReport,
  getTaxParameters,
  saveTaxParameters
} from '../repositories/fiscal.repo';
import { getAccountLedger } from '../repositories/account-ledger.repo';
import { insertParsedCfdiRecord } from '../repositories/cfdi.repo';
import { createPolizaTransaction } from '../repositories/polizas.repo';

describe('repositories — Activos Fijos, Papel Día 17 e Informátiva DIOT SAT', () => {
  let testCompanyId = '';
  let companyRef: any = null;

  beforeAll(() => {
    initDatabase();
    companyRef = createCompanyRecord({
      name: 'FISCAL Y ACTIVOS FIJOS SA DE CV',
      rfc: 'FAF2001019K2',
      regimenFiscal: '601',
      codigoPostal: '64000',
      currentYear: 2026,
      currentPeriod: 10
    });
    testCompanyId = companyRef.id;
  });

  afterAll(() => {
    if (testCompanyId) {
      deleteCompanyRecord(testCompanyId);
    }
  });

  test('createFixedAssetRecord creates asset and calculates accounting and fiscal depreciation', () => {
    const res = createFixedAssetRecord(testCompanyId, {
      codigo: 'AF-COMP-10',
      nombre: 'Servidor Dell PowerEdge R660',
      categoria: 'COMPUTO_30',
      fechaAdquisicion: '2026-01-15',
      montoOriginalInversion: 120000,
      tasaAnualPct: 30,
      mesesDepreciadosPrevios: 9,
      inpcAdquisicion: 130.0,
      inpcMedioPeriodo: 136.5,
      cuentaActivoCode: '156-01-001',
      cuentaDepAcumCode: '171-01-001',
      cuentaGastoDepCode: '601-01-006'
    });

    expect(res.assets).toHaveLength(1);
    const asset = res.assets[0]!;
    expect(asset.montoOriginalInversion).toBe(120000);
    // 120,000 * 30% / 12 = 3,000 mensual contable
    expect(asset.depreciacionMensualContable).toBe(3000);
    // 3,000 * (136.5 / 130) = 3,150 fiscal
    expect(asset.depreciacionMensualFiscalActualizada).toBe(3150);
    expect(res.totals.totalMoi).toBe(120000);
  });

  test('generateMonthlyDepreciationPoliza generates balanced depreciation journal entry', () => {
    const poliza = generateMonthlyDepreciationPoliza(testCompanyId, 2026, 10);
    expect(poliza.isBalanced).toBe(true);
    expect(poliza.tipo).toBe('DIARIO');
    expect(poliza.concepto).toContain('Depreciación Contable Mensual');
    expect(poliza.totalCargos).toBe(3000);
    expect(poliza.totalAbonos).toBe(3000);

    const cargoGasto = poliza.movements.find((m) => m.cargo === 3000);
    const abonoAcum = poliza.movements.find((m) => m.abono === 3000);
    expect(cargoGasto?.accountCode).toBe('601-01-006');
    expect(abonoAcum?.accountCode).toBe('171-01-001');
  });

  test('deleteFixedAssetRecord deletes asset from database', () => {
    const assetsBefore = getFixedAssetsResponse(testCompanyId);
    const asset = assetsBefore.assets[0]!;
    const deleted = deleteFixedAssetRecord(asset.id);
    expect(deleted).toBe(true);

    const assetsAfter = getFixedAssetsResponse(testCompanyId);
    expect(assetsAfter.assets).toHaveLength(0);
  });

  test('saveTaxParameters persists Coeficiente de Utilidad and tax workpaper data', () => {
    const saved = saveTaxParameters(testCompanyId, 2026, {
      coeficienteUtilidad: 0.225,
      perdidasFiscalesPendientes: 30000,
      pagosProvisionalesAnteriores: 45000,
      saldoFavorIvaAnterior: 5000,
      tipoCambioDofCierre: 19.5
    });

    expect(saved.coeficienteUtilidad).toBe(0.225);
    expect(saved.perdidasFiscalesPendientes).toBe(30000);
    expect(saved.pagosProvisionalesAnteriores).toBe(45000);

    const fetched = getTaxParameters(testCompanyId, 2026);
    expect(fetched.coeficienteUtilidad).toBe(0.225);
    expect(fetched.saldoFavorIvaAnterior).toBe(5000);
  });

  test('getFiscalWorkpaperReport produces Day 17 provisional tax computation', () => {
    const wp = getFiscalWorkpaperReport(testCompanyId, 2026, 10);
    expect(wp.company.rfc).toBe('FAF2001019K2');
    expect(wp.ejercicio).toBe(2026);
    expect(wp.periodo).toBe(10);
    expect(typeof wp.isrProvisional.utilidadFiscalEstimada).toBe('number');
    expect(typeof wp.ivaDefinitivo.ivaNetoAPagar).toBe('number');
  });

  test('getDiotReport aggregates paid supplier CFDIs and generates SAT batch format', () => {
    // 1. Insert a paid PUE supplier invoice
    const cfdi = insertParsedCfdiRecord(companyRef, {
      uuid: 'F8888888-4444-4444-8888-999999999999',
      serie: 'A',
      folio: '77',
      fecha: '2026-10-15',
      tipoComprobante: 'I',
      emisorRfc: 'PRO010203AA1',
      emisorNombre: 'PROVEEDORA DE PAPEL SA DE CV',
      receptorRfc: companyRef.rfc,
      receptorNombre: companyRef.name,
      conceptoPrincipal: 'Papelería y consumibles de oficina',
      claveProdServ: '14111500',
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
      uuidRelacionado: null,
      xmlRaw: '<cfdi:Comprobante/>'
    });

    // 2. Register journal entry linking the CFDI in this period
    const poliza = createPolizaTransaction({
      companyId: testCompanyId,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'EGRESO',
      fecha: '2026-10-15',
      concepto: 'Pago papelería PUE',
      cfdiUuid: cfdi.uuid,
      origin: 'ADD_AUTO',
      movements: [
        { accountId: `${testCompanyId}_601-01-002`, cargo: 10000, abono: 0 },
        { accountId: `${testCompanyId}_118-01-001`, cargo: 1600, abono: 0 },
        { accountId: `${testCompanyId}_102-01-001`, cargo: 0, abono: 11600 }
      ]
    });

    // Link CFDI with Poliza
    const { db } = require('../connection');
    db.prepare('UPDATE cfdi_documents SET poliza_id = ? WHERE id = ?').run(poliza.id, cfdi.id);

    const diot = getDiotReport(testCompanyId, 2026, 10);
    expect(diot.filename).toBe('DIOT_FAF2001019K2_2026_10.txt');
    expect(diot.rows).toHaveLength(1);
    expect(diot.rows[0]?.rfc).toBe('PRO010203AA1');
    expect(diot.rows[0]?.actosPagados16).toBe(10000);
    expect(diot.rows[0]?.ivaAcreditable16).toBe(1600);
    // SAT Batch txt pipe-delimited format (Formato DEM A-29: 20 campos, sin plepa inicial)
    expect(diot.batchTxtContent).toContain('04|85|PRO010203AA1|||||10000||||||||||||');
    expect(diot.batchTxtContent.split('|')).toHaveLength(20);
  });

  test('getAccountLedger correctly scopes descendant accounts by level without mixing subcuentas', () => {
    // Level 1 account: 100-00-000 (ACTIVO) should match all active accounts (102-, 118-, etc.)
    const totalActivoLedger = getAccountLedger(testCompanyId, `${testCompanyId}_100-00-000`, 2026, 10);
    expect(totalActivoLedger).not.toBeNull();
    expect(totalActivoLedger!.entries.length).toBeGreaterThan(0);
    expect(totalActivoLedger!.entries.some((e) => e.accountCode.startsWith('102-'))).toBe(true);
    expect(totalActivoLedger!.entries.some((e) => e.accountCode.startsWith('118-'))).toBe(true);

    // Level 2 account: 102-00-000 (Bancos) should match 102-01-001 but NOT 118-01-001
    const bancosLedger = getAccountLedger(testCompanyId, `${testCompanyId}_102-00-000`, 2026, 10);
    expect(bancosLedger).not.toBeNull();
    expect(bancosLedger!.entries.length).toBeGreaterThan(0);
    expect(bancosLedger!.entries.every((e) => e.accountCode.startsWith('102-'))).toBe(true);
    expect(bancosLedger!.entries.some((e) => e.accountCode.startsWith('118-'))).toBe(false);
  });
});

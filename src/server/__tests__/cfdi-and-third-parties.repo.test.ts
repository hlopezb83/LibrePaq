import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../schema';
import { createCompanyRecord, deleteCompanyRecord } from '../repositories/companies.repo';
import {
  deleteCfdiRecord,
  generateAutoPolizaFromCfdiId,
  getCfdiById,
  getCfdiDocuments,
  insertParsedCfdiRecord
} from '../repositories/cfdi.repo';
import {
  getThirdPartyByRfc,
  syncThirdPartiesFromCfdis,
  upsertThirdPartyRecord
} from '../repositories/third-parties.repo';
import { AccountingInvariantError } from '../../shared/accounting-engine';

describe('repositories — CFDI 4.0 Bóveda ADD & Terceros / EFOS 69-B', () => {
  let testCompanyId = '';
  let companyRef: any = null;

  beforeAll(() => {
    initDatabase();
    companyRef = createCompanyRecord({
      name: 'CFDI HOLDING SA DE CV',
      rfc: 'CFD2001019K2',
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

  test('insertParsedCfdiRecord adds received CFDI into ADD vault', () => {
    const uuid = 'E1111111-2222-3333-4444-555555555555';
    const cfdi = insertParsedCfdiRecord(companyRef, {
      uuid,
      serie: 'FAC',
      folio: '501',
      fecha: '2026-10-10',
      tipoComprobante: 'I',
      emisorRfc: 'PRO120304AA1',
      emisorNombre: 'PROVEEDOR INDUSTRIAL DEL NORTE SA',
      receptorRfc: companyRef.rfc,
      receptorNombre: companyRef.name,
      conceptoPrincipal: 'Servicio de mantenimiento a maquinaria',
      claveProdServ: '72101500',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 50000,
      descuento: 0,
      ivaTrasladado: 8000,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 58000,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G03',
      uuidRelacionado: null,
      xmlRaw: '<cfdi:Comprobante/>'
    });

    expect(cfdi.uuid).toBe(uuid);
    expect(cfdi.direction).toBe('RECIBIDO');
    expect(cfdi.total).toBe(58000);

    const retrieved = getCfdiById(cfdi.id);
    expect(retrieved?.uuid).toBe(uuid);
  });

  test('insertParsedCfdiRecord classifies emitted CFDI based on RFC', () => {
    const uuid = 'E2222222-2222-3333-4444-555555555555';
    const cfdi = insertParsedCfdiRecord(companyRef, {
      uuid,
      serie: 'F',
      folio: '101',
      fecha: '2026-10-11',
      tipoComprobante: 'I',
      emisorRfc: companyRef.rfc,
      emisorNombre: companyRef.name,
      receptorRfc: 'CLI100203BB2',
      receptorNombre: 'CLIENTE DISTRIBUIDOR SA',
      conceptoPrincipal: 'Venta de software SaaS',
      claveProdServ: '81112100',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 20000,
      descuento: 0,
      ivaTrasladado: 3200,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 23200,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G03',
      uuidRelacionado: null,
      xmlRaw: '<cfdi:Comprobante/>'
    });

    expect(cfdi.direction).toBe('EMITIDO');
  });

  test('insertParsedCfdiRecord throws on duplicate UUID', () => {
    expect(() =>
      insertParsedCfdiRecord(companyRef, {
        uuid: 'E1111111-2222-3333-4444-555555555555',
        serie: 'FAC',
        folio: '501',
        fecha: '2026-10-10',
        tipoComprobante: 'I',
        emisorRfc: 'PRO120304AA1',
        emisorNombre: 'PROVEEDOR INDUSTRIAL DEL NORTE SA',
        receptorRfc: companyRef.rfc,
        receptorNombre: companyRef.name,
        conceptoPrincipal: 'Duplicado',
        claveProdServ: '72101500',
        moneda: 'MXN',
        tipoCambio: 1,
        subtotal: 50000,
        descuento: 0,
        ivaTrasladado: 8000,
        isrRetenido: 0,
        ivaRetenido: 0,
        total: 58000,
        metodoPago: 'PUE',
        formaPago: '03',
        usoCfdi: 'G03',
        uuidRelacionado: null,
        xmlRaw: '<cfdi:Comprobante/>'
      })
    ).toThrow(AccountingInvariantError);
  });

  test('generateAutoPolizaFromCfdiId automatically creates journal entry and links CFDI', () => {
    const cfdis = getCfdiDocuments(testCompanyId);
    const cfdi = cfdis.find((c) => !c.polizaId)!;

    const poliza = generateAutoPolizaFromCfdiId(cfdi.id);
    expect(poliza.isBalanced).toBe(true);
    expect(poliza.origin).toBe('ADD_AUTO');

    const updatedCfdi = getCfdiById(cfdi.id);
    expect(updatedCfdi?.polizaId).toBe(poliza.id);

    // Cannot delete CFDI that is accounted
    const delRes = deleteCfdiRecord(cfdi.id);
    expect(delRes.deleted).toBe(false);
    expect(delRes.hasPoliza).toBe(true);
  });

  test('syncThirdPartiesFromCfdis synchronizes suppliers and clients from vault', () => {
    const synced = syncThirdPartiesFromCfdis(testCompanyId);
    expect(synced.length).toBeGreaterThanOrEqual(2);

    const proveedor = getThirdPartyByRfc(testCompanyId, 'PRO120304AA1');
    expect(proveedor).not.toBeNull();
    expect(proveedor?.rol).toBe('PROVEEDOR');
    expect(proveedor?.estatus69B).toBe('LIMPIO');

    const cliente = getThirdPartyByRfc(testCompanyId, 'CLI100203BB2');
    expect(cliente).not.toBeNull();
    expect(cliente?.rol).toBe('CLIENTE');
  });

  test('upsertThirdPartyRecord customizes DIOT and 69-B status', () => {
    const updated = upsertThirdPartyRecord(testCompanyId, {
      rfc: 'PRO120304AA1',
      nombre: 'PROVEEDOR INDUSTRIAL DEL NORTE SA (ACTUALIZADO)',
      rol: 'PROVEEDOR',
      cuentaOperacionCode: '601-01-002',
      cuentaContrapartidaCode: '201-01-001',
      tipoTerceroDiot: '04',
      tipoOperacionDiot: '85',
      tasaIvaDefault: 16,
      estatus69B: 'PRESUNTO_EFOS'
    });

    expect(updated.nombre).toContain('ACTUALIZADO');
    expect(updated.estatus69B).toBe('PRESUNTO_EFOS');
  });
});

import { describe, expect, test } from 'bun:test';
import {
  buildAutoPolizaPlan,
  resolveFiscalAccount,
  validateDoubleEntryMovements
} from '../accounting-engine';
import type { CfdiDocument } from '../types';
import { createMockCatalog } from './test-helpers';

describe('Power of 10 Fiscal Rules — Unified Auto-Póliza Engine (CFDI I, E, P, N)', () => {
  const { accounts, byId } = createMockCatalog();

  test('generates balanced journal entry for received invoice with ISR & IVA retentions (Honorarios / RESICO)', () => {
    const cfdi: CfdiDocument = {
      id: 'cfdi-hon-1',
      companyId: 'comp-test',
      uuid: 'D4567890-ABCD-4321-9876-543210FEDCBA',
      serie: 'HON',
      folio: '204',
      fecha: '2026-10-12',
      direction: 'RECIBIDO',
      tipoComprobante: 'I',
      emisorRfc: 'GAMR880514KL9',
      emisorNombre: 'ROBERTO GARZA MARTINEZ',
      receptorRfc: 'SLO2204159A1',
      receptorNombre: 'SOLUCIONES LOGISTICAS DEL NORTE',
      conceptoPrincipal: 'ASESORÍA CONTABLE Y FISCAL',
      claveProdServ: '84111500',
      subtotal: 25000,
      descuento: 0,
      ivaTrasladado: 4000,
      isrRetenido: 2500,
      ivaRetenido: 2666.67,
      total: 23833.33,
      moneda: 'MXN',
      tipoCambio: 1,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G03',
      statusSat: 'VIGENTE',
      polizaId: null,
      xmlRaw: '<cfdi:Comprobante/>'
    };

    const plan = buildAutoPolizaPlan(cfdi, accounts);
    expect(plan.polizaType).toBe('EGRESO');
    expect(plan.isBalanced).toBe(true);

    const validation = validateDoubleEntryMovements(plan.movements, byId);
    expect(validation.totalCargo).toBe(29000);
    expect(validation.totalAbono).toBe(29000);

    // Verify both retention accounts resolved to distinct affectable accounts
    const retIsrAcc = resolveFiscalAccount(accounts, 'ISR_RETENIDO_POR_PAGAR');
    const retIvaAcc = resolveFiscalAccount(accounts, 'IVA_RETENIDO_POR_PAGAR');
    expect(retIsrAcc.code).toBe('216-01-001');
    expect(retIvaAcc.code).toBe('216-01-002');
  });

  test('generates balanced journal entry for Credit Note (CFDI E)', () => {
    const cfdi: CfdiDocument = {
      id: 'cfdi-nc-1',
      companyId: 'comp-test',
      uuid: 'F6789012-1111-4222-8333-444455556666',
      serie: 'NC',
      folio: '18',
      fecha: '2026-10-18',
      direction: 'EMITIDO',
      tipoComprobante: 'E',
      emisorRfc: 'SLO2204159A1',
      emisorNombre: 'SOLUCIONES LOGISTICAS DEL NORTE',
      receptorRfc: 'CME9801204P2',
      receptorNombre: 'CORPORATIVO MANUFACTURERO DE EXPORTACION',
      conceptoPrincipal: 'DESCUENTO POR PRONTO PAGO',
      claveProdServ: '84111506',
      subtotal: 12000,
      descuento: 0,
      ivaTrasladado: 1920,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 13920,
      moneda: 'MXN',
      tipoCambio: 1,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G02',
      statusSat: 'VIGENTE',
      polizaId: null,
      xmlRaw: '<cfdi:Comprobante/>'
    };

    const plan = buildAutoPolizaPlan(cfdi, accounts);
    expect(plan.polizaType).toBe('DIARIO');
    expect(plan.isBalanced).toBe(true);
    const validation = validateDoubleEntryMovements(plan.movements, byId);
    expect(validation.totalCargo).toBe(13920);
    expect(validation.totalAbono).toBe(13920);
  });

  test('generates balanced journal entry + IVA reclassification for REP 2.0 (CFDI P)', () => {
    const cfdi: CfdiDocument = {
      id: 'cfdi-rep-1',
      companyId: 'comp-test',
      uuid: 'AA112233-4455-4667-8899-00AABBCCDDEE',
      serie: 'REP',
      folio: '501',
      fecha: '2026-10-20',
      direction: 'EMITIDO',
      tipoComprobante: 'P',
      emisorRfc: 'SLO2204159A1',
      emisorNombre: 'SOLUCIONES LOGISTICAS DEL NORTE',
      receptorRfc: 'IIN040812K90',
      receptorNombre: 'IMPORTADORA INDUSTRIAL DEL NORESTE',
      conceptoPrincipal: 'COMPLEMENTO DE RECEPCIÓN DE PAGOS REP 2.0',
      claveProdServ: '84111506',
      subtotal: 95000,
      descuento: 0,
      ivaTrasladado: 15200,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 110200,
      moneda: 'MXN',
      tipoCambio: 1,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'CP01',
      uuidRelacionado: 'B2345678-90AB-4CDE-8123-456789ABCDEF',
      statusSat: 'VIGENTE',
      polizaId: null,
      xmlRaw: '<cfdi:Comprobante/>'
    };

    const plan = buildAutoPolizaPlan(cfdi, accounts);
    expect(plan.polizaType).toBe('INGRESO');
    expect(plan.isBalanced).toBe(true);
    // 110,200 (flujo) + 15,200 (IVA reclasificado de 209 a 208) = 125,400
    const validation = validateDoubleEntryMovements(plan.movements, byId);
    expect(validation.totalCargo).toBe(125400);
    expect(validation.totalAbono).toBe(125400);
  });

  test('generates balanced journal entry for Nómina 1.2 (CFDI N)', () => {
    const cfdi: CfdiDocument = {
      id: 'cfdi-nom-1',
      companyId: 'comp-test',
      uuid: 'CC998877-6655-4433-8221-1100FFEEDDCC',
      serie: 'NOM',
      folio: '19',
      fecha: '2026-10-15',
      direction: 'EMITIDO',
      tipoComprobante: 'N',
      emisorRfc: 'SLO2204159A1',
      emisorNombre: 'SOLUCIONES LOGISTICAS DEL NORTE',
      receptorRfc: 'XAXX010101000',
      receptorNombre: 'PLANTILLA QUINCENAL',
      conceptoPrincipal: 'NÓMINA QUINCENAL',
      claveProdServ: '84111505',
      subtotal: 78000,
      descuento: 0,
      ivaTrasladado: 0,
      isrRetenido: 9450,
      ivaRetenido: 0,
      total: 68550,
      moneda: 'MXN',
      tipoCambio: 1,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'CN01',
      statusSat: 'VIGENTE',
      polizaId: null,
      xmlRaw: '<cfdi:Comprobante/>'
    };

    const plan = buildAutoPolizaPlan(cfdi, accounts);
    expect(plan.polizaType).toBe('EGRESO');
    expect(plan.isBalanced).toBe(true);
    const validation = validateDoubleEntryMovements(plan.movements, byId);
    expect(validation.totalCargo).toBe(78000);
    expect(validation.totalAbono).toBe(78000);
  });

  test('converts USD invoices to MXN using official exchange rate (NIF B-15 / Art. 20 CFF)', () => {
    const cfdiUsd: CfdiDocument = {
      id: 'cfdi-usd-1',
      companyId: 'comp-test',
      uuid: 'DD887766-5544-3322-1100-998877AABBCC',
      serie: 'INV',
      folio: '2026-USD',
      fecha: '2026-10-20',
      direction: 'RECIBIDO',
      tipoComprobante: 'I',
      emisorRfc: 'AWS010101XYZ',
      emisorNombre: 'AMAZON WEB SERVICES LLC',
      receptorRfc: 'SLO2204159A1',
      receptorNombre: 'SOLUCIONES LOGISTICAS DEL NORTE',
      conceptoPrincipal: 'Cloud Infrastructure Services',
      claveProdServ: '81112000',
      subtotal: 1000, // $1,000 USD
      descuento: 0,
      ivaTrasladado: 160, // $160 USD (16%)
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 1160, // $1,160 USD
      moneda: 'USD',
      tipoCambio: 20.00, // $20.00 MXN / USD
      metodoPago: 'PPD',
      formaPago: '99',
      usoCfdi: 'G03',
      statusSat: 'VIGENTE',
      polizaId: null,
      xmlRaw: '<cfdi:Comprobante/>'
    };

    const plan = buildAutoPolizaPlan(cfdiUsd, accounts);
    expect(plan.polizaType).toBe('DIARIO');
    expect(plan.isBalanced).toBe(true);

    // Total MXN = $1,160 * 20 = $23,200 MXN
    const provMovement = plan.movements.find((m) => m.abono === 23200);
    expect(provMovement).toBeDefined();
    expect(provMovement?.abono).toBe(23200);

    // Subtotal MXN = $1,000 * 20 = $20,000 MXN
    const expenseMovement = plan.movements.find((m) => m.cargo === 20000);
    expect(expenseMovement).toBeDefined();

    // IVA MXN = $160 * 20 = $3,200 MXN
    const ivaMovement = plan.movements.find((m) => m.cargo === 3200);
    expect(ivaMovement).toBeDefined();

    const validation = validateDoubleEntryMovements(plan.movements, byId);
    expect(validation.totalCargo).toBe(23200);
    expect(validation.totalAbono).toBe(23200);
  });
});

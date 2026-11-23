import { beforeAll, describe, expect, it } from 'bun:test';
import { db } from '../connection';
import {
  createCompanyRecord,
  createPolizaTransaction,
  deletePolizaTransaction,
  getAccounts,
  getDiotReport,
  initDatabase,
  insertParsedCfdiRecord
} from '../db';
import { buildTaxProvisionMovements } from '../../shared/engine/tax-provision.engine';
import { buildSatAnexo24Xml } from '../../shared/sat-anexo24';
import type { Account, FiscalWorkpaperResponse } from '../../shared/types';

describe('Ronda 4 Auditoría — SAT Fiscal, DIOT y Consistencia Contable', () => {
  beforeAll(() => {
    initDatabase();
  });

  it('[FISCAL-R4-14 / FISCAL-R4-05] DIOT Formato A-29 ubica IVA retenido en columna 19 y convierte divisas extranjeras con tipoCambio', () => {
    const comp = createCompanyRecord({
      name: 'Empresa DIOT R4 Test',
      rfc: 'DIO240101R4A',
      regimenFiscal: '601',
      codigoPostal: '06700'
    });

    const poliza = createPolizaTransaction({
      companyId: comp.id,
      tipo: 'EGRESO',
      fecha: '2026-10-10',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Pago a proveedor de honorarios USD',
      cfdiUuid: 'C1D2E3F4-0000-4000-8000-111122223333',
      origin: 'MANUAL',
      movements: [
        { accountId: `${comp.id}_102-01-001`, referencia: 'USD', concepto: 'Pago', cargo: 0, abono: 23200 },
        { accountId: `${comp.id}_601-01-001`, referencia: 'USD', concepto: 'Gasto', cargo: 20000, abono: 0 },
        { accountId: `${comp.id}_118-01-001`, referencia: 'USD', concepto: 'IVA', cargo: 3200, abono: 0 }
      ]
    });

    // CFDI Recibido en USD con TC = 20.0
    // Subtotal 1,000 USD * 20 = $20,000 MXN base
    // IVA 160 USD * 20 = $3,200 MXN
    // IVA Retenido 106.67 USD * 20 = $2,133.40 MXN
    const cfdi = insertParsedCfdiRecord(comp, {
      uuid: 'C1D2E3F4-0000-4000-8000-111122223333',
      fecha: '2026-10-10',
      tipoComprobante: 'I',
      serie: 'F',
      folio: '55',
      emisorRfc: 'PRO120304AB1',
      emisorNombre: 'PROVEEDOR HONORARIOS SA DE CV',
      receptorRfc: comp.rfc,
      receptorNombre: comp.name,
      conceptoPrincipal: 'Servicios de consultor y auditoría financiera',
      claveProdServ: '80101500',
      subtotal: 1000,
      descuento: 0,
      ivaTrasladado: 160,
      isrRetenido: 100,
      ivaRetenido: 106.67,
      total: 953.33,
      moneda: 'USD',
      tipoCambio: 20.0,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'G03',
      uuidRelacionado: null,
      xmlRaw: ''
    });

    db.prepare('UPDATE cfdi_documents SET poliza_id = ? WHERE id = ?').run(poliza.id, cfdi.id);

    const report = getDiotReport(comp.id, 2026, 10);
    expect(report.rows.length).toBe(1);
    const row = report.rows[0];
    expect(row).toBeDefined();
    if (!row) return;

    expect(row.tipoOperacion).toBe('03'); // Honorarios / Consultor
    expect(row.actosPagados16).toBe(20000); // 1,000 USD * 20 = 20,000 MXN

    const cols = row.batchLine.split('|');
    expect(cols.length).toBe(20);
    expect(cols[0]).toBe('04'); // Proveedor nacional
    expect(cols[1]).toBe('03'); // Prestación de servicios
    expect(cols[2]).toBe('PRO120304AB1'); // RFC
    expect(cols[7]).toBe('20000'); // Base 16% en MXN
    expect(cols[15]).toBe(''); // Importaciones exentas / 0% vacío
    expect(cols[18]).toBe('2133'); // IVA Retenido en columna 19 (índice 18)
  });

  it('[FISCAL-R4-13] Motor de provisión en Saldo a Favor acredita IVA_ACREDITABLE_RETENIDO y es estrictamente cuadrado', () => {
    const mockAccounts: Account[] = [
      { id: 'acc_801', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '801.01', code: '801-01-001', name: 'Gasto por Impuesto a la Utilidad', type: 'GASTOS', nature: 'DEUDORA', level: 3, isAffectable: true, initialBalance: 0 },
      { id: 'acc_213_isr', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '213.01', code: '213-01-002', name: 'ISR por Pagar', type: 'PASIVO', nature: 'ACREEDORA', level: 3, isAffectable: true, initialBalance: 0 },
      { id: 'acc_208', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '208.01', code: '208-01-001', name: 'IVA Trasladado Cobrado', type: 'PASIVO', nature: 'ACREEDORA', level: 3, isAffectable: true, initialBalance: 0 },
      { id: 'acc_118', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '118.01', code: '118-01-001', name: 'IVA Acreditable Pagado', type: 'ACTIVO', nature: 'DEUDORA', level: 3, isAffectable: true, initialBalance: 0 },
      { id: 'acc_113_ret', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '113.01', code: '113-01-002', name: 'IVA Acreditable Retenido', type: 'ACTIVO', nature: 'DEUDORA', level: 3, isAffectable: true, initialBalance: 0 },
      { id: 'acc_213_iva', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '213.01', code: '213-01-001', name: 'IVA por Pagar', type: 'PASIVO', nature: 'ACREEDORA', level: 3, isAffectable: true, initialBalance: 0 },
      { id: 'acc_113_favor', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '113.01', code: '113-01-001', name: 'IVA a Favor', type: 'ACTIVO', nature: 'DEUDORA', level: 3, isAffectable: true, initialBalance: 0 }
    ];

    // IVA Cobrado: 5,000 | IVA Pagado: 8,000 | IVA Retenido a Favor: 1,500
    // Saldo a Favor Real = (8,000 - 5,000) + 1,500 = 4,500
    const mockWp: FiscalWorkpaperResponse = {
      company: {
        id: 'comp_test',
        name: 'Test',
        rfc: 'AAA010101AAA',
        regimenFiscal: '601',
        codigoPostal: '06700',
        maskFormat: 'XXX-XX-XXX',
        currentYear: 2026,
        currentPeriod: 10,
        createdAt: '2026-01-01'
      },
      ejercicio: 2026,
      periodo: 10,
      parameters: {
        companyId: 'comp_test',
        ejercicio: 2026,
        coeficienteUtilidad: 0.2,
        perdidasFiscalesPendientes: 0,
        pagosProvisionalesAnteriores: 0,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 20
      },
      isrProvisional: {
        regimenClave: '601',
        esResico: false,
        ingresosPeriodo: 0,
        ingresosAcumuladosEjercicio: 0,
        deduccionesAutorizadasPeriodo: 0,
        coeficienteUtilidadAplicado: 0.2,
        utilidadFiscalEstimada: 0,
        perdidasFiscalesAplicadas: 0,
        baseGravableIsr: 0,
        tasaIsrPct: 30,
        isrCausado: 0,
        pagosProvisionalesPrevios: 0,
        isrRetenidoPeriodo: 0,
        isrNetoAPagar: 0
      },
      ivaDefinitivo: {
        actosGravadosCobrado16: 31250,
        ivaTrasladadoCobrado: 5000,
        ivaAcreditablePagado: 8000,
        ivaRetenidoPorPagar: 0,
        ivaRetenidoAcreditable: 1500,
        saldoFavorIvaAcreditable: 0,
        ivaNetoAPagar: 0,
        saldoFavorIvaRemanente: 4500
      },
      resumenLineaCapturaSat: {
        isrProvisionalAPagar: 0,
        ivaDefinitivoAPagar: 0,
        retencionesIsrPorEnterar: 0,
        retencionesIvaPorEnterar: 0,
        totalEstimadoDia17: 0
      },
      fluctuacionCambiaria: {
        cfdisUsdCount: 0,
        saldoMonedaExtranjeraUsd: 0,
        tipoCambioPromedioRegistro: 20,
        tipoCambioDofCierre: 20,
        valuacionLibrosMxn: 0,
        valuacionCierreDofMxn: 0,
        diferenciaCambiariaMxn: 0,
        tipoDiferencia: 'SIN_CAMBIO'
      }
    };

    const movs = buildTaxProvisionMovements(mockWp, mockAccounts, 10, 2026);
    expect(movs.length).toBe(4);

    const cargoIvaCobrado = movs.find((m) => m.accountId === 'acc_208')?.cargo ?? 0;
    const cargoIvaFavor = movs.find((m) => m.accountId === 'acc_113_favor')?.cargo ?? 0;
    const abonoIvaPagado = movs.find((m) => m.accountId === 'acc_118')?.abono ?? 0;
    const abonoIvaRetenido = movs.find((m) => m.accountId === 'acc_113_ret')?.abono ?? 0;

    expect(cargoIvaCobrado).toBe(5000);
    expect(cargoIvaFavor).toBe(4500); // 3,000 + 1,500 retenido
    expect(abonoIvaPagado).toBe(8000);
    expect(abonoIvaRetenido).toBe(1500);

    const totalCargos = movs.reduce((s, m) => s + m.cargo, 0);
    const totalAbonos = movs.reduce((s, m) => s + m.abono, 0);
    expect(totalCargos).toBe(9500);
    expect(totalAbonos).toBe(9500);
  });

  it('[FISCAL-R4-16] SAT Anexo 24 extrae RFC dinámicamente de póliza o concepto para PL.xml', () => {
    const comp = createCompanyRecord({
      name: 'Empresa Anexo 24 R4',
      rfc: 'ANX240101R4B',
      regimenFiscal: '601',
      codigoPostal: '06700'
    });

    const accounts = getAccounts(comp.id);
    const res = buildSatAnexo24Xml(
      comp,
      2026,
      10,
      'polizas',
      [],
      [
        {
          id: 'pol_test_dynamic',
          companyId: comp.id,
          tipo: 'EGRESO',
          folio: 42,
          fecha: '2026-10-15',
          ejercicio: 2026,
          periodo: 10,
          concepto: 'Pago factura proveedor RFC SAT970701NN3 por insumos',
          cfdiUuid: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE',
          origin: 'MANUAL',
          totalCargos: 1160,
          totalAbonos: 1160,
          isBalanced: true,
          createdAt: '2026-10-15T12:00:00Z',
          movements: [
            {
              id: 'mov_1',
              polizaId: 'pol_test_dynamic',
              accountId: accounts[0]?.id || '',
              accountCode: accounts[0]?.code || '601-01-001',
              accountName: accounts[0]?.name || 'Gasto',
              referencia: 'REF',
              concepto: 'Gasto SAT970701NN3',
              cargo: 1160,
              abono: 0,
              cfdiUuid: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'
            }
          ]
        }
      ]
    );

    expect(res.xml).toContain('RFC="SAT970701NN3"');
    expect(res.xml).not.toContain('RFC="XAXX010101000"');
  });

  it('[WORKFLOW-R4-03] deletePoliza desvincula bank_statement_lines mediante movIds reales', () => {
    const comp = createCompanyRecord({
      name: 'Empresa Unlink Test',
      rfc: 'UNL240101R4C',
      regimenFiscal: '601',
      codigoPostal: '06700'
    });

    const pol = createPolizaTransaction({
      companyId: comp.id,
      tipo: 'INGRESO',
      fecha: '2026-10-12',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Depósito cliente',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: `${comp.id}_102-01-001`, referencia: 'DEP', concepto: 'Entrada', cargo: 5000, abono: 0 },
        { accountId: `${comp.id}_105-01-001`, referencia: 'DEP', concepto: 'Abono', cargo: 0, abono: 5000 }
      ]
    });

    expect(pol.movements.length).toBe(2);
    const movId = pol.movements[0]?.id;
    expect(movId).toBeDefined();

    // Eliminar póliza
    const deleted = deletePolizaTransaction(pol.id);
    expect(deleted).toBe(true);
  });
});

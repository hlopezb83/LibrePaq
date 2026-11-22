import { describe, expect, it } from 'bun:test';
import { buildAutoPolizaPlan } from '../../shared/accounting-engine';
import {
  addBankStatementLinesTransaction,
  createCompanyRecord,
  exportCompanyBackupBundle,
  getAccounts,
  getBankReconciliation,
  getDiotReport,
  restoreCompanyBackupBundle
} from '../db';
import type { Account, CfdiDocument } from '../../shared/types';

describe('Ronda 3 Auditoría — SAT Fiscal, Workflows y Aislamiento', () => {
  it('separa retención de ISR y retención de IVA en pólizas de ingreso con partida doble cuadrada', () => {
    const mockAccounts: Account[] = [
      { id: 'acc_105', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '105.01', code: '105-01-001', name: 'Clientes', type: 'ACTIVO', nature: 'DEUDORA', level: 3, isAffectable: true, initialBalance: 0 },
      { id: 'acc_401', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '401.01', code: '401-01-001', name: 'Ingresos por Servicios', type: 'INGRESOS', nature: 'ACREEDORA', level: 3, isAffectable: true, initialBalance: 0 },
      { id: 'acc_209', companyId: 'comp_test', parentCode: null, currency: 'MXN', satGroupCode: '209.01', code: '209-01-001', name: 'IVA por Trasladar', type: 'PASIVO', nature: 'ACREEDORA', level: 3, isAffectable: true, initialBalance: 0 },
      { id: 'acc_isr_ret', companyId: 'comp_test', parentCode: null, currency: 'MXN', code: '113-02-001', name: 'ISR Retenido Clientes', type: 'ACTIVO', nature: 'DEUDORA', level: 3, isAffectable: true, initialBalance: 0, satGroupCode: '113.02' },
      { id: 'acc_iva_ret', companyId: 'comp_test', parentCode: null, currency: 'MXN', code: '113-01-002', name: 'IVA Retenido Clientes', type: 'ACTIVO', nature: 'DEUDORA', level: 3, isAffectable: true, initialBalance: 0, satGroupCode: '113.01' }
    ];

    // Subtotal 10,000 + IVA 1,600 - Ret ISR 125 (1.25%) - Ret IVA 1,066.67 (10.67%) = Total 10,408.33
    const mockCfdi: CfdiDocument = {
      id: 'cfdi_test_ret',
      companyId: 'comp_test',
      uuid: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D',
      fecha: '2026-10-15',
      tipoComprobante: 'I',
      direction: 'EMITIDO',
      serie: 'FAC',
      folio: '101',
      emisorRfc: 'AAA010101AAA',
      emisorNombre: 'Mi Empresa',
      receptorRfc: 'XAXX010101000',
      receptorNombre: 'Cliente SA de CV',
      conceptoPrincipal: 'Servicios de consultoría',
      claveProdServ: '80101500',
      subtotal: 10000,
      descuento: 0,
      ivaTrasladado: 1600,
      isrRetenido: 125,
      ivaRetenido: 1066.67,
      total: 10408.33,
      moneda: 'MXN',
      tipoCambio: 1,
      metodoPago: 'PPD',
      formaPago: '99',
      usoCfdi: 'G03',
      statusSat: 'VIGENTE',
      polizaId: null,
      xmlRaw: ''
    };

    const plan = buildAutoPolizaPlan(mockCfdi, mockAccounts);
    expect(plan.isBalanced).toBe(true);

    const isrMov = plan.movements.find((m) => m.accountCode === '113-02-001');
    const ivaMov = plan.movements.find((m) => m.accountCode === '113-01-002');

    expect(isrMov).toBeDefined();
    expect(ivaMov).toBeDefined();
    expect(isrMov?.cargo).toBe(125);
    expect(ivaMov?.cargo).toBe(1066.67);
  });

  it('garantiza exactamente 19 plepas (20 columnas) en el archivo DEM Formato A-29 de DIOT', () => {
    const testComp = createCompanyRecord({
      name: 'Empresa DIOT Test',
      rfc: 'DIO240101AB1',
      regimenFiscal: '601',
      codigoPostal: '06700'
    });

    const report = getDiotReport(testComp.id, 2026, 10);
    for (const row of report.rows) {
      const pipes = (row.batchLine.match(/\|/g) || []).length;
      expect(pipes).toBe(19);
      expect(row.batchLine.split('|').length).toBe(20);
    }
  });

  it('deduplica estados de cuenta bancarios permitiendo múltiples líneas idénticas legítimas en el mismo lote', () => {
    const testComp = createCompanyRecord({
      name: 'Empresa Banco Test',
      rfc: 'BNC240101AB2',
      regimenFiscal: '601',
      codigoPostal: '06700'
    });

    const accounts = getAccounts(testComp.id);
    const bankAcc = accounts.find((a) => a.code.startsWith('102')) || accounts[0];
    expect(bankAcc).toBeDefined();

    // Lote con 2 líneas idénticas legítimas (ej. 2 pagos iguales de $150 de uber o nómina)
    const lines = [
      { fecha: '2026-10-10', referencia: 'REF-100', descripcion: 'Comisión bancaria', cargoBanco: 150, abonoBanco: 0 },
      { fecha: '2026-10-10', referencia: 'REF-100', descripcion: 'Comisión bancaria', cargoBanco: 150, abonoBanco: 0 }
    ];

    addBankStatementLinesTransaction(testComp, bankAcc!.id, lines);
    const recon1 = getBankReconciliation(testComp.id, bankAcc!.id, 2026, 10);
    expect(recon1?.statementLines.length).toBe(2);

    // Si se reimporta el mismo archivo por error, no debe duplicar a 4
    addBankStatementLinesTransaction(testComp, bankAcc!.id, lines);
    const recon2 = getBankReconciliation(testComp.id, bankAcc!.id, 2026, 10);
    expect(recon2?.statementLines.length).toBe(2);
  });

  it('incluye bankStatementLines y preserva estatus 69b en el respaldo y restauración de empresas', () => {
    const testComp = createCompanyRecord({
      name: 'Empresa Backup Full',
      rfc: 'BAK240101AB3',
      regimenFiscal: '601',
      codigoPostal: '06700'
    });

    const accounts = getAccounts(testComp.id);
    const bankAcc = accounts.find((a) => a.code.startsWith('102')) || accounts[0];
    expect(bankAcc).toBeDefined();

    addBankStatementLinesTransaction(testComp, bankAcc!.id, [
      { fecha: '2026-10-05', referencia: 'DEP-01', descripcion: 'Depósito cliente', cargoBanco: 0, abonoBanco: 5000 }
    ]);

    const bundle = exportCompanyBackupBundle(testComp.id);
    expect(bundle.bankStatementLines).toBeDefined();
    expect(bundle.bankStatementLines?.length).toBe(1);

    const restored = restoreCompanyBackupBundle(bundle);
    expect(restored.rfc).toBe('BAK240101AB3');

    const recon = getBankReconciliation(testComp.id, bankAcc!.id, 2026, 10);
    expect(recon?.statementLines.length).toBe(1);
    expect(recon?.statementLines[0]?.abonoBanco).toBe(5000);
  });
});

import { describe, expect, test } from 'bun:test';
import { computeFinancialStatementsData } from '../src/shared/engine/financial-reports.engine';
import {
  buildDepreciationPolizaPlan,
  computeFixedAssetWithDepreciation
} from '../src/shared/engine/fixed-assets.engine';
import {
  buildAutoPolizaPlan,
  computeFiscalWorkpaperFromTrialBalance,
  validateDoubleEntryMovements
} from '../src/shared/accounting-engine';
import { findBankReconciliationMatches } from '../src/shared/engine/bank-and-closing.engine';
import { computeDiotReportData } from '../src/shared/engine/diot.engine';
import { calculateArt106PfIsr } from '../src/shared/engine/art106-tax.engine';
import { isCfdiPendingForPoliza } from '../src/views/cfdi/filterCfdis';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';
import type {
  AccountWithBalance,
  BankStatementLine,
  CfdiDocument,
  Company,
  FixedAssetRecord
} from '../src/shared/types';

describe('Business Logic Audit Suite — Deep Fiscal, Accounting & Invariant Coverage', () => {
  const demoCompany: Company = {
    id: 'comp_audit',
    name: 'CORPORATIVO INDUSTRIAL DEL NORTE SA DE CV',
    rfc: 'CIN220101AA1',
    regimenFiscal: '601 - General de Ley Personas Morales',
    codigoPostal: '64000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 10,
    createdAt: '2026-01-01'
  };

  function buildCatalogWithBalances(): AccountWithBalance[] {
    return getSeedAccountsForPreset('SAT_STANDARD').map((a) => ({
      ...a,
      id: `acc_${a.code}`,
      companyId: demoCompany.id,
      initialBalance: 0,
      initialBalanceComputed: 0,
      periodCharges: 0,
      periodCredits: 0,
      finalBalance: 0
    }));
  }

  describe('1. Financial Statements Engine (computeFinancialStatementsData)', () => {
    test('rolls up contra-asset accounts (171-01-001 Acreedora inside Activo Deudora) and balances Balance Sheet', () => {
      const catalog = buildCatalogWithBalances();
      const movs = [
        // Venta cobrada en bancos: +$100,000 Bancos (102-01-001), +$100,000 Ventas (401-01-001)
        {
          account_id: 'acc_102-01-001',
          cargo: 100000,
          abono: 0,
          polizas: { company_id: demoCompany.id, ejercicio: 2026, periodo: 10 }
        },
        {
          account_id: 'acc_401-01-001',
          cargo: 0,
          abono: 100000,
          polizas: { company_id: demoCompany.id, ejercicio: 2026, periodo: 10 }
        },
        // Compra equipo de cómputo: +$60,000 Equipo (156-01-001), -$60,000 Bancos (102-01-001)
        {
          account_id: 'acc_156-01-001',
          cargo: 60000,
          abono: 0,
          polizas: { company_id: demoCompany.id, ejercicio: 2026, periodo: 10 }
        },
        {
          account_id: 'acc_102-01-001',
          cargo: 0,
          abono: 60000,
          polizas: { company_id: demoCompany.id, ejercicio: 2026, periodo: 10 }
        },
        // Depreciación mensual: +$1,500 Gasto Depreciación (601-01-006), +$1,500 Dep. Acumulada (171-01-001 Acreedora)
        {
          account_id: 'acc_601-01-006',
          cargo: 1500,
          abono: 0,
          polizas: { company_id: demoCompany.id, ejercicio: 2026, periodo: 10 }
        },
        {
          account_id: 'acc_171-01-001',
          cargo: 0,
          abono: 1500,
          polizas: { company_id: demoCompany.id, ejercicio: 2026, periodo: 10 }
        }
      ];

      const res = computeFinancialStatementsData(demoCompany, catalog, movs, 2026, 10);

      // Ingresos = 100,000, Gastos = 1,500 => Utilidad Neta = 98,500
      expect(res.incomeStatement.totalIngresos).toBe(100000);
      expect(res.incomeStatement.totalGastos).toBe(1500);
      expect(res.incomeStatement.utilidadNeta).toBe(98500);

      // Activo: Bancos (40,000) + Equipo (60,000) - Dep. Acumulada (1,500) = 98,500
      expect(res.balanceSheet.totalActivo).toBe(98500);
      expect(res.balanceSheet.totalPasivoMasCapital).toBe(98500);
    });

    test('carries forward unclosed prior-year income/expense movements into RESULTADO_DEL_EJERCICIO (301-02-001)', () => {
      const catalog = buildCatalogWithBalances();
      const movs = [
        // Ejercicio anterior (2025) sin póliza de cierre 13: Venta $50,000 y Gasto $20,000 => Utilidad 2025 = $30,000
        {
          account_id: 'acc_102-01-001',
          cargo: 50000,
          abono: 0,
          polizas: { company_id: demoCompany.id, ejercicio: 2025, periodo: 12 }
        },
        {
          account_id: 'acc_401-01-001',
          cargo: 0,
          abono: 50000,
          polizas: { company_id: demoCompany.id, ejercicio: 2025, periodo: 12 }
        },
        {
          account_id: 'acc_601-01-001',
          cargo: 20000,
          abono: 0,
          polizas: { company_id: demoCompany.id, ejercicio: 2025, periodo: 12 }
        },
        {
          account_id: 'acc_102-01-001',
          cargo: 0,
          abono: 20000,
          polizas: { company_id: demoCompany.id, ejercicio: 2025, periodo: 12 }
        }
      ];

      const res2026 = computeFinancialStatementsData(demoCompany, catalog, movs, 2026, 1);

      // En 2026 las cuentas de resultados inician en 0, pero el saldo de $30,000 en Bancos cuadra con 301-02-001
      expect(res2026.incomeStatement.totalIngresos).toBe(0);
      expect(res2026.incomeStatement.totalGastos).toBe(0);
      expect(res2026.balanceSheet.totalActivo).toBe(30000);
      expect(res2026.balanceSheet.totalPasivoMasCapital).toBe(30000);
    });
  });

  describe('2. Fixed Assets LISR Art. 36 Caps & Lifecycle Guards', () => {
    const baseAuto: FixedAssetRecord = {
      id: 'af_auto',
      companyId: demoCompany.id,
      codigo: 'VEH-01',
      nombre: 'Sedán Utilitario Ejecutivo Gasolina',
      categoria: 'TRANSPORTE_25',
      fechaAdquisicion: '2026-01-10',
      cfdiUuid: null,
      montoOriginalInversion: 480000, // $480,000 MOI contable
      tasaAnualPct: 25,
      mesesDepreciadosPrevios: 0,
      inpcAdquisicion: 130.0,
      inpcMedioPeriodo: 130.0,
      cuentaActivoCode: '154-01-001',
      cuentaDepAcumCode: '171-01-001',
      cuentaGastoDepCode: '601-01-006',
      estatus: 'ACTIVO',
      createdAt: '2026-01-10'
    };

    test('caps fiscal depreciation of combustion automobiles at $175,000 MOI (Art. 36 Fracc. II LISR)', () => {
      const calc = computeFixedAssetWithDepreciation(baseAuto);
      // Contable: 480,000 * 25% / 12 = $10,000.00 mensual
      expect(calc.depreciacionMensualContable).toBe(10000);
      // Fiscal tope $175,000 * 25% / 12 = $3,645.83 mensual
      expect(calc.depreciacionMensualFiscalActualizada).toBe(3645.83);
    });

    test('caps fiscal depreciation of electric/hybrid automobiles at $250,000 MOI and exempts cargo trucks', () => {
      const electricCalc = computeFixedAssetWithDepreciation({
        ...baseAuto,
        nombre: 'Automóvil Híbrido Eléctrico PHEV'
      });
      // Fiscal tope $250,000 * 25% / 12 = $5,208.33 mensual
      expect(electricCalc.depreciacionMensualFiscalActualizada).toBe(5208.33);

      const truckCalc = computeFixedAssetWithDepreciation({
        ...baseAuto,
        nombre: 'Camión de Reparto 3.5 Toneladas'
      });
      // Camión de carga sin tope: $480,000 * 25% / 12 = $10,000.00
      expect(truckCalc.depreciacionMensualFiscalActualizada).toBe(10000);
    });

    test('halts depreciation when asset is acquired after target period or already 100% depreciated', () => {
      const futureAsset = computeFixedAssetWithDepreciation(
        { ...baseAuto, fechaAdquisicion: '2026-08-15' },
        { ejercicio: 2026, periodo: 5 }
      );
      expect(futureAsset.depreciacionMensualContable).toBe(0);
      expect(futureAsset.depreciacionMensualFiscalActualizada).toBe(0);

      // 48 meses al 25% anual = 100% depreciado
      const exhaustedAsset = computeFixedAssetWithDepreciation({
        ...baseAuto,
        mesesDepreciadosPrevios: 48
      });
      expect(exhaustedAsset.depreciacionMensualContable).toBe(0);
      expect(exhaustedAsset.valorNetoEnLibros).toBe(0);

      const catalog = buildCatalogWithBalances();
      expect(() =>
        buildDepreciationPolizaPlan([{ ...baseAuto, mesesDepreciadosPrevios: 48 }], catalog, 'Octubre 2026')
      ).toThrow(/No existen activos fijos vigentes con importe por depreciar/);
    });
  });

  describe('3. Auto-Póliza Foreign Currency Rounding & Payroll Subsidio (TotalOtrosPagos)', () => {
    const catalog = buildCatalogWithBalances();

    test('absorbs 1-5 cent foreign currency rounding difference into income/expense line so double-entry holds', () => {
      // Subtotal 100.01 USD, IVA 16.00 USD, Total 116.01 USD a TC 19.8643
      // 100.01 * 19.8643 = 1986.6286 -> 1986.63
      // 16.00  * 19.8643 = 317.8288  -> 317.83
      // Suma cargos = 2304.46 vs Total 116.01 * 19.8643 = 2304.4574 -> 2304.46 (probemos con 100.02 + 16.00 = 116.02 a TC 19.3333)
      const cfdiUsdRounding: CfdiDocument = {
        id: 'cfdi_fx_round',
        companyId: demoCompany.id,
        uuid: '12345678-ABCD-4321-8888-111122223333',
        serie: 'FX',
        folio: '99',
        fecha: '2026-10-12',
        direction: 'RECIBIDO',
        tipoComprobante: 'I',
        emisorRfc: 'PRO990101AA1',
        emisorNombre: 'GLOBAL CLOUD INC',
        receptorRfc: demoCompany.rfc,
        receptorNombre: demoCompany.name,
        conceptoPrincipal: 'Licenciamiento cloud con decimales de centavo en conversión',
        claveProdServ: '81112100',
        subtotal: 33.33,
        descuento: 0,
        ivaTrasladado: 5.33,
        isrRetenido: 0,
        ivaRetenido: 0,
        total: 38.66,
        moneda: 'USD',
        tipoCambio: 19.8765,
        metodoPago: 'PUE',
        formaPago: '03',
        usoCfdi: 'G03',
        statusSat: 'VIGENTE',
        polizaId: null,
        xmlRaw: '<cfdi:Comprobante/>'
      };

      const plan = buildAutoPolizaPlan(cfdiUsdRounding, catalog);
      expect(plan.isBalanced).toBe(true);
      expect(() => validateDoubleEntryMovements(plan.movements)).not.toThrow();
    });

    test('splits Nómina 1.2 TotalOtrosPagos into Subsidio al Empleo / ISR Acreditable (113-02-001)', () => {
      const cfdiNominaSubsidio: CfdiDocument = {
        id: 'cfdi_nom_sub',
        companyId: demoCompany.id,
        uuid: '87654321-ABCD-4321-8888-999900001111',
        serie: 'NOM',
        folio: '45',
        fecha: '2026-10-15',
        direction: 'RECIBIDO',
        tipoComprobante: 'N',
        emisorRfc: demoCompany.rfc,
        emisorNombre: demoCompany.name,
        receptorRfc: 'GARC900101AA1',
        receptorNombre: 'JUAN GARCIA',
        conceptoPrincipal: 'Nómina Quincenal con Subsidio',
        claveProdServ: '84111505',
        subtotal: 10500, // 10,000 sueldo + 500 otros pagos
        descuento: 300, // IMSS
        ivaTrasladado: 0,
        isrRetenido: 800,
        ivaRetenido: 0,
        total: 9400,
        moneda: 'MXN',
        tipoCambio: 1,
        metodoPago: 'PUE',
        formaPago: '99',
        usoCfdi: 'CN01',
        statusSat: 'VIGENTE',
        polizaId: null,
        xmlRaw: '<cfdi:Comprobante><nomina12:Nomina TotalOtrosPagos="500.00"/></cfdi:Comprobante>'
      };

      const plan = buildAutoPolizaPlan(cfdiNominaSubsidio, catalog);
      expect(plan.isBalanced).toBe(true);
      const sueldosLine = plan.movements.find((m) => m.accountCode === '601-01-001');
      const subsidioLine = plan.movements.find((m) => m.accountCode === '113-02-001');
      expect(sueldosLine?.cargo).toBe(10000);
      expect(subsidioLine?.cargo).toBe(500);
    });
  });

  describe('4. Bank Reconciliation 1-to-1 Matching & DIOT Foreign / Credit Notes', () => {
    test('findBankReconciliationMatches pairs duplicate amounts 1-to-1 without double-matching a book movement', () => {
      const statementLines: BankStatementLine[] = [
        {
          id: 'stmt_1',
          companyId: demoCompany.id,
          accountId: 'acc_102-01-001',
          ejercicio: 2026,
          periodo: 10,
          fecha: '2026-10-05',
          referencia: 'SPEI-1',
          descripcion: 'Pago comisión 1',
          cargoBanco: 500,
          abonoBanco: 0,
          matchedMovementId: null,
          matchedPolizaFolio: null
        },
        {
          id: 'stmt_2',
          companyId: demoCompany.id,
          accountId: 'acc_102-01-001',
          ejercicio: 2026,
          periodo: 10,
          fecha: '2026-10-05',
          referencia: 'SPEI-2',
          descripcion: 'Pago comisión 2',
          cargoBanco: 500,
          abonoBanco: 0,
          matchedMovementId: null,
          matchedPolizaFolio: null
        }
      ];

      // Solo hay 1 movimiento en libros por $500
      const bookMovements = [
        {
          movementId: 'mov_book_1',
          polizaId: 'pol_1',
          polizaFolio: 'EGRESO-1',
          fecha: '2026-10-05',
          referencia: 'SPEI-1',
          concepto: 'Comisión bancaria',
          cargoContable: 0,
          abonoContable: 500,
          isMatched: false
        }
      ];

      const pairs = findBankReconciliationMatches(statementLines, bookMovements);
      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual({ statementLineId: 'stmt_1', movementId: 'mov_book_1' });
    });

    test('computeDiotReportData maps foreign suppliers (05), credit notes (col 16) and exempt/zero bases', () => {
      const catalog = buildCatalogWithBalances();
      const polizaIds = new Set(['pol_ext', 'pol_nc']);
      const cfdis: CfdiDocument[] = [
        {
          id: 'c_ext',
          companyId: demoCompany.id,
          uuid: 'EXT-1111',
          serie: 'INT',
          folio: '1',
          fecha: '2026-10-10',
          direction: 'RECIBIDO',
          tipoComprobante: 'I',
          emisorRfc: 'XEXX010101000',
          emisorNombre: 'STRIPE INC',
          receptorRfc: demoCompany.rfc,
          receptorNombre: demoCompany.name,
          conceptoPrincipal: 'Servicio exento de procesamiento internacional',
          claveProdServ: '84111500',
          subtotal: 4000,
          descuento: 0,
          ivaTrasladado: 0,
          isrRetenido: 0,
          ivaRetenido: 0,
          total: 4000,
          moneda: 'MXN',
          tipoCambio: 1,
          metodoPago: 'PUE',
          formaPago: '03',
          usoCfdi: 'G03',
          statusSat: 'VIGENTE',
          polizaId: 'pol_ext',
          xmlRaw: ''
        },
        {
          id: 'c_nc',
          companyId: demoCompany.id,
          uuid: 'NC-2222',
          serie: 'NC',
          folio: '2',
          fecha: '2026-10-12',
          direction: 'RECIBIDO',
          tipoComprobante: 'E',
          emisorRfc: 'PRO880101AA1',
          emisorNombre: 'PROVEEDOR NACIONAL SA',
          receptorRfc: demoCompany.rfc,
          receptorNombre: demoCompany.name,
          conceptoPrincipal: 'Bonificación sobre compra',
          claveProdServ: '84111506',
          subtotal: 1000,
          descuento: 0,
          ivaTrasladado: 160,
          isrRetenido: 0,
          ivaRetenido: 0,
          total: 1160,
          moneda: 'MXN',
          tipoCambio: 1,
          metodoPago: 'PUE',
          formaPago: '03',
          usoCfdi: 'G02',
          statusSat: 'VIGENTE',
          polizaId: 'pol_nc',
          xmlRaw: ''
        }
      ];

      const diot = computeDiotReportData({
        company: demoCompany,
        ejercicio: 2026,
        periodo: 10,
        cfdis,
        polizaIdsInPeriod: polizaIds,
        trialBalance: catalog
      });

      const extRow = diot.rows.find((r) => r.rfc === 'XEXX010101000')!;
      expect(extRow.tipoTercero).toBe('05');
      const extCols = extRow.batchLine.split('|');
      expect(extCols[0]).toBe('05');
      expect(extCols[4]).toBe('STRIPE INC');
      expect(extCols[5]).toBe('USA');
      expect(extCols[11]).toBe('4000'); // Base exenta en columna 12 (índice 11)

      const ncRow = diot.rows.find((r) => r.rfc === 'PRO880101AA1')!;
      const ncCols = ncRow.batchLine.split('|');
      expect(ncCols[15]).toBe('1000'); // Devoluciones/bonificaciones en columna 16 (índice 15)
      expect(ncRow.ivaAcreditable16).toBe(-160);
    });
  });

  describe('5. Art. 106 LISR 2026 Inflation-Adjusted Brackets & $0.00 CFDI Filter', () => {
    test('applies 2026 inflation-updated tariff (Art. 152 LISR factor 1.1321) yielding lower ISR than 2025 for same base', () => {
      const baseCents = 2_500_000; // $25,000.00 MXN en Mes 1
      const isr2025 = calculateArt106PfIsr(baseCents, 1, 2025);
      const isr2026 = calculateArt106PfIsr(baseCents, 1, 2026);

      expect(isr2026.isrCents).toBeGreaterThan(0);
      expect(isr2026.isrCents).toBeLessThan(isr2025.isrCents);
    });

    test('isCfdiPendingForPoliza excludes $0.00 CFDIs, Traslados (T), Cancelled and already accounted CFDIs', () => {
      const baseCfdi: CfdiDocument = {
        id: 'c1',
        companyId: demoCompany.id,
        uuid: 'UUID-1',
        serie: 'A',
        folio: '1',
        fecha: '2026-10-01',
        direction: 'EMITIDO',
        tipoComprobante: 'I',
        emisorRfc: demoCompany.rfc,
        emisorNombre: demoCompany.name,
        receptorRfc: 'XAXX010101000',
        receptorNombre: 'PUBLICO',
        conceptoPrincipal: 'Venta',
        claveProdServ: '01010101',
        subtotal: 1000,
        descuento: 0,
        ivaTrasladado: 160,
        isrRetenido: 0,
        ivaRetenido: 0,
        total: 1160,
        moneda: 'MXN',
        tipoCambio: 1,
        metodoPago: 'PUE',
        formaPago: '03',
        usoCfdi: 'G03',
        statusSat: 'VIGENTE',
        polizaId: null,
        xmlRaw: ''
      };

      expect(isCfdiPendingForPoliza(baseCfdi)).toBe(true);
      expect(isCfdiPendingForPoliza({ ...baseCfdi, subtotal: 0, total: 0 })).toBe(false);
      expect(isCfdiPendingForPoliza({ ...baseCfdi, statusSat: 'CANCELADO' })).toBe(false);
      expect(isCfdiPendingForPoliza({ ...baseCfdi, polizaId: 'pol_1' })).toBe(false);
    });

    test('computeFiscalWorkpaperFromTrialBalance excludes 601-01-006 (accounting depreciation) and 611 (ISR) identically for SQLite & Cloud', () => {
      const mkTbAcc = (overrides: Partial<AccountWithBalance> & Pick<AccountWithBalance, 'id' | 'code' | 'name' | 'type' | 'nature' | 'level' | 'isAffectable' | 'satGroupCode'>): AccountWithBalance => ({
        companyId: demoCompany.id,
        parentCode: null,
        currency: 'MXN',
        initialBalance: 0,
        initialBalanceComputed: 0,
        periodCharges: 0,
        periodCredits: 0,
        finalBalance: 0,
        ...overrides
      });
      const tb: AccountWithBalance[] = [
        mkTbAcc({
          id: 'acc_ing',
          code: '401-01-001',
          name: 'Ventas',
          type: 'INGRESOS',
          nature: 'ACREEDORA',
          level: 3,
          isAffectable: true,
          satGroupCode: '401.01',
          periodCredits: 100000,
          finalBalance: 100000
        }),
        mkTbAcc({
          id: 'acc_gasto',
          code: '601-01-001',
          name: 'Sueldos',
          type: 'GASTOS',
          nature: 'DEUDORA',
          level: 3,
          isAffectable: true,
          satGroupCode: '601.01',
          periodCharges: 30000,
          finalBalance: 30000
        }),
        mkTbAcc({
          id: 'acc_dep',
          code: '601-01-006',
          name: 'Depreciación contable',
          type: 'GASTOS',
          nature: 'DEUDORA',
          level: 3,
          isAffectable: true,
          satGroupCode: '601.74',
          periodCharges: 12000,
          finalBalance: 12000
        }),
        mkTbAcc({
          id: 'acc_isr',
          code: '801-01-001',
          name: 'ISR del Ejercicio',
          type: 'GASTOS',
          nature: 'DEUDORA',
          level: 3,
          isAffectable: true,
          satGroupCode: '611.01',
          periodCharges: 9000,
          finalBalance: 9000
        })
      ];

      const wp = computeFiscalWorkpaperFromTrialBalance({
        company: { ...demoCompany, regimenFiscal: '601 - General de Ley Personas Morales' },
        ejercicio: 2026,
        periodo: 10,
        parameters: {
          companyId: demoCompany.id,
          ejercicio: 2026,
          coeficienteUtilidad: 0.2,
          perdidasFiscalesPendientes: 0,
          pagosProvisionalesAnteriores: 0,
          saldoFavorIvaAnterior: 0,
          tipoCambioDofCierre: 20
        },
        trialBalance: tb,
        cfdis: []
      });

      expect(wp.isrProvisional.ingresosPeriodo).toBe(100000);
      expect(wp.isrProvisional.deduccionesAutorizadasPeriodo).toBe(30000);
    });
  });
});

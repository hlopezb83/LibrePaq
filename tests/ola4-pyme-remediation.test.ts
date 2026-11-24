import { describe, expect, test } from 'bun:test';
import { computeFiscalWorkpaperFromTrialBalance } from '../src/shared/engine/fiscal-trial-balance.engine';
import {
  buildCostOfSalesPolizaPlan,
  computeCostOfSales,
  computeInventoryInputsFromMovements,
  computePurchasesFromMovements
} from '../src/shared/engine/cost-of-sales.engine';
import {
  computeAssetPostDepreciationUpdate,
  computeFixedAssetWithDepreciation
} from '../src/shared/engine/fixed-assets.engine';
import {
  computePayrollPeriodSummary,
  computeSuaAndIsnProvision,
  MEXICO_ISN_RATES
} from '../src/shared/engine/payroll-summary.engine';
import { parseBankCsvDate, parseBankStatementCsv } from '../src/shared/csv-bank-parser';
import { computeCxcCxpAging } from '../src/shared/engine/cxc-cxp.engine';
import { computeBankReconciliationProof } from '../src/views/fiscal-bancos/BankReconciliationExport';
import {
  getPayrollPeriodSettings,
  savePayrollPeriodSettings
} from '../src/lib/supabase/supabase-payroll-settings';
import { toCents } from '../src/shared/engine/invariants-and-math';
import type {
  Account,
  AccountWithBalance,
  BankReconciliationResponse,
  CfdiDocument,
  Company,
  FixedAssetRecord,
  TaxParametersRecord
} from '../src/shared/types';

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'comp_ola4',
    name: 'Empresa PyME Ola 4 S.A. de C.V.',
    rfc: 'EPO240101AB1',
    regimenFiscal: '601 - General de Ley Personas Morales',
    codigoPostal: '06000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 10,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeAccount(
  id: string,
  code: string,
  name: string,
  type: Account['type'],
  nature: Account['nature'],
  satGroupCode: string,
  periodCharges = 0,
  periodCredits = 0
): AccountWithBalance {
  return {
    id,
    companyId: 'comp_ola4',
    code,
    name,
    parentCode: null,
    type,
    nature,
    level: 3,
    isAffectable: true,
    satGroupCode,
    currency: 'MXN',
    initialBalance: 0,
    initialBalanceComputed: 0,
    periodCharges,
    periodCredits,
    finalBalance: nature === 'ACREEDORA' ? periodCredits - periodCharges : periodCharges - periodCredits
  };
}

function makeCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_1',
    companyId: 'comp_ola4',
    uuid: 'UUID-1',
    fecha: '2026-10-15',
    tipoComprobante: 'I',
    direction: 'EMITIDO',
    serie: 'A',
    folio: '1',
    emisorRfc: 'EPO240101AB1',
    emisorNombre: 'EMPRESA',
    receptorRfc: 'CLI010101AA1',
    receptorNombre: 'CLIENTE',
    conceptoPrincipal: 'Servicio',
    claveProdServ: '84111506',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 1000,
    descuento: 0,
    ivaTrasladado: 160,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 1160,
    metodoPago: 'PUE',
    formaPago: '03',
    usoCfdi: 'G03',
    uuidRelacionado: null,
    statusSat: 'VIGENTE',
    polizaId: null,
    xmlRaw: '',
    ...overrides
  };
}

const baseParams: TaxParametersRecord = {
  companyId: 'comp_ola4',
  ejercicio: 2026,
  periodo: 10,
  coeficienteUtilidad: 0.2,
  perdidasFiscalesPendientes: 0,
  pagosProvisionalesAnteriores: 0,
  saldoFavorIvaAnterior: 0,
  tipoCambioDofCierre: 20
};

describe('Ola 4 — Remediación Fiscal, Inventarios, Activos, Nómina, Bancos y FX', () => {
  test('1. Día 17: suma todas las 216-*, corrige 216.10 vs 216.02 Asimilados y prorratea IVA en PM 601', () => {
    const tb: AccountWithBalance[] = [
      makeAccount('a401', '401-01-001', 'Ventas', 'INGRESOS', 'ACREEDORA', '401.01', 0, 100000),
      makeAccount('a118', '118-01-001', 'IVA Acreditable Pagado', 'ACTIVO', 'DEUDORA', '118.01', 16000, 0),
      makeAccount('a208', '208-01-001', 'IVA Trasladado Cobrado', 'PASIVO', 'ACREEDORA', '208.01', 0, 12800),
      makeAccount('a216_01', '216-01-001', 'Ret. ISR Sueldos', 'PASIVO', 'ACREEDORA', '216.01', 0, 2000),
      makeAccount('a216_02', '216-01-003', 'Ret. ISR Asimilados', 'PASIVO', 'ACREEDORA', '216.02', 0, 1500),
      makeAccount('a216_03', '216-01-004', 'Ret. ISR Arrendamiento', 'PASIVO', 'ACREEDORA', '216.03', 0, 500),
      makeAccount('a216_04', '216-01-005', 'Ret. ISR Honorarios', 'PASIVO', 'ACREEDORA', '216.04', 0, 1000),
      makeAccount('a216_11', '216-01-006', 'Ret. ISR RESICO', 'PASIVO', 'ACREEDORA', '216.11', 0, 250),
      makeAccount('a216_10', '216-01-002', 'Ret. IVA 216.10', 'PASIVO', 'ACREEDORA', '216.10', 0, 1600)
    ];

    const cfdis: CfdiDocument[] = [
      makeCfdi({
        id: 'c_grav',
        uuid: 'G1',
        subtotal: 80000,
        ivaTrasladado: 12800,
        total: 92800,
        taxBreakdown: { base16: 80000, iva16: 12800, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0 }
      }),
      makeCfdi({
        id: 'c_ex',
        uuid: 'E1',
        subtotal: 20000,
        ivaTrasladado: 0,
        total: 20000,
        conceptoPrincipal: 'Servicio exento',
        taxBreakdown: { base16: 0, iva16: 0, base8: 0, iva8: 0, base0: 0, baseExento: 20000, ieps: 0 }
      })
    ];

    const wp = computeFiscalWorkpaperFromTrialBalance({
      company: makeCompany(),
      ejercicio: 2026,
      periodo: 10,
      parameters: baseParams,
      trialBalance: tb,
      cfdis
    });

    // 216.02 (1500) es Asimilados ISR, NO IVA Retenido; IVA Retenido es 216.10 (1600)
    expect(wp.resumenLineaCapturaSat.retencionesIsrPorEnterar).toBe(5250);
    expect(wp.resumenLineaCapturaSat.retencionesIvaPorEnterar).toBe(1600);
    expect(wp.retencionesDesglose?.length).toBe(6);

    // PM 601 aplica prorrateo Art. 5 LIVA (80,000 / 100,000 = 0.80) sobre $16,000 de 118-01-001
    expect(wp.ivaBreakdown?.prorationFactor).toBe(0.8);
    expect(wp.ivaDefinitivo.ivaAcreditablePagado).toBe(12800);
    expect(wp.ivaDefinitivo.ivaNetoAPagar).toBe(0);
  });

  test('2. Costo de Ventas: excluye póliza vinculada y diferencia Analítico vs Perpetuo sin duplicar 501', () => {
    const accCost = makeAccount('a501', '501-01-001', 'Costo de Ventas / Compras', 'COSTOS', 'DEUDORA', '501.01');
    const accInv = makeAccount('a115', '115-01-001', 'Almacén / Inventarios', 'ACTIVO', 'DEUDORA', '115.01');

    const movs = [
      { poliza_id: 'pol_compra', account_id: 'a501', cargo: 5000, abono: 0, polizas: null },
      { poliza_id: 'pol_cv_linked', account_id: 'a501', cargo: 1000, abono: 0, polizas: null },
      { poliza_id: 'pol_almacen', account_id: 'a115', cargo: 7500, abono: 0, polizas: null },
      { poliza_id: 'pol_cv_linked', account_id: 'a115', cargo: 2000, abono: 1000, polizas: null }
    ];

    expect(computePurchasesFromMovements([accCost, accInv], movs, 'pol_cv_linked')).toBe(5000);
    expect(computeInventoryInputsFromMovements([accCost, accInv], movs, 'pol_cv_linked')).toBe(7500);

    // Analítico: InvInicial 1,000 + Compras 5,000 - InvFinal 2,000 = Costo 4,000
    const comp = computeCostOfSales({ initialInventory: 1000, purchasesPeriod: 5000, finalInventory: 2000 });
    expect(comp.costOfSales).toBe(4000);

    const planAnalitico = buildCostOfSalesPolizaPlan({
      companyId: 'comp_ola4',
      year: 2026,
      period: 10,
      fecha: '2026-10-31',
      costOfSales: 4000,
      accounts: [accCost, accInv],
      method: 'ANALITICO',
      initialInventory: 1000,
      purchasesPeriod: 5000,
      finalInventory: 2000
    });
    // Efecto neto en 501 = +1000 - 2000 = -1000 (sobre 5000 ya en 501 => 4000 exactos)
    // Efecto neto en 115 = -1000 + 2000 = +1000 (sobre 1000 inicial => 2000 InvFinal, nunca negativo)
    const net501 = planAnalitico.movements
      .filter((m) => m.accountCode === '501-01-001')
      .reduce((s, m) => s + m.cargo - m.abono, 0);
    const net115 = planAnalitico.movements
      .filter((m) => m.accountCode === '115-01-001')
      .reduce((s, m) => s + m.cargo - m.abono, 0);
    expect(net501).toBe(-1000);
    expect(net115).toBe(1000);
    expect(toCents(planAnalitico.totalCargo)).toBe(toCents(planAnalitico.totalAbono));

    // Perpetuo: Cargo 501 por 4,000 / Abono 115 por 4,000
    const planPerpetuo = buildCostOfSalesPolizaPlan({
      companyId: 'comp_ola4',
      year: 2026,
      period: 10,
      fecha: '2026-10-31',
      costOfSales: 4000,
      accounts: [accCost, accInv],
      method: 'PERPETUO',
      initialInventory: 1000,
      purchasesPeriod: 5000,
      finalInventory: 2000
    });
    expect(planPerpetuo.movements).toHaveLength(2);
    expect(planPerpetuo.movements[0]?.accountCode).toBe('501-01-001');
    expect(planPerpetuo.movements[0]?.cargo).toBe(4000);
    expect(planPerpetuo.movements[1]?.accountCode).toBe('115-01-001');
    expect(planPerpetuo.movements[1]?.abono).toBe(4000);
  });

  test('3. Activos Fijos: corta por targetPeriod y actualiza mesesDepreciadosPrevios (+1) hasta 100% MOI', () => {
    const futureAsset: FixedAssetRecord = {
      id: 'fa_future',
      companyId: 'comp_ola4',
      codigo: 'AF-FUT',
      nombre: 'Equipo Noviembre',
      categoria: 'COMPUTO_30',
      fechaAdquisicion: '2026-11-05',
      cfdiUuid: null,
      montoOriginalInversion: 36000,
      tasaAnualPct: 30,
      mesesDepreciadosPrevios: 0,
      inpcAdquisicion: 138,
      inpcMedioPeriodo: 140,
      cuentaActivoCode: '156-01-001',
      cuentaDepAcumCode: '171-01-001',
      cuentaGastoDepCode: '601-01-006',
      estatus: 'ACTIVO',
      createdAt: '2026-11-05'
    };

    const calcOct = computeFixedAssetWithDepreciation(futureAsset, { ejercicio: 2026, periodo: 10 });
    expect(calcOct.depreciacionMensualContable).toBe(0);
    expect(computeAssetPostDepreciationUpdate(futureAsset, { ejercicio: 2026, periodo: 10 })).toBeNull();

    const finishingAsset: FixedAssetRecord = {
      ...futureAsset,
      id: 'fa_end',
      codigo: 'AF-END',
      fechaAdquisicion: '2023-01-10',
      mesesDepreciadosPrevios: 39 // 30% anual = 40 meses de vida útil
    };
    const updateEnd = computeAssetPostDepreciationUpdate(finishingAsset, { ejercicio: 2026, periodo: 10 });
    expect(updateEnd).toEqual({ mesesDepreciadosPrevios: 40, estatus: 'TOTALMENTE_DEPRECIADO' });
  });

  test('4. Nómina 1.2 + ISN CDMX 4.0% persistente sin caer en TotalDeducciones', async () => {
    const cmx = MEXICO_ISN_RATES.find((s) => s.code === 'CMX');
    expect(cmx?.ratePct).toBe(4.0);

    const nominaXmlIsrOnly = `<cfdi:Comprobante><nomina12:Nomina TotalPercepciones="20000.00" TotalDeducciones="3500.00" TotalOtrosPagos="250.00"><nomina12:Deducciones><nomina12:Deduccion TipoDeduccion="002" Importe="3500.00"/></nomina12:Deducciones></nomina12:Nomina></cfdi:Comprobante>`;
    const summary = computePayrollPeriodSummary({
      cfdis: [
        makeCfdi({
          tipoComprobante: 'N',
          fecha: '2026-10-15',
          subtotal: 20250,
          descuento: 3500, // TotalDeducciones
          isrRetenido: 3500,
          total: 16750,
          xmlRaw: nominaXmlIsrOnly
        })
      ],
      trialBalance: [makeAccount('a216', '216-01-001', 'Ret ISR', 'PASIVO', 'ACREEDORA', '216.01', 0, 3500)],
      ejercicio: 2026,
      periodo: 10
    });

    expect(summary.totalPercepciones).toBe(20000);
    expect(summary.totalSubsidioEmpleo).toBe(250);
    expect(summary.imssObreroEstimado).toBe(0); // No cayó en descuento=3500

    const prov = computeSuaAndIsnProvision(
      { ejercicio: 2026, periodo: 10, stateCode: 'CMX', baseGravableNomina: 20000, imssPatronal: 1000, rcv: 500, infonavit: 1000 },
      [
        makeAccount('g1', '601-01-010', 'IMSS', 'GASTOS', 'DEUDORA', '601.01'),
        makeAccount('g2', '601-01-011', 'ISN', 'GASTOS', 'DEUDORA', '601.01'),
        makeAccount('p1', '211-01-002', 'SUA', 'PASIVO', 'ACREEDORA', '211.01'),
        makeAccount('p2', '213-01-003', 'ISN Pagar', 'PASIVO', 'ACREEDORA', '213.01')
      ]
    );
    expect(prov.tasaIsnPct).toBe(4.0);
    expect(prov.isnEstatal).toBe(800);

    const saved = await savePayrollPeriodSettings({
      companyId: 'comp_ola4',
      ejercicio: 2026,
      periodo: 10,
      stateCode: 'CMX',
      isnRate: 4.0,
      imssPatronal: 1000,
      rcv: 500,
      infonavit: 1000
    });
    const loaded = await getPayrollPeriodSettings('comp_ola4', 2026, 10);
    expect(loaded).toEqual(saved);
  });

  test('5. CSV fechas múltiples, prueba de cuadre bancario y CxC/CxP en moneda extranjera al alza de TC', () => {
    expect(parseBankCsvDate('2026-10-05', '2026-10-01')).toBe('2026-10-05');
    expect(parseBankCsvDate('05/10/2026', '2026-10-01')).toBe('2026-10-05');
    expect(parseBankCsvDate('05-10-2026', '2026-10-01')).toBe('2026-10-05');
    expect(parseBankCsvDate('15/ENE/2026', '2026-10-01')).toBe('2026-01-15');
    expect(parseBankCsvDate('20-AUG-2026', '2026-10-01')).toBe('2026-08-20');

    const csvRows = parseBankStatementCsv(
      'Fecha,Referencia,Descripcion,Cargo,Abono\n15/DIC/2026,SPEI-1,Pago Cliente,0,"$1,500.00"',
      '2026-10-01'
    );
    expect(csvRows[0]?.fecha).toBe('2026-12-15');
    expect(csvRows[0]?.abonoBanco).toBe(1500);

    const mockRecon = {
      account: makeAccount('b1', '102-01-001', 'BBVA', 'ACTIVO', 'DEUDORA', '102.01'),
      ejercicio: 2026,
      periodo: 10,
      statementLines: [],
      bookMovements: [],
      summary: {
        saldoInicialLibros: 1000,
        saldoFinalLibros: 1200,
        totalDepositosBanco: 300,
        totalRetirosBanco: 50,
        movimientosConciliados: 1,
        movimientosPendientesBanco: 2,
        movimientosPendientesLibros: 2
      }
    } satisfies BankReconciliationResponse;
    const proof = computeBankReconciliationProof(
      mockRecon,
      {
        cargosBancoNoRegistrados: 50,
        depositosBancoNoRegistrados: 300,
        cargosContablesEnTransito: 200,
        abonosContablesEnTransito: 100,
        saldoConciliadoEstimado: 1450
      },
      1350
    );
    expect(proof.saldoConciliadoBanco).toBe(1450);
    expect(proof.saldoConciliadoLibros).toBe(1450);
    expect(proof.diferenciaCuadre).toBe(0);
    expect(proof.isCuadrada).toBe(true);

    // CxC USD con subida de tipo de cambio (18.00 -> 20.50): $1,000 USD - $900 USD = $100 USD insolutos
    const usdInv = makeCfdi({
      id: 'usd_inv',
      uuid: 'USD-INV-1',
      fecha: '2026-10-01',
      moneda: 'USD',
      tipoCambio: 18.0,
      metodoPago: 'PPD',
      total: 1000
    });
    const usdPay = makeCfdi({
      id: 'usd_rep',
      uuid: 'USD-REP-1',
      fecha: '2026-10-20',
      tipoComprobante: 'P',
      moneda: 'USD',
      tipoCambio: 20.5,
      total: 900,
      relatedDocs: [
        {
          idDocumento: 'USD-INV-1',
          numParcialidad: 1,
          impSaldoAnt: 1000,
          impPagado: 900,
          impSaldoInsoluto: 100,
          monedaDr: 'USD',
          equivalenciaDr: 1,
          pagoMoneda: 'USD',
          pagoTipoCambio: 20.5
        }
      ]
    });
    const aging = computeCxcCxpAging({
      companyId: 'comp_ola4',
      cfdis: [usdInv, usdPay],
      asOfIso: '2026-10-31'
    });
    expect(aging.cxcItems).toHaveLength(1);
    expect(aging.cxcItems[0]?.saldoInsolutoMxn).toBe(2050); // $100 USD * 20.50 MXN/USD
  });
});

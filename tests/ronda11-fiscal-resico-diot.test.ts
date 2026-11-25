import './setup-test-db';
import { describe, expect, test } from 'bun:test';
import { BASE_COMPANY_ACCOUNTS } from '../src/shared/catalogs/base-accounts.seed';
import { computeCashBasisFiscalSummary } from '../src/shared/engine/cash-basis-fiscal.engine';
import { buildDiot54BatchLine, computeDiotReportData, validateDiotBatchLines } from '../src/shared/engine/diot.engine';
import { normalizeDiotTipoOperacion, resolveDiotDocAmounts } from '../src/shared/engine/diot-txt';
import { computeFiscalWorkpaperFromTrialBalance } from '../src/shared/engine/fiscal-trial-balance.engine';
import { computeFiscalWorkpaper } from '../src/shared/engine/fiscal.engine';
import { buildTaxProvisionMovements } from '../src/shared/engine/tax-provision.engine';
import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  FixedAssetRecord,
  Poliza,
  TaxParametersRecord,
  ThirdPartyRecord
} from '../src/shared/types';

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'comp_r11_s1',
    rfc: 'R11260101AA1',
    name: 'Empresa Ronda 11 Fiscal S.A. de C.V.',
    regimenFiscal: '626',
    codigoPostal: '06700',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 6,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeSeedTrialBalance(companyId = 'comp_r11_s1'): AccountWithBalance[] {
  return BASE_COMPANY_ACCOUNTS.map((a) => ({
    ...a,
    id: `acc_${a.code}`,
    companyId,
    initialBalanceComputed: 0,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: 0
  }));
}

function makeParams(companyId: string, overrides: Partial<TaxParametersRecord> = {}): TaxParametersRecord {
  return {
    companyId,
    ejercicio: 2026,
    periodo: 6,
    coeficienteUtilidad: 0,
    pagosProvisionalesAnteriores: 0,
    perdidasFiscalesPendientes: 0,
    saldoFavorIvaAnterior: 0,
    tipoCambioDofCierre: 19,
    ...overrides
  };
}

function makeCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_r11_1',
    companyId: 'comp_r11_s1',
    uuid: '11111111-1111-4111-8111-111111111111',
    fecha: '2026-06-15',
    tipoComprobante: 'I',
    direction: 'EMITIDO',
    serie: 'A',
    folio: '1',
    emisorRfc: 'R11260101AA1',
    emisorNombre: 'Empresa Ronda 11',
    receptorRfc: 'CLI010101AA1',
    receptorNombre: 'Cliente Nacional S.A.',
    conceptoPrincipal: 'Servicios generales',
    claveProdServ: '81112100',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal: 10_000,
    descuento: 0,
    ivaTrasladado: 1_600,
    isrRetenido: 0,
    ivaRetenido: 0,
    total: 11_600,
    metodoPago: 'PUE',
    formaPago: '03',
    usoCfdi: 'G03',
    uuidRelacionado: null,
    statusSat: 'VIGENTE',
    polizaId: 'pol_1',
    xmlRaw: '<cfdi:Comprobante/>',
    ...overrides
  };
}

describe('Ronda 11 Suite 1 — Fiscal Día 17, PM RESICO 626, Provisión SAT y DIOT 54 campos', () => {
  test('1. PM RESICO 626: deduce inversiones de fixed_assets sin duplicar XML y resta Subsidio al Empleo en nómina', () => {
    const pmResico = makeCompany({ regimenFiscal: '626' });
    const cfdis: CfdiDocument[] = [
      makeCfdi({
        id: 'c_ing',
        uuid: 'AAAA1111-1111-4111-8111-111111111111',
        subtotal: 200_000,
        ivaTrasladado: 32_000,
        total: 232_000
      }),
      // Activo fijo comprado con uso G03 (ya deducido vía flujo XML): NO debe duplicarse desde fixed_assets
      makeCfdi({
        id: 'c_gasto_dup',
        uuid: 'BBBB2222-2222-4222-8222-222222222222',
        direction: 'RECIBIDO',
        emisorRfc: 'PRO010101AA1',
        receptorRfc: pmResico.rfc,
        usoCfdi: 'G03',
        subtotal: 12_000,
        ivaTrasladado: 1_920,
        total: 13_920
      }),
      // Activo fijo comprado con uso I04 (equipo de cómputo): excluido de gasto XML, debe deducirse vía Art. 31
      makeCfdi({
        id: 'c_af_i04',
        uuid: 'CCCC3333-3333-4333-8333-333333333333',
        direction: 'RECIBIDO',
        emisorRfc: 'PRO010101AA1',
        receptorRfc: pmResico.rfc,
        usoCfdi: 'I04',
        fecha: '2026-01-10',
        subtotal: 60_000,
        ivaTrasladado: 9_600,
        total: 69_600
      }),
      // Nómina con Subsidio al Empleo (TipoOtroPago="002") de $800 que NO es gasto deducible
      makeCfdi({
        id: 'c_nom',
        uuid: 'DDDD4444-4444-4444-8444-444444444444',
        tipoComprobante: 'N',
        direction: 'EMITIDO',
        fecha: '2026-06-30',
        fechaPago: '2026-06-30',
        subtotal: 10_800,
        ivaTrasladado: 0,
        isrRetenido: 500,
        total: 10_300,
        xmlRaw: '<cfdi:Comprobante><nomina12:Nomina TotalOtrosPagos="800.00"><nomina12:OtrosPagos><nomina12:OtroPago TipoOtroPago="002" Importe="800.00"/></nomina12:OtrosPagos></nomina12:Nomina></cfdi:Comprobante>'
      })
    ];

    const cashOnly = computeCashBasisFiscalSummary({
      company: pmResico,
      ejercicio: 2026,
      periodo: 6,
      cfdis
    });
    // Gasto G03 (12,000) + Nómina neta sin subsidio (10,800 - 800 = 10,000) = 22,000
    expect(cashOnly.deduccionesPeriodo).toBe(22_000);

    const fixedAssets: FixedAssetRecord[] = [
      {
        id: 'fa_i04',
        companyId: pmResico.id,
        codigo: 'AF-001',
        nombre: 'Servidor I04',
        categoria: 'COMPUTO_30',
        fechaAdquisicion: '2026-01-10',
        montoOriginalInversion: 60_000,
        tasaAnualPct: 30,
        inpcAdquisicion: 143.588,
        inpcMedioPeriodo: 143.588,
        mesesDepreciadosPrevios: 0,
        estatus: 'ACTIVO',
        cuentaActivoCode: '156-01-001',
        cuentaDepAcumCode: '171-01-005',
        cuentaGastoDepCode: '601-01-006',
        cfdiUuid: 'CCCC3333-3333-4333-8333-333333333333',
        createdAt: '2026-01-10T00:00:00Z'
      },
      {
        id: 'fa_dup',
        companyId: pmResico.id,
        codigo: 'AF-002',
        nombre: 'Equipo ya deducido G03',
        categoria: 'COMPUTO_30',
        fechaAdquisicion: '2026-01-10',
        montoOriginalInversion: 12_000,
        tasaAnualPct: 30,
        inpcAdquisicion: 143.588,
        inpcMedioPeriodo: 143.588,
        mesesDepreciadosPrevios: 0,
        estatus: 'ACTIVO',
        cuentaActivoCode: '156-01-001',
        cuentaDepAcumCode: '171-01-005',
        cuentaGastoDepCode: '601-01-006',
        cfdiUuid: 'BBBB2222-2222-4222-8222-222222222222',
        createdAt: '2026-01-10T00:00:00Z'
      }
    ];

    const wpWithAssets = computeFiscalWorkpaperFromTrialBalance({
      company: pmResico,
      ejercicio: 2026,
      periodo: 6,
      parameters: makeParams(pmResico.id),
      trialBalance: makeSeedTrialBalance(pmResico.id),
      cfdis,
      fixedAssets
    });
    // Debe reincorporar únicamente fa_i04 (60,000 * 30% / 12 = 1,500 mensual + factor INPC) sin duplicar fa_dup
    expect(wpWithAssets.isrProvisional.deduccionesAutorizadasPeriodo).toBeGreaterThan(23_400);
    expect(wpWithAssets.isrProvisional.deduccionesAutorizadasPeriodo).toBeLessThan(23_700);

    // Fallback a 601-01-006 si no hay fixedAssets ni 613*
    const tbWith601Dep = makeSeedTrialBalance(pmResico.id).map((a) =>
      a.code === '601-01-006'
        ? { ...a, periodCharges: 950, finalBalance: 950 }
        : a
    );
    const wpFallback = computeFiscalWorkpaperFromTrialBalance({
      company: pmResico,
      ejercicio: 2026,
      periodo: 6,
      parameters: makeParams(pmResico.id),
      trialBalance: tbWith601Dep,
      cfdis
    });
    expect(wpFallback.isrProvisional.deduccionesAutorizadasPeriodo).toBe(22_950);
  });

  test('2. Neteo 216-* (créditos - cargos, mín 0) y exclusión de 110-01-001 / 113-03-001 sobre 113-02-001', () => {
    const pm = makeCompany({ regimenFiscal: '601' });
    const tb = makeSeedTrialBalance(pm.id).map((a) => {
      if (a.code === '216-01-004') {
        // Nota de crédito dejó cargos > créditos -> debe netear a 0, nunca negativo
        return { ...a, periodCredits: 1_000, periodCharges: 1_400, finalBalance: 0 };
      }
      if (a.code === '216-01-006') {
        // Asimilados 216.02 con cargo parcial por NC: 3,500 - 500 = 3,000
        return { ...a, periodCredits: 3_500, periodCharges: 500, finalBalance: 3_000 };
      }
      if (a.code === '113-02-001') {
        // 113-02-001 con 2,000 reales de ISR retenido + 700 contaminados (subsidio/local)
        return { ...a, periodCharges: 2_700, finalBalance: 2_700 };
      }
      if (a.code === '110-01-001' || a.code === '113-03-001') {
        return { ...a, periodCharges: 900, finalBalance: 900 };
      }
      return a;
    });

    const periodPolizas: Poliza[] = [
      {
        id: 'pol_113_mix',
        companyId: pm.id,
        ejercicio: 2026,
        periodo: 6,
        tipo: 'EGRESO',
        folio: 10,
        fecha: '2026-06-30',
        concepto: 'Nómina y retención local',
        totalCargos: 2_700,
        totalAbonos: 2_700,
        cfdiUuid: null,
        origin: 'MANUAL',
        isBalanced: true,
        createdAt: '2026-06-30T00:00:00Z',
        movements: [
          {
            id: 'm1',
            polizaId: 'pol_113_mix',
            accountId: 'acc_113-02-001',
            accountCode: '113-02-001',
            accountName: 'ISR a Favor',
            referencia: 'N-1',
            concepto: 'Subsidio al empleo aplicado',
            cargo: 450,
            abono: 0,
            cfdiUuid: null
          },
          {
            id: 'm2',
            polizaId: 'pol_113_mix',
            accountId: 'acc_113-02-001',
            accountCode: '113-02-001',
            accountName: 'ISR a Favor',
            referencia: 'L-1',
            concepto: 'Impuesto local retenido',
            cargo: 250,
            abono: 0,
            cfdiUuid: null
          },
          {
            id: 'm3',
            polizaId: 'pol_113_mix',
            accountId: 'acc_113-02-001',
            accountCode: '113-02-001',
            accountName: 'ISR a Favor',
            referencia: 'I-1',
            concepto: 'ISR retenido por cliente',
            cargo: 2_000,
            abono: 0,
            cfdiUuid: null
          }
        ]
      }
    ];

    const wp = computeFiscalWorkpaperFromTrialBalance({
      company: pm,
      ejercicio: 2026,
      periodo: 6,
      parameters: makeParams(pm.id, { coeficienteUtilidad: 0.2 }),
      trialBalance: tb,
      cfdis: [],
      periodPolizas
    });

    expect(wp.resumenLineaCapturaSat.retencionesIsrPorEnterar).toBe(3_000);
    expect(wp.retencionesDesglose?.some((r) => r.code === '216-01-004')).toBe(false);
    const asimilados = wp.retencionesDesglose?.find((r) => r.code === '216-01-006');
    expect(asimilados?.satGroupCode).toBe('216.02');
    expect(asimilados?.amount).toBe(3_000);
    // Subsidio ($450) e Impuesto local ($250) descontados de 113-02-001; 110-01-001 y 113-03-001 no contaminan
    expect(wp.isrProvisional.isrRetenidoMesActual).toBe(2_000);
  });

  test('3. Provisión SAT con roundArt20Cff ajusta centavos a 801-01-002 sin abono comodín a 119-01-001', () => {
    const pm = makeCompany({ regimenFiscal: '601' });
    const accounts = makeSeedTrialBalance(pm.id).map((a) =>
      a.code === '118-01-001' ? { ...a, periodCharges: 3_000, finalBalance: 3_000 } : a
    );
    const wp = computeFiscalWorkpaper({
      company: pm,
      ejercicio: 2026,
      periodo: 6,
      parameters: makeParams(pm.id, { coeficienteUtilidad: 0.1 }),
      ingresosPeriodo: 100_000,
      ingresosAcumuladosEjercicio: 100_000.40,
      deduccionesAutorizadasPeriodo: 0,
      ivaTrasladadoCobrado: 5_000.40,
      ivaAcreditablePagado: 4_000,
      isrRetenidoFavorPeriodo: 0,
      ivaRetenidoFavorPeriodo: 0,
      isrRetenidoPorPagar: 0,
      ivaRetenidoPorPagar: 0,
      usdCfdis: []
    });

    const movs = buildTaxProvisionMovements(wp, accounts, 6, 2026, {
      capIva118ToBookBalance: true,
      roundArt20Cff: true
    });

    // Jamás debe generar abono comodín a 119-01-001 aunque 118-01-001 (3,000) < ivaAcreditablePagado (4,000)
    expect(movs.some((m) => m.accountCode === '119-01-001')).toBe(false);
    expect(movs.find((m) => m.accountCode === '118-01-001')?.abono).toBe(3_000);
    // 5,000.40 - 3,000 = 2,000.40 -> roundArt20Cff => 2,000 a 213-01-001 y 0.40 de ajuste en 801-01-002
    expect(movs.find((m) => m.accountCode === '213-01-001')?.abono).toBe(2_000);
    const round801 = movs.filter((m) => m.accountCode === '801-01-002');
    expect(round801.length).toBeGreaterThan(0);
    expect(round801.some((m) => Math.abs(m.abono - 0.4) < 0.001)).toBe(true);
    const totalCargos = movs.reduce((s, m) => s + m.cargo, 0);
    const totalAbonos = movs.reduce((s, m) => s + m.abono, 0);
    expect(Math.round(totalCargos * 100)).toBe(Math.round(totalAbonos * 100));
  });

  test('4. DIOT 54 campos: clave 87 en tercero 15, Frontera Sur 8%, no acreditable, ObjetoImp 01, Col 13<=12, múltiples XEXX y 208 reconstruido', () => {
    expect(normalizeDiotTipoOperacion('85', '15')).toBe('87');
    expect(normalizeDiotTipoOperacion('03', '15')).toBe('87');

    // Frontera Sur 8% + IVA no acreditable (deductiblePct=50, prorationFactor=0.8) + ObjetoImp='01'
    const docSur = makeCfdi({
      id: 'c_sur',
      uuid: 'EEEE5555-5555-4555-8555-555555555555',
      direction: 'RECIBIDO',
      emisorRfc: 'SUR010101AA1',
      emisorNombre: 'Proveedor Frontera Sur',
      subtotal: 10_000,
      ivaTrasladado: 800,
      total: 10_800,
      deductiblePct: 50,
      taxBreakdown: { base16: 0, iva16: 0, base8: 10_000, iva8: 800, base0: 0, baseExento: 0, ieps: 0 }
    });
    const amtSur = resolveDiotDocAmounts(docSur, undefined, { prorationFactor: 0.8, tipoOperacion: '85' });
    expect(amtSur.iva8Mxn).toBeCloseTo(320, 2); // 800 * 0.5 * 0.8
    expect(amtSur.ivaNoAcreditable8).toBeCloseTo(400, 2);
    expect(amtSur.ivaNoAcreditable8Prorrata).toBeCloseTo(80, 2);

    const lineSur = buildDiot54BatchLine({
      rfc: 'SUR010101AA1',
      nombre: 'Proveedor Frontera Sur',
      tipoTercero: '04',
      tipoOperacion: '85',
      regionFronteriza: 'SUR',
      actosPagados16: 0,
      actosPagados8: 10_000,
      ivaAcreditable16: 0,
      ivaAcreditable8: amtSur.iva8Mxn,
      ivaNoAcreditable8: amtSur.ivaNoAcreditable8,
      ivaNoAcreditable8Prorrata: amtSur.ivaNoAcreditable8Prorrata,
      ivaRetenido: 0,
      actosNoObjeto: 2_500
    }).split('|');
    expect(lineSur.length).toBe(54);
    expect(lineSur[9]).toBe('10000'); // Frontera Sur 8%
    expect(lineSur[7]).toBe(''); // No Norte
    expect(lineSur[19]).toBe('320'); // IVA acreditable FS 8%
    expect(lineSur[31]).toBe('400'); // IVA no acreditable FS 8%
    expect(lineSur[32]).toBe('80'); // IVA no acreditable FS 8% prorrata
    expect(lineSur[51]).toBe('2500'); // Actos No Objeto (ObjetoImp="01")

    const docNoObj = makeCfdi({
      id: 'c_noobj',
      uuid: 'FFFF6666-6666-4666-8666-666666666666',
      direction: 'RECIBIDO',
      emisorRfc: 'XEXX010101000',
      emisorNombre: 'Cloud Foreign Inc',
      subtotal: 1_500,
      ivaTrasladado: 0,
      total: 1_500,
      taxBreakdown: { base16: 0, iva16: 0, base8: 0, iva8: 0, base0: 0, baseExento: 1_500, ieps: 0, objetoImp: '01' }
    });
    const amtNoObj = resolveDiotDocAmounts(docNoObj, undefined, { isForeign: true });
    expect(amtNoObj.actosNoObjetoExtranjero).toBe(1_500);

    // Validación Col 13 <= Col 12 en NC
    const ncExceedLine = buildDiot54BatchLine({
      rfc: 'PRO010101AA1',
      nombre: 'Proveedor NC Excedida',
      tipoTercero: '04',
      tipoOperacion: '85',
      actosPagados16: 1_000,
      devolucionesMxn: 2_500,
      ivaAcreditable16: 160,
      ivaRetenido: 0
    });
    const warnings = validateDiotBatchLines([{ rfc: 'PRO010101AA1', nombre: 'Proveedor NC Excedida', batchLine: ncExceedLine }]);
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.message).toContain('Campo 13');

    // Múltiples extranjeros XEXX010101000 + reconstrucción IVA trasladado post-provisión
    const company = makeCompany({ regimenFiscal: '601' });
    const tbPostProv = makeSeedTrialBalance(company.id).map((a) => {
      if (a.code === '208-01-001') return { ...a, periodCredits: 4_800, periodCharges: 4_800, finalBalance: 0 };
      if (a.code === '213-01-001') return { ...a, periodCredits: 4_800, finalBalance: 4_800 };
      return a;
    });
    const thirdParties: ThirdPartyRecord[] = [
      {
        id: 'tp1', companyId: company.id, rfc: 'XEXX010101000', nombre: 'AWS EMEA SARL', rol: 'PROVEEDOR',
        tipoTerceroDiot: '05', tipoOperacionDiot: '85', idFiscal: 'LU111', pais: 'LUX',
        cuentaOperacionCode: '601-01-001', cuentaContrapartidaCode: '201-01-001', tasaIvaDefault: 0, estatus69B: 'LIMPIO', updatedAt: '2026-06-01T00:00:00Z'
      },
      {
        id: 'tp2', companyId: company.id, rfc: 'XEXX010101000', nombre: 'GITHUB INC', rol: 'PROVEEDOR',
        tipoTerceroDiot: '05', tipoOperacionDiot: '85', idFiscal: 'US222', pais: 'USA',
        cuentaOperacionCode: '601-01-001', cuentaContrapartidaCode: '201-01-001', tasaIvaDefault: 0, estatus69B: 'LIMPIO', updatedAt: '2026-06-01T00:00:00Z'
      }
    ];
    const foreignCfdis: CfdiDocument[] = [
      makeCfdi({ id: 'fx1', uuid: 'EXT-AWS-1', direction: 'RECIBIDO', emisorRfc: 'XEXX010101000', emisorNombre: 'AWS EMEA SARL', isForeignNoCfdi: true, subtotal: 5_000, ivaTrasladado: 0, total: 5_000, polizaId: null }),
      makeCfdi({ id: 'fx2', uuid: 'EXT-GH-2', direction: 'RECIBIDO', emisorRfc: 'XEXX010101000', emisorNombre: 'GITHUB INC', isForeignNoCfdi: true, subtotal: 3_000, ivaTrasladado: 0, total: 3_000, polizaId: null })
    ];
    const diot = computeDiotReportData({
      company,
      ejercicio: 2026,
      periodo: 6,
      cfdis: foreignCfdis,
      polizaIdsInPeriod: new Set<string>(),
      trialBalance: tbPostProv,
      thirdParties
    });
    expect(diot.rows.length).toBe(2);
    expect(diot.totals.ivaTrasladadoCobrado).toBe(4_800);
  });
});

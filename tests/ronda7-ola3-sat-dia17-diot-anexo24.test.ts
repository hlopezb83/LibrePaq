import './setup-test-db';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  createCompanyRecord,
  deleteCompanyRecord,
  getTaxParameters,
  initDatabase,
  saveTaxParameters
} from '../src/server/db';
import { BASE_COMPANY_ACCOUNTS } from '../src/shared/catalogs/base-accounts.seed';
import { computeAnnualProvisionalPayments } from '../src/shared/engine/annual-tax-balances.helper';
import {
  computeAnnualTaxSummary,
  getOfficialUmaAnual,
  type AnnualTaxMonthlyBalance
} from '../src/shared/engine/annual-tax.engine';
import { computeCashBasisFiscalSummary } from '../src/shared/engine/cash-basis-fiscal.engine';
import { buildDiot54BatchLine } from '../src/shared/engine/diot-txt';
import { computeDiotReportData } from '../src/shared/engine/diot.engine';
import { computeFiscalWorkpaperFromTrialBalance } from '../src/shared/engine/fiscal-trial-balance.engine';
import { computeFiscalWorkpaper } from '../src/shared/engine/fiscal.engine';
import { buildSatDypCasillas, roundArt20Cff } from '../src/shared/engine/sat-dyp-formatter';
import { buildTaxProvisionMovements } from '../src/shared/engine/tax-provision.engine';
import {
  checkRfc69BStatus,
  decodeSat69BCsvBytes,
  getLoaded69BDatabase,
  getLoaded69BMeta,
  reset69BDatabaseCache,
  save69BDatabase
} from '../src/shared/sat-69b';
import {
  buildSatAnexo24Xml,
  hasEmptyAnexo24Body,
  isValidSatNumOrden,
  isValidSatNumTramite
} from '../src/shared/sat-anexo24';
import {
  getInpcForIsoDate,
  getLatestPublishedInpc,
  getOfficialInpc
} from '../src/shared/sat-inpc-catalog';
import type {
  AccountWithBalance,
  CfdiDocument,
  Company,
  Poliza,
  ThirdPartyRecord
} from '../src/shared/types';

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'comp_r7_o3',
    rfc: 'R7O260101AB1',
    name: 'Empresa Ronda 7 Ola 3 S.A. de C.V.',
    regimenFiscal: '601',
    codigoPostal: '06700',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 6,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeAcc(
  code: string,
  name: string,
  type: AccountWithBalance['type'],
  nature: AccountWithBalance['nature'],
  finalBalance: number,
  satGroupCode: string,
  extra: Partial<AccountWithBalance> = {}
): AccountWithBalance {
  return {
    id: `acc_${code}`,
    companyId: 'comp_r7_o3',
    code,
    name,
    parentCode: null,
    type,
    nature,
    level: 2,
    isAffectable: true,
    satGroupCode,
    currency: 'MXN',
    initialBalance: 0,
    initialBalanceComputed: 0,
    periodCharges: nature === 'DEUDORA' ? Math.max(0, finalBalance) : 0,
    periodCredits: nature === 'ACREEDORA' ? Math.max(0, finalBalance) : 0,
    finalBalance,
    ...extra
  };
}

function makeSeedTrialBalance(companyId = 'comp_r7_o3'): AccountWithBalance[] {
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

function makeCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_1',
    companyId: 'comp_r7_o3',
    uuid: '11111111-1111-4111-8111-111111111111',
    fecha: '2026-06-15',
    tipoComprobante: 'I',
    direction: 'EMITIDO',
    serie: 'A',
    folio: '1',
    emisorRfc: 'R7O260101AB1',
    emisorNombre: 'Empresa Ronda 7',
    receptorRfc: 'CLI010101AA1',
    receptorNombre: 'Cliente S.A.',
    conceptoPrincipal: 'Servicios profesionales',
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
    polizaId: null,
    xmlRaw: '<cfdi:Comprobante/>',
    ...overrides
  };
}

const createdCompanyIds: string[] = [];

beforeAll(() => {
  initDatabase();
});

afterAll(() => {
  for (const id of createdCompanyIds) {
    try {
      deleteCompanyRecord(id);
    } catch {
      // ignore cleanup
    }
  }
});

describe('Ronda 7 Ola 3 — INPC Oficial INEGI, Día 17, DyP Art. 20 CFF, DIOT, 69-B, Anexo 24 & Anual', () => {
  test('1. INPC Oficial INEGI 2024/2025/2026 y anclas históricas 2015–2019', () => {
    expect(getOfficialInpc(2024, 12)).toBe(137.949);
    expect(getOfficialInpc(2025, 12)).toBe(143.042);
    expect(getOfficialInpc(2026, 1)).toBe(143.588);
    expect(getOfficialInpc(2015, 1)).toBe(87.110);
    expect(getInpcForIsoDate('2017-03-15')).toBe(94.722);
    expect(getInpcForIsoDate('2012-05-10')).toBe(87.110);
    expect(getInpcForIsoDate('2028-12-01')).toBe(getLatestPublishedInpc());
  });

  test('2. roundArt20Cff redondea <=0.50 hacia abajo y >0.50 hacia arriba (enteros SAT DyP)', () => {
    expect(roundArt20Cff(100.50)).toBe(100);
    expect(roundArt20Cff(100.51)).toBe(101);
    expect(roundArt20Cff(10050, { isCents: true })).toBe(100);
    expect(roundArt20Cff(10051, { isCents: true })).toBe(101);
    expect(roundArt20Cff(0.50)).toBe(0);
    expect(roundArt20Cff(0.51)).toBe(1);
    expect(roundArt20Cff(-250.50)).toBe(-250);
    expect(roundArt20Cff(-250.51)).toBe(-251);
  });

  test('3. Cash-Basis Día 17: fechaPago en REP/Nómina, Tipo N isrRetenido, activos I0* excluidos, deductiblePct, PPD RESICO y PF 612', () => {
    const pf612 = makeCompany({ rfc: 'GAPA850101AB1', regimenFiscal: '612' });
    const cfdis: CfdiDocument[] = [
      makeCfdi({
        id: 'c_ing',
        uuid: 'U-ING-1',
        fecha: '2026-06-10',
        subtotal: 100_000,
        ivaTrasladado: 16_000,
        isrRetenido: 1_000,
        total: 115_000
      }),
      makeCfdi({
        id: 'c_orig_may',
        uuid: 'U-ORIG-MAY',
        fecha: '2026-05-10',
        metodoPago: 'PPD',
        formaPago: '99',
        subtotal: 10_000,
        ivaTrasladado: 1_600,
        total: 11_600
      }),
      makeCfdi({
        id: 'c_rep_may',
        uuid: 'U-REP-MAY',
        tipoComprobante: 'P',
        direction: 'EMITIDO',
        fecha: '2026-06-02',
        fechaPago: '2026-05-31',
        subtotal: 0,
        ivaTrasladado: 1_600,
        total: 0,
        relatedDocs: [
          {
            idDocumento: 'U-ORIG-MAY',
            numParcialidad: 1,
            impSaldoAnt: 11_600,
            impPagado: 11_600,
            impSaldoInsoluto: 0,
            monedaDr: 'MXN'
          }
        ]
      }),
      makeCfdi({
        id: 'c_af',
        uuid: 'U-AF-1',
        direction: 'RECIBIDO',
        fecha: '2026-06-12',
        emisorRfc: 'PRO010101AA1',
        receptorRfc: pf612.rfc,
        usoCfdi: 'I04',
        subtotal: 50_000,
        ivaTrasladado: 8_000,
        total: 58_000
      }),
      makeCfdi({
        id: 'c_gasto',
        uuid: 'U-GAS-1',
        direction: 'RECIBIDO',
        fecha: '2026-06-14',
        emisorRfc: 'PRO010101AA1',
        receptorRfc: pf612.rfc,
        usoCfdi: 'G03',
        deductiblePct: 60,
        subtotal: 10_000,
        ivaTrasladado: 1_600,
        total: 11_600
      }),
      makeCfdi({
        id: 'c_nom',
        uuid: 'U-NOM-1',
        tipoComprobante: 'N',
        direction: 'EMITIDO',
        fecha: '2026-06-30',
        fechaPago: '2026-06-30',
        subtotal: 20_000,
        ivaTrasladado: 0,
        isrRetenido: 2_500,
        total: 17_500
      })
    ];

    const cash = computeCashBasisFiscalSummary({
      company: pf612,
      ejercicio: 2026,
      periodo: 6,
      cfdis
    });
    expect(cash.ingresosPeriodo).toBe(100_000);
    expect(cash.ingresosAcumulados).toBe(110_000);
    expect(cash.deduccionesPeriodo).toBe(26_000);
    expect(cash.isrRetenidoPorPagarPeriodo).toBe(2_500);
    expect(cash.cashBasisSummary.isrRetenidoFavorAcumulado).toBe(1_000);

    const wpPf612 = computeFiscalWorkpaperFromTrialBalance({
      company: pf612,
      ejercicio: 2026,
      periodo: 6,
      trialBalance: makeSeedTrialBalance(pf612.id),
      parameters: {
        companyId: pf612.id,
        ejercicio: 2026,
        periodo: 6,
        coeficienteUtilidad: 0,
        pagosProvisionalesAnteriores: 0,
        perdidasFiscalesPendientes: 0,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 19,
        ptuPagadaEjercicio: 5_000
      },
      cfdis
    });
    expect(wpPf612.isrProvisional.isrRetenidoPeriodo).toBe(1_000);
    expect(wpPf612.isrProvisional.ptuPagadaAplicada).toBe(5_000);

    const resicoPm = makeCompany({ rfc: 'RPM260101AA1', regimenFiscal: '626' });
    const tbCon401 = [
      makeAcc('401-01-001', 'Ventas Crédito', 'INGRESOS', 'ACREEDORA', 80_000, '401.01')
    ];
    const wpResicoPpd = computeFiscalWorkpaperFromTrialBalance({
      company: resicoPm,
      ejercicio: 2026,
      periodo: 6,
      trialBalance: tbCon401,
      parameters: {
        companyId: resicoPm.id,
        ejercicio: 2026,
        periodo: 6,
        coeficienteUtilidad: 0,
        pagosProvisionalesAnteriores: 0,
        perdidasFiscalesPendientes: 0,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 19
      },
      cfdis: [
        makeCfdi({
          uuid: 'U-PPD-ONLY',
          metodoPago: 'PPD',
          formaPago: '99',
          subtotal: 80_000,
          ivaTrasladado: 12_800,
          total: 92_800
        })
      ]
    });
    expect(wpResicoPpd.isrProvisional.ingresosPeriodo).toBe(0);
    expect(wpResicoPpd.ivaDefinitivo.ivaTrasladadoCobrado).toBe(0);
  });

  test('4. Día 17: saldoFavorIvaMes separado, PTU PM 601 (mes-4)/8, 216.11 IMSS excluida, tax-provision 601-01-012 y 118 cap', () => {
    const pm = makeCompany({ regimenFiscal: '601' });
    const wp = computeFiscalWorkpaper({
      company: pm,
      ejercicio: 2026,
      periodo: 6,
      parameters: {
        companyId: pm.id,
        ejercicio: 2026,
        periodo: 6,
        coeficienteUtilidad: 0.2,
        pagosProvisionalesAnteriores: 0,
        perdidasFiscalesPendientes: 0,
        saldoFavorIvaAnterior: 10_000,
        tipoCambioDofCierre: 19,
        ptuPagadaEjercicio: 40_000
      },
      ingresosPeriodo: 200_000,
      ingresosAcumuladosEjercicio: 1_000_000,
      deduccionesAutorizadasPeriodo: 0,
      ivaTrasladadoCobrado: 16_000,
      ivaAcreditablePagado: 25_000,
      isrRetenidoFavorPeriodo: 0,
      ivaRetenidoFavorPeriodo: 0,
      isrRetenidoPorPagar: 0,
      ivaRetenidoPorPagar: 0,
      usdCfdis: []
    });
    expect(wp.isrProvisional.ptuPagadaAplicada).toBe(10_000);
    expect(wp.ivaDefinitivo.saldoFavorIvaMes).toBe(9_000);
    expect(wp.ivaDefinitivo.saldoFavorIvaAplicado).toBe(0);
    expect(wp.ivaDefinitivo.saldoFavorIvaRemanente).toBe(19_000);

    const casillas = buildSatDypCasillas(wp, 2026, 6);
    expect(casillas.find((c) => c.id === 'iva-favor-mes')?.valuePesos).toBe(9_000);

    const seedWithImss = makeSeedTrialBalance(pm.id).map((a) => {
      if (a.code === '216-01-001') return { ...a, periodCredits: 4_000, finalBalance: 4_000 };
      if (a.satGroupCode === '216.11' || a.code === '211-01-001') {
        return {
          ...a,
          satGroupCode: '216.11',
          name: 'Retenciones de IMSS a los trabajadores',
          periodCredits: 9_999,
          finalBalance: 9_999
        };
      }
      return a;
    });
    const wpImss = computeFiscalWorkpaperFromTrialBalance({
      company: pm,
      ejercicio: 2026,
      periodo: 6,
      trialBalance: seedWithImss,
      parameters: {
        companyId: pm.id,
        ejercicio: 2026,
        periodo: 6,
        coeficienteUtilidad: 0.1,
        pagosProvisionalesAnteriores: 0,
        perdidasFiscalesPendientes: 0,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 19
      },
      cfdis: []
    });
    expect(wpImss.resumenLineaCapturaSat.retencionesIsrPorEnterar).toBe(4_000);

    const accountsProv = makeSeedTrialBalance(pm.id).map((a) => {
      if (a.code === '118-01-001') return { ...a, finalBalance: 3_000, periodCharges: 3_000 };
      return a;
    });
    const wpProv = computeFiscalWorkpaper({
      company: pm,
      ejercicio: 2026,
      periodo: 6,
      parameters: {
        companyId: pm.id,
        ejercicio: 2026,
        periodo: 6,
        coeficienteUtilidad: 0,
        pagosProvisionalesAnteriores: 0,
        perdidasFiscalesPendientes: 0,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 19
      },
      ingresosPeriodo: 100_000,
      ingresosAcumuladosEjercicio: 100_000,
      deduccionesAutorizadasPeriodo: 0,
      ivaTrasladadoCobrado: 5_000.40,
      ivaAcreditablePagado: 4_000,
      isrRetenidoFavorPeriodo: 0,
      ivaRetenidoFavorPeriodo: 0,
      isrRetenidoPorPagar: 0,
      ivaRetenidoPorPagar: 0,
      usdCfdis: [],
      ivaBreakdown: {
        base16: 31_252.5,
        base8: 0,
        base0: 0,
        baseExento: 0,
        iepsAcreditable: 0,
        prorationFactor: 0.8,
        ivaAcreditableSinProrrateo: 5_000,
        ivaAcreditableProrrateado: 4_000
      }
    });
    const movs = buildTaxProvisionMovements(wpProv, accountsProv, 6, 2026, {
      capIva118ToBookBalance: true,
      roundArt20Cff: true
    });
    const total118 = movs.filter((m) => m.accountCode === '118-01-001').reduce((s, m) => s + m.abono, 0);
    expect(total118).toBe(3_000);
    expect(movs.some((m) => m.accountCode === '119-01-001')).toBe(false);
    expect(movs.some((m) => m.accountCode === '601-01-012')).toBe(false);
    expect(movs.find((m) => m.accountCode === '213-01-001')?.abono).toBe(2_000);
  });

  test('5. Carryforward SQLite tax_parameters desde periodo inmediato anterior', () => {
    const comp = createCompanyRecord({
      name: 'Carryforward S.A.',
      rfc: 'CAR260101AA1',
      regimenFiscal: '601',
      codigoPostal: '06700',
      currentYear: 2026,
      currentPeriod: 6
    });
    createdCompanyIds.push(comp.id);
    saveTaxParameters(comp.id, 2026, {
      periodo: 4,
      coeficienteUtilidad: 0.185,
      pagosProvisionalesAnteriores: 45_000,
      perdidasFiscalesPendientes: 12_000,
      saldoFavorIvaAnterior: 3_200,
      ptuPagadaEjercicio: 18_000
    });
    const juneParams = getTaxParameters(comp.id, 2026, 6);
    expect(juneParams.coeficienteUtilidad).toBe(0.185);
    expect(juneParams.pagosProvisionalesAnteriores).toBe(45_000);
    expect(juneParams.perdidasFiscalesPendientes).toBe(12_000);
    expect(juneParams.saldoFavorIvaAnterior).toBe(3_200);
    expect(juneParams.ptuPagadaEjercicio).toBe(18_000);
  });

  test('6. DIOT 54 campos (Field 47 vs 28–30, ZZZ Campo 7, XEXX distintos, 208.01 neto) & 69-B Windows-1252 Ñ', () => {
    const lineDom = buildDiot54BatchLine({
      rfc: 'PRO010101AA1',
      nombre: 'Proveedor Nacional',
      tipoTercero: '04',
      tipoOperacion: '03',
      actosPagados16: 10_000,
      ivaAcreditable16: 1_200,
      ivaNoAcreditable16: 400,
      ivaRetenido: 0
    }).split('|');
    expect(lineDom[27]).toBe('');
    expect(lineDom[35]).toBe('400');
    expect(lineDom[46]).toBe('');

    const lineExtDeu = buildDiot54BatchLine({
      rfc: 'XEXX010101000',
      nombre: 'SAP SE',
      idFiscal: 'DE123',
      pais: 'DEU',
      jurisdiccionFiscal: 'ALEMANIA',
      tipoTercero: '05',
      tipoOperacion: '85',
      actosPagados16: 0,
      actosExentos: 5_000,
      ivaAcreditable16: 0,
      ivaRetenido: 0
    }).split('|');
    expect(lineExtDeu[6]).toBe('');

    const lineExtZzz = buildDiot54BatchLine({
      rfc: 'XEXX010101000',
      nombre: 'Offshore Ltd',
      idFiscal: 'ZZ-99',
      pais: 'ZZZ',
      jurisdiccionFiscal: 'ISLAS CAIMAN',
      tipoTercero: '05',
      tipoOperacion: '85',
      actosPagados16: 0,
      actosExentos: 2_000,
      ivaAcreditable16: 0,
      ivaRetenido: 0
    }).split('|');
    expect(lineExtZzz[6]).toBe('ISLAS CAIMAN');

    const comp = makeCompany();
    const tps: ThirdPartyRecord[] = [
      {
        id: 'tp1',
        companyId: comp.id,
        rfc: 'XEXX010101000',
        nombre: 'AWS',
        idFiscal: 'US-AWS',
        pais: 'USA',
        rol: 'PROVEEDOR',
        tipoTerceroDiot: '05',
        tipoOperacionDiot: '85',
        cuentaOperacionCode: '601-01-003',
        cuentaContrapartidaCode: '201-01-001',
        tasaIvaDefault: 0,
        estatus69B: 'LIMPIO',
        updatedAt: ''
      },
      {
        id: 'tp2',
        companyId: comp.id,
        rfc: 'XEXX010101000',
        nombre: 'Hetzner',
        idFiscal: 'DE-HETZ',
        pais: 'DEU',
        rol: 'PROVEEDOR',
        tipoTerceroDiot: '05',
        tipoOperacionDiot: '85',
        cuentaOperacionCode: '601-01-003',
        cuentaContrapartidaCode: '201-01-001',
        tasaIvaDefault: 0,
        estatus69B: 'LIMPIO',
        updatedAt: ''
      }
    ];
    const diot = computeDiotReportData({
      company: comp,
      ejercicio: 2026,
      periodo: 6,
      thirdParties: tps,
      cfdis: [
        makeCfdi({
          id: 'fx1',
          uuid: 'FX1',
          direction: 'RECIBIDO',
          emisorRfc: 'XEXX010101000',
          emisorNombre: 'AWS',
          polizaId: 'p1',
          subtotal: 1_000,
          ivaTrasladado: 0,
          total: 1_000
        }),
        makeCfdi({
          id: 'fx2',
          uuid: 'FX2',
          direction: 'RECIBIDO',
          emisorRfc: 'XEXX010101000',
          emisorNombre: 'Hetzner',
          polizaId: 'p2',
          subtotal: 2_000,
          ivaTrasladado: 0,
          total: 2_000
        })
      ],
      polizaIdsInPeriod: new Set(['p1', 'p2']),
      trialBalance: [
        makeAcc('208-01-001', 'IVA Cobrado', 'PASIVO', 'ACREEDORA', 1_200, '208.01', {
          periodCredits: 1_600,
          periodCharges: 400
        })
      ]
    });
    expect(diot.rows.length).toBe(2);
    expect(diot.totals.ivaTrasladadoCobrado).toBe(1_200);

    const win1252Bytes = new Uint8Array([
      ...Buffer.from('No.,RFC,Nombre,Situacion\n1,', 'latin1'),
      0x50, 0x45, 0xd1, 0x41, 0x38, 0x35, 0x30, 0x31, 0x30, 0x31, 0x41, 0x42, 0x31,
      ...Buffer.from(',PE', 'latin1'),
      0xd1,
      ...Buffer.from('A CONSULTORES,Definitivo\n', 'latin1')
    ]);
    const decoded = decodeSat69BCsvBytes(win1252Bytes);
    expect(decoded).toContain('PEÑA850101AB1');
    expect(decoded).toContain('PEÑA CONSULTORES');

    reset69BDatabaseCache();
    save69BDatabase([
      {
        rfc: 'PEÑA850101AB1',
        nombre: 'PEÑA CONSULTORES',
        situacion: 'DEFINITIVO',
        status: 'DEFINITIVO_EFOS',
        fechaOficio: 'OF-1',
        publicacionDof: '2026-01-01'
      }
    ]);
    expect(getLoaded69BDatabase().has('PEÑA850101AB1')).toBe(true);
    expect(checkRfc69BStatus('PEÑA850101AB1').isEfos).toBe(true);
    expect(getLoaded69BMeta()).toBeNull();
    reset69BDatabaseCache();
  });

  test('7. Anexo 24 v1.3: filtra nivel 1, regex estricto XSD, body vacío, dedup CompNal y sin cuentas bancarias ficticias', () => {
    expect(isValidSatNumOrden('ABC1234567/01')).toBe(true);
    expect(isValidSatNumOrden('ABC7234567/01')).toBe(false);
    expect(isValidSatNumTramite('DE202600000001')).toBe(true);
    expect(isValidSatNumTramite('DE1234567890')).toBe(false);

    const comp = makeCompany();
    const emptyCat = buildSatAnexo24Xml(comp, 2026, 6, 'catalogo', [
      makeAcc('100-00-000', 'ACTIVO', 'ACTIVO', 'DEUDORA', 0, '100', { level: 1, isAffectable: false })
    ]);
    expect(emptyCat.xml).not.toContain('NumCta="100-00-000"');
    expect(hasEmptyAnexo24Body('catalogo', emptyCat.xml)).toBe(true);

    const pol: Poliza = {
      id: 'p_dup',
      companyId: comp.id,
      tipo: 'EGRESO',
      folio: 9,
      fecha: '2026-06-15',
      ejercicio: 2026,
      periodo: 6,
      concepto: 'Transferencia SPEI proveedor',
      cfdiUuid: '11111111-2222-4333-8444-555555555555',
      origin: 'ADD_AUTO',
      totalCargos: 11_600,
      totalAbonos: 11_600,
      isBalanced: true,
      createdAt: '2026-06-15T00:00:00Z',
      movements: [
        { id: 'm1', polizaId: 'p_dup', accountId: 'a1', accountCode: '601-01-003', accountName: 'Servicios', referencia: '', concepto: 'Gasto', cargo: 10_000, abono: 0, cfdiUuid: null },
        { id: 'm2', polizaId: 'p_dup', accountId: 'a2', accountCode: '118-01-001', accountName: 'IVA Acred', referencia: '', concepto: 'IVA', cargo: 1_600, abono: 0, cfdiUuid: null },
        { id: 'm3', polizaId: 'p_dup', accountId: 'a3', accountCode: '102-01-001', accountName: 'BBVA', referencia: '', concepto: 'Transferencia SPEI', cargo: 0, abono: 11_600, cfdiUuid: null }
      ]
    };
    const pl = buildSatAnexo24Xml(comp, 2026, 6, 'polizas', [], [pol]);
    const compNalMatches = pl.xml.match(/<PLZ:CompNal\b/g) ?? [];
    expect(compNalMatches.length).toBe(1);
    expect(pl.xml).not.toContain('0000000000');
    expect(pl.xml).toContain('<PLZ:OtrMetodoPago MetPagoPol="03"');
  });

  test('8. Declaración Anual LISR: Art. 46 exclusiones, 213-01-002 sin doble conteo, noDeducibles en RESICO PM, PTU RESICO PF 113-G y tope Art. 151', () => {
    const monthlyBalances: AnnualTaxMonthlyBalance[] = Array.from({ length: 12 }, (_, idx) => ({
      periodo: idx + 1,
      accounts: [
        makeAcc('102-01-001', 'Bancos', 'ACTIVO', 'DEUDORA', 100_000, '102.01'),
        makeAcc('107-02-001', 'Deudores Socios', 'ACTIVO', 'DEUDORA', 300_000, '107.02'),
        makeAcc('213-01-002', 'ISR por Pagar', 'PASIVO', 'ACREEDORA', 80_000, '213.03'),
        makeAcc('210-01-001', 'Provisión Gastos', 'PASIVO', 'ACREEDORA', 60_000, '210.01'),
        makeAcc('201-01-001', 'Proveedores', 'PASIVO', 'ACREEDORA', 150_000, '201.01')
      ]
    }));

    const pmAnnual = computeAnnualTaxSummary({
      company: makeCompany({ regimenFiscal: '601' }),
      ejercicio: 2025,
      trialBalance: [makeAcc('401-01-001', 'Ventas', 'INGRESOS', 'ACREEDORA', 1_000_000, '401.01')],
      monthlyBalancesByPeriod: monthlyBalances,
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: {}
    });
    expect(pmAnnual.inflation.promedioCreditos).toBe(100_000);
    expect(pmAnnual.inflation.promedioDeudas).toBe(150_000);

    const paid = computeAnnualProvisionalPayments({
      accounts: [makeAcc('213-01-002', 'ISR', 'PASIVO', 'ACREEDORA', 0, '213.03')],
      movs: [
        { account_id: 'acc_213-01-002', cargo: 0, abono: 5_000, polizas: { company_id: 'c', ejercicio: 2025, periodo: 1 } },
        { account_id: 'acc_213-01-002', cargo: 5_000, abono: 0, polizas: { company_id: 'c', ejercicio: 2025, periodo: 2 } }
      ],
      ejercicio: 2025,
      taxParameterRows: []
    });
    expect(paid).toBe(5_000);

    const resicoPmAnnual = computeAnnualTaxSummary({
      company: makeCompany({ rfc: 'RPM260101AA1', regimenFiscal: '626' }),
      ejercicio: 2026,
      trialBalance: [
        makeAcc('801-01-002', 'No Deducibles', 'GASTOS', 'DEUDORA', 10_000, '601.74')
      ],
      monthlyBalancesByPeriod: [],
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: { noDeduciblesManual: 5_000 },
      cfdis: [
        makeCfdi({ id: 'r_i', uuid: 'RI1', fecha: '2026-06-01', direction: 'EMITIDO', subtotal: 200_000, ivaTrasladado: 32_000, total: 232_000 }),
        makeCfdi({ id: 'r_g', uuid: 'RG1', fecha: '2026-06-02', direction: 'RECIBIDO', emisorRfc: 'PRO010101AA1', receptorRfc: 'RPM260101AA1', subtotal: 50_000, ivaTrasladado: 8_000, total: 58_000 })
      ]
    });
    // 200k ingresos - (50k CFDIs deducibles - 5k manual) = 155k (no resta doblemente 801-01-002 sobre CFDIs pagados)
    expect(resicoPmAnnual.reconciliation.resultadoFiscal).toBe(155_000);

    const resicoPfAnnual = computeAnnualTaxSummary({
      company: makeCompany({ rfc: 'GAPA850101AB1', regimenFiscal: '626' }),
      ejercicio: 2026,
      trialBalance: [],
      monthlyBalancesByPeriod: [],
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: {},
      cfdis: [
        makeCfdi({ id: 'p_i', uuid: 'PI1', fecha: '2026-06-01', direction: 'EMITIDO', subtotal: 300_000, ivaTrasladado: 48_000, total: 348_000 }),
        makeCfdi({ id: 'p_g', uuid: 'PG1', fecha: '2026-06-02', direction: 'RECIBIDO', emisorRfc: 'PRO010101AA1', receptorRfc: 'GAPA850101AB1', subtotal: 120_000, ivaTrasladado: 19_200, total: 139_200 })
      ]
    });
    expect(resicoPfAnnual.determination.ingresosNominales).toBe(300_000);
    expect(resicoPfAnnual.determination.ptuBase).toBe(180_000);
    expect(resicoPfAnnual.determination.ptuPorPagar10Pct).toBe(18_000);

    const pfArt152 = computeAnnualTaxSummary({
      company: makeCompany({ rfc: 'GAPA850101AB1', regimenFiscal: '612' }),
      ejercicio: 2026,
      trialBalance: [],
      monthlyBalancesByPeriod: [],
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      inputs: { deduccionesPersonales: 250_000 },
      cfdis: [
        makeCfdi({ id: 'a_i', uuid: 'AI1', fecha: '2026-06-01', direction: 'EMITIDO', subtotal: 1_000_000, ivaTrasladado: 160_000, total: 1_160_000 }),
        makeCfdi({ id: 'a_g', uuid: 'AG1', fecha: '2026-06-02', direction: 'RECIBIDO', emisorRfc: 'PRO010101AA1', receptorRfc: 'GAPA850101AB1', subtotal: 200_000, ivaTrasladado: 32_000, total: 232_000 })
      ]
    });
    const uma2026 = getOfficialUmaAnual(2026);
    expect(uma2026).toBe(42794.64);
    expect(pfArt152.reconciliation.deduccionesPersonalesTope).toBe(150_000);
    expect(pfArt152.reconciliation.deduccionesPersonalesAplicadas).toBe(150_000);
    expect(pfArt152.reconciliation.resultadoFiscal).toBe(650_000);
  });
});

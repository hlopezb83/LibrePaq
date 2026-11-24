import { afterAll, describe, expect, test } from 'bun:test';
import { createCompanyRecord, deleteCompanyRecord } from '../src/server/repositories/companies.repo';
import { createAccountRecord } from '../src/server/repositories/accounts.repo';
import { createPolizaTransaction } from '../src/server/repositories/polizas-write.repo';
import { restoreCompanyBackupBundle } from '../src/server/repositories/backup-restore.repo';
import {
  acceptPendingInvitesRepo,
  inviteWorkspaceMemberRepo,
  getEffectiveCompanyRoleRepo
} from '../src/server/repositories/workspace-members.repo';
import { buildAutoPolizaPlan } from '../src/shared/engine/auto-poliza.engine';
import { computeNonIvaTaxCents } from '../src/shared/engine/auto-poliza-helpers';
import { computeFiscalWorkpaperFromTrialBalance } from '../src/shared/engine/fiscal-trial-balance.engine';
import { buildTaxProvisionMovements } from '../src/shared/engine/tax-provision.engine';
import { computeCashBasisFiscalSummary } from '../src/shared/engine/cash-basis-fiscal.engine';
import { computeDiotReportData } from '../src/shared/engine/diot.engine';
import { buildDiot54BatchLine } from '../src/shared/engine/diot-txt';
import { computeAnnualTaxSummary } from '../src/shared/engine/annual-tax.engine';
import {
  computeAnnualFixedAssetFiscalDeduction,
  computeAnnualProvisionalPayments
} from '../src/shared/engine/annual-tax-balances.helper';
import { computeFinancialStatementsData } from '../src/shared/engine/financial-reports.engine';
import { computeExtendedFinancialStatements } from '../src/shared/engine/extended-statements.engine';
import { computeThreeWayTieout } from '../src/shared/engine/three-way-tieout.engine';
import { buildDashboardKpisFromTrialBalance } from '../src/shared/engine/dashboard.engine';
import { computeCxcCxpAging } from '../src/shared/engine/cxc-cxp.engine';
import { computeFixedAssetWithDepreciation } from '../src/shared/engine/fixed-assets.engine';
import { computePayrollPeriodSummary } from '../src/shared/engine/payroll-summary.engine';
import { computeInventoryInputsFromMovements } from '../src/shared/engine/cost-of-sales.engine';
import { buildSatAnexo24Xml } from '../src/shared/sat-anexo24';
import { parseSat69BCsv } from '../src/shared/sat-69b-parser';
import { parseBankStatementCsv } from '../src/shared/csv-bank-parser';
import { parseCfdiXmlString } from '../src/shared/cfdi-xml';
import { parseSatCertificate } from '../src/shared/sat-certificate-parser';
import { extractCompanyFromCsfText } from '../src/shared/sat-csf-extractor';
import { sanitizeSpreadsheetText } from '../src/shared/date-utils';
import { inferTypeFromCode } from '../src/views/catalogo/catalogoMigrationParsers';
import { buildYearCloseMovements } from '../src/shared/engine/bank-and-closing.engine';
import { BASE_COMPANY_ACCOUNTS } from '../src/shared/catalogs/base-accounts.seed';
import { createMockCatalog } from '../src/shared/__tests__/test-helpers';
import {
  endSupportSession,
  isReadOnlySupportMode,
  setSupportActorAllowed,
  startSupportSession
} from '../src/lib/support-impersonation';
import { parseCfdiFull } from '../supabase/functions/sat-soap-sync/cfdi-full-parser';
import type {
  Account,
  AccountWithBalance,
  CfdiDocument,
  Company,
  FixedAssetRecord,
  Poliza,
  TaxParametersRecord
} from '../src/shared/types';

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'comp_r9',
    name: 'Empresa Ronda 9 SA de CV',
    rfc: 'ER9200101AA1',
    regimenFiscal: '601',
    codigoPostal: '06600',
    maskFormat: 'XXX-XX-XXX',
    currentYear: 2026,
    currentPeriod: 10,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeSeedTb(companyId = 'comp_r9'): AccountWithBalance[] {
  return BASE_COMPANY_ACCOUNTS.map((a, idx) => ({
    ...a,
    id: `acc_r9_${idx}_${a.code}`,
    companyId,
    initialBalance: a.initialBalance ?? 0,
    initialBalanceComputed: a.initialBalance ?? 0,
    periodCharges: 0,
    periodCredits: 0,
    finalBalance: a.initialBalance ?? 0
  }));
}

function makeCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_r9_1',
    companyId: 'comp_r9',
    uuid: '11111111-1111-4111-8111-111111111111',
    fecha: '2026-10-15T12:00:00',
    tipoComprobante: 'I',
    direction: 'RECIBIDO',
    serie: 'F',
    folio: '1',
    emisorRfc: 'PRO010101AA1',
    emisorNombre: 'Proveedor SA de CV',
    receptorRfc: 'ER9200101AA1',
    receptorNombre: 'Empresa Ronda 9 SA de CV',
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

function makeTaxParams(overrides: Partial<TaxParametersRecord> = {}): TaxParametersRecord {
  return {
    companyId: 'comp_r9',
    ejercicio: 2026,
    periodo: 2,
    coeficienteUtilidad: 0.2,
    pagosProvisionalesAnteriores: 0,
    perdidasFiscalesPendientes: 0,
    saldoFavorIvaAnterior: 0,
    tipoCambioDofCierre: 20,
    ptuPagadaEjercicio: 0,
    ...overrides
  };
}

const createdCompanyIds: string[] = [];

afterAll(() => {
  endSupportSession();
  setSupportActorAllowed(true);
  for (const id of createdCompanyIds) {
    try {
      deleteCompanyRecord(id);
    } catch {
      // ignore cleanup errors
    }
  }
});

describe('Ronda 9 — Business Logic, Fiscal SAT & Multi-Tenant Security Regression Suite', () => {
  test('1. Auto-Póliza: computeNonIvaTaxCents keeps balance with embedded IEPS + ISH; REP respects Arrendamiento 216.03, USD 216-02 FX & deductiblePct=0', () => {
    const { accounts } = createMockCatalog();
    const extraAccs: Account[] = [
      ...accounts,
      {
        id: 'acc-no-ded',
        code: '801-01-002',
        name: 'Gastos No Deducibles Sin Requisitos Fiscales',
        satGroupCode: '601.74',
        type: 'GASTOS',
        nature: 'DEUDORA',
        level: 3,
        parentCode: '801-00-000',
        isAffectable: true,
        currency: 'MXN',
        companyId: 'comp_r9',
        initialBalance: 0
      },
      {
        id: 'acc-216-03',
        code: '216-01-003',
        name: 'ISR Retenido Arrendamiento 10%',
        satGroupCode: '216.03',
        type: 'PASIVO',
        nature: 'ACREEDORA',
        level: 3,
        parentCode: '216-00-000',
        isAffectable: true,
        currency: 'MXN',
        companyId: 'comp_r9',
        initialBalance: 0
      },
      {
        id: 'acc-216-04',
        code: '216-01-004',
        name: 'ISR Retenido Servicios Profesionales 10%',
        satGroupCode: '216.04',
        type: 'PASIVO',
        nature: 'ACREEDORA',
        level: 3,
        parentCode: '216-00-000',
        isAffectable: true,
        currency: 'MXN',
        companyId: 'comp_r9',
        initialBalance: 0
      },
      {
        id: 'acc-216-02-01',
        code: '216-02-001',
        name: 'ISR Retenido PPD Pendiente de Pago',
        satGroupCode: '216.01',
        type: 'PASIVO',
        nature: 'ACREEDORA',
        level: 3,
        parentCode: '216-00-000',
        isAffectable: true,
        currency: 'MXN',
        companyId: 'comp_r9',
        initialBalance: 0
      },
      {
        id: 'acc-216-02-02',
        code: '216-02-002',
        name: 'IVA Retenido PPD Pendiente de Pago',
        satGroupCode: '216.10',
        type: 'PASIVO',
        nature: 'ACREEDORA',
        level: 3,
        parentCode: '216-00-000',
        isAffectable: true,
        currency: 'MXN',
        companyId: 'comp_r9',
        initialBalance: 0
      },
      {
        id: 'acc-216-iva',
        code: '216-01-002',
        name: 'IVA Retenido Pagado',
        satGroupCode: '216.10',
        type: 'PASIVO',
        nature: 'ACREEDORA',
        level: 3,
        parentCode: '216-00-000',
        isAffectable: true,
        currency: 'MXN',
        companyId: 'comp_r9',
        initialBalance: 0
      },
      {
        id: 'acc-fx-loss',
        code: '701-01-001',
        name: 'Pérdida Cambiaria',
        satGroupCode: '701.01',
        type: 'GASTOS',
        nature: 'DEUDORA',
        level: 3,
        parentCode: '601-00-000',
        isAffectable: true,
        currency: 'MXN',
        companyId: 'comp_r9',
        initialBalance: 0
      },
      {
        id: 'acc-fx-gain',
        code: '702-01-001',
        name: 'Utilidad Cambiaria',
        satGroupCode: '702.01',
        type: 'INGRESOS',
        nature: 'ACREEDORA',
        level: 3,
        parentCode: '401-00-000',
        isAffectable: true,
        currency: 'MXN',
        companyId: 'comp_r9',
        initialBalance: 0
      }
    ];

    const hotelCfdi = makeCfdi({
      subtotal: 1000,
      ivaTrasladado: 160,
      total: 1190,
      taxBreakdown: { base16: 1000, iva16: 160, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 80 },
      xmlRaw:
        '<cfdi:Comprobante Version="4.0" SubTotal="1000.00" Total="1190.00"><cfdi:Complemento><implocal:ImpuestosLocales TotaldeTraslados="30.00" TotaldeRetenciones="0.00"/></cfdi:Complemento></cfdi:Comprobante>'
    });
    expect(computeNonIvaTaxCents(hotelCfdi, 100000, 16000, 0, 0, 119000, 0)).toBe(3000);
    const hotelPlan = buildAutoPolizaPlan(hotelCfdi, extraAccs);
    expect(hotelPlan.isBalanced).toBe(true);
    expect(hotelPlan.totalCargo).toBe(1190);

    // Non-affectable counterOverride on unpaid PPD must NOT credit Bancos (102-01-001)
    const ppdInvalidOverride = makeCfdi({
      metodoPago: 'PPD',
      formaPago: '99',
      subtotal: 10000,
      ivaTrasladado: 1600,
      total: 11600
    });
    const ppdPlan = buildAutoPolizaPlan(ppdInvalidOverride, extraAccs, {
      counterAccountCode: '100-00-000'
    });
    expect(ppdPlan.isBalanced).toBe(true);
    expect(ppdPlan.movements.some((m) => m.accountCode === '102-01-001')).toBe(false);
    expect(ppdPlan.movements.some((m) => m.accountCode.startsWith('201-01-'))).toBe(true);

    // Arrendamiento REP uses original PPD metadata -> 216-01-003 (not Honorarios 216-01-004), and deductiblePct=0 skips 119->118
    const repArr = makeCfdi({
      tipoComprobante: 'P',
      direction: 'RECIBIDO',
      conceptoPrincipal: 'Pago',
      claveProdServ: '84111506',
      usoCfdi: 'CP01',
      metodoPago: 'PUE',
      formaPago: '03',
      moneda: 'MXN',
      subtotal: 0,
      ivaTrasladado: 1600,
      isrRetenido: 1000,
      ivaRetenido: 1066.67,
      total: 9533.33,
      relatedDocs: [
        {
          idDocumento: 'ARR-PPD-1',
          numParcialidad: 1,
          impSaldoAnt: 9533.33,
          impPagado: 9533.33,
          impSaldoInsoluto: 0,
          monedaDr: 'MXN',
          equivalenciaDr: 1
        }
      ]
    });
    const repPlan = buildAutoPolizaPlan(repArr, extraAccs, {
      relatedIsPpd: true,
      relatedPpdTotal: 9533.33,
      relatedPpdIsrRetenido: 1000,
      relatedPpdIvaRetenido: 1066.67,
      relatedDocsMetaByUuid: {
        'ARR-PPD-1': {
          tipoCambio: 1,
          moneda: 'MXN',
          conceptoPrincipal: 'Renta oficina marzo',
          claveProdServ: '80131500',
          totalMxn: 9533.33,
          isrRetenidoMxn: 1000,
          ivaRetenidoMxn: 1066.67
        }
      }
    });
    expect(repPlan.isBalanced).toBe(true);
    expect(repPlan.movements.some((m) => m.accountCode === '216-01-003' && m.abono === 1000)).toBe(true);
    expect(repPlan.movements.some((m) => m.accountCode === '216-01-004')).toBe(false);

    const repNoDedPlan = buildAutoPolizaPlan(
      makeCfdi({
        tipoComprobante: 'P',
        direction: 'RECIBIDO',
        metodoPago: 'PUE',
        formaPago: '03',
        subtotal: 0,
        ivaTrasladado: 160,
        total: 1160,
        relatedDocs: [
          {
            idDocumento: 'NODED-1',
            numParcialidad: 1,
            impSaldoAnt: 1160,
            impPagado: 1160,
            impSaldoInsoluto: 0,
            monedaDr: 'MXN',
            equivalenciaDr: 1
          }
        ]
      }),
      extraAccs,
      { deductiblePct: 0 }
    );
    expect(repNoDedPlan.movements.some((m) => m.accountCode === '118-01-001')).toBe(false);
    expect(repNoDedPlan.movements.some((m) => m.accountCode === '119-01-001')).toBe(false);

    // USD 216-02 historical FX clearing routes delta to 701/702
    const repUsdRet = buildAutoPolizaPlan(
      makeCfdi({
        tipoComprobante: 'P',
        direction: 'RECIBIDO',
        metodoPago: 'PUE',
        formaPago: '03',
        moneda: 'USD',
        tipoCambio: 20,
        subtotal: 0,
        ivaTrasladado: 0,
        isrRetenido: 100,
        ivaRetenido: 0,
        total: 900,
        relatedDocs: [
          {
            idDocumento: 'USD-PPD-1',
            numParcialidad: 1,
            impSaldoAnt: 900,
            impPagado: 900,
            impSaldoInsoluto: 0,
            monedaDr: 'USD',
            equivalenciaDr: 1
          }
        ]
      }),
      extraAccs,
      {
        relatedIsPpd: true,
        relatedPpdTotal: 16200,
        relatedPpdIsrRetenido: 1800,
        relatedOriginalTipoCambio: 18,
        relatedDocsMetaByUuid: {
          'USD-PPD-1': {
            tipoCambio: 18,
            moneda: 'USD',
            conceptoPrincipal: 'Honorarios USD',
            claveProdServ: '84111506',
            totalMxn: 16200,
            isrRetenidoMxn: 1800,
            ivaRetenidoMxn: 0
          }
        }
      }
    );
    expect(repUsdRet.isBalanced).toBe(true);
    expect(repUsdRet.movements.find((m) => m.accountCode === '216-02-001')?.cargo).toBe(1800);
    expect(repUsdRet.movements.find((m) => m.accountCode === '216-01-004')?.abono).toBe(2000);
    expect(repUsdRet.movements.find((m) => m.accountCode === '701-01-001')?.cargo).toBe(2000);
  });

  test('2. XML Parsers: Multi-Pago fechaPago separation + Edge parser literal > inside attribute', () => {
    const multiPagoXml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante Version="4.0" TipoDeComprobante="P" Fecha="2026-11-03T10:00:00" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="CLI010101AA1" Nombre="Cliente"/><cfdi:Receptor Rfc="ER9200101AA1" Nombre="Emp" UsoCFDI="CP01"/>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales MontoTotalPagos="35000.00"/>
      <pago20:Pago FechaPago="2026-10-28T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="10000.00">
        <pago20:DoctoRelacionado IdDocumento="OCT-1111-4111-8111-111111111111" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="10000.00" ImpPagado="10000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="01"/>
      </pago20:Pago>
      <pago20:Pago FechaPago="2026-11-02T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="25000.00">
        <pago20:DoctoRelacionado IdDocumento="NOV-2222-4222-8222-222222222222" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="25000.00" ImpPagado="25000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="01"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="REP-MULTI-4111-8111-111111111111"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
    const parsedMulti = parseCfdiXmlString(multiPagoXml);
    expect(parsedMulti.relatedDocs).toHaveLength(2);
    expect(parsedMulti.relatedDocs![0]?.fechaPago).toBe('2026-10-28');
    expect(parsedMulti.relatedDocs![1]?.fechaPago).toBe('2026-11-02');

    const gtXml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante Version="4.0" TipoDeComprobante="I" Fecha="2026-10-15T10:00:00" SubTotal="1500.00" Total="1500.00" Moneda="MXN" MetodoPago="PUE" FormaPago="03">
  <cfdi:Emisor Rfc="PRO010101AA1" Nombre="Proveedor"/><cfdi:Receptor Rfc="ER9200101AA1" Nombre="Empresa" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="43211500" Descripcion="CABLE > 10M" Cantidad="1" ValorUnitario="500.00" Importe="500.00" ObjetoImp="01"/>
    <cfdi:Concepto ClaveProdServ="43211500" Descripcion="RACK" Cantidad="1" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento><tfd:TimbreFiscalDigital UUID="GT-1111-4111-8111-111111111111"/></cfdi:Complemento>
</cfdi:Comprobante>`;
    const edgeParsed = parseCfdiFull(gtXml);
    expect(edgeParsed?.taxBreakdown?.baseExento).toBe(1500);
  });

  test('3. Tax Provision, Día 17 216-02 exclusion, Cash-Basis I04 REP & Art. 5 truncation, DIOT cols & XEXX separation', () => {
    const tb = makeSeedTb().map((a) => {
      if (a.code === '113-02-001') {
        return { ...a, initialBalanceComputed: 1000, periodCharges: 1000, periodCredits: 1000, finalBalance: 1000 };
      }
      if (a.code === '216-02-001') return { ...a, periodCredits: 1000, finalBalance: 1000 };
      if (a.code === '216-01-004') return { ...a, periodCredits: 500, finalBalance: 500 };
      if (a.code === '401-01-001') return { ...a, periodCredits: 50000, finalBalance: 50000 };
      return a;
    });

    const wp = computeFiscalWorkpaperFromTrialBalance({
      company: makeCompany({ regimenFiscal: '626', rfc: 'RPM260101AA1' }),
      ejercicio: 2026,
      periodo: 2,
      trialBalance: tb,
      cfdis: [
        makeCfdi({
          uuid: 'E-FEB',
          fecha: '2026-02-10',
          direction: 'EMITIDO',
          subtotal: 30000,
          ivaTrasladado: 4800,
          isrRetenido: 1000,
          total: 33800
        }),
        makeCfdi({
          uuid: 'E-JAN',
          fecha: '2026-01-10',
          direction: 'EMITIDO',
          subtotal: 30000,
          ivaTrasladado: 4800,
          isrRetenido: 1000,
          total: 33800
        })
      ],
      parameters: makeTaxParams({ coeficienteUtilidad: 0.2 })
    });
    // 216-02-001 unpaid PPD retention excluded -> only 216-01-004 ($500)
    expect(wp.resumenLineaCapturaSat.retencionesIsrPorEnterar).toBe(500);

    const { accounts } = createMockCatalog();
    const provAccounts: Account[] = [
      ...accounts,
      ...tb.filter((b) => !accounts.some((a) => a.code === b.code))
    ];
    const provMovs = buildTaxProvisionMovements(
      {
        ...wp,
        isrProvisional: {
          ...wp.isrProvisional,
          isrCausado: 6000,
          pagosProvisionalesPrevios: 2000,
          isrRetenidoPeriodo: 2000,
          isrRetenidoMesActual: 1000,
          isrNetoAPagar: 2000
        }
      },
      provAccounts,
      2,
      2026
    );
    expect(provMovs.find((m) => m.accountCode === '113-02-001')?.abono).toBe(1000);

    // RESICO REP paying Fixed Asset PPD (I04) excludes asset cost from deduccionesPagadasPeriodo + truncates Art. 5 to 0.6666
    const cashFixedRep = computeCashBasisFiscalSummary({
      company: makeCompany({ regimenFiscal: '626', rfc: 'RPM260101AA1' }),
      ejercicio: 2026,
      periodo: 2,
      cfdis: [
        makeCfdi({
          uuid: 'E-TAX',
          fecha: '2026-02-05',
          direction: 'EMITIDO',
          subtotal: 200000,
          ivaTrasladado: 32000,
          total: 232000,
          taxBreakdown: { base16: 200000, iva16: 32000, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0 }
        }),
        makeCfdi({
          uuid: 'E-EXE',
          fecha: '2026-02-06',
          direction: 'EMITIDO',
          subtotal: 100000,
          ivaTrasladado: 0,
          total: 100000,
          taxBreakdown: { base16: 0, iva16: 0, base8: 0, iva8: 0, base0: 0, baseExento: 100000, ieps: 0 }
        }),
        makeCfdi({
          uuid: 'FA-PPD-1',
          fecha: '2026-01-15',
          direction: 'RECIBIDO',
          metodoPago: 'PPD',
          formaPago: '99',
          usoCfdi: 'I04',
          subtotal: 100000,
          ivaTrasladado: 16000,
          total: 116000
        }),
        makeCfdi({
          uuid: 'FA-REP-1',
          fecha: '2026-02-15',
          tipoComprobante: 'P',
          direction: 'RECIBIDO',
          usoCfdi: 'CP01',
          subtotal: 0,
          ivaTrasladado: 16000,
          total: 116000,
          taxBreakdown: { base16: 100000, iva16: 16000, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0 },
          relatedDocs: [
            {
              idDocumento: 'FA-PPD-1',
              numParcialidad: 1,
              impSaldoAnt: 116000,
              impPagado: 116000,
              impSaldoInsoluto: 0,
              monedaDr: 'MXN',
              equivalenciaDr: 1,
              fechaPago: '2026-02-15'
            }
          ]
        })
      ],
      baseContableDevengada: 0
    });
    expect(cashFixedRep.cashBasisSummary.deduccionesPagadasFlujo).toBe(0);
    expect(cashFixedRep.ivaBreakdown.prorationFactor).toBe(0.6666);

    const diotFields = buildDiot54BatchLine({
      rfc: 'PRO010101AA1',
      nombre: 'Proveedor',
      tipoTercero: '04',
      tipoOperacion: '85',
      regionFronteriza: 'NORTE',
      actosPagados8: 1000,
      ivaAcreditable8: 80,
      ivaNoAcreditable8: 15,
      actosPagados16: 2000,
      ivaAcreditable16: 320,
      ivaNoAcreditable16: 45,
      ivaRetenido: 0
    }).split('|');
    expect(diotFields[27]).toBe('15');
    expect(diotFields[35]).toBe('45');

    const diotExt = computeDiotReportData({
      company: makeCompany(),
      cfdis: [
        makeCfdi({ uuid: 'X1', polizaId: 'p_x1', emisorRfc: 'XEXX010101000', emisorNombre: 'STRIPE INC', subtotal: 5000, ivaTrasladado: 0, total: 5000 }),
        makeCfdi({ uuid: 'X2', polizaId: 'p_x2', emisorRfc: 'XEXX010101000', emisorNombre: 'AWS INC', subtotal: 8000, ivaTrasladado: 0, total: 8000 })
      ],
      thirdParties: [
        {
          id: 'tp_aws',
          companyId: 'comp_r9',
          rfc: 'XEXX010101000',
          nombre: 'AWS INC',
          rol: 'PROVEEDOR',
          cuentaOperacionCode: '601-01-003',
          cuentaContrapartidaCode: '201-01-001',
          tipoTerceroDiot: '05',
          tipoOperacionDiot: '85',
          tasaIvaDefault: 0,
          idFiscal: '91-1646860',
          pais: 'USA',
          estatus69B: 'LIMPIO',
          updatedAt: '2026-10-01T00:00:00Z'
        }
      ],
      polizaIdsInPeriod: new Set(['p_x1', 'p_x2']),
      trialBalance: tb,
      ejercicio: 2026,
      periodo: 10
    });
    expect(diotExt.rows).toHaveLength(2);
  });

  test('4. Annual Tax: Provisional P01 boundary + Loss Jun(N)/Dic(N-1) INPC + Asset ACTIVO no double-count', () => {
    const acc213: Account = {
      id: 'acc_213',
      companyId: 'comp_r9',
      code: '213-01-002',
      name: 'ISR Provisional por Pagar',
      satGroupCode: '213.03',
      type: 'PASIVO',
      nature: 'ACREEDORA',
      level: 3,
      parentCode: '213-00-000',
      isAffectable: true,
      currency: 'MXN',
      initialBalance: 0
    };
    const paid = computeAnnualProvisionalPayments({
      accounts: [acc213],
      movs: [
        { account_id: 'acc_213', cargo: 0, abono: 50_000, polizas: { company_id: 'c', ejercicio: 2024, periodo: 12 } },
        { account_id: 'acc_213', cargo: 50_000, abono: 0, polizas: { company_id: 'c', ejercicio: 2025, periodo: 1 } },
        { account_id: 'acc_213', cargo: 100_000, abono: 120_000, polizas: { company_id: 'c', ejercicio: 2025, periodo: 12 } },
        { account_id: 'acc_213', cargo: 20_000, abono: 0, polizas: { company_id: 'c', ejercicio: 2026, periodo: 1 } }
      ],
      ejercicio: 2025,
      taxParameterRows: []
    });
    expect(paid).toBe(120_000);

    const serverAsset: FixedAssetRecord = {
      id: 'fa_srv',
      companyId: 'c',
      codigo: 'SRV-1',
      nombre: 'Servidor Linux',
      categoria: 'COMPUTO_30',
      fechaAdquisicion: '2023-01-05',
      cfdiUuid: null,
      montoOriginalInversion: 120_000,
      tasaAnualPct: 30,
      mesesDepreciadosPrevios: 36,
      inpcAdquisicion: 127.336,
      inpcMedioPeriodo: 140.405,
      cuentaActivoCode: '156-01-001',
      cuentaDepAcumCode: '171-01-001',
      cuentaGastoDepCode: '601-01-006',
      estatus: 'ACTIVO',
      createdAt: '2023-01-05'
    };
    const ded2025 = computeAnnualFixedAssetFiscalDeduction([serverAsset], 2025);
    expect(ded2025).toBeGreaterThan(36_000);

    const annualSummary = computeAnnualTaxSummary({
      company: makeCompany({ regimenFiscal: '601' }),
      ejercicio: 2025,
      trialBalance: makeSeedTb().map((a) =>
        a.code === '401-01-001' ? { ...a, finalBalance: 500_000 } : a
      ),
      monthlyBalancesByPeriod: [],
      fixedAssetsFiscalDeduction: 0,
      paymentsProvisioned: 0,
      perdidasFiscalesPendientes: 100_000,
      inputs: {}
    });
    expect(annualSummary.reconciliation.perdidasFiscalesActualizadas).toBe(101_780);
  });

  test('5. NIF P13 Adjustment Preservation, 305 Rollover, ORDEN Blocking, 3-Way Tieout & Dashboard P13/ORDEN', () => {
    const catalog = makeSeedTb().map((a) => ({
      ...a,
      initialBalance: 0,
      initialBalanceComputed: 0,
      finalBalance: 0
    }));
    const idOf = (code: string) => catalog.find((a) => a.code === code)!.id;
    const pols: Poliza[] = [
      {
        id: 'p_sale',
        companyId: 'comp_r9',
        tipo: 'INGRESO',
        folio: 1,
        fecha: '2026-10-10',
        ejercicio: 2026,
        periodo: 10,
        concepto: 'Venta',
        cfdiUuid: null,
        totalCargos: 100_000,
        totalAbonos: 100_000,
        isBalanced: true,
        origin: 'MANUAL',
        createdAt: '2026-10-10T00:00:00Z',
        movements: [
          { id: 'm1', polizaId: 'p_sale', accountId: idOf('102-01-001'), accountCode: '102-01-001', accountName: 'Bancos', referencia: '1', concepto: 'Venta', cargo: 100_000, abono: 0, cfdiUuid: null },
          { id: 'm2', polizaId: 'p_sale', accountId: idOf('401-01-001'), accountCode: '401-01-001', accountName: 'Ventas', referencia: '1', concepto: 'Venta', cargo: 0, abono: 100_000, cfdiUuid: null }
        ]
      },
      {
        id: 'p_exp',
        companyId: 'comp_r9',
        tipo: 'EGRESO',
        folio: 1,
        fecha: '2026-10-11',
        ejercicio: 2026,
        periodo: 10,
        concepto: 'Gasto',
        cfdiUuid: null,
        totalCargos: 40_000,
        totalAbonos: 40_000,
        isBalanced: true,
        origin: 'MANUAL',
        createdAt: '2026-10-11T00:00:00Z',
        movements: [
          { id: 'm3', polizaId: 'p_exp', accountId: idOf('601-01-001'), accountCode: '601-01-001', accountName: 'Gastos', referencia: '2', concepto: 'Gasto', cargo: 40_000, abono: 0, cfdiUuid: null },
          { id: 'm4', polizaId: 'p_exp', accountId: idOf('102-01-001'), accountCode: '102-01-001', accountName: 'Bancos', referencia: '2', concepto: 'Gasto', cargo: 0, abono: 40_000, cfdiUuid: null }
        ]
      },
      {
        id: 'p_adj13',
        companyId: 'comp_r9',
        tipo: 'DIARIO',
        folio: 1,
        fecha: '2026-12-31',
        ejercicio: 2026,
        periodo: 13,
        concepto: 'Ajuste P13',
        cfdiUuid: null,
        totalCargos: 10_000,
        totalAbonos: 10_000,
        isBalanced: true,
        origin: 'MANUAL',
        createdAt: '2026-12-31T00:00:00Z',
        movements: [
          { id: 'm5', polizaId: 'p_adj13', accountId: idOf('107-01-001'), accountCode: '107-01-001', accountName: 'Anticipos', referencia: 'A13', concepto: 'Reclasif', cargo: 10_000, abono: 0, cfdiUuid: null },
          { id: 'm6', polizaId: 'p_adj13', accountId: idOf('601-01-001'), accountCode: '601-01-001', accountName: 'Gastos', referencia: 'A13', concepto: 'Reclasif', cargo: 0, abono: 10_000, cfdiUuid: null }
        ]
      }
    ];
    const toJoined = (ps: Poliza[]) =>
      ps.flatMap((p) =>
        p.movements.map((m) => ({
          account_id: m.accountId,
          cargo: m.cargo,
          abono: m.abono,
          polizas: { company_id: p.companyId, ejercicio: p.ejercicio, periodo: p.periodo, origin: p.origin }
        }))
      );

    const company = makeCompany();
    const preClose = computeFinancialStatementsData(company, catalog, toJoined(pols), 2026, 13);
    const { movements: closeDrafts } = buildYearCloseMovements(preClose.trialBalance, 2026, 'finalBalance');
    const pClose = {
      id: 'p_close13',
      companyId: 'comp_r9',
      tipo: 'DIARIO' as const,
      folio: 2,
      fecha: '2026-12-31',
      ejercicio: 2026,
      periodo: 13,
      concepto: 'Cierre Anual',
      cfdiUuid: null,
      totalCargos: 100_000,
      totalAbonos: 100_000,
      isBalanced: true,
      origin: 'CIERRE_ANUAL',
      createdAt: '2026-12-31T23:59:00Z',
      movements: closeDrafts.map((d, idx) => ({
        id: `mc_${idx}`,
        polizaId: 'p_close13',
        accountId: d.accountId,
        accountCode: d.accountCode,
        accountName: d.accountName,
        referencia: d.referencia,
        concepto: d.concepto,
        cargo: d.cargo,
        abono: d.abono,
        cfdiUuid: null
      }))
    } as unknown as Poliza;
    const allPols = [...pols, pClose];
    const postClose = computeFinancialStatementsData(company, catalog, toJoined(allPols), 2026, 13);
    expect(postClose.incomeStatement.utilidadNeta).toBe(70_000);
    expect(postClose.balanceSheet.isBalanced).toBe(true);
    expect(postClose.balanceSheet.totalActivo).toBe(70_000);

    const kpisRes = buildDashboardKpisFromTrialBalance({
      trialBalance: postClose.trialBalance,
      polizas: allPols,
      cfdis: [],
      year: 2026,
      period: 13
    });
    expect(kpisRes.kpis.ingresosPeriodo).toBe(100_000);
    expect(kpisRes.kpis.utilidadNeta).toBe(70_000);

    const ordenCapTb: AccountWithBalance[] = [
      ...catalog.map((a) =>
        a.code === '800-00-000'
          ? { ...a, type: 'ORDEN' as const, periodCharges: 99_000, finalBalance: 99_000 }
          : a.code === '401-01-001'
            ? { ...a, periodCredits: 50_000, finalBalance: 50_000 }
            : a
      ),
      {
        id: 'acc-301-02-var',
        companyId: 'comp_r9',
        code: '301-02-999',
        name: 'Capital Variable',
        satGroupCode: '301.02',
        type: 'CAPITAL',
        nature: 'ACREEDORA',
        level: 3,
        parentCode: '301-00-000',
        isAffectable: true,
        currency: 'MXN',
        initialBalance: 25_000,
        initialBalanceComputed: 25_000,
        periodCharges: 0,
        periodCredits: 0,
        finalBalance: 25_000
      }
    ];
    const ext = computeExtendedFinancialStatements({
      company,
      currentTrialBalance: ordenCapTb,
      ejercicio: 2026,
      periodo: 10
    });
    expect(ext.equityChanges.rows.find((r) => r.rowType === 'CLOSING')?.capitalSocial).toBe(25_000);

    const tieoutTb = catalog.map((a) => {
      if (a.code === '401-01-001') return { ...a, periodCredits: 10000, finalBalance: 10000 };
      if (a.code === '601-01-001') return { ...a, periodCharges: 5000, finalBalance: 5000 };
      if (a.code === '208-01-001') return { ...a, periodCredits: 1600, periodCharges: 1600, finalBalance: 0 };
      if (a.code === '118-01-001') return { ...a, periodCharges: 800, periodCredits: 800, finalBalance: 0 };
      if (a.code === '118-03-001') return { ...a, periodCharges: 500, finalBalance: 500 };
      return a;
    });
    const provIvaPol: Poliza = {
      id: 'p_iva_m10',
      companyId: 'comp_r9',
      tipo: 'DIARIO',
      folio: 5,
      fecha: '2026-10-31',
      ejercicio: 2026,
      periodo: 10,
      concepto: 'Determinación mensual IVA',
      cfdiUuid: null,
      totalCargos: 1600,
      totalAbonos: 1600,
      isBalanced: true,
      origin: 'MANUAL',
      createdAt: '2026-10-31T23:00:00Z',
      movements: [
        { id: 'pi1', polizaId: 'p_iva_m10', accountId: idOf('208-01-001'), accountCode: '208-01-001', accountName: 'IVA Cob', referencia: 'IVA-M10', concepto: 'Cierre IVA', cargo: 1600, abono: 0, cfdiUuid: null },
        { id: 'pi2', polizaId: 'p_iva_m10', accountId: idOf('118-01-001'), accountCode: '118-01-001', accountName: 'IVA Pag', referencia: 'IVA-M10', concepto: 'Cierre IVA', cargo: 0, abono: 800, cfdiUuid: null },
        { id: 'pi3', polizaId: 'p_iva_m10', accountId: idOf('213-01-001'), accountCode: '213-01-001', accountName: 'IVA Por Pagar', referencia: 'IVA-M10', concepto: 'Cierre IVA', cargo: 0, abono: 800, cfdiUuid: null }
      ]
    };
    const recTieoutCfdi = makeCfdi({
      direction: 'RECIBIDO',
      subtotal: 5000,
      ivaTrasladado: 800,
      total: 5800,
      uuid: 'TR-1',
      polizaId: 'p_tr1',
      taxBreakdown: { base16: 5000, iva16: 800, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 500 }
    });
    const tieout = computeThreeWayTieout({
      company,
      ejercicio: 2026,
      periodo: 10,
      cfdis: [
        makeCfdi({ direction: 'EMITIDO', subtotal: 10000, ivaTrasladado: 1600, total: 11600, uuid: 'TE-1', polizaId: 'p_te1' }),
        recTieoutCfdi
      ],
      polizas: [provIvaPol],
      trialBalance: tieoutTb,
      diotReport: computeDiotReportData({
        company,
        cfdis: [recTieoutCfdi],
        thirdParties: [],
        polizaIdsInPeriod: new Set(['p_tr1']),
        trialBalance: tieoutTb,
        ejercicio: 2026,
        periodo: 10
      })
    });
    expect(tieout.status).toBe('VERDE');
    expect(tieout.causes.some((c) => c.code === 'MANUAL_IVA_SIN_CFDI')).toBe(false);
  });

  test('6. Anexo 24 CT.xml/BN.xml, 69-B RFC-4180 + precedence, CSV Bank/Catalogo, CxC/CxP, Fixed Asset no-overdep, Payroll & Inventory', () => {
    const seedTb = makeSeedTb();
    const ctXml = buildSatAnexo24Xml(makeCompany(), 2026, 10, 'catalogo', seedTb).xml;
    expect(ctXml).toContain('NumCta="101-00-000" Desc="Caja y Efectivo" Nivel="1"');
    expect(ctXml).toContain('NumCta="101-01-001" Desc="Caja General" SubCtaDe="101-00-000" Nivel="2"');
    expect(ctXml).not.toContain('NumCta="100-00-000"');

    const bnXml = buildSatAnexo24Xml(makeCompany(), 2026, 10, 'balanza', seedTb).xml;
    expect(bnXml).not.toContain('NumCta="100-00-000"');

    const efos = parseSat69BCsv(
      'No,RFC,Nombre,Situacion,Oficio,Pub\n1,EFO120101AB1,"EMPRESA\nMULTILINEA SA",Definitivo,OF-1,2024-01-10\n2,EFO120101AB1,"EMPRESA MULTILINEA SA",Presunto,OF-0,2023-01-01'
    );
    expect(efos.records.get('EFO120101AB1')?.status).toBe('DEFINITIVO_EFOS');

    expect(inferTypeFromCode('501-01-001', 'COSTOS')).toBe('COSTOS');
    expect(inferTypeFromCode('201-01-001', 'A')).toBe('PASIVO');

    const parsedBank = parseBankStatementCsv(
      'Fecha,Concepto,Cargo,Abono\n2026-10-10,Pago USD,"$(1,250.00)",""\n2026-10-11,Cobro JPY,"","$2,500.00 USD"\nTOTALES,"","1,250.00","2,500.00"',
      '2026-10-31'
    );
    expect(parsedBank).toHaveLength(2);
    expect(parsedBank[0]?.cargoBanco).toBe(1250);
    expect(parsedBank[1]?.abonoBanco).toBe(2500);

    // CxC JPY (TipoCambio < 1) & multi-Pago cutoff
    const aging = computeCxcCxpAging({
      companyId: 'comp_r9',
      asOfIso: '2026-10-31',
      cfdis: [
        makeCfdi({
          uuid: 'JPY-INV-1',
          fecha: '2026-10-01',
          metodoPago: 'PPD',
          formaPago: '99',
          moneda: 'JPY',
          tipoCambio: 0.13,
          subtotal: 1_000_000,
          ivaTrasladado: 0,
          total: 1_000_000
        }),
        makeCfdi({
          uuid: 'JPY-REP-1',
          tipoComprobante: 'P',
          fecha: '2026-11-03',
          subtotal: 0,
          ivaTrasladado: 0,
          total: 56000,
          moneda: 'MXN',
          tipoCambio: 1,
          relatedDocs: [
            {
              idDocumento: 'JPY-INV-1',
              numParcialidad: 1,
              impSaldoAnt: 1_000_000,
              impPagado: 400_000,
              impSaldoInsoluto: 600_000,
              monedaDr: 'JPY',
              equivalenciaDr: 1 / 0.14,
              fechaPago: '2026-10-28'
            }
          ]
        })
      ]
    });
    expect(aging.cxpItems[0]?.totalPagadoMxn).toBe(56_000);

    // Fixed asset rounding over 48 months must equal exact $2,000.00 MOI without $0.16 overrun
    let totalPosted = 0;
    for (let m = 0; m < 48; m += 1) {
      const calc = computeFixedAssetWithDepreciation({
        id: 'fa_round',
        companyId: 'c',
        codigo: 'R-1',
        nombre: 'Equipo',
        categoria: 'MOBILIARIO_10',
        fechaAdquisicion: '2022-01-01',
        cfdiUuid: null,
        montoOriginalInversion: 2000,
        tasaAnualPct: 25,
        mesesDepreciadosPrevios: m,
        inpcAdquisicion: 120,
        inpcMedioPeriodo: 120,
        cuentaActivoCode: '155-01-001',
        cuentaDepAcumCode: '171-01-001',
        cuentaGastoDepCode: '601-01-006',
        estatus: 'ACTIVO',
        createdAt: '2022-01-01'
      });
      totalPosted += calc.depreciacionMensualContable;
    }
    expect(Math.round(totalPosted * 100)).toBe(200_000);

    const paySummary = computePayrollPeriodSummary({
      cfdis: [
        makeCfdi({
          tipoComprobante: 'N',
          direction: 'EMITIDO',
          fecha: '2026-10-15',
          subtotal: 15000,
          ivaTrasladado: 0,
          total: 14500,
          xmlRaw: '<cfdi:Comprobante><nomina12:Nomina TotalPercepciones="10000" TotalOtrosPagos="5000"><nomina12:OtrosPagos><nomina12:OtroPago TipoOtroPago="003" Concepto="Viaticos" Importe="5000"/></nomina12:OtrosPagos></nomina12:Nomina></cfdi:Comprobante>'
        })
      ],
      trialBalance: [],
      ejercicio: 2026,
      periodo: 10
    });
    expect(paySummary.totalSubsidioEmpleo).toBe(0);

    const invAccounts: Account[] = [
      {
        id: 'a115',
        companyId: 'comp_r9',
        code: '115-01-001',
        name: 'Almacén',
        parentCode: '115-00-000',
        type: 'ACTIVO',
        nature: 'DEUDORA',
        level: 3,
        isAffectable: true,
        satGroupCode: '115.01',
        currency: 'MXN',
        initialBalance: 0
      }
    ];
    const invPurchases = computeInventoryInputsFromMovements(invAccounts, [
      { account_id: 'a115', cargo: 100_000, abono: 0, poliza_id: 'p1', polizas: { company_id: 'comp_r9', ejercicio: 2026, periodo: 10 } },
      { account_id: 'a115', cargo: 0, abono: 25_000, poliza_id: 'p2', polizas: { company_id: 'comp_r9', ejercicio: 2026, periodo: 10 } }
    ]);
    expect(invPurchases).toBe(75_000);
  });

  test('7. Security, Cross-Tenant SQLite Guards, FIEL .cer ASN.1 Ñ/CURP, CSF Ñ & XSS Sanitization', async () => {
    const tag5 = crypto.randomUUID().replace(/-/g, '').slice(0, 5);
    const ownerA = `r9a${tag5}`;
    const ownerB = `r9b${tag5}`;
    const wsA = `ws_${ownerA}`;
    const clientEmail = `cliente.r9.${tag5}@example.com`;
    const clientUid = `uid_cli_${tag5}`;

    const compA = createCompanyRecord({
      name: 'Tenant A',
      rfc: 'TEA260101AA1',
      regimenFiscal: '601',
      codigoPostal: '06600',
      userId: ownerA
    });
    const compB = createCompanyRecord({
      name: 'Tenant B',
      rfc: 'TEB260101AA2',
      regimenFiscal: '601',
      codigoPostal: '06600',
      userId: ownerB
    });
    createdCompanyIds.push(compA.id, compB.id);

    expect(() =>
      inviteWorkspaceMemberRepo({
        workspaceId: wsA,
        email: `attacker.${tag5}@example.com`,
        role: 'SOCIO',
        companyIds: [compB.id],
        invitedBy: ownerA
      })
    ).toThrow();

    const compA2 = createCompanyRecord({
      name: 'Tenant A2',
      rfc: 'TEA260102AA3',
      regimenFiscal: '601',
      codigoPostal: '06600',
      userId: ownerA
    });
    createdCompanyIds.push(compA2.id);
    inviteWorkspaceMemberRepo({
      workspaceId: wsA,
      email: clientEmail,
      role: 'CLIENTE_LECTURA',
      companyIds: [compA2.id],
      invitedBy: ownerA
    });
    acceptPendingInvitesRepo(clientUid, clientEmail);
    deleteCompanyRecord(compA2.id);
    expect(getEffectiveCompanyRoleRepo(compA.id, clientUid, clientEmail).role).toBeNull();

    const accB = createAccountRecord({
      companyId: compB.id,
      code: '102-01-999',
      name: 'Bancos B',
      type: 'ACTIVO',
      nature: 'DEUDORA',
      level: 3,
      parentCode: '102-00-000',
      satGroupCode: '102.01',
      isAffectable: true,
      initialBalance: 0
    });
    const polB = createPolizaTransaction({
      companyId: compB.id,
      ejercicio: 2026,
      periodo: 10,
      tipo: 'DIARIO',
      fecha: '2026-10-15',
      concepto: 'Poliza B',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: accB.id, cargo: 100, abono: 0, referencia: 'B1', concepto: 'B1' },
        { accountId: accB.id, cargo: 0, abono: 100, referencia: 'B2', concepto: 'B2' }
      ]
    });
    expect(() =>
      restoreCompanyBackupBundle(
        {
          version: '2.0',
          exportedAt: '2026-10-15T00:00:00Z',
          company: {
            ...compA,
            organizationId: wsA
          },
          accounts: [
            {
              id: accB.id,
              companyId: compB.id,
              code: accB.code,
              name: accB.name,
              parentCode: '102-00-000',
              type: 'ACTIVO',
              nature: 'DEUDORA',
              level: 3,
              isAffectable: true,
              satGroupCode: '102.01',
              currency: 'MXN',
              initialBalance: 0
            }
          ],
          polizas: [polB],
          cfdis: [],
          taxParameters: [],
          thirdParties: [],
          fixedAssets: [],
          periodLocks: []
        },
        ownerA
      )
    ).toThrow(/Colisión de ID multi-tenant/);

    startSupportSession({
      companyId: compA.id,
      companyName: compA.name,
      companyRfc: compA.rfc,
      ownerEmail: 'u@test.com'
    });
    setSupportActorAllowed(false);
    expect(isReadOnlySupportMode()).toBe(false);
    endSupportSession();
    setSupportActorAllowed(true);

    expect(sanitizeSpreadsheetText('\t=CMD()')).toBe("'\t=CMD()");
    expect(extractCompanyFromCsfText('Constancia SAT\nÑAM200101AB1\nCP 06600')?.rfc).toBe('ÑAM200101AB1');

    const tlv = (tag: number, content: Uint8Array) => {
      const hdr = content.length < 128 ? [tag, content.length] : [tag, 0x81, content.length];
      return new Uint8Array([...hdr, ...content]);
    };
    const enc = new TextEncoder();
    const curpAttr = tlv(
      0x30,
      new Uint8Array([
        ...tlv(0x06, new Uint8Array([0x55, 0x04, 0x05])),
        ...tlv(0x13, enc.encode('PEÑG850101HDFRRL09'))
      ])
    );
    const rfcAttr = tlv(
      0x30,
      new Uint8Array([
        ...tlv(0x06, new Uint8Array([0x55, 0x04, 0x2d])),
        ...tlv(0x0c, enc.encode('PEÑA850101AB1'))
      ])
    );
    const cnAttr = tlv(
      0x30,
      new Uint8Array([
        ...tlv(0x06, new Uint8Array([0x55, 0x04, 0x03])),
        ...tlv(0x0c, enc.encode('JOSE PEÑA'))
      ])
    );
    const subj = tlv(0x30, new Uint8Array([...tlv(0x31, curpAttr), ...tlv(0x31, rfcAttr), ...tlv(0x31, cnAttr)]));
    const validity = tlv(
      0x30,
      new Uint8Array([...tlv(0x17, enc.encode('260101000000Z')), ...tlv(0x17, enc.encode('300101000000Z'))])
    );
    const tbs = tlv(
      0x30,
      new Uint8Array([
        ...tlv(0x02, new Uint8Array([0x01])),
        ...tlv(0x30, new Uint8Array([0x05, 0x00])),
        ...tlv(0x30, new Uint8Array([])),
        ...validity,
        ...subj
      ])
    );
    const fakeDer = tlv(0x30, tbs);
    const parsedCert = await parseSatCertificate(fakeDer);
    expect(parsedCert.rfcTitular).toBe('PEÑA850101AB1');
    expect(parsedCert.nombreTitular).toBe('JOSE PEÑA');
  });
});

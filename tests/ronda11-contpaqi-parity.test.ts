import './setup-test-db';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  createAccountRecord,
  createCompanyRecord,
  deleteCompanyRecord,
  getAccounts,
  initDatabase
} from '../src/server/db';
import { BASE_COMPANY_ACCOUNTS } from '../src/shared/catalogs/base-accounts.seed';
import { normalizeForeignNoCfdiRecord } from '../src/shared/cfdi-xml-foreign';
import { decodeBankCsvBytes, parseBankStatementCsv } from '../src/shared/csv-bank-parser';
import { buildAutoPolizaPlan } from '../src/shared/engine/auto-poliza.engine';
import { buildRelatedCfdiOverridesFromRows } from '../src/shared/engine/auto-poliza-related';
import {
  buildFixedAssetDisposalPolizaPlan,
  computeFixedAssetDisposalSummary
} from '../src/shared/engine/fixed-assets.engine';
import { computePayrollExtendedAmarre, getUmaDiaria } from '../src/shared/engine/payroll-summary.engine';
import { buildSatAnexo24Xml } from '../src/shared/sat-anexo24';
import type { Account, AccountWithBalance, CfdiDocument, Company, FixedAssetRecord, Poliza } from '../src/shared/types';
import { parseAnexo24XmlCatalogOrBalanza } from '../src/views/catalogo/catalogoAnexo24XmlParser';
import { parseCatalogoCsvWithReport } from '../src/views/catalogo/catalogoCsvIo';
import { parseContpaqiTxtCatalog } from '../src/views/catalogo/catalogoMigrationParsers';

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

describe('Ronda 11 Suite 3 — Paridad CONTPAQi, Extranjeros Sin CFDI, Bancos, Activos Baja y Nómina 4 Rubros', () => {
  test('1. CONTPAQi TXT ancho fijo + claves A–L + 7xx en INGRESOS/GASTOS, BN.xml SaldoFin y cuentas N2 afectables', () => {
    const txt = [
      'C 10201000  Bancos Nacionales                102-00-000   A   102.01   25000.00',
      'C 70101000  Comisiones Bancarias             701-00-000   H   701.10   1200.00',
      'C 70201000  Productos Financieros            702-00-000   G   702.01   800.00',
      'C 80101000  UFIN del Ejercicio               801-00-000   I   801.01   0.00'
    ].join('\n');

    const parsed = parseContpaqiTxtCatalog(txt);
    expect(parsed.skipped.length).toBe(0);
    expect(parsed.rows.length).toBe(4);
    expect(parsed.rows[0]?.code).toBe('102-01-000');
    expect(parsed.rows[0]?.type).toBe('ACTIVO');
    expect(parsed.rows[0]?.nature).toBe('DEUDORA');
    expect(parsed.rows[1]?.type).toBe('GASTOS');
    expect(parsed.rows[2]?.type).toBe('INGRESOS');
    expect(parsed.rows[3]?.type).toBe('ORDEN');

    // 7xx sin clave literal tampoco cae en ORDEN
    const txt7xx = 'C 70102000  Pérdida Cambiaria             701.01   500.00\nC 70202000  Utilidad Cambiaria            702.01   300.00';
    const parsed7xx = parseContpaqiTxtCatalog(txt7xx);
    expect(parsed7xx.rows.find((r) => r.code === '701-02-000')?.type).toBe('GASTOS');
    expect(parsed7xx.rows.find((r) => r.code === '702-02-000')?.type).toBe('INGRESOS');

    // BN.xml con selector SaldoFin
    const bnXml = `<?xml version="1.0" encoding="UTF-8"?>
<BCE:Balanza xmlns:BCE="http://www.sat.gob.mx/esquemas/ContabilidadE/1_3/BalanzaComprobacion" Version="1.3" RFC="AAA010101AA1" Mes="06" Anio="2026" TipoEnvio="N">
  <BCE:Ctas NumCta="102-01-001" SaldoIni="1000.00" Debe="500.00" Haber="200.00" SaldoFin="1300.00"/>
  <BCE:Ctas NumCta="301-01-001" SaldoIni="1000.00" Debe="0.00" Haber="300.00" SaldoFin="1300.00"/>
</BCE:Balanza>`;
    const bnSaldoFin = parseAnexo24XmlCatalogOrBalanza(bnXml, [], { bnBalanceField: 'SaldoFin' });
    expect(bnSaldoFin.balanzaValidation?.balanceField).toBe('SaldoFin');
    expect(bnSaldoFin.rows.find((r) => r.code === '102-01-001')?.initialBalance).toBe(1300);

    // Cuentas N2 afectables en CSV y en SQLite
    const csvN2 = 'Código,Nombre,Agrupador,Rubro,Naturaleza,Nivel,Afectable,Saldo Inicial,Padre\n601-99,Gasto Operativo N2,601.84,GASTOS,DEUDORA,2,,0,600-00-000';
    const parsedCsvN2 = parseCatalogoCsvWithReport(csvN2);
    expect(parsedCsvN2.rows[0]?.level).toBe(2);
    expect(parsedCsvN2.rows[0]?.isAffectable).toBe(true);

    const comp = createCompanyRecord({
      name: 'N2 Afectable S.A.',
      rfc: 'N2A260101AA1',
      regimenFiscal: '601',
      codigoPostal: '06700',
      currentYear: 2026,
      currentPeriod: 6
    });
    createdCompanyIds.push(comp.id);
    const created = createAccountRecord({
      companyId: comp.id,
      code: '601-99-000',
      name: 'Subcuenta N2 Afectable',
      parentCode: '600-00-000',
      type: 'GASTOS',
      nature: 'DEUDORA',
      level: 2,
      isAffectable: true,
      satGroupCode: '601.84',
      initialBalance: 0
    });
    const accs = getAccounts(comp.id);
    expect(accs.find((a) => a.id === created.id)?.isAffectable).toBe(true);
  });

  test('2. Auto-Póliza REP hereda deductiblePct de PPD original y Comprobante Extranjero sin CFDI usa CompExt sin UUID SAT falso', () => {
    const accounts: Account[] = BASE_COMPANY_ACCOUNTS.map((a) => ({ ...a, id: `acc_${a.code}`, companyId: 'comp_rep' }));
    const origUuid = '12121212-1212-4121-8121-121212121212';
    const overrides = buildRelatedCfdiOverridesFromRows(
      [
        {
          uuid: origUuid,
          moneda: 'MXN',
          tipo_cambio: 1,
          metodo_pago: 'PPD',
          subtotal: 10_000,
          iva_trasladado: 1_600,
          total: 11_600,
          deductible_pct: 50,
          uso_cfdi: 'G03'
        }
      ],
      'P',
      1
    );
    expect(overrides.deductiblePct).toBe(50);

    const repDoc: CfdiDocument = {
      id: 'cfdi_rep',
      companyId: 'comp_rep',
      uuid: '34343434-3434-4343-8343-343434343434',
      fecha: '2026-06-20',
      fechaPago: '2026-06-20',
      tipoComprobante: 'P',
      direction: 'RECIBIDO',
      serie: 'P',
      folio: '5',
      emisorRfc: 'PRO010101AA1',
      emisorNombre: 'Restaurante Proveedor S.A.',
      receptorRfc: 'R11260101AA1',
      receptorNombre: 'Empresa S.A.',
      conceptoPrincipal: 'Pago consumo restaurante PPD',
      claveProdServ: '84111506',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 0,
      descuento: 0,
      ivaTrasladado: 1_600,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 11_600,
      metodoPago: 'PUE',
      formaPago: '03',
      usoCfdi: 'CP01',
      uuidRelacionado: origUuid,
      relatedDocs: [{ idDocumento: origUuid, numParcialidad: 1, impSaldoAnt: 11_600, impPagado: 11_600, impSaldoInsoluto: 0, monedaDr: 'MXN' }],
      statusSat: 'VIGENTE',
      polizaId: null,
      xmlRaw: '<cfdi:Comprobante/>'
    };

    const plan = buildAutoPolizaPlan(repDoc, accounts, overrides);
    expect(plan.isBalanced).toBe(true);
    const ivaPagadoLine = plan.movements.find((m) => m.accountCode === '118-01-001');
    expect(ivaPagadoLine?.cargo).toBe(800); // 50% de 1,600 heredado del PPD original

    // Comprobante extranjero sin CFDI -> prefijo EXT- (no UUID v4 SAT falso) y PL.xml emite PLZ:CompExt
    const foreign = normalizeForeignNoCfdiRecord(
      {
        companyId: 'comp_rep',
        isForeignNoCfdi: true,
        mode: 'EXTRANJERO',
        numFactExt: 'INV-9001',
        taxId: 'US-99-123456',
        country: 'USA',
        counterpartyName: 'DigitalOcean LLC',
        conceptoPrincipal: 'Cloud hosting invoice',
        moneda: 'USD',
        tipoCambio: 18.5,
        subtotal: 100
      },
      { rfc: 'R11260101AA1', name: 'Empresa S.A.' },
      '2026-06-15'
    );
    expect(foreign.isForeignNoCfdi).toBe(true);
    expect(foreign.uuid).toBe('EXT-INV-9001');

    const company: Company = {
      id: 'comp_rep',
      rfc: 'R11260101AA1',
      name: 'Empresa S.A.',
      regimenFiscal: '601',
      codigoPostal: '06700',
      maskFormat: 'XXX-XX-XXX',
      currentYear: 2026,
      currentPeriod: 6,
      createdAt: '2026-01-01T00:00:00Z'
    };
    const pl = buildSatAnexo24Xml(
      company,
      2026,
      6,
      'polizas',
      [],
      [
        {
          id: 'p_ext',
          companyId: company.id,
          ejercicio: 2026,
          periodo: 6,
          tipo: 'EGRESO',
          folio: 7,
          fecha: '2026-06-15',
          concepto: 'DigitalOcean LLC',
          totalCargos: 1850,
          totalAbonos: 1850,
          cfdiUuid: foreign.uuid,
          origin: 'ADD_AUTO',
          isBalanced: true,
          createdAt: '2026-06-15T00:00:00Z',
          movements: [
            {
              id: 'm_ext',
              polizaId: 'p_ext',
              accountId: 'acc_601',
              accountCode: '601-01-001',
              accountName: 'Gastos',
              referencia: 'INV-9001',
              concepto: 'Hosting USA',
              cargo: 1850,
              abono: 0,
              cfdiUuid: foreign.uuid,
              rfcContraparte: foreign.taxId,
              cfdiMoneda: 'USD',
              cfdiTipoCambio: 18.5,
              cfdiTotal: 100
            }
          ]
        }
      ],
      { tipoSolicitud: 'AF', numOrden: 'ABC1234567/26' }
    );
    expect(pl.xml).toContain('<PLZ:CompExt NumFactExt="EXT-INV-9001"');
    expect(pl.xml).not.toContain('CompNal UUID_CFDI="EXT-INV-9001"');
  });

  test('3. Bancos Windows-1252 + importe C/A, Activos Baja Art. 31 y Nómina 4 rubros + INFONAVIT tope 25 UMAs', () => {
    // Windows-1252 (bytes con 'Ñ' = 0xD1 y 'ó' = 0xF3) + delimitado '|' con Importe y columna C/A
    const rawTxt = 'Fecha|Referencia|Descripción|Importe|C/A\n2026-06-10|SPEI-1|Comisión Ñoño|$1,250.50|C\n2026-06-11|DEP-2|Depósito cliente|$5,000.00|A';
    const win1252Bytes = Uint8Array.from([...rawTxt].map((ch) => (ch === 'Ñ' ? 0xd1 : ch === 'ó' ? 0xf3 : ch.charCodeAt(0))));
    const decoded = decodeBankCsvBytes(win1252Bytes);
    expect(decoded).toContain('Comisión Ñoño');
    const bankRows = parseBankStatementCsv(decoded, '2026-06-01');
    expect(bankRows.length).toBe(2);
    expect(bankRows[0]?.cargoBanco).toBe(1250.5);
    expect(bankRows[0]?.abonoBanco).toBe(0);
    expect(bankRows[1]?.cargoBanco).toBe(0);
    expect(bankRows[1]?.abonoBanco).toBe(5000);

    // Baja de Activo Fijo Art. 31 LISR con utilidad/pérdida contable y fiscal + póliza cuadrada
    const accounts: Account[] = BASE_COMPANY_ACCOUNTS.map((a) => ({ ...a, id: `acc_${a.code}`, companyId: 'comp_baja' }));
    const asset: FixedAssetRecord = {
      id: 'fa_1',
      companyId: 'comp_baja',
      codigo: 'VEH-01',
      nombre: 'Automóvil Sedán',
      categoria: 'TRANSPORTE_25',
      vehicleCapType: 'AUTO_COMBUSTION',
      fechaAdquisicion: '2025-01-15',
      montoOriginalInversion: 240_000,
      tasaAnualPct: 25,
      inpcAdquisicion: 138.343,
      inpcMedioPeriodo: 143.588,
      mesesDepreciadosPrevios: 12,
      estatus: 'ACTIVO',
      cuentaActivoCode: '154-01-001',
      cuentaDepAcumCode: '171-01-003',
      cuentaGastoDepCode: '601-01-006',
      cfdiUuid: null,
      createdAt: '2025-01-15T00:00:00Z'
    };
    const disposal = computeFixedAssetDisposalSummary(asset, '2026-06-15', 150_000);
    expect(disposal.valorNetoContable).toBe(180_000); // 240k - 60k
    expect(disposal.utilidadOPerdidaContable).toBe(-30_000);
    expect(disposal.fiscalMoiTope).toBe(175_000); // Tope Art. 36 combustión
    const bajaPlan = buildFixedAssetDisposalPolizaPlan({
      asset,
      accounts,
      fechaBaja: '2026-06-15',
      precioVenta: 150_000
    });
    expect(bajaPlan.isBalanced).toBe(true);
    expect(bajaPlan.totalCargo).toBe(240_000);
    expect(bajaPlan.totalAbono).toBe(240_000);

    // Nómina 4 rubros + INFONAVIT 5% sobre SalarioBaseCotApor * NumDiasPagados con tope 25 UMAs
    const uma2026 = getUmaDiaria(2026);
    const sbcAboveCap = 3_500; // > 25 * 117.31 = 2,932.75
    const nomCfdi: CfdiDocument = {
      id: 'c_nom_4r',
      companyId: 'comp_baja',
      uuid: '56565656-5656-4565-8565-565656565656',
      fecha: '2026-06-15',
      fechaPago: '2026-06-15',
      tipoComprobante: 'N',
      direction: 'EMITIDO',
      serie: 'N',
      folio: '12',
      emisorRfc: 'R11260101AA1',
      emisorNombre: 'Empresa S.A.',
      receptorRfc: 'EMP010101AA1',
      receptorNombre: 'Empleado Uno',
      conceptoPrincipal: 'Nómina quincenal',
      claveProdServ: '84111505',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 15_000,
      descuento: 400,
      ivaTrasladado: 0,
      isrRetenido: 1_200,
      ivaRetenido: 0,
      total: 13_400,
      metodoPago: 'PUE',
      formaPago: '99',
      usoCfdi: 'CN01',
      statusSat: 'VIGENTE',
      polizaId: 'pol_nom',
      xmlRaw: `<cfdi:Comprobante><nomina12:Nomina NumDiasPagados="15" TotalPercepciones="15000.00" TotalGravado="12000.00" TotalExento="3000.00"><nomina12:Receptor SalarioBaseCotApor="${sbcAboveCap}"/><nomina12:Deducciones><nomina12:Deduccion TipoDeduccion="001" Importe="400.00"/></nomina12:Deducciones></nomina12:Nomina></cfdi:Comprobante>`
    };
    const tbNom: AccountWithBalance[] = BASE_COMPANY_ACCOUNTS.map((a) => {
      const base = { ...a, id: `acc_${a.code}`, companyId: 'comp_baja', initialBalanceComputed: 0, periodCharges: 0, periodCredits: 0, finalBalance: 0 };
      if (a.code === '601-01-001') return { ...base, periodCharges: 15_000, finalBalance: 15_000 };
      if (a.code === '216-01-001') return { ...base, periodCredits: 1_200, finalBalance: 1_200 };
      if (a.code === '211-01-001') return { ...base, periodCredits: 400, finalBalance: 400 };
      return base;
    });
    const polNom: Poliza = {
      id: 'pol_nom',
      companyId: 'comp_baja',
      ejercicio: 2026,
      periodo: 6,
      tipo: 'EGRESO',
      folio: 20,
      fecha: '2026-06-15',
      concepto: 'Nómina quincenal',
      totalCargos: 15_000,
      totalAbonos: 15_000,
      cfdiUuid: nomCfdi.uuid,
      origin: 'ADD_AUTO',
      isBalanced: true,
      createdAt: '2026-06-15T00:00:00Z',
      movements: [
        { id: 'mn1', polizaId: 'pol_nom', accountId: 'acc_102-01-001', accountCode: '102-01-001', accountName: 'Bancos', referencia: 'N-12', concepto: 'Neto nómina', cargo: 0, abono: 13_400, cfdiUuid: null }
      ]
    };

    const amarre = computePayrollExtendedAmarre({
      cfdis: [nomCfdi],
      trialBalance: tbNom,
      polizas: [polNom],
      ejercicio: 2026,
      periodo: 6
    });
    expect(amarre.rubros.length).toBe(4);
    expect(amarre.rubros.every((r) => r.status === 'CUADRADO')).toBe(true);
    expect(amarre.exentosStats.deducible53Pct).toBe(1590);
    expect(amarre.exentosStats.deducible47Pct).toBe(1410);
    const expectedCappedBase = Number((25 * uma2026 * 15).toFixed(2));
    expect(amarre.infonavitEstimate.usedXmlSbc).toBe(true);
    expect(amarre.infonavitEstimate.baseSbcCapped).toBe(expectedCappedBase);
    expect(amarre.infonavitEstimate.infonavit5Pct).toBe(Number((expectedCappedBase * 0.05).toFixed(2)));
  });
});

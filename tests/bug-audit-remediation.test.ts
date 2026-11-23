import { afterAll, describe, expect, test } from 'bun:test';
import {
  createCompanyRecord,
  deleteCompanyRecord,
  getCompanyById
} from '../src/server/repositories/companies.repo';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';
import { FISCAL_ACCOUNT_ROLES } from '../src/shared/sat-constants';
import { computeFiscalWorkpaperFromTrialBalance } from '../src/shared/engine/fiscal.engine';
import { computeFinancialStatementsData } from '../src/shared/engine/financial-reports.engine';
import { parseCfdiXmlString } from '../src/shared/cfdi-xml';
import { buildSatConsultaCfdiSoapXml } from '../src/shared/sat-cfdi-status';
import { calculateDia17Deadline, parseCalendarDate } from '../src/shared/date-utils';
import { toCents } from '../src/shared/engine/invariants-and-math';
import type { AccountWithBalance, Company } from '../src/shared/types';

describe('Bug Audit Remediation — Wave 1–3 Regression Suite', () => {
  const createdCompanyIds: string[] = [];

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id, 'usr_audit_owner');
    }
  });

  test('1. Multi-tenant isolation blocks unauthenticated and cross-tenant getCompanyById', () => {
    const priv = createCompanyRecord({
      name: 'Tenant Privado Audit SA',
      rfc: 'TPA260101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      userId: 'usr_audit_owner'
    });
    createdCompanyIds.push(priv.id);

    expect(getCompanyById(priv.id)).toBeNull();
    expect(getCompanyById(priv.id, 'usr_attacker')).toBeNull();
    expect(getCompanyById(priv.id, 'usr_audit_owner')?.id).toBe(priv.id);
    // Demo workspace company remains accessible without explicit userId
    expect(getCompanyById('comp_tnn_01')?.id).toBe('comp_tnn_01');
  });

  test('2. Separates 113-02-001 (ISR a favor) from 113-01-002 (IVA retenido/a favor) in fiscal workpaper', () => {
    const company: Company = {
      id: 'comp_fisc',
      name: 'Fiscal Test SA',
      rfc: 'FIS260101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      maskFormat: 'XXX-XX-XXX',
      currentYear: 2026,
      currentPeriod: 10,
      createdAt: '2026-01-01'
    };

    const seed = getSeedAccountsForPreset('SAT_STANDARD').map((a): AccountWithBalance => ({
      ...a,
      id: `acc_${a.code}`,
      companyId: company.id,
      initialBalance: 0,
      initialBalanceComputed: 0,
      periodCharges: a.code === '113-02-001' ? 1200 : a.code === '113-01-002' ? 350 : 0,
      periodCredits: 0,
      finalBalance: 0
    }));

    const wp = computeFiscalWorkpaperFromTrialBalance({
      company,
      ejercicio: 2026,
      periodo: 10,
      parameters: {
        companyId: company.id,
        ejercicio: 2026,
        coeficienteUtilidad: 0.1,
        perdidasFiscalesPendientes: 0,
        pagosProvisionalesAnteriores: 0,
        saldoFavorIvaAnterior: 0,
        tipoCambioDofCierre: 19.5
      },
      trialBalance: seed,
      cfdis: []
    });

    expect(wp.isrProvisional.isrRetenidoPeriodo).toBe(1200);
    expect(wp.ivaDefinitivo.ivaRetenidoAcreditable).toBe(350);
  });

  test('3. Keeps IMSS 211-01-001 separate from ISR Retenido 216-01-001', () => {
    const seed = getSeedAccountsForPreset('SAT_STANDARD');
    const imssAcc = seed.find((a) => a.code === '211-01-001');
    const isrAcc = seed.find((a) => a.code === '216-01-001');

    expect(imssAcc).toBeDefined();
    expect(isrAcc).toBeDefined();
    expect(FISCAL_ACCOUNT_ROLES.OTRAS_CUENTAS_POR_PAGAR.code).toBe('211-01-001');
    expect(FISCAL_ACCOUNT_ROLES.ISR_RETENIDO_POR_PAGAR.code).toBe('216-01-001');
    expect(FISCAL_ACCOUNT_ROLES.OTRAS_CUENTAS_POR_PAGAR.code).not.toBe(
      FISCAL_ACCOUNT_ROLES.ISR_RETENIDO_POR_PAGAR.code
    );
  });

  test('4. Preserves negative contra balances in financial statements without Math.abs() distortion', () => {
    const company: Company = {
      id: 'comp_neg',
      name: 'Contra Bal Test',
      rfc: 'CBT260101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      maskFormat: 'XXX-XX-XXX',
      currentYear: 2026,
      currentPeriod: 10,
      createdAt: '2026-01-01'
    };

    const seed: AccountWithBalance[] = getSeedAccountsForPreset('SAT_STANDARD').map((a) => ({
      ...a,
      id: `acc_${a.code}`,
      companyId: company.id,
      initialBalance: 0,
      initialBalanceComputed: 0,
      periodCharges: 0,
      periodCredits: 0,
      finalBalance: 0
    }));

    const reports = computeFinancialStatementsData(
      company,
      seed,
      [
        // Devolución sobre venta mayor a ventas brutas: cargo 401-01-001 = 500, abono 102-01-001 = 500
        {
          account_id: 'acc_401-01-001',
          cargo: 500,
          abono: 0,
          polizas: { company_id: company.id, ejercicio: 2026, periodo: 10 }
        },
        {
          account_id: 'acc_102-01-001',
          cargo: 0,
          abono: 500,
          polizas: { company_id: company.id, ejercicio: 2026, periodo: 10 }
        }
      ],
      2026,
      10
    );

    expect(reports.incomeStatement.totalIngresos).toBe(-500);
    expect(reports.incomeStatement.utilidadNeta).toBe(-500);
    expect(reports.balanceSheet.totalActivo).toBe(-500);
    expect(reports.balanceSheet.utilidadEjercicio).toBe(-500);
    expect(reports.balanceSheet.totalPasivoMasCapital).toBe(-500);
  });

  test('5. Isolates <Addenda><Impuestos>, Pago20 ObjetoImpDR="01", and Nomina TotalPercepciones="0.00"', () => {
    const addendaXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-05T12:00:00" TipoDeComprobante="I" SubTotal="100.00" Total="100.00" Moneda="MXN" MetodoPago="PUE">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Emisor SA" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor SA" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="E48" Descripcion="Servicio Exento" ValorUnitario="100.00" Importe="100.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Addenda>
    <CustomPartner>
      <cfdi:Impuestos TotalImpuestosTrasladados="999.00"/>
    </CustomPartner>
  </cfdi:Addenda>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="11111111-2222-3333-4444-555555555555" FechaTimbrado="2026-10-05T12:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedAddenda = parseCfdiXmlString(addendaXml);
    expect(parsedAddenda.ivaTrasladado).toBe(0);

    const pagoXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-05T12:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Emisor SA" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor SA" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales MontoTotalPagos="5000.00"/>
      <pago20:Pago FechaPago="2026-10-05T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00">
        <pago20:DoctoRelacionado IdDocumento="AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE" MonedaDR="MXN" NumParcialidad="1" ImpSaldoAnt="5000.00" ImpPagado="5000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="01"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="22222222-2222-3333-4444-555555555555" FechaTimbrado="2026-10-05T12:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedPago = parseCfdiXmlString(pagoXml);
    expect(parsedPago.subtotal).toBe(5000);
    expect(parsedPago.ivaTrasladado).toBe(0);

    const nominaZeroXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:nomina12="http://www.sat.gob.mx/nomina12" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-15T12:00:00" TipoDeComprobante="N" SubTotal="500.00" Total="500.00" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Patron SA" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="CURP010101XXX" Nombre="Empleado" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="605" UsoCFDI="CN01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111505" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago de nómina" ValorUnitario="500.00" Importe="500.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <nomina12:Nomina Version="1.2" TipoNomina="O" FechaPago="2026-10-15" TotalPercepciones="0.00" TotalOtrosPagos="500.00"/>
    <tfd:TimbreFiscalDigital UUID="33333333-2222-3333-4444-555555555555" FechaTimbrado="2026-10-15T12:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedNomina = parseCfdiXmlString(nominaZeroXml);
    expect(parsedNomina.subtotal).toBe(500);
    expect(parsedNomina.otrosPagosNomina).toBe(500);
  });

  test('6. Preserves & in SAT Consulta CFDI SOAP CDATA while breaking up ]]> injection', () => {
    const soap = buildSatConsultaCfdiSoapXml({
      rfcEmisor: 'A&B010101AAA',
      rfcReceptor: 'X]]><Y010101BBB',
      total: 116,
      uuid: '12345678-1234-1234-1234-123456789012'
    });

    expect(soap).toContain('?re=A&B010101AAA&rr=X]]]]><![CDATA[><Y010101BBB&tt=116.000000');
    expect(soap).not.toContain('&amp;');
  });

  test('7. Computes Period 13 Dia 17 deadline, toCents(1.005), and parseCalendarDate day-1 boundary', () => {
    expect(calculateDia17Deadline(2026, 13).isoDate).toBe('2027-01-18');
    expect(toCents(1.005)).toBe(101);
    const jan1 = parseCalendarDate('2026-01-01');
    expect(jan1.year).toBe(2026);
    expect(jan1.month).toBe(1);
    expect(jan1.day).toBe(1);
  });
});

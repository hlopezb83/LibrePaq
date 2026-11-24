import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { initDatabase } from '../src/server/schema';
import { createCompanyRecord, deleteCompanyRecord } from '../src/server/repositories/companies.repo';
import { getAccounts } from '../src/server/repositories/accounts.repo';
import { createPolizaTransaction } from '../src/server/repositories/polizas.repo';
import { computeTrialBalance } from '../src/server/repositories/trial-balance.repo';
import { getAccountLedger } from '../src/server/repositories/account-ledger.repo';
import {
  batchGenerateAutoPolizasFromCfdiIds,
  batchUploadCfdiXmlStrings,
  insertParsedCfdiRecord
} from '../src/server/repositories/cfdi.repo';
import { parseCfdiXmlString } from '../src/shared/cfdi-xml';
import { parseCfdiPreview } from '../src/shared/cfdi-preview-parser';
import { parseCfdiFull } from '../supabase/functions/sat-soap-sync/cfdi-full-parser';
import { computeCxcCxpAging } from '../src/shared/engine/cxc-cxp.engine';
import {
  computePayrollPeriodSummary,
  computeSuaAndIsnProvision
} from '../src/shared/engine/payroll-summary.engine';
import { buildAutoPolizaPlan } from '../src/shared/engine/auto-poliza.engine';
import { getSeedAccountsForPreset } from '../src/shared/catalogs/base-accounts.seed';
import { SAT_GROUP_CODES } from '../src/shared/sat-group-codes-catalog';
import { parseBankStatementCsv } from '../src/shared/csv-bank-parser';
import { deduplicateBankLinesByOccurrence } from '../src/lib/supabase/supabase-bank-helpers';
import { parseCatalogoCsvWithReport } from '../src/views/catalogo/catalogoCsvIo';
import type { Account, CfdiDocument } from '../src/shared/types';

function makeSeedAccounts(companyId = 'c_r7'): Account[] {
  return getSeedAccountsForPreset('SAT_STANDARD').map((a, idx) => ({
    ...a,
    id: `acc_${companyId}_${idx}`,
    companyId
  }));
}

function makeCfdi(overrides: Partial<CfdiDocument> = {}): CfdiDocument {
  return {
    id: 'cfdi_1',
    companyId: 'c_r7',
    uuid: '11111111-1111-4111-8111-111111111111',
    fecha: '2026-10-10',
    tipoComprobante: 'I',
    direction: 'EMITIDO',
    serie: 'A',
    folio: '1',
    emisorRfc: 'AAA010101AAA',
    emisorNombre: 'EMISOR SA',
    receptorRfc: 'BBB010101BBB',
    receptorNombre: 'RECEPTOR SA',
    conceptoPrincipal: 'Servicios generales',
    claveProdServ: '80101500',
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
    xmlRaw: '<cfdi:Comprobante/>',
    ...overrides
  };
}

describe('Ronda 7 — Ola 2: Core, ADD/CFDI 4.0, CxC/CxP, Nómina, Catálogos y Bancos', () => {
  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id);
    }
  });

  test('1. Addenda isolation prevents Addenda tags from corrupting Conceptos, Taxes, Payments, and Preview', () => {
    const xmlWithAddenda = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-15T12:00:00" TipoDeComprobante="I" SubTotal="1000.00" Total="1160.00" Moneda="MXN" MetodoPago="PUE" FormaPago="03" Exportacion="01">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR REAL" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR REAL" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="80101500" Cantidad="1" ClaveUnidad="E48" Descripcion="Servicio Real" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="ADDENDA-ISO-1111-4111-8111-111111111111" FechaTimbrado="2026-10-15T12:01:00" RfcProvCertif="SAT970701NN3" SelloCFD="SELLOCFD12345678" NoCertificadoSAT="00001000000500000001" SelloSAT="SELLOSAT87654321"/>
  </cfdi:Complemento>
  <cfdi:Addenda>
    <CustomPartner>
      <Concepto ClaveProdServ="99999999" Descripcion="CONCEPTO_ADDENDA_FALSO" ValorUnitario="99999.00" Importe="99999.00"/>
      <Impuestos TotalImpuestosTrasladados="9999.00">
        <Traslados><Traslado Base="99999.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="9999.00"/></Traslados>
      </Impuestos>
      <CfdiRelacionado UUID="FAKE-REL-UUID-9999"/>
    </CustomPartner>
  </cfdi:Addenda>
</cfdi:Comprobante>`;

    const parsed = parseCfdiXmlString(xmlWithAddenda);
    expect(parsed.conceptoPrincipal).toBe('Servicio Real');
    expect(parsed.ivaTrasladado).toBe(160);
    expect(parsed.uuidRelacionado).toBeNull();

    const full = parseCfdiFull(xmlWithAddenda);
    expect(full?.conceptoPrincipal).toBe('Servicio Real');
    expect(full?.ivaTrasladado).toBe(160);
    expect(full?.uuidRelacionado).toBeNull();

    const preview = parseCfdiPreview(makeCfdi({ xmlRaw: xmlWithAddenda }));
    expect(preview.conceptos).toHaveLength(1);
    expect(preview.conceptos[0]?.descripcion).toBe('Servicio Real');
    expect(preview.impuestos.totalImpuestosTrasladados).toBe(160);
    expect(preview.timbre.selloSat).toBe('SELLOSAT87654321');
    expect(preview.receptor.domicilioFiscalReceptor).toBe('06000');
  });

  test('2. FechaPago extraction (Pago 2.0, Pago 1.0, Nómina 1.2), mixed ObjetoImpDR=01+16%, no fabricated Pago 1.0 IVA, and CxC/CxP asOfIso cutoff', () => {
    const pago10Xml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/3" xmlns:pago10="http://www.sat.gob.mx/Pagos" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="3.3" Fecha="2026-11-02T10:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR" UsoCFDI="P01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <pago10:Pagos Version="1.0">
      <pago10:Pago FechaPago="2026-10-28T14:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="1160.00">
        <pago10:DoctoRelacionado IdDocumento="PPD-ORIG-1" MonedaDR="MXN" NumParcialidad="1" ImpSaldoAnt="1160.00" ImpPagado="1160.00" ImpSaldoInsoluto="0.00"/>
      </pago10:Pago>
    </pago10:Pagos>
    <tfd:TimbreFiscalDigital UUID="REP10-1111-4111-8111-111111111111" FechaTimbrado="2026-11-02T10:01:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedPago10 = parseCfdiXmlString(pago10Xml);
    expect(parsedPago10.fechaPago).toBe('2026-10-28');
    // Pago 1.0 sin Totales ni impuestos explícitos NO debe fabricar IVA 16%
    expect(parsedPago10.ivaTrasladado).toBe(0);
    expect(parsedPago10.subtotal).toBe(1160);
    expect(parsedPago10.total).toBe(1160);

    const mixedRepXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-29T10:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="RECEPTOR" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales TotalTrasladosBaseIVA16="1000.00" TotalTrasladosImpuestoIVA16="160.00" MontoTotalPagos="1660.00"/>
      <pago20:Pago FechaPago="2026-10-29T11:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="1660.00">
        <pago20:DoctoRelacionado IdDocumento="DOC-16" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="1160.00" ImpPagado="1160.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/>
        <pago20:DoctoRelacionado IdDocumento="DOC-01" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="500.00" ImpPagado="500.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="01"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="REP-MIX-01" FechaTimbrado="2026-10-29T11:05:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const parsedMixed = parseCfdiXmlString(mixedRepXml);
    expect(parsedMixed.fechaPago).toBe('2026-10-29');
    expect(parsedMixed.taxBreakdown?.base16).toBe(1000);
    expect(parsedMixed.taxBreakdown?.iva16).toBe(160);
    expect(parsedMixed.taxBreakdown?.baseExento).toBe(500);

    const parsedMixedFull = parseCfdiFull(mixedRepXml);
    expect(parsedMixedFull?.fechaPago).toBe('2026-10-29');
    expect(parsedMixedFull?.taxBreakdown?.baseExento).toBe(500);

    // CxC/CxP historical cutoff: payment in Nov must NOT reduce October cutoff balance
    const invOct = makeCfdi({ id: 'i_oct', uuid: 'PPD-OCT', fecha: '2026-10-10', metodoPago: 'PPD', total: 5000 });
    const repNov = makeCfdi({
      id: 'p_nov', uuid: 'REP-NOV', fecha: '2026-11-05', fechaPago: '2026-11-05',
      tipoComprobante: 'P', total: 5000, uuidRelacionado: 'PPD-OCT'
    });
    const agingOct = computeCxcCxpAging({ companyId: 'c_r7', cfdis: [invOct, repNov], asOfIso: '2026-10-31' });
    expect(agingOct.cxcTotal).toBe(5000);
    const agingNov = computeCxcCxpAging({ companyId: 'c_r7', cfdis: [invOct, repNov], asOfIso: '2026-11-30' });
    expect(agingNov.cxcTotal).toBe(0);
  });

  test('3. Rejects non-Comprobante XML, rejects foreign RFC CFDIs on upload, and isolates batch auto-poliza failures without 250 cap', () => {
    expect(() => parseCfdiXmlString('<NotACfdi><Foo Bar="1"/></NotACfdi>')).toThrow('CFDI_INVALID_ROOT');

    const company = createCompanyRecord({
      name: 'Empresa Receptora R7',
      rfc: 'ERR260101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 10
    });
    createdCompanyIds.push(company.id);

    const foreignXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-10T10:00:00" TipoDeComprobante="I" SubTotal="1000.00" Total="1160.00" Moneda="MXN" MetodoPago="PUE">
  <cfdi:Emisor Rfc="OTRO010101AA1" Nombre="OTRO EMISOR" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="AJEN010101BB2" Nombre="CLIENTE B" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="80101500" Cantidad="1" ClaveUnidad="E48" Descripcion="Venta ajena" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02"/></cfdi:Conceptos>
  <cfdi:Complemento><tfd:TimbreFiscalDigital UUID="FOREIGN-UUID-1111" FechaTimbrado="2026-10-10T10:01:00"/></cfdi:Complemento>
</cfdi:Comprobante>`;

    const validXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-11T10:00:00" TipoDeComprobante="I" SubTotal="500.00" Total="580.00" Moneda="MXN" MetodoPago="PUE">
  <cfdi:Emisor Rfc="PRO010101PP1" Nombre="PROVEEDOR" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${company.rfc}" Nombre="${company.name}" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="80101500" Cantidad="1" ClaveUnidad="E48" Descripcion="Servicio" ValorUnitario="500.00" Importe="500.00" ObjetoImp="02"/></cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="80.00"><cfdi:Traslados><cfdi:Traslado Base="500.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="80.00"/></cfdi:Traslados></cfdi:Impuestos>
  <cfdi:Complemento><tfd:TimbreFiscalDigital UUID="VALID-UUID-2222" FechaTimbrado="2026-10-11T10:01:00"/></cfdi:Complemento>
</cfdi:Comprobante>`;

    expect(() => insertParsedCfdiRecord(company, parseCfdiXmlString(foreignXml))).toThrow(
      'no corresponde al RFC de la empresa'
    );

    const batchRes = batchUploadCfdiXmlStrings(company, [foreignXml, validXml]);
    expect(batchRes.uploaded).toHaveLength(1);
    expect(batchRes.rejectedForeign).toBe(1);

    // One bad CFDI (CANCELADO) in batchGenerateAutoPolizasFromCfdiIds must not roll back valid one
    const validDoc = batchRes.uploaded[0]!;
    const badDoc = insertParsedCfdiRecord(company, {
      ...parseCfdiXmlString(validXml),
      uuid: 'CANCELADO-UUID-3333',
      xmlRaw: validXml
    });
    // Mark badDoc as CANCELADO directly to force failure inside buildAutoPolizaPlan
    const { db } = require('../src/server/connection') as typeof import('../src/server/connection');
    db.prepare("UPDATE cfdi_documents SET status_sat = 'CANCELADO' WHERE id = ?").run(badDoc.id);

    const polBatch = batchGenerateAutoPolizasFromCfdiIds([badDoc.id, validDoc.id]);
    expect(polBatch.created).toBe(1);
    expect(polBatch.failed).toBe(1);
    expect(polBatch.skipped).toBe(0);
  });

  test('4. Payroll SUA/ISN avoids 601-01-010, routes ISN to 601-01-011 & 213-01-004, and filters summary by fechaPago', () => {
    const accounts = makeSeedAccounts();
    const res = computeSuaAndIsnProvision(
      {
        stateCode: 'CMX',
        ejercicio: 2026,
        periodo: 10,
        baseGravableNomina: 100_000,
        imssPatronal: 12_000,
        rcv: 3_000,
        infonavit: 5_000
      },
      accounts
    );
    expect(res.polizaMovements.some((m) => m.accountCode === '601-01-010')).toBe(false);
    expect(res.polizaMovements.some((m) => m.accountCode === '601-01-007' && m.cargo === 12000)).toBe(true);
    expect(res.polizaMovements.some((m) => m.accountCode === '601-01-011' && m.cargo === 4000)).toBe(true);
    expect(res.polizaMovements.some((m) => m.accountCode === '213-01-004' && m.abono === 4000)).toBe(true);

    const nomOctPaidInNov = makeCfdi({
      id: 'nom1',
      tipoComprobante: 'N',
      direction: 'EMITIDO',
      fecha: '2026-10-31',
      fechaPago: '2026-11-01',
      subtotal: 10000,
      isrRetenido: 1000,
      descuento: 200,
      total: 8800,
      xmlRaw: ''
    });
    const sumOct = computePayrollPeriodSummary({
      cfdis: [nomOctPaidInNov],
      trialBalance: [],
      ejercicio: 2026,
      periodo: 10
    });
    const sumNov = computePayrollPeriodSummary({
      cfdis: [nomOctPaidInNov],
      trialBalance: [],
      ejercicio: 2026,
      periodo: 11
    });
    expect(sumOct.nominaCount).toBe(0);
    expect(sumNov.nominaCount).toBe(1);
  });

  test('5. Credit Note on PPD/Forma 15/17/30/99 avoids 102 Bancos, PPD retentions use 216-02-*, local taxes use 213-01-009, and SAT 800-899 are ORDEN', () => {
    const accounts = makeSeedAccounts();
    const ncForma15 = makeCfdi({
      tipoComprobante: 'E',
      direction: 'EMITIDO',
      metodoPago: 'PUE',
      formaPago: '15',
      subtotal: 1000,
      ivaTrasladado: 160,
      total: 1160
    });
    const planNc15 = buildAutoPolizaPlan(ncForma15, accounts);
    expect(planNc15.movements.some((m) => m.accountCode.startsWith('102-'))).toBe(false);
    expect(planNc15.movements.some((m) => m.accountCode.startsWith('105-') && m.abono === 1160)).toBe(true);
    expect(planNc15.movements.some((m) => m.accountCode.startsWith('209-') && m.cargo === 160)).toBe(true);

    const ncRelPpd = makeCfdi({
      tipoComprobante: 'E',
      direction: 'RECIBIDO',
      metodoPago: 'PUE',
      formaPago: '03',
      subtotal: 500,
      ivaTrasladado: 80,
      total: 580
    });
    const planNcRel = buildAutoPolizaPlan(ncRelPpd, accounts, { relatedIsPpd: true });
    expect(planNcRel.movements.some((m) => m.accountCode.startsWith('102-'))).toBe(false);
    expect(planNcRel.movements.some((m) => m.accountCode.startsWith('201-') && m.cargo === 580)).toBe(true);
    expect(planNcRel.movements.some((m) => m.accountCode.startsWith('119-') && m.abono === 80)).toBe(true);

    // PPD RECIBIDO retentions -> 216-02-001 / 216-02-002; REP reclassifies 216-02-* -> 216-01-*
    const ppdRet = makeCfdi({
      direction: 'RECIBIDO',
      metodoPago: 'PPD',
      formaPago: '99',
      subtotal: 10000,
      ivaTrasladado: 1600,
      isrRetenido: 1000,
      ivaRetenido: 1066.67,
      total: 9533.33
    });
    const planPpdRet = buildAutoPolizaPlan(ppdRet, accounts);
    expect(planPpdRet.movements.some((m) => m.accountCode === '216-02-001' && m.abono === 1000)).toBe(true);
    expect(planPpdRet.movements.some((m) => m.accountCode === '216-02-002' && m.abono === 1066.67)).toBe(true);

    const repPay = makeCfdi({
      tipoComprobante: 'P',
      direction: 'RECIBIDO',
      subtotal: 10000,
      ivaTrasladado: 1600,
      isrRetenido: 1000,
      ivaRetenido: 1066.67,
      total: 9533.33
    });
    const planRepPay = buildAutoPolizaPlan(repPay, accounts);
    expect(planRepPay.movements.some((m) => m.accountCode === '216-02-001' && m.cargo === 1000)).toBe(true);
    expect(planRepPay.movements.some((m) => m.accountCode === '216-01-004' && m.abono === 1000)).toBe(true);
    expect(planRepPay.movements.some((m) => m.accountCode === '216-02-002' && m.cargo === 1066.67)).toBe(true);
    expect(planRepPay.movements.some((m) => m.accountCode === '216-01-002' && m.abono === 1066.67)).toBe(true);

    // Local tax routes to 213-01-009 before 213-01-001
    const ishCfdi = makeCfdi({
      direction: 'EMITIDO',
      subtotal: 1000,
      ivaTrasladado: 160,
      total: 1190,
      taxBreakdown: { base16: 1000, iva16: 160, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0, localTrasladado: 30 } as CfdiDocument['taxBreakdown']
    });
    const planIsh = buildAutoPolizaPlan(ishCfdi, accounts);
    expect(planIsh.movements.some((m) => m.accountCode === '213-01-009' && m.abono === 30)).toBe(true);

    // Seed & SAT catalog integrity
    const acc21605 = accounts.find((a) => a.code === '216-01-005');
    expect(acc21605?.satGroupCode).not.toBe('216.11');
    expect(accounts.find((a) => a.code === '601-01-006')?.satGroupCode).toBe('613.01');
    expect(accounts.find((a) => a.code === '171-01-001')?.satGroupCode).toBe('171.01');
    const ordenCodes = SAT_GROUP_CODES.filter((s) => /^8\d\d/.test(s.code));
    expect(ordenCodes.length).toBeGreaterThan(0);
    expect(ordenCodes.every((s) => s.type === 'ORDEN')).toBe(true);
  });

  test('6. Bank CSV multi-line header & tab delimiter, occurrence-count deduplication, and catalogoCsvIo round-trip', () => {
    const bbvaPreambleCsv = [
      'BBVA MEXICO S.A.',
      'Estado de Cuenta Empresarial',
      'Cuenta: 0123456789',
      'Moneda: MXN',
      'Fecha de corte: 31/10/2026',
      'Fecha\tConcepto\tReferencia\tCargo\tAbono\tSaldo',
      '15/10/2026\tPAGO PROVEEDOR SPEI\tREF-001\t1,250.50\t0.00\t8,749.50',
      '16/10/2026\tDEPOSITO CLIENTE\tREF-002\t0.00\t3,500.00\t12,249.50'
    ].join('\n');

    const parsedBank = parseBankStatementCsv(bbvaPreambleCsv, '2026-10-31');
    expect(parsedBank).toHaveLength(2);
    expect(parsedBank[0]).toMatchObject({
      fecha: '2026-10-15',
      descripcion: 'PAGO PROVEEDOR SPEI',
      cargoBanco: 1250.5,
      abonoBanco: 0
    });
    expect(parsedBank[1]).toMatchObject({
      fecha: '2026-10-16',
      descripcion: 'DEPOSITO CLIENTE',
      cargoBanco: 0,
      abonoBanco: 3500
    });

    // Occurrence-count deduplication preserves legitimate second identical withdrawal
    const existingDbRows = [
      { fecha: '2026-10-15', descripcion: 'COMISION SPEI', cargo_banco: 50, abono_banco: 0 }
    ];
    const incomingLines = [
      { fecha: '2026-10-15', referencia: 'R1', descripcion: 'COMISION SPEI', cargoBanco: 50, abonoBanco: 0 },
      { fecha: '2026-10-15', referencia: 'R2', descripcion: 'COMISION SPEI', cargoBanco: 50, abonoBanco: 0 }
    ];
    const toInsert = deduplicateBankLinesByOccurrence(incomingLines, existingDbRows);
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0]?.referencia).toBe('R2');

    // Catalogo CSV round-trip: Saldo Inicial Acumulado (col 7) vs Saldo Apertura Enero (col 8)
    const exportedCsv = [
      'Código Cuenta,Nombre de la Cuenta,Código Agrupador SAT,Rubro,Naturaleza,Nivel,Afectable,Saldo Inicial Acumulado,Saldo Apertura Enero,Cargos del Periodo,Abonos del Periodo,Saldo Final,Cuenta Padre',
      '102-01-001,Bancos Nacionales,102.01,ACTIVO,DEUDORA,3,Sí,95000,10000,5000,2000,98000,102-00-000'
    ].join('\n');
    const parsedCat = parseCatalogoCsvWithReport(exportedCsv);
    expect(parsedCat.rows).toHaveLength(1);
    expect(parsedCat.rows[0]?.initialBalance).toBe(10000);
  });

  test('7. SQLite computeTrialBalance zeroes prior-year P&L initialBalances and getAccountLedger sorts chronologically', () => {
    const company = createCompanyRecord({
      name: 'Empresa Rollover R7',
      rfc: 'ERL260101AA1',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 2
    });
    createdCompanyIds.push(company.id);

    const accounts = getAccounts(company.id);
    const bank = accounts.find((a) => a.code === '102-01-001')!;
    const sales = accounts.find((a) => a.code === '401-01-001')!;

    // Prior-year 2025 movement
    createPolizaTransaction({
      companyId: company.id,
      tipo: 'INGRESO',
      fecha: '2025-12-15',
      ejercicio: 2025,
      periodo: 12,
      concepto: 'Venta 2025',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bank.id, referencia: '2025', concepto: 'Cobro', cargo: 1000, abono: 0 },
        { accountId: sales.id, referencia: '2025', concepto: 'Venta', cargo: 0, abono: 1000 }
      ]
    });

    // Out-of-order 2026 movements in period 1 and period 2
    createPolizaTransaction({
      companyId: company.id,
      tipo: 'INGRESO',
      fecha: '2026-02-20',
      ejercicio: 2026,
      periodo: 2,
      concepto: 'Mov Feb 20',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bank.id, referencia: 'F2', concepto: 'Cobro 2', cargo: 300, abono: 0 },
        { accountId: sales.id, referencia: 'F2', concepto: 'Venta 2', cargo: 0, abono: 300 }
      ]
    });
    createPolizaTransaction({
      companyId: company.id,
      tipo: 'INGRESO',
      fecha: '2026-01-05',
      ejercicio: 2026,
      periodo: 1,
      concepto: 'Mov Ene 05',
      cfdiUuid: null,
      origin: 'MANUAL',
      movements: [
        { accountId: bank.id, referencia: 'F1', concepto: 'Cobro 1', cargo: 200, abono: 0 },
        { accountId: sales.id, referencia: 'F1', concepto: 'Venta 1', cargo: 0, abono: 200 }
      ]
    });

    const tb2026 = computeTrialBalance(company.id, 2026, 1);
    const salesRow = tb2026.find((a) => a.code === '401-01-001')!;
    const accumRow = tb2026.find((a) => a.code === '301-02-001')!;
    // 2025 sales did not leak into 2026 401 initialBalance; rolled into 301-02-001
    expect(salesRow.initialBalanceComputed).toBe(0);
    expect(accumRow.initialBalanceComputed).toBe(1000);

    const ledger = getAccountLedger(company.id, bank.id, 2026, 1, 2)!;
    expect(ledger.entries.map((e) => e.fecha)).toEqual(['2026-01-05', '2026-02-20']);
    expect(ledger.entries[0]!.runningBalance).toBe(ledger.initialBalance + 200);
    expect(ledger.entries[1]!.runningBalance).toBe(ledger.initialBalance + 500);
  });
});

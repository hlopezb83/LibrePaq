import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { api } from '../src/server/api';
import {
  createCompanyRecord,
  db,
  deleteCompanyRecord,
  generateAutoPolizaFromCfdiId,
  getCfdiDocuments,
  getDiotReport,
  initDatabase,
  insertParsedCfdiRecord,
  upsertThirdPartyRecord
} from '../src/server/db';
import { parseCfdiXmlString } from '../src/shared/cfdi-xml';
import {
  buildParsedCfdiInsertRow,
  mapSupabaseCfdi
} from '../src/lib/supabase/supabase-cfdi-mappers';
import type { CxcCxpAgingResponse, SatBatchVerifyResult } from '../src/shared/types';

describe('Ola 1 Bloque 1B — SQLite, Hono Routes & Supabase Adapters', () => {
  const createdCompanyIds: string[] = [];

  beforeAll(() => {
    initDatabase();
  });

  afterAll(() => {
    for (const id of createdCompanyIds) {
      deleteCompanyRecord(id, 'owner_1b');
      deleteCompanyRecord(id);
    }
    db.prepare('DELETE FROM sat_efos_69b WHERE rfc = ?').run('EFO990101XX1');
  });

  test('1. SQLite persists & reads taxBreakdown and relatedDocs, and feeds CxC/CxP + DIOT with thirdParties', async () => {
    const company = createCompanyRecord({
      name: 'Empresa Bloque 1B S.A. de C.V.',
      rfc: 'EBB2105148K2',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 10
    });
    createdCompanyIds.push(company.id);

    const privateCompany = createCompanyRecord({
      name: 'Empresa Privada 1B S.A. de C.V.',
      rfc: 'EPB2105148K3',
      regimenFiscal: '601 - General de Ley Personas Morales',
      codigoPostal: '06000',
      currentYear: 2026,
      currentPeriod: 10,
      userId: 'owner_1b'
    });
    createdCompanyIds.push(privateCompany.id);

    const ppdXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-05T10:00:00" TipoDeComprobante="I" SubTotal="1500.00" Total="1660.00" Moneda="MXN" MetodoPago="PPD">
  <cfdi:Emisor Rfc="${company.rfc}" Nombre="${company.name}" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="CLI010101AA1" Nombre="Cliente PPD" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="50111500" Cantidad="1" ClaveUnidad="H87" Descripcion="Venta Tasa 16" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02"/>
    <cfdi:Concepto ClaveProdServ="50111500" Cantidad="1" ClaveUnidad="H87" Descripcion="Venta Exenta" ValorUnitario="500.00" Importe="500.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="1B111111-1111-4111-8111-111111111111" FechaTimbrado="2026-10-05T10:01:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const repXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-20T12:00:00" TipoDeComprobante="P" SubTotal="0" Total="0" Moneda="XXX">
  <cfdi:Emisor Rfc="${company.rfc}" Nombre="${company.name}" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="CLI010101AA1" Nombre="Cliente PPD" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales TotalTrasladosBaseIVA16="500.00" TotalTrasladosImpuestoIVA16="80.00" MontoTotalPagos="580.00"/>
      <pago20:Pago FechaPago="2026-10-20T11:55:00" FormaDePagoP="03" MonedaP="MXN" Monto="580.00">
        <pago20:DoctoRelacionado IdDocumento="1B111111-1111-4111-8111-111111111111" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="1660.00" ImpPagado="580.00" ImpSaldoInsoluto="1080.00" ObjetoImpDR="02"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital UUID="1B222222-2222-4222-8222-222222222222" FechaTimbrado="2026-10-20T12:01:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    const gastoXml = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-10-12T10:00:00" TipoDeComprobante="I" SubTotal="1000.00" Total="1080.00" Moneda="MXN" MetodoPago="PUE">
  <cfdi:Emisor Rfc="EFO990101XX1" Nombre="Proveedor Frontera" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${company.rfc}" Nombre="${company.name}" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="80101500" Cantidad="1" ClaveUnidad="E48" Descripcion="Servicio Genérico" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="80.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.080000" Importe="80.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="1B333333-3333-4333-8333-333333333333" FechaTimbrado="2026-10-12T10:01:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

    insertParsedCfdiRecord(company, parseCfdiXmlString(ppdXml));
    insertParsedCfdiRecord(company, parseCfdiXmlString(repXml));
    const gastoDoc = insertParsedCfdiRecord(company, parseCfdiXmlString(gastoXml));
    generateAutoPolizaFromCfdiId(gastoDoc.id);

    const list = getCfdiDocuments(company.id, { includeXml: false });
    const ppd = list.find((c) => c.uuid === '1B111111-1111-4111-8111-111111111111');
    const rep = list.find((c) => c.uuid === '1B222222-2222-4222-8222-222222222222');
    expect(ppd?.taxBreakdown).toEqual({
      base16: 1000,
      iva16: 160,
      base8: 0,
      iva8: 0,
      base0: 0,
      baseExento: 500,
      ieps: 0,
      objetoImp: '02'
    });
    expect(rep?.relatedDocs).toHaveLength(1);
    expect(rep?.relatedDocs?.[0]?.impPagado).toBe(580);

    // DIOT usa thirdParties de SQLite
    upsertThirdPartyRecord(company.id, {
      rfc: 'EFO990101XX1',
      nombre: 'Proveedor Frontera',
      rol: 'PROVEEDOR',
      cuentaOperacionCode: '601-01-003',
      cuentaContrapartidaCode: '201-01-099',
      tipoTerceroDiot: '05',
      tipoOperacionDiot: '03',
      tasaIvaDefault: 8,
      estatus69B: 'LIMPIO'
    });
    const diot = getDiotReport(company.id, 2026, 10);
    expect(diot.rows).toHaveLength(1);
    expect(diot.rows[0]?.tipoTercero).toBe('05');
    expect(diot.rows[0]?.tipoOperacion).toBe('03');
    expect(diot.rows[0]?.actosPagados8).toBe(1000);

    // Hono GET /api/companies/:companyId/cxc-cxp (tenant isolation + aging)
    const deniedCxc = await api.request(`/api/companies/${privateCompany.id}/cxc-cxp`, {
      headers: { 'X-User-Id': 'other_user' }
    });
    expect(deniedCxc.status).toBe(403);

    const allowedPrivateCxc = await api.request(`/api/companies/${privateCompany.id}/cxc-cxp`, {
      headers: { 'X-User-Id': 'owner_1b' }
    });
    expect(allowedPrivateCxc.status).toBe(200);

    const okCxc = await api.request(`/api/companies/${company.id}/cxc-cxp`);
    expect(okCxc.status).toBe(200);
    const aging = (await okCxc.json()) as CxcCxpAgingResponse;
    expect(aging.cxcTotal).toBe(1080);
    expect(aging.cxcItems).toHaveLength(1);
    expect(aging.cxcItems[0]?.parcialidades).toHaveLength(1);

    // Hono POST /api/companies/:companyId/cfdis/verify-sat-batch (EFOS 69-B + cancelledWithPoliza)
    db.prepare(
      `INSERT OR REPLACE INTO sat_efos_69b (rfc, nombre, situacion, fecha_publicacion, updated_at)
       VALUES ('EFO990101XX1', 'Proveedor Frontera', 'DEFINITIVO', '2026-09-01', datetime('now'))`
    ).run();
    db.prepare('UPDATE cfdi_documents SET status_sat = ? WHERE id = ?').run('CANCELADO', gastoDoc.id);

    const deniedBatch = await api.request(`/api/companies/${privateCompany.id}/cfdis/verify-sat-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': 'other_user' },
      body: JSON.stringify({ cfdiIds: [gastoDoc.id] })
    });
    expect(deniedBatch.status).toBe(403);

    const okBatch = await api.request(`/api/companies/${company.id}/cfdis/verify-sat-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cfdiIds: [gastoDoc.id, ppd!.id] })
    });
    expect(okBatch.status).toBe(200);
    const batchRes = (await okBatch.json()) as SatBatchVerifyResult;
    expect(batchRes.checkedCount).toBe(2);
    expect(batchRes.cancelledWithPolizaCount).toBe(1);
    const cancelledItem = batchRes.items.find((i) => i.cfdiId === gastoDoc.id);
    expect(cancelledItem?.hadPoliza).toBe(true);
    expect(cancelledItem?.cancelledWithPoliza).toBe(true);
    expect(cancelledItem?.validacionEfos).toBe('100_PRESUNTO_O_DEFINITIVO_69B');
  });

  test('2. Supabase CFDI mappers persist and hydrate tax_breakdown and related_docs', () => {
    const parsed = {
      uuid: 'UUID-MAP-1',
      fecha: '2026-10-15',
      tipoComprobante: 'P' as const,
      serie: 'REP',
      folio: '10',
      emisorRfc: 'AAA010101AAA',
      emisorNombre: 'Emisor',
      receptorRfc: 'BBB010101BBB',
      receptorNombre: 'Receptor',
      conceptoPrincipal: 'Pago',
      claveProdServ: '84111506',
      moneda: 'MXN',
      tipoCambio: 1,
      subtotal: 1000,
      descuento: 0,
      ivaTrasladado: 160,
      isrRetenido: 0,
      ivaRetenido: 0,
      total: 1160,
      metodoPago: 'PUE' as const,
      formaPago: '03',
      usoCfdi: 'CP01',
      taxBreakdown: { base16: 1000, iva16: 160, base8: 0, iva8: 0, base0: 0, baseExento: 0, ieps: 0 },
      relatedDocs: [
        {
          idDocumento: 'DOC-1',
          numParcialidad: 1,
          impSaldoAnt: 2320,
          impPagado: 1160,
          impSaldoInsoluto: 1160
        }
      ],
      xmlRaw: '<xml/>'
    };

    const insertRow = buildParsedCfdiInsertRow('id-1', 'comp-1', parsed, 'EMITIDO', '<xml/>');
    expect(insertRow.tax_breakdown).toEqual(parsed.taxBreakdown);
    expect(insertRow.related_docs).toEqual(parsed.relatedDocs);

    const hydrated = mapSupabaseCfdi(insertRow as unknown as Record<string, unknown>);
    expect(hydrated.taxBreakdown).toEqual(parsed.taxBreakdown);
    expect(hydrated.relatedDocs).toEqual(parsed.relatedDocs);
  });
});

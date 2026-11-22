import { Hono } from 'hono';
import {
  batchGenerateAutoPolizasFromCfdiIds,
  batchUploadCfdiXmlStrings,
  deleteCfdiRecord,
  generateAutoPolizaFromCfdiId,
  getCfdiDocuments,
  getCfdiXml,
  getCompanyById,
  insertParsedCfdiRecord,
  verifyCfdiStatusViaSatSoap
} from '../db';
import { fromCents, toCents } from '../../shared/accounting-engine';
import { buildCfdi40Xml, parseCfdiXmlString, type ParsedCfdiPayload } from '../../shared/cfdi-xml';
import { getDefaultDateForPeriod } from '../../shared/date-utils';
import { errorStatus } from './route-helpers';

export const cfdiRoutes = new Hono();

function buildSimulatedCfdiPayload(
  body: Record<string, unknown>,
  company: { rfc: string; name: string; currentYear: number; currentPeriod: number }
): ParsedCfdiPayload {
  const direction = body.direction === 'EMITIDO' ? 'EMITIDO' : 'RECIBIDO';
  const rawTipo = String(body.tipoComprobante ?? 'I').toUpperCase();
  const tipoComprobante = (['I', 'E', 'P', 'N'].includes(rawTipo) ? rawTipo : 'I') as
    | 'I'
    | 'E'
    | 'P'
    | 'N';
  const subtotal = fromCents(toCents(Number(body.subtotal ?? 42000)));
  const ivaTrasladado =
    tipoComprobante === 'N' ? 0 : fromCents(Math.round(toCents(subtotal) * 0.16));
  const isrRetenido = fromCents(toCents(Number(body.isrRetenido ?? 0)));
  const ivaRetenido = fromCents(toCents(Number(body.ivaRetenido ?? 0)));
  const total = fromCents(
    toCents(subtotal) + toCents(ivaTrasladado) - toCents(isrRetenido) - toCents(ivaRetenido)
  );
  const uuid = crypto.randomUUID().toUpperCase();
  const defaultDate = getDefaultDateForPeriod(company.currentYear, company.currentPeriod);

  const basePayload = {
    uuid,
    fecha: String(body.fecha ?? '').slice(0, 10) || defaultDate,
    tipoComprobante,
    serie:
      tipoComprobante === 'P'
        ? 'REP'
        : tipoComprobante === 'N'
          ? 'NOM'
          : direction === 'EMITIDO'
            ? 'FAC'
            : 'PROV',
    folio: String(Math.floor(1000 + Math.random() * 9000)),
    emisorRfc:
      direction === 'EMITIDO'
        ? company.rfc
        : String(body.counterpartyRfc ?? 'PRO180214A99').toUpperCase(),
    emisorNombre:
      direction === 'EMITIDO'
        ? company.name
        : String(body.counterpartyName ?? 'Proveedor Cloud Tecnológico S.A. de C.V.'),
    receptorRfc:
      direction === 'EMITIDO'
        ? String(body.counterpartyRfc ?? 'CLI200411B77').toUpperCase()
        : company.rfc,
    receptorNombre:
      direction === 'EMITIDO'
        ? String(body.counterpartyName ?? 'Cliente Empresarial del Norte S.A. de C.V.')
        : company.name,
    conceptoPrincipal:
      String(body.conceptoPrincipal ?? '').trim() ||
      (tipoComprobante === 'P'
        ? 'Complemento de Pago REP 2.0 Liquidación de Factura PPD'
        : direction === 'EMITIDO'
          ? 'Servicio de Consultoría e Integración Cloud API'
          : 'Licenciamiento de Seguridad y Monitoreo Cloud'),
    claveProdServ: tipoComprobante === 'P' ? '84111506' : '81112501',
    moneda: 'MXN',
    tipoCambio: 1,
    subtotal,
    descuento: 0,
    ivaTrasladado,
    isrRetenido,
    ivaRetenido,
    total,
    metodoPago: (body.metodoPago === 'PPD' && tipoComprobante === 'I' ? 'PPD' : 'PUE') as
      | 'PUE'
      | 'PPD',
    formaPago: body.metodoPago === 'PPD' ? '99' : '03',
    usoCfdi: tipoComprobante === 'P' ? 'CP01' : 'G03',
    uuidRelacionado: body.uuidRelacionado ? String(body.uuidRelacionado) : null
  };

  return { ...basePayload, xmlRaw: buildCfdi40Xml(basePayload) };
}

cfdiRoutes.get('/cfdis', (c) => {
  const companyId = c.req.query('companyId') || 'comp_tnn_01';
  return c.json(getCfdiDocuments(companyId));
});

cfdiRoutes.post('/cfdis/upload', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const company = getCompanyById(companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const parsed =
      typeof body.xmlRaw === 'string' && body.xmlRaw.trim().length > 0
        ? parseCfdiXmlString(body.xmlRaw)
        : buildSimulatedCfdiPayload(body, company);

    const created = insertParsedCfdiRecord(company, parsed);
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err, 409);
    return c.json({ error: message }, status);
  }
});

cfdiRoutes.post('/cfdis/batch-upload', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const companyId = String(body.companyId ?? 'comp_tnn_01');
    const company = getCompanyById(companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    const xmlList = Array.isArray(body.xmlList)
      ? body.xmlList.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];

    const result = batchUploadCfdiXmlStrings(company, xmlList);
    return c.json(result, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

cfdiRoutes.post('/cfdis/batch-auto-poliza', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cfdiIds = Array.isArray(body.cfdiIds)
      ? body.cfdiIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

    const result = batchGenerateAutoPolizasFromCfdiIds(cfdiIds, {
      operationAccountCode: body.operationAccountCode
        ? String(body.operationAccountCode)
        : undefined,
      counterAccountCode: body.counterAccountCode ? String(body.counterAccountCode) : undefined
    });
    return c.json(result, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

cfdiRoutes.post('/cfdis/:id/auto-poliza', async (c) => {
  try {
    const cfdiId = c.req.param('id');
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const created = generateAutoPolizaFromCfdiId(cfdiId, {
      operationAccountCode: body.operationAccountCode
        ? String(body.operationAccountCode)
        : undefined,
      counterAccountCode: body.counterAccountCode ? String(body.counterAccountCode) : undefined
    });
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

cfdiRoutes.delete('/cfdis/:id', (c) => {
  try {
    const cfdiId = c.req.param('id');
    const res = deleteCfdiRecord(cfdiId);
    if (!res.found) return c.json({ error: 'CFDI no encontrado en el ADD.' }, 404);
    if (res.hasPoliza) {
      return c.json(
        {
          error:
            'No se puede eliminar un CFDI que ya está contabilizado. Elimina primero su póliza contable asociada.'
        },
        400
      );
    }
    return c.json({ deleted: true });
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

cfdiRoutes.get('/cfdis/:id/xml', (c) => {
  const cfdiId = c.req.param('id');
  const xml = getCfdiXml(cfdiId);
  if (!xml) return c.json({ error: 'CFDI o XML no encontrado.' }, 404);
  return c.json({ xmlRaw: xml });
});

cfdiRoutes.post('/cfdis/:id/verify-sat', async (c) => {
  try {
    const cfdiId = c.req.param('id');
    const res = await verifyCfdiStatusViaSatSoap(cfdiId);
    return c.json(res);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

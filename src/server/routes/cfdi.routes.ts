import { Hono } from 'hono';
import {
  readBodyCompanyId,
  readQueryCompanyId,
  rejectNonStringBodyCompanyId,
  resolveRequestActor
} from '../auth-actor';
import {
  batchGenerateAutoPolizasFromCfdiIds,
  batchUploadCfdiXmlStrings,
  db,
  deleteCfdiRecord,
  generateAutoPolizaFromCfdiId,
  getCfdiDocuments,
  getCfdiXml,
  insertParsedCfdiRecord,
  verifyCfdisSatBatchRepo,
  verifyCfdiStatusViaSatSoap
} from '../db';
import type { BatchPolizaGroupingMode } from '../../shared/engine/auto-poliza-types';
import { parseCfdiXmlString } from '../../shared/cfdi-xml';
import type { ForeignNoCfdiPayload } from '../../shared/cfdi-xml-foreign';
import { insertForeignNoCfdiRecord } from '../repositories/cfdi-batch.repo';
import { assertRouteCompanyAccess, errorStatus, getAuthorizedCompanyForRoute } from './route-helpers';

export const cfdiRoutes = new Hono();

cfdiRoutes.get('/cfdis', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return denied;
  return c.json(getCfdiDocuments(q.companyId));
});

cfdiRoutes.post('/cfdis/upload', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const company = getAuthorizedCompanyForRoute(c, cid.companyId);
    if (!company) return c.json({ error: 'Empresa no encontrada' }, 404);

    if (typeof body.xmlRaw === 'string' && body.xmlRaw.trim().length > 0 && !body.isForeignNoCfdi) {
      const parsed = parseCfdiXmlString(body.xmlRaw);
      const created = insertParsedCfdiRecord(company, parsed);
      return c.json(created, 201);
    }

    const created = insertForeignNoCfdiRecord(company, {
      ...(body as unknown as ForeignNoCfdiPayload),
      companyId: cid.companyId,
      isForeignNoCfdi: true
    });
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err, 409);
    return c.json({ error: message }, status);
  }
});

cfdiRoutes.post('/cfdis/batch-upload', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;
    const company = getAuthorizedCompanyForRoute(c, cid.companyId);
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

function parseAutoPolizaOverrides(body: Record<string, unknown>) {
  const rawPct = body.deductiblePct;
  const deductiblePct =
    rawPct !== undefined && rawPct !== null && rawPct !== '' && Number.isFinite(Number(rawPct))
      ? Number(rawPct)
      : undefined;
  const rawGroup = typeof body.groupingMode === 'string' ? body.groupingMode.trim().toUpperCase() : '';
  const groupingMode: BatchPolizaGroupingMode | undefined =
    rawGroup === 'PER_CFDI' || rawGroup === 'BY_DAY' || rawGroup === 'BY_RFC' || rawGroup === 'BY_NOMINA'
      ? rawGroup
      : undefined;
  return {
    operationAccountCode: body.operationAccountCode ? String(body.operationAccountCode) : undefined,
    counterAccountCode: body.counterAccountCode ? String(body.counterAccountCode) : undefined,
    deductiblePct,
    ...(groupingMode ? { groupingMode } : {}),
    ...(body.allowEfos69B === true ? { allowEfos69B: true } : {})
  };
}

cfdiRoutes.post('/cfdis/batch-auto-poliza', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const nonStr = rejectNonStringBodyCompanyId(c, body);
    if (nonStr) return nonStr;
    const cfdiIds = Array.isArray(body.cfdiIds)
      ? body.cfdiIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];

    if (cfdiIds.length > 0) {
      const placeholders = cfdiIds.map(() => '?').join(', ');
      const companyRows = db
        .query(`SELECT DISTINCT company_id FROM cfdi_documents WHERE id IN (${placeholders})`)
        .all(...cfdiIds) as Array<{ company_id: string }>;
      for (const row of companyRows) {
        const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
        if (denied) return denied;
      }
    }

    const result = batchGenerateAutoPolizasFromCfdiIds(cfdiIds, parseAutoPolizaOverrides(body));
    return c.json(result, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

cfdiRoutes.post('/cfdis/:id/auto-poliza', async (c) => {
  try {
    const cfdiId = c.req.param('id');
    const row = db
      .query('SELECT company_id FROM cfdi_documents WHERE id = ?')
      .get(cfdiId) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'CFDI no encontrado en el ADD.' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;

    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const nonStr = rejectNonStringBodyCompanyId(c, body);
    if (nonStr) return nonStr;
    const created = generateAutoPolizaFromCfdiId(cfdiId, parseAutoPolizaOverrides(body));
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

cfdiRoutes.delete('/cfdis/:id', (c) => {
  try {
    const cfdiId = c.req.param('id');
    const row = db
      .query('SELECT company_id FROM cfdi_documents WHERE id = ?')
      .get(cfdiId) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'CFDI no encontrado en el ADD.' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;

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
  const row = db
    .query('SELECT company_id FROM cfdi_documents WHERE id = ?')
    .get(cfdiId) as { company_id?: string } | null;
  if (!row?.company_id) return c.json({ error: 'CFDI o XML no encontrado.' }, 404);
  const denied = assertRouteCompanyAccess(c, row.company_id);
  if (denied) return denied;

  const xml = getCfdiXml(cfdiId);
  if (!xml) return c.json({ error: 'CFDI o XML no encontrado.' }, 404);
  return c.json({ xmlRaw: xml });
});

cfdiRoutes.post('/cfdis/:id/verify-sat', async (c) => {
  try {
    const cfdiId = c.req.param('id');
    const row = db
      .query('SELECT company_id FROM cfdi_documents WHERE id = ?')
      .get(cfdiId) as { company_id?: string } | null;
    if (!row?.company_id) return c.json({ error: 'CFDI no encontrado en el ADD.' }, 404);
    const denied = assertRouteCompanyAccess(c, row.company_id, { requireWrite: true });
    if (denied) return denied;

    const res = await verifyCfdiStatusViaSatSoap(cfdiId);
    return c.json(res);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

cfdiRoutes.post('/companies/:companyId/cfdis/verify-sat-batch', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const denied = assertRouteCompanyAccess(c, companyId, { requireWrite: true });
    if (denied) return denied;
    const { userId } = resolveRequestActor(c);
    const body = (await c.req.json().catch(() => ({}))) as { cfdiIds?: unknown };
    const cfdiIds = Array.isArray(body.cfdiIds)
      ? body.cfdiIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    const res = await verifyCfdisSatBatchRepo(companyId, cfdiIds, userId);
    return c.json(res);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

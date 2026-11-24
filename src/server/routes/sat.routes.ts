import { Hono } from 'hono';
import { readBodyCompanyId, readQueryCompanyId } from '../auth-actor';
import {
  executeSatSoapMassiveDownload,
  generateAndInstallTestFielForCompany,
  getFielCredentialStatus,
  getSatDownloadRequests,
  saveFielCredentialsForCompany
} from '../db';
import { assertRouteCompanyAccess, errorStatus } from './route-helpers';

export const satRoutes = new Hono();

satRoutes.get('/sat/fiel', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return denied;
  return c.json(getFielCredentialStatus(q.companyId));
});

satRoutes.post('/sat/fiel', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, {
      requireWrite: true,
      minRole: 'CONTADOR'
    });
    if (denied) return denied;

    const cerBase64 = String(body.cerBase64 ?? '');
    const keyBase64 = String(body.keyBase64 ?? '');
    const passphrase = String(body.passphrase ?? '');

    const status = saveFielCredentialsForCompany(cid.companyId, {
      cerBase64,
      keyBase64,
      passphrase
    });
    return c.json(status);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

satRoutes.post('/sat/fiel/generate-test', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, {
      requireWrite: true,
      minRole: 'CONTADOR'
    });
    if (denied) return denied;

    const passphrase = String(body.passphrase ?? 'Contpaq2026');
    const result = generateAndInstallTestFielForCompany(cid.companyId, passphrase);
    return c.json(result);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

satRoutes.get('/sat/requests', (c) => {
  const q = readQueryCompanyId(c);
  if (!q.ok) return q.response;
  const denied = assertRouteCompanyAccess(c, q.companyId);
  if (denied) return denied;
  return c.json(getSatDownloadRequests(q.companyId));
});

satRoutes.post('/sat/soap-download', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;

    const tipoSolicitud =
      String(body.tipoSolicitud ?? 'RECIBIDOS').toUpperCase() === 'EMITIDOS'
        ? 'EMITIDOS'
        : 'RECIBIDOS';
    const fechaInicial = String(body.fechaInicial ?? '2026-10-01');
    const fechaFinal = String(body.fechaFinal ?? '2026-10-31');
    const modoEjecucion =
      String(body.modoEjecucion ?? 'SANDBOX_CRYPTO').toUpperCase() === 'SAT_LIVE'
        ? 'SAT_LIVE'
        : 'SANDBOX_CRYPTO';

    const res = await executeSatSoapMassiveDownload(cid.companyId, {
      tipoSolicitud,
      fechaInicial,
      fechaFinal,
      modoEjecucion
    });
    return c.json(res, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

satRoutes.post('/sat/verify-pending', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const cid = readBodyCompanyId(c, body);
    if (!cid.ok) return cid.response;
    const denied = assertRouteCompanyAccess(c, cid.companyId, { requireWrite: true });
    if (denied) return denied;

    const requests = getSatDownloadRequests(cid.companyId);
    const finished = requests.filter((r) => r.estadoSolicitud === 'TERMINADA');
    const downloadedTotal = finished.reduce((acc, r) => acc + (r.cfdisDescargados || 0), 0);
    return c.json({
      ok: true,
      updatedCount: requests.length,
      downloadedCount: downloadedTotal,
      message: `Verificación completada para ${requests.length} solicitudes del SAT.`,
      results: requests
    });
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

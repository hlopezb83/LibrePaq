import { Hono } from 'hono';
import { resolveRequestActor, resolveRequestActorAsync } from '../auth-actor';
import {
  companyExistsById,
  createCompanyRecord,
  deleteCompanyRecord,
  exportCompanyBackupBundle,
  getCompanies,
  getCompanyById,
  restoreCompanyBackupBundle,
  updateCompanyPeriodRecord,
  updateCompanyRecord
} from '../db';
import { validateCompanyPayload, validatePeriodPayload } from '../validators';
import { assertRouteCompanyAccess, errorStatus } from './route-helpers';
import type { CompanyBackupBundle } from '../../shared/types';

export const companiesRoutes = new Hono();

companiesRoutes.use('/companies*', async (c, next) => {
  const actor = await resolveRequestActorAsync(c);
  if (actor.authError) return c.json({ error: actor.authError }, 401);
  return next();
});

companiesRoutes.get('/companies', (c) => {
  const actor = resolveRequestActor(c);
  return c.json(getCompanies(actor.userId, actor.userEmail, actor.userName));
});

companiesRoutes.get('/companies/:id', (c) => {
  const id = c.req.param('id');
  const actor = resolveRequestActor(c);
  const company = getCompanyById(id, actor.userId, actor.userEmail);
  if (!company) return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
  return c.json(company);
});

companiesRoutes.post('/companies', async (c) => {
  try {
    const actor = resolveRequestActor(c);
    const payload = validateCompanyPayload(await c.req.json());
    const created = createCompanyRecord({ ...payload, userId: actor.userId });
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

companiesRoutes.put('/companies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const denied = assertRouteCompanyAccess(c, id, {
      requireWrite: true,
      blockDemoWrite: true,
      notFoundWhenNoAccess: true
    });
    if (denied) return denied;

    const actor = resolveRequestActor(c);
    const payload = validateCompanyPayload(await c.req.json());
    const updated = updateCompanyRecord(id, payload, actor.userId, actor.userEmail);
    if (!updated) return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
    return c.json(updated);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

companiesRoutes.delete('/companies/:id', (c) => {
  const id = c.req.param('id');
  const denied = assertRouteCompanyAccess(c, id, {
    requireWrite: true,
    minRole: 'SOCIO',
    blockDemoWrite: true,
    notFoundWhenNoAccess: true
  });
  if (denied) return denied;

  const actor = resolveRequestActor(c);
  const userCompanies = getCompanies(actor.userId, actor.userEmail);
  if (userCompanies.length <= 1) {
    return c.json({ error: 'Debe existir al menos una empresa activa en el sistema.' }, 400);
  }

  const deleted = deleteCompanyRecord(id, actor.userId, actor.userEmail);
  if (!deleted) return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
  return c.json({ deleted: true });
});

companiesRoutes.patch('/companies/:id/period', async (c) => {
  try {
    const id = c.req.param('id');
    const denied = assertRouteCompanyAccess(c, id, {
      requireWrite: true,
      blockDemoWrite: true,
      notFoundWhenNoAccess: true
    });
    if (denied) return denied;

    const actor = resolveRequestActor(c);
    const { currentYear, currentPeriod } = validatePeriodPayload(await c.req.json());
    const updated = updateCompanyPeriodRecord(id, currentYear, currentPeriod, actor.userId, actor.userEmail);
    if (!updated) return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
    return c.json(updated);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

companiesRoutes.get('/companies/:id/backup', (c) => {
  try {
    const id = c.req.param('id');
    const actor = resolveRequestActor(c);
    const company = getCompanyById(id, actor.userId, actor.userEmail);
    if (!company) return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
    return c.json(exportCompanyBackupBundle(id, actor.userId));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

companiesRoutes.post('/companies/restore', async (c) => {
  try {
    const actor = resolveRequestActor(c);
    const bundle = (await c.req.json()) as CompanyBackupBundle;
    if (!bundle?.company?.id || !bundle?.company?.rfc) {
      return c.json({ error: 'Payload de respaldo inválido: company.id y company.rfc son requeridos.' }, 400);
    }
    if (companyExistsById(bundle.company.id)) {
      const denied = assertRouteCompanyAccess(c, bundle.company.id, {
        requireWrite: true,
        minRole: 'SOCIO',
        blockDemoWrite: true
      });
      if (denied) return denied;
    }
    const restored = restoreCompanyBackupBundle(bundle, actor.userId);
    return c.json(restored, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

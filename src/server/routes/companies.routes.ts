import { Hono } from 'hono';
import {
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
import { errorStatus } from './route-helpers';
import type { CompanyBackupBundle } from '../../shared/types';

export const companiesRoutes = new Hono();

companiesRoutes.get('/companies', (c) => {
  const userId = c.req.header('X-User-Id') || c.req.header('x-user-id');
  const userEmail = c.req.header('X-User-Email') || c.req.header('x-user-email');
  const userName = c.req.header('X-User-Name') || c.req.header('x-user-name');
  return c.json(getCompanies(userId, userEmail, userName));
});

companiesRoutes.get('/companies/:id', (c) => {
  const id = c.req.param('id');
  const userId = c.req.header('X-User-Id') || c.req.header('x-user-id');
  const company = getCompanyById(id, userId);
  if (!company) return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
  return c.json(company);
});

companiesRoutes.post('/companies', async (c) => {
  try {
    const userId = c.req.header('X-User-Id') || c.req.header('x-user-id');
    const payload = validateCompanyPayload(await c.req.json());
    const created = createCompanyRecord({ ...payload, userId });
    return c.json(created, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

companiesRoutes.put('/companies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.req.header('X-User-Id') || c.req.header('x-user-id');
    const payload = validateCompanyPayload(await c.req.json());
    const updated = updateCompanyRecord(id, payload, userId);
    if (!updated) return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
    return c.json(updated);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

companiesRoutes.delete('/companies/:id', (c) => {
  const id = c.req.param('id');
  const userId = c.req.header('X-User-Id') || c.req.header('x-user-id');

  // 1. Verificar si la empresa existe y pertenece al usuario solicitante
  const targetCompany = getCompanyById(id, userId);
  if (!targetCompany) {
    return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
  }

  // 2. Verificar que el usuario no se quede sin empresas en su workspace
  const userCompanies = getCompanies(userId);
  if (userCompanies.length <= 1) {
    return c.json({ error: 'Debe existir al menos una empresa activa en el sistema.' }, 400);
  }

  // 3. Proceder con el borrado seguro
  const deleted = deleteCompanyRecord(id, userId);
  if (!deleted) return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
  return c.json({ deleted: true });
});

companiesRoutes.patch('/companies/:id/period', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.req.header('X-User-Id') || c.req.header('x-user-id');
    const { currentYear, currentPeriod } = validatePeriodPayload(await c.req.json());
    const updated = updateCompanyPeriodRecord(id, currentYear, currentPeriod, userId);
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
    const userId = c.req.header('X-User-Id') || c.req.header('x-user-id');
    const company = getCompanyById(id, userId);
    if (!company) return c.json({ error: 'Empresa no encontrada o no autorizada.' }, 404);
    return c.json(exportCompanyBackupBundle(id));
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

companiesRoutes.post('/companies/restore', async (c) => {
  try {
    const userId = c.req.header('X-User-Id') || c.req.header('x-user-id') || null;
    const bundle = (await c.req.json()) as CompanyBackupBundle;
    if (!bundle?.company?.id || !bundle?.company?.rfc) {
      return c.json({ error: 'Payload de respaldo inválido: company.id y company.rfc son requeridos.' }, 400);
    }
    const existing = getCompanyById(bundle.company.id);
    if (existing?.userId && existing.userId !== userId) {
      return c.json({ error: 'No tienes autorización para restaurar esta empresa.' }, 403);
    }
    const restored = restoreCompanyBackupBundle(bundle);
    return c.json(restored, 201);
  } catch (err) {
    const { message, status } = errorStatus(err);
    return c.json({ error: message }, status);
  }
});

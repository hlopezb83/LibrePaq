import { Hono } from 'hono';
import {
  getAdminMetricsRepo,
  getAdminCompaniesRepo,
  getAdminUsersRepo
} from '../repositories/admin.repo';

export const adminRoutes = new Hono();

const SUPERADMIN_EMAILS = ['hlopezb@gmail.com'];

adminRoutes.use('/admin/*', async (c, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const adminSecret = process.env.ADMIN_SECRET || (isProd ? '' : 'librepaq-dev-secret');
  const authHeader = c.req.header('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const hasSecret = Boolean(adminSecret && bearerToken === adminSecret);
  const userEmail = (c.req.header('X-User-Email') || '').toLowerCase().trim();
  const isSuperAdminEmail = SUPERADMIN_EMAILS.includes(userEmail);

  // En producción se exige estrictamente token de autorización firmado o ADMIN_SECRET
  const isAuthorized = hasSecret || (process.env.NODE_ENV !== 'production' && isSuperAdminEmail);

  if (!isAuthorized) {
    return c.json({ error: 'UNAUTHORIZED: Requiere autorización válida de SuperAdmin' }, 403);
  }

  return await next();
});

adminRoutes.get('/admin/metrics', (c) => {
  const metrics = getAdminMetricsRepo();
  return c.json(metrics);
});

adminRoutes.get('/admin/companies', (c) => {
  const companies = getAdminCompaniesRepo();
  return c.json(companies);
});

adminRoutes.get('/admin/users', (c) => {
  const users = getAdminUsersRepo();
  return c.json(users);
});

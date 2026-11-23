import type { Context } from 'hono';
import { AccountingInvariantError } from '../../shared/accounting-engine';
import { companyExistsById, getCompanyById } from '../db';

export function assertRouteCompanyAccess(c: Context, companyId: string) {
  const userId = c.req.header('X-User-Id') || c.req.header('x-user-id') || null;
  if (companyExistsById(companyId) && !getCompanyById(companyId, userId)) {
    return c.json({ error: 'No tienes autorización sobre esta empresa' }, 403);
  }
  if (!getCompanyById(companyId, userId)) {
    return c.json({ error: 'Empresa no encontrada' }, 404);
  }
  return null;
}

export function errorStatus(err: unknown, defaultStatus: 400 | 409 = 400): {
  message: string;
  status: 400 | 404 | 409;
} {
  if (err instanceof AccountingInvariantError) {
    if (err.code.includes('NOT_FOUND')) {
      return { message: err.message, status: 404 };
    }
    if (
      err.code.includes('DUPLICATE') ||
      err.code.includes('ALREADY_ACCOUNTED') ||
      err.code.includes('PERIOD_LOCKED')
    ) {
      return { message: err.message, status: 409 };
    }
    return { message: err.message, status: 400 };
  }
  if (err instanceof Error) {
    return { message: err.message, status: defaultStatus };
  }
  return { message: 'Error procesando la solicitud contable.', status: defaultStatus };
}

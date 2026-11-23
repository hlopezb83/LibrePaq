import type { Context } from 'hono';
import { AccountingInvariantError } from '../../shared/accounting-engine';
import { hasMinDespachoRole, type DespachoRole } from '../../shared/types/despacho-rbac.types';
import { resolveRequestActor } from '../auth-actor';
import { db } from '../connection';
import { companyExistsById, getCompanyById } from '../db';
import {
  getEffectiveCompanyRoleRepo,
  isWorkspaceSocioRepo
} from '../repositories/workspace-members.repo';

export interface RouteCompanyAccessOptions {
  requireWrite?: boolean;
  minRole?: DespachoRole;
  blockDemoWrite?: boolean;
  notFoundWhenNoAccess?: boolean;
}

export function assertRouteCompanyAccess(
  c: Context,
  companyId: string,
  options?: RouteCompanyAccessOptions
) {
  const actor = resolveRequestActor(c);
  if (actor.authError) {
    return c.json({ error: actor.authError }, 401);
  }
  if (!companyExistsById(companyId)) {
    return c.json({ error: 'Empresa no encontrada' }, 404);
  }

  const eff = getEffectiveCompanyRoleRepo(companyId, actor.userId, actor.userEmail);
  if (!eff.role) {
    return c.json(
      {
        error: options?.notFoundWhenNoAccess
          ? 'Empresa no encontrada o no autorizada.'
          : 'No tienes autorización sobre esta empresa'
      },
      options?.notFoundWhenNoAccess ? 404 : 403
    );
  }

  if (options?.requireWrite && !eff.canWrite) {
    return c.json(
      { error: `Tu rol (${eff.role}) es de solo lectura y no permite modificar datos de esta empresa.` },
      403
    );
  }

  if (options?.minRole) {
    const normalizedRole: DespachoRole = eff.role === 'OWNER' ? 'SOCIO' : eff.role;
    if (!hasMinDespachoRole(normalizedRole, options.minRole)) {
      return c.json(
        { error: `Tu rol (${eff.role}) requiere nivel mínimo ${options.minRole}.` },
        403
      );
    }
  }

  if (options?.blockDemoWrite) {
    const row = db
      .query('SELECT user_id FROM companies WHERE id = ?')
      .get(companyId) as { user_id: string | null } | null;
    if (row && (!row.user_id || row.user_id === 'demo')) {
      const isDemoSocio = Boolean(
        actor.userId && isWorkspaceSocioRepo('ws_demo', actor.userId, actor.userEmail)
      );
      if (!isDemoSocio) {
        return c.json(
          { error: 'No se permite modificar o eliminar empresas demo sin autorización SOCIO.' },
          403
        );
      }
    }
  }

  return null;
}

export function getAuthorizedCompanyForRoute(c: Context, companyId: string) {
  const actor = resolveRequestActor(c);
  return getCompanyById(companyId, actor.userId, actor.userEmail);
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

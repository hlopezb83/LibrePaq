// ============================================================================
// Libre CONTPAQ (LibrePaq Pro) - Unified REST API (Hono.js)
// NASA Power of 10 Architecture: Modular Domain Routers & Zero Monoliths
// ============================================================================

import { Hono } from 'hono';
import { companyExistsById, db, getCompanyById, initDatabase } from './db';
import { companiesRoutes } from './routes/companies.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { accountsRoutes } from './routes/accounts.routes';
import { polizasRoutes } from './routes/polizas.routes';
import { cfdiRoutes } from './routes/cfdi.routes';
import { reportsRoutes } from './routes/reports.routes';
import { bankRoutes } from './routes/bank.routes';
import { satRoutes } from './routes/sat.routes';
import { fiscalRoutes } from './routes/fiscal.routes';
import { adminRoutes } from './routes/admin.routes';
import { workspaceMembersRoutes } from './routes/workspace-members.routes';
import { accountingRulesRoutes } from './routes/accounting-rules.routes';
import { bankN1Routes } from './routes/bank-n1.routes';
import { annualTaxRoutes } from './routes/annual-tax.routes';
import { inventoryRoutes } from './routes/inventory.routes';

// NASA Power of 10 - Regla 6: Inicialización de esquema e integridad referencial
initDatabase();

export const api = new Hono().basePath('/api');

const ENTITY_TABLE_PREFIXES: Array<[RegExp, string]> = [
  [/^\/api\/accounts\/([^/]+)$/, 'accounts'],
  [/^\/api\/polizas\/([^/]+)$/, 'polizas'],
  [/^\/api\/cfdi\/([^/]+)/, 'cfdi_documents'],
  [/^\/api\/bank\/lines\/([^/]+)/, 'bank_statement_lines'],
  [/^\/api\/fiscal\/fixed-assets\/([^/]+)$/, 'fixed_assets']
];

// Aislamiento Multi-Tenant en rutas de dominio: verifica propiedad cuando el recurso pertenece a un tenant privado
api.use('*', async (c, next) => {
  const path = c.req.path;
  if (path.startsWith('/api/companies') || path.startsWith('/api/admin') || path.startsWith('/api/workspaces')) {
    return next();
  }

  const userId = c.req.header('X-User-Id') || c.req.header('x-user-id') || null;
  let targetCompanyId = c.req.query('companyId') || c.req.query('company_id') || '';

  if (!targetCompanyId && (c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'PATCH')) {
    const ct = c.req.header('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        const body = (await c.req.raw.clone().json()) as { companyId?: unknown };
        if (typeof body?.companyId === 'string') targetCompanyId = body.companyId;
      } catch {
        // Ignorar payloads no JSON; el handler devolverá 400 si corresponde
      }
    }
  }

  if (!targetCompanyId) {
    for (const [regex, table] of ENTITY_TABLE_PREFIXES) {
      const m = regex.exec(path);
      if (m?.[1]) {
        const row = db
          .query(`SELECT company_id FROM ${table} WHERE id = ?`)
          .get(m[1]) as { company_id?: string } | null;
        if (row?.company_id) {
          targetCompanyId = row.company_id;
        }
        break;
      }
    }
  }

  if (targetCompanyId && companyExistsById(targetCompanyId) && !getCompanyById(targetCompanyId, userId)) {
    return c.json({ error: 'No tienes autorización sobre esta empresa' }, 403);
  }

  return next();
});

// Montaje modular de subrutas de dominio
api.route('/', companiesRoutes);
api.route('/', dashboardRoutes);
api.route('/', accountsRoutes);
api.route('/', polizasRoutes);
api.route('/', cfdiRoutes);
api.route('/', reportsRoutes);
api.route('/', bankRoutes);
api.route('/', satRoutes);
api.route('/', fiscalRoutes);
api.route('/', adminRoutes);
api.route('/', workspaceMembersRoutes);
api.route('/', accountingRulesRoutes);
api.route('/', bankN1Routes);
api.route('/', annualTaxRoutes);
api.route('/', inventoryRoutes);

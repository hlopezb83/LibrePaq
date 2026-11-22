// ============================================================================
// Libre CONTPAQ (LibrePaq Pro) - Unified REST API (Hono.js)
// NASA Power of 10 Architecture: Modular Domain Routers & Zero Monoliths
// ============================================================================

import { Hono } from 'hono';
import { initDatabase } from './db';
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

// NASA Power of 10 - Regla 6: Inicialización de esquema e integridad referencial
initDatabase();

export const api = new Hono().basePath('/api');

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

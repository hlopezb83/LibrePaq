export interface AdminPlatformMetrics {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  totalCompanies: number;
  activeCompaniesCount: number;
  companiesWithFielCount: number;
  totalPolizas: number;
  totalCfdis: number;
  satErrors7d: number;
  supabaseConnected: boolean;
  googleAdsActive: boolean;
  satSoapOnline: boolean;
  lastSyncIso: string;
}

export type PlatformRole = 'SUPERADMIN' | 'SUPPORT_READONLY' | 'BILLING_OPS' | 'NONE';

export type WorkspacePlanTier = 'FREE' | 'PRO' | 'DESPACHO' | 'ENTERPRISE';

export interface AdminUserSummary {
  id: string;
  email: string;
  fullName: string;
  workspaceId?: string;
  workspaceName?: string;
  provider: 'google' | 'email';
  acquisitionSource?: 'google_ads' | 'utm' | 'organic_or_direct';
  gclid?: string;
  utmCampaign?: string;
  utmTerm?: string;
  isSuperAdmin: boolean;
  platformRole?: PlatformRole;
  createdAt: string;
  lastSignInAt?: string;
  companiesCount: number;
  status: 'ACTIVO' | 'SUSPENDIDO';
}

export interface AdminCompanySummary {
  id: string;
  name: string;
  rfc: string;
  regimenFiscal: string;
  codigoPostal: string;
  currentYear: number;
  currentPeriod: number;
  userId?: string;
  userEmail?: string;
  userFullName?: string;
  userProvider?: 'google' | 'email';
  userIsSuperAdmin?: boolean;
  ownerType?: 'user' | 'superadmin' | 'demo';
  createdAt: string;
  polizasCount?: number;
  cfdisCount?: number;
  hasFiel?: boolean;
  fielValidTo?: string | null;
  lastActivityAt?: string | null;
}

export interface AdminBroadcastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
  startsAt?: string | null;
  expiresAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSatRequestSummary {
  id: string;
  companyId: string;
  companyName: string;
  companyRfc: string;
  tipoSolicitud: string;
  estadoSolicitud: string;
  codigoEstadoSat: string;
  mensajeSat: string;
  cfdisDescargados: number;
  createdAt: string;
}

export interface AdminFielExpirySummary {
  companyId: string;
  companyName: string;
  companyRfc: string;
  rfcTitular: string;
  numeroSerie: string;
  validTo: string;
  daysRemaining: number;
}

export interface AdminSatHealthResponse {
  totalRequests7d: number;
  completedRequests7d: number;
  pendingRequests7d: number;
  failedRequests7d: number;
  errorCodeBreakdown: Array<{ code: string; count: number }>;
  recentRequests: AdminSatRequestSummary[];
  expiringFiels: AdminFielExpirySummary[];
  checkedAtIso: string;
}

export interface AdminCompanyDetail {
  company: AdminCompanySummary;
  accountsCount: number;
  polizasCount: number;
  cfdisCount: number;
  bankLinesCount: number;
  hasFiel: boolean;
  fielValidTo: string | null;
  fielNumeroSerie: string | null;
  isCurrentPeriodLocked: boolean;
  lastPolizaAt: string | null;
  lastCfdiDate: string | null;
}

export interface AdminAuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUserStatusPayload {
  status: 'ACTIVO' | 'SUSPENDIDO';
  reason?: string;
}

export interface WorkspaceQuota {
  workspaceId: string;
  userId?: string | null;
  planTier: WorkspacePlanTier;
  maxCompanies: number;
  maxCfdisPerMonth: number;
  maxStorageMb: number;
  notes?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
}

export interface WorkspaceQuotaPayload {
  userId?: string | null;
  planTier: WorkspacePlanTier;
  maxCompanies: number;
  maxCfdisPerMonth: number;
  maxStorageMb: number;
  notes?: string | null;
}

export interface AdminPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminCompaniesPageQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  ownerType?: 'ALL' | 'user' | 'superadmin' | 'demo';
  fielFilter?: 'ALL' | 'WITH_FIEL' | 'WITHOUT_FIEL';
}

export interface AdminUsersPageQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'ALL' | 'ACTIVO' | 'SUSPENDIDO';
  role?: 'ALL' | PlatformRole;
}

export interface AdminAuditLogsPageQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
  targetType?: string;
}

export type PlatformAlertSeverity = 'info' | 'warning' | 'critical';
export type PlatformAlertCategory = 'fiel_expiry' | 'sat_error_spike' | 'quota_limit' | 'system';
export type PlatformAlertStatus = 'open' | 'acknowledged' | 'resolved';

export interface AdminPlatformAlert {
  id: string;
  code: string;
  severity: PlatformAlertSeverity;
  category: PlatformAlertCategory;
  title: string;
  message: string;
  targetType: string;
  targetId: string | null;
  status: PlatformAlertStatus;
  metadata: Record<string, unknown>;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface SupportImpersonationSession {
  companyId: string;
  companyName: string;
  companyRfc: string;
  ownerEmail?: string;
  startedAt: string;
}

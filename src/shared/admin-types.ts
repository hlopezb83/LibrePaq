export interface AdminPlatformMetrics {
  totalUsers: number;
  totalCompanies: number;
  totalPolizas: number;
  totalCfdis: number;
  supabaseConnected: boolean;
  googleAdsActive: boolean;
  satSoapOnline: boolean;
  lastSyncIso: string;
}

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
}

export interface AdminBroadcastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

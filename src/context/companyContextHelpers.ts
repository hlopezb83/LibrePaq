import { getCurrentFiscalPeriod } from '../shared/date-utils';
import type { Company } from '../shared/types';

interface SupportSessionLike {
  companyId: string;
  companyName: string;
  companyRfc: string;
  startedAt: string;
}

interface CompanySummaryLike {
  name?: string;
  rfc?: string;
  regimenFiscal?: string;
  codigoPostal?: string;
  currentYear?: number;
  currentPeriod?: number;
  createdAt?: string;
  userId?: string | null;
}

export function readUrlCompanyParam(): string {
  if (typeof window === 'undefined' || !window.location.search) return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('companyId') || params.get('company') || '';
}

export function resolveWorkspaceName(
  override: string | null | undefined,
  metaName: unknown,
  fallbackName: string
): string {
  const raw = override || metaName;
  return raw ? String(raw).replace(/^Workspace(\s*[-—]\s*|\s+)/i, 'Despacho Contable — ') : fallbackName;
}

export function buildSupportCompany(
  isSupportImpersonation: boolean,
  supportSession: SupportSessionLike | null,
  detailCompany: CompanySummaryLike | null | undefined
): Company | null {
  if (!isSupportImpersonation || !supportSession) return null;
  const d = detailCompany;
  return {
    id: supportSession.companyId,
    name: d?.name || supportSession.companyName,
    rfc: d?.rfc || supportSession.companyRfc,
    regimenFiscal: d?.regimenFiscal || '601 - General de Ley Personas Morales',
    codigoPostal: d?.codigoPostal || '64000',
    maskFormat: 'XXX-XX-XXX',
    currentYear: d?.currentYear ?? getCurrentFiscalPeriod().year,
    currentPeriod: d?.currentPeriod ?? 1,
    createdAt: d?.createdAt || supportSession.startedAt,
    userId: d?.userId ?? null
  };
}

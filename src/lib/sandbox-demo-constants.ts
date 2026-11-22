import type { Company } from '../shared/types';

export const SANDBOX_DEMO_RFC = 'CEJ2106158A0';
export const SANDBOX_DEMO_NAME = '[DEMO] Comercializadora Ejemplo S.A. de C.V.';
export const CANONICAL_DEMO_COMPANY_ID = 'comp_demo_canonical_cej2106158a0';

export function isSandboxDemoCompany(company: Company | null | undefined): boolean {
  if (!company) return false;
  return (
    company.id === CANONICAL_DEMO_COMPANY_ID ||
    company.rfc.toUpperCase() === SANDBOX_DEMO_RFC ||
    company.name.startsWith('[DEMO]')
  );
}

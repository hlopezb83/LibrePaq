import { Crown, Database, Mail, UserCheck } from 'lucide-react';
import type { AdminCompanySummary } from '../../shared/admin-types';

interface CompanyUserOwnerCellProps {
  company: AdminCompanySummary & {
    resolvedOwnerType: 'user' | 'superadmin' | 'demo';
  };
}

export function CompanyUserOwnerCell({ company }: CompanyUserOwnerCellProps) {
  if (company.resolvedOwnerType === 'demo') {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
          <Database className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
        <div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Sistema / Demo
          </span>
          <p className="text-[11px] text-slate-600 mt-0.5">Sin usuario asignado</p>
        </div>
      </div>
    );
  }

  const initials = (company.userFullName || 'US')
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`w-8 h-8 rounded-lg font-bold text-[11px] flex items-center justify-center shrink-0 border ${
          company.userIsSuperAdmin
            ? 'bg-amber-100 text-amber-800 border-amber-300'
            : 'bg-blue-100 text-blue-700 border-blue-200'
        }`}
      >
        {initials || 'US'}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-slate-900 truncate">{company.userFullName}</span>
          {company.userIsSuperAdmin ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <Crown className="w-2.5 h-2.5 text-amber-700" aria-hidden="true" /> SuperAdmin
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <UserCheck className="w-2.5 h-2.5" aria-hidden="true" />
              Cliente
            </span>
          )}
        </div>

        {company.userEmail ? (
          <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
            <Mail className="w-3 h-3 text-slate-600 shrink-0" aria-hidden="true" />
            <span className="truncate">{company.userEmail}</span>
            {company.userProvider && (
              <span className="uppercase font-mono text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {company.userProvider}
              </span>
            )}
          </p>
        ) : (
          <p
            className="text-[11px] text-amber-700 font-mono mt-0.5"
            title={`Clave usuario: ${company.userId}`}
          >
            Clave usuario: {company.userId?.slice(0, 8)}…
          </p>
        )}
      </div>
    </div>
  );
}

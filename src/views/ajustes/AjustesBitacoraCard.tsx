import { useState } from 'react';
import { History, RefreshCw, Search } from 'lucide-react';
import { AlertBanner, Button, ClearFiltersButton, EmptyState, SearchInput } from '../../components/ui';
import { MEXICO_TIMEZONE } from '../../shared/date-utils';
import type { Company } from '../../shared/types';
import type { CompanyAuditLogRecord } from '../../shared/types/despacho-rbac.types';

const AUDIT_DATE_FMT = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'short'
});

const ACTION_LABELS: Record<string, string> = {
  POLIZA_CREATE: 'Alta de póliza contable',
  POLIZA_UPDATE: 'Edición de póliza contable',
  POLIZA_DELETE: 'Eliminación de póliza',
  ACCOUNT_CREATE: 'Alta de cuenta contable',
  ACCOUNT_UPDATE: 'Edición de cuenta contable',
  ACCOUNT_DELETE: 'Eliminación de cuenta',
  CFDI_IMPORT: 'Importación de CFDI 4.0',
  CFDI_DELETE: 'Eliminación de CFDI',
  PERIOD_LOCK: 'Bloqueo de periodo fiscal',
  PERIOD_UNLOCK: 'Reapertura de periodo fiscal',
  COMPANY_UPDATE: 'Actualización de ficha fiscal',
  MEMBER_INVITE: 'Autorización de colaborador',
  MEMBER_ROLE_UPDATE: 'Cambio de rol en despacho',
  MEMBER_REVOKE: 'Revocación de acceso',
  MEMBER_ACCESS_UPDATE: 'Actualización de empresas visibles',
  FIEL_UPLOAD: 'Carga de e.firma SAT',
  TAX_PARAMS_SAVE: 'Guardado de parámetros Día 17',
  BANK_RECONCILE: 'Conciliación bancaria',
  RULE_UPSERT: 'Guardado de regla contable',
  RULE_DELETE: 'Eliminación de regla contable',
  YEAR_CLOSE: 'Cierre de ejercicio anual (P13)'
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  poliza: 'Póliza',
  polizas: 'Póliza',
  account: 'Cuenta Contable',
  accounts: 'Cuenta Contable',
  cfdi: 'CFDI 4.0',
  cfdi_document: 'CFDI 4.0',
  period_lock: 'Candado Fiscal',
  company: 'Empresa',
  workspace_member: 'Colaborador',
  accounting_rule: 'Regla Contable',
  fiel: 'e.firma SAT',
  tax_parameters: 'Parámetros Fiscales',
  bank_statement: 'Estado de Cuenta'
};

function getActionLabel(action: string): string {
  const upper = action.trim().toUpperCase();
  if (ACTION_LABELS[upper]) return ACTION_LABELS[upper];
  return upper.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase());
}

function getEntityLabel(entityType: string): string {
  const lower = entityType.trim().toLowerCase();
  if (ENTITY_TYPE_LABELS[lower]) return ENTITY_TYPE_LABELS[lower];
  return entityType.replace(/_/g, ' ');
}

const METADATA_KEY_LABELS: Record<string, string> = {
  numero: 'Folio',
  tipo: 'Tipo',
  concepto: 'Concepto',
  period: 'Periodo',
  periodo: 'Periodo',
  year: 'Ejercicio',
  ejercicio: 'Ejercicio',
  email: 'Correo',
  role: 'Rol',
  name: 'Nombre',
  rfc: 'RFC',
  code: 'Cuenta',
  cuenta: 'Cuenta',
  status: 'Estado',
  estado: 'Estado',
  total: 'Total',
  locked: 'Bloqueado',
  count: 'Cantidad',
  uuid: 'UUID SAT'
};

function formatMetadataSummary(metadata: Record<string, unknown> | undefined): string {
  if (!metadata || typeof metadata !== 'object') return '';
  const entries = Object.entries(metadata).filter(
    ([key, val]) =>
      key !== 'companyId' &&
      key !== 'id' &&
      val !== null &&
      val !== undefined &&
      String(val).trim() !== ''
  );
  if (entries.length === 0) return '';
  return entries
    .slice(0, 4)
    .map(([key, val]) => {
      const label = METADATA_KEY_LABELS[key] || METADATA_KEY_LABELS[key.toLowerCase()] || key.replace(/([A-Z])/g, ' $1').trim();
      const formattedVal =
        typeof val === 'boolean'
          ? val ? 'Sí' : 'No'
          : typeof val === 'object'
            ? JSON.stringify(val)
            : String(val);
      return `${label}: ${formattedVal}`;
    })
    .join(' · ');
}

function formatAuditDate(raw: string | Date | null | undefined): string {
  if (!raw) return '—';
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return '—';
  return AUDIT_DATE_FMT.format(date);
}

export interface AjustesBitacoraCardProps {
  activeCompany: Company | null;
  auditLogs: CompanyAuditLogRecord[];
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  onRefresh: () => void;
}

export function AjustesBitacoraCard({
  activeCompany,
  auditLogs,
  isLoading,
  isError = false,
  error,
  onRefresh
}: AjustesBitacoraCardProps) {
  const [auditSearch, setAuditSearch] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return true;
    const actionLabel = getActionLabel(log.action).toLowerCase();
    const entityLabel = getEntityLabel(log.entityType).toLowerCase();
    const metaSummary = formatMetadataSummary(log.metadata).toLowerCase();
    return (
      log.actorEmail.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      actionLabel.includes(q) ||
      log.entityType.toLowerCase().includes(q) ||
      entityLabel.includes(q) ||
      (log.entityId ?? '').toLowerCase().includes(q) ||
      metaSummary.includes(q)
    );
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 p-4 sm:p-5 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900 truncate">
            Bitácora Contable {activeCompany ? `— ${activeCompany.name}` : ''}
          </h3>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[280px]">
          <SearchInput
            id="audit-search"
            size="sm"
            aria-label="Filtrar bitácora contable"
            value={auditSearch}
            onChange={setAuditSearch}
            placeholder="Filtrar por usuario, acción o folio..."
            clearLabel="Limpiar filtro de bitácora"
            containerClassName="flex-1 min-w-0"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={isLoading || !activeCompany}
            onClick={onRefresh}
            aria-label="Actualizar bitácora contable"
            title={
              !activeCompany
                ? 'Selecciona una empresa activa'
                : isLoading
                ? 'Actualizando bitácora...'
                : 'Actualizar bitácora contable'
            }
            className="min-w-[34px] min-h-[34px] p-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {!activeCompany ? (
        <p className="text-xs text-slate-600">Selecciona una empresa activa para consultar su bitácora.</p>
      ) : isError ? (
        <AlertBanner
          tone="danger"
          action={
            <Button
              variant="danger"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={onRefresh}
            >
              Reintentar
            </Button>
          }
        >
          {error instanceof Error ? error.message : 'Error al cargar la bitácora contable.'}
        </AlertBanner>
      ) : isLoading ? (
        <p role="status" aria-live="polite" aria-busy="true" className="text-xs text-slate-600 py-2">
          Cargando bitácora contable...
        </p>
      ) : auditLogs.length === 0 ? (
        <EmptyState
          variant="dashed"
          tone="slate"
          icon={<History className="w-5 h-5" aria-hidden="true" />}
          title="Sin movimientos en bitácora"
          description="No se han registrado movimientos contables o administrativos para esta empresa."
        />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          variant="dashed"
          tone="slate"
          icon={<Search className="w-5 h-5" aria-hidden="true" />}
          title={`Sin resultados para “${auditSearch}”`}
          description="Prueba con otro usuario, acción o folio."
          actions={<ClearFiltersButton label="Limpiar filtro" onClick={() => setAuditSearch('')} />}
        />
      ) : (
        <>
          <ul className="sm:hidden space-y-2.5">
            {filteredLogs.map((log) => {
              const metaSummary = formatMetadataSummary(log.metadata);
              return (
                <li key={log.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-blue-900">{getActionLabel(log.action)}</span>
                    <span className="text-[11px] text-slate-600 whitespace-nowrap">{formatAuditDate(log.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-slate-800 font-medium break-all">{log.actorEmail}</p>
                  <p className="text-[11px] text-slate-600">{getEntityLabel(log.entityType)}</p>
                  {metaSummary && <p className="text-[11px] text-slate-600 break-words">{metaSummary}</p>}
                </li>
              );
            })}
          </ul>

          <div
            tabIndex={0}
            role="region"
            aria-label="Tabla de bitácora contable"
            className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200"
          >
            <table className="w-full text-left text-xs border-collapse">
              <caption className="visually-hidden">
                Registro de movimientos contables y administrativos de la empresa
              </caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th scope="col" className="py-2 px-3 font-semibold">Fecha (CDMX)</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Usuario</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Acción</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Elemento y Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const metaSummary = formatMetadataSummary(log.metadata);
                  return (
                    <tr key={log.id} className="align-top">
                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                        {formatAuditDate(log.createdAt)}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">{log.actorEmail}</td>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-blue-900 block">
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        <div className="font-medium">{getEntityLabel(log.entityType)}</div>
                        {metaSummary && (
                          <p className="text-[11px] text-slate-600 mt-0.5 break-words">{metaSummary}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

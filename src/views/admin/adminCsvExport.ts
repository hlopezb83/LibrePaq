import { downloadCsvFile } from '../../lib/formatters';
import { getTodayLocalIso } from '../../shared/date-utils';
import type { AdminCompanySummary, AdminUserSummary } from '../../shared/admin-types';

/**
 * Exporta el directorio de usuarios del panel SuperAdmin en formato CSV RFC-4180 con BOM UTF-8.
 */
export function exportUsersCsv(users: AdminUserSummary[]): void {
  const dateTag = getTodayLocalIso();
  const headers = [
    'ID',
    'Nombre',
    'Correo',
    'Proveedor',
    'Workspace',
    'Origen Adquisición',
    'Campaña UTM',
    'Empresas',
    'Estado',
    'SuperAdmin',
    'Rol de Plataforma',
    'Fecha Registro',
    'Último Acceso'
  ];

  const rows = users.map((u) => [
    u.id,
    u.fullName,
    u.email,
    u.provider,
    u.workspaceName || '',
    u.acquisitionSource || 'organic_or_direct',
    u.utmCampaign || '',
    u.companiesCount,
    u.status,
    u.isSuperAdmin ? 'Sí' : 'No',
    u.platformRole || (u.isSuperAdmin ? 'SUPERADMIN' : 'NONE'),
    u.createdAt,
    u.lastSignInAt || 'Sin registro'
  ]);

  downloadCsvFile(`librepaq-usuarios-${dateTag}.csv`, headers, rows);
}

/**
 * Exporta el directorio global de empresas fiscales en formato CSV RFC-4180 con BOM UTF-8.
 */
export function exportCompaniesCsv(companies: AdminCompanySummary[]): void {
  const dateTag = getTodayLocalIso();
  const headers = [
    'ID Empresa',
    'RFC',
    'Razón Social',
    'Régimen Fiscal',
    'C.P.',
    'Ejercicio',
    'Periodo',
    'Propietario',
    'Correo Propietario',
    'Tipo Propietario',
    'Pólizas',
    'CFDIs',
    'e.firma',
    'Vigencia e.firma',
    'Última Actividad',
    'Fecha Creación'
  ];

  const rows = companies.map((c) => [
    c.id,
    c.rfc,
    c.name,
    c.regimenFiscal,
    c.codigoPostal,
    c.currentYear,
    c.currentPeriod,
    c.userFullName || '',
    c.userEmail || '',
    c.ownerType || (c.userId ? 'user' : 'demo'),
    c.polizasCount ?? 0,
    c.cfdisCount ?? 0,
    c.hasFiel ? 'Sí' : 'No',
    c.fielValidTo || '',
    c.lastActivityAt || '',
    c.createdAt
  ]);

  downloadCsvFile(`librepaq-empresas-${dateTag}.csv`, headers, rows);
}

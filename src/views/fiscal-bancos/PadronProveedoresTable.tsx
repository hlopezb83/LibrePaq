import { Info, Pencil, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { Button, ClearFiltersButton, EmptyState, StatusBadge } from '../../components/ui';
import { validateRfcModulo11 } from '../../shared/accounting-engine';
import type { Efos69BStatus, ThirdPartyRecord } from '../../shared/types';

const EFOS_LABELS: Record<Efos69BStatus, string> = {
  LIMPIO: '69-B Limpio',
  PRESUNTO_EFOS: 'Presunto EFOS',
  DEFINITIVO_EFOS: 'Definitivo EFOS',
  DESVIRTUADO: 'Desvirtuado'
};

const ROL_LABELS: Record<ThirdPartyRecord['rol'], string> = {
  PROVEEDOR: 'Proveedor',
  CLIENTE: 'Cliente',
  AMBOS: 'Proveedor y Cliente'
};

export interface PadronProveedoresTableProps {
  thirdParties: ThirdPartyRecord[];
  totalCount: number;
  editingRfc?: string;
  isReadOnlyClient?: boolean;
  onEditThirdParty: (tp: ThirdPartyRecord) => void;
  onClearSearch?: () => void;
}

export function PadronProveedoresTable({
  thirdParties,
  totalCount,
  editingRfc,
  isReadOnlyClient = false,
  onEditThirdParty,
  onClearSearch
}: PadronProveedoresTableProps) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Tabla de padrón fiscal de terceros"
      className="overflow-x-auto max-h-[420px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-xl"
    >
      <table className="w-full text-left border-collapse erp-sticky-table">
        <caption className="visually-hidden">
          Padrón fiscal de proveedores, clientes y verificación 69-B SAT
        </caption>
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 border-b border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-600">
            <th scope="col" className="py-2.5 px-3">RFC</th>
            <th scope="col" className="py-2.5 px-3">Razón Social</th>
            <th scope="col" className="py-2.5 px-3">Rol</th>
            <th scope="col" className="py-2.5 px-3">Cuenta Asignada</th>
            <th scope="col" className="py-2.5 px-3">Contrapartida</th>
            <th scope="col" className="py-2.5 px-3">IVA / DIOT</th>
            <th scope="col" className="py-2.5 px-3 text-center">Estatus 69-B SAT</th>
            <th scope="col" className="py-2.5 px-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {thirdParties.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState
                  icon={<Users className="w-6 h-6" aria-hidden="true" />}
                  tone="blue"
                  title={
                    totalCount === 0
                      ? 'No hay proveedores o clientes registrados aún en el padrón fiscal'
                      : 'Ningún proveedor o cliente coincide con la búsqueda'
                  }
                  actions={
                    totalCount > 0 && onClearSearch && (
                      <ClearFiltersButton onClick={onClearSearch} label="Limpiar búsqueda" />
                    )
                  }
                />
              </td>
            </tr>
          ) : (
            thirdParties.map((tp) => {
              const tpCheck = validateRfcModulo11(tp.rfc);
              const isEditing = editingRfc === tp.rfc;
              return (
                <tr key={tp.id} className={isEditing ? 'bg-blue-50/70' : 'hover:bg-blue-50/30'}>
                  <th scope="row" className="py-2.5 px-3 font-normal text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-blue-800">{tp.rfc}</span>
                      {tpCheck.isValidCheckDigit ? (
                        <span title="Dígito verificador SAT Módulo 11 válido">
                          <StatusBadge tone="emerald" shape="tag">RFC válido</StatusBadge>
                        </span>
                      ) : (
                        <span title={`Discrepancia SAT Módulo 11: calcula '${tpCheck.expectedCheckDigit}'`}>
                          <StatusBadge tone="amber" shape="tag">M11: {tpCheck.expectedCheckDigit}</StatusBadge>
                        </span>
                      )}
                    </div>
                  </th>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{tp.nombre}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge tone="slate">{ROL_LABELS[tp.rol] ?? tp.rol}</StatusBadge>
                      {tp.tipoTerceroDiot === '05' && (
                        <StatusBadge tone="blue" shape="tag">
                          05 Extranjero{tp.pais ? ` · ${tp.pais}` : ''}
                        </StatusBadge>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {tp.cuentaOperacionCode}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {tp.cuentaContrapartidaCode}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                    IVA {tp.tasaIvaDefault}% • Op {tp.tipoOperacionDiot}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {tp.estatus69B === 'LIMPIO' ? (
                      <StatusBadge tone="emerald" icon={<ShieldCheck className="w-3 h-3" aria-hidden="true" />}>
                        69-B Limpio
                      </StatusBadge>
                    ) : tp.estatus69B === 'DESVIRTUADO' ? (
                      <span title="Contribuyente que desvirtuó los hechos imputados ante el SAT (Art. 69-B CFF)">
                        <StatusBadge tone="blue" icon={<Info className="w-3 h-3" aria-hidden="true" />}>
                          {EFOS_LABELS.DESVIRTUADO}
                        </StatusBadge>
                      </span>
                    ) : (
                      <StatusBadge tone="red" icon={<ShieldAlert className="w-3 h-3" aria-hidden="true" />}>
                        {EFOS_LABELS[tp.estatus69B] ?? tp.estatus69B}
                      </StatusBadge>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isReadOnlyClient}
                      onClick={() => { if (!isReadOnlyClient) onEditThirdParty(tp); }}
                      aria-label={`Editar perfil fiscal de ${tp.rfc}`}
                      title={isReadOnlyClient ? 'Modo solo lectura' : 'Cargar en formulario para editar'}
                      leftIcon={<Pencil className="w-3 h-3" aria-hidden="true" />}
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

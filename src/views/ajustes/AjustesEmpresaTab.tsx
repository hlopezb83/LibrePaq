import { AlertTriangle, CheckCircle2, Eye, RotateCcw, Save, Sparkles } from 'lucide-react';
import { AlertBanner, Button, FormField, Input, Select, StatusBadge } from '../../components/ui';
import { REGIMENES_FISCALES_SAT } from '../../shared/sat-constants';
import type { Company } from '../../shared/types';
import { AccountingRulesCard } from './AccountingRulesCard';
import { AjustesEmpresaComplianceCards } from './AjustesEmpresaComplianceCards';
import { BusinessSegmentsCard } from './BusinessSegmentsCard';

export interface AjustesEmpresaTabProps {
  activeCompany: Company;
  compName: string;
  setCompName: (v: string) => void;
  compRfc: string;
  setCompRfc: (v: string) => void;
  compRegimen: string;
  setCompRegimen: (v: string) => void;
  compCp: string;
  setCompCp: (v: string) => void;
  compMask: string;
  isRfcValid: boolean;
  isCpValid: boolean;
  isCompanyDirty: boolean;
  onResetCompany: () => void;
  rfcModulo11: { isValidCheckDigit: boolean; expectedCheckDigit?: string | null; expectedRfc?: string | null } | null;
  updateCompanyMutation: { mutate: () => void; isPending: boolean };
  periodLock?: { isLocked: boolean } | null;
  togglePeriodLockMutation: { mutate: (lock: boolean) => void; isPending: boolean };
  isReadOnly?: boolean;
  canEditRules?: boolean;
}

export function AjustesEmpresaTab({
  activeCompany,
  compName,
  setCompName,
  compRfc,
  setCompRfc,
  compRegimen,
  setCompRegimen,
  compCp,
  setCompCp,
  compMask,
  isRfcValid,
  isCpValid,
  isCompanyDirty,
  onResetCompany,
  rfcModulo11,
  updateCompanyMutation,
  periodLock,
  togglePeriodLockMutation,
  isReadOnly = false,
  canEditRules = !isReadOnly
}: AjustesEmpresaTabProps) {
  return (
    <section className="space-y-5">
      {isReadOnly && (
        <AlertBanner tone="info" icon={<Eye className="w-4 h-4" aria-hidden="true" />}>
          {canEditRules ? (
            <>
              <strong>Consulta de ficha fiscal:</strong> Puedes consultar la ficha fiscal y el candado de periodo (su edición corresponde a un Contador o Socio). Las reglas contables automáticas siguen disponibles abajo.
            </>
          ) : (
            <>
              <strong>Modo Solo lectura:</strong> Puedes consultar la ficha fiscal, candado de periodo y reglas contables de la empresa, pero no realizar modificaciones.
            </>
          )}
        </AlertBanner>
      )}

      {/* Grid Equilibrado: Formulario Fiscal + Parámetros de Operación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Columna 1: Formulario de Identidad Fiscal Oficial (CSF) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isReadOnly) updateCompanyMutation.mutate();
          }}
          className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden flex flex-col justify-between"
        >
          <div>
            <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Ficha y Régimen Fiscal (Constancia de Situación Fiscal)
                </h3>
                <p className="text-xs text-slate-500">
                  Modifica los datos fiscales conforme a tu CSF vigente emitida por el SAT.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <FormField htmlFor="set-name" label="Razón Social o Denominación Oficial" required>
                <Input
                  id="set-name"
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="font-semibold"
                  placeholder="Ej. TECNOLOGIAS NUBE DEL NORTE S.A. DE C.V."
                />
              </FormField>

              {/* Grid RFC y Código Postal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-1 min-h-6">
                    <label htmlFor="set-rfc" className="text-xs font-semibold text-slate-700">
                      RFC <span className="text-red-700">*</span>
                    </label>
                    {isRfcValid && rfcModulo11 && (rfcModulo11.isValidCheckDigit || rfcModulo11.expectedCheckDigit) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rfcModulo11.isValidCheckDigit ? (
                          <StatusBadge tone="emerald" icon={<CheckCircle2 className="w-3 h-3" aria-hidden="true" />}>
                            SAT Módulo 11 OK
                          </StatusBadge>
                        ) : (
                          <>
                            <StatusBadge tone="amber" icon={<AlertTriangle className="w-3 h-3" aria-hidden="true" />}>
                              SAT M11: {rfcModulo11.expectedCheckDigit}
                            </StatusBadge>
                            {rfcModulo11.expectedRfc && !isReadOnly && (
                              <button
                                type="button"
                                onClick={() => setCompRfc(rfcModulo11.expectedRfc!)}
                                title={`Corregir dígito verificador SAT a ${rfcModulo11.expectedRfc}`}
                                aria-label={`Corregir dígito verificador del RFC a ${rfcModulo11.expectedRfc}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition shadow-xs cursor-pointer"
                              >
                                <Sparkles className="w-3 h-3 text-blue-600" aria-hidden="true" />
                                Corregir
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <Input
                    id="set-rfc"
                    type="text"
                    required
                    disabled={isReadOnly}
                    maxLength={13}
                    aria-invalid={!isRfcValid}
                    aria-describedby="set-rfc-help"
                    value={compRfc}
                    onChange={(e) => setCompRfc(e.target.value.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, ''))}
                    className={`font-mono font-bold tracking-wider uppercase ${
                      isRfcValid
                        ? rfcModulo11?.isValidCheckDigit
                          ? 'border-emerald-300 bg-emerald-50/20 text-emerald-900'
                          : 'border-amber-300 bg-amber-50/20 text-slate-900'
                        : 'border-amber-300 text-slate-800'
                    }`}
                    placeholder="BBA830831LJ2"
                  />
                  <p id="set-rfc-help" className="text-[11px] font-mono text-slate-600">
                    {compRfc.length}/12 PM ó 13 PF {isRfcValid ? '· Formato SAT válido' : '· Estructura incompleta'}
                  </p>
                </div>

                <FormField
                  htmlFor="set-cp"
                  label="Código Postal Fiscal (CSF)"
                  required
                  hint={isCpValid ? 'C.P. fiscal de 5 dígitos conforme a CSF' : undefined}
                  error={!isCpValid ? `Debe tener 5 dígitos (${compCp.length}/5)` : undefined}
                >
                  <Input
                    id="set-cp"
                    type="text"
                    inputMode="numeric"
                    required
                    disabled={isReadOnly}
                    pattern="\d{5}"
                    maxLength={5}
                    aria-invalid={!isCpValid}
                    value={compCp}
                    onChange={(e) => setCompCp(e.target.value.replace(/\D/g, ''))}
                    className={`font-mono font-bold ${isCpValid ? '' : 'border-red-300 bg-red-50/30'}`}
                    placeholder="64000"
                  />
                </FormField>
              </div>

              <FormField htmlFor="set-regimen" label="Régimen Fiscal (Catálogo SAT c_RegimenFiscal)" required>
                <Select
                  id="set-regimen"
                  disabled={isReadOnly}
                  value={compRegimen}
                  onChange={(e) => setCompRegimen(e.target.value)}
                  className="font-medium"
                >
                  {REGIMENES_FISCALES_SAT.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-600 font-medium">
                {!isRfcValid
                  ? 'Ingresa un RFC válido (12 o 13 car.)'
                  : !isCpValid
                  ? 'C.P. debe tener 5 dígitos'
                  : isCompanyDirty
                  ? 'Hay cambios pendientes por guardar'
                  : 'Identidad fiscal al día'}
              </span>
              {isCompanyDirty && <StatusBadge tone="amber">Cambios sin guardar</StatusBadge>}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {isCompanyDirty && !isReadOnly && (
                <Button
                  variant="secondary"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}
                  onClick={onResetCompany}
                >
                  Restablecer
                </Button>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={isReadOnly || updateCompanyMutation.isPending || !isRfcValid || !isCpValid || !isCompanyDirty}
                loading={updateCompanyMutation.isPending}
                title={
                  isReadOnly
                    ? 'Modo solo lectura: no tienes permisos para editar la ficha fiscal'
                    : !isRfcValid || !isCpValid
                    ? 'Verifica que RFC y Código Postal sean válidos'
                    : !isCompanyDirty
                    ? 'No hay modificaciones pendientes por guardar'
                    : undefined
                }
                leftIcon={<Save className="w-4 h-4 shrink-0" aria-hidden="true" />}
              >
                {updateCompanyMutation.isPending ? 'Guardando...' : 'Guardar Datos Fiscales'}
              </Button>
            </div>
          </div>
        </form>

        {/* Columna 2: Candado de Periodo + Estructura Contable + Garantía SAT */}
        <AjustesEmpresaComplianceCards
          activeCompany={activeCompany}
          compMask={compMask}
          periodLock={periodLock}
          togglePeriodLockMutation={togglePeriodLockMutation}
          isReadOnly={isReadOnly}
        />
      </div>

      {/* Reglas Contables Aprendidas por RFC / ClaveProdServ y No Deducibles (801) */}
      <AccountingRulesCard companyId={activeCompany.id} />

      {/* Segmentos de Negocio / Centros de Costos */}
      <BusinessSegmentsCard companyId={activeCompany.id} isReadOnly={!canEditRules} />
    </section>
  );
}

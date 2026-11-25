import { AlertTriangle, CheckCircle2, Loader2, Plus, Save } from 'lucide-react';
import { AccountPickerCombobox } from '../../components/account-picker/AccountPickerCombobox';
import { Button, FormField, Input, LABEL_CLASS, Select, StatusBadge } from '../../components/ui';
import type { AccountWithBalance, Efos69BStatus, ThirdPartyRecord } from '../../shared/types';
import { PadronExtranjeroSubpanel } from './PadronExtranjeroSubpanel';

export interface PadronProveedoresFormProps {
  isReadOnly: boolean;
  isEditing: boolean;
  isPending: boolean;
  affectableAccounts: AccountWithBalance[];
  tpRfc: string;
  onRfcChange: (val: string) => void;
  tpRfcRes: {
    isValidFormat: boolean;
    isValidCheckDigit: boolean;
    expectedCheckDigit?: string | null;
    expectedRfc?: string | null;
  } | null;
  tpNombre: string;
  setTpNombre: (val: string) => void;
  tpRol: ThirdPartyRecord['rol'];
  setTpRol: (val: ThirdPartyRecord['rol']) => void;
  tpTipoTercero: '04' | '05' | '15';
  setTpTipoTercero: (val: '04' | '05' | '15') => void;
  tpIdFiscal: string;
  setTpIdFiscal: (val: string) => void;
  tpPais: string;
  setTpPais: (val: string) => void;
  tpJurisdiccionFiscal: string;
  setTpJurisdiccionFiscal: (val: string) => void;
  tpContrapartidaAcc: string;
  setTpContrapartidaAcc: (val: string) => void;
  tpExpenseAcc: string;
  setTpExpenseAcc: (val: string) => void;
  tpIvaRate: 16 | 8 | 0;
  setTpIvaRate: (val: 16 | 8 | 0) => void;
  tpRegionFronteriza: 'NORTE' | 'SUR';
  setTpRegionFronteriza: (val: 'NORTE' | 'SUR') => void;
  tpDeductiblePct: number;
  setTpDeductiblePct: (val: number) => void;
  tpOperacion: '03' | '06' | '85';
  setTpOperacion: (val: '03' | '06' | '85') => void;
  tpEfos: Efos69BStatus;
  setTpEfos: (val: Efos69BStatus) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function PadronProveedoresForm({
  isReadOnly, isEditing, isPending, affectableAccounts, tpRfc, onRfcChange, tpRfcRes,
  tpNombre, setTpNombre, tpRol, setTpRol, tpTipoTercero, setTpTipoTercero,
  tpIdFiscal, setTpIdFiscal, tpPais, setTpPais, tpJurisdiccionFiscal, setTpJurisdiccionFiscal,
  tpContrapartidaAcc, setTpContrapartidaAcc, tpExpenseAcc, setTpExpenseAcc,
  tpIvaRate, setTpIvaRate, tpRegionFronteriza, setTpRegionFronteriza,
  tpDeductiblePct, setTpDeductiblePct, tpOperacion, setTpOperacion, tpEfos, setTpEfos,
  onSubmit, onReset
}: PadronProveedoresFormProps) {
  const selectedExpenseAccountId = affectableAccounts.find((acc) => acc.code === tpExpenseAcc)?.id ?? '';
  const selectedContrapartidaId = affectableAccounts.find((acc) => acc.code === tpContrapartidaAcc)?.id ?? '';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isReadOnly) onSubmit();
      }}
      className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3"
    >
      {isEditing && (
        <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-900">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <StatusBadge tone="blue">Editando RFC</StatusBadge>
            <span className="font-mono">{tpRfc}</span>
          </span>
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-semibold text-blue-800 hover:underline cursor-pointer"
          >
            Cancelar edición
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <label htmlFor="tp-rfc" className="block text-xs font-semibold text-slate-700">
              RFC Proveedor / Cliente <span className="text-red-700">*</span>
            </label>
            <div className="flex items-center gap-1.5">
              {tpTipoTercero === '05' && tpRfc !== 'XEXX010101000' && (
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => onRfcChange('XEXX010101000')}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline disabled:opacity-50 cursor-pointer"
                >
                  Usar XEXX010101000
                </button>
              )}
              {tpRfcRes && tpRfcRes.isValidFormat && (
                <div className="flex items-center gap-1">
                  {tpRfcRes.isValidCheckDigit ? (
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" /> RFC válido
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" aria-hidden="true" /> M11: {tpRfcRes.expectedCheckDigit}
                      {tpRfcRes.expectedRfc && (
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => onRfcChange(tpRfcRes.expectedRfc!)}
                          className="underline text-blue-700 hover:text-blue-900 disabled:opacity-50 cursor-pointer font-bold"
                        >
                          Corregir
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <Input
            id="tp-rfc"
            size="sm"
            type="text"
            required
            disabled={isReadOnly}
            minLength={12}
            maxLength={13}
            value={tpRfc}
            onChange={(e) => onRfcChange(e.target.value)}
            placeholder="TLE180920K71"
            className="font-mono uppercase"
          />
        </div>

        <FormField label="Razón Social" htmlFor="tp-nombre" required className="lg:col-span-2">
          <Input
            id="tp-nombre"
            size="sm"
            type="text"
            required
            disabled={isReadOnly}
            value={tpNombre}
            onChange={(e) => setTpNombre(e.target.value)}
            placeholder="Transportes y Logística Empresarial SA de CV"
          />
        </FormField>

        <FormField label="Rol" htmlFor="tp-rol">
          <Select
            id="tp-rol"
            size="sm"
            disabled={isReadOnly}
            value={tpRol}
            onChange={(e) => setTpRol(e.target.value as ThirdPartyRecord['rol'])}
          >
            <option value="PROVEEDOR">Proveedor</option>
            <option value="CLIENTE">Cliente</option>
            <option value="AMBOS">Proveedor y Cliente</option>
          </Select>
        </FormField>

        <FormField label="Tipo Tercero DIOT" htmlFor="tp-tipo-tercero">
          <Select
            id="tp-tipo-tercero"
            size="sm"
            disabled={isReadOnly}
            value={tpTipoTercero}
            onChange={(e) => setTpTipoTercero(e.target.value as '04' | '05' | '15')}
          >
            <option value="04">04 Nacional</option>
            <option value="05">05 Extranjero</option>
            <option value="15">15 Global</option>
          </Select>
        </FormField>

        {tpTipoTercero === '05' && (
          <PadronExtranjeroSubpanel
            isReadOnly={isReadOnly}
            tpIdFiscal={tpIdFiscal}
            setTpIdFiscal={setTpIdFiscal}
            tpPais={tpPais}
            setTpPais={setTpPais}
            tpJurisdiccionFiscal={tpJurisdiccionFiscal}
            setTpJurisdiccionFiscal={setTpJurisdiccionFiscal}
          />
        )}

        <div className="lg:col-span-2">
          <span className={LABEL_CLASS}>Cuenta Gasto / Operación</span>
          <div className={isReadOnly ? 'pointer-events-none opacity-60' : undefined} aria-disabled={isReadOnly || undefined}>
            <AccountPickerCombobox
              accounts={affectableAccounts}
              value={selectedExpenseAccountId}
              onChange={(accountId) => {
                if (isReadOnly) return;
                const found = affectableAccounts.find((acc) => acc.id === accountId);
                if (found) setTpExpenseAcc(found.code);
              }}
              ariaLabel="Cuenta Gasto / Operación"
              placeholder="Buscar cuenta contable..."
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <span className={LABEL_CLASS}>Contrapartida ({tpRol === 'CLIENTE' ? '105-01-001' : '201-01-001'})</span>
          <div className={isReadOnly ? 'pointer-events-none opacity-60' : undefined} aria-disabled={isReadOnly || undefined}>
            <AccountPickerCombobox
              accounts={affectableAccounts}
              value={selectedContrapartidaId}
              onChange={(accountId) => {
                if (isReadOnly) return;
                const found = affectableAccounts.find((acc) => acc.id === accountId);
                if (found) setTpContrapartidaAcc(found.code);
              }}
              ariaLabel="Cuenta Contrapartida CxC/CxP"
              placeholder="105-01-001 / 201-01-001..."
            />
          </div>
        </div>

        <FormField label="Tasa IVA" htmlFor="tp-iva-rate">
          <Select id="tp-iva-rate" size="sm" disabled={isReadOnly} value={tpIvaRate} onChange={(e) => setTpIvaRate(Number(e.target.value) as 16 | 8 | 0)} className="font-mono">
            <option value={16}>16%</option>
            <option value={8}>8% Frontera</option>
            <option value={0}>0%</option>
          </Select>
        </FormField>

        {tpIvaRate === 8 && (
          <FormField label="Región Fronteriza" htmlFor="tp-region-fronteriza">
            <Select id="tp-region-fronteriza" size="sm" disabled={isReadOnly} value={tpRegionFronteriza} onChange={(e) => setTpRegionFronteriza(e.target.value as 'NORTE' | 'SUR')}>
              <option value="NORTE">Norte (Decreto)</option>
              <option value="SUR">Sur (Decreto)</option>
            </Select>
          </FormField>
        )}

        <FormField label="% Deducible" htmlFor="tp-deductible-pct">
          <Input id="tp-deductible-pct" size="sm" type="number" min={0} max={100} step={0.5} disabled={isReadOnly} value={tpDeductiblePct} onChange={(e) => setTpDeductiblePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="font-mono tabular-nums" />
        </FormField>

        <FormField label="Op. DIOT" htmlFor="tp-operacion-diot">
          <Select id="tp-operacion-diot" size="sm" disabled={isReadOnly} value={tpOperacion} onChange={(e) => setTpOperacion(e.target.value as '03' | '06' | '85')} className="font-mono">
            <option value="03">03 Serv. Prof.</option>
            <option value="06">06 Arrend.</option>
            <option value="85">85 Otros</option>
          </Select>
        </FormField>

        <FormField label="Lista 69-B" htmlFor="tp-efos">
          <Select id="tp-efos" size="sm" disabled={isReadOnly} value={tpEfos} onChange={(e) => setTpEfos(e.target.value as Efos69BStatus)}>
            <option value="LIMPIO">Limpio</option>
            <option value="PRESUNTO_EFOS">Presunto</option>
            <option value="DEFINITIVO_EFOS">Definitivo</option>
            <option value="DESVIRTUADO">Desvirtuado</option>
          </Select>
        </FormField>

        <div className="lg:col-span-2 flex items-end justify-end gap-2">
          {(tpRfc || tpNombre) && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isReadOnly || isPending}
              onClick={onReset}
              title="Limpiar formulario"
            >
              Limpiar
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={isReadOnly}
            title={isReadOnly ? 'Modo solo lectura' : isEditing ? 'Actualizar datos del tercero' : 'Guardar nuevo tercero en el padrón'}
            leftIcon={
              isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : isEditing ? (
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              )
            }
          >
            <span>{isPending ? (isEditing ? 'Actualizando...' : 'Guardando...') : isEditing ? 'Actualizar' : 'Guardar'}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}

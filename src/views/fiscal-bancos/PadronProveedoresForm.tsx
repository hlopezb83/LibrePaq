import { AlertTriangle, CheckCircle2, Loader2, Plus, Save } from 'lucide-react';
import type { AccountWithBalance, Efos69BStatus, ThirdPartyRecord } from '../../shared/types';

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
  tpExpenseAcc: string;
  setTpExpenseAcc: (val: string) => void;
  tpIvaRate: 16 | 8 | 0;
  setTpIvaRate: (val: 16 | 8 | 0) => void;
  tpOperacion: '03' | '06' | '85';
  setTpOperacion: (val: '03' | '06' | '85') => void;
  tpEfos: Efos69BStatus;
  setTpEfos: (val: Efos69BStatus) => void;
  onSubmit: () => void;
  onReset: () => void;
}

export function PadronProveedoresForm({
  isReadOnly,
  isEditing,
  isPending,
  affectableAccounts,
  tpRfc,
  onRfcChange,
  tpRfcRes,
  tpNombre,
  setTpNombre,
  tpRol,
  setTpRol,
  tpTipoTercero,
  setTpTipoTercero,
  tpIdFiscal,
  setTpIdFiscal,
  tpPais,
  setTpPais,
  tpJurisdiccionFiscal,
  setTpJurisdiccionFiscal,
  tpExpenseAcc,
  setTpExpenseAcc,
  tpIvaRate,
  setTpIvaRate,
  tpOperacion,
  setTpOperacion,
  tpEfos,
  setTpEfos,
  onSubmit,
  onReset
}: PadronProveedoresFormProps) {
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
            <span className="px-2 py-0.5 rounded-full bg-blue-700 text-white text-[11px]">
              Editando RFC
            </span>
            <span className="font-mono">{tpRfc}</span>
          </span>
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] font-semibold text-blue-800 hover:underline cursor-pointer"
          >
            Cancelar edición
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="tp-rfc" className="block text-[11px] font-bold text-slate-700">
              RFC Proveedor / Cliente *
            </label>
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
          <input
            id="tp-rfc"
            type="text"
            required
            disabled={isReadOnly}
            minLength={12}
            maxLength={13}
            value={tpRfc}
            onChange={(e) => onRfcChange(e.target.value)}
            placeholder="TLE180920K71"
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono uppercase bg-white disabled:bg-slate-100"
          />
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="tp-nombre" className="block text-[11px] font-bold text-slate-700 mb-1">
            Razón Social *
          </label>
          <input
            id="tp-nombre"
            type="text"
            required
            disabled={isReadOnly}
            value={tpNombre}
            onChange={(e) => setTpNombre(e.target.value)}
            placeholder="Transportes y Logística Empresarial SA de CV"
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
          />
        </div>

        <div>
          <label htmlFor="tp-rol" className="block text-[11px] font-bold text-slate-700 mb-1">
            Rol
          </label>
          <select
            id="tp-rol"
            disabled={isReadOnly}
            value={tpRol}
            onChange={(e) => setTpRol(e.target.value as ThirdPartyRecord['rol'])}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
          >
            <option value="PROVEEDOR">Proveedor</option>
            <option value="CLIENTE">Cliente</option>
            <option value="AMBOS">Proveedor y Cliente</option>
          </select>
        </div>

        <div>
          <label htmlFor="tp-tipo-tercero" className="block text-[11px] font-bold text-slate-700 mb-1">
            Tipo Tercero DIOT
          </label>
          <select
            id="tp-tipo-tercero"
            disabled={isReadOnly}
            value={tpTipoTercero}
            onChange={(e) => setTpTipoTercero(e.target.value as '04' | '05' | '15')}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
          >
            <option value="04">04 Nacional</option>
            <option value="05">05 Extranjero</option>
            <option value="15">15 Global</option>
          </select>
        </div>

        {tpTipoTercero === '05' && (
          <>
            <div>
              <label htmlFor="tp-id-fiscal" className="block text-[11px] font-bold text-slate-700 mb-1">
                ID Fiscal Extranjero
              </label>
              <input
                id="tp-id-fiscal"
                type="text"
                disabled={isReadOnly}
                value={tpIdFiscal}
                onChange={(e) => setTpIdFiscal(e.target.value)}
                placeholder="US-99-123456"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white disabled:bg-slate-100"
              />
            </div>
            <div>
              <label htmlFor="tp-pais" className="block text-[11px] font-bold text-slate-700 mb-1">
                País (ISO / SAT)
              </label>
              <input
                id="tp-pais"
                type="text"
                maxLength={3}
                disabled={isReadOnly}
                value={tpPais}
                onChange={(e) => setTpPais(e.target.value.toUpperCase())}
                placeholder="USA / ZZZ"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono uppercase bg-white disabled:bg-slate-100"
              />
            </div>
            {tpPais.trim().toUpperCase() === 'ZZZ' && (
              <div>
                <label htmlFor="tp-jurisdiccion" className="block text-[11px] font-bold text-slate-700 mb-1">
                  Jurisdicción (País ZZZ)
                </label>
                <input
                  id="tp-jurisdiccion"
                  type="text"
                  disabled={isReadOnly}
                  value={tpJurisdiccionFiscal}
                  onChange={(e) => setTpJurisdiccionFiscal(e.target.value)}
                  placeholder="Nombre de jurisdicción"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
                />
              </div>
            )}
          </>
        )}

        <div className="lg:col-span-2">
          <label htmlFor="tp-expense-acc" className="block text-[11px] font-bold text-slate-700 mb-1">
            Cuenta Gasto / Operación
          </label>
          <select
            id="tp-expense-acc"
            disabled={isReadOnly}
            value={tpExpenseAcc}
            onChange={(e) => setTpExpenseAcc(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white disabled:bg-slate-100"
          >
            {affectableAccounts.map((acc) => (
              <option key={acc.id} value={acc.code}>
                {acc.code} - {acc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tp-iva-rate" className="block text-[11px] font-bold text-slate-700 mb-1">
            Tasa IVA
          </label>
          <select
            id="tp-iva-rate"
            disabled={isReadOnly}
            value={tpIvaRate}
            onChange={(e) => setTpIvaRate(Number(e.target.value) as 16 | 8 | 0)}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white disabled:bg-slate-100"
          >
            <option value={16}>16%</option>
            <option value={8}>8% Frontera</option>
            <option value={0}>0%</option>
          </select>
        </div>

        <div>
          <label htmlFor="tp-operacion-diot" className="block text-[11px] font-bold text-slate-700 mb-1">
            Op. DIOT
          </label>
          <select
            id="tp-operacion-diot"
            disabled={isReadOnly}
            value={tpOperacion}
            onChange={(e) => setTpOperacion(e.target.value as '03' | '06' | '85')}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono bg-white disabled:bg-slate-100"
          >
            <option value="03">03 Serv. Prof.</option>
            <option value="06">06 Arrend.</option>
            <option value="85">85 Otros</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="tp-efos" className="block text-[11px] font-bold text-slate-700 mb-1">
            Lista 69-B
          </label>
          <select
            id="tp-efos"
            disabled={isReadOnly}
            value={tpEfos}
            onChange={(e) => setTpEfos(e.target.value as Efos69BStatus)}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white disabled:bg-slate-100"
          >
            <option value="LIMPIO">Limpio</option>
            <option value="PRESUNTO_EFOS">Presunto</option>
            <option value="DEFINITIVO_EFOS">Definitivo</option>
            <option value="DESVIRTUADO">Desvirtuado</option>
          </select>
        </div>

        <div className="lg:col-span-4 flex items-end justify-end gap-2">
          {(tpRfc || tpNombre) && (
            <button
              type="button"
              disabled={isReadOnly || isPending}
              onClick={onReset}
              title="Limpiar formulario"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
            >
              Limpiar
            </button>
          )}
          <button
            type="submit"
            disabled={isPending || isReadOnly}
            title={isReadOnly ? 'Modo solo lectura' : isEditing ? 'Actualizar datos del tercero' : 'Guardar nuevo tercero en el padrón'}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : isEditing ? (
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{isPending ? (isEditing ? 'Actualizando...' : 'Guardando...') : isEditing ? 'Actualizar' : 'Guardar'}</span>
          </button>
        </div>
      </div>
    </form>
  );
}

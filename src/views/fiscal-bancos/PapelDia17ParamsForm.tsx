import { RotateCcw, Save } from 'lucide-react';

export interface PapelDia17DraftParams {
  coefUtilidad: string;
  perdidasAmortizar: string;
  pagosPrevios: string;
  ptuPagadaEjercicio: string;
  ivaSaldoFavor: string;
  tcCierreUsd: string;
}

export interface PapelDia17ParamsFormProps {
  isResico: boolean;
  isResicoPf: boolean;
  isPfGeneral: boolean;
  isWriteLocked: boolean;
  lockTitle: string;
  draftParams: PapelDia17DraftParams;
  updateDraftField: (field: keyof PapelDia17DraftParams, val: string) => void;
  normalizeDraftField: (field: keyof PapelDia17DraftParams, minDecimals?: number) => void;
  hasUnsavedParams: boolean;
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function PapelDia17ParamsForm({
  isResico,
  isResicoPf,
  isPfGeneral,
  isWriteLocked,
  lockTitle,
  draftParams,
  updateDraftField,
  normalizeDraftField,
  hasUnsavedParams,
  isSaving,
  onSave,
  onReset
}: PapelDia17ParamsFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isWriteLocked && hasUnsavedParams) onSave();
      }}
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${
        isResicoPf ? 'xl:grid-cols-3' : isPfGeneral ? 'xl:grid-cols-6' : 'xl:grid-cols-7'
      } items-end gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs`}
    >
      {!isPfGeneral && !isResicoPf && (
        <div>
          <label htmlFor="dia17-coef-utilidad" className="block text-[11px] font-bold text-slate-700 mb-1">
            Coeficiente Utilidad (C.U.)
          </label>
          <input
            id="dia17-coef-utilidad"
            type="text"
            inputMode="decimal"
            disabled={isWriteLocked || isResico}
            title={
              isWriteLocked
                ? lockTitle
                : isResico
                  ? 'No aplica en RESICO (tributa sobre flujo de efectivo)'
                  : 'Coeficiente de Utilidad según última declaración anual (Art. 14 LISR)'
            }
            value={draftParams.coefUtilidad}
            onChange={(e) => updateDraftField('coefUtilidad', e.target.value)}
            onBlur={() => normalizeDraftField('coefUtilidad', 1)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
          {isResico && <p className="mt-1 text-[11px] text-slate-600">No aplica en RESICO</p>}
        </div>
      )}
      {!isResicoPf && (
        <>
          <div>
            <label htmlFor="dia17-perdidas-amortizar" className="block text-[11px] font-bold text-slate-700 mb-1">
              Pérdidas x Amortizar ($)
            </label>
            <input
              id="dia17-perdidas-amortizar"
              type="text"
              inputMode="decimal"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Pérdidas fiscales pendientes de amortizar actualizadas (Art. 57 LISR)'}
              value={draftParams.perdidasAmortizar}
              onChange={(e) => updateDraftField('perdidasAmortizar', e.target.value)}
              onBlur={() => normalizeDraftField('perdidasAmortizar')}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dia17-pagos-previos" className="block text-[11px] font-bold text-slate-700 mb-1">
              Pagos Prov. Anteriores ($)
            </label>
            <input
              id="dia17-pagos-previos"
              type="text"
              inputMode="decimal"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Pagos provisionales de ISR enterados previamente en el ejercicio (Art. 14 LISR)'}
              value={draftParams.pagosPrevios}
              onChange={(e) => updateDraftField('pagosPrevios', e.target.value)}
              onBlur={() => normalizeDraftField('pagosPrevios')}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="dia17-ptu-pagada" className="block text-[11px] font-bold text-slate-700 mb-1">
              PTU Pagada Ejercicio ($)
            </label>
            <input
              id="dia17-ptu-pagada"
              type="text"
              inputMode="decimal"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'PTU pagada en el ejercicio disminuible en pagos provisionales (Art. 14 / Art. 106 LISR)'}
              value={draftParams.ptuPagadaEjercicio}
              onChange={(e) => updateDraftField('ptuPagadaEjercicio', e.target.value)}
              onBlur={() => normalizeDraftField('ptuPagadaEjercicio')}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
        </>
      )}
      <div>
        <label htmlFor="dia17-iva-saldo-favor" className="block text-[11px] font-bold text-slate-700 mb-1">
          Saldo a Favor IVA Ant. ($)
        </label>
        <input
          id="dia17-iva-saldo-favor"
          type="text"
          inputMode="decimal"
          disabled={isWriteLocked}
          title={isWriteLocked ? lockTitle : 'Saldo a favor de IVA de meses previos por acreditar (Art. 6 LIVA)'}
          value={draftParams.ivaSaldoFavor}
          onChange={(e) => updateDraftField('ivaSaldoFavor', e.target.value)}
          onBlur={() => normalizeDraftField('ivaSaldoFavor')}
          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
        />
      </div>
      <div>
        <label htmlFor="dia17-tc-cierre-usd" className="block text-[11px] font-bold text-slate-700 mb-1">
          TC Cierre USD (DOF)
        </label>
        <input
          id="dia17-tc-cierre-usd"
          type="text"
          inputMode="decimal"
          disabled={isWriteLocked}
          title={isWriteLocked ? lockTitle : 'Tipo de cambio oficial publicado por el Diario Oficial de la Federación (DOF) al cierre de mes'}
          value={draftParams.tcCierreUsd}
          onChange={(e) => updateDraftField('tcCierreUsd', e.target.value)}
          onBlur={() => normalizeDraftField('tcCierreUsd')}
          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono tabular-nums bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
        />
      </div>
      <div
        className={`flex items-end justify-end gap-1.5 ${
          isResicoPf
            ? 'sm:col-span-2 lg:col-span-1'
            : isPfGeneral
              ? 'xl:col-span-1'
              : 'sm:col-span-2 lg:col-span-3 xl:col-span-1'
        }`}
      >
        <button
          type="submit"
          disabled={isSaving || isWriteLocked || !hasUnsavedParams}
          title={
            isWriteLocked
              ? lockTitle
              : !hasUnsavedParams
                ? 'Modifica al menos un parámetro para recalcular'
                : 'Aplicar parámetros y recalcular cédula Día 17'
          }
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A1120] hover:bg-slate-800 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition shadow-2xs"
        >
          <Save className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isSaving ? 'Aplicando...' : 'Recalcular'}</span>
        </button>
        {hasUnsavedParams && (
          <button
            type="button"
            disabled={isWriteLocked}
            onClick={onReset}
            title={isWriteLocked ? lockTitle : 'Descartar cambios sin guardar'}
            aria-label="Descartar cambios de parámetros fiscales"
            className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}

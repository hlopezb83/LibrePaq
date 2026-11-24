import { RotateCcw, Save } from 'lucide-react';
import { Button, FormField, Input } from '../../components/ui';

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
        <FormField
          label="Coeficiente Utilidad (C.U.)"
          htmlFor="dia17-coef-utilidad"
          hint={isResico ? 'No aplica en RESICO' : undefined}
        >
          <Input
            id="dia17-coef-utilidad"
            size="sm"
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
            className="font-mono tabular-nums"
          />
        </FormField>
      )}

      {!isResicoPf && (
        <>
          <FormField label="Pérdidas x Amortizar ($)" htmlFor="dia17-perdidas-amortizar">
            <Input
              id="dia17-perdidas-amortizar"
              size="sm"
              type="text"
              inputMode="decimal"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Pérdidas fiscales pendientes de amortizar actualizadas (Art. 57 LISR)'}
              value={draftParams.perdidasAmortizar}
              onChange={(e) => updateDraftField('perdidasAmortizar', e.target.value)}
              onBlur={() => normalizeDraftField('perdidasAmortizar')}
              className="font-mono tabular-nums"
            />
          </FormField>

          <FormField label="Pagos Prov. Anteriores ($)" htmlFor="dia17-pagos-previos">
            <Input
              id="dia17-pagos-previos"
              size="sm"
              type="text"
              inputMode="decimal"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'Pagos provisionales de ISR enterados previamente en el ejercicio (Art. 14 LISR)'}
              value={draftParams.pagosPrevios}
              onChange={(e) => updateDraftField('pagosPrevios', e.target.value)}
              onBlur={() => normalizeDraftField('pagosPrevios')}
              className="font-mono tabular-nums"
            />
          </FormField>

          <FormField label="PTU Pagada Ejercicio ($)" htmlFor="dia17-ptu-pagada">
            <Input
              id="dia17-ptu-pagada"
              size="sm"
              type="text"
              inputMode="decimal"
              disabled={isWriteLocked}
              title={isWriteLocked ? lockTitle : 'PTU pagada en el ejercicio disminuible en pagos provisionales (Art. 14 / Art. 106 LISR)'}
              value={draftParams.ptuPagadaEjercicio}
              onChange={(e) => updateDraftField('ptuPagadaEjercicio', e.target.value)}
              onBlur={() => normalizeDraftField('ptuPagadaEjercicio')}
              className="font-mono tabular-nums"
            />
          </FormField>
        </>
      )}

      <FormField label="Saldo a Favor IVA Ant. ($)" htmlFor="dia17-iva-saldo-favor">
        <Input
          id="dia17-iva-saldo-favor"
          size="sm"
          type="text"
          inputMode="decimal"
          disabled={isWriteLocked}
          title={isWriteLocked ? lockTitle : 'Saldo a favor de IVA de meses previos por acreditar (Art. 6 LIVA)'}
          value={draftParams.ivaSaldoFavor}
          onChange={(e) => updateDraftField('ivaSaldoFavor', e.target.value)}
          onBlur={() => normalizeDraftField('ivaSaldoFavor')}
          className="font-mono tabular-nums"
        />
      </FormField>

      <FormField label="TC Cierre USD (DOF)" htmlFor="dia17-tc-cierre-usd">
        <Input
          id="dia17-tc-cierre-usd"
          size="sm"
          type="text"
          inputMode="decimal"
          disabled={isWriteLocked}
          title={isWriteLocked ? lockTitle : 'Tipo de cambio oficial publicado por el Diario Oficial de la Federación (DOF) al cierre de mes'}
          value={draftParams.tcCierreUsd}
          onChange={(e) => updateDraftField('tcCierreUsd', e.target.value)}
          onBlur={() => normalizeDraftField('tcCierreUsd')}
          className="font-mono tabular-nums"
        />
      </FormField>

      <div
        className={`flex items-end justify-end gap-1.5 ${
          isResicoPf
            ? 'sm:col-span-2 lg:col-span-1'
            : isPfGeneral
              ? 'xl:col-span-1'
              : 'sm:col-span-2 lg:col-span-3 xl:col-span-1'
        }`}
      >
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={isSaving}
          disabled={isWriteLocked || !hasUnsavedParams}
          title={
            isWriteLocked
              ? lockTitle
              : !hasUnsavedParams
                ? 'Modifica al menos un parámetro para recalcular'
                : 'Aplicar parámetros y recalcular cédula Día 17'
          }
          leftIcon={<Save className="w-3.5 h-3.5" aria-hidden="true" />}
          className="flex-1"
        >
          <span>{isSaving ? 'Aplicando...' : 'Recalcular'}</span>
        </Button>
        {hasUnsavedParams && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isWriteLocked}
            onClick={onReset}
            title={isWriteLocked ? lockTitle : 'Descartar cambios sin guardar'}
            aria-label="Descartar cambios de parámetros fiscales"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </form>
  );
}

import { FormField, Input, LABEL_CLASS, Select } from '../../components/ui';
import { MEXICO_ISN_RATES } from '../../shared/engine/payroll-summary.engine';

export interface NominaSuaIsnFormGridProps {
  isLocked: boolean;
  lockReason: string | null;
  stateCode: string;
  selectedStateNotes?: string;
  isnRateInput: string;
  baseInput: string | null;
  totalPercepciones: number;
  resolvedBase: number;
  imssInput: string;
  rcvInput: string;
  infonavitInput: string;
  onStateChange: (code: string) => void;
  onIsnRateChange: (val: string) => void;
  onBaseChange: (val: string | null) => void;
  onImssChange: (val: string) => void;
  onRcvChange: (val: string) => void;
  onInfonavitChange: (val: string) => void;
}

export function NominaSuaIsnFormGrid({
  isLocked,
  lockReason,
  stateCode,
  selectedStateNotes,
  isnRateInput,
  baseInput,
  totalPercepciones,
  resolvedBase,
  imssInput,
  rcvInput,
  infonavitInput,
  onStateChange,
  onIsnRateChange,
  onBaseChange,
  onImssChange,
  onRcvChange,
  onInfonavitChange
}: NominaSuaIsnFormGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
      <FormField label="Estado ISN (32 Entidades)" htmlFor="isn-state-select" hint={selectedStateNotes}>
        <Select
          id="isn-state-select"
          disabled={isLocked}
          value={stateCode}
          onChange={(e) => onStateChange(e.target.value)}
        >
          {MEXICO_ISN_RATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.ratePct.toFixed(2)}%)
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Tasa ISN (%)" htmlFor="isn-rate-input">
        <Input
          id="isn-rate-input"
          type="number"
          inputMode="decimal"
          min="0"
          max="10"
          step="0.01"
          disabled={isLocked}
          value={isnRateInput}
          onChange={(e) => onIsnRateChange(e.target.value)}
          className="font-mono tabular-nums"
        />
      </FormField>

      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <label htmlFor="isn-base-input" className={LABEL_CLASS.replace(' mb-1', '')}>
            Base Gravable ISN ($)
          </label>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onBaseChange(null)}
            title={lockReason ?? 'Aplicar total de percepciones de los recibos Tipo N del periodo'}
            className="text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Usar nómina
          </button>
        </div>
        <Input
          id="isn-base-input"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          disabled={isLocked}
          placeholder={String(totalPercepciones)}
          value={baseInput === null ? String(totalPercepciones) : baseInput}
          onChange={(e) => onBaseChange(e.target.value)}
          className="font-mono tabular-nums"
        />
      </div>

      <FormField label="IMSS Patronal ($)" htmlFor="sua-imss-input">
        <Input
          id="sua-imss-input"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          disabled={isLocked}
          value={imssInput}
          onChange={(e) => onImssChange(e.target.value)}
          className="font-mono tabular-nums"
        />
      </FormField>

      <FormField label="RCV Patronal ($)" htmlFor="sua-rcv-input">
        <Input
          id="sua-rcv-input"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          disabled={isLocked}
          value={rcvInput}
          onChange={(e) => onRcvChange(e.target.value)}
          className="font-mono tabular-nums"
        />
      </FormField>

      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <label htmlFor="sua-infonavit-input" className={LABEL_CLASS.replace(' mb-1', '')}>
            INFONAVIT 5% ($)
          </label>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onInfonavitChange((resolvedBase * 0.05).toFixed(2))}
            title={lockReason ?? 'Estimar INFONAVIT como 5% de la base gravable ISN'}
            className="text-[11px] font-semibold text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Estimar 5%
          </button>
        </div>
        <Input
          id="sua-infonavit-input"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          disabled={isLocked}
          value={infonavitInput}
          onChange={(e) => onInfonavitChange(e.target.value)}
          className="font-mono tabular-nums"
        />
      </div>
    </div>
  );
}

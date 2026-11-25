import React, { useRef } from 'react';
import { Lock, Wand2 } from 'lucide-react';
import { AlertBanner, Button, FormField, INPUT_BASE_CLASS, Select } from '../../components/ui';
import type { CfdiDocument, PolizaTemplate, PolizaType } from '../../shared/types';
import { PolizaMultiCfdiBar } from './PolizaMultiCfdiBar';

interface PolizaEditorHeaderProps {
  editingPolizaId: string | null;
  currentYear?: number;
  currentPeriod?: number;
  isPeriodLocked: boolean;
  tipo: PolizaType;
  setTipo: (t: PolizaType) => void;
  fecha: string;
  setFecha: (f: string) => void;
  concepto: string;
  setConcepto: (c: string) => void;
  conceptoInputRef: React.RefObject<HTMLInputElement | null>;
  onConceptoEnter: () => void;
  cfdiUuids: string[];
  pendingCfdis: CfdiDocument[];
  allCfdis?: CfdiDocument[];
  handleSelectCfdiForForm: (uuid: string) => void;
  handleAddCfdiUuid: (uuid: string) => void;
  handleRemoveCfdiUuid: (uuid: string) => void;
  formError: string | null;
  isDateDifferentPeriod: boolean;
  onUseActivePeriodDate?: () => void;
  applyQuickTemplate: (tpl: 'GASTO_16' | 'VENTA_PPD' | 'PAGO_IMPUESTOS') => void;
  polizaTemplates?: PolizaTemplate[];
  applySavedTemplate?: (tpl: PolizaTemplate, baseAmount?: number) => void;
}

export function PolizaEditorHeader({
  editingPolizaId,
  currentYear,
  currentPeriod,
  isPeriodLocked,
  tipo,
  setTipo,
  fecha,
  setFecha,
  concepto,
  setConcepto,
  conceptoInputRef,
  onConceptoEnter,
  cfdiUuids,
  pendingCfdis,
  allCfdis,
  handleSelectCfdiForForm,
  handleAddCfdiUuid,
  handleRemoveCfdiUuid,
  formError,
  isDateDifferentPeriod,
  onUseActivePeriodDate,
  applyQuickTemplate,
  polizaTemplates = [],
  applySavedTemplate
}: PolizaEditorHeaderProps) {
  const fechaInputRef = useRef<HTMLInputElement>(null);
  const focusConcepto = () => {
    conceptoInputRef.current?.focus();
    conceptoInputRef.current?.select();
  };

  return (
    <>
      {isDateDifferentPeriod && (
        <AlertBanner
          tone="warning"
          title="Aviso de Periodo Fiscal:"
          action={
            onUseActivePeriodDate ? (
              <Button variant="secondary" size="sm" onClick={onUseActivePeriodDate}>
                Usar fecha del periodo activo
              </Button>
            ) : undefined
          }
        >
          La fecha (<strong>{fecha}</strong>) pertenece al periodo P{fecha.slice(5, 7)}/{fecha.slice(0, 4)}, distinto al activo (<strong>P{String(currentPeriod).padStart(2, '0')}/{currentYear}</strong>).
        </AlertBanner>
      )}

      {isPeriodLocked && (
        <AlertBanner
          tone="danger"
          icon={<Lock className="w-4 h-4" aria-hidden="true" />}
          title="Periodo Bloqueado:"
        >
          No es posible guardar cambios en este periodo fiscal porque ha sido cerrado ante el SAT.
        </AlertBanner>
      )}

      {formError && (
        <AlertBanner tone="danger">
          {formError}
        </AlertBanner>
      )}

      {!editingPolizaId && (
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 w-full min-w-0 max-w-full">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Wand2 className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            Plantillas Rápidas:
          </span>
          <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
            <button
              type="button"
              onClick={() => applyQuickTemplate('GASTO_16')}
              title="Gasto general pagado con IVA acreditable 16% (Atajo: Alt+1)"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 cursor-pointer transition shadow-2xs"
            >
              <span>1. Gasto 16% (Egreso)</span>
              <kbd className="hidden sm:inline font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-300 ml-1.5 font-bold">
                Alt+1
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => applyQuickTemplate('VENTA_PPD')}
              title="Venta a crédito PPD con IVA trasladado no cobrado (Atajo: Alt+2)"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 cursor-pointer transition shadow-2xs"
            >
              <span>2. Venta PPD 16% (Diario)</span>
              <kbd className="hidden sm:inline font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-300 ml-1.5 font-bold">
                Alt+2
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => applyQuickTemplate('PAGO_IMPUESTOS')}
              title="Pago de impuestos federales ISR e IVA en bancos (Atajo: Alt+3)"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 cursor-pointer transition shadow-2xs"
            >
              <span>3. Pago de Impuestos (Egreso)</span>
              <kbd className="hidden sm:inline font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-300 ml-1.5 font-bold">
                Alt+3
              </kbd>
            </button>
            {polizaTemplates.length > 0 && applySavedTemplate && (
              <select
                aria-label="Aplicar pre-póliza guardada"
                defaultValue=""
                onChange={(e) => {
                  const found = polizaTemplates.find((t) => t.id === e.target.value);
                  if (found) {
                    applySavedTemplate(found);
                    e.target.value = '';
                  }
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-900 border border-blue-200 cursor-pointer"
              >
                <option value="">Aplicar pre-póliza ({polizaTemplates.length})...</option>
                {polizaTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.tipo})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <PolizaMultiCfdiBar
        editingPolizaId={editingPolizaId}
        cfdiUuids={cfdiUuids}
        pendingCfdis={pendingCfdis}
        allCfdis={allCfdis}
        onSelectPrimaryCfdi={handleSelectCfdiForForm}
        onAddCfdiUuid={handleAddCfdiUuid}
        onRemoveCfdiUuid={handleRemoveCfdiUuid}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0">
        <FormField label="Tipo de Póliza" htmlFor="pol-tipo" required className="min-w-0">
          <Select
            id="pol-tipo"
            form="poliza-form"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as PolizaType)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                fechaInputRef.current?.focus();
              }
            }}
            className="font-semibold"
          >
            <option value="INGRESO">INGRESO</option>
            <option value="EGRESO">EGRESO</option>
            <option value="DIARIO">DIARIO</option>
          </Select>
        </FormField>

        <FormField label="Fecha Contable" htmlFor="pol-fecha" required className="min-w-0">
          <input
            ref={fechaInputRef}
            id="pol-fecha"
            form="poliza-form"
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                focusConcepto();
              }
            }}
            className={`${INPUT_BASE_CLASS} font-mono tabular-nums`}
          />
        </FormField>

        <FormField label="Concepto General de la Póliza" htmlFor="pol-concepto" required className="min-w-0">
          <input
            ref={conceptoInputRef}
            id="pol-concepto"
            form="poliza-form"
            type="text"
            autoFocus
            required
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onConceptoEnter();
              }
            }}
            placeholder="Ej. Provisión de servicios profesionales del mes"
            className={INPUT_BASE_CLASS}
          />
        </FormField>
      </div>
    </>
  );
}

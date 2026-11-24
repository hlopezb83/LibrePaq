import React, { useRef } from 'react';
import { AlertCircle, Lock, Wand2 } from 'lucide-react';
import type { CfdiDocument, PolizaType } from '../../shared/types';
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
  applyQuickTemplate
}: PolizaEditorHeaderProps) {
  const fechaInputRef = useRef<HTMLInputElement>(null);
  const focusConcepto = () => {
    conceptoInputRef.current?.focus();
    conceptoInputRef.current?.select();
  };

  return (
    <>
      {isDateDifferentPeriod && (
        <div
          role="status"
          className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2 shadow-2xs w-full min-w-0 max-w-full"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
            <span>
              <strong>Aviso de Periodo Fiscal:</strong> La fecha (<strong>{fecha}</strong>) pertenece al periodo P{fecha.slice(5, 7)}/{fecha.slice(0, 4)}, distinto al activo (<strong>P{String(currentPeriod).padStart(2, '0')}/{currentYear}</strong>).
            </span>
          </div>
          {onUseActivePeriodDate && (
            <button
              type="button"
              onClick={onUseActivePeriodDate}
              className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-semibold text-[11px] border border-amber-400 cursor-pointer transition shrink-0"
            >
              Usar fecha del periodo activo
            </button>
          )}
        </div>
      )}

      {isPeriodLocked && (
        <div
          role="status"
          className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2 shadow-2xs"
        >
          <Lock className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>
            <strong>Periodo Bloqueado:</strong> No es posible guardar cambios en este periodo fiscal porque ha sido cerrado ante el SAT.
          </span>
        </div>
      )}

      {formError && (
        <div role="alert" aria-live="polite" className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          {formError}
        </div>
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
              title="Venta a clientes con cobro inmediato en banco (Atajo: Alt+2)"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 cursor-pointer transition shadow-2xs"
            >
              <span>2. Venta 16% (Ingreso)</span>
              <kbd className="hidden sm:inline font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-300 ml-1.5 font-bold">
                Alt+2
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => applyQuickTemplate('PAGO_IMPUESTOS')}
              title="Provisión de compra con cuenta por pagar a proveedor (Atajo: Alt+3)"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 cursor-pointer transition shadow-2xs"
            >
              <span>3. Provisión Proveedor</span>
              <kbd className="hidden sm:inline font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-300 ml-1.5 font-bold">
                Alt+3
              </kbd>
            </button>
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
        <div className="min-w-0">
          <label htmlFor="pol-tipo" className="block text-xs font-semibold text-slate-700 mb-1">
            Tipo de Póliza *
          </label>
          <select
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
            className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white cursor-pointer"
          >
            <option value="INGRESO">INGRESO</option>
            <option value="EGRESO">EGRESO</option>
            <option value="DIARIO">DIARIO</option>
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="pol-fecha" className="block text-xs font-semibold text-slate-700 mb-1">
            Fecha Contable *
          </label>
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
            className="w-full min-w-0 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="pol-concepto" className="block text-xs font-semibold text-slate-700 mb-1">
            Concepto General de la Póliza *
          </label>
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
            className="w-full min-w-0 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
          />
        </div>
      </div>
    </>
  );
}

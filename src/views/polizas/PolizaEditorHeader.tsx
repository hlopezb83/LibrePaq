import React from 'react';
import { AlertCircle, Lock, ReceiptText, Wand2, X } from 'lucide-react';
import type { CfdiDocument, Company, PolizaType } from '../../shared/types';
import { PolizaMultiCfdiBar } from './PolizaMultiCfdiBar';

interface PolizaEditorHeaderProps {
  editingPolizaId: string | null;
  activeCompany?: Company | null;
  currentYear?: number;
  currentPeriod?: number;
  isPeriodLocked: boolean;
  predictedNextFolio: number;
  tipo: PolizaType;
  setTipo: (t: PolizaType) => void;
  fecha: string;
  setFecha: (f: string) => void;
  concepto: string;
  setConcepto: (c: string) => void;
  conceptoInputRef: React.RefObject<HTMLInputElement | null>;
  onConceptoEnter: () => void;
  cfdiUuid: string;
  cfdiUuids: string[];
  pendingCfdis: CfdiDocument[];
  allCfdis?: CfdiDocument[];
  handleSelectCfdiForForm: (uuid: string) => void;
  handleAddCfdiUuid: (uuid: string) => void;
  handleRemoveCfdiUuid: (uuid: string) => void;
  formError: string | null;
  isDateDifferentPeriod: boolean;
  applyQuickTemplate: (tpl: 'GASTO_16' | 'VENTA_PPD' | 'PAGO_IMPUESTOS') => void;
  onClose: () => void;
}

export function PolizaEditorHeader({
  editingPolizaId,
  activeCompany,
  currentYear,
  currentPeriod,
  isPeriodLocked,
  predictedNextFolio,
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
  applyQuickTemplate,
  onClose
}: PolizaEditorHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <ReceiptText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 id="modal-poliza-title" className="text-base font-bold text-slate-900">
                {editingPolizaId ? 'Editar Póliza Contable' : 'Capturar Nueva Póliza Contable'}
              </h2>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                {editingPolizaId ? 'Modo Edición' : `Folio Asignado: ${tipo} #${predictedNextFolio}`}
              </span>
              {isPeriodLocked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                  <Lock className="w-3 h-3 text-amber-700" aria-hidden="true" /> Periodo Bloqueado
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-slate-600">
              <span className="font-bold text-slate-800">{activeCompany?.name}</span>
              <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 text-[11px] font-bold">
                {activeCompany?.rfc}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-mono text-[11px] text-blue-700 font-semibold">
                Periodo P{String(currentPeriod ?? 1).padStart(2, '0')}/{currentYear ?? 2026}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar captura de póliza"
          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Barra de Atajos y Ayuda Rápida */}
      <div className="bg-slate-100/80 px-3.5 py-2 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 font-mono">
        <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-sans">
          <Wand2 className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
          Atajos de teclado:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">Tab</kbd> / <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">Enter</kbd> avanzar</span>
          <span>•</span>
          <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">"</kbd> / <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">F3</kbd> copiar arriba</span>
          <span>•</span>
          <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">=</kbd> o <kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">Espacio</kbd> auto-cuadrar</span>
          <span>•</span>
          <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">Alt+1..3</kbd> plantillas</span>
          <span>•</span>
          <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">F4</kbd> IVA 16%</span>
          <span>•</span>
          <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">F2</kbd> catálogo</span>
          <span>•</span>
          <span><kbd className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-bold">Ctrl+Enter</kbd> guardar</span>
        </div>
      </div>

      {isDateDifferentPeriod && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
          <span>
            <strong>Aviso de Periodo Fiscal:</strong> La fecha contable seleccionada (<strong>{fecha}</strong>) pertenece al periodo P{fecha.slice(5, 7)}/{fecha.slice(0, 4)}, que difiere del periodo activo de trabajo (<strong>P{String(currentPeriod).padStart(2, '0')}/{currentYear}</strong>).
          </span>
        </div>
      )}

      {isPeriodLocked && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2 shadow-2xs">
          <Lock className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
          <span>
            <strong>Periodo Bloqueado:</strong> No es posible guardar cambios en este periodo fiscal porque ha sido cerrado ante el SAT.
          </span>
        </div>
      )}

      {formError && (
        <div role="alert" aria-live="polite" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          {formError}
        </div>
      )}

      {/* Barra de Asientos Tipo */}
      {!editingPolizaId && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Wand2 className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            Asientos Tipo (Plantillas Rápidas):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => applyQuickTemplate('GASTO_16')}
              title="Gasto general pagado con IVA acreditable 16% (Atajo: Alt+1)"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 cursor-pointer transition shadow-2xs"
            >
              <span>1. Gasto Operativo 16% (Egreso)</span>
              <kbd className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-300 ml-1.5 font-bold">
                Alt+1
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => applyQuickTemplate('VENTA_PPD')}
              title="Venta a clientes con cobro inmediato en banco (Atajo: Alt+2)"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 cursor-pointer transition shadow-2xs"
            >
              <span>2. Venta / Cobro 16% (Ingreso)</span>
              <kbd className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-300 ml-1.5 font-bold">
                Alt+2
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => applyQuickTemplate('PAGO_IMPUESTOS')}
              title="Provisión de compra con cuenta por pagar a proveedor (Atajo: Alt+3)"
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-blue-50 text-slate-800 border border-slate-300 cursor-pointer transition shadow-2xs"
            >
              <span>3. Provisión Proveedor (Diario)</span>
              <kbd className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-300 ml-1.5 font-bold">
                Alt+3
              </kbd>
            </button>
          </div>
        </div>
      )}

      {/* Asociación de uno o múltiples CFDIs (creación y edición) */}
      <PolizaMultiCfdiBar
        editingPolizaId={editingPolizaId}
        cfdiUuids={cfdiUuids}
        pendingCfdis={pendingCfdis}
        allCfdis={allCfdis}
        onSelectPrimaryCfdi={handleSelectCfdiForForm}
        onAddCfdiUuid={handleAddCfdiUuid}
        onRemoveCfdiUuid={handleRemoveCfdiUuid}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label htmlFor="pol-tipo" className="block text-xs font-semibold text-slate-700 mb-1">
            Tipo de Póliza *
          </label>
          <select
            id="pol-tipo"
            form="poliza-form"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as PolizaType)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white cursor-pointer"
          >
            <option value="INGRESO">INGRESO</option>
            <option value="EGRESO">EGRESO</option>
            <option value="DIARIO">DIARIO</option>
          </select>
        </div>

        <div>
          <label htmlFor="pol-fecha" className="block text-xs font-semibold text-slate-700 mb-1">
            Fecha Contable *
          </label>
          <input
            id="pol-fecha"
            form="poliza-form"
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
          />
        </div>

        <div className="sm:col-span-2">
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
            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
          />
        </div>
      </div>
    </>
  );
}

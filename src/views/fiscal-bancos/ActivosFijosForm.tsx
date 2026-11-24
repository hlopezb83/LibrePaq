import { Plus, Save, X } from 'lucide-react';
import type { FixedAssetCategory, FixedAssetRecord } from '../../shared/types';

function sanitizeNumberInput(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

interface ActivosFijosFormProps {
  isEditing: boolean;
  isWriteLocked: boolean;
  lockTitle: string;
  isPending: boolean;
  assetCode: string;
  setAssetCode: (v: string) => void;
  assetName: string;
  setAssetName: (v: string) => void;
  assetDate: string;
  handleDateChange: (v: string) => void;
  assetCat: FixedAssetCategory;
  setAssetCat: (v: FixedAssetCategory) => void;
  setAssetRate: (v: number) => void;
  assetMoi: number;
  setAssetMoi: (v: number) => void;
  mesesDepreciadosPrevios: number;
  setMesesDepreciadosPrevios: (v: number) => void;
  assetStatus: FixedAssetRecord['estatus'];
  setAssetStatus: (v: FixedAssetRecord['estatus']) => void;
  assetInpcAdq: number;
  setAssetInpcAdq: (v: number) => void;
  assetInpcUso: number;
  setAssetInpcUso: (v: number) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
}

export function ActivosFijosForm({
  isEditing,
  isWriteLocked,
  lockTitle,
  isPending,
  assetCode,
  setAssetCode,
  assetName,
  setAssetName,
  assetDate,
  handleDateChange,
  assetCat,
  setAssetCat,
  setAssetRate,
  assetMoi,
  setAssetMoi,
  mesesDepreciadosPrevios,
  setMesesDepreciadosPrevios,
  assetStatus,
  setAssetStatus,
  assetInpcAdq,
  setAssetInpcAdq,
  assetInpcUso,
  setAssetInpcUso,
  onSubmit,
  onCancelEdit
}: ActivosFijosFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isWriteLocked) onSubmit();
      }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs"
    >
      {isEditing && (
        <div role="status" className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-950">
          <span className="inline-flex items-center gap-2 font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-blue-700 text-white text-[11px] font-bold">
              Editando activo
            </span>
            <span className="font-mono font-bold">{assetCode}</span>
            {assetName && <span className="text-slate-700 truncate">— {assetName}</span>}
          </span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-[11px] font-semibold text-blue-800 hover:underline cursor-pointer"
          >
            Cancelar edición
          </button>
        </div>
      )}
      <div>
        <label htmlFor="asset-code" className="block text-[10px] font-bold text-slate-700 mb-1">
          Código *
        </label>
        <input
          id="asset-code"
          type="text"
          required
          disabled={isWriteLocked}
          value={assetCode}
          onChange={(e) => setAssetCode(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
        />
      </div>

      <div>
        <label htmlFor="asset-name" className="block text-[10px] font-bold text-slate-700 mb-1">
          Descripción del Bien *
        </label>
        <input
          id="asset-name"
          type="text"
          required
          disabled={isWriteLocked}
          value={assetName}
          onChange={(e) => setAssetName(e.target.value)}
          placeholder="Ej. Laptop Dell Latitude / Utilitario"
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
        />
      </div>

      <div>
        <label htmlFor="asset-date" className="block text-[10px] font-bold text-slate-700 mb-1">
          Fecha Adquisición *
        </label>
        <input
          id="asset-date"
          type="date"
          required
          disabled={isWriteLocked}
          value={assetDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
        />
      </div>

      <div>
        <label htmlFor="asset-category" className="block text-[10px] font-bold text-slate-700 mb-1">
          Categoría / Tasa LISR
        </label>
        <select
          id="asset-category"
          disabled={isWriteLocked}
          value={assetCat}
          onChange={(e) => {
            const cat = e.target.value as FixedAssetCategory;
            setAssetCat(cat);
            if (cat === 'COMPUTO_30') setAssetRate(30);
            else if (cat === 'TRANSPORTE_25') setAssetRate(25);
            else if (cat === 'MOBILIARIO_10' || cat === 'MAQUINARIA_10') setAssetRate(10);
            else setAssetRate(5);
          }}
          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
        >
          <option value="COMPUTO_30">Cómputo (30%)</option>
          <option value="TRANSPORTE_25">Transporte (25%)</option>
          <option value="MOBILIARIO_10">Mobiliario (10%)</option>
          <option value="MAQUINARIA_10">Maquinaria (10%)</option>
          <option value="EDIFICIOS_5">Construcciones (5%)</option>
        </select>
      </div>

      <div>
        <label htmlFor="asset-moi" className="block text-[10px] font-bold text-slate-700 mb-1">
          MOI ($) *
        </label>
        <input
          id="asset-moi"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          disabled={isWriteLocked}
          value={assetMoi}
          onChange={(e) => setAssetMoi(sanitizeNumberInput(e.target.value))}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
        />
      </div>

      <div>
        <label htmlFor="asset-meses-prev" className="block text-[10px] font-bold text-slate-700 mb-1">
          Meses Dep. Previos (Migración)
        </label>
        <input
          id="asset-meses-prev"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          disabled={isWriteLocked}
          title="Meses ya depreciados previamente (ej. migración desde CONTPAQi)"
          value={mesesDepreciadosPrevios}
          onChange={(e) => setMesesDepreciadosPrevios(Math.floor(sanitizeNumberInput(e.target.value)))}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
        />
      </div>

      <div>
        <label htmlFor="asset-inpc-adq" className="block text-[10px] font-bold text-slate-700 mb-1">
          INPC Adquisición (INEGI DOF)
        </label>
        <input
          id="asset-inpc-adq"
          type="number"
          inputMode="decimal"
          min="0.001"
          step="0.001"
          disabled={isWriteLocked}
          value={assetInpcAdq}
          onChange={(e) => setAssetInpcAdq(sanitizeNumberInput(e.target.value))}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
        />
      </div>

      <div>
        <label htmlFor="asset-inpc-mid" className="block text-[10px] font-bold text-slate-700 mb-1">
          INPC Medio Periodo (INEGI DOF)
        </label>
        <input
          id="asset-inpc-mid"
          type="number"
          inputMode="decimal"
          min="0.001"
          step="0.001"
          disabled={isWriteLocked}
          value={assetInpcUso}
          onChange={(e) => setAssetInpcUso(sanitizeNumberInput(e.target.value))}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono bg-white disabled:bg-slate-100"
        />
      </div>

      {isEditing && (
        <div>
          <label htmlFor="asset-status" className="block text-[10px] font-bold text-slate-700 mb-1">
            Estatus del Bien
          </label>
          <select
            id="asset-status"
            disabled={isWriteLocked}
            value={assetStatus}
            onChange={(e) => setAssetStatus(e.target.value as FixedAssetRecord['estatus'])}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100"
          >
            <option value="ACTIVO">ACTIVO</option>
            <option value="BAJA">BAJA</option>
            <option value="TOTALMENTE_DEPRECIADO">TOTALMENTE DEPRECIADO</option>
          </select>
        </div>
      )}

      <div className={`flex items-end gap-2 ${isEditing ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
        <button
          type="submit"
          disabled={isPending || isWriteLocked}
          title={isWriteLocked ? lockTitle : undefined}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0A1120] hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white cursor-pointer"
        >
          {isEditing ? <Save className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
          {isEditing ? 'Guardar Cambios' : 'Agregar Activo'}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Cancelar Edición
          </button>
        )}
      </div>

      {assetCat === 'TRANSPORTE_25' && (
        <p role="note" className="sm:col-span-2 lg:col-span-4 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <strong>Art. 36 Fracc. II LISR:</strong> Automóviles utilitarios deducibles hasta un MOI de $175,000 MXN ($250,000 MXN en vehículos eléctricos o híbridos).
        </p>
      )}
    </form>
  );
}

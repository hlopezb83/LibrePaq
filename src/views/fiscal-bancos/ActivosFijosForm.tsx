import { Plus, Save, X } from 'lucide-react';
import { Button, FormField, Input, Select, StatusBadge } from '../../components/ui';
import type { FixedAssetCategory, FixedAssetRecord, VehicleCapType } from '../../shared/types';

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
  vehicleCapType: VehicleCapType;
  setVehicleCapType: (v: VehicleCapType) => void;
  setAssetRate: (v: number) => void;
  assetMoi: string;
  setAssetMoi: (v: string) => void;
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
  vehicleCapType,
  setVehicleCapType,
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
            <StatusBadge tone="blue">Editando activo</StatusBadge>
            <span className="font-mono font-bold">{assetCode}</span>
            {assetName && <span className="text-slate-700 truncate">— {assetName}</span>}
          </span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs font-semibold text-blue-800 hover:underline cursor-pointer"
          >
            Cancelar edición
          </button>
        </div>
      )}

      <FormField label="Código" htmlFor="asset-code" required>
        <Input
          id="asset-code"
          size="sm"
          type="text"
          required
          disabled={isWriteLocked}
          value={assetCode}
          onChange={(e) => setAssetCode(e.target.value)}
          className="font-mono"
        />
      </FormField>

      <FormField label="Descripción del Bien" htmlFor="asset-name" required>
        <Input
          id="asset-name"
          size="sm"
          type="text"
          required
          disabled={isWriteLocked}
          value={assetName}
          onChange={(e) => setAssetName(e.target.value)}
          placeholder="Ej. Laptop Dell Latitude / Utilitario"
        />
      </FormField>

      <FormField label="Fecha Adquisición" htmlFor="asset-date" required>
        <Input
          id="asset-date"
          size="sm"
          type="date"
          required
          disabled={isWriteLocked}
          value={assetDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="font-mono"
        />
      </FormField>

      <FormField label="Categoría / Tasa LISR" htmlFor="asset-category">
        <Select
          id="asset-category"
          size="sm"
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
        >
          <option value="COMPUTO_30">Cómputo (30%)</option>
          <option value="TRANSPORTE_25">Transporte (25%)</option>
          <option value="MOBILIARIO_10">Mobiliario (10%)</option>
          <option value="MAQUINARIA_10">Maquinaria (10%)</option>
          <option value="EDIFICIOS_5">Construcciones (5%)</option>
        </Select>
      </FormField>

      <FormField label="MOI ($)" htmlFor="asset-moi" required>
        <Input
          id="asset-moi"
          size="sm"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          disabled={isWriteLocked}
          placeholder="0.00"
          value={assetMoi}
          onChange={(e) => setAssetMoi(e.target.value)}
          className="font-mono"
        />
      </FormField>

      <FormField label="Meses Dep. Previos (Migración)" htmlFor="asset-meses-prev">
        <Input
          id="asset-meses-prev"
          size="sm"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          disabled={isWriteLocked}
          title="Meses ya depreciados previamente (ej. migración desde CONTPAQi)"
          value={mesesDepreciadosPrevios}
          onChange={(e) => setMesesDepreciadosPrevios(Math.floor(sanitizeNumberInput(e.target.value)))}
          className="font-mono"
        />
      </FormField>

      <FormField label="INPC Adquisición (INEGI DOF)" htmlFor="asset-inpc-adq">
        <Input
          id="asset-inpc-adq"
          size="sm"
          type="number"
          inputMode="decimal"
          min="0.001"
          step="0.001"
          disabled={isWriteLocked}
          value={assetInpcAdq}
          onChange={(e) => setAssetInpcAdq(sanitizeNumberInput(e.target.value))}
          className="font-mono"
        />
      </FormField>

      <FormField label="INPC Medio Periodo (INEGI DOF)" htmlFor="asset-inpc-mid">
        <Input
          id="asset-inpc-mid"
          size="sm"
          type="number"
          inputMode="decimal"
          min="0.001"
          step="0.001"
          disabled={isWriteLocked}
          value={assetInpcUso}
          onChange={(e) => setAssetInpcUso(sanitizeNumberInput(e.target.value))}
          className="font-mono"
        />
      </FormField>

      {assetCat === 'TRANSPORTE_25' && (
        <FormField label="Tope Vehicular Art. 36 LISR" htmlFor="asset-vehicle-cap" className="lg:col-span-2">
          <Select
            id="asset-vehicle-cap"
            size="sm"
            disabled={isWriteLocked}
            value={vehicleCapType}
            onChange={(e) => setVehicleCapType(e.target.value as VehicleCapType)}
          >
            <option value="AUTO_COMBUSTION">Automóvil Combustión (Tope $175,000 MXN)</option>
            <option value="AUTO_ELECTRICO">Automóvil Eléctrico / Híbrido (Tope $250,000 MXN)</option>
            <option value="CARGA_EXENTO">Camión / Carga / Reparto (Sin Tope)</option>
          </Select>
        </FormField>
      )}

      {isEditing && (
        <FormField label="Estatus del Bien" htmlFor="asset-status">
          <Select
            id="asset-status"
            size="sm"
            disabled={isWriteLocked}
            value={assetStatus}
            onChange={(e) => setAssetStatus(e.target.value as FixedAssetRecord['estatus'])}
          >
            <option value="ACTIVO">ACTIVO</option>
            <option value="BAJA">BAJA</option>
            <option value="TOTALMENTE_DEPRECIADO">TOTALMENTE DEPRECIADO</option>
          </Select>
        </FormField>
      )}

      <div className={`flex items-end gap-2 ${isEditing ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={isPending}
          disabled={isWriteLocked}
          title={isWriteLocked ? lockTitle : undefined}
          leftIcon={
            isEditing
              ? <Save className="w-3.5 h-3.5" aria-hidden="true" />
              : <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          }
        >
          {isEditing ? 'Guardar Cambios' : 'Agregar Activo'}
        </Button>
        {isEditing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancelEdit}
            leftIcon={<X className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Cancelar Edición
          </Button>
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

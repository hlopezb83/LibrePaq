import { AlertCircle, Anchor, Calculator, CheckCircle2, DollarSign, FileText, Loader2, X } from 'lucide-react';
import { AccountPickerCombobox } from '../../components/account-picker/AccountPickerCombobox';
import { formatCurrency } from '../../lib/formatters';
import type { Account } from '../../shared/types';
import { sanitizeDecimalInput, usePedimentoForm } from './usePedimentoForm';

export interface PedimentoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentPeriod: number;
  isPeriodLocked?: boolean;
  isReadOnlyClient?: boolean;
  accounts: Account[];
  onSavePoliza: (poliza: {
    tipo: 'EGRESO' | 'DIARIO';
    fecha: string;
    concepto: string;
    movements: Array<{ accountCode: string; concepto: string; cargo: number; abono: number }>;
  }) => void;
  isSaving: boolean;
}

export function PedimentoEditorModal({
  isOpen,
  onClose,
  currentYear,
  currentPeriod,
  isPeriodLocked = false,
  isReadOnlyClient = false,
  accounts,
  onSavePoliza,
  isSaving
}: PedimentoEditorModalProps) {
  const isWriteBlocked = isPeriodLocked || isReadOnlyClient;
  const f = usePedimentoForm({
    isOpen,
    onClose,
    currentYear,
    currentPeriod,
    isPeriodLocked,
    isReadOnlyClient,
    accounts,
    onSavePoliza
  });

  const isInvalidTotal = !Number.isFinite(f.totalDesembolso) || f.totalDesembolso <= 0;
  const isSubmitDisabled = isSaving || isWriteBlocked || !f.isPedimentoIdComplete || isInvalidTotal;
  const disabledTitle = isReadOnlyClient
    ? 'Modo solo lectura: no se pueden generar pólizas'
    : isPeriodLocked
    ? 'Periodo fiscal bloqueado ante el SAT'
    : !f.isPedimentoIdComplete
    ? 'Completa los 15 dígitos oficiales del pedimento (2+2+4+7)'
    : isInvalidTotal
    ? 'Captura los importes de DTA, PRV o IVA Aduanal mayores a $0.00'
    : 'Generar póliza contable de pedimento';

  if (!isOpen) return null;

  return (
    <dialog
      ref={f.dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="pedimento-modal-title"
      className="bg-white rounded-2xl shadow-xl border border-slate-300 w-full max-w-2xl max-h-[92dvh] open:flex open:flex-col overflow-hidden overscroll-contain backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
            <Anchor className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 id="pedimento-modal-title" className="text-sm font-bold text-slate-900">
              Registro de Pedimento de Importación Aduanal (Ley Aduanera / DIOT)
            </h3>
            <p className="text-xs text-slate-500">
              Genera la póliza con acreditamiento de IVA aduanal, DTA y PRV para clientes importadores
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar registro de pedimento"
          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isSubmitDisabled) return;
          f.handleConfirm();
        }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4 text-xs">
          {f.isDateDifferentPeriod && (
            <div
              role="status"
              className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>
                <strong>Aviso de Periodo Fiscal:</strong> La fecha seleccionada (<strong>{f.fecha}</strong>) difiere del periodo activo (<strong>P{String(currentPeriod).padStart(2, '0')}/{currentYear}</strong>).
              </span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" aria-hidden="true" />
                <span>1. Identificación y Formato Oficial del Pedimento (15 dígitos: 2+2+4+7)</span>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                {(f.ano || '--').padStart(2, '0')}  {(f.aduana || '--').padStart(2, '0')}  {(f.patente || '----').padStart(4, '0')}  {(f.consecutivo || '-------').padStart(7, '0')}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono">
              <div>
                <label htmlFor="ped-ano" className="block text-[10px] font-bold text-slate-600 mb-1">Año (2) *</label>
                <input
                  id="ped-ano" type="text" required minLength={2} maxLength={2} inputMode="numeric" pattern="[0-9]{2}" value={f.ano}
                  onChange={(e) => f.setAno(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="26"
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label htmlFor="ped-aduana" className="block text-[10px] font-bold text-slate-600 mb-1">Aduana (2) *</label>
                <input
                  id="ped-aduana" type="text" autoFocus required minLength={2} maxLength={2} inputMode="numeric" pattern="[0-9]{2}" value={f.aduana}
                  onChange={(e) => f.setAduana(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Ej. 24"
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label htmlFor="ped-patente" className="block text-[10px] font-bold text-slate-600 mb-1">Patente (4) *</label>
                <input
                  id="ped-patente" type="text" required minLength={4} maxLength={4} inputMode="numeric" pattern="[0-9]{4}" value={f.patente}
                  onChange={(e) => f.setPatente(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Ej. 3820"
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ped-consecutivo" className="block text-[10px] font-bold text-slate-600 mb-1">Consecutivo (7) *</label>
                <input
                  id="ped-consecutivo" type="text" required minLength={7} maxLength={7} inputMode="numeric" pattern="[0-9]{7}" value={f.consecutivo}
                  onChange={(e) => f.setConsecutivo(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="Ej. 4001234"
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label htmlFor="ped-clave" className="block text-[10px] font-bold text-slate-600 mb-1">Clave de Pedimento</label>
                <select
                  id="ped-clave" value={f.clave}
                  onChange={(e) => f.setClave(e.target.value as 'A1' | 'IN' | 'AF')}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                >
                  <option value="A1">A1 - Importación Definitiva</option>
                  <option value="IN">IN - Temporal para Elaboración / IMMEX</option>
                  <option value="AF">AF - Importación Activo Fijo</option>
                </select>
              </div>
              <div>
                <label htmlFor="ped-fecha" className="block text-[10px] font-bold text-slate-600 mb-1">Fecha de Pago</label>
                <input
                  id="ped-fecha" type="date" value={f.fecha}
                  onChange={(e) => f.setFecha(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-600 mb-1">Tipo Cambio DOF</span>
                <div className="flex items-center gap-1 font-mono text-slate-800 px-2 py-1.5 rounded-lg border border-slate-300 bg-slate-100/60">
                  <DollarSign className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  <span>${f.tcSugerido.toFixed(4)} MXN</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-slate-800">2. Liquidación al Comercio Exterior</span>
              <button
                type="button"
                onClick={f.handleAutoCalcIva}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer underline"
              >
                <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
                Calcular IVA 16% automáticamente
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div>
                <label htmlFor="ped-valor-aduana" className="block text-[10px] font-bold text-slate-600 mb-1">Valor Aduana ($)</label>
                <input
                  id="ped-valor-aduana" type="text" inputMode="decimal" placeholder="0.00"
                  value={f.valorAduanaRaw}
                  onChange={(e) => f.setValorAduanaRaw(sanitizeDecimalInput(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-right"
                />
              </div>
              <div>
                <label htmlFor="ped-dta" className="block text-[10px] font-bold text-slate-600 mb-1">DTA ($)</label>
                <input
                  id="ped-dta" type="text" inputMode="decimal" placeholder="0.00"
                  value={f.dtaRaw}
                  onChange={(e) => f.setDtaRaw(sanitizeDecimalInput(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-right"
                />
              </div>
              <div>
                <label htmlFor="ped-prv" className="block text-[10px] font-bold text-slate-600 mb-1">Prevalidación PRV ($)</label>
                <input
                  id="ped-prv" type="text" inputMode="decimal" placeholder="0.00"
                  value={f.prvRaw}
                  onChange={(e) => f.setPrvRaw(sanitizeDecimalInput(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-right"
                />
              </div>
              <div>
                <label htmlFor="ped-iva-pagado" className="block text-[10px] font-bold text-emerald-800 mb-1">IVA Aduanal ($) *</label>
                <input
                  id="ped-iva-pagado" type="text" inputMode="decimal" placeholder="0.00" required
                  value={f.ivaPagadoRaw}
                  onChange={(e) => f.setIvaPagadoRaw(sanitizeDecimalInput(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-emerald-400 bg-emerald-50/50 font-bold text-emerald-950 text-right"
                />
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5">
            <span className="font-bold text-blue-900 block">3. Asignación de Cuentas y Póliza Cuadrada</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="block text-[10px] font-bold text-slate-600 mb-1">Cuenta IVA Aduanal</span>
                <AccountPickerCombobox
                  accounts={accounts}
                  value={f.cuentaIvaId}
                  onChange={f.setCuentaIvaId}
                  ariaLabel="Cuenta IVA Aduanal"
                  placeholder="Buscar 118..."
                />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-600 mb-1">Cuenta DTA y Gastos</span>
                <AccountPickerCombobox
                  accounts={accounts}
                  value={f.cuentaGastoId}
                  onChange={f.setCuentaGastoId}
                  ariaLabel="Cuenta DTA y Gastos"
                  placeholder="Buscar 601..."
                />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-600 mb-1">Cuenta Banco / Agente</span>
                <AccountPickerCombobox
                  accounts={accounts}
                  value={f.cuentaBancoId}
                  onChange={f.setCuentaBancoId}
                  ariaLabel="Cuenta Banco o Agente Aduanal"
                  placeholder="Buscar 102 / 201..."
                />
              </div>
            </div>

            <div className="space-y-1 font-mono text-[11px] pt-1 border-t border-blue-200">
              <div className="flex justify-between py-0.5 border-b border-blue-200/60">
                <span>[Cargo] IVA Acreditable Aduana ({f.cuentaIvaCode})</span>
                <span className="font-bold text-emerald-800">{formatCurrency(f.ivaPagado)}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-blue-200/60">
                <span>[Cargo] Gastos Aduanales / DTA y PRV ({f.cuentaGastoCode})</span>
                <span className="font-bold text-slate-800">{formatCurrency(f.dta + f.prv)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-blue-950 font-bold">
                <span>[Abono] Bancos / Agente ({f.cuentaBancoCode})</span>
                <span className="text-red-700">-{formatCurrency(f.totalDesembolso)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            title={disabledTitle}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {isSaving ? 'Guardando...' : `Generar Póliza (${formatCurrency(Number.isFinite(f.totalDesembolso) ? f.totalDesembolso : 0)})`}
            </span>
          </button>
        </div>
      </form>
    </dialog>
  );
}

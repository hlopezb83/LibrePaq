import { Anchor, Calculator, CheckCircle2, DollarSign, FileText } from 'lucide-react';
import { AccountPickerCombobox } from '../../components/account-picker/AccountPickerCombobox';
import { AlertBanner, Button, Input, ModalShell, Select, StatusBadge } from '../../components/ui';
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
    isSaving,
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
    <ModalShell
      dialogRef={f.dialogRef}
      isOpen={isOpen}
      onClose={onClose}
      busy={isSaving}
      usePortal={true}
      maxWidth="2xl"
      titleId="pedimento-modal-title"
      title="Registro de Pedimento de Importación Aduanal (Ley Aduanera / DIOT)"
      subtitle="Genera la póliza con acreditamiento de IVA aduanal, DTA y PRV para clientes importadores"
      icon={<Anchor className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      closeLabel="Cerrar registro de pedimento"
      footerJustify="between"
      footer={
        <>
          <Button variant="secondary" size="md" disabled={isSaving} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="pedimento-form"
            variant="primary"
            size="md"
            loading={isSaving}
            disabled={isSubmitDisabled}
            title={disabledTitle}
            leftIcon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
            className="font-mono tabular-nums"
          >
            {isSaving
              ? 'Guardando...'
              : `Generar Póliza (${formatCurrency(Number.isFinite(f.totalDesembolso) ? f.totalDesembolso : 0)})`}
          </Button>
        </>
      }
    >
      <form
        id="pedimento-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (isSubmitDisabled) return;
          f.handleConfirm();
        }}
        className="space-y-4 text-xs"
      >
        {f.isDateDifferentPeriod && (
          <AlertBanner tone="warning" title="Aviso de Periodo Fiscal:">
            La fecha seleccionada (<strong>{f.fecha}</strong>) difiere del periodo activo (<strong>P{String(currentPeriod).padStart(2, '0')}/{currentYear}</strong>).
          </AlertBanner>
        )}

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" aria-hidden="true" />
              <span>1. Identificación y Formato Oficial del Pedimento (15 dígitos: 2+2+4+7)</span>
            </div>
            <StatusBadge tone="blue" shape="tag" className="text-[11px] px-2">
              {(f.ano || '--').padStart(2, '0')} {(f.aduana || '--').padStart(2, '0')}{' '}
              {(f.patente || '----').padStart(4, '0')} {(f.consecutivo || '-------').padStart(7, '0')}
            </StatusBadge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono">
            <div>
              <label htmlFor="ped-ano" className="block text-[10px] font-bold text-slate-600 mb-1">Año (2) *</label>
              <Input
                id="ped-ano" size="sm" type="text" required minLength={2} maxLength={2}
                inputMode="numeric" pattern="[0-9]{2}" value={f.ano}
                onChange={(e) => f.setAno(e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="26"
              />
            </div>
            <div>
              <label htmlFor="ped-aduana" className="block text-[10px] font-bold text-slate-600 mb-1">Aduana (2) *</label>
              <Input
                id="ped-aduana" size="sm" type="text" autoFocus required minLength={2} maxLength={2}
                inputMode="numeric" pattern="[0-9]{2}" value={f.aduana}
                onChange={(e) => f.setAduana(e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="Ej. 24"
              />
            </div>
            <div>
              <label htmlFor="ped-patente" className="block text-[10px] font-bold text-slate-600 mb-1">Patente (4) *</label>
              <Input
                id="ped-patente" size="sm" type="text" required minLength={4} maxLength={4}
                inputMode="numeric" pattern="[0-9]{4}" value={f.patente}
                onChange={(e) => f.setPatente(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Ej. 3820"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ped-consecutivo" className="block text-[10px] font-bold text-slate-600 mb-1">Consecutivo (7) *</label>
              <Input
                id="ped-consecutivo" size="sm" type="text" required minLength={7} maxLength={7}
                inputMode="numeric" pattern="[0-9]{7}" value={f.consecutivo}
                onChange={(e) => f.setConsecutivo(e.target.value.replace(/\D/g, '').slice(0, 7))}
                placeholder="Ej. 4001234"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label htmlFor="ped-clave" className="block text-[10px] font-bold text-slate-600 mb-1">Clave de Pedimento</label>
              <Select
                id="ped-clave" size="sm" value={f.clave}
                onChange={(e) => f.setClave(e.target.value as 'A1' | 'IN' | 'AF')}
                className="font-semibold"
              >
                <option value="A1">A1 - Importación Definitiva</option>
                <option value="IN">IN - Temporal para Elaboración / IMMEX</option>
                <option value="AF">AF - Importación Activo Fijo</option>
              </Select>
            </div>
            <div>
              <label htmlFor="ped-fecha" className="block text-[10px] font-bold text-slate-600 mb-1">Fecha de Pago</label>
              <Input
                id="ped-fecha" size="sm" type="date" value={f.fecha}
                onChange={(e) => f.setFecha(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-600 mb-1">Tipo Cambio DOF</span>
              <div className="flex items-center gap-1 font-mono tabular-nums text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-100/60">
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono tabular-nums">
            <div>
              <label htmlFor="ped-valor-aduana" className="block text-[10px] font-bold text-slate-600 mb-1">Valor Aduana ($)</label>
              <Input
                id="ped-valor-aduana" size="sm" type="text" inputMode="decimal" placeholder="0.00"
                value={f.valorAduanaRaw}
                onChange={(e) => f.setValorAduanaRaw(sanitizeDecimalInput(e.target.value))}
                className="text-right tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="ped-dta" className="block text-[10px] font-bold text-slate-600 mb-1">DTA ($)</label>
              <Input
                id="ped-dta" size="sm" type="text" inputMode="decimal" placeholder="0.00"
                value={f.dtaRaw}
                onChange={(e) => f.setDtaRaw(sanitizeDecimalInput(e.target.value))}
                className="text-right tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="ped-prv" className="block text-[10px] font-bold text-slate-600 mb-1">Prevalidación PRV ($)</label>
              <Input
                id="ped-prv" size="sm" type="text" inputMode="decimal" placeholder="0.00"
                value={f.prvRaw}
                onChange={(e) => f.setPrvRaw(sanitizeDecimalInput(e.target.value))}
                className="text-right tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="ped-iva-pagado" className="block text-[10px] font-bold text-emerald-800 mb-1">IVA Aduanal ($) *</label>
              <Input
                id="ped-iva-pagado" size="sm" type="text" inputMode="decimal" placeholder="0.00" required
                value={f.ivaPagadoRaw}
                onChange={(e) => f.setIvaPagadoRaw(sanitizeDecimalInput(e.target.value))}
                className="border-emerald-400! bg-emerald-50/50! font-bold text-emerald-950! text-right tabular-nums"
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

          <div className="space-y-1 font-mono tabular-nums text-[11px] pt-1 border-t border-blue-200">
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
      </form>
    </ModalShell>
  );
}

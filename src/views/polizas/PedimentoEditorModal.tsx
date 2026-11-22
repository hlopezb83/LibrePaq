import { useEffect, useMemo, useRef, useState } from 'react';
import { Anchor, Calculator, CheckCircle2, DollarSign, FileText, X } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { getOfficialDofExchangeRate } from '../../shared/sat-inpc-catalog';
import type { Account } from '../../shared/types';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';

export interface PedimentoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentPeriod: number;
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
  isOpen, onClose, currentYear, currentPeriod, accounts, onSavePoliza, isSaving
}: PedimentoEditorModalProps) {
  const defaultIva = useMemo(() => accounts.find((a) => a.code === '118-01-001' || a.code.startsWith('118'))?.code || '118-01-001', [accounts]);
  const defaultGasto = useMemo(() => accounts.find((a) => a.code === '601-01-005' || a.code.startsWith('601'))?.code || '601-01-005', [accounts]);
  const defaultBanco = useMemo(() => accounts.find((a) => a.code === '102-01-001' || a.code.startsWith('102'))?.code || '102-01-001', [accounts]);

  const [aduana, setAduana] = useState('240'), [patente, setPatente] = useState('3820'), [ano, setAno] = useState('24');
  const [consecutivo, setConsecutivo] = useState('4001234'), [clave, setClave] = useState<'A1' | 'IN' | 'AF'>('A1');
  const [fecha, setFecha] = useState(`${currentYear}-${String(currentPeriod).padStart(2, '0')}-15`);
  const [valorAduana, setValorAduana] = useState(250000), [dta, setDta] = useState(2000), [prv, setPrv] = useState(310);
  const [ivaPagado, setIvaPagado] = useState(40370);
  const [cuentaBanco, setCuentaBanco] = useState(defaultBanco), [cuentaIva, setCuentaIva] = useState(defaultIva), [cuentaGasto, setCuentaGasto] = useState(defaultGasto);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
      if (!accounts.some((a) => a.code === cuentaIva)) setCuentaIva(defaultIva);
      if (!accounts.some((a) => a.code === cuentaGasto)) setCuentaGasto(defaultGasto);
      if (!accounts.some((a) => a.code === cuentaBanco)) setCuentaBanco(defaultBanco);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, accounts, defaultIva, defaultGasto, defaultBanco, cuentaIva, cuentaGasto, cuentaBanco]);

  const tcSugerido = useMemo(
    () => getOfficialDofExchangeRate(currentYear, currentPeriod),
    [currentYear, currentPeriod]
  );

  const handleAutoCalcIva = () =>
    setIvaPagado(Math.round((valorAduana + dta + prv) * 0.16 * 100) / 100);

  const totalDesembolso = ivaPagado + dta + prv;

  const pedimentoCompleto = `${ano}  ${aduana}  ${patente}  ${consecutivo}`;
  const conceptoPoliza = `Pago Pedimento Aduanal ${clave} ${pedimentoCompleto} - Aduana ${aduana}`;

  const handleConfirm = () => {
    onSavePoliza({
      tipo: 'EGRESO',
      fecha,
      concepto: conceptoPoliza,
      movements: [
        {
          accountCode: cuentaIva,
          concepto: `IVA Acreditable Aduana Pedimento ${pedimentoCompleto}`,
          cargo: ivaPagado,
          abono: 0
        },
        {
          accountCode: cuentaGasto,
          concepto: `DTA y Prevalidación Aduanal Pedimento ${pedimentoCompleto}`,
          cargo: dta + prv, abono: 0
        },
        {
          accountCode: cuentaBanco,
          concepto: `Liquidación Contribuciones al Comercio Exterior Ped. ${pedimentoCompleto}`,
          cargo: 0, abono: totalDesembolso
        }
      ]
    });
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      onClose={onClose}
      aria-labelledby="pedimento-modal-title"
      className="bg-white rounded-2xl shadow-xl border border-slate-300 w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden overscroll-contain backdrop:bg-slate-900/60 p-0 m-auto"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Anchor className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
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
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5 overflow-y-auto space-y-4 text-xs">
        {/* Identificación del Pedimento */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>1. Identificación y Formato Oficial del Pedimento (15 dígitos)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono">
            <div>
              <label htmlFor="ped-ano" className="block text-[10px] font-bold text-slate-600 mb-1">Año (2)</label>
              <input
                id="ped-ano" type="text" maxLength={2} inputMode="numeric" pattern="[0-9]*" value={ano}
                onChange={(e) => setAno(e.target.value)} aria-label="Año de pedimento"
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label htmlFor="ped-aduana" className="block text-[10px] font-bold text-slate-600 mb-1">Aduana (3)</label>
              <input
                id="ped-aduana" type="text" maxLength={3} inputMode="numeric" pattern="[0-9]*" value={aduana}
                onChange={(e) => setAduana(e.target.value)} placeholder="240" aria-label="Clave de aduana"
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label htmlFor="ped-patente" className="block text-[10px] font-bold text-slate-600 mb-1">Patente (4)</label>
              <input
                id="ped-patente" type="text" maxLength={4} inputMode="numeric" pattern="[0-9]*" value={patente}
                onChange={(e) => setPatente(e.target.value)} placeholder="3820" aria-label="Patente aduanal"
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ped-consecutivo" className="block text-[10px] font-bold text-slate-600 mb-1">Consecutivo (7)</label>
              <input
                id="ped-consecutivo" type="text" maxLength={7} inputMode="numeric" pattern="[0-9]*" value={consecutivo}
                onChange={(e) => setConsecutivo(e.target.value)} placeholder="4001234" aria-label="Número consecutivo"
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label htmlFor="ped-clave" className="block text-[10px] font-bold text-slate-600 mb-1">Clave de Pedimento</label>
              <select
                id="ped-clave" aria-label="Clave de pedimento" value={clave}
                onChange={(e) => setClave(e.target.value as 'A1' | 'IN' | 'AF')}
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
                id="ped-fecha" type="date" value={fecha} aria-label="Fecha de pago pedimento"
                onChange={(e) => setFecha(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono"
              />
            </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-600 mb-1">Tipo Cambio DOF</span>
                <div className="flex items-center gap-1 font-mono text-slate-800 px-2 py-1.5 rounded-lg border border-slate-300 bg-slate-100/60">
                  <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                  <span>${tcSugerido.toFixed(4)} MXN</span>
                </div>
              </div>
            </div>
          </div>

          {/* Liquidación de Contribuciones */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">2. Liquidación al Comercio Exterior</span>
              <button
                type="button"
                onClick={handleAutoCalcIva}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 cursor-pointer underline"
              >
                <Calculator className="w-3.5 h-3.5" />
                Calcular IVA 16% automáticamente
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div>
                <label htmlFor="ped-valor-aduana" className="block text-[10px] font-bold text-slate-600 mb-1">Valor Aduana ($)</label>
                <input
                  id="ped-valor-aduana"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={valorAduana}
                  onChange={(e) => setValorAduana(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label htmlFor="ped-dta" className="block text-[10px] font-bold text-slate-600 mb-1">DTA ($)</label>
                <input
                  id="ped-dta"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={dta}
                  onChange={(e) => setDta(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label htmlFor="ped-prv" className="block text-[10px] font-bold text-slate-600 mb-1">Prevalidación PRV ($)</label>
                <input
                  id="ped-prv"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={prv}
                  onChange={(e) => setPrv(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label htmlFor="ped-iva-pagado" className="block text-[10px] font-bold text-emerald-800 mb-1">IVA Aduanal ($) *</label>
                <input
                  id="ped-iva-pagado"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  required
                  value={ivaPagado}
                  onChange={(e) => setIvaPagado(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg border border-emerald-400 bg-emerald-50/50 font-bold text-emerald-950"
                />
              </div>
            </div>
          </div>

          {/* Cuentas Contables y Póliza Cuadrada */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2">
            <span className="font-bold text-blue-900 block">3. Asignación de Cuentas y Póliza Cuadrada</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                aria-label="Cuenta contable IVA acreditable importación"
                value={cuentaIva}
                onChange={(e) => setCuentaIva(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-[11px]"
              >
                {accounts.filter((a) => a.code.startsWith('118')).map((a) => (
                  <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                ))}
                {!accounts.some((a) => a.code.startsWith('118')) && (
                  <option value="118-01-001">118-01-001 - IVA Acreditable Pagado</option>
                )}
              </select>
              <select
                aria-label="Cuenta contable gastos DTA y aduanales"
                value={cuentaGasto}
                onChange={(e) => setCuentaGasto(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-[11px]"
              >
                {accounts.filter((a) => a.code.startsWith('601')).map((a) => (
                  <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                ))}
                {!accounts.some((a) => a.code.startsWith('601')) && (
                  <option value="601-01-005">601-01-005 - Gastos Aduanales</option>
                )}
              </select>
              <select
                aria-label="Cuenta contable banco o agente aduanal"
                value={cuentaBanco}
                onChange={(e) => setCuentaBanco(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-[11px]"
              >
                {accounts.filter((a) => a.code.startsWith('102') || a.code.startsWith('201')).map((a) => (
                  <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                ))}
                {!accounts.some((a) => a.code.startsWith('102') || a.code.startsWith('201')) && (
                  <option value="102-01-001">102-01-001 - Bancos Nacionales</option>
                )}
              </select>
            </div>

            <div className="space-y-1 font-mono text-[11px] pt-1 border-t border-blue-200">
              <div className="flex justify-between py-0.5 border-b border-blue-200/60">
                <span>[Cargo] IVA Acreditable Aduana ({cuentaIva})</span>
                <span className="font-bold text-emerald-800">{formatCurrency(ivaPagado)}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-blue-200/60">
                <span>[Cargo] Gastos Aduanales / DTA y PRV ({cuentaGasto})</span>
                <span className="font-bold text-slate-800">{formatCurrency(dta + prv)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-blue-950 font-bold">
                <span>[Abono] Bancos / Agente ({cuentaBanco})</span>
                <span className="text-red-700">-{formatCurrency(totalDesembolso)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >Cancelar</button>
          <button
            type="button"
            disabled={isSaving || totalDesembolso <= 0}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white cursor-pointer shadow-xs disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSaving ? 'Guardando...' : `Generar Póliza (${formatCurrency(totalDesembolso)})`}
          </button>
        </div>
    </dialog>
  );
}

import React from 'react';
import { Landmark } from 'lucide-react';
import type { DraftMovement } from './poliza-editor.types';

interface PolizaMovementBankFieldsProps {
  idx: number;
  mov: DraftMovement;
  isExpanded: boolean;
  onToggle: () => void;
  setMovements: React.Dispatch<React.SetStateAction<DraftMovement[]>>;
}

export function PolizaMovementBankFields({
  idx,
  mov,
  isExpanded,
  onToggle,
  setMovements
}: PolizaMovementBankFieldsProps) {
  const updateField = (field: keyof DraftMovement, val: string) => {
    setMovements((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val || null } : item))
    );
  };

  const hasBankData = Boolean(
    mov.paymentMethodSat ||
      mov.bankCodeOri ||
      mov.accountOri ||
      mov.bankCodeDest ||
      mov.accountDest ||
      mov.beneficiaryName ||
      mov.chequeNum
  );

  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold cursor-pointer transition ${
          hasBankData
            ? 'bg-blue-50 text-blue-900 border-blue-200'
            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
        }`}
      >
        <Landmark className="w-3 h-3" aria-hidden="true" />
        <span>
          {isExpanded ? 'Ocultar Banco SAT' : hasBankData ? 'Banco Anexo 24 (Configurado)' : 'Banco SAT (Anexo 24)'}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-1.5 p-2 rounded-lg border border-blue-200 bg-blue-50/40 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
          <label className="block">
            <span className="text-slate-600 font-semibold block">Método SAT</span>
            <select
              aria-label={`Método pago SAT partida ${idx + 1}`}
              value={mov.paymentMethodSat ?? ''}
              onChange={(e) => updateField('paymentMethodSat', e.target.value)}
              className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white text-[10px]"
            >
              <option value="">Auto</option>
              <option value="03">03 - Transferencia</option>
              <option value="02">02 - Cheque</option>
              <option value="01">01 - Efectivo</option>
              <option value="04">04 - Tarjeta Crédito</option>
              <option value="28">28 - Tarjeta Débito</option>
            </select>
          </label>

          <label className="block">
            <span className="text-slate-600 font-semibold block">Banco Ori (3 díg.)</span>
            <input
              type="text"
              maxLength={3}
              aria-label={`Banco origen partida ${idx + 1}`}
              placeholder="Ej. 012"
              value={mov.bankCodeOri ?? ''}
              onChange={(e) => updateField('bankCodeOri', e.target.value)}
              className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white font-mono"
            />
          </label>

          <label className="block">
            <span className="text-slate-600 font-semibold block">Cuenta / CLABE Ori</span>
            <input
              type="text"
              maxLength={50}
              aria-label={`Cuenta origen partida ${idx + 1}`}
              placeholder="Cuenta origen"
              value={mov.accountOri ?? ''}
              onChange={(e) => updateField('accountOri', e.target.value)}
              className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white font-mono"
            />
          </label>

          <label className="block">
            <span className="text-slate-600 font-semibold block">Banco Dest (3 díg.)</span>
            <input
              type="text"
              maxLength={3}
              aria-label={`Banco destino partida ${idx + 1}`}
              placeholder="Ej. 014"
              value={mov.bankCodeDest ?? ''}
              onChange={(e) => updateField('bankCodeDest', e.target.value)}
              className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white font-mono"
            />
          </label>

          <label className="block">
            <span className="text-slate-600 font-semibold block">Cuenta / CLABE Dest</span>
            <input
              type="text"
              maxLength={50}
              aria-label={`Cuenta destino partida ${idx + 1}`}
              placeholder="Cuenta destino"
              value={mov.accountDest ?? ''}
              onChange={(e) => updateField('accountDest', e.target.value)}
              className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white font-mono"
            />
          </label>

          <label className="block">
            <span className="text-slate-600 font-semibold block">Beneficiario</span>
            <input
              type="text"
              maxLength={120}
              aria-label={`Beneficiario partida ${idx + 1}`}
              placeholder="Nombre o Razón Social"
              value={mov.beneficiaryName ?? ''}
              onChange={(e) => updateField('beneficiaryName', e.target.value)}
              className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white"
            />
          </label>

          <label className="block">
            <span className="text-slate-600 font-semibold block">RFC Beneficiario</span>
            <input
              type="text"
              maxLength={13}
              aria-label={`RFC beneficiario partida ${idx + 1}`}
              placeholder="XAXX010101000"
              value={mov.beneficiaryRfc ?? ''}
              onChange={(e) => updateField('beneficiaryRfc', e.target.value.toUpperCase())}
              className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white font-mono uppercase"
            />
          </label>

          <label className="block">
            <span className="text-slate-600 font-semibold block">Núm. Cheque</span>
            <input
              type="text"
              maxLength={20}
              aria-label={`Número de cheque partida ${idx + 1}`}
              placeholder="Ej. CH-0042"
              value={mov.chequeNum ?? ''}
              onChange={(e) => updateField('chequeNum', e.target.value)}
              className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white font-mono"
            />
          </label>
        </div>
      )}
    </div>
  );
}

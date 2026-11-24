import React, { useEffect, useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { Button, FormField, Input, ModalShell, Select } from '../../components/ui';

interface AddBankStatementLineModalProps {
  addBankModalRef: React.RefObject<HTMLDialogElement | null>;
  bFecha: string;
  setBFecha: (d: string) => void;
  bRef: string;
  setBRef: (r: string) => void;
  bDesc: string;
  setBDesc: (d: string) => void;
  bTipo: 'CARGO' | 'ABONO';
  setBTipo: (t: 'CARGO' | 'ABONO') => void;
  bMonto: number;
  setBMonto: (m: number) => void;
  onAddBankLineSubmit: (e: React.FormEvent) => void;
  isAddBankLinePending: boolean;
  isWriteLocked?: boolean;
}

export function AddBankStatementLineModal({
  addBankModalRef,
  bFecha,
  setBFecha,
  bRef,
  setBRef,
  bDesc,
  setBDesc,
  bTipo,
  setBTipo,
  bMonto,
  setBMonto,
  onAddBankLineSubmit,
  isAddBankLinePending,
  isWriteLocked = false
}: AddBankStatementLineModalProps) {
  const [montoDraft, setMontoDraft] = useState(bMonto > 0 ? String(bMonto) : '');

  useEffect(() => {
    if (bMonto === 0) setMontoDraft('');
  }, [bMonto]);

  const handleClose = () => {
    if (!isAddBankLinePending) addBankModalRef.current?.close();
  };

  return (
    <ModalShell
      dialogRef={addBankModalRef}
      isOpen={true}
      onClose={handleClose}
      title="Registrar Movimiento en Estado de Cuenta"
      subtitle="Captura manual para conciliar partidas"
      icon={<Landmark className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      titleId="modal-add-bank-title"
      maxWidth="md"
      busy={isAddBankLinePending}
      closeLabel="Cerrar modal"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isAddBankLinePending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="add-bank-line-form"
            variant="primary"
            loading={isAddBankLinePending}
            disabled={isWriteLocked || bMonto <= 0}
            leftIcon={isAddBankLinePending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : undefined}
          >
            {isAddBankLinePending ? 'Registrando...' : 'Guardar Partida'}
          </Button>
        </>
      }
    >
      <form id="add-bank-line-form" onSubmit={onAddBankLineSubmit} className="space-y-3.5">
        <FormField label="Fecha del Movimiento Bancario" htmlFor="bank-line-date" required>
          <Input
            id="bank-line-date"
            type="date"
            required
            disabled={isWriteLocked}
            value={bFecha}
            onChange={(e) => setBFecha(e.target.value)}
            className="font-mono"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Tipo de Operación" htmlFor="bank-line-type" required>
            <Select
              id="bank-line-type"
              disabled={isWriteLocked}
              value={bTipo}
              onChange={(e) => setBTipo(e.target.value as 'CARGO' | 'ABONO')}
              className="font-semibold"
            >
              <option value="CARGO">Cargo (Retiro / Salida)</option>
              <option value="ABONO">Abono (Depósito / Entrada)</option>
            </Select>
          </FormField>

          <FormField label="Importe $" htmlFor="bank-line-amount" required>
            <Input
              id="bank-line-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              required
              disabled={isWriteLocked}
              value={montoDraft}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                const dotIdx = raw.indexOf('.');
                const cleaned = dotIdx === -1 ? raw : raw.slice(0, dotIdx + 1) + raw.slice(dotIdx + 1).replace(/\./g, '');
                setMontoDraft(cleaned);
                const n = Number(cleaned);
                setBMonto(Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              onBlur={() => {
                const n = Number(montoDraft);
                if (!Number.isFinite(n) || n <= 0) {
                  setMontoDraft('');
                  setBMonto(0);
                } else {
                  setMontoDraft(String(n));
                  setBMonto(n);
                }
              }}
              className="font-mono tabular-nums"
            />
          </FormField>
        </div>

        <FormField label="Referencia o Folio Bancario" htmlFor="bank-line-ref" required>
          <Input
            id="bank-line-ref"
            type="text"
            required
            disabled={isWriteLocked}
            value={bRef}
            onChange={(e) => setBRef(e.target.value)}
            className="font-mono uppercase"
          />
        </FormField>

        <FormField label="Descripción en Estado de Cuenta" htmlFor="bank-line-desc" required>
          <Input
            id="bank-line-desc"
            type="text"
            required
            disabled={isWriteLocked}
            value={bDesc}
            onChange={(e) => setBDesc(e.target.value)}
          />
        </FormField>
      </form>
    </ModalShell>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ArchiveX, Loader2 } from 'lucide-react';
import { Button, FormField, Input, ModalShell, Select } from '../../components/ui';
import { formatCurrency } from '../../lib/formatters';
import { computeFixedAssetDisposalSummary } from '../../shared/engine/fixed-assets.engine';
import type { AccountWithBalance, FixedAssetWithCalculation } from '../../shared/types';

interface ActivosFijosBajaModalProps {
  asset: FixedAssetWithCalculation | null;
  defaultDate: string;
  accounts: readonly AccountWithBalance[];
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    assetId: string;
    fechaBaja: string;
    precioVenta: number;
    generatePoliza: boolean;
    cuentaCobroCode: string;
  }) => void;
}

export function ActivosFijosBajaModal({
  asset,
  defaultDate,
  accounts,
  isSubmitting,
  onClose,
  onConfirm
}: ActivosFijosBajaModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fechaBaja, setFechaBaja] = useState(defaultDate);
  const [precioVenta, setPrecioVenta] = useState('0');
  const [generatePoliza, setGeneratePoliza] = useState(true);
  const cobroAccounts = accounts.filter((a) => a.isAffectable && (a.code.startsWith('102') || a.code.startsWith('107')));
  const [cuentaCobroCode, setCuentaCobroCode] = useState(cobroAccounts[0]?.code ?? '102-01-001');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!asset) {
      if (dialog?.open) dialog.close();
      return;
    }
    setFechaBaja(defaultDate);
    setPrecioVenta('0');
    setGeneratePoliza(true);
    setCuentaCobroCode(cobroAccounts[0]?.code ?? '102-01-001');
    if (dialog && !dialog.open) dialog.showModal();
  }, [asset?.id, defaultDate]);

  if (!asset) return null;
  const parsedSale = Math.max(0, Number.parseFloat(precioVenta) || 0);
  const disposal = computeFixedAssetDisposalSummary(asset, fechaBaja, parsedSale);

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={Boolean(asset)}
      onClose={() => !isSubmitting && onClose()}
      busy={isSubmitting}
      title="Baja / Enajenación de Activo Fijo (Art. 31 LISR)"
      subtitle={`${asset.codigo} — ${asset.nombre}`}
      icon={<ArchiveX className="w-4 h-4" aria-hidden="true" />}
      iconTone="amber"
      titleId="fa-baja-modal-title"
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button
            type="submit"
            form="fa-baja-form"
            variant="danger"
            loading={isSubmitting}
            leftIcon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <ArchiveX className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            {isSubmitting ? 'Procesando Baja...' : 'Confirmar Baja'}
          </Button>
        </>
      }
    >
      <form
        id="fa-baja-form"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm({ assetId: asset.id, fechaBaja, precioVenta: parsedSale, generatePoliza, cuentaCobroCode });
        }}
        className="space-y-4 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Fecha de Baja / Enajenación" htmlFor="baja-fecha" required>
            <Input id="baja-fecha" size="sm" type="date" required value={fechaBaja} onChange={(e) => setFechaBaja(e.target.value)} className="font-mono" />
          </FormField>
          <FormField label="Precio de Venta s/IVA ($ MXN)" htmlFor="baja-precio">
            <Input id="baja-precio" size="sm" type="number" min="0" step="0.01" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} className="font-mono" />
          </FormField>
        </div>

        <label htmlFor="baja-gen-poliza" className="flex items-center gap-2 cursor-pointer">
          <input id="baja-gen-poliza" type="checkbox" checked={generatePoliza} onChange={(e) => setGeneratePoliza(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
          <span className="font-semibold text-slate-800">Generar póliza contable automática de baja/enajenación</span>
        </label>

        {generatePoliza && parsedSale > 0 && (
          <FormField label="Cuenta de Cobro (Bancos / Deudores)" htmlFor="baja-cuenta-cobro">
            <Select id="baja-cuenta-cobro" size="sm" value={cuentaCobroCode} onChange={(e) => setCuentaCobroCode(e.target.value)} className="font-mono">
              {cobroAccounts.map((a) => (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </Select>
          </FormField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="space-y-1">
            <div className="font-bold text-slate-700 uppercase text-[11px]">Resultado Contable (NIF C-6)</div>
            <div className="flex justify-between"><span>MOI:</span><span className="font-mono">{formatCurrency(asset.montoOriginalInversion)}</span></div>
            <div className="flex justify-between"><span>Dep. Acumulada:</span><span className="font-mono">{formatCurrency(disposal.depAcumuladaContable)}</span></div>
            <div className="flex justify-between"><span>Valor Neto Libros:</span><span className="font-mono">{formatCurrency(disposal.valorNetoContable)}</span></div>
            <div className={`flex justify-between font-bold ${disposal.utilidadOPerdidaContable >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              <span>{disposal.utilidadOPerdidaContable >= 0 ? 'Utilidad Contable:' : 'Pérdida Contable:'}</span>
              <span className="font-mono">{formatCurrency(Math.abs(disposal.utilidadOPerdidaContable))}</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="font-bold text-slate-700 uppercase text-[11px]">Resultado Fiscal (Art. 31 LISR)</div>
            <div className="flex justify-between"><span>Saldo Pendiente Fiscal:</span><span className="font-mono">{formatCurrency(disposal.saldoPendienteFiscal)}</span></div>
            <div className="flex justify-between"><span>Factor INPC Baja:</span><span className="font-mono">{disposal.factorActualizacionBaja.toFixed(4)}</span></div>
            <div className="flex justify-between"><span>Costo Fiscal Actualizado:</span><span className="font-mono">{formatCurrency(disposal.costoFiscalActualizado)}</span></div>
            <div className={`flex justify-between font-bold ${disposal.gananciaOPerdidaFiscal >= 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
              <span>{disposal.gananciaOPerdidaFiscal >= 0 ? 'Ganancia Acumulable:' : 'Pérdida Deducible:'}</span>
              <span className="font-mono">{formatCurrency(Math.abs(disposal.gananciaOPerdidaFiscal))}</span>
            </div>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

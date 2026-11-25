import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookmarkCheck, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { AlertBanner, Button, EmptyState, FormField, Input, ModalShell, Select, StatusBadge } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useDialogLightDismiss } from '../../hooks/useDialogLightDismiss';
import { formatCurrency } from '../../lib/formatters';
import { ronda11Client } from '../../lib/supabase/supabase-ronda11';
import type { Account, PolizaTemplate, PolizaTemplateMovement, PolizaType } from '../../shared/types';

interface PolizaTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  isWriteBlocked: boolean;
  templates: PolizaTemplate[];
  affectableAccounts: Account[];
  onApplyTemplate: (tpl: PolizaTemplate) => void;
}

export function PolizaTemplatesModal({
  isOpen,
  onClose,
  companyId,
  isWriteBlocked,
  templates,
  affectableAccounts,
  onApplyTemplate
}: PolizaTemplatesModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogLightDismiss(dialogRef, onClose, { isOpen });
  const queryClient = useQueryClient();
  const toast = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tipo, setTipo] = useState<PolizaType>('DIARIO');
  const [conceptoDefault, setConceptoDefault] = useState('');
  const [rows, setRows] = useState<PolizaTemplateMovement[]>(() => [
    { accountCode: affectableAccounts[0]?.code || '601-01-003', concepto: '', cargoFixed: 1000, abonoFixed: 0 },
    { accountCode: affectableAccounts[1]?.code || '102-01-001', concepto: '', cargoFixed: 0, abonoFixed: 1000 }
  ]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setTipo('DIARIO');
    setConceptoDefault('');
    setRows([
      { accountCode: affectableAccounts[0]?.code || '601-01-003', concepto: '', cargoFixed: 1000, abonoFixed: 0 },
      { accountCode: affectableAccounts[1]?.code || '102-01-001', concepto: '', cargoFixed: 0, abonoFixed: 1000 }
    ]);
  };

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['poliza-templates', companyId] });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingId) {
        return ronda11Client.updatePolizaTemplate(editingId, {
          companyId, name, tipo, conceptoDefault, movementsJson: rows
        });
      }
      return ronda11Client.createPolizaTemplate({
        companyId, name, tipo, conceptoDefault, movementsJson: rows
      });
    },
    onSuccess: (saved) => {
      toast.success(`Pre-póliza "${saved.name}" guardada`);
      resetForm();
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ronda11Client.deletePolizaTemplate(id, companyId),
    onSuccess: () => {
      toast.success('Pre-póliza eliminada');
      if (editingId) resetForm();
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isWriteBlocked || !name.trim() || rows.length === 0) return;
    saveMutation.mutate();
  };

  const startEdit = (t: PolizaTemplate) => {
    setEditingId(t.id);
    setName(t.name);
    setTipo(t.tipo);
    setConceptoDefault(t.conceptoDefault);
    setRows(t.movementsJson.length > 0 ? t.movementsJson : []);
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      dialogRef={dialogRef}
      isOpen={isOpen}
      onClose={onClose}
      usePortal
      maxWidth="4xl"
      titleId="poliza-templates-modal-title"
      closeLabel="Cerrar catálogo de pre-pólizas"
      icon={<BookmarkCheck className="w-5 h-5" aria-hidden="true" />}
      iconTone="blue"
      title="Pre-pólizas y Pólizas Recurrentes (CONTPAQi)"
      subtitle="Administra plantillas contables reutilizables y aplícalas en 1 clic al capturar una póliza."
      bodyClassName="space-y-4 scrollable-panel text-xs"
      footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}
    >
      {isWriteBlocked && (
        <AlertBanner tone="info">Modo solo lectura o periodo bloqueado: solo puedes consultar pre-pólizas.</AlertBanner>
      )}

      {!isWriteBlocked && (
        <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <FormField htmlFor="tpl-name" label="Nombre de la Pre-póliza" required className="sm:col-span-5">
              <Input id="tpl-name" size="sm" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Renta Mensual Oficina" />
            </FormField>
            <FormField htmlFor="tpl-tipo" label="Tipo" required className="sm:col-span-2">
              <Select id="tpl-tipo" size="sm" value={tipo} onChange={(e) => setTipo(e.target.value as PolizaType)}>
                <option value="DIARIO">DIARIO</option>
                <option value="EGRESO">EGRESO</option>
                <option value="INGRESO">INGRESO</option>
              </Select>
            </FormField>
            <FormField htmlFor="tpl-concepto" label="Concepto predeterminado" className="sm:col-span-5">
              <Input id="tpl-concepto" size="sm" value={conceptoDefault} onChange={(e) => setConceptoDefault(e.target.value)} placeholder="Ej. Pago de renta mensual..." />
            </FormField>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Partidas de la plantilla</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="w-3 h-3" aria-hidden="true" />}
                onClick={() => setRows((prev) => [...prev, { accountCode: affectableAccounts[0]?.code || '', concepto: '', cargoFixed: 0, abonoFixed: 0 }])}
              >
                Partida
              </Button>
            </div>
            {rows.map((r, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select
                  aria-label={`Cuenta plantilla partida ${idx + 1}`}
                  value={r.accountCode}
                  onChange={(e) => setRows((prev) => prev.map((it, i) => (i === idx ? { ...it, accountCode: e.target.value } : it)))}
                  className="col-span-4 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-[11px]"
                >
                  {affectableAccounts.map((a) => (
                    <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label={`Concepto plantilla partida ${idx + 1}`}
                  placeholder="Concepto partida..."
                  value={r.concepto ?? ''}
                  onChange={(e) => setRows((prev) => prev.map((it, i) => (i === idx ? { ...it, concepto: e.target.value } : it)))}
                  className="col-span-3 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px]"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  aria-label={`Cargo plantilla partida ${idx + 1}`}
                  placeholder="Cargo"
                  value={r.cargoFixed ?? 0}
                  onChange={(e) => setRows((prev) => prev.map((it, i) => (i === idx ? { ...it, cargoFixed: Number(e.target.value) || 0, abonoFixed: 0 } : it)))}
                  className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-right font-mono text-[11px]"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  aria-label={`Abono plantilla partida ${idx + 1}`}
                  placeholder="Abono"
                  value={r.abonoFixed ?? 0}
                  onChange={(e) => setRows((prev) => prev.map((it, i) => (i === idx ? { ...it, abonoFixed: Number(e.target.value) || 0, cargoFixed: 0 } : it)))}
                  className="col-span-2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-right font-mono text-[11px]"
                />
                <button
                  type="button"
                  disabled={rows.length <= 2}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-1 text-red-600 disabled:opacity-30 cursor-pointer text-center font-bold"
                  aria-label={`Quitar partida ${idx + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            {editingId && <Button type="button" variant="ghost" size="sm" onClick={resetForm}>Cancelar edición</Button>}
            <Button type="submit" variant="primary" size="sm" loading={saveMutation.isPending} disabled={saveMutation.isPending || !name.trim()}>
              {editingId ? 'Actualizar Pre-póliza' : 'Guardar Pre-póliza'}
            </Button>
          </div>
        </form>
      )}

      {templates.length === 0 ? (
        <EmptyState
          variant="dashed"
          tone="slate"
          icon={<BookmarkCheck className="w-5 h-5" aria-hidden="true" />}
          title="Sin pre-pólizas guardadas"
          description="Crea una plantilla arriba o usa «Guardar como plantilla» dentro del editor de pólizas."
        />
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => {
            const sumCargo = tpl.movementsJson.reduce((s, m) => s + Number(m.cargoFixed || 0), 0);
            return (
              <div key={tpl.id} className="p-3 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{tpl.name}</span>
                    <StatusBadge tone="blue" shape="tag">{tpl.tipo}</StatusBadge>
                    <span className="font-mono text-[11px] text-slate-500">
                      {tpl.movementsJson.length} partidas {sumCargo > 0 ? `· ${formatCurrency(sumCargo)}` : ''}
                    </span>
                  </div>
                  {tpl.conceptoDefault && <p className="text-[11px] text-slate-600 truncate">{tpl.conceptoDefault}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  {!isWriteBlocked && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Play className="w-3 h-3" aria-hidden="true" />}
                        onClick={() => {
                          onClose();
                          onApplyTemplate(tpl);
                        }}
                      >
                        Usar
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Editar ${tpl.name}`} onClick={() => startEdit(tpl)}>
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Eliminar ${tpl.name}`} onClick={() => deleteMutation.mutate(tpl.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

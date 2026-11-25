import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { AlertBanner, Button, EmptyState, FormField, Input, StatusBadge } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { ronda11Client } from '../../lib/supabase/supabase-ronda11';
import type { BusinessSegment } from '../../shared/types';

interface BusinessSegmentsCardProps {
  companyId: string;
  isReadOnly?: boolean;
}

export function BusinessSegmentsCard({ companyId, isReadOnly = false }: BusinessSegmentsCardProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const { data: segments = [], isLoading, isError, error } = useQuery({
    queryKey: ['business-segments', companyId],
    queryFn: () => ronda11Client.listBusinessSegments(companyId),
    enabled: Boolean(companyId)
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['business-segments', companyId] });
    void queryClient.invalidateQueries({ queryKey: ['reports-by-segment', companyId] });
  };

  const resetForm = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setIsActive(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingId) {
        return ronda11Client.updateBusinessSegment(editingId, { companyId, code, name, isActive });
      }
      return ronda11Client.createBusinessSegment({ companyId, code, name, isActive });
    },
    onSuccess: (saved) => {
      toast.success(`Segmento ${saved.code} ${editingId ? 'actualizado' : 'creado'}`);
      resetForm();
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ronda11Client.deleteBusinessSegment(id, companyId),
    onSuccess: () => {
      toast.success('Segmento de negocio eliminado');
      if (editingId) resetForm();
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !code.trim() || !name.trim()) return;
    saveMutation.mutate();
  };

  const startEdit = (seg: BusinessSegment) => {
    setEditingId(seg.id);
    setCode(seg.code);
    setName(seg.name);
    setIsActive(seg.isActive);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-300/90 shadow-2xs overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Segmentos de Negocio / Centros de Costos (CONTPAQi)
            </h3>
            <p className="text-xs text-slate-500">
              Clasifica partidas de pólizas por sucursal, proyecto o departamento y filtra el Estado de Resultados.
            </p>
          </div>
        </div>
        <StatusBadge tone="slate">{segments.length} segmentos</StatusBadge>
      </div>

      <div className="p-5 space-y-4">
        {!isReadOnly && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <FormField htmlFor="seg-code" label="Código" required className="sm:col-span-3">
              <Input
                id="seg-code"
                size="sm"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej. SUC-MTY"
                className="font-mono uppercase"
              />
            </FormField>
            <FormField htmlFor="seg-name" label="Nombre del Segmento / Centro de Costos" required className="sm:col-span-5">
              <Input
                id="seg-name"
                size="sm"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Sucursal Monterrey / Proyecto Norte"
              />
            </FormField>
            <label className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-blue-700"
              />
              <span>Activo</span>
            </label>
            <div className="sm:col-span-2 flex items-center gap-1.5">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                loading={saveMutation.isPending}
                disabled={saveMutation.isPending || !code.trim() || !name.trim()}
                leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
              >
                {editingId ? 'Guardar' : 'Agregar'}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        )}

        {isError && (
          <AlertBanner tone="danger">
            {error instanceof Error ? error.message : 'Error al cargar segmentos de negocio.'}
          </AlertBanner>
        )}

        {isLoading ? (
          <p className="text-xs text-slate-600">Cargando segmentos...</p>
        ) : segments.length === 0 ? (
          <EmptyState
            variant="dashed"
            tone="slate"
            icon={<Layers className="w-5 h-5" aria-hidden="true" />}
            title="Sin segmentos de negocio registrados"
            description="Crea códigos como SUC-01, ADMIN o VENTAS para asignar centros de costos por partida."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th scope="col" className="py-2 px-3 font-semibold">Código</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Nombre</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Estatus</th>
                  {!isReadOnly && <th scope="col" className="py-2 px-3 text-right font-semibold">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {segments.map((seg) => (
                  <tr key={seg.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{seg.code}</td>
                    <td className="py-2 px-3 text-slate-800">{seg.name}</td>
                    <td className="py-2 px-3">
                      <StatusBadge tone={seg.isActive ? 'emerald' : 'slate'}>
                        {seg.isActive ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </td>
                    {!isReadOnly && (
                      <td className="py-2 px-3 text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Editar segmento ${seg.code}`}
                          onClick={() => startEdit(seg)}
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          aria-label={`Eliminar segmento ${seg.code}`}
                          onClick={() => deleteMutation.mutate(seg.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

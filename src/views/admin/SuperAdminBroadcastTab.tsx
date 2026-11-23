import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, AlertCircle, CheckCircle2, Info, Trash2, Send, Clock, RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useToast } from '../../context/ToastContext';

type BroadcastType = 'info' | 'warning' | 'success';

const TYPE_STYLE_MAP: Record<BroadcastType, { box: string; icon: typeof Info; iconClass: string }> = {
  warning: { box: 'bg-amber-50 border-amber-300 text-amber-950', icon: AlertCircle, iconClass: 'text-amber-700' },
  success: { box: 'bg-emerald-50 border-emerald-300 text-emerald-950', icon: CheckCircle2, iconClass: 'text-emerald-700' },
  info: { box: 'bg-blue-50 border-blue-300 text-blue-950', icon: Info, iconClass: 'text-blue-700' }
};

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toIsoOrNull(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatExpirationLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

export function SuperAdminBroadcastTab({ canManage = true }: { canManage?: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: currentBroadcast, isLoading, isError, refetch } = useQuery({
    queryKey: ['platform-broadcast'],
    queryFn: () => apiClient.getActiveBroadcast(),
    staleTime: 60_000,
    retry: false
  });

  const [syncedId, setSyncedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<BroadcastType>('info');
  const [expiresAtInput, setExpiresAtInput] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const incomingId = currentBroadcast?.active ? currentBroadcast.id : null;
    if (incomingId && incomingId !== syncedId) {
      setTitle(currentBroadcast?.title ?? '');
      setMessage(currentBroadcast?.message ?? '');
      setType(currentBroadcast?.type ?? 'info');
      setExpiresAtInput(toDatetimeLocalValue(currentBroadcast?.expiresAt));
      setSyncedId(incomingId);
    } else if (!incomingId && syncedId !== null) {
      setSyncedId(null);
    }
  }, [currentBroadcast, syncedId]);

  const invalidateBroadcastQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['platform-broadcast'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs-paginated'] })
    ]);
  };

  const publishMutation = useMutation({
    mutationFn: (payload: { title: string; message: string; type: BroadcastType; expiresAt?: string | null }) =>
      apiClient.publishBroadcast(payload),
    onSuccess: async (published) => {
      queryClient.setQueryData(['platform-broadcast'], published);
      setSyncedId(published.id);
      setConfirmClear(false);
      await invalidateBroadcastQueries();
      toast.success('¡Comunicado global publicado en la nube! Visible para todos los despachos.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al publicar comunicado.')
  });

  const clearMutation = useMutation({
    mutationFn: () => apiClient.clearBroadcast(),
    onSuccess: async () => {
      queryClient.setQueryData(['platform-broadcast'], null);
      setSyncedId(null);
      setTitle('');
      setMessage('');
      setExpiresAtInput('');
      setConfirmClear(false);
      await invalidateBroadcastQueries();
      toast.info('El comunicado global ha sido retirado de la plataforma.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Error al retirar comunicado.')
  });

  const isPending = publishMutation.isPending || clearMutation.isPending;

  const handleSaveBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.warning('Ingresa un título y mensaje para el comunicado.');
      return;
    }
    const expiresAt = toIsoOrNull(expiresAtInput);
    if (expiresAtInput && !expiresAt) {
      toast.warning('La fecha y hora de expiración no tiene un formato válido.');
      return;
    }
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      toast.warning('La fecha de expiración debe ser posterior al momento actual.');
      return;
    }
    publishMutation.mutate({ title: title.trim(), message: message.trim(), type, expiresAt });
  };

  const activeStyle = currentBroadcast?.active ? TYPE_STYLE_MAP[currentBroadcast.type] : null;
  const ActiveIcon = activeStyle?.icon ?? Info;
  const previewStyle = TYPE_STYLE_MAP[type];
  const PreviewIcon = previewStyle.icon;

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-600" aria-hidden="true" />
          Avisos y Comunicados Globales (Cintillo Superior)
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Publica un cintillo destacado en la parte superior de LibrePaq Pro para todos los usuarios conectados en la nube
        </p>
      </div>

      {isError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between gap-3">
          <span>No se pudo consultar el comunicado activo en la nube.</span>
          <button type="button" onClick={() => void refetch()} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-red-300 text-red-800 font-semibold hover:bg-red-100 cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      )}

      {isLoading && !currentBroadcast && (
        <p role="status" className="text-xs text-slate-600 py-2">Consultando comunicado activo en la plataforma...</p>
      )}

      {currentBroadcast?.active && activeStyle && (
        <div className={`p-4 rounded-xl border space-y-3 ${activeStyle.box}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <ActiveIcon className={`w-5 h-5 shrink-0 mt-0.5 ${activeStyle.iconClass}`} aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider">Aviso Activo:</span>
                  <span className="text-xs font-black">{currentBroadcast.title}</span>
                  {currentBroadcast.expiresAt && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/80 text-slate-700 border border-slate-300">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      Expira: {formatExpirationLabel(currentBroadcast.expiresAt)}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5 text-slate-800">{currentBroadcast.message}</p>
              </div>
            </div>
            {canManage && !confirmClear && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmClear(true)}
                className="p-2 rounded-lg text-slate-700 hover:text-red-700 hover:bg-white/80 disabled:opacity-50 transition cursor-pointer shrink-0"
                title="Desactivar y retirar comunicado"
                aria-label="Desactivar y retirar comunicado"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {confirmClear && (
            <div
              role="alertdialog"
              aria-modal="false"
              aria-label="Confirmar retiro del comunicado global"
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !isPending) {
                  e.preventDefault();
                  setConfirmClear(false);
                }
              }}
              className="p-3 rounded-lg bg-white border border-red-300 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <span className="font-bold text-red-900">¿Retirar este comunicado para todos los usuarios?</span>
              <div className="flex items-center gap-2">
                <button type="button" autoFocus disabled={isPending} onClick={() => setConfirmClear(false)} className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="button" disabled={isPending} onClick={() => clearMutation.mutate()} className="px-3 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold disabled:opacity-50 cursor-pointer">
                  {clearMutation.isPending ? 'Retirando...' : 'Sí, retirar aviso'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {canManage ? (
        <form onSubmit={handleSaveBroadcast} className="space-y-3.5 pt-2 border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="broadcast-title" className="block text-xs font-bold text-slate-700">Título del Comunicado</label>
              <span className="text-[11px] font-mono tabular-nums text-slate-600">{title.length}/200</span>
            </div>
            <input id="broadcast-title" name="broadcastTitle" type="text" maxLength={200} required disabled={isPending} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ej. Mantenimiento programado de servidores SAT o Nueva función disponible" className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100" />
          </div>
          <div>
            <label htmlFor="broadcast-expires-at" className="block text-xs font-bold text-slate-700 mb-1">Expiración automática (opcional)</label>
            <input id="broadcast-expires-at" name="broadcastExpiresAt" type="datetime-local" min={toDatetimeLocalValue(new Date().toISOString())} disabled={isPending} value={expiresAtInput} onChange={(e) => setExpiresAtInput(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100" />
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {([
                { label: '+2 h', hours: 2 },
                { label: '+24 h', hours: 24 },
                { label: '+7 días', hours: 24 * 7 }
              ] as const).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={isPending}
                  onClick={() => setExpiresAtInput(toDatetimeLocalValue(new Date(Date.now() + preset.hours * 3_600_000).toISOString()))}
                  className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold border border-slate-200 transition cursor-pointer disabled:opacity-50"
                >
                  {preset.label}
                </button>
              ))}
              {expiresAtInput && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setExpiresAtInput('')}
                  className="px-2 py-0.5 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-300 transition cursor-pointer disabled:opacity-50"
                >
                  Sin expiración
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label htmlFor="broadcast-message" className="block text-xs font-bold text-slate-700">Mensaje Completo</label>
            <span className="text-[11px] font-mono tabular-nums text-slate-600">{message.length}/1000</span>
          </div>
          <textarea id="broadcast-message" name="broadcastMessage" maxLength={1000} required disabled={isPending} value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Escribe el mensaje claro que verán todos los contadores..." className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-100" />
        </div>

        {(title.trim() || message.trim()) && (
          <div aria-label="Vista previa del comunicado" className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${previewStyle.box}`}>
            <PreviewIcon className={`w-4 h-4 shrink-0 mt-0.5 ${previewStyle.iconClass}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Vista previa en vivo</p>
              <p className="font-bold">{title.trim() || 'Título del comunicado'}</p>
              {message.trim() && <p className="text-[11px] text-slate-800">{message.trim()}</p>}
              {expiresAtInput && (
                <p className="text-[11px] text-slate-700 mt-0.5">
                  Vigente hasta: {formatExpirationLabel(toIsoOrNull(expiresAtInput) || expiresAtInput)}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
          <div>
            <span id="broadcast-type-label" className="block text-xs font-bold text-slate-700 mb-1">Tipo de Alerta</span>
            <div role="group" aria-labelledby="broadcast-type-label" className="flex flex-wrap gap-2">
              {([{ id: 'info', label: 'Informativo' }, { id: 'warning', label: 'Advertencia' }, { id: 'success', label: 'Novedad' }] as const).map((t) => (
                <button key={t.id} type="button" disabled={isPending} aria-pressed={type === t.id} onClick={() => setType(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50 ${type === t.id ? 'bg-blue-700 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !title.trim() || !message.trim()}
            aria-busy={publishMutation.isPending}
            title={!title.trim() || !message.trim() ? 'Ingresa título y mensaje para publicar' : undefined}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            {publishMutation.isPending ? 'Publicando...' : currentBroadcast?.active ? 'Actualizar Comunicado' : 'Publicar Comunicado en Vivo'}
          </button>
        </div>
      </form>
      ) : (
        <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
          Solo el Dueño de Plataforma puede publicar o retirar comunicados globales.
        </p>
      )}
    </div>
  );
}

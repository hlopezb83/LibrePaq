import { useState } from 'react';
import { Megaphone, AlertCircle, CheckCircle2, Info, Trash2, Send } from 'lucide-react';
import { adminApi } from '../../lib/api/admin.api';
import { useToast } from '../../context/ToastContext';
import type { AdminBroadcastMessage } from '../../shared/admin-types';

export function SuperAdminBroadcastTab() {
  const toast = useToast();
  const [currentBroadcast, setCurrentBroadcast] = useState<AdminBroadcastMessage | null>(() =>
    adminApi.getBroadcastMessage()
  );

  const [title, setTitle] = useState(currentBroadcast?.title || '');
  const [message, setMessage] = useState(currentBroadcast?.message || '');
  const [type, setType] = useState<'info' | 'warning' | 'success'>(
    currentBroadcast?.type || 'info'
  );
  const [confirmClear, setConfirmClear] = useState(false);

  const handleSaveBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.warning('Ingresa un título y mensaje para el comunicado.');
      return;
    }

    const newMsg: AdminBroadcastMessage = {
      id: `bc_${Date.now()}`,
      title: title.trim(),
      message: message.trim(),
      type,
      active: true,
      createdAt: currentBroadcast?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    adminApi.setBroadcastMessage(newMsg);
    setCurrentBroadcast(newMsg);
    setConfirmClear(false);
    toast.success('¡Comunicado global publicado con éxito! Visible para todos los usuarios.');
  };

  const handleClearBroadcast = () => {
    adminApi.setBroadcastMessage(null);
    setCurrentBroadcast(null);
    setTitle('');
    setMessage('');
    setConfirmClear(false);
    toast.info('El comunicado global ha sido retirado de la plataforma.');
  };

  return (
    <div className="bg-white border border-slate-300/80 rounded-2xl p-5 shadow-2xs space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-500" aria-hidden="true" />
          Avisos y Comunicados Globales (Cintillo Superior)
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">
          Publica un cintillo destacado en la parte superior de LibrePaq Pro para todos los usuarios conectados
        </p>
      </div>

      {currentBroadcast?.active && (
        <div
          className={`p-4 rounded-xl border space-y-3 ${
            currentBroadcast.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : currentBroadcast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {currentBroadcast.type === 'warning' ? (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              ) : currentBroadcast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Aviso Activo:</span>
                  <span className="text-xs font-black">{currentBroadcast.title}</span>
                </div>
                <p className="text-xs mt-0.5 text-slate-700">{currentBroadcast.message}</p>
              </div>
            </div>

            {!confirmClear && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="p-2 rounded-lg text-slate-600 hover:text-red-700 hover:bg-white/80 transition cursor-pointer shrink-0"
                title="Desactivar y borrar comunicado"
                aria-label="Desactivar y borrar comunicado"
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
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setConfirmClear(false);
                }
              }}
              className="p-3 rounded-lg bg-white/90 border border-red-200 flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <span className="font-bold text-red-900">¿Retirar este comunicado para todos los usuarios?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleClearBroadcast}
                  className="px-3 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold cursor-pointer"
                >
                  Sí, retirar aviso
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSaveBroadcast} className="space-y-3.5 pt-2 border-t border-slate-100">
        <div>
          <label htmlFor="broadcast-title" className="block text-xs font-bold text-slate-700 mb-1">
            Título del Comunicado
          </label>
          <input
            id="broadcast-title"
            name="broadcastTitle"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ej. Mantenimiento programado de servidores SAT o Nueva función disponible"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="broadcast-message" className="block text-xs font-bold text-slate-700 mb-1">
            Mensaje Completo
          </label>
          <textarea
            id="broadcast-message"
            name="broadcastMessage"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Escribe el mensaje claro que verán todos los contadores..."
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {(title.trim() || message.trim()) && (
          <div
            aria-label="Vista previa del comunicado"
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-blue-50 border-blue-200 text-blue-950'
            }`}
          >
            {type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            ) : type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">Vista previa</p>
              <p className="font-bold">{title.trim() || 'Título del comunicado'}</p>
              {message.trim() && <p className="text-[11px] opacity-90">{message.trim()}</p>}
            </div>
          </div>
        )}

        <div>
          <span id="broadcast-type-label" className="block text-xs font-bold text-slate-700 mb-1">
            Tipo de Alerta
          </span>
          <div role="group" aria-labelledby="broadcast-type-label" className="flex gap-2">
            {([
              { id: 'info', label: 'Informativo' },
              { id: 'warning', label: 'Advertencia' },
              { id: 'success', label: 'Novedad' },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={type === t.id}
                onClick={() => setType(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  type === t.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            {currentBroadcast?.active ? 'Actualizar Comunicado' : 'Publicar Comunicado en Vivo'}
          </button>
        </div>
      </form>
    </div>
  );
}

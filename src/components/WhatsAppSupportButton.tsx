import { useState, useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useAuth } from '../context/AuthContext';
import { trackAnalyticsEvent } from '../lib/analytics';

// Número oficial de soporte por WhatsApp (10 dígitos con lada México +52)
// Se puede sobreescribir vía variable de entorno VITE_WHATSAPP_SUPPORT_PHONE
export const DEFAULT_WHATSAPP_PHONE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WHATSAPP_SUPPORT_PHONE) ||
  '528116362252';

interface WhatsAppSupportButtonProps {
  phoneNumber?: string;
}

export function WhatsAppSupportButton({ phoneNumber = DEFAULT_WHATSAPP_PHONE }: WhatsAppSupportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const routerState = useRouterState();
  const currentPath = routerState?.location?.pathname || '/';
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isPublic = currentPath === '/landing' || currentPath === '/privacy' || currentPath === '/terms' || (!user && currentPath === '/');

  const defaultMessage = isPublic
    ? 'Hola LibrePaq Pro 👋, estoy navegando en librepaq.com y me gustaría más información para mi despacho contable o empresa.'
    : `Hola Soporte LibrePaq Pro 👋, requiero asistencia técnica con mi cuenta${user?.email ? ` (${user.email})` : ''} en el módulo ${currentPath}.`;

  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMessage)}`;

  const handleOpenChat = () => {
    trackAnalyticsEvent('click_whatsapp_support', {
      path: currentPath,
      user_email: user?.email || 'anonimo',
      phone: cleanPhone
    });
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  return (
    <aside
      aria-label="Soporte y contacto por WhatsApp"
      className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 lg:bottom-6 lg:right-6 z-50 no-print"
    >
      {/* Ventana emergente con mensaje de bienvenida (Chat Preview Card) */}
      {isOpen && (
        <div
          ref={cardRef}
          role="dialog"
          aria-label="Ventana de ayuda de WhatsApp"
          className="absolute bottom-14 sm:bottom-16 right-0 mb-1.5 w-[min(20rem,calc(100dvw-1.5rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-3.5 sm:p-4 shadow-2xl border border-slate-200 text-slate-800 font-sans animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Header del preview */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                  LP
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-500/20" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-tight">Asesor LibrePaq</h4>
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  En línea · Respuesta rápida
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Cerrar ventana de WhatsApp"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mensaje tipo WhatsApp bubble */}
          <div className="my-3.5 bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs leading-relaxed text-slate-600">
            <p className="font-medium text-slate-800 mb-1">
              {isPublic ? '¿Dudas sobre cómo funciona LibrePaq Pro?' : '¿Tienes alguna duda contable o técnica?'}
            </p>
            <p>
              Escríbenos directamente a WhatsApp y un especialista fiscal te apoyará paso a paso.
            </p>
            <span className="block text-[10px] text-slate-400 text-right mt-1.5">Ahora</span>
          </div>

          {/* Botón CTA para abrir WhatsApp */}
          <button
            type="button"
            onClick={handleOpenChat}
            className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] active:bg-[#1caa51] text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.288.043.088.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.044.102-.115.434-.506.549-.68.116-.173.232-.144.39-.086.159.058 1.011.477 1.184.564.174.087.289.13.332.203.043.072.043.419-.101.824z" />
            </svg>
            Abrir chat en WhatsApp
          </button>
        </div>
      )}

      {/* Botón Flotante Principal de WhatsApp */}
      <div className="relative group">
        {/* Tooltip flotante al pasar el mouse (cuando el modal está cerrado) */}
        {!isOpen && (
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 pointer-events-none hidden md:flex items-center">
            <div className="bg-slate-900/95 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-lg whitespace-nowrap">
              ¿Dudas? Chatea con nosotros
            </div>
            <div className="w-2 h-2 bg-slate-900/95 rotate-45 -ml-1" />
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Abrir soporte por WhatsApp"
          className="flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-[#25D366] text-white shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-400/40 relative z-10 cursor-pointer"
        >
          {/* Icono de WhatsApp */}
          <svg className="w-6 h-6 lg:w-7 lg:h-7 fill-current" viewBox="0 0 24 24">
            <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.288.043.088.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.044.102-.115.434-.506.549-.68.116-.173.232-.144.39-.086.159.058 1.011.477 1.184.564.174.087.289.13.332.203.043.072.043.419-.101.824z" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

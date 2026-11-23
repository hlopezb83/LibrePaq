import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toaster, toast as sonnerToast } from 'sonner';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface ToastErrorOptions {
  description?: string;
  reportData?: unknown;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
  enableCopyReport?: boolean;
}

export interface ToastContextType {
  showToast: (toast: Omit<ToastItem, 'id'>) => string | number;
  dismissToast: (id?: string | number) => void;
  success: (title: string, message?: string) => string | number;
  error: (
    title: string,
    messageOrOptions?: string | ToastErrorOptions,
    maybeOptions?: ToastErrorOptions
  ) => string | number;
  warning: (title: string, message?: string) => string | number;
  info: (title: string, message?: string) => string | number;
  promise: typeof sonnerToast.promise;
}

function copyErrorReport(title: string, message?: string, reportData?: unknown) {
  const payload = {
    timestamp: new Date().toISOString(),
    title,
    message: message || title,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    reportData: reportData ?? null
  };

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(JSON.stringify(payload, null, 2))
        .then(() => {
          sonnerToast.success('¡Diagnóstico copiado al portapapeles!', {
            description: 'Pégalo en WhatsApp con el equipo de soporte para resolverlo de inmediato.',
            duration: 5000
          });
        })
        .catch(() => {
          sonnerToast.error('No se pudo copiar automáticamente al portapapeles.');
        });
      return;
    }
    sonnerToast.error('El portapapeles no está disponible en este navegador.');
  } catch {
    sonnerToast.error('No se pudo copiar automáticamente al portapapeles.');
  }
}

function bringToastPortalToFront() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('toast-portal-popover') as
    | (HTMLElement & { showPopover?: () => void; hidePopover?: () => void })
    | null;
  if (el && typeof el.showPopover === 'function') {
    try {
      if (typeof el.hidePopover === 'function') el.hidePopover();
      el.showPopover();
    } catch {
      // Ignorar fallo de re-apertura en navegador sin soporte
    }
  }
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<ToastContextType>(
    () => ({
      showToast: (item) => {
        bringToastPortalToFront();
        const toastId = `${item.type}:${item.title}:${item.message || ''}`;
        const opts = {
          id: toastId,
          description: item.message,
          duration: item.duration ?? (item.type === 'error' ? 12000 : item.type === 'warning' ? 6000 : 3500)
        };
        if (item.type === 'success') return sonnerToast.success(item.title, opts);
        if (item.type === 'error') {
          return sonnerToast.error(item.title, {
            ...opts,
            action: {
              label: '📋 Copiar reporte',
              onClick: () => copyErrorReport(item.title, item.message)
            }
          });
        }
        if (item.type === 'warning') return sonnerToast.warning(item.title, opts);
        return sonnerToast.info(item.title, opts);
      },
      dismissToast: (id) => sonnerToast.dismiss(id),
      success: (title, message) => {
        bringToastPortalToFront();
        const toastId = `success:${title}:${message || ''}`;
        return sonnerToast.success(title, {
          id: toastId,
          description: message,
          duration: 3500
        });
      },
      error: (title, messageOrOptions, maybeOptions) => {
        bringToastPortalToFront();
        let message: string | undefined;
        let options: ToastErrorOptions | undefined;

        if (typeof messageOrOptions === 'string') {
          message = messageOrOptions;
          options = maybeOptions;
        } else if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
          options = messageOrOptions;
          message = options.description;
        }

        const shouldEnableCopy = options?.enableCopyReport ?? true;
        const action =
          options?.action ||
          (shouldEnableCopy
            ? {
                label: '📋 Copiar reporte',
                onClick: () => copyErrorReport(title, message, options?.reportData)
              }
            : undefined);

        const toastId = `error:${title}:${message || ''}`;
        return sonnerToast.error(title, {
          id: toastId,
          description: message,
          duration: options?.duration ?? 12000,
          action
        });
      },
      warning: (title, message) => {
        bringToastPortalToFront();
        const toastId = `warning:${title}:${message || ''}`;
        return sonnerToast.warning(title, {
          id: toastId,
          description: message,
          duration: 6000
        });
      },
      info: (title, message) => {
        bringToastPortalToFront();
        const toastId = `info:${title}:${message || ''}`;
        return sonnerToast.info(title, {
          id: toastId,
          description: message,
          duration: 4000
        });
      },
      promise: sonnerToast.promise
    }),
    []
  );

  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById('toast-portal-popover');
    if (!el && typeof document !== 'undefined') {
      el = document.createElement('div');
      el.id = 'toast-portal-popover';
      el.setAttribute('popover', 'manual');
      document.body.appendChild(el);
    }
    if (el && typeof (el as HTMLElement & { showPopover?: () => void }).showPopover === 'function') {
      try {
        (el as HTMLElement & { showPopover: () => void }).showPopover();
      } catch {
        // Ignorado si ya está abierto o si no tiene soporte
      }
    }
    setPortalNode(el);
  }, []);

  const toasterElement = (
    <Toaster
      position="top-right"
      offset={{ top: 76, right: 24 }}
      mobileOffset={{ top: 12, right: 12, left: 12 }}
      gap={12}
      richColors
      closeButton
      hotkey={['altKey', 'KeyT']}
      expand={true}
      visibleToasts={3}
      toastOptions={{
        closeButtonAriaLabel: 'Cerrar notificación',
        className: 'font-sans text-xs font-semibold shadow-xl rounded-2xl border border-slate-200/90 dark:border-slate-700/80',
        style: {
          zIndex: 2147483647
        },
        actionButtonStyle: {
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '0.75rem',
          fontWeight: '600',
          padding: '0.375rem 0.75rem'
        }
      }}
    />
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portalNode ? createPortal(toasterElement, portalNode) : toasterElement}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider');
  }
  return context;
}

export { sonnerToast as toast };

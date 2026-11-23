import { useEffect } from 'react';
import type React from 'react';

/**
 * Fallback progresivo para navegadores que aún no soportan `<dialog closedby="any">` (ej. Safari),
 * permitiendo cerrar el modal al hacer clic sobre el `::backdrop` sin afectar clics internos.
 */
export function useDialogLightDismiss(
  dialogRef: React.RefObject<HTMLDialogElement | null>,
  onDismiss?: () => void,
  options?: { isOpen?: boolean; deferClose?: boolean }
): void {
  const isOpen = options?.isOpen;
  const deferClose = options?.deferClose ?? false;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof HTMLDialogElement === 'undefined') return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const handleClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;

      if (isDialogContent) return;
      if (!deferClose) dialog.close();
      onDismiss?.();
    };

    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [dialogRef, onDismiss, isOpen, deferClose]);
}

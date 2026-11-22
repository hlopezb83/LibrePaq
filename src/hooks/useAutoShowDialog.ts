import { useEffect, useRef, type RefObject } from 'react';

/**
 * Abre automáticamente un elemento nativo <dialog> tras su primer montaje diferido
 * (lazy/Suspense) sin depender de temporizadores frágiles con setTimeout.
 */
export function useAutoShowDialog(
  dialogRef: RefObject<HTMLDialogElement | null>,
  autoOpenOnMount = false,
  onShown?: () => void
) {
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;

  useEffect(() => {
    if (!autoOpenOnMount) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      onShownRef.current?.();
    }
  }, [dialogRef, autoOpenOnMount]);
}

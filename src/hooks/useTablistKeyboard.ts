import type React from 'react';

/**
 * Navegación WAI-ARIA estándar para barras de pestañas (ArrowLeft/Right/Home/End).
 * Actualiza la pestaña activa, traslada el foco al botón correspondiente y lo desplaza a vista.
 */
export function handleTablistKeyDown<T extends string>(
  e: React.KeyboardEvent<HTMLElement>,
  tabs: ReadonlyArray<{ id: T }>,
  activeId: T,
  onSelect: (id: T) => void,
  idPrefix: string
): void {
  const idx = tabs.findIndex((t) => t.id === activeId);
  if (idx === -1 || tabs.length === 0) return;

  let nextIdx = -1;
  if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') nextIdx = 0;
  else if (e.key === 'End') nextIdx = tabs.length - 1;
  else return;

  e.preventDefault();
  const nextTab = tabs[nextIdx];
  if (!nextTab) return;
  onSelect(nextTab.id);

  requestAnimationFrame(() => {
    const el = document.getElementById(`${idPrefix}${nextTab.id}`);
    el?.focus();
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

import React from 'react';

export interface CommandPaletteNavItem {
  to: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  shortcut: string;
}

export interface FlattenedItem {
  id: string;
  category: 'ACTIONS' | 'COMPANIES' | 'MODULES' | 'PERIODS' | 'POLIZAS' | 'ACCOUNTS';
  categoryTitle: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  badgeClass?: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  action: () => void;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

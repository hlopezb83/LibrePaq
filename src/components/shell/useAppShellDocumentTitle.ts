import { useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';
import type { User } from '@supabase/supabase-js';
import type { Company } from '../../shared/types';
import type { CommandPaletteNavItem } from '../command-palette/CommandPaletteModal';

const TAB_TITLE_LABELS: Record<string, string> = {
  BALANZA: 'Balanza',
  RESULTADOS: 'Estado de Resultados',
  BALANCE: 'Balance General',
  ANEXO24: 'Anexo 24',
  ENTREGABLES: 'Dossier de Cierre',
  DOSSIER: 'Dossier de Cierre',
  DIOT: 'DIOT',
  BANCOS: 'Conciliación Bancaria',
  ACTIVOS: 'Activos Fijos',
  DIA17: 'Día 17',
  FISCAL: 'Fiscal',
  GENERAL: 'Datos Fiscales',
  FIEL: 'e.firma SAT',
  EQUIPO: 'Equipo y Roles',
  RESPALDO: 'Respaldo y Bóveda'
};

interface UseAppShellDocumentTitleProps {
  currentPath: string;
  activeCompany: Company | null;
  navItems: CommandPaletteNavItem[];
  isOwner: boolean;
  user: User | null;
  isWorkspaceEmpty: boolean;
  onPathChange: () => void;
}

export function useAppShellDocumentTitle({
  currentPath,
  activeCompany,
  navItems,
  isOwner,
  user,
  isWorkspaceEmpty,
  onPathChange
}: UseAppShellDocumentTitleProps): void {
  const activeTab = useRouterState({
    select: (s) => {
      const tab = (s.location.search as Record<string, unknown>)?.tab;
      return typeof tab === 'string' ? tab : '';
    }
  });

  useEffect(() => {
    if (currentPath === '/privacy') {
      document.title = 'Aviso de Privacidad Integral | LibrePaq Pro';
    } else if (currentPath === '/terms') {
      document.title = 'Términos y Condiciones de Uso | LibrePaq Pro';
    } else if (currentPath === '/reset-password') {
      document.title = 'Restablecer Contraseña | LibrePaq Pro';
    } else if (currentPath === '/landing' || (!user && currentPath === '/')) {
      document.title = 'LibrePaq Pro | El Software Contable y Fiscal que Reemplaza a CONTPAQi®';
    } else if (isWorkspaceEmpty) {
      document.title = 'Mi Despacho Contable | LibrePaq Pro';
    } else {
      const activeItem =
        navItems.find((item) =>
          isOwner
            ? currentPath === '/admin' &&
              (item.to.includes('?tab=')
                ? item.to.endsWith(`?tab=${activeTab}`)
                : !activeTab || activeTab === 'metrics')
            : item.to === '/'
            ? currentPath === '/'
            : currentPath.startsWith(item.to)
        ) ?? navItems[0];
      const rfcSuffix = activeCompany && !isOwner ? ` • ${activeCompany.rfc}` : '';
      const baseLabel = activeItem ? activeItem.label : isOwner ? 'Consola de Propietario' : 'Tablero Fiscal';
      const tabSuffix =
        !isOwner && activeTab
          ? ` — ${TAB_TITLE_LABELS[activeTab.toUpperCase()] || activeTab}`
          : '';
      document.title = `${baseLabel}${tabSuffix}${rfcSuffix} | LibrePaq Pro`;
    }
    onPathChange();
  }, [currentPath, activeTab, activeCompany, navItems, isOwner, user, isWorkspaceEmpty, onPathChange]);
}

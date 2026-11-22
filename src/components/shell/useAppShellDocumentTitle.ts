import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Company } from '../../shared/types';
import type { CommandPaletteNavItem } from '../CommandPaletteModal';

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
  useEffect(() => {
    if (currentPath === '/privacy' || currentPath === '/terms') {
      document.title = 'Aviso de Privacidad Integral | LibrePaq Pro';
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
                ? window.location.search.includes(item.to.slice(item.to.indexOf('?tab=')))
                : !window.location.search.includes('?tab='))
            : item.to === '/'
            ? currentPath === '/'
            : currentPath.startsWith(item.to)
        ) ?? navItems[0];
      const rfcSuffix = activeCompany && !isOwner ? ` • ${activeCompany.rfc}` : '';
      const titleLabel = activeItem ? activeItem.label : isOwner ? 'Consola de Propietario' : 'Tablero Fiscal';
      document.title = `${titleLabel}${rfcSuffix} | LibrePaq Pro`;
    }
    onPathChange();
  }, [currentPath, activeCompany, navItems, isOwner, user, isWorkspaceEmpty, onPathChange]);
}

import {
  Building2,
  Download,
  FileCode2,
  Plus,
  Sparkles,
  Zap
} from 'lucide-react';
import type { FlattenedItem } from './commandPaletteTypes';
import { normalizeText } from './commandPaletteTypes';

export interface QuickActionAccessOptions {
  isReadOnlyClient?: boolean;
  isOwner?: boolean;
  isWorkspaceEmpty?: boolean;
}

export function getQuickActionItems(
  query: string,
  onSelectRoute: (to: string) => void,
  onOpenCompanySwitcher?: () => void,
  onOpenNewCompanyWizard?: () => void,
  onOpenDeliverables?: () => void,
  access: QuickActionAccessOptions = {}
): FlattenedItem[] {
  const { isReadOnlyClient = false, isOwner = false, isWorkspaceEmpty = false } = access;
  if (isOwner || isWorkspaceEmpty) return [];

  const allItems: Array<FlattenedItem & { requiresWrite?: boolean }> = [
    {
      id: 'act-new-poliza',
      category: 'ACTIONS',
      categoryTitle: 'Acciones Rápidas del Sistema',
      title: 'Capturar Nueva Póliza Contable',
      subtitle: 'Ingresos, Egresos y Diario con cuadre automático y búsqueda asistida',
      shortcut: 'Alt+N',
      badge: 'Partida Doble',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: Plus,
      requiresWrite: true,
      action: () => {
        onSelectRoute('/polizas?nueva=true');
      }
    },
    {
      id: 'act-import-cfdi',
      category: 'ACTIONS',
      categoryTitle: 'Acciones Rápidas del Sistema',
      title: 'Cargar / Importar Facturas CFDI 4.0 XML (ADD)',
      subtitle: 'Bóveda digital, validación de timbrado SAT y extracción de impuestos',
      shortcut: 'Alt+2',
      badge: 'Bóveda Digital',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: FileCode2,
      requiresWrite: true,
      action: () => onSelectRoute('/add')
    },
    {
      id: 'act-deliverables',
      category: 'ACTIONS',
      categoryTitle: 'Acciones Rápidas del Sistema',
      title: 'Generar Paquete Ejecutivo de Cierre Mensual (Dossier PDF/Excel)',
      subtitle: 'Balanza, Estado de Resultados, Pólizas, Mayor y Conciliación foliados',
      badge: 'Auditoría SAT',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: Zap,
      action: () => {
        if (onOpenDeliverables) {
          onOpenDeliverables();
          return;
        }
        onSelectRoute('/reportes?tab=DOSSIER&dossier=true');
      }
    },
    {
      id: 'act-company-switcher',
      category: 'ACTIONS',
      categoryTitle: 'Acciones Rápidas del Sistema',
      title: 'Conmutador de Empresa Activa (Multi-RFC)',
      subtitle: 'Cambiar de razón social o ejercicio fiscal con protección contable',
      shortcut: 'Ctrl+E',
      badge: 'Multi-Empresa',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
      icon: Building2,
      action: () => {
        if (onOpenCompanySwitcher) onOpenCompanySwitcher();
      }
    },
    {
      id: 'act-new-company-wizard',
      category: 'ACTIONS',
      categoryTitle: 'Acciones Rápidas del Sistema',
      title: 'Asistente de Alta: Registrar Nueva Empresa',
      subtitle: 'Configura RFC, régimen fiscal y catálogo oficial SAT del Anexo 24',
      badge: 'Asistente Guiado',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: Sparkles,
      requiresWrite: true,
      action: () => {
        if (onOpenNewCompanyWizard) onOpenNewCompanyWizard();
      }
    },
    {
      id: 'act-backup',
      category: 'ACTIONS',
      categoryTitle: 'Acciones Rápidas del Sistema',
      title: 'Descargar Respaldo Integral y Bóveda Contable',
      subtitle: 'Exportación completa de pólizas, catálogo, CFDI y candados de periodo',
      badge: 'Seguridad',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
      icon: Download,
      requiresWrite: true,
      action: () => onSelectRoute('/ajustes')
    }
  ];

  const list: FlattenedItem[] = allItems.filter((item) => !(isReadOnlyClient && item.requiresWrite));

  const q = normalizeText(query);
  if (!q) return list;
  return list.filter(
    (a) =>
      normalizeText(a.title).includes(q) ||
      (a.subtitle && normalizeText(a.subtitle).includes(q)) ||
      (a.shortcut && normalizeText(a.shortcut).includes(q)) ||
      (a.badge && normalizeText(a.badge).includes(q))
  );
}

import {
  Activity,
  ClipboardList,
  FileCode2,
  FileSpreadsheet,
  FolderTree,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Users,
  Building2,
  Target,
  Megaphone
} from 'lucide-react';
import type { CommandPaletteNavItem } from '../command-palette/CommandPaletteModal';

export const SUPERADMIN_NAV_ITEMS: CommandPaletteNavItem[] = [
  {
    to: '/admin',
    label: 'Métricas & Negocio',
    sublabel: 'KPIs SaaS y Salud del Sistema',
    icon: LayoutDashboard,
    shortcut: 'Alt+1'
  },
  {
    to: '/admin?tab=users',
    label: 'Despachos y Clientes',
    sublabel: 'Cuentas Registradas en Nube',
    icon: Users,
    shortcut: 'Alt+2'
  },
  {
    to: '/admin?tab=companies',
    label: 'Empresas Fiscales',
    sublabel: 'Directorio Global Multi-Tenant',
    icon: Building2,
    shortcut: 'Alt+3'
  },
  {
    to: '/admin?tab=ads',
    label: 'Google Ads & Conversión',
    sublabel: 'Tráfico, Tags y WhatsApp',
    icon: Target,
    shortcut: 'Alt+4'
  },
  {
    to: '/admin?tab=sat',
    label: 'Salud SAT & Alertas',
    sublabel: 'Descargas XML, FIEL y Alertas',
    icon: Activity,
    shortcut: 'Alt+5'
  },
  {
    to: '/admin?tab=broadcast',
    label: 'Comunicados Globales',
    sublabel: 'Avisos en Vivo a Usuarios',
    icon: Megaphone,
    shortcut: 'Alt+6'
  },
  {
    to: '/admin?tab=audit',
    label: 'Bitácora de Auditoría',
    sublabel: 'Eventos RBAC, Cuotas y Soporte',
    icon: ClipboardList,
    shortcut: 'Alt+7'
  }
];

export const APP_SHELL_NAV_ITEMS: CommandPaletteNavItem[] = [
  {
    to: '/',
    label: 'Tablero Fiscal',
    sublabel: 'Posición del Mes y Cierre',
    icon: LayoutDashboard,
    shortcut: 'Alt+1'
  },
  {
    to: '/add',
    label: 'Bóveda Digital (ADD)',
    sublabel: 'CFDI 4.0, Pagos y Nómina',
    icon: FileCode2,
    shortcut: 'Alt+2'
  },
  {
    to: '/polizas',
    label: 'Pólizas Contables',
    sublabel: 'Ingresos, Egresos, Diario y M13',
    icon: ReceiptText,
    shortcut: 'Alt+3'
  },
  {
    to: '/cuentas',
    label: 'Catálogo de Cuentas',
    sublabel: 'Árbol SAT y Libro Mayor',
    icon: FolderTree,
    shortcut: 'Alt+4'
  },
  {
    to: '/fiscal-bancos',
    label: 'Bancos, DIOT y Fiscal',
    sublabel: 'Conciliación, Activos y Día 17',
    icon: Landmark,
    shortcut: 'Alt+5'
  },
  {
    to: '/reportes',
    label: 'Estados Financieros',
    sublabel: 'Balanza Anexo 24 y Resultados',
    icon: FileSpreadsheet,
    shortcut: 'Alt+6'
  },
  {
    to: '/ajustes',
    label: 'Configuración y Empresa',
    sublabel: 'Datos Fiscales, e.firma y Respaldo',
    icon: Settings,
    shortcut: 'Alt+7'
  }
];

import { useMemo } from 'react';
import { BookOpen, Building2, Calendar, ReceiptText } from 'lucide-react';
import { formatCurrency, formatShortDate } from '../../lib/formatters';
import { MESES_SAT } from '../../shared/sat-catalog';
import type { AccountWithBalance, Company, Poliza } from '../../shared/types';
import { getQuickActionItems } from './commandPaletteQuickActions';
import { FlattenedItem, normalizeText, type CommandPaletteNavItem } from './commandPaletteTypes';
export type { FlattenedItem, CommandPaletteNavItem };
export { normalizeText };

export interface UseCommandPaletteItemsProps {
  query: string;
  navItems: CommandPaletteNavItem[];
  accounts: AccountWithBalance[];
  companies?: Company[];
  activeCompany?: Company | null;
  polizas?: Poliza[];
  onSelectRoute: (to: string) => void;
  onSelectAccount: (accountId: string) => void;
  onSelectCompany?: (companyId: string) => void;
  onSelectPeriod?: (year: number, period: number) => void;
  onOpenCompanySwitcher?: () => void;
  onOpenNewCompanyWizard?: () => void;
}

export function useCommandPaletteItems({
  query,
  navItems,
  accounts,
  companies = [],
  activeCompany = null,
  polizas = [],
  onSelectRoute,
  onSelectAccount,
  onSelectCompany,
  onSelectPeriod,
  onOpenCompanySwitcher,
  onOpenNewCompanyWizard
}: UseCommandPaletteItemsProps) {
  const quickActions = useMemo<FlattenedItem[]>(() => {
    return getQuickActionItems(query, onSelectRoute, onOpenCompanySwitcher, onOpenNewCompanyWizard);
  }, [query, onSelectRoute, onOpenCompanySwitcher, onOpenNewCompanyWizard]);

  const filteredCompanies = useMemo<FlattenedItem[]>(() => {
    const q = normalizeText(query);
    const isSearchingCompany =
      q.includes('empresa') ||
      q.includes('rfc') ||
      q.includes('razon') ||
      q.includes('compan') ||
      companies.some(
        (c) => normalizeText(c.name).includes(q) || normalizeText(c.rfc).includes(q)
      );

    if (!q && companies.length <= 1) return [];
    if (!isSearchingCompany && q) return [];

    return companies
      .filter((c) => {
        if (!q) return true;
        return normalizeText(c.name).includes(q) || normalizeText(c.rfc).includes(q);
      })
      .map((comp) => {
        const isCurrent = comp.id === activeCompany?.id;
        const mesObj = MESES_SAT.find((m) => m.periodo === comp.currentPeriod);
        const periodoNombre = mesObj?.nombre || `P${comp.currentPeriod}`;
        return {
          id: `comp-${comp.id}`,
          category: 'COMPANIES' as const,
          categoryTitle: 'Empresas Registradas (Multi-RFC)',
          title: comp.name,
          subtitle: `RFC: ${comp.rfc} • ${periodoNombre} ${comp.currentYear}`,
          badge: isCurrent ? 'Empresa Activa' : 'Cambiar a esta Empresa',
          badgeClass: isCurrent
            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
            : 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Building2,
          action: () => {
            if (onSelectCompany) {
              onSelectCompany(comp.id);
            }
          }
        };
      });
  }, [companies, activeCompany, query, onSelectCompany]);

  const filteredNav = useMemo<FlattenedItem[]>(() => {
    const q = normalizeText(query);
    const matching = !q
      ? navItems
      : navItems.filter(
          (n) =>
            normalizeText(n.label).includes(q) ||
            normalizeText(n.sublabel).includes(q) ||
            normalizeText(n.shortcut).includes(q)
        );

    return matching.map((item) => ({
      id: `nav-${item.to}`,
      category: 'MODULES' as const,
      categoryTitle: 'Módulos del Sistema',
      title: item.label,
      subtitle: item.sublabel,
      shortcut: item.shortcut,
      icon: item.icon,
      action: () => onSelectRoute(item.to)
    }));
  }, [navItems, query, onSelectRoute]);

  const filteredPeriods = useMemo<FlattenedItem[]>(() => {
    const q = normalizeText(query);
    if (!q) return [];
    const isPeriodSearch =
      q.includes('mes') ||
      q.includes('periodo') ||
      q.includes('ejercicio') ||
      q.includes('ano') ||
      q.startsWith('p') ||
      MESES_SAT.some((m) => normalizeText(m.nombre).includes(q));

    if (!isPeriodSearch) return [];

    const activeYear = activeCompany?.currentYear ?? 2026;
    const activePeriod = activeCompany?.currentPeriod ?? 10;

    return MESES_SAT.filter((m) => {
      const matchP = `p${m.periodo}`.includes(q) || `p0${m.periodo}`.includes(q);
      return normalizeText(m.nombre).includes(q) || matchP;
    }).map((m) => {
      const isCurrent = m.periodo === activePeriod;
      return {
        id: `period-${m.periodo}`,
        category: 'PERIODS' as const,
        categoryTitle: 'Periodos del Ejercicio Fiscal',
        title: `${m.nombre} ${activeYear}`,
        subtitle:
          m.periodo === 13
            ? 'Periodo M13: Póliza de Cierre y Traspaso de Resultados'
            : `Periodo contable ordinario #${m.periodo}`,
        badge: isCurrent ? 'Periodo Actual' : `Cambiar a P${m.periodo}`,
        badgeClass: isCurrent
          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
          : 'bg-slate-100 text-slate-700 border-slate-200',
        shortcut: `P${String(m.periodo).padStart(2, '0')}`,
        icon: Calendar,
        action: () => {
          if (onSelectPeriod) {
            onSelectPeriod(activeYear, m.periodo);
          }
        }
      };
    });
  }, [activeCompany, query, onSelectPeriod]);

  const filteredPolizas = useMemo<FlattenedItem[]>(() => {
    const q = normalizeText(query);
    if (!q || polizas.length === 0) return [];

    return polizas
      .filter((p) => {
        const fullFolio = normalizeText(`${p.tipo} #${p.folio}`);
        const folioStr = String(p.folio);
        return (
          fullFolio.includes(q) ||
          folioStr === q ||
          normalizeText(p.concepto).includes(q) ||
          p.fecha.includes(q)
        );
      })
      .slice(0, 5)
      .map((p) => ({
        id: `pol-${p.id}`,
        category: 'POLIZAS' as const,
        categoryTitle: 'Pólizas Contables Coincidentes',
        title: `${p.tipo} #${p.folio} — ${p.concepto}`,
        subtitle: `Fecha: ${formatShortDate(p.fecha)} • Partidas: ${p.movements?.length ?? 0}`,
        meta: formatCurrency(p.totalCargos),
        badge: p.isBalanced ? 'Cuadrada' : 'Descuadrada',
        badgeClass: p.isBalanced
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-amber-50 text-amber-700 border-amber-200',
        icon: ReceiptText,
        action: () => {
          onSelectRoute(`/polizas?search=${encodeURIComponent(`${p.tipo} #${p.folio}`)}`);
        }
      }));
  }, [polizas, query, onSelectRoute]);

  const filteredAccounts = useMemo<FlattenedItem[]>(() => {
    const q = normalizeText(query);
    const source = !q ? accounts.filter((a) => a.isAffectable).slice(0, 6) : accounts;

    return source
      .filter((a) => {
        if (!q) return true;
        return (
          normalizeText(a.code).includes(q) ||
          normalizeText(a.name).includes(q) ||
          (a.satGroupCode && normalizeText(a.satGroupCode).includes(q))
        );
      })
      .slice(0, 8)
      .map((acc) => ({
        id: `acc-${acc.id}`,
        category: 'ACCOUNTS' as const,
        categoryTitle: 'Cuentas Contables (Libro Mayor / Auxiliar)',
        title: `${acc.code} — ${acc.name}`,
        subtitle: `SAT: ${acc.satGroupCode || 'S/A'} • Naturaleza: ${acc.nature}`,
        meta: formatCurrency(acc.finalBalance),
        badge: acc.nature === 'DEUDORA' ? 'Deudora [D]' : 'Acreedora [A]',
        badgeClass:
          acc.nature === 'DEUDORA'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-purple-50 text-purple-700 border-purple-200',
        icon: BookOpen,
        action: () => onSelectAccount(acc.id)
      }));
  }, [accounts, query, onSelectAccount]);

  const flattenedItems = useMemo<FlattenedItem[]>(() => {
    return [
      ...quickActions,
      ...filteredCompanies,
      ...filteredNav,
      ...filteredPeriods,
      ...filteredPolizas,
      ...filteredAccounts
    ];
  }, [
    quickActions,
    filteredCompanies,
    filteredNav,
    filteredPeriods,
    filteredPolizas,
    filteredAccounts
  ]);

  return flattenedItems;
}

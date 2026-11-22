export interface CompanyTheme {
  bg: string;
  text: string;
  border: string;
  badge: string;
  pill: string;
}

export function getCompanyTheme(rfcOrId: string = ''): CompanyTheme {
  const themes: CompanyTheme[] = [
    {
      bg: 'bg-blue-700',
      text: 'text-blue-100',
      border: 'border-blue-400',
      badge: 'bg-blue-50 text-blue-900 border-blue-200',
      pill: 'bg-blue-100 text-blue-800'
    },
    {
      bg: 'bg-emerald-700',
      text: 'text-emerald-100',
      border: 'border-emerald-400',
      badge: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      pill: 'bg-emerald-100 text-emerald-800'
    },
    {
      bg: 'bg-purple-700',
      text: 'text-purple-100',
      border: 'border-purple-400',
      badge: 'bg-purple-50 text-purple-900 border-purple-200',
      pill: 'bg-purple-100 text-purple-800'
    },
    {
      bg: 'bg-amber-700',
      text: 'text-amber-100',
      border: 'border-amber-400',
      badge: 'bg-amber-50 text-amber-900 border-amber-200',
      pill: 'bg-amber-100 text-amber-900'
    },
    {
      bg: 'bg-rose-700',
      text: 'text-rose-100',
      border: 'border-rose-400',
      badge: 'bg-rose-50 text-rose-900 border-rose-200',
      pill: 'bg-rose-100 text-rose-900'
    },
    {
      bg: 'bg-teal-700',
      text: 'text-teal-100',
      border: 'border-teal-400',
      badge: 'bg-teal-50 text-teal-900 border-teal-200',
      pill: 'bg-teal-100 text-teal-800'
    }
  ];

  let hash = 0;
  for (let i = 0; i < rfcOrId.length; i += 1) {
    hash = (hash << 5) - hash + rfcOrId.charCodeAt(i);
    hash |= 0;
  }
  return themes[Math.abs(hash) % themes.length] ?? themes[0]!;
}

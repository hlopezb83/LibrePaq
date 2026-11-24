export type ViewedPeriodsMap = Record<string, { year: number; period: number }>;

export function loadStoredViewedPeriods(userScope: string): ViewedPeriodsMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`librepaq_viewed_periods_${userScope}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { year?: unknown; period?: unknown }>;
    const clean: ViewedPeriodsMap = {};
    for (const [companyId, entry] of Object.entries(parsed)) {
      const y = Number(entry?.year);
      const p = Number(entry?.period);
      if (Number.isInteger(y) && y >= 2000 && Number.isInteger(p) && p >= 1 && p <= 13) {
        clean[companyId] = { year: y, period: p };
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function saveStoredViewedPeriods(userScope: string, map: ViewedPeriodsMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`librepaq_viewed_periods_${userScope}`, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

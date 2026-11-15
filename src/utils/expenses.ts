export type PeriodFilter = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

/** هل تاريخ (YYYY-MM-DD) ضمن الفترة؟ */
export const inPeriod = (iso: string, f: PeriodFilter, from = '', to = ''): boolean => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return f === 'all';
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const now = new Date();
  if (f === 'custom') {
    if (from) { const [fy, fm, fd] = from.split('-').map(Number); if (dt < new Date(fy, fm - 1, fd, 0, 0, 0)) return false; }
    if (to) { const [ty, tm, td] = to.split('-').map(Number); if (dt > new Date(ty, tm - 1, td, 23, 59, 59)) return false; }
    return true;
  }
  if (f === 'today') return dt.toDateString() === now.toDateString();
  if (f === 'week') { const w = new Date(); w.setDate(now.getDate() - 7); return dt >= w; }
  if (f === 'month') return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  if (f === 'year') return dt.getFullYear() === now.getFullYear();
  return true;
};

export const EXPENSE_CATEGORIES = ['مستلزمات المحل', 'راتب موظف', 'إيجار', 'كهرباء وماء', 'نقل وتوصيل', 'صيانة', 'مصاريف أخرى'];

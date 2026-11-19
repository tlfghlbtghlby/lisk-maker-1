/** تاريخ + وقت موحّد لعرض القوائم في كل مكان (مثل 2026/11/19 03:45 م). */
export const fmtDateTime = (v: unknown): string => {
  if (!v) return '-';
  const d = new Date(v as any);
  if (isNaN(d.getTime())) return String(v).slice(0, 16).replace('T', ' ');
  return d.toLocaleString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

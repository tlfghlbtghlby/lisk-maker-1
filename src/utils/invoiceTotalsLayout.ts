/** صفوف مجاميع الوصل المطبوع: ترتيبها وإظهارها يضبطه صاحب المتجر من إعدادات الطباعة */
export type TotalsRowId = 'discount' | 'giftsValue' | 'giftsCount' | 'listTotal' | 'prevDebt' | 'grandTotal' | 'paid' | 'remaining';

export const TOTALS_ROWS: { id: TotalsRowId; label: string; hiddenByDefault?: boolean }[] = [
  { id: 'discount', label: 'خصم القائمة' },
  { id: 'giftsValue', label: 'قيمة الهدايا', hiddenByDefault: true },
  { id: 'giftsCount', label: 'عدد الهدايا', hiddenByDefault: true },
  { id: 'listTotal', label: 'مجموع القائمة' },
  { id: 'prevDebt', label: 'الدين القديم (السابق)' },
  { id: 'grandTotal', label: 'المجموع الكلي' },
  { id: 'paid', label: 'الواصل (المسدد)' },
  { id: 'remaining', label: 'الباقي (الرصيد الكلي)' },
];

export interface TotalsLayout { order: string[]; hidden: string[] }

export function defaultTotalsLayout(): TotalsLayout {
  return { order: TOTALS_ROWS.map((r) => r.id), hidden: TOTALS_ROWS.filter((r) => r.hiddenByDefault).map((r) => r.id) };
}

/** يدمج الإعداد المحفوظ مع القائمة الحالية (صفوف جديدة تُضاف في آخر الترتيب، ومجهولة تُحذف) */
export function resolveTotalsLayout(saved?: Partial<TotalsLayout> | null): TotalsLayout {
  const def = defaultTotalsLayout();
  if (!saved || !Array.isArray(saved.order)) return def;
  const known = new Set<string>(def.order);
  const order = [...saved.order.filter((x) => known.has(x)), ...def.order.filter((x) => !saved.order!.includes(x))];
  const hidden = Array.isArray(saved.hidden) ? saved.hidden.filter((x) => known.has(x)) : def.hidden;
  // الصفوف الجديدة غير المحفوظة تأخذ حالتها الافتراضية
  const fresh = def.order.filter((x) => !saved.order!.includes(x) && def.hidden.includes(x));
  return { order, hidden: [...new Set([...hidden, ...fresh])] };
}

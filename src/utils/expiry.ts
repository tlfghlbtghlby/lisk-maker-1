import type { ExpiryBatch } from '../types';

export type ShelfUnit = 'day' | 'month' | 'year';

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
};

/** إضافة (أو طرح عند الإشارة السالبة) مدة إلى تاريخ، مع الحفاظ على آخر يوم في الشهر عند الحاجة */
export function shiftDate(iso: string, amount: number, unit: ShelfUnit, sign: 1 | -1 = 1): string {
  const d = parse(iso);
  if (!d || !(amount > 0)) return '';
  const n = Math.floor(amount) * sign;
  if (unit === 'day') {
    d.setDate(d.getDate() + n);
  } else {
    const months = unit === 'year' ? n * 12 : n;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return toIso(d);
}

/** عدد الأيام المتبقية حتى الانتهاء (سالب = منتهية) */
export function daysUntil(iso?: string): number | null {
  const d = parse(iso || '');
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/** يطابق الدفعات مع المخزون الحالي: ما بيع يُخصم من الأقدم أولاً، وتُحذف الدفعات المستهلكة */
export function reconcileBatches(batches: ExpiryBatch[] | undefined, stock: number): ExpiryBatch[] {
  const list = [...(batches || [])].sort((a, b) => a.addedAt.localeCompare(b.addedAt)).map(b => ({ ...b }));
  const total = list.reduce((sum, b) => sum + b.qty, 0);
  let deficit = Math.round((total - Math.max(0, stock)) * 1000) / 1000;
  for (const b of list) {
    if (deficit <= 0) break;
    const take = Math.min(b.qty, deficit);
    b.qty = Math.round((b.qty - take) * 1000) / 1000;
    deficit = Math.round((deficit - take) * 1000) / 1000;
  }
  return list.filter(b => b.qty > 0);
}

/** إضافة دفعة جديدة، مع دمجها بدفعة موجودة لها التاريخان نفسهما */
export function addBatch(batches: ExpiryBatch[], qty: number, productionDate: string, expiryDate: string): ExpiryBatch[] {
  if (!(qty > 0)) return batches;
  const same = batches.find(b => (b.productionDate || '') === productionDate && (b.expiryDate || '') === expiryDate);
  if (same) return batches.map(b => (b === same ? { ...b, qty: b.qty + qty } : b));
  return [...batches, {
    id: 'bt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    qty,
    ...(productionDate ? { productionDate } : {}),
    ...(expiryDate ? { expiryDate } : {}),
    addedAt: new Date().toISOString(),
  }];
}

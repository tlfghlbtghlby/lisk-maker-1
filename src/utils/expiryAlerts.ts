import type { Product } from '../types';
import { daysUntil } from './expiry';

export interface ExpiryAlert {
  product: Product;
  /** أقرب تاريخ انتهاء بين الدفعات التي ما زالت فيها كمية */
  expiryDate: string;
  /** أيام متبقية (سالب = منتهية) */
  days: number;
  /** الكمية المعنية (كمية الدفعة الأقرب، أو كل المخزون لمادة بلا دفعات) */
  qty: number;
}

/**
 * المواد التي انتهت صلاحيتها أو قاربت (days <= warnDays). تُستعمل الدفعات إن وُجدت (الأقدم صلاحية أولاً)،
 * وإلا تاريخ المادة نفسه. لا تُحتسب المواد ذات المخزون الصفري.
 */
export function getExpiryAlerts(products: Product[], warnDays = 30): ExpiryAlert[] {
  const out: ExpiryAlert[] = [];
  for (const p of products || []) {
    if (!(p.stock > 0)) continue;
    let best: { date: string; days: number; qty: number } | null = null;
    const batches = (p.expiryBatches || []).filter(b => b.qty > 0 && b.expiryDate);
    if (batches.length) {
      for (const b of batches) {
        const d = daysUntil(b.expiryDate);
        if (d === null) continue;
        if (!best || d < best.days) best = { date: b.expiryDate as string, days: d, qty: b.qty };
      }
    } else if (p.expiryDate) {
      const d = daysUntil(p.expiryDate);
      if (d !== null) best = { date: p.expiryDate, days: d, qty: p.stock };
    }
    if (best && best.days <= warnDays) out.push({ product: p, expiryDate: best.date, days: best.days, qty: best.qty });
  }
  return out.sort((a, b) => a.days - b.days);
}

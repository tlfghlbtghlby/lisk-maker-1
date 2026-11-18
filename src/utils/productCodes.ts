import type { Product } from '../types';

/** كل باركودات المادة: الأساسي ثم الإضافية (بدون تكرار أو فراغ). */
export function allCodes(p: Pick<Product, 'code' | 'extraCodes'>): string[] {
  const out: string[] = [];
  for (const c of [p.code, ...(p.extraCodes || [])]) {
    const t = String(c ?? '').trim();
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/** كل المواد التي يطابق أحد باركوداتها الرمز المعطى (قد تكون أكثر من مادة لنفس الباركود). */
export function productsByCode<T extends Pick<Product, 'code' | 'extraCodes'>>(products: T[], code: string): T[] {
  const c = String(code ?? '').trim().toLowerCase();
  if (!c) return [];
  return products.filter((p) => allCodes(p).some((x) => x.toLowerCase() === c));
}

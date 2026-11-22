import { supabase } from '../supabase';

export interface CatalogOffer {
  buyQty: number;
  discountType: 'amount' | 'percent';
  discountValue: number;
  discountScope?: 'per_piece' | 'total';
  discountRepeat?: boolean;
  stores?: number;
}
export interface CatalogHit {
  barcode: string;
  name: string;
  category?: string | null;
  unit?: string | null;
  pieces_per_carton?: number | null;
  cost_price?: number | null;
  retail_price?: number | null;
  offers?: CatalogOffer[];
  stores_count?: number;
}

const num = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));
const clean = (r: any): CatalogHit => ({
  ...r,
  cost_price: num(r.cost_price),
  retail_price: num(r.retail_price),
  pieces_per_carton: num(r.pieces_per_carton),
  offers: Array.isArray(r.offers) ? r.offers : [],
});

/** الكتالوج المشترك بين المتاجر (مجمَّع بلا هوية متجر) — البحث بالباركود */
export async function catalogLookup(barcode: string): Promise<CatalogHit | null> {
  try {
    const { data, error } = await (supabase as any).rpc('catalog_lookup', { p_barcode: barcode.trim() });
    if (error || !Array.isArray(data) || !data[0]) return null;
    return clean(data[0]);
  } catch {
    return null;
  }
}

/** بحث جزئي بالاسم (بداية الاسم أو وسطه) */
export async function catalogSearch(q: string, limit = 8): Promise<CatalogHit[]> {
  try {
    const { data, error } = await (supabase as any).rpc('catalog_search', { p_q: q.trim(), p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return data.map(clean);
  } catch {
    return [];
  }
}

export interface CatalogPrices { retail_max: number | null; retail_min: number | null; cost_max: number | null; cost_min: number | null; stores: number; }

/** نطاق أسعار باركود في الكتالوج المشترك (أعلى/أقل سعر بين المحلات). null إن لم توجد أسعار أو الدالة غير مفعّلة بعد */
export async function catalogPrices(barcode: string): Promise<CatalogPrices | null> {
  try {
    const { data, error } = await (supabase as any).rpc('catalog_prices', { p_barcode: barcode.trim() });
    if (error || !Array.isArray(data) || !data[0]) return null;
    const r = data[0];
    const out = { retail_max: num(r.retail_max), retail_min: num(r.retail_min), cost_max: num(r.cost_max), cost_min: num(r.cost_min), stores: Number(r.stores) || 0 };
    return out.retail_max == null && out.cost_max == null ? null : out;
  } catch {
    return null;
  }
}

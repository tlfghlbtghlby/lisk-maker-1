import { supabaseUrl, supabaseAnonKey } from '../supabase';
import { resizeImageFile } from './imageResize';
import type { Product } from '../types';

export type ScanUnit = 'piece' | 'dozen' | 'carton' | 'kg' | 'other';

export interface ScanItem {
  name: string;
  quantity: number;
  unit: ScanUnit;
  unitPrice?: number;
  lineTotal?: number;
  barcode?: string;
  expiryDate?: string;
  confidence: number;
}

export interface ScanResult {
  items: ScanItem[];
  invoiceTotal?: number;
  documentType?: string;
}

const ERRORS: Record<string, string> = {
  no_api_key: 'ميزة قراءة الصور غير مفعّلة بعد على الخادم (لم يُضَف مفتاح Gemini). راجع صاحب النظام.',
  store_limit: 'بلغت الحد اليومي لقراءة الصور لهذا المتجر. حاول غداً أو أضف المواد يدوياً.',
  global_limit: 'بلغ النظام الحد العام لقراءة الصور حالياً. حاول لاحقاً.',
  disabled: 'ميزة قراءة الصور متوقفة حالياً من الإدارة.',
  provider_rate_limited: 'خدمة القراءة مشغولة الآن (حد الطبقة المجانية). انتظر دقيقة وأعد المحاولة.',
  image_too_large: 'الصورة كبيرة جداً. التقط صورة أصغر.',
  no_image: 'لم تصل الصورة. أعد المحاولة.',
  unreadable_response: 'تعذرت قراءة الصورة. جرّب صورة أوضح وإضاءة أفضل.',
  model_unavailable: 'نموذج القراءة غير متاح حالياً. حاول لاحقاً.',
  provider_error: 'حدث خطأ في خدمة القراءة. حاول لاحقاً.',
};

/** يصغّر الصورة ويرسلها لدالة القراءة ويعيد المواد المقروءة (تحتاج دائماً لمراجعة بشرية) */
export async function scanImageFile(file: File, storeId: string): Promise<ScanResult> {
  const dataUrl = await resizeImageFile(file, 1800, 0.85);
  const image = dataUrl.split(',')[1] || '';
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/scan-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
      body: JSON.stringify({ image, mime: 'image/jpeg', storeId }),
    });
  } catch {
    throw new Error('تعذر الاتصال بالإنترنت. تحقق من الاتصال وأعد المحاولة.');
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok || !data || !Array.isArray(data.items)) {
    throw new Error(ERRORS[data?.error] || `تعذرت قراءة الصورة (${res.status}).`);
  }
  return { items: data.items as ScanItem[], invoiceTotal: data.invoiceTotal, documentType: data.documentType };
}

// ---------------- مطابقة الأسماء مع المخزون ----------------
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/[ً-ٰٟـ]/g, '') // التشكيل والتطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const trigrams = (s: string): Set<string> => {
  const t = s.replace(/\s/g, '');
  const out = new Set<string>();
  if (t.length < 3) { if (t) out.add(t); return out; }
  for (let i = 0; i <= t.length - 3; i++) out.add(t.slice(i, i + 3));
  return out;
};
const dice = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((x) => { if (b.has(x)) inter++; });
  return (2 * inter) / (a.size + b.size);
};
const numTokens = (s: string) => s.split(' ').filter((t) => /^\d+$/.test(t));

export type MatchLevel = 'exact' | 'strong' | 'possible' | 'none';
export interface MatchCandidate { product: Product; score: number; }
export interface MatchResult { level: MatchLevel; best?: Product; candidates: MatchCandidate[]; }

export function scoreNames(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = na.split(' ');
  const tb = nb.split(' ');
  const setB = new Set(tb);
  const setA = new Set(ta);
  const coverA = ta.filter((t) => setB.has(t)).length / ta.length;
  const coverB = tb.filter((t) => setA.has(t)).length / tb.length;
  const tri = dice(trigrams(na), trigrams(nb));
  let score = 0.45 * tri + 0.55 * ((coverA + coverB) / 2);
  const da = numTokens(na).join(',');
  const db = numTokens(nb).join(',');
  // اختلاف الأرقام (الحجم/الوزن مثل 250 مقابل 500) يعني غالباً منتجاً مختلفاً
  if (da && db && da !== db) score *= 0.6;
  else if ((da && !db) || (!da && db)) score *= 0.85;
  return score;
}

/** يطابق مادة مقروءة مع مخزون المتجر. لا يُعتبر التطابق مؤكداً إلا إذا كان قوياً جداً */
export function matchProduct(item: { name: string; barcode?: string }, products: Product[]): MatchResult {
  if (item.barcode) {
    const hit = products.find((p) => String(p.code || '').trim() === item.barcode);
    if (hit) return { level: 'exact', best: hit, candidates: [{ product: hit, score: 1 }] };
  }
  const scored = products
    .map((p) => ({ product: p, score: scoreNames(item.name, p.name) }))
    .filter((c) => c.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (!scored.length) return { level: 'none', candidates: [] };
  const top = scored[0];
  const second = scored[1];
  const clear = !second || top.score - second.score >= 0.08;
  if (top.score >= 0.9 && clear) return { level: 'strong', best: top.product, candidates: scored };
  if (top.score >= 0.5) return { level: 'possible', candidates: scored };
  return { level: 'none', candidates: scored };
}

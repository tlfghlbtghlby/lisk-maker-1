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
  supplierName?: string;
  documentType?: string;
}

const ERRORS: Record<string, string> = {
  no_api_key: 'ميزة قراءة الصور غير مفعّلة بعد على الخادم (لم يُضَف مفتاح Gemini). راجع صاحب النظام.',
  store_limit: 'بلغت الحد اليومي لقراءة الصور لهذا المتجر. حاول غداً أو أضف المواد يدوياً.',
  global_limit: 'بلغ النظام الحد العام لقراءة الصور حالياً. حاول لاحقاً.',
  store_disabled: 'تم إيقاف ميزة قراءة الصور لحسابك من الإدارة.',
  disabled: 'ميزة قراءة الصور متوقفة حالياً من الإدارة.',
  provider_rate_limited: 'خدمة القراءة مشغولة الآن (حد الطبقة المجانية). انتظر دقيقة وأعد المحاولة.',
  image_too_large: 'الصورة كبيرة جداً. التقط صورة أصغر.',
  no_image: 'لم تصل الصورة. أعد المحاولة.',
  unreadable_response: 'تعذرت قراءة الصورة. جرّب صورة أوضح وإضاءة أفضل.',
  model_unavailable: 'نموذج القراءة غير متاح حالياً. حاول لاحقاً.',
  provider_busy: 'خدمة Gemini مشغولة الآن (ازدحام مؤقت عندهم). انتظر دقيقة وأعد المحاولة.',
  provider_error: 'حدث خطأ في خدمة القراءة. حاول لاحقاً.',
};

/** إرسال JSON عبر XHR لمعرفة لحظة اكتمال الرفع (fetch لا يعطي ذلك) */
function postJson(url: string, headers: Record<string, string>, body: string, timeoutMs: number, onProgress: (pct: number) => void, onUploaded: () => void): Promise<{ status: number; ok: boolean; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && e.total > 0) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
    xhr.upload.onload = () => onUploaded();
    xhr.onload = () => {
      let data: any = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, data });
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(body);
  });
}

/** يصغّر الصورة ويرسلها لدالة القراءة ويعيد المواد المقروءة (تحتاج دائماً لمراجعة بشرية) */
export async function scanImageFile(file: File, storeId: string, onStatus?: (m: string) => void): Promise<ScanResult> {
  // صورة أصغر = رفع أسرع على الاتصال البطيء. 1400px تكفي لقراءة القوائم.
  const dataUrl = await resizeImageFile(file, 1400, 0.72);
  const image = dataUrl.split(',')[1] || '';
  const body = JSON.stringify({ image, mime: 'image/jpeg', storeId });
  const kb = Math.round(body.length / 1024);
  let res: { status: number; ok: boolean; data: any } | null = null;
  let lastErr = '';
  for (let attempt = 1; attempt <= 2 && !res; attempt++) {
    onStatus?.(attempt === 1 ? `جارٍ رفع الصورة (${kb} KB)...` : 'الاتصال بطيء، إعادة رفع الصورة...');
    try {
      res = await postJson(`${supabaseUrl}/functions/v1/scan-items`, { 'Content-Type': 'application/json', apikey: supabaseAnonKey }, body, 130000,
        (pct) => onStatus?.(`جارٍ رفع الصورة (${kb} KB): ${pct}%`),
        () => onStatus?.('✓ تم رفع الصورة، جارٍ القراءة بالذكاء الاصطناعي...'));
    } catch (e: any) {
      lastErr = e?.message === 'timeout' ? 'timeout' : 'network';
    }
  }
  if (!res) {
    throw new Error(lastErr === 'timeout'
      ? 'انتهت المهلة. الاتصال بطيء أو أن خدمة القراءة مشغولة: جرّب مرة أخرى أو صورة أصغر.'
      : 'تعذر الاتصال بخادم القراءة. تحقق من الاتصال وأعد المحاولة.');
  }
  const data: any = res.data;
  if (!res.ok || !data || !Array.isArray(data.items)) {
    const base = ERRORS[data?.error] || `تعذرت قراءة الصورة (${res.status}).`;
    throw new Error(data?.error === 'provider_error' ? `${base} (رمز ${data?.status ?? ''})` : base);
  }
  return { items: data.items as ScanItem[], invoiceTotal: data.invoiceTotal, supplierName: data.supplierName, documentType: data.documentType };
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
  // نفس الاسم بفراغات مختلفة أو بدونها (حب الشمس 250 = حبالشمس250)
  const ca = na.replace(/ /g, '');
  const cb = nb.replace(/ /g, '');
  if (ca === cb) return 1;
  const ta = na.split(' ');
  const tb = nb.split(' ');
  const setB = new Set(tb);
  const setA = new Set(ta);
  // الكلمة تُعدّ موجودة إن وردت كلمة بنفس الشكل أو داخل النص الآخر بلا فراغات (الأرقام تُطابَق كاملة)
  const has = (t: string, set: Set<string>, compact: string) => (/^\d+$/.test(t) ? set.has(t) : set.has(t) || (t.length >= 2 && compact.includes(t)));
  const coverA = ta.filter((t) => has(t, setB, cb)).length / ta.length;
  const coverB = tb.filter((t) => has(t, setA, ca)).length / tb.length;
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

/** مفتاح تذكّر اسم المادة عند المورد (أو '*' لأي مورد) */
export const aliasKey = (supplierId: string, name: string) => `${supplierId || '*'}|${normalizeName(name).replace(/ /g, '')}`;
/** المفتاح القديم (بفراغات) للتوافق مع ما حُفظ سابقاً */
export const aliasKeyLegacy = (supplierId: string, name: string) => `${supplierId || '*'}|${normalizeName(name)}`;
/** يبحث عن المادة المحفوظة لهذا الاسم عند المورد ثم عند أي مورد، بالمفتاحين الجديد والقديم */
export const aliasLookup = (aliases: Record<string, string>, supplierId: string, name: string): string | undefined =>
  aliases[aliasKey(supplierId, name)] || aliases[aliasKeyLegacy(supplierId, name)] || aliases[aliasKey('', name)] || aliases[aliasKeyLegacy('', name)];

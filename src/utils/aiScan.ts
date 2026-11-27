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
  /** ترتيب السطر في القائمة والنص الخام كما قُرئ */
  line?: number;
  raw?: string;
}

export interface PrintedRow { cells: string[]; isHeader?: boolean }

export interface ScanResult {
  items: ScanItem[];
  invoiceTotal?: number;
  supplierName?: string;
  documentType?: string;
}

const ERRORS: Record<string, string> = {
  no_api_key: 'ميزة قراءة الصور غير مفعّلة بعد على الخادم (لم يُضَف مفتاح Gemini). راجع صاحب النظام.',
  store_limit: 'بلغت الحد اليومي لقراءة الصور لهذا المتجر. استخدم «الطريقة اليدوية» أسفل الشاشة (بلا حد) أو حاول غداً.',
  global_limit: 'بلغ النظام الحد العام لقراءة الصور حالياً. استخدم «الطريقة اليدوية» أسفل الشاشة (بلا حد) أو حاول لاحقاً.',
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
export async function scanImageFile(file: File, storeId: string, onStatus?: (m: string) => void, printed = false): Promise<ScanResult> {
  // صورة أصغر = رفع أسرع على الاتصال البطيء. 1400px تكفي لقراءة القوائم.
  const dataUrl = await resizeImageFile(file, 1400, 0.72);
  const image = dataUrl.split(',')[1] || '';
  const body = JSON.stringify({ image, mime: 'image/jpeg', storeId, ...(printed ? { printed: true } : {}) });
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
  if (printed && res.ok && data && Array.isArray(data.rows)) {
    const items = parsePrintedRows(data.rows as PrintedRow[]);
    return { items, invoiceTotal: data.invoiceTotal, supplierName: data.supplierName, documentType: data.documentType };
  }
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


// ---------------- فرز القائمة المطبوعة (يقوم به البرنامج) ----------------
const toNum = (t: string): number | undefined => {
  const c = (t || '').replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[٬,\s]/g, '').replace(/٫/g, '.');
  if (!/^-?\d+(\.\d+)?$/.test(c)) return undefined;
  const n = parseFloat(c);
  return Number.isFinite(n) ? n : undefined;
};
const HDR = {
  total: ['مبلغ', 'مجموع', 'اجمالي', 'total', 'amount'],
  price: ['سعر', 'مفرد', 'افرادي', 'price', 'rate'],
  qty: ['عدد', 'كميه', 'qty', 'quantity'],
  name: ['ماده', 'صنف', 'بيان', 'تفاصيل', 'اسم', 'item', 'description', 'name'],
  unit: ['وحده', 'unit'],
  barcode: ['باركود', 'barcode'],
} as const;
const SUMMARY = /(المجموع|الاجمالي|الإجمالي|اجمالي|المبلغ الكلي|الصافي|total|خصم|المستحق)/i;
const unitFromText = (t: string): ScanUnit | undefined => {
  const n = normalizeName(t);
  if (/درزن|دزينه/.test(n)) return 'dozen';
  if (/كارتون|كرتون|صندوق|كارتونه|كرتونه/.test(n)) return 'carton';
  if (/كغم|كيلو|كلغ|kg/.test(n)) return 'kg';
  if (/قطعه|حبه|حبة/.test(n)) return 'piece';
  return undefined;
};
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.01);

/** يحوّل صفوف الجدول المنسوخة حرفياً إلى مواد: يحدد الأعمدة من العناوين، وإلا بالتخمين الحسابي (العدد × السعر = المجموع) */
export function parsePrintedRows(rows: PrintedRow[]): ScanItem[] {
  const clean = rows.map((r) => ({ cells: (r.cells || []).map((c) => (c || '').trim()), isHeader: !!r.isHeader })).filter((r) => r.cells.some(Boolean));
  // صف العناوين
  let hdrIdx = clean.findIndex((r) => r.isHeader);
  if (hdrIdx < 0) hdrIdx = clean.findIndex((r) => {
    const roles = new Set<string>();
    r.cells.forEach((c) => { const n = normalizeName(c); (Object.keys(HDR) as (keyof typeof HDR)[]).forEach((k) => { if (HDR[k].some((w) => n.includes(w))) roles.add(k); }); });
    return roles.size >= 2;
  });
  const col: Partial<Record<keyof typeof HDR, number>> = {};
  if (hdrIdx >= 0) {
    clean[hdrIdx].cells.forEach((c, i) => {
      const n = normalizeName(c);
      for (const k of ['total', 'price', 'qty', 'unit', 'barcode', 'name'] as (keyof typeof HDR)[]) {
        if (col[k] === undefined && HDR[k].some((w) => n.includes(w))) { col[k] = i; break; }
      }
    });
  }
  const hdrLen = hdrIdx >= 0 ? clean[hdrIdx].cells.length : 0;
  const useCols = col.name !== undefined && (col.qty !== undefined || col.total !== undefined);
  const data = clean.filter((_, i) => i !== hdrIdx).filter((r) => !r.isHeader);
  const out: ScanItem[] = [];
  let ord = 0;
  for (const r of data) {
    const joined = r.cells.join(' ');
    if (SUMMARY.test(joined) && !r.cells.some((c) => /\p{L}{3,}/u.test(c) && !SUMMARY.test(c))) continue;
    ord++;
    let name = '', qty: number | undefined, price: number | undefined, total: number | undefined, unit: ScanUnit | undefined, barcode: string | undefined;
    let conf = 0.7;
    if (useCols && r.cells.length === hdrLen) {
      name = r.cells[col.name!] || '';
      qty = col.qty !== undefined ? toNum(r.cells[col.qty]) : undefined;
      price = col.price !== undefined ? toNum(r.cells[col.price]) : undefined;
      total = col.total !== undefined ? toNum(r.cells[col.total]) : undefined;
      unit = (col.unit !== undefined ? unitFromText(r.cells[col.unit]) : undefined) || (col.qty !== undefined ? unitFromText(r.cells[col.qty]) : undefined);
      if (col.barcode !== undefined) { const b = (r.cells[col.barcode] || '').replace(/\D/g, ''); if (b.length >= 6) barcode = b; }
      conf = 0.92;
    } else {
      // تخمين: أطول خلية فيها حروف = الاسم، والأرقام الباقية تُحلَّل حسابياً
      const textCells = r.cells.map((c, i) => ({ c, i })).filter(({ c }) => /\p{L}{2,}/u.test(c) && toNum(c) === undefined);
      const nameCell = textCells.sort((a, b) => b.c.length - a.c.length)[0];
      if (!nameCell) continue;
      name = nameCell.c;
      let nums = r.cells.map((c) => toNum(c)).filter((n): n is number => n !== undefined);
      // تجاهل رقم التسلسل (1،2،3...) إن وُجد مع ثلاثة أرقام أو أكثر
      if (nums.length >= 3 && nums[0] === ord) nums = nums.slice(1);
      else if (nums.length >= 3 && nums[nums.length - 1] === ord) nums = nums.slice(0, -1);
      for (const c of r.cells) { const b = c.replace(/\D/g, ''); if (b.length >= 8 && toNum(c) !== undefined) { barcode = b; nums = nums.filter((n) => String(n) !== b); } }
      unit = r.cells.map(unitFromText).find(Boolean);
      let found = false;
      for (let a = 0; a < nums.length && !found; a++) for (let b = 0; b < nums.length && !found; b++) for (let c = 0; c < nums.length && !found; c++) {
        if (a === b || b === c || a === c) continue;
        if (nums[a] > 0 && nums[b] > 0 && near(nums[a] * nums[b], nums[c])) { qty = nums[a]; price = nums[b]; total = nums[c]; found = true; conf = 0.85; }
      }
      if (!found) {
        qty = nums[0]; if (nums.length >= 2) price = nums[1]; conf = 0.55;
      }
    }
    name = name.trim();
    if (!name || !(qty && qty > 0)) { if (name && /\p{L}{3,}/u.test(name) && qty === undefined) { qty = 1; conf = 0.4; } else continue; }
    // اتساق العدد × السعر = المجموع
    if (qty && price && total && !near(qty * price, total)) conf = Math.min(conf, 0.5);
    out.push({
      name, quantity: qty!, unit: unit || 'piece',
      ...(price !== undefined ? { unitPrice: price } : {}),
      ...(total !== undefined ? { lineTotal: total } : {}),
      ...(barcode ? { barcode } : {}),
      confidence: conf, line: out.length + 1, raw: r.cells.filter(Boolean).join(' | ').slice(0, 300),
    });
  }
  return out;
}

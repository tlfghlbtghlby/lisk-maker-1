import { supabase, supabaseUrl, supabaseAnonKey } from '../supabase';

export type LookupPreference = 'global' | 'community';

export interface AutoLookupResult {
  name: string;
  category: string;
  source: 'community' | 'global' | 'web';
  /** false إذا تعذرت الترجمة وبقي الاسم بلغته الأصلية (يحتاج مراجعة المستخدم) */
  translated?: boolean;
  /** عدد القطع في الكرتون إن وُجد مكتوباً في نتائج البحث (طريقة البحث في جوجل فقط) */
  piecesPerCarton?: number;
}

const LATIN = /[A-Za-z]/g;
const ARABIC = /[\u0600-\u06FF]/g;
const count = (t: string, re: RegExp) => (t.match(re) || []).length;

/** توحيد وحدات الحجم/الوزن إلى العربية المتداولة في السوق العراقي (قبل الترجمة وبعدها) */
export function normalizeUnits(text: string): string {
  return text
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:ml|mL|ML|Ml|مللي(?:لتر)?)(?![A-Za-z\u0600-\u06FF])/g, '$1 مل')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:kg|KG|Kg|kgs|كيلو\s*غرام|كيلوغرام|كيلو)(?![A-Za-z\u0600-\u06FF])/g, '$1 كغم')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:grams?|gms?|gr|g|G|غرام|جرام)(?![A-Za-z\u0600-\u06FF])/g, '$1 غم')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:liters?|litres?|ltr|lt|l|L)(?![A-Za-z\u0600-\u06FF])/g, '$1 لتر')
    .replace(/(\d+)\s*(?:pcs|pc|pieces?)(?![A-Za-z\u0600-\u06FF])/gi, '$1 قطعة')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function viaGoogle(text: string): Promise<string | null> {
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`);
    if (!res.ok) return null;
    const data = await res.json();
    // الرد مقسّم لأجزاء: نجمعها كلها (الجملة الطويلة تأتي على عدة قطع)
    const parts: string[] = Array.isArray(data?.[0]) ? data[0].map((x: any) => (x && x[0]) || '') : [];
    const out = parts.join('').trim();
    return out || null;
  } catch { return null; }
}

async function viaMyMemory(text: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`);
    if (!res.ok) return null;
    const data = await res.json();
    const out = String(data?.responseData?.translatedText || '').trim();
    return out && !/MYMEMORY WARNING|INVALID/i.test(out) ? out : null;
  } catch { return null; }
}

/** هل النص عربي فعلاً؟ (الأحرف اللاتينية القليلة المتبقية كعلامة تجارية لا تمنع ذلك) */
function isMostlyArabic(t: string): boolean {
  const a = count(t, ARABIC), l = count(t, LATIN);
  return a > 0 && l <= a * 0.35;
}

/**
 * يضمن اسماً عربياً: يترجم كل نص فيه أحرف لاتينية (حتى لو اختلط بعربي)، يجرب خدمة ثانية عند الفشل،
 * ثم يوحّد الوحدات (مل/لتر/غم/كغم). translated=false إذا بقي الاسم أجنبياً.
 */
export async function ensureArabic(text: string): Promise<{ text: string; translated: boolean }> {
  const src = normalizeUnits((text || '').trim());
  if (!src) return { text: src, translated: true };
  if (count(src, LATIN) === 0) return { text: src, translated: true };
  if (isMostlyArabic(src)) return { text: src, translated: true };
  for (const fn of [viaGoogle, viaMyMemory]) {
    const out = await fn(src);
    if (out && isMostlyArabic(out)) return { text: normalizeUnits(out), translated: true };
  }
  return { text: src, translated: false };
}

// للتوافق مع الاستعمالات القديمة
async function translateToArabic(text: string): Promise<string> {
  return (await ensureArabic(text)).text;
}

// الطريقة الثالثة: بحث جوجل عبر دالة Supabase (Gemini + Google Search) مع ترجمة الاسم الكامل
async function fetchFromWebSearch(code: string, storeId: string): Promise<{ name: string; category: string; original: string; piecesPerCarton?: number } | null> {
  if (!supabaseUrl) return null;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/barcode-web-lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
      body: JSON.stringify({ barcode: code, storeId }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.found && d.name) return { name: String(d.name), category: String(d.category || ''), original: String(d.original || ''), piecesPerCarton: Number(d.piecesPerCarton) > 1 ? Math.floor(Number(d.piecesPerCarton)) : undefined };
  } catch (err) {
    console.warn('Web lookup error:', err);
  }
  return null;
}

// استعلام قواعد البيانات العالمية المفتوحة الخمس
async function fetchFromGlobalDatabases(barcode: string): Promise<{ name: string; category: string } | null> {
  const cleanCode = barcode.trim();

  const queryOpenFood = async () => {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanCode}.json`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_ar || p.product_name || p.generic_name || '';
      const cat = p.categories_tags?.[0]?.replace(/^[a-z]{2}:/, '') || 'مواد غذائية';
      if (name) return { name, category: cat };
    }
    throw new Error();
  };

  const queryOpenBeauty = async () => {
    const res = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${cleanCode}.json`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_ar || p.product_name || '';
      const cat = p.categories_tags?.[0]?.replace(/^[a-z]{2}:/, '') || 'كوزمتك وعناية شخصية';
      if (name) return { name, category: cat };
    }
    throw new Error();
  };

  const queryOpenProducts = async () => {
    const res = await fetch(`https://world.openproductsfacts.org/api/v0/product/${cleanCode}.json`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_ar || p.product_name || '';
      const cat = 'أدوات ومنزليات';
      if (name) return { name, category: cat };
    }
    throw new Error();
  };

  const queryGoogleBooks = async () => {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanCode}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.totalItems > 0 && data.items?.[0]?.volumeInfo) {
      const info = data.items[0].volumeInfo;
      const name = info.title + (info.subtitle ? ` - ${info.subtitle}` : '');
      const cat = 'كتب وقرطاسية';
      if (name) return { name, category: cat };
    }
    throw new Error();
  };

  try {
    return await Promise.any([
      queryOpenFood(),
      queryOpenBeauty(),
      queryOpenProducts(),
      queryGoogleBooks()
    ]);
  } catch {
    return null;
  }
}

// دالة مساعدة لاستخراج المادة من كائن البيانات المشترك في Supabase
function findProductInRecord(record: any, cleanCode: string): { name: string; category: string } | null {
  if (!record) return null;
  const payload = record.data || record.content || record.value || record;
  const products = payload?.products || (Array.isArray(payload) ? payload : null);

  if (Array.isArray(products)) {
    const item = products.find(
      (p: any) => p && String(p.code || '').trim() === cleanCode && p.name && String(p.name).trim() !== ''
    );
    if (item) {
      return {
        name: String(item.name).trim(),
        category: item.category ? String(item.category).trim() : 'عام'
      };
    }
  }
  return null;
}

// استعلام شبكة المتاجر الأخرى عبر Supabase
async function fetchFromCommunityDatabase(cleanCode: string): Promise<{ name: string; category: string } | null> {
  if (!supabase) return null;
  try {
    // 1. فحص جدول documents
    const { data: docs, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .limit(50);

    if (!docErr && docs && docs.length > 0) {
      for (const row of docs) {
        const match = findProductInRecord(row, cleanCode);
        if (match) return match;
      }
    }

    // 2. فحص جدول app_data الاحتياطي
    const { data: appData, error: appErr } = await supabase
      .from('app_data')
      .select('*')
      .limit(50);

    if (!appErr && appData && appData.length > 0) {
      for (const row of appData) {
        const match = findProductInRecord(row, cleanCode);
        if (match) return match;
      }
    }
  } catch (err) {
    console.warn('Community lookup error:', err);
  }
  return null;
}

// الدالة الرئيسية: تبحث بالأولوية المختارة وإذا لم تجد المادة تنتقل تلقائياً للخيار الآخر
export async function lookupProductDetails(
  barcode: string,
  preference: LookupPreference = 'global',
  storeId: string = 'offline_store'
): Promise<AutoLookupResult | null> {
  const cleanCode = barcode.trim();
  if (!cleanCode) return null;

  // دالة مساعدة لتنفيذ البحث العالمي وترجمة النتيجة
  const doGlobalSearch = async (): Promise<AutoLookupResult | null> => {
    try {
      const globalResult = await fetchFromGlobalDatabases(cleanCode);
      if (globalResult && globalResult.name) {
        const [tn, translatedCat] = await Promise.all([
          ensureArabic(globalResult.name),
          translateToArabic(globalResult.category)
        ]);
        return {
          name: tn.text,
          category: translatedCat || 'عام',
          source: 'global',
          translated: tn.translated
        };
      }
    } catch (err) {
      console.warn('Global lookup error:', err);
    }
    return null;
  };

  // دالة مساعدة لتنفيذ البحث في المتاجر المشتركة
  const doCommunitySearch = async (): Promise<AutoLookupResult | null> => {
    try {
      const commResult = await fetchFromCommunityDatabase(cleanCode);
      if (commResult && commResult.name) {
        // أسماء المتاجر الأخرى قد تكون إنجليزية فقط: نضمن العربية دون المساس بما هو عربي
        const cn = count(commResult.name, ARABIC) === 0 ? await ensureArabic(commResult.name) : { text: commResult.name, translated: true };
        return {
          name: cn.text,
          category: commResult.category || 'عام',
          source: 'community',
          translated: cn.translated
        };
      }
    } catch (err) {
      console.warn('Community lookup error:', err);
    }
    return null;
  };

  // الحالتان: العالمية أولاً أو المتاجر أولاً، وإن فشلتا معاً نلجأ للطريقة الثالثة: بحث جوجل مع الترجمة
  const order = preference === 'global' ? [doGlobalSearch, doCommunitySearch] : [doCommunitySearch, doGlobalSearch];
  for (const step of order) {
    const r = await step();
    if (r) return r;
  }

  const web = await fetchFromWebSearch(cleanCode, storeId);
  if (web) {
    // الدالة تُرجع الاسم عربياً أصلاً؛ نتحقق منه ونصلحه إن جاء أجنبياً
    const w = await ensureArabic(web.name);
    return { name: w.text, category: web.category || 'عام', source: 'web', translated: w.translated, piecesPerCarton: web.piecesPerCarton };
  }

  return null;
}

import { supabase } from '../supabase';

export interface AutoLookupResult {
  name: string;
  category: string;
  source: 'community' | 'global';
}

// دالة سريعة للترجمة التلقائية للعربية إذا كان النص أجنبياً
async function translateToArabic(text: string): Promise<string> {
  if (!text || !text.trim()) return text;
  
  // إذا كان النص يحتوي بالفعل على حروف عربية لا نترجمه
  if (/[\u0600-\u06FF]/.test(text)) return text;

  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`
    );
    if (!res.ok) return text;
    const data = await res.json();
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0];
    }
  } catch (err) {
    console.warn('Translation fallback to original:', err);
  }
  return text;
}

// استعلام قواعد البيانات العالمية المفتوحة الخمس
async function fetchFromGlobalDatabases(barcode: string): Promise<{ name: string; category: string } | null> {
  const cleanCode = barcode.trim();

  // 1. Open Food Facts (أغذية ومشروبات)
  const queryOpenFood = async () => {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanCode}.json`);
    if (!res.ok) throw new Error('OFF not found');
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_ar || p.product_name || p.generic_name || '';
      const cat = p.categories_tags?.[0]?.replace(/^[a-z]{2}:/, '') || 'مواد غذائية';
      if (name) return { name, category: cat };
    }
    throw new Error('Not found in OFF');
  };

  // 2. Open Beauty Facts (كوزمتك وعناية شخصية)
  const queryOpenBeauty = async () => {
    const res = await fetch(`https://world.openbeautyfacts.org/api/v2/product/${cleanCode}.json`);
    if (!res.ok) throw new Error('OBF not found');
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_ar || p.product_name || '';
      const cat = p.categories_tags?.[0]?.replace(/^[a-z]{2}:/, '') || 'كوزمتك وعناية شخصية';
      if (name) return { name, category: cat };
    }
    throw new Error('Not found in OBF');
  };

  // 3. Open Products Facts (أدوات ومنزليات وعامة)
  const queryOpenProducts = async () => {
    const res = await fetch(`https://world.openproductsfacts.org/api/v0/product/${cleanCode}.json`);
    if (!res.ok) throw new Error('OPF not found');
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const name = p.product_name_ar || p.product_name || '';
      const cat = 'أدوات ومنزليات';
      if (name) return { name, category: cat };
    }
    throw new Error('Not found in OPF');
  };

  // 4. Google Books API (كتب وقرطاسية ومطبوعات ISBN)
  const queryGoogleBooks = async () => {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanCode}`);
    if (!res.ok) throw new Error('Books not found');
    const data = await res.json();
    if (data.totalItems > 0 && data.items?.[0]?.volumeInfo) {
      const info = data.items[0].volumeInfo;
      const name = info.title + (info.subtitle ? ` - ${info.subtitle}` : '');
      const cat = 'كتب وقرطاسية';
      if (name) return { name, category: cat };
    }
    throw new Error('Not found in Books');
  };

  try {
    const firstMatch = await Promise.any([
      queryOpenFood(),
      queryOpenBeauty(),
      queryOpenProducts(),
      queryGoogleBooks()
    ]);
    return firstMatch;
  } catch (error) {
    return null;
  }
}

// الدالة المجمعة: تبدأ بمتاجر المشتركين أولاً ثم العالمية مع الترجمة
export async function lookupProductDetails(barcode: string): Promise<AutoLookupResult | null> {
  const cleanCode = barcode.trim();
  if (!cleanCode) return null;

  // الخطوة 1: البحث في شبكة المتاجر الأخرى عبر Supabase
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('name, category')
        .eq('code', cleanCode)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].name && data[0].name.trim() !== '') {
        return {
          name: data[0].name.trim(),
          category: data[0].category || 'عام',
          source: 'community' // تم إيجادها من المتاجر الأخرى
        };
      }
    }
  } catch (err) {
    console.warn('Community lookup error:', err);
  }

  // الخطوة 2: إذا لم توجد لدى أي متجر، نبحث في القواعد المليونية العالمية ونترجمها
  try {
    const globalResult = await fetchFromGlobalDatabases(cleanCode);
    if (globalResult && globalResult.name) {
      const [translatedName, translatedCat] = await Promise.all([
        translateToArabic(globalResult.name),
        translateToArabic(globalResult.category)
      ]);

      return {
        name: translatedName,
        category: translatedCat || 'عام',
        source: 'global' // تم إيجادها عالمياً وترجمتها
      };
    }
  } catch (err) {
    console.warn('Global lookup error:', err);
  }

  return null;
}

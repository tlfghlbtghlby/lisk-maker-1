// التعرّف الذكي على أعمدة ملف المواد: اتجاه الجدول (أفقي/عمودي) وموقع كل حقل.

export type FieldKey =
  | 'name' | 'code' | 'category' | 'unit' | 'cost' | 'retail' | 'wholesale' | 'superWholesale' | 'special'
  | 'stock' | 'piecesPerCarton' | 'minStock' | 'notes' | 'productionDate' | 'expiryDate';

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'اسم المادة',
  code: 'الباركود / الرمز',
  category: 'التصنيف',
  unit: 'الوحدة',
  cost: 'سعر الشراء (التكلفة)',
  retail: 'سعر المفرد',
  wholesale: 'سعر الجملة',
  superWholesale: 'جملة الجملة',
  special: 'السعر الخاص',
  stock: 'الكمية / الرصيد',
  piecesPerCarton: 'عدد القطع بالكرتون',
  minStock: 'حد التنبيه',
  notes: 'ملاحظات',
  productionDate: 'تاريخ الإنتاج',
  expiryDate: 'تاريخ الانتهاء',
};

const SYNONYMS: Record<FieldKey, string[]> = {
  name: ['اسم المادة', 'اسم الصنف', 'اسم المنتج', 'اسم السلعة', 'الاسم', 'اسم', 'المادة', 'الصنف', 'المنتج', 'السلعة', 'البيان', 'التفاصيل', 'الوصف', 'name', 'item', 'product', 'description', 'title'],
  code: ['الباركود', 'باركود', 'رقم المادة', 'رقم الصنف', 'رمز المادة', 'رمز الصنف', 'الرمز', 'رمز', 'الكود', 'كود', 'barcode', 'code', 'sku', 'ean', 'upc', 'item no'],
  category: ['التصنيف', 'تصنيف', 'القسم', 'الفئة', 'فئة', 'المجموعة', 'category', 'group', 'department'],
  unit: ['الوحدة', 'وحدة', 'unit', 'uom'],
  cost: ['سعر الشراء', 'سعر التكلفة', 'سعر الكلفة', 'التكلفة', 'الكلفة', 'تكلفة', 'كلفة', 'سعر الشراء بالقطعة', 'شراء', 'cost', 'purchase price', 'buy price', 'buying'],
  retail: ['سعر المفرد', 'سعر البيع', 'سعر المبيع', 'سعر القطعة', 'المفرد', 'مفرد', 'البيع', 'السعر', 'retail', 'sale price', 'selling price', 'price'],
  wholesale: ['سعر الجملة', 'الجملة', 'جملة', 'wholesale'],
  superWholesale: ['جملة الجملة', 'سعر جملة الجملة', 'super wholesale'],
  special: ['السعر الخاص', 'سعر خاص', 'خاص', 'special'],
  stock: ['الكمية', 'الكميه', 'كمية', 'العدد', 'الرصيد', 'رصيد', 'المخزون', 'الموجود', 'المتوفر', 'stock', 'qty', 'quantity', 'balance', 'count', 'on hand'],
  piecesPerCarton: ['عدد القطع بالكرتون', 'القطع بالكرتون', 'قطع بالكرتون', 'عدد القطع', 'في الكرتون', 'بالكرتون', 'عدد الكرتون', 'pieces per carton', 'pack size', 'pack', 'per carton'],
  minStock: ['حد الطلب', 'حد التنبيه', 'الحد الادنى', 'الحد الأدنى', 'حد ادنى', 'min stock', 'minimum', 'reorder', 'min'],
  notes: ['ملاحظات', 'ملاحظه', 'ملاحظة', 'notes', 'note', 'remarks'],
  productionDate: ['تاريخ الانتاج', 'تاريخ الإنتاج', 'الانتاج', 'الإنتاج', 'production date', 'production', 'mfg', 'manufacture'],
  expiryDate: ['تاريخ الانتهاء', 'تاريخ انتهاء الصلاحيه', 'انتهاء الصلاحيه', 'الصلاحيه', 'الانتهاء', 'انتهاء', 'expiry date', 'expiry', 'expire', 'exp'],
};

export const normalizeText = (s: string): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const NORM_SYN: { field: FieldKey; syn: string }[] = [];
(Object.keys(SYNONYMS) as FieldKey[]).forEach(f => SYNONYMS[f].forEach(s => NORM_SYN.push({ field: f, syn: normalizeText(s) })));
NORM_SYN.sort((a, b) => b.syn.length - a.syn.length);

/** يطابق نص العنوان مع أنسب حقل (الأطول تطابقًا أولًا) */
export function matchHeader(raw: string): { field: FieldKey; score: number } | null {
  const h = normalizeText(raw);
  if (!h || h.length > 45) return null;
  const tokens = h.split(' ');
  for (const { field, syn } of NORM_SYN) {
    if (h === syn) return { field, score: 3 };
  }
  for (const { field, syn } of NORM_SYN) {
    if (syn.length <= 3) {
      if (tokens.includes(syn)) return { field, score: 1.5 };
    } else if (h.includes(syn)) {
      return { field, score: 2 };
    }
  }
  return null;
}

const isBlank = (v: unknown) => String(v ?? '').trim() === '';

export function cleanGrid(rows: string[][]): string[][] {
  const grid = rows.map(r => r.map(c => String(c ?? '').trim()));
  const nonEmptyRows = grid.filter(r => r.some(c => c !== ''));
  const width = Math.max(0, ...nonEmptyRows.map(r => r.length));
  const keepCols: number[] = [];
  for (let c = 0; c < width; c++) if (nonEmptyRows.some(r => !isBlank(r[c]))) keepCols.push(c);
  return nonEmptyRows.map(r => keepCols.map(c => r[c] ?? ''));
}

export const transpose = (g: string[][]): string[][] => {
  const w = Math.max(0, ...g.map(r => r.length));
  return Array.from({ length: w }, (_, c) => g.map(r => r[c] ?? ''));
};

interface HeaderScan { index: number; hits: number; map: Partial<Record<FieldKey, number>>; }

function scanHeaders(g: string[][], limit = 30): HeaderScan {
  let best: HeaderScan = { index: -1, hits: 0, map: {} };
  for (let i = 0; i < Math.min(g.length, limit); i++) {
    const map: Partial<Record<FieldKey, number>> = {};
    const scores: Partial<Record<FieldKey, number>> = {};
    g[i].forEach((cell, c) => {
      const m = matchHeader(cell);
      if (!m) return;
      if ((scores[m.field] ?? 0) < m.score) { map[m.field] = c; scores[m.field] = m.score; }
    });
    const hits = Object.keys(map).length;
    if (hits > best.hits || (hits === best.hits && hits > 0 && i < best.index)) best = { index: i, hits, map };
  }
  return best;
}

const toNumber = (s: string): number | null => {
  if (isBlank(s)) return null;
  const t = normalizeDigits(String(s)).replace(/[,٬،\s]/g, '').replace(/[^\d.\-]/g, '');
  if (!t || t === '-' || t === '.') return null;
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
};

export function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.');
}

/** تخمين الأعمدة عند غياب العناوين اعتمادًا على محتوى كل عمود */
function inferWithoutHeaders(g: string[][]): Partial<Record<FieldKey, number>> {
  const sample = g.slice(0, 40);
  const width = Math.max(0, ...sample.map(r => r.length));
  const cols = Array.from({ length: width }, (_, c) => sample.map(r => r[c] ?? '').filter(v => !isBlank(v)));
  const stats = cols.map((vals, c) => {
    const nums = vals.map(toNumber).filter((n): n is number => n !== null);
    const numRatio = vals.length ? nums.length / vals.length : 0;
    const digitsOnly = vals.length > 0 && vals.every(v => /^\d{6,14}$/.test(normalizeDigits(v).replace(/\s/g, '')));
    const unique = new Set(vals).size / Math.max(1, vals.length);
    const avgLen = vals.reduce((s, v) => s + v.length, 0) / Math.max(1, vals.length);
    const sorted = [...nums].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    return { c, numRatio, digitsOnly, unique, avgLen, median, filled: vals.length };
  });
  const map: Partial<Record<FieldKey, number>> = {};
  const used = new Set<number>();
  const take = (f: FieldKey, c: number | undefined) => { if (c !== undefined && !used.has(c)) { map[f] = c; used.add(c); } };

  take('code', stats.find(s => s.digitsOnly && s.unique > 0.8)?.c);
  const textCols = stats.filter(s => s.numRatio < 0.3 && !used.has(s.c) && s.filled > 0);
  take('name', textCols.sort((a, b) => b.avgLen * b.unique - a.avgLen * a.unique)[0]?.c);
  // الأعمدة الرقمية بترتيب ظهورها: غالبًا (شراء، مفرد، جملة) أو (كمية ثم أسعار)
  const numCols = stats.filter(s => s.numRatio >= 0.8 && !used.has(s.c)).sort((a, b) => a.c - b.c);
  const priceLike = numCols.filter(s => s.median >= 100);
  const smallLike = numCols.filter(s => s.median < 100);
  const prices = priceLike.sort((a, b) => a.c - b.c);
  if (prices.length >= 3) {
    take('cost', prices[0].c); take('retail', prices[1].c); take('wholesale', prices[2].c);
  } else if (prices.length === 2) {
    take('cost', prices[0].c); take('retail', prices[1].c);
  } else if (prices.length === 1) {
    take('retail', prices[0].c);
  }
  take('stock', smallLike[0]?.c);
  return map;
}

export interface Detection {
  orientation: 'horizontal' | 'vertical';
  headerRowIndex: number; // داخل الجدول بعد التحويل
  grid: string[][]; // الجدول بعد التحويل إن لزم (الصفوف = مواد)
  mapping: Partial<Record<FieldKey, number>>;
  headerFound: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export function detectLayout(rawRows: string[][]): Detection {
  const g = cleanGrid(rawRows);
  const h = scanHeaders(g);
  const t = transpose(g);
  const v = scanHeaders(t);

  const useVertical = v.hits > h.hits && v.hits >= 2;
  const grid = useVertical ? t : g;
  const scan = useVertical ? v : h;

  if (scan.hits >= 2 && scan.map.name !== undefined || scan.hits >= 3) {
    return {
      orientation: useVertical ? 'vertical' : 'horizontal',
      headerRowIndex: scan.index,
      grid,
      mapping: scan.map,
      headerFound: true,
      confidence: scan.hits >= 4 ? 'high' : 'medium',
    };
  }

  // بلا عناوين: نخمّن من المحتوى (الاتجاه الأفقي أولًا، وإن كان عدد الصفوف أقل من الأعمدة فعمودي)
  const wide = g.length < Math.max(0, ...g.map(r => r.length)) && g.length <= 12;
  const gg = wide ? t : g;
  return {
    orientation: wide ? 'vertical' : 'horizontal',
    headerRowIndex: -1,
    grid: gg,
    mapping: inferWithoutHeaders(gg),
    headerFound: false,
    confidence: 'low',
  };
}

/** إعادة بناء الجدول والعناوين عند تبديل الاتجاه يدويًا */
export function forceOrientation(rawRows: string[][], orientation: 'horizontal' | 'vertical'): Detection {
  const g = cleanGrid(rawRows);
  const grid = orientation === 'vertical' ? transpose(g) : g;
  const scan = scanHeaders(grid);
  const headerFound = scan.hits >= 1;
  return {
    orientation,
    headerRowIndex: headerFound ? scan.index : -1,
    grid,
    mapping: headerFound ? scan.map : inferWithoutHeaders(grid),
    headerFound,
    confidence: headerFound ? 'medium' : 'low',
  };
}

// ---------- تحويل القيم ----------

export function parseNumber(s: string | undefined): number | null {
  return toNumber(s ?? '');
}

/** يحوّل قيمة تاريخ (رقم تسلسلي من Excel أو نص) إلى YYYY-MM-DD أو '' */
export function parseDateCell(s: string | undefined): string {
  const raw = normalizeDigits(String(s ?? '').trim());
  if (!raw) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  if (/^\d{4,6}(\.\d+)?$/.test(raw)) {
    const serial = parseFloat(raw);
    if (serial > 20000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    return '';
  }
  let m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(raw);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(raw);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    let day = +m[1], mon = +m[2];
    if (mon > 12 && day <= 12) { const x = day; day = mon; mon = x; }
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) return `${y}-${pad(mon)}-${pad(day)}`;
  }
  return '';
}

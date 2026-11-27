import type { ScanItem, ScanResult, ScanUnit } from './aiScan';

/** البرومت الذي ينسخه صاحب المتجر ويرسله مع صورة القائمة إلى أي ذكاء اصطناعي (Gemini / Claude / ChatGPT) */
export const MANUAL_SCAN_PROMPT = `أنت تقرأ صورة لمتجر صغير في العراق: قائمة مورد أو فاتورة أو كشف مواد (مطبوع أو بخط اليد) أو صورة بضاعة. النص غالباً عربي وقد يحوي أسماء إنجليزية وأرقاماً هندية (٠-٩).

استخرج كل مادة في الصورة وأعد الناتج **فقط** على شكل JSON صحيح داخل كتلة كود واحدة، دون أي شرح قبله أو بعده، بهذا الشكل بالضبط:

\`\`\`json
{
  "supplierName": "اسم الشركة/المذخر الذي باع البضاعة (من رأس القائمة أو الختم) أو \\"\\"",
  "invoiceTotal": 0,
  "items": [
    { "name": "اسم المادة كما هو مكتوب", "quantity": 12, "unit": "piece", "unitPrice": 1500, "lineTotal": 18000, "barcode": "", "expiryDate": "" }
  ]
}
\`\`\`

القواعد الصارمة:
- انسخ اسم كل مادة كما هو مكتوب (مع الماركة والنكهة والحجم). لا تترجم ولا تدمج ولا تخترع مواد.
- اقرأ من أول سطر إلى آخر سطر بالترتيب، مادة واحدة لكل سطر، ولا تتخطَّ أي سطر.
- quantity رقم (حوّل الأرقام الهندية ٠-٩ إلى أرقام عادية). إذا لم تُكتب الكمية فاجعلها 1.
- unit واحدة فقط من: "piece" (قطعة/حبة) أو "dozen" (درزن/دزينة) أو "carton" (كارتون/كرتون/صندوق) أو "kg" (كغم/كيلو) أو "other".
- unitPrice وlineTotal اكتبهما فقط إذا كانا مكتوبين بوضوح في ذلك السطر وإلا احذفهما أو اتركهما 0. لا تحسبهما أنت.
- barcode وexpiryDate (بصيغة YYYY-MM-DD) فقط إذا كانت مكتوبة، وإلا اتركها "".
- تجاهل الترويسة وأرقام الهواتف والتواريخ والتواقيع وسطور المجموع، ولا تعدّها مواد.
- invoiceTotal: المجموع الكلي فقط إذا كان مكتوباً بوضوح وإلا 0.
- إن لم تجد أي مادة أعد "items": [].`;

export const MANUAL_AI_LINKS: { label: string; url: string }[] = [
  { label: 'Gemini', url: 'https://gemini.google.com/app' },
  { label: 'Claude', url: 'https://claude.ai/new' },
  { label: 'ChatGPT', url: 'https://chatgpt.com/' },
];

const toWestern = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/٫/g, '.').replace(/[٬،]/g, ',');

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const t = toWestern(String(v ?? '')).replace(/[,\s]/g, '').replace(/[^\d.\-]/g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : undefined;
};

const unitOf = (v: unknown): ScanUnit => {
  const t = String(v ?? '').toLowerCase().replace(/[ً-ْ]/g, '');
  if (/dozen|درزن|دزين|دستة/.test(t)) return 'dozen';
  if (/carton|box|كارتون|كرتون|صندوق/.test(t)) return 'carton';
  if (/^kg|kilo|كغم|كيلو|كلغ/.test(t)) return 'kg';
  if (/piece|pcs|unit|قطع|حبة|حبه/.test(t) || !t) return 'piece';
  return 'other';
};

const tryParse = (t: string): any => { try { return JSON.parse(t); } catch { return undefined; } };

/** يستخرج كائن/مصفوفة JSON من رد الذكاء الاصطناعي حتى لو جاء داخل ``` أو مع كلام قبله وبعده */
function extractJson(text: string): any {
  const t = text.replace(/```(?:json|JSON)?/g, '').replace(/[“”]/g, '"').trim();
  const direct = tryParse(t);
  if (direct !== undefined) return direct;
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { const o = tryParse(t.slice(a, b + 1)); if (o !== undefined) return o; }
  const c = t.indexOf('['), d = t.lastIndexOf(']');
  if (c >= 0 && d > c) { const o = tryParse(t.slice(c, d + 1)); if (o !== undefined) return o; }
  return undefined;
}

/** احتياطي: أسطر نصية «الاسم | الكمية | السعر» إذا لم يرجع الذكاء الاصطناعي JSON */
function parseLines(text: string): ScanItem[] {
  const out: ScanItem[] = [];
  text.split(/\r?\n/).forEach((raw) => {
    const line = toWestern(raw).replace(/^[\s\-*•\d]+[.)\-]\s+/, '').trim();
    if (!line) return;
    const parts = line.split(/\s*[|\t;]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) return;
    const name = parts.find((p) => /[A-Za-z؀-ۿ]/.test(p));
    if (!name) return;
    const nums = parts.filter((p) => p !== name).map(num).filter((n): n is number => n !== undefined);
    if (!nums.length) return;
    out.push({ name, quantity: nums[0] > 0 ? nums[0] : 1, unit: 'piece', unitPrice: nums[1], confidence: 0.7, raw: raw.trim() });
  });
  return out;
}

export interface ManualParse extends ScanResult { error?: string }

/** يحوّل رد الذكاء الاصطناعي الملصوق إلى مواد جاهزة لشاشة المراجعة (نفس نتيجة القراءة التلقائية) */
export function parseManualReply(text: string): ManualParse {
  const src = (text || '').trim();
  if (!src) return { items: [], error: 'الصق رد الذكاء الاصطناعي أولاً.' };
  const j = extractJson(src);
  let list: any[] | undefined;
  let supplierName: string | undefined;
  let invoiceTotal: number | undefined;
  if (Array.isArray(j)) list = j;
  else if (j && typeof j === 'object') {
    list = j.items || j.rows || j.products || j.materials;
    supplierName = typeof j.supplierName === 'string' && j.supplierName.trim() ? j.supplierName.trim() : undefined;
    const tot = num(j.invoiceTotal);
    invoiceTotal = tot && tot > 0 ? tot : undefined;
  }
  let items: ScanItem[] = [];
  if (Array.isArray(list)) {
    list.forEach((o: any, i: number) => {
      const name = String(o?.name ?? o?.item ?? o?.product ?? '').trim();
      if (!name) return;
      const q = num(o.quantity ?? o.qty);
      const up = num(o.unitPrice ?? o.price);
      const lt = num(o.lineTotal ?? o.total);
      const bc = String(o.barcode ?? '').replace(/\D/g, '');
      const ex = String(o.expiryDate ?? '').match(/^\d{4}-\d{2}-\d{2}$/) ? String(o.expiryDate) : undefined;
      items.push({
        name,
        quantity: q && q > 0 ? q : 1,
        unit: unitOf(o.unit),
        unitPrice: up && up > 0 ? up : undefined,
        lineTotal: lt && lt > 0 ? lt : undefined,
        barcode: bc.length >= 6 ? bc : undefined,
        expiryDate: ex,
        confidence: 0.85,
        line: i + 1,
        raw: name,
      });
    });
  } else {
    items = parseLines(src);
  }
  if (!items.length) return { items: [], error: 'لم أجد مواد في النص الملصوق. تأكد أنك نسخت رد الذكاء الاصطناعي كاملاً (الذي يبدأ بـ { وفيه "items").' };
  return { items, supplierName, invoiceTotal };
}

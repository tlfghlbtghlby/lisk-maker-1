// دالة Supabase Edge: قراءة المواد وكمياتها من صورة (قائمة مورد، كشف مواد، قائمة مكتوبة بخط اليد، أو صورة بضاعة)
// باستخدام Gemini. المفتاح لا يُكتب في الكود أبداً: يُخزَّن كسرّ في Supabase باسم GEMINI_API_KEY.
//
// أسرار اختيارية:
//   GEMINI_MODEL           : اسم النموذج (الافتراضي gemini-2.5-flash مع بدائل احتياطية)
//   AI_SCAN_PER_STORE_DAILY / AI_SCAN_GLOBAL_DAILY: قيم افتراضية (40 / 400) تُتجاوز بما تضبطه الإدارة من لوحة التحكم
//
// الطلب POST JSON: { image: base64 بدون بادئة, mime?: 'image/jpeg', storeId: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PROMPT = `You read photos for a small shop in Iraq: supplier invoices, delivery notes, handwritten or typed product lists, shelf/stock sheets, or photos of the goods themselves. Text is mostly Arabic (may include English brand names and Arabic-Indic digits).

Extract EVERY product line and return it in the JSON schema.
Strict rules:
- Copy each product name exactly as written (keep the brand, flavour, size). Never translate, merge, or invent items.
- quantity = the number of units written for that line, as a number. Convert Arabic-Indic digits (٠-٩) to Western digits. If the quantity is not written, use 1 and set confidence low.
- unit: one of "piece", "dozen", "carton", "kg", "other" according to what the line says (قطعة/حبة = piece, درزن/دزينة = dozen, كارتون/كرتون/صندوق = carton, كغم/كيلو = kg).
- unitPrice / lineTotal only if clearly printed or written for that line, otherwise omit. Do not compute them yourself.
- barcode only if the digits are printed on that line, otherwise omit.
- expiryDate only if written, as YYYY-MM-DD, otherwise omit.
- confidence from 0 to 1: lower it whenever any part of the line (name, number) is blurry, cut, ambiguous or guessed.
- If the photo shows physical goods and not a document, list each distinct product you can read from its packaging and count the visible units; use confidence at most 0.6.
- invoiceTotal: the grand total only if clearly printed, otherwise omit.
- Ignore headers, phone numbers, dates, signatures and totals rows as items.
- If nothing is readable return an empty items array.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    documentType: { type: 'STRING' },
    invoiceTotal: { type: 'NUMBER' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity: { type: 'NUMBER' },
          unit: { type: 'STRING' },
          unitPrice: { type: 'NUMBER' },
          lineTotal: { type: 'NUMBER' },
          barcode: { type: 'STRING' },
          expiryDate: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['name', 'quantity'],
      },
    },
  },
  required: ['items'],
};

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};

async function refund(storeId: string) {
  try { await sb.rpc('ai_scan_refund2', { p_store: storeId }); } catch (_) { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const image = typeof body?.image === 'string' ? body.image.replace(/^data:[^,]+,/, '') : '';
  const mime = typeof body?.mime === 'string' && /^image\/(jpeg|png|webp)$/.test(body.mime) ? body.mime : 'image/jpeg';
  const storeId = typeof body?.storeId === 'string' ? body.storeId.slice(0, 120) : '';
  if (!image || image.length < 200) return json({ error: 'no_image' }, 400);
  if (image.length > 7_000_000) return json({ error: 'image_too_large' }, 413);
  if (!storeId) return json({ error: 'no_store' }, 400);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'no_api_key' }, 503);

  // الحدود تُضبط من لوحة تحكم الإدارة (documents: config/ai_scan_limits) وإلا فالقيم الافتراضية من الأسرار
  let perStore = Number(Deno.env.get('AI_SCAN_PER_STORE_DAILY') ?? 40);
  let global = Number(Deno.env.get('AI_SCAN_GLOBAL_DAILY') ?? 400);
  let hours = 24;
  try {
    const { data: cfg } = await sb.from('documents').select('data').eq('collection', 'config').eq('id', 'ai_scan_limits').maybeSingle();
    const c: any = cfg?.data;
    if (c) {
      if (c.enabled === false) return json({ error: 'disabled' }, 403);
      const ps = Number(c.perStoreDaily), gl = Number(c.globalLimit);
      if (Number.isFinite(ps) && ps >= 0) perStore = Math.min(ps, 1000);
      if (Number.isFinite(gl) && gl >= 0) global = Math.min(gl, 20000);
      if (c.globalWindow === '5h') hours = 5;
      const o = c.perStore?.[storeId];
      if (o) {
        if (o.enabled === false) return json({ error: 'store_disabled' }, 403);
        const d = Number(o.daily);
        if (o.daily !== undefined && o.daily !== null && Number.isFinite(d) && d >= 0) perStore = Math.min(d, 1000);
      }
    }
  } catch (_) { /* استخدم الافتراضي */ }
  const { data: hit, error: hitErr } = await sb.rpc('ai_scan_hit2', { p_store: storeId, p_store_limit: perStore, p_global_limit: global, p_global_hours: hours });
  if (hitErr) return json({ error: 'usage_check_failed' }, 500);
  if (hit !== 'ok') return json({ error: hit, window: hours }, 429);

  const models = Array.from(new Set([Deno.env.get('GEMINI_MODEL') || '', 'gemini-2.5-flash', 'gemini-flash-latest'].filter(Boolean)));
  let lastStatus = 0;
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: image } }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA },
        }),
      });
    } catch (_) { lastStatus = 0; continue; }
    lastStatus = res.status;
    if (res.status === 429) { await refund(storeId); return json({ error: 'provider_rate_limited' }, 429); }
    if (res.status === 404 || res.status === 400) continue; // نموذج غير متاح: جرّب التالي
    if (!res.ok) { await refund(storeId); return json({ error: 'provider_error', status: res.status }, 502); }

    const data = await res.json().catch(() => null);
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* ignore */ }
    if (!parsed || !Array.isArray(parsed.items)) { await refund(storeId); return json({ error: 'unreadable_response' }, 502); }

    const items = parsed.items.slice(0, 300).map((it: any) => {
      const unit = ['piece', 'dozen', 'carton', 'kg', 'other'].includes(it?.unit) ? it.unit : 'piece';
      const exp = typeof it?.expiryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.expiryDate) ? it.expiryDate : undefined;
      const bc = typeof it?.barcode === 'string' ? it.barcode.replace(/\D/g, '') : '';
      const conf = num(it?.confidence);
      return {
        name: String(it?.name ?? '').trim().slice(0, 200),
        quantity: num(it?.quantity) ?? 1,
        unit,
        ...(num(it?.unitPrice) !== undefined ? { unitPrice: num(it.unitPrice) } : {}),
        ...(num(it?.lineTotal) !== undefined ? { lineTotal: num(it.lineTotal) } : {}),
        ...(bc.length >= 6 ? { barcode: bc } : {}),
        ...(exp ? { expiryDate: exp } : {}),
        confidence: conf === undefined ? 0.5 : Math.min(1, Math.max(0, conf)),
      };
    }).filter((it: any) => it.name && it.quantity > 0);

    return json({
      items,
      invoiceTotal: num(parsed.invoiceTotal),
      documentType: typeof parsed.documentType === 'string' ? parsed.documentType.slice(0, 60) : undefined,
      model,
    });
  }
  await refund(storeId);
  return json({ error: 'model_unavailable', status: lastStatus }, 502);
});

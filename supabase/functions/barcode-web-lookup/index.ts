// دالة Supabase Edge: الطريقة الثالثة للتعرف على الباركود — بحث جوجل (Gemini + Google Search) ثم ترجمة الاسم الكامل للعربية.
// تُستدعى فقط حين لا يجد التطبيق المادة في الكتالوج المشترك ولا في قواعد البيانات العالمية المفتوحة.
// المفتاح لا يُكتب في الكود: يُستعمل السر الموجود أصلاً GEMINI_API_KEY (نفس سر دالة scan-items).
//
// الطلب POST JSON: { barcode: "6281006...", storeId: "..." }
// الرد: { found: boolean, name?: string (عربي كامل مع الحجم), original?: string, category?: string }
//
// حدود الاستعمال: نفس آلية scan-items (ai_scan_hit2) بمعرّف منفصل "bc:<storeId>" كي لا يستهلك حصة قراءة الصور.
//   تُضبط من لوحة تحكم الإدارة (documents: config/barcode_web_limits = {enabled, perStoreDaily, globalLimit})،
//   وإلا فالقيم الافتراضية من الأسرار BARCODE_WEB_PER_STORE_DAILY (150) / BARCODE_WEB_GLOBAL_DAILY (1500)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// gemini-2.5-flash لم يعد متاحاً (404). الحصة المجانية لكل نموذج منفصلة، فنجرب عدة نماذج بالتتابع.
const MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];

const prompt = (code: string) => `Use Google Search to identify the retail product whose barcode (EAN/UPC/GTIN) is ${code}.
Search the exact number "${code}" (also try "${code} barcode"). Only trust results where the barcode number clearly belongs to that product.
Return ONLY one JSON object, no markdown, in this shape:
{"found": true|false, "original": "full product name exactly as sold, in its original language, including brand, flavour/variant and size/weight", "arabic": "the same full name translated to Arabic", "category": "short Arabic category", "piecesPerCarton": number or null}
Rules for "arabic":
- Fully Arabic: translate descriptive words; transliterate brand names into Arabic letters (e.g. Pepsi → بيبسي).
- KEEP the size/weight/count and convert units: ml→مل, l/L→لتر, g/gr→غم, kg→كغم, pcs→قطعة, e.g. "Pepsi Can 330ml" → "بيبسي علبة 330 مل".
- Do not add words that are not in the product name.
Rules for "piecesPerCarton": the number of retail units in one wholesale carton/case/packet-box, ONLY if a search result states it for this exact product (e.g. "Packet Pcs: 12", "12 x 330ml", "24 pcs per carton"). If not clearly stated return null. Never guess.
If you cannot find a trustworthy match, return {"found": false}. Never guess.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (req.method === 'GET') {
    // تشخيص: يفتحه صاحب النظام في المتصفح ?barcode=... ليرى حالة كل نموذج (دون حساب في الحصة ودون كشف المفتاح)
    if (!apiKey) return json({ diag: true, hasKey: false });
    const code = new URL(req.url).searchParams.get('barcode') || '8695280836498';
    const out: any[] = [];
    for (const model of MODELS) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt(code) }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } }),
          signal: AbortSignal.timeout(25000),
        });
        const t = (await r.text().catch(() => '')).replaceAll(apiKey, '***').slice(0, 700);
        out.push({ model, status: r.status, body: t });
      } catch (e) { out.push({ model, error: String(e).slice(0, 200) }); }
    }
    return json({ diag: true, hasKey: true, code, results: out });
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!apiKey) return json({ error: 'no_api_key' }, 503);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const code = String(body?.barcode ?? '').trim();
  const storeId = String(body?.storeId ?? '').trim().slice(0, 80);
  if (!/^\d{6,14}$/.test(code)) return json({ error: 'bad_barcode' }, 400);
  if (!storeId) return json({ error: 'no_store' }, 400);

  let perStore = Number(Deno.env.get('BARCODE_WEB_PER_STORE_DAILY') ?? 150);
  let global = Number(Deno.env.get('BARCODE_WEB_GLOBAL_DAILY') ?? 1500);
  try {
    const { data: cfg } = await sb.from('documents').select('data').eq('collection', 'config').eq('id', 'barcode_web_limits').maybeSingle();
    const c: any = cfg?.data;
    if (c) {
      if (c.enabled === false) return json({ found: false, error: 'disabled' }, 403);
      const ps = Number(c.perStoreDaily), gl = Number(c.globalLimit);
      if (Number.isFinite(ps) && ps >= 0) perStore = Math.min(ps, 2000);
      if (Number.isFinite(gl) && gl >= 0) global = Math.min(gl, 50000);
    }
  } catch (_) { /* استخدم الافتراضي */ }
  const { data: hit, error: hitErr } = await sb.rpc('ai_scan_hit2', { p_store: `bc:${storeId}`, p_store_limit: perStore, p_global_limit: global, p_global_hours: 24 });
  if (hitErr) return json({ error: 'usage_check_failed' }, 500);
  if (hit !== 'ok') return json({ error: hit }, 429);

  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt(code) }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0 },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) continue;
      const data: any = await r.json();
      const text: string = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('');
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) continue;
      const o = JSON.parse(m[0]);
      if (!o?.found || !String(o.arabic || '').trim()) return json({ found: false });
      return json({
        found: true,
        name: String(o.arabic).trim().slice(0, 200),
        original: String(o.original || '').trim().slice(0, 200),
        category: String(o.category || '').trim().slice(0, 60),
        piecesPerCarton: (() => { const n = Math.floor(Number(o.piecesPerCarton)); return Number.isFinite(n) && n > 1 && n <= 1000 ? n : null; })(),
      });
    } catch (_) { /* جرّب النموذج التالي */ }
  }
  try { await sb.rpc('ai_scan_refund2', { p_store: `bc:${storeId}` }); } catch (_) { /* ignore */ }
  return json({ found: false, error: 'provider_unavailable' }, 502);
});

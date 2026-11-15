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
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// ترتيب النماذج: الأدق أولاً ثم الأخف عند التعثر أو الازدحام
const FALLBACK_MODELS = [
  'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3-flash-preview',
  'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite',
  'gemini-3.7-flash', 'gemini-3.8-flash',
];

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
- supplierName: the supplier / wholesaler / company / trader that SOLD the goods and issued the document. Look carefully at the top header, letterhead, logo text, rubber stamp, a handwritten title line (e.g. شركة ..., مذخر ..., مكتب ..., السيد ...), and also the footer or signature stamp. Copy it exactly as written (prefer the company/trade name over a person's name). Omit it only if nothing like it is written anywhere. Never use a phone number, the buyer's own shop, or a product name.
- Read the document strictly from the top line to the bottom line, in order, one product per line. Do not skip, merge or reorder lines. For every item return the fields "line" (its 1-based order of appearance) and "raw" (the full text of that line exactly as written, including its numbers).
- Ignore headers, phone numbers, dates, signatures and totals rows as items.
- If nothing is readable return an empty items array.`;

// وضع القائمة المطبوعة: نسخ حرفي للجدول بلا تفسير، والبرنامج هو الذي يفرز الأعمدة
const PRINTED_PROMPT = `You transcribe a PRINTED invoice / delivery note / price list (Arabic, may include English and Arabic-Indic digits). Do NOT interpret or fix anything.
Rules:
- Go strictly from the top row to the bottom row of the table, in order. Do not skip, merge or reorder rows.
- For each row return the field "cells": the exact text of every cell of that row, in a consistent order for all rows (right to left for Arabic documents). Keep numbers exactly as printed (convert Arabic-Indic digits to Western digits). Keep empty cells as empty strings so the columns stay aligned.
- Set isHeader=true for the column-titles row (e.g. المادة / العدد / السعر / المجموع).
- Include total / summary rows too, as ordinary rows.
- supplierName: the supplier / wholesaler / company that issued the document (letterhead, logo text, stamp, footer), copied exactly; omit if nothing is written. Never a phone number or the buyer's shop.
- invoiceTotal: the grand total only if clearly printed, otherwise omit.
- documentType: a short label of the document.
- If nothing is readable return an empty rows array.`;

const SCHEMA_PRINTED = {
  type: 'OBJECT',
  properties: {
    documentType: { type: 'STRING' },
    invoiceTotal: { type: 'NUMBER' },
    supplierName: { type: 'STRING' },
    rows: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { cells: { type: 'ARRAY', items: { type: 'STRING' } }, isHeader: { type: 'BOOLEAN' } },
        required: ['cells'],
      },
    },
  },
  required: ['rows'],
};

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    documentType: { type: 'STRING' },
    invoiceTotal: { type: 'NUMBER' },
    supplierName: { type: 'STRING' },
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
          line: { type: 'NUMBER' },
          raw: { type: 'STRING' },
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
  if (req.method === 'GET') {
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ diag: true, hasKey: false });
    const out: any[] = [];
    for (const model of ['gemini-2.5-flash', 'gemini-flash-latest']) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the word OK' }] }] }),
          signal: AbortSignal.timeout(15000),
        });
        const t = (await r.text().catch(() => '')).replaceAll(key, '***').slice(0, 400);
        out.push({ model, status: r.status, body: t });
      } catch (e) { out.push({ model, error: String(e).slice(0, 200) }); }
    }
    return json({ diag: true, hasKey: true, keyLen: key.length, keyPrefix: key.slice(0, 3), results: out });
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const image = typeof body?.image === 'string' ? body.image.replace(/^data:[^,]+,/, '') : '';
  const mime = typeof body?.mime === 'string' && /^image\/(jpeg|png|webp)$/.test(body.mime) ? body.mime : 'image/jpeg';
  const storeId = typeof body?.storeId === 'string' ? body.storeId.slice(0, 120) : '';
  if (!image || image.length < 200) return json({ error: 'no_image' }, 400);
  if (image.length > 7_000_000) return json({ error: 'image_too_large' }, 413);
  if (!storeId) return json({ error: 'no_store' }, 400);
  const printed = body?.printed === true;

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

  const models = Array.from(new Set([Deno.env.get('GEMINI_MODEL') || '', ...FALLBACK_MODELS].filter(Boolean)));
  let lastStatus = 0;
  let busy = false;
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: printed ? PRINTED_PROMPT : PROMPT }, { inline_data: { mime_type: mime, data: image } }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: printed ? SCHEMA_PRINTED : SCHEMA },
        }),
        signal: AbortSignal.timeout(25000),
      });
    } catch (e) { lastStatus = 0; console.error('gemini_fetch_failed', model, String(e).slice(0, 200)); continue; }
    lastStatus = res.status;
    if (res.status === 429) { await refund(storeId); return json({ error: 'provider_rate_limited' }, 429); }
    if (res.status === 503 || res.status === 500 || res.status === 504) { busy = true; console.error('gemini_busy', model, res.status); continue; }
    if (res.status === 404 || res.status === 400) { console.error('gemini_skip', model, res.status); continue; }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      console.error('gemini_error', model, res.status, detail);
      await refund(storeId);
      return json({ error: 'provider_error', status: res.status, detail }, 502);
    }

    const data = await res.json().catch(() => null);
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* ignore */ }
    const supplierName = parsed && typeof parsed.supplierName === 'string' && parsed.supplierName.trim() ? parsed.supplierName.trim().slice(0, 120) : undefined;
    if (printed) {
      if (!parsed || !Array.isArray(parsed.rows)) { await refund(storeId); return json({ error: 'unreadable_response' }, 502); }
      const rows = parsed.rows.slice(0, 400).map((rw: any) => ({
        cells: (Array.isArray(rw?.cells) ? rw.cells : []).slice(0, 20).map((c: unknown) => String(c ?? '').trim().slice(0, 200)),
        isHeader: rw?.isHeader === true,
      }));
      return json({
        rows,
        invoiceTotal: num(parsed.invoiceTotal),
        supplierName,
        documentType: typeof parsed.documentType === 'string' ? parsed.documentType.slice(0, 60) : undefined,
        model,
      });
    }
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
        ...(num(it?.line) !== undefined ? { line: num(it.line) } : {}),
        ...(typeof it?.raw === 'string' && it.raw.trim() ? { raw: it.raw.trim().slice(0, 300) } : {}),
      };
    }).filter((it: any) => it.name && it.quantity > 0)
      .sort((a: any, b: any) => (a.line ?? 1e9) - (b.line ?? 1e9));

    return json({
      items,
      invoiceTotal: num(parsed.invoiceTotal),
      supplierName,
      documentType: typeof parsed.documentType === 'string' ? parsed.documentType.slice(0, 60) : undefined,
      model,
    });
  }
  await refund(storeId);
  return json({ error: busy ? 'provider_busy' : 'model_unavailable', status: lastStatus }, 503);
});

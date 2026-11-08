// دالة Supabase Edge لربط المتاجر والزبائن ببوت التليجرام.
// التوكن لا يُكتب في الكود أبداً: يُخزَّن كسرّ في Supabase (TELEGRAM_BOT_TOKEN).
//
// الإجراءات (POST JSON {action, ...}):
//   info      : اسم البوت
//   register  : تسجيل رمز ربط (متجر أو زبون)
//   status    : عدد المحادثات المرتبطة
//   notify    : إرسال رسالة للمتجر و/أو للزبون
//   unlink    : فك الربط
// وبالإضافة لذلك تستقبل ويب هوك التليجرام (رسائل المستخدمين للبوت).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

// التوكن وسرّ الـ webhook: من أسرار Supabase إن وُجدت، وإلا من جدول tg_config (service role فقط)
let TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
let WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';
let configLoadedAt = 0;
async function loadConfig() {
  if (TOKEN && WEBHOOK_SECRET) return;
  if (Date.now() - configLoadedAt < 60_000 && TOKEN) return;
  configLoadedAt = Date.now();
  const { data } = await sb.from('tg_config').select('key, value');
  for (const row of data || []) {
    if (row.key === 'bot_token' && !Deno.env.get('TELEGRAM_BOT_TOKEN')) TOKEN = row.value;
    if (row.key === 'webhook_secret' && !Deno.env.get('TELEGRAM_WEBHOOK_SECRET')) WEBHOOK_SECRET = row.value;
  }
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function tg(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ ok: false }));
}

// تقسيم الرسائل الطويلة (حد التليجرام 4096 حرفاً)
function chunk(text: string, size = 3800): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + '\n' + line).length > size) {
      if (cur) out.push(cur);
      cur = line.slice(0, size);
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }
  if (cur) out.push(cur);
  return out;
}

async function sendTo(chatId: number, text: string): Promise<boolean> {
  let ok = true;
  for (const part of chunk(text)) {
    const r = await tg('sendMessage', {
      chat_id: chatId,
      text: part,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    if (!r.ok) {
      ok = false;
      // المستخدم حظر البوت أو حذف المحادثة: نفك الربط تلقائياً
      if (r.error_code === 403 || r.error_code === 400) {
        await sb.from('tg_chats').delete().eq('chat_id', chatId);
      }
      break;
    }
  }
  return ok;
}

async function authStore(storeUid: string, secret: string): Promise<boolean> {
  if (!storeUid || !secret) return false;
  const { data } = await sb.from('tg_stores').select('secret_hash').eq('store_uid', storeUid).maybeSingle();
  if (!data) return false;
  return data.secret_hash === (await sha256(secret));
}

const CODE_RE = /^(ST|CU)-[A-Z0-9]{8}$/;

async function handleUpdate(update: any) {
  const msg = update?.message;
  if (!msg || !msg.chat) return;
  const chatId: number = msg.chat.id;
  const name: string = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.chat.title || '';
  const text: string = String(msg.text || '').trim().toUpperCase();

  if (text === '/START' || text === '/HELP') {
    await sendTo(
      chatId,
      '👋 أهلاً بك!\n\nأرسل <b>رمز الربط</b> الذي ظهر لك في البرنامج:\n• رمز المتجر يبدأ بـ <code>ST-</code>\n• رمز الزبون يبدأ بـ <code>CU-</code>\n\nلإيقاف الإشعارات أرسل /stop'
    );
    return;
  }
  if (text === '/STOP') {
    await sb.from('tg_chats').delete().eq('chat_id', chatId);
    await sendTo(chatId, '✅ تم إيقاف الإشعارات وفك كل الارتباطات لهذه المحادثة.');
    return;
  }
  if (!CODE_RE.test(text)) {
    await sendTo(chatId, '⚠️ لم أفهم الرسالة. أرسل رمز الربط فقط (مثال: <code>ST-AB12CD34</code>).');
    return;
  }

  const { data: code } = await sb.from('tg_codes').select('*').eq('code', text).maybeSingle();
  if (!code) {
    await sendTo(chatId, '❌ الرمز غير صحيح أو غير مسجّل. تأكد من نسخه من البرنامج.');
    return;
  }
  const { data: store } = await sb.from('tg_stores').select('store_name').eq('store_uid', code.store_uid).maybeSingle();
  const storeName = store?.store_name || 'المتجر';

  const { error } = await sb.from('tg_chats').upsert(
    {
      kind: code.kind,
      store_uid: code.store_uid,
      customer_id: code.customer_id || '',
      chat_id: chatId,
      chat_name: name,
    },
    { onConflict: 'kind,store_uid,customer_id,chat_id' }
  );
  if (error) {
    await sendTo(chatId, '⚠️ حدث خطأ أثناء الربط، حاول مرة أخرى.');
    return;
  }

  if (code.kind === 'store') {
    await sendTo(chatId, `✅ <b>تم ربط متجرك «${esc(storeName)}» بنجاح</b>\nستصلك هنا كل الأحداث التي تحددها من إعدادات البرنامج.`);
  } else {
    await sendTo(
      chatId,
      `✅ <b>تم ربط حساباتك المالية مع المتجر «${esc(storeName)}» بنجاح</b>\nستصلك هنا قوائمك ودينك والمسدّد والمتبقي لحظة بلحظة.`
    );
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  await loadConfig();
  if (!TOKEN) return json({ error: 'bot_token_not_configured' }, 500);

  // ويب هوك التليجرام
  const hookHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (hookHeader !== null) {
    if (!WEBHOOK_SECRET || hookHeader !== WEBHOOK_SECRET) return json({ error: 'forbidden' }, 403);
    try {
      await handleUpdate(await req.json());
    } catch (e) {
      console.error('webhook error', e);
    }
    return json({ ok: true });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const action = String(body?.action || '');

  if (action === 'info') {
    const me = await tg('getMe', {});
    return json({ ok: Boolean(me.ok), username: me.result?.username || null });
  }

  const storeUid = String(body?.storeUid || '');
  const secret = String(body?.secret || '');

  if (action === 'register') {
    const kind = body.kind === 'customer' ? 'customer' : 'store';
    const code = String(body.code || '').toUpperCase();
    if (!CODE_RE.test(code) || !storeUid || secret.length < 16) return json({ error: 'bad_request' }, 400);

    const { data: existing } = await sb.from('tg_stores').select('secret_hash').eq('store_uid', storeUid).maybeSingle();
    const hash = await sha256(secret);
    if (!existing) {
      const { error } = await sb.from('tg_stores').insert({ store_uid: storeUid, secret_hash: hash, store_name: body.storeName || null });
      if (error) return json({ error: 'store_insert_failed' }, 500);
    } else if (existing.secret_hash !== hash) {
      return json({ error: 'forbidden' }, 403);
    } else if (body.storeName) {
      await sb.from('tg_stores').update({ store_name: body.storeName }).eq('store_uid', storeUid);
    }

    const { data: taken } = await sb.from('tg_codes').select('store_uid, customer_id').eq('code', code).maybeSingle();
    if (taken && (taken.store_uid !== storeUid || (taken.customer_id || '') !== String(body.customerId || ''))) {
      return json({ error: 'code_taken' }, 409);
    }
    const { error } = await sb.from('tg_codes').upsert({
      code,
      kind,
      store_uid: storeUid,
      customer_id: kind === 'customer' ? String(body.customerId || '') : null,
      customer_name: kind === 'customer' ? body.customerName || null : null,
    });
    if (error) return json({ error: 'code_insert_failed' }, 500);
    return json({ ok: true });
  }

  if (!(await authStore(storeUid, secret))) return json({ error: 'forbidden' }, 403);

  if (action === 'status') {
    const kind = body.kind === 'customer' ? 'customer' : 'store';
    const { data } = await sb
      .from('tg_chats')
      .select('chat_name, linked_at')
      .eq('store_uid', storeUid)
      .eq('kind', kind)
      .eq('customer_id', kind === 'customer' ? String(body.customerId || '') : '');
    return json({ ok: true, linked: (data || []).length, chats: data || [] });
  }

  if (action === 'unlink') {
    const kind = body.kind === 'customer' ? 'customer' : 'store';
    await sb
      .from('tg_chats')
      .delete()
      .eq('store_uid', storeUid)
      .eq('kind', kind)
      .eq('customer_id', kind === 'customer' ? String(body.customerId || '') : '');
    return json({ ok: true });
  }

  if (action === 'notify') {
    let sent = 0;
    const text = String(body.text || '');
    if (text) {
      const { data: chats } = await sb.from('tg_chats').select('chat_id').eq('store_uid', storeUid).eq('kind', 'store');
      for (const c of chats || []) if (await sendTo(Number(c.chat_id), text)) sent++;
    }
    const customerText = String(body.customerText || '');
    if (customerText && body.customerId) {
      const { data: chats } = await sb
        .from('tg_chats')
        .select('chat_id')
        .eq('store_uid', storeUid)
        .eq('kind', 'customer')
        .eq('customer_id', String(body.customerId));
      for (const c of chats || []) if (await sendTo(Number(c.chat_id), customerText)) sent++;
    }
    return json({ ok: true, sent });
  }

  return json({ error: 'unknown_action' }, 400);
});

import React, { useState } from 'react';
import { updateClientAccount, getMainDocument } from '../supabase';
import { makeShopClient, setShopCloudCfg, probeShopCloud } from '../utils/shopCloud';
import { shopAdminCall, getAdminKey } from '../utils/shopCloudPush';

const counts = (d: any) => ({
  invoices: Array.isArray(d?.invoices) ? d.invoices.length : 0,
  products: Array.isArray(d?.products) ? d.products.length : 0,
  customers: Array.isArray(d?.customers) ? d.customers.length : 0,
  shifts: Array.isArray(d?.shifts) ? d.shifts.length : 0,
  payments: Array.isArray(d?.payments) ? d.payments.length : 0,
});
const fmtCounts = (c: ReturnType<typeof counts>) => `${c.invoices} فاتورة · ${c.products} مادة · ${c.customers} زبون · ${c.shifts} وردية · ${c.payments} دفعة`;

type Msg = { ok: boolean; text: string } | null;

/** إعداد السحابة المستقلة لمحل واحد (للمدير فقط): الرابط والمفتاح، اختبار، نقل البيانات، تفعيل */
export default function ShopCloudAdmin({ client, onSaved }: { client: any; onSaved?: () => void }) {
  const initial = client?.cloud || {};
  const [url, setUrl] = useState<string>(initial.url || '');
  const [key, setKey] = useState<string>(initial.anonKey || '');
  const [enabled, setEnabled] = useState<boolean>(initial.enabled === true);
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState<Msg>(null);
  const [verified, setVerified] = useState(false);
  const [token, setToken] = useState('');
  const uid: string = client.uid;
  const docId = `store_${uid}`;

  const persist = async (cloud: any) => {
    await updateClientAccount({ uid, cloud } as any);
    setShopCloudCfg(uid, cloud);
    onSaved?.();
  };

  const test = async () => {
    setBusy('test'); setMsg(null);
    try {
      const cl = makeShopClient(url, key);
      if (!cl) throw new Error('الرابط يجب أن يكون بصيغة https://xxxx.supabase.co والمفتاح (anon) غير صحيح.');
      const { error } = await cl.from('documents').select('id').limit(1);
      if (error) {
        if (/(PGRST205|42P01|does not exist|Could not find the table)/i.test(`${(error as any).code} ${error.message}`)) { setMsg({ ok: true, text: 'الاتصال سليم ✅ لكن المشروع لم يُجهَّز بعد: احفظ رمز الوصول ثم اضغط «رفع تعديلات السحابات» وسيُنشئ الجداول تلقائياً.' }); setBusy(''); return; }
        throw new Error(`الاتصال فشل، تحقق من الرابط والمفتاح. (${error.message})`);
      }
      const si = await cl.from('schema_info').select('version').eq('id', 1).maybeSingle();
      setMsg({ ok: true, text: `الاتصال ناجح ✅${si.data ? ` — إصدار هيكل القاعدة ${si.data.version}` : ' (غير مُجهَّز بالكامل: اضغط «رفع تعديلات السحابات»)'}` });
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'فشل الاتصال' }); }
    setBusy('');
  };

  const save = async (nextEnabled: boolean) => {
    setBusy('save'); setMsg(null);
    try {
      if (!url.trim() && !key.trim() && !nextEnabled) { await persist(null); setEnabled(false); setMsg({ ok: true, text: 'أُزيلت السحابة المستقلة، وعاد المحل للسحابة الرئيسية.' }); }
      else {
        if (!makeShopClient(url, key)) throw new Error('بيانات الرابط/المفتاح غير صحيحة.');
        if (nextEnabled) {
          const pr = await probeShopCloud(url, key);
          if (!pr.ok) throw new Error(`لن أفعّل: المشروع غير مجهّز بعد (${pr.reason}). احفظ رمز الوصول ثم اضغط «رفع تعديلات السحابات» أولاً، وبعدها فعّل.`);
        }
        await persist({ url: url.trim().replace(/\/+$/, ''), anonKey: key.trim(), enabled: nextEnabled });
        setEnabled(nextEnabled);
        setMsg({ ok: true, text: nextEnabled ? 'فُعّلت السحابة المستقلة لهذا المحل ✅ (تعمل على أجهزته عند فتح البرنامج أو إعادة تشغيله).' : 'حُفظت البيانات (غير مفعّلة).' });
      }
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'تعذر الحفظ' }); }
    setBusy('');
  };

  const migrate = async () => {
    setBusy('mig'); setMsg(null); setVerified(false);
    try {
      const cl = makeShopClient(url, key);
      if (!cl) throw new Error('أدخل الرابط والمفتاح أولاً.');
      const src: any = await getMainDocument('stores', docId);
      if (!src) throw new Error('لا توجد بيانات لهذا المحل في السحابة الرئيسية (لا شيء لنقله).');
      const before = counts(src);
      const { error } = await cl.from('documents').upsert({ collection: 'stores', id: docId, data: src, updated_at: new Date().toISOString() }, { onConflict: 'collection,id' });
      if (error) throw new Error(`فشل الرفع إلى سحابة المحل: ${error.message}`);
      const back = await cl.from('documents').select('data').eq('collection', 'stores').eq('id', docId).maybeSingle();
      if (back.error || !back.data) throw new Error('رُفع الملف لكن تعذرت قراءته للتحقق. لا تفعّل قبل إعادة المحاولة.');
      const after = counts(back.data.data);
      const same = JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(back.data.data).length === JSON.stringify(src).length;
      if (!same) throw new Error(`عدم تطابق بعد النقل! الأصل: ${fmtCounts(before)} / الجديد: ${fmtCounts(after)}. لا تفعّل.`);
      setVerified(true);
      setMsg({ ok: true, text: `نُقلت البيانات وتطابقت 100% ✅ (${fmtCounts(after)}). النسخة الأصلية ما زالت في السحابة الرئيسية. يمكنك الآن «حفظ وتفعيل».` });
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'فشل النقل' }); }
    setBusy('');
  };

  const saveToken = async (remove = false) => {
    setBusy('tok'); setMsg(null);
    try {
      if (getAdminKey().length < 16) throw new Error('أدخل مفتاح الإدارة أولاً في صندوق «تعديلات سحابات المحلات» أعلى الجدول.');
      if (remove) { await shopAdminCall({ action: 'delete_token', uid }); setMsg({ ok: true, text: 'حُذف رمز الوصول.' }); }
      else {
        await shopAdminCall({ action: 'save_token', uid, accessToken: token.trim() });
        setToken(''); setMsg({ ok: true, text: 'حُفظ رمز الوصول بعد التحقق منه ✅ — سيدخل هذا المحل في «رفع تعديلات السحابات».' });
      }
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'تعذر الحفظ' }); }
    setBusy('');
  };

  const inp = 'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono';
  return (
    <div data-testid="shop-cloud-admin" className="p-3 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50/60 dark:bg-sky-950/20 space-y-2.5">
      <div className="text-xs font-black text-sky-900 dark:text-sky-300">☁️ سحابة مستقلة لهذا المحل (فواتير ومواد المحل في مشروع Supabase الخاص به)</div>
      <p className="text-[11px] text-slate-600 dark:text-slate-400">الحساب وكلمة المرور والكتالوج تبقى في سحابتك. مغلقة افتراضياً، ولا تتأثر المحلات الأخرى. لا تفعّلها إلا بعد أن تحدّث كل أجهزة المحل إلى هذا الإصدار.</p>
      <input dir="ltr" className={inp} placeholder="https://xxxxxxxx.supabase.co" value={url} onChange={(e) => { setUrl(e.target.value); setVerified(false); }} data-testid="cloud-url" />
      <input dir="ltr" className={inp} placeholder="anon / publishable key" value={key} onChange={(e) => { setKey(e.target.value); setVerified(false); }} data-testid="cloud-key" />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!busy} onClick={test} data-testid="cloud-test" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 cursor-pointer disabled:opacity-50">{busy === 'test' ? '...' : 'اختبار الاتصال'}</button>
        <button type="button" disabled={!!busy} onClick={migrate} data-testid="cloud-migrate" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white cursor-pointer disabled:opacity-50">{busy === 'mig' ? 'جارٍ النقل…' : 'نقل بيانات المحل الآن'}</button>
        <button type="button" disabled={!!busy || !url || !key} onClick={() => save(true)} data-testid="cloud-enable" className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 text-white cursor-pointer disabled:opacity-50">حفظ وتفعيل</button>
        <button type="button" disabled={!!busy} onClick={() => save(false)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 cursor-pointer disabled:opacity-50">{enabled ? 'إيقاف (العودة للرئيسية)' : 'حفظ دون تفعيل'}</button>
      </div>
      <div className="text-[11px] font-bold">{enabled ? <span className="text-emerald-700">الحالة: مفعّلة</span> : <span className="text-slate-500">الحالة: غير مفعّلة{verified ? ' — النقل متحقَّق منه' : ''}</span>}</div>
      <div className="pt-1 border-t border-sky-200 dark:border-sky-800 space-y-1.5">
        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">رمز وصول Supabase لهذا المحل (Account → Access Tokens) — لإنشاء الجداول ورفع كل التعديلات تلقائياً (بلا سكربت). يُحفظ في سحابتك فقط ولا يُعرض بعد الحفظ.</div>
        <input type="password" dir="ltr" className={inp} placeholder="sbp_..." value={token} onChange={(e) => setToken(e.target.value)} data-testid="cloud-token" />
        <div className="flex gap-2">
          <button type="button" disabled={!!busy || token.trim().length < 20} onClick={() => saveToken(false)} data-testid="cloud-token-save" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white cursor-pointer disabled:opacity-50">{busy === 'tok' ? '...' : 'حفظ الرمز'}</button>
          <button type="button" disabled={!!busy} onClick={() => saveToken(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 cursor-pointer disabled:opacity-50">حذف الرمز</button>
        </div>
      </div>
      {msg && <div className={`text-[11px] font-bold rounded-lg px-3 py-2 border break-words ${msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-rose-800 bg-rose-50 border-rose-300'}`}>{msg.text}</div>}
    </div>
  );
}

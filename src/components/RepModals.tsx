import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Link2, Unlink, Send, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SalesRep } from '../types';
import {
  DEFAULT_TELEGRAM_SETTINGS,
  describeTelegramError,
  generateTelegramCode,
  generateTelegramSecret,
  tgInfo,
  tgNotify,
  tgRegister,
  tgStatus,
  tgUnlink,
} from '../utils/telegram';
import { computeRepEarnings, formatRepSettlement, formatRepStatement } from '../utils/repEarnings';

const useTgCtx = () => {
  const { settings, currentUser } = useApp();
  const tg = { ...DEFAULT_TELEGRAM_SETTINGS, ...(settings.telegram || {}) };
  return {
    tg,
    storeUid: currentUser?.uid || '',
    storeName: currentUser?.storeName || currentUser?.displayName || '',
    ctx: { currency: settings.currency || 'د.ع', storeName: currentUser?.storeName || currentUser?.displayName || '', includeItems: false, includeProfit: false },
  };
};

const shell = 'fixed inset-0 z-[85] bg-black/40 backdrop-blur-md flex items-center justify-center p-3';
const card = 'bg-white dark:bg-[#0b1728] border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl w-full p-5 space-y-4';

/* ================= ربط المندوب بالتليجرام + إرسال إشعار ================= */
export const RepTelegramModal: React.FC<{ rep: SalesRep; onClose: () => void }> = ({ rep, onClose }) => {
  const { settings, updateSettings, updateSalesRep, invoices } = useApp();
  const { tg, storeUid, storeName, ctx } = useTgCtx();
  const live = (settings.salesReps || []).find(r => r.id === rep.id) || rep;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [bot, setBot] = useState<string>(tg.botUsername || '');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        let secret = tg.secret;
        if (!secret) {
          secret = generateTelegramSecret();
          updateSettings({ telegram: { ...tg, secret, code: tg.code || generateTelegramCode('ST') } });
        }
        let code = live.telegramCode;
        if (!code) {
          for (let i = 0; i < 4; i++) {
            const candidate = generateTelegramCode('RP');
            try {
              await tgRegister({ storeUid, secret, kind: 'rep', code: candidate, repId: live.id, repName: live.name, storeName });
              code = candidate;
              break;
            } catch (e: any) {
              if (e?.message !== 'code_taken') throw e;
            }
          }
          if (!code) throw new Error('تعذر إنشاء رمز فريد');
          await updateSalesRep(live.id, { telegramCode: code });
        } else {
          await tgRegister({ storeUid, secret, kind: 'rep', code, repId: live.id, repName: live.name, storeName });
        }
        tgInfo().then(r => r?.username && setBot(r.username)).catch(() => {});
      } catch (e) {
        setMsg({ ok: false, text: describeTelegramError(e) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); } catch (e) { setMsg({ ok: false, text: describeTelegramError(e) }); } finally { setBusy(false); }
  };

  const check = () => run(async () => {
    const r = await tgStatus({ storeUid, secret: tg.secret, kind: 'rep', repId: live.id });
    if (r?.linked > 0) {
      await updateSalesRep(live.id, { telegramLinked: true });
      setMsg({ ok: true, text: 'تم ربط المندوب بنجاح ✅' });
    } else {
      await updateSalesRep(live.id, { telegramLinked: false });
      setMsg({ ok: false, text: 'لم يصل الرمز للبوت بعد. اطلب من المندوب إرساله ثم اضغط تحقق.' });
    }
  });

  const unlink = () => {
    if (!window.confirm('فك ربط هذا المندوب؟ ستتوقف رسائله.')) return;
    return run(async () => {
      await tgUnlink({ storeUid, secret: tg.secret, kind: 'rep', repId: live.id });
      await updateSalesRep(live.id, { telegramLinked: false });
      setMsg({ ok: true, text: 'تم فك الربط.' });
    });
  };

  const sendStatement = () => run(async () => {
    const e = computeRepEarnings(live, invoices, settings.repCommissionDefaultType);
    const r = await tgNotify({ storeUid, secret: tg.secret, repId: live.id, repText: formatRepStatement(live, e, ctx) });
    setMsg(r?.sent > 0 ? { ok: true, text: 'أُرسل الكشف للمندوب.' } : { ok: false, text: 'المندوب غير مرتبط بعد.' });
  });

  const copy = async () => {
    if (!live.telegramCode) return;
    try { await navigator.clipboard.writeText(live.telegramCode); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  return (
    <div className={shell} dir="rtl" onClick={onClose}>
      <div className={`${card} max-w-md`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-600" /> ربط تليجرام للمندوب: {live.name}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-6">
          أعطِ المندوب هذا الرمز ليرسله إلى البوت{bot ? <> <b>@{bot}</b></> : null}. بعدها تصله كشوفات أرباحه والقوائم المباعة باسمه وتصفية أرباحه.
          الرمز خاص بهذا المندوب في متجرك فقط.
        </p>
        <div className="flex items-center gap-2">
          <code dir="ltr" className="flex-1 text-center font-mono font-black tracking-widest text-lg px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white select-all">
            {live.telegramCode || '...'}
          </code>
          <button type="button" onClick={copy} className="px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !live.telegramCode} onClick={check} className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            <Link2 className="w-4 h-4" /> تحقق من الربط
          </button>
          {live.telegramLinked && (
            <>
              <button type="button" disabled={busy} onClick={sendStatement} className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer">إرسال كشفه الآن</button>
              <button type="button" disabled={busy} onClick={unlink} className="px-3 py-2 text-xs font-bold rounded-xl border border-rose-300 text-rose-700 bg-rose-50 flex items-center gap-1 cursor-pointer"><Unlink className="w-4 h-4" /> فك الربط</button>
            </>
          )}
        </div>
        {live.telegramLinked && !msg && <div className="text-xs font-bold rounded-lg px-3 py-2 border text-emerald-800 bg-emerald-50 border-emerald-300">مرتبط بالتليجرام ✅</div>}
        {msg && <div className={`text-xs font-bold rounded-lg px-3 py-2 border ${msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-rose-800 bg-rose-50 border-rose-300'}`}>{msg.text}</div>}
      </div>
    </div>
  );
};

/* ================= تصفية أرباح المندوب ================= */
export const RepSettleModal: React.FC<{ rep: SalesRep; onClose: () => void; telegramOn: boolean }> = ({ rep, onClose, telegramOn }) => {
  const { settings, invoices, updateSalesRep, formatMoney } = useApp();
  const { tg, storeUid, ctx } = useTgCtx();
  const live = (settings.salesReps || []).find(r => r.id === rep.id) || rep;
  const e = computeRepEarnings(live, invoices, settings.repCommissionDefaultType);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const pay = async () => {
    if (e.commission <= 0 && e.invoices.length === 0) return;
    if (!window.confirm(`دفع ${formatMoney(e.commission)} للمندوب ${live.name} وتصفير أرباحه؟`)) return;
    setBusy(true);
    const now = new Date().toISOString();
    const rec = { id: `st_${Date.now()}`, date: now, amount: e.commission, invoiceCount: e.invoices.length, qty: e.qty, sales: e.sales };
    await updateSalesRep(live.id, { settledAt: now, settlements: [rec, ...(live.settlements || [])].slice(0, 200) });
    let note = 'تمت التصفية وصُفّر رصيد المندوب ✅';
    if (telegramOn && tg.secret && storeUid) {
      try {
        const r: any = await tgNotify({
          storeUid, secret: tg.secret,
          text: formatRepSettlement(live, e.commission, e, ctx, false),
          repId: live.id,
          repText: formatRepSettlement(live, e.commission, e, ctx, true),
        });
        note += r?.sent > 0 ? ' وأُرسلت رسالة التليجرام.' : ' (لم تصل رسالة تليجرام: غير مرتبط).';
      } catch { note += ' (تعذر إرسال رسالة التليجرام).'; }
    }
    setDone(note);
    setBusy(false);
  };

  return (
    <div className={shell} dir="rtl" onClick={onClose}>
      <div className={`${card} max-w-2xl max-h-[90vh] flex flex-col`} onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" /> تصفية أرباح: {live.name}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="text-[11px] text-slate-500">
          {e.since ? `الحساب منذ آخر تصفية: ${new Date(e.since).toLocaleString('ar-IQ')}` : 'الحساب منذ البداية (لم تُجرَ تصفية سابقة)'}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-50 rounded-xl p-2"><div className="text-[10px] text-slate-500">القوائم</div><div className="font-black">{e.invoices.length}</div></div>
          <div className="bg-slate-50 rounded-xl p-2"><div className="text-[10px] text-slate-500">الكمية المباعة</div><div className="font-black">{e.qty.toLocaleString()}</div></div>
          <div className="bg-slate-50 rounded-xl p-2"><div className="text-[10px] text-slate-500">المبيعات</div><div className="font-black">{formatMoney(e.sales)}</div></div>
          <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-200"><div className="text-[10px] text-emerald-700">ربحه إلى الآن</div><div className="font-black text-emerald-800">{formatMoney(e.commission)}</div></div>
        </div>
        <div className="overflow-auto flex-1 border border-slate-200 rounded-xl min-h-[80px]">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr><th className="p-2">المادة</th><th className="p-2">الكمية</th><th className="p-2">المبيعات</th><th className="p-2">ربح المندوب</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {e.items.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">لا توجد مبيعات غير مصفّاة.</td></tr>}
              {e.items.map(it => (
                <tr key={it.key}>
                  <td className="p-2 font-bold">{it.name}</td>
                  <td className="p-2 font-mono">{it.qty.toLocaleString()} {it.unit}</td>
                  <td className="p-2 font-mono">{formatMoney(it.sales)}</td>
                  <td className="p-2 font-mono text-emerald-700">{formatMoney(it.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(live.commissionType === 'fixed_per_invoice') && (
          <div className="text-[11px] text-slate-500">العمولة هنا مبلغ ثابت لكل قائمة، لذلك لا تُوزَّع على المواد؛ المجموع أعلاه هو المعتمد.</div>
        )}
        {done && <div className="text-xs font-bold rounded-lg px-3 py-2 border text-emerald-800 bg-emerald-50 border-emerald-300">{done}</div>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 cursor-pointer">{done ? 'إغلاق' : 'إلغاء'}</button>
          {!done && (
            <button type="button" disabled={busy || e.invoices.length === 0} onClick={pay} className="px-5 py-2 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer">
              دفع الآن ({formatMoney(e.commission)})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

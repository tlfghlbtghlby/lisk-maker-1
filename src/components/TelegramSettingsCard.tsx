import React, { useEffect, useRef, useState } from 'react';
import { Send, Copy, Check, Link2, Unlink, Bell } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TelegramEventKey, TelegramSettings } from '../types';
import {
  DEFAULT_TELEGRAM_SETTINGS,
  TELEGRAM_EVENT_LABELS,
  describeTelegramError,
  generateTelegramCode,
  generateTelegramSecret,
  tgInfo,
  tgNotify,
  tgRegister,
  tgStatus,
  tgUnlink,
} from '../utils/telegram';

export const TelegramSettingsCard: React.FC = () => {
  const { settings, updateSettings, currentUser, sendDebtRemindersToAll, customers } = useApp();
  const tg: TelegramSettings = { ...DEFAULT_TELEGRAM_SETTINGS, ...(settings.telegram || {}) };
  const storeUid = currentUser?.uid || '';
  const storeName = currentUser?.storeName || currentUser?.displayName || '';

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sendAllDebts = async () => {
    if (!window.confirm(`إرسال إشعار بالدين لكل الزبائن (${customers.length} زبون) عبر التليجرام، بمن فيهم من دينه صفر؟ يصل فقط للمرتبطين بالبوت.`)) return;
    setBulkBusy(true);
    setBulkMsg(null);
    const r = await sendDebtRemindersToAll((d, t) => setBulkMsg({ ok: true, text: `جاري الإرسال... ${d}/${t}` }));
    setBulkBusy(false);
    setBulkMsg(r.error
      ? { ok: false, text: r.error }
      : { ok: true, text: `تم: وصل الإشعار إلى ${r.sent} زبون، و${r.notLinked} غير مرتبطين بالتليجرام${r.failed ? `، وفشل ${r.failed}` : ''}.` });
  };
  const registeredRef = useRef<string>('');

  const save = (patch: Partial<TelegramSettings>) =>
    updateSettings({ telegram: { ...DEFAULT_TELEGRAM_SETTINGS, ...(settings.telegram || {}), ...patch } });

  // إنشاء رمز المتجر وسرّه تلقائياً أول مرة
  useEffect(() => {
    if (!tg.code || !tg.secret) {
      save({
        code: tg.code || generateTelegramCode('ST'),
        secret: tg.secret || generateTelegramSecret(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تسجيل الرمز في الدالة (مرة لكل رمز)
  useEffect(() => {
    if (!tg.code || !tg.secret || !storeUid || registeredRef.current === tg.code) return;
    registeredRef.current = tg.code;
    tgRegister({ storeUid, secret: tg.secret, kind: 'store', code: tg.code, storeName }).catch(e => {
      registeredRef.current = '';
      setMsg({ ok: false, text: describeTelegramError(e) });
    });
    tgInfo()
      .then(r => r?.username && tg.botUsername !== r.username && save({ botUsername: r.username }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tg.code, tg.secret, storeUid]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(tg.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ ok: false, text: 'تعذر النسخ، انسخ الرمز يدوياً.' });
    }
  };

  const link = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // نعيد التسجيل احتياطاً (في حال لم يُسجَّل الرمز بعد) ثم نتحقق
      await tgRegister({ storeUid, secret: tg.secret, kind: 'store', code: tg.code, storeName });
      const r = await tgStatus({ storeUid, secret: tg.secret, kind: 'store' });
      if (r?.linked > 0) {
        save({ linked: true, linkedChats: r.linked, linkedAt: new Date().toISOString() });
        setMsg({ ok: true, text: 'تم الربط بنجاح ✅ — ستصلك الإشعارات على التليجرام.' });
        tgNotify({
          storeUid,
          secret: tg.secret,
          text: `✅ <b>تم الربط بنجاح</b>\nمتجر «${storeName}» متصل الآن. ستصلك هنا الأحداث التي تحددها من الإعدادات.`,
        }).catch(() => {});
      } else {
        save({ linked: false, linkedChats: 0 });
        setMsg({
          ok: false,
          text: 'لم يصل الرمز إلى البوت بعد. أرسل الرمز للبوت في التليجرام ثم اضغط «ربط بالتليجرام» مرة أخرى.',
        });
      }
    } catch (e) {
      setMsg({ ok: false, text: describeTelegramError(e) });
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm('فك ربط التليجرام؟ ستتوقف كل الإشعارات.')) return;
    setBusy(true);
    try {
      await tgUnlink({ storeUid, secret: tg.secret, kind: 'store' });
      save({ linked: false, linkedChats: 0 });
      setMsg({ ok: true, text: 'تم فك الربط.' });
    } catch (e) {
      setMsg({ ok: false, text: describeTelegramError(e) });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const r = await tgNotify({ storeUid, secret: tg.secret, text: '🔔 <b>رسالة تجريبية</b>\nالإشعارات تعمل بنجاح.' });
      setMsg(r?.sent > 0 ? { ok: true, text: 'أُرسلت رسالة تجريبية.' } : { ok: false, text: 'لا توجد محادثة مرتبطة. اربط المتجر أولاً.' });
    } catch (e) {
      setMsg({ ok: false, text: describeTelegramError(e) });
    } finally {
      setBusy(false);
    }
  };

  const setEvent = (k: TelegramEventKey, v: boolean) => save({ events: { ...tg.events, [k]: v } });
  const setAll = (v: boolean) =>
    save({ events: Object.keys(TELEGRAM_EVENT_LABELS).reduce((a, k) => ({ ...a, [k]: v }), {}) });

  const Toggle: React.FC<{ label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }> = ({
    label, hint, checked, onChange,
  }) => (
    <label className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#0b1728] border border-slate-200 dark:border-slate-700 cursor-pointer">
      <div>
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{label}</span>
        {hint && <span className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
      />
    </label>
  );

  return (
    <div className="bg-white dark:bg-[#0b1728] border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-xs space-y-5 mb-6" dir="rtl">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Send className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <span>بوت التليجرام — إشعارات المتجر</span>
        </h3>
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
            tg.linked
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-amber-50 text-amber-800 border-amber-300'
          }`}
        >
          {tg.linked ? `مرتبط (${tg.linkedChats || 1} محادثة)` : 'غير مرتبط'}
        </span>
      </div>

      {/* الربط */}
      <div className="bg-slate-50 dark:bg-[#070e1b] border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-decimal pr-5">
          <li>
            افتح البوت في التليجرام
            {tg.botUsername ? (
              <>
                {' '}
                <a className="font-bold text-sky-700 dark:text-sky-400 underline" href={`https://t.me/${tg.botUsername}`} target="_blank" rel="noreferrer">
                  @{tg.botUsername}
                </a>
              </>
            ) : null}
            {' '}واضغط Start.
          </li>
          <li>انسخ رمز متجرك أدناه وأرسله للبوت كما هو.</li>
          <li>عد إلى هنا واضغط «ربط بالتليجرام» ليتم التحقق.</li>
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <code
            dir="ltr"
            className="flex-1 min-w-[200px] text-center font-mono font-black tracking-widest text-lg px-4 py-2 rounded-xl bg-white dark:bg-[#060b13] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white select-all"
          >
            {tg.code || '...'}
          </code>
          <button type="button" onClick={copyCode} className="px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b1728] text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'تم النسخ' : 'نسخ الرمز'}
          </button>
          <button type="button" disabled={busy || !tg.code} onClick={link} className="px-4 py-2.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            <Link2 className="w-4 h-4" />
            ربط بالتليجرام
          </button>
          {tg.linked && (
            <>
              <button type="button" disabled={busy} onClick={sendTest} className="px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer">
                <Bell className="w-4 h-4" />
                رسالة تجريبية
              </button>
              <button type="button" disabled={busy} onClick={unlink} className="px-3 py-2.5 text-xs font-bold rounded-xl border border-rose-300 text-rose-700 bg-rose-50 flex items-center gap-1.5 cursor-pointer">
                <Unlink className="w-4 h-4" />
                فك الربط
              </button>
            </>
          )}
        </div>

        {msg && (
          <div className={`text-xs font-bold rounded-lg px-3 py-2 border ${msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-rose-800 bg-rose-50 border-rose-300'}`}>
            {msg.text}
          </div>
        )}
      </div>

      {/* خيارات عامة */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Toggle label="تفعيل الإشعارات" hint="إيقاف كل الإرسال مؤقتاً دون فك الربط" checked={tg.enabled} onChange={v => save({ enabled: v })} />
        <Toggle label="إرسال مواد القوائم بالتفصيل" hint="كل مادة بكميتها وسعرها ومجموعها" checked={tg.includeItems} onChange={v => save({ includeItems: v })} />
        <Toggle label="إظهار الأرباح والتكلفة" hint="ربح القائمة وعمولة المندوب وتكلفة المواد" checked={tg.includeProfit} onChange={v => save({ includeProfit: v })} />
        <Toggle label="إشعارات الزبائن المرتبطين" hint="إرسال قوائم الزبون ودينه ودفعاته لمن ربط رمزه بالبوت" checked={tg.customerNotifications} onChange={v => save({ customerNotifications: v })} />
      </div>

      {/* إشعار الديون لكل الزبائن */}
      <div className="bg-sky-50/60 dark:bg-[#070e1b] border border-sky-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
        <h4 className="text-xs font-black text-slate-900 dark:text-white">إشعار الزبائن بحساباتهم</h4>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          يرسل لكل زبون مرتبط بالبوت: آخر مبلغ أخذه بالدين، وآخر مبلغ سدّده، والمتبقي عليه. يشمل من دينه صفر أيضاً.
        </p>
        <button
          type="button"
          disabled={bulkBusy || !tg.linked || customers.length === 0}
          onClick={sendAllDebts}
          className="px-4 py-2.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {bulkBusy ? 'جاري الإرسال...' : 'إرسال إشعار الدين لكل الزبائن'}
        </button>
        {!tg.linked && <div className="text-[11px] text-amber-700">اربط التليجرام بالمتجر أولاً.</div>}
        {bulkMsg && (
          <div className={`text-xs font-bold rounded-lg px-3 py-2 border ${bulkMsg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-rose-800 bg-rose-50 border-rose-300'}`}>
            {bulkMsg.text}
          </div>
        )}
      </div>

      {/* الأحداث */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-black text-slate-900 dark:text-white">ماذا يرسل البوت؟</h4>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAll(true)} className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer">تحديد الكل</button>
            <button type="button" onClick={() => setAll(false)} className="text-[11px] font-bold text-rose-700 dark:text-rose-400 cursor-pointer">إلغاء الكل</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(Object.keys(TELEGRAM_EVENT_LABELS) as TelegramEventKey[]).map(k => (
            <Toggle
              key={k}
              label={TELEGRAM_EVENT_LABELS[k].label}
              hint={TELEGRAM_EVENT_LABELS[k].hint}
              checked={tg.events?.[k] !== false}
              onChange={v => setEvent(k, v)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TelegramSettingsCard;

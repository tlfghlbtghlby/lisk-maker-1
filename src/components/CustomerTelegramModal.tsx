import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Check, Link2, Unlink, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Customer } from '../types';
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

interface Props {
  customer: Customer;
  onClose: () => void;
}

export const CustomerTelegramModal: React.FC<Props> = ({ customer, onClose }) => {
  const { settings, updateSettings, updateCustomer, customers, currentUser } = useApp();
  const live = customers.find(c => c.id === customer.id) || customer;
  const tg = { ...DEFAULT_TELEGRAM_SETTINGS, ...(settings.telegram || {}) };
  const storeUid = currentUser?.uid || '';
  const storeName = currentUser?.storeName || currentUser?.displayName || '';

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [bot, setBot] = useState<string>(tg.botUsername || '');
  const started = useRef(false);

  // تأكد من وجود سرّ المتجر، ثم أنشئ رمز الزبون (فريد لكل متجر) وسجّله
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
            const candidate = generateTelegramCode('CU');
            try {
              await tgRegister({
                storeUid, secret, kind: 'customer', code: candidate,
                customerId: live.id, customerName: live.name, storeName,
              });
              code = candidate;
              break;
            } catch (e: any) {
              if (e?.message !== 'code_taken') throw e;
            }
          }
          if (!code) throw new Error('تعذر إنشاء رمز فريد');
          updateCustomer(live.id, { telegramCode: code });
        } else {
          await tgRegister({
            storeUid, secret, kind: 'customer', code,
            customerId: live.id, customerName: live.name, storeName,
          });
        }
        tgInfo().then(r => r?.username && setBot(r.username)).catch(() => {});
      } catch (e) {
        setMsg({ ok: false, text: describeTelegramError(e) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const check = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await tgStatus({ storeUid, secret: tg.secret, kind: 'customer', customerId: live.id });
      if (r?.linked > 0) {
        updateCustomer(live.id, { telegramLinked: true });
        setMsg({ ok: true, text: 'تم ربط حسابات الزبون بنجاح ✅' });
      } else {
        updateCustomer(live.id, { telegramLinked: false });
        setMsg({ ok: false, text: 'لم يصل الرمز للبوت بعد. اطلب من الزبون إرساله ثم اضغط تحقق.' });
      }
    } catch (e) {
      setMsg({ ok: false, text: describeTelegramError(e) });
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm('فك ربط هذا الزبون؟ ستتوقف إشعاراته.')) return;
    setBusy(true);
    try {
      await tgUnlink({ storeUid, secret: tg.secret, kind: 'customer', customerId: live.id });
      updateCustomer(live.id, { telegramLinked: false });
      setMsg({ ok: true, text: 'تم فك الربط.' });
    } catch (e) {
      setMsg({ ok: false, text: describeTelegramError(e) });
    } finally {
      setBusy(false);
    }
  };

  const sendStatement = async () => {
    setBusy(true);
    try {
      const r = await tgNotify({
        storeUid, secret: tg.secret, customerId: live.id,
        customerText: `📒 <b>رصيد حسابك — ${storeName}</b>\nالدين الحالي: <b>${Number(live.totalDebt || 0).toLocaleString()} ${settings.currency || ''}</b>`,
      });
      setMsg(r?.sent > 0 ? { ok: true, text: 'أُرسل رصيد الزبون.' } : { ok: false, text: 'الزبون غير مرتبط بعد.' });
    } catch (e) {
      setMsg({ ok: false, text: describeTelegramError(e) });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!live.telegramCode) return;
    try {
      await navigator.clipboard.writeText(live.telegramCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[85] bg-black/40 backdrop-blur-md flex items-center justify-center p-3" dir="rtl" onClick={onClose}>
      <div className="bg-white dark:bg-[#0b1728] border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-600" />
            ربط تليجرام للزبون: {live.name}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-6">
          أعطِ الزبون هذا الرمز ليرسله إلى البوت{bot ? <> <b>@{bot}</b></> : null}. بعدها تصله كل قوائمه ودينه والمسدَّد والمتبقي لحظة بلحظة.
          الرمز خاص بهذا الزبون في متجرك فقط.
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
              <button type="button" disabled={busy} onClick={sendStatement} className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer">
                إرسال رصيده الآن
              </button>
              <button type="button" disabled={busy} onClick={unlink} className="px-3 py-2 text-xs font-bold rounded-xl border border-rose-300 text-rose-700 bg-rose-50 flex items-center gap-1 cursor-pointer">
                <Unlink className="w-4 h-4" /> فك الربط
              </button>
            </>
          )}
        </div>

        {live.telegramLinked && !msg && (
          <div className="text-xs font-bold rounded-lg px-3 py-2 border text-emerald-800 bg-emerald-50 border-emerald-300">مرتبط بالتليجرام ✅</div>
        )}
        {msg && (
          <div className={`text-xs font-bold rounded-lg px-3 py-2 border ${msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-rose-800 bg-rose-50 border-rose-300'}`}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerTelegramModal;

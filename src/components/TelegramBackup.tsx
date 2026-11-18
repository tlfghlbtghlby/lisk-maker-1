import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Invoice, TelegramBackupSettings, TelegramSettings } from '../types';
import { DEFAULT_TELEGRAM_SETTINGS, describeTelegramError, tgDocument } from '../utils/telegram';
import { bytesToB64, gzipText } from '../utils/backupFile';
import { archiveCount, archiveGetAll, archiveHasAll, archivePutMany } from '../utils/invoiceArchive';

export const DEFAULT_BACKUP: TelegramBackupSettings = {
  enabled: false,
  hour: 23,
  hashtag: '#نسخة_احتياطية',
  archiveOld: false,
};

const ARCHIVE_MONTHS = 6;
const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const normalizeHashtag = (h: string) => {
  const t = String(h || '').trim().replace(/\s+/g, '_').replace(/^#+/, '');
  return '#' + (t || 'نسخة_احتياطية');
};

/** الفواتير المؤهلة للإخراج من المزامنة: أقدم من 6 أشهر وبلا دين متبقٍّ عليها. */
export function pickArchivable(invoices: Invoice[], now = new Date()): Invoice[] {
  const cut = new Date(now);
  cut.setMonth(cut.getMonth() - ARCHIVE_MONTHS);
  const cutMs = cut.getTime();
  return invoices.filter((i) => {
    const t = new Date(i.date || (i as any).createdAt || '').getTime();
    if (!t || isNaN(t) || t >= cutMs) return false;
    if ((Number(i.remainingAmount) || 0) > 0 && i.status !== 'returned') return false;
    return true;
  });
}

export function useTelegramBackup() {
  const { settings, updateSettings, currentUser, exportCustomBackup, invoices, products, customers, archiveInvoicesByIds } = useApp() as any;
  const tg: TelegramSettings = { ...DEFAULT_TELEGRAM_SETTINGS, ...(settings.telegram || {}) };
  const bk: TelegramBackupSettings = { ...DEFAULT_BACKUP, ...(tg.backup || {}) };
  const storeUid: string = currentUser?.uid || '';
  const storeName: string = currentUser?.storeName || currentUser?.displayName || '';

  const latest = useRef({ invoices, tg, bk });
  latest.current = { invoices, tg, bk };
  const running = useRef(false);

  const saveBackup = (patch: Partial<TelegramBackupSettings>) =>
    updateSettings({ telegram: { ...DEFAULT_TELEGRAM_SETTINGS, ...(settings.telegram || {}), backup: { ...DEFAULT_BACKUP, ...(tg.backup || {}), ...patch } } });

  const run = async (scheduled: boolean): Promise<{ ok: boolean; text: string }> => {
    if (running.current) return { ok: false, text: 'نسخة قيد الإرسال الآن.' };
    const cur = latest.current;
    if (!storeUid || !cur.tg.secret) return { ok: false, text: 'اربط التليجرام بالمتجر أولاً.' };
    running.current = true;
    try {
      const now = new Date();
      const snapshotInvoices: Invoice[] = cur.invoices;
      const archived = await archiveGetAll().catch(() => []);
      let json: string = exportCustomBackup({ scope: 'all' });
      const archivedJson = JSON.stringify(archived);
      json = json.replace(/\s*}\s*$/, () => `,\n  "archivedInvoices": ${archivedJson}\n}`);
      const gz = await gzipText(json);
      const b64 = bytesToB64(gz);
      const date = todayStr(now);
      const filename = scheduled ? `backup-${date}.json.gz` : `backup-${date}_${pad(now.getHours())}${pad(now.getMinutes())}.json.gz`;
      const tag = normalizeHashtag(cur.bk.hashtag);
      const storeTag = '#' + (storeName || 'المتجر').trim().replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '');
      const caption =
        `${tag} ${storeTag}\n📅 ${date} ${pad(now.getHours())}:${pad(now.getMinutes())}\n` +
        `🧾 ${snapshotInvoices.length} فاتورة${archived.length ? ` (+${archived.length} مؤرشفة)` : ''} · 📦 ${products.length} مادة · 👥 ${customers.length} زبون\n` +
        `💾 ${(gz.length / 1024).toFixed(0)} KB`;
      const r = await tgDocument({ storeUid, secret: cur.tg.secret, filename, caption, dataB64: b64 });
      if (!r?.sent) {
        return { ok: false, text: r?.linked ? 'تعذر إرسال الملف إلى تيليجرام.' : 'لا توجد محادثة تليجرام مرتبطة بالمتجر. اربط البوت أولاً.' };
      }
      let extra = '';
      if (cur.bk.archiveOld) {
        // الأمان: نُخرج الفواتير من المزامنة فقط بعد تأكّد وصول النسخة (sent>0) وكتابتها في الأرشيف المحلي والتحقق منها
        const cands = pickArchivable(snapshotInvoices, now);
        if (cands.length) {
          try {
            await archivePutMany(cands);
            if (await archiveHasAll(cands.map((c) => String(c.id)))) {
              const n = archiveInvoicesByIds(cands.map((c) => String(c.id)));
              extra = ` · أُخرجت ${n} فاتورة قديمة من المزامنة السحابية (محفوظة في النسخة وفي الأرشيف المحلي)`;
            } else {
              extra = ' · تعذر التحقق من الأرشيف المحلي فلم تُخرَج أي فاتورة';
            }
          } catch {
            extra = ' · تعذرت الأرشفة المحلية فلم تُخرَج أي فاتورة';
          }
        }
      }
      if (scheduled) saveBackup({ lastDate: date });
      return { ok: true, text: `وصلت النسخة (${filename})${extra}` };
    } catch (e: any) {
      return { ok: false, text: describeTelegramError(e) };
    } finally {
      running.current = false;
    }
  };
  return { tg, bk, saveBackup, run };
}

/** يعمل في الخلفية: يرسل النسخة اليومية بعد الساعة المحددة مرة واحدة لكل يوم. */
export const TelegramBackupRunner: React.FC = () => {
  const { bk, tg, run } = useTelegramBackup();
  const { currentUser } = useApp() as any;
  const state = useRef({ bk, tg, run });
  state.current = { bk, tg, run };

  useEffect(() => {
    if (!currentUser?.uid) return;
    const tick = () => {
      const { bk: b, tg: t, run: r } = state.current;
      if (!b.enabled || !t.linked || !t.secret) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const now = new Date();
      if (b.lastDate === todayStr(now) || now.getHours() < b.hour) return;
      try {
        const last = Number(localStorage.getItem('mufakir_bk_try') || 0);
        if (Date.now() - last < 30 * 60 * 1000) return; // لا نكرر المحاولة الفاشلة قبل نصف ساعة
        localStorage.setItem('mufakir_bk_try', String(Date.now()));
      } catch {}
      void r(true);
    };
    const first = setTimeout(tick, 20_000);
    const iv = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [currentUser?.uid]);

  return null;
};

/** قسم الإعدادات داخل بطاقة التليجرام. */
export const TelegramBackupSection: React.FC = () => {
  const { tg, bk, saveBackup, run } = useTelegramBackup();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [archived, setArchived] = useState(0);
  useEffect(() => { archiveCount().then(setArchived); }, [busy]);

  const now = async () => {
    setBusy(true); setMsg(null);
    const r = await run(false);
    setMsg(r); setBusy(false);
  };
  const toggleArchive = (v: boolean) => {
    if (v && !window.confirm(
      'تفعيل إخراج الفواتير الأقدم من 6 أشهر من المزامنة السحابية؟\n\n' +
      '• يحدث فقط بعد نجاح إرسال نسخة تليجرام تحتوي هذه الفواتير.\n' +
      '• تبقى محفوظة في ملفات تليجرام وفي أرشيف محلي على هذا الجهاز، لكنها تختفي من قائمة الفواتير ومن بقية الأجهزة والتقارير.\n' +
      '• لا تُخرَج الفواتير التي بقي عليها دين.\n' +
      '• تستطيع إعادتها لاحقاً من «تصفح/استعادة الفواتير من نسخة قديمة».'
    )) return;
    saveBackup({ archiveOld: v });
  };

  return (
    <div className="bg-violet-50/60 dark:bg-[#070e1b] border border-violet-200 dark:border-slate-700 rounded-xl p-4 space-y-3" data-testid="tg-backup">
      <h4 className="text-xs font-black text-slate-900 dark:text-white">💾 نسخة احتياطية يومية إلى تليجرام</h4>
      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
        يرسل البرنامج ملف نسخة كاملة (مضغوط) كل يوم إلى محادثتك مع البوت باسم تاريخ اليوم، وبهاشتاق تضغط عليه في تليجرام فتظهر لك كل النسخ. لا تُحفظ في السحابة.
      </p>
      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
        <input type="checkbox" checked={bk.enabled} onChange={(e) => saveBackup({ enabled: e.target.checked })} className="w-4 h-4" />
        تفعيل النسخة اليومية
      </label>
      {bk.enabled && (
        <div className="space-y-2 pr-6">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">وقت الإرسال:</span>
            <select value={bk.hour} onChange={(e) => saveBackup({ hour: Number(e.target.value) })} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#060b13] text-slate-900 dark:text-white text-xs">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${pad(h)}:00`}</option>)}
            </select>
            <span className="text-[11px] text-slate-500">يُرسل عند أول فتح للبرنامج بعد هذه الساعة (يجب أن يكون البرنامج مفتوحاً).</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">الهاشتاق:</span>
            <input value={bk.hashtag} onChange={(e) => saveBackup({ hashtag: e.target.value })} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#060b13] text-slate-900 dark:text-white text-xs font-mono w-48" dir="rtl" />
          </div>
          <label className="flex items-start gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
            <input type="checkbox" checked={bk.archiveOld} onChange={(e) => toggleArchive(e.target.checked)} className="w-4 h-4 mt-0.5" />
            <span>
              إخراج الفواتير الأقدم من 6 أشهر من المزامنة السحابية (توفير مساحة)
              <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">بعد نجاح النسخة فقط، وتبقى ضمن ملفات تليجرام. الأرشيف المحلي الحالي: {archived} فاتورة.</span>
            </span>
          </label>
          {bk.lastDate && <div className="text-[11px] text-slate-500">آخر نسخة يومية ناجحة: {bk.lastDate}</div>}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" disabled={busy || !tg.linked} onClick={now} className="px-4 py-2 text-xs font-bold rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 cursor-pointer" data-testid="tg-backup-now">
          {busy ? 'جاري الإرسال...' : '📤 إرسال نسخة الآن'}
        </button>
        {!tg.linked && <span className="text-[11px] text-amber-700">اربط التليجرام بالمتجر أولاً.</span>}
      </div>
      {msg && <div className={`text-xs font-bold rounded-lg px-3 py-2 border ${msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-rose-800 bg-rose-50 border-rose-300'}`}>{msg.text}</div>}
    </div>
  );
};

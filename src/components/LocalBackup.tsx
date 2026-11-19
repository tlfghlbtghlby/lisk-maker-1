import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { bytesToB64, gzipText } from '../utils/backupFile';
import { archiveGetAll } from '../utils/invoiceArchive';

/** النسخة اليومية المحلية (ويندوز/Electron): الإعداد خاص بكل جهاز ولا يُزامَن. */
interface LocalBk { enabled: boolean; dir: string; hour: number; keep: number; lastDate?: string }
const KEY = 'mufakir_local_bk';
const DEF: LocalBk = { enabled: false, dir: '', hour: 22, keep: 30 };
const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const api = (): any => (window as any).electronAPI || (window as any).electron;
export const canLocalBackup = () => !!api()?.saveLocalBackup;

const load = (): LocalBk => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEF; } };
const store = (v: LocalBk) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

function useLocalBackup() {
  const { exportCustomBackup } = useApp() as any;
  const [cfg, setCfg] = useState<LocalBk>(load);
  const exp = useRef(exportCustomBackup); exp.current = exportCustomBackup;
  const running = useRef(false);
  const save = (patch: Partial<LocalBk>) => setCfg((c) => { const n = { ...c, ...patch }; store(n); return n; });

  const run = async (scheduled: boolean, c: LocalBk = cfg): Promise<{ ok: boolean; text: string }> => {
    if (!canLocalBackup()) return { ok: false, text: 'متاح في نسخة سطح المكتب (ويندوز) فقط.' };
    if (!c.dir) return { ok: false, text: 'اختر المجلد أولاً.' };
    if (running.current) return { ok: false, text: 'نسخة قيد الحفظ الآن.' };
    running.current = true;
    try {
      const now = new Date();
      const archived = await archiveGetAll().catch(() => []);
      let json: string = exp.current({ scope: 'all' });
      json = json.replace(/\s*}\s*$/, () => `,\n  "archivedInvoices": ${JSON.stringify(archived)}\n}`);
      const b64 = bytesToB64(await gzipText(json));
      const date = todayStr(now);
      const filename = scheduled ? `mufakir-backup-${date}.json.gz` : `mufakir-backup-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.json.gz`;
      const r = await api().saveLocalBackup({ dir: c.dir, filename, dataB64: b64, keep: c.keep });
      if (!r?.success) return { ok: false, text: 'تعذر الحفظ في المجلد (' + (r?.error || '؟') + '). تأكد أن المجلد موجود وقابل للكتابة.' };
      if (scheduled) save({ lastDate: date });
      return { ok: true, text: `حُفظت النسخة: ${r.path} (${(r.size / 1024).toFixed(0)} KB)${r.removed ? ` · حُذفت ${r.removed} نسخة أقدم` : ''}` };
    } catch (e: any) {
      return { ok: false, text: 'تعذر إنشاء النسخة: ' + (e?.message || '') };
    } finally { running.current = false; }
  };
  return { cfg, save, run };
}

/** يعمل في الخلفية: نسخة واحدة كل يوم بعد الساعة المحددة. */
export const LocalBackupRunner: React.FC = () => {
  const { currentUser } = useApp() as any;
  const { cfg, run } = useLocalBackup();
  const st = useRef({ cfg, run }); st.current = { cfg, run };
  useEffect(() => {
    if (!currentUser?.uid || !canLocalBackup()) return;
    const tick = () => {
      const c = load(); // الإعداد الحالي (قد يتغير من نافذة أخرى)
      if (!c.enabled || !c.dir) return;
      const now = new Date();
      if (c.lastDate === todayStr(now) || now.getHours() < c.hour) return;
      try {
        const last = Number(localStorage.getItem('mufakir_lbk_try') || 0);
        if (Date.now() - last < 30 * 60 * 1000) return;
        localStorage.setItem('mufakir_lbk_try', String(Date.now()));
      } catch {}
      void st.current.run(true, c);
    };
    const first = setTimeout(tick, 30_000);
    const iv = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [currentUser?.uid]);
  return null;
};

export const LocalBackupSection: React.FC = () => {
  const { cfg, save, run } = useLocalBackup();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!canLocalBackup()) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400" data-testid="local-backup-unavailable">
        💽 النسخة اليومية في مجلد على الكمبيوتر تعمل في نسخة سطح المكتب (ويندوز) فقط، لأن المتصفح لا يسمح بالكتابة الصامتة في مجلد.
      </div>
    );
  }
  const pick = async () => {
    const d = await api().pickBackupFolder?.();
    if (d) save({ dir: d });
  };
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3" data-testid="local-backup">
      <h4 className="text-xs font-black text-slate-900 dark:text-white">💽 نسخة احتياطية يومية في مجلد على هذا الكمبيوتر</h4>
      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">يحفظ البرنامج ملف نسخة كاملة مضغوط كل يوم في المجلد الذي تختاره (يُفضّل قرص آخر أو فلاشة). الإعداد خاص بهذا الجهاز.</p>
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <button type="button" onClick={pick} className="px-3 py-1.5 rounded-lg bg-slate-700 text-white font-bold cursor-pointer" data-testid="local-backup-pick">📁 اختيار المجلد</button>
        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 break-all" dir="ltr">{cfg.dir || 'لم يُحدَّد مجلد'}</span>
      </div>
      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
        <input type="checkbox" checked={cfg.enabled} disabled={!cfg.dir} onChange={(e) => save({ enabled: e.target.checked })} className="w-4 h-4" data-testid="local-backup-enable" />
        تفعيل النسخة اليومية {!cfg.dir && <span className="text-[11px] font-normal text-amber-700">(اختر المجلد أولاً)</span>}
      </label>
      {cfg.enabled && (
        <div className="space-y-2 pr-6 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 dark:text-slate-300">الوقت:</span>
            <select value={cfg.hour} onChange={(e) => save({ hour: Number(e.target.value) })} className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#060b13] text-slate-900 dark:text-white">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${pad(h)}:00`}</option>)}
            </select>
            <span className="font-bold text-slate-700 dark:text-slate-300">الاحتفاظ بآخر</span>
            <input type="number" min={3} max={365} value={cfg.keep} onChange={(e) => save({ keep: Math.max(3, Math.min(365, Number(e.target.value) || 30)) })} className="w-16 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#060b13] text-slate-900 dark:text-white text-center" />
            <span className="text-slate-600 dark:text-slate-400">نسخة</span>
          </div>
          <div className="text-[11px] text-slate-500">تُحفظ عند أول تشغيل للبرنامج بعد هذه الساعة (البرنامج يجب أن يكون مفتوحاً). يُحذف الأقدم تلقائياً ضمن ملفات النسخ فقط ({'mufakir-backup-*.json.gz'}).</div>
          {cfg.lastDate && <div className="text-[11px] text-slate-500">آخر نسخة يومية ناجحة: {cfg.lastDate}</div>}
        </div>
      )}
      <button type="button" disabled={busy || !cfg.dir} onClick={async () => { setBusy(true); setMsg(null); setMsg(await run(false)); setBusy(false); }}
        className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 cursor-pointer" data-testid="local-backup-now">
        {busy ? 'جاري الحفظ...' : '💾 حفظ نسخة الآن'}
      </button>
      {msg && <div className={`text-xs font-bold rounded-lg px-3 py-2 border break-all ${msg.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-rose-800 bg-rose-50 border-rose-300'}`}>{msg.text}</div>}
    </div>
  );
};

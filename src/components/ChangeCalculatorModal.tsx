import React, { useEffect, useMemo, useState } from 'react';
import { Printer, CheckCircle2, RotateCcw, Minus, Camera, X, ImageIcon } from 'lucide-react';
import { idbGetRaw, idbSetRaw } from '../utils/localImageStore';
import { resizeImageFile } from '../utils/imageResize';
import note250 from '../assets/notes/250.png';
import note500 from '../assets/notes/500.png';
import note1000 from '../assets/notes/1000.png';
import note5000 from '../assets/notes/5000.png';
import note10000 from '../assets/notes/10000.png';
import note25000 from '../assets/notes/25000.png';
import note50000 from '../assets/notes/50000.png';

// صور الأوراق النقدية الجاهزة (قدّمها صاحب المتجر)؛ يمكن استبدالها بصورة أخرى لكل جهاز من زر «صور الفئات»
const BUILTIN_IMGS: Record<number, string> = {
  250: note250, 500: note500, 1000: note1000, 5000: note5000, 10000: note10000, 25000: note25000, 50000: note50000,
};

// فئات النقود العراقية مع ألوان تقريبية تشبه الورقة
const NOTES: { v: number; bg: string; fg: string }[] = [
  { v: 50000, bg: '#d9c8ee', fg: '#3b1d63' },
  { v: 25000, bg: '#f4a3a3', fg: '#7f1d1d' },
  { v: 10000, bg: '#e6d6a8', fg: '#5a4510' },
  { v: 5000, bg: '#a9d8cc', fg: '#0f4a3e' },
  { v: 1000, bg: '#a7c8ec', fg: '#12385f' },
  { v: 500, bg: '#cfe0a0', fg: '#3a5410' },
  { v: 250, bg: '#ecd2a0', fg: '#6b4510' },
];

interface Props {
  total: number;
  formatMoney: (n: number) => string;
  canSave: boolean;
  onClose: () => void;
  onSave: (andPrint: boolean) => void;
}

/** حاسبة الباقي: ضغطة على الفئة تُضيفها مرة، والباقي يُحسب فوراً. الإلغاء يغلق الحاسبة فقط. */
export const ChangeCalculatorModal: React.FC<Props> = ({ total, formatMoney, canSave, onClose, onSave }) => {
  const [taps, setTaps] = useState<number[]>([]);
  const [manual, setManual] = useState('');
  // صور الأوراق النقدية: يضيفها صاحب المتجر من الصور الرسمية، وتُحفظ على هذا الجهاز فقط
  const [customImgs, setImgs] = useState<Record<number, string>>({});
  const imgs = useMemo(() => ({ ...BUILTIN_IMGS, ...customImgs }), [customImgs]);
  const [customize, setCustomize] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const pickFor = React.useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<number, string> = {};
      for (const n of NOTES) {
        try {
          const d = await idbGetRaw(`note_img:${n.v}`);
          if (d) out[n.v] = d;
        } catch {}
      }
      if (alive) setImgs(out);
    })();
    return () => { alive = false; };
  }, []);

  const saveNoteImage = async (v: number, file?: File | null) => {
    if (!file) return;
    try {
      const data = await resizeImageFile(file, 700, 0.88);
      await idbSetRaw(`note_img:${v}`, data);
      setImgs((prev) => ({ ...prev, [v]: data }));
    } catch {}
    if (fileRef.current) fileRef.current.value = '';
  };
  const clearNoteImage = async (v: number) => {
    try { await idbSetRaw(`note_img:${v}`, null); } catch {}
    setImgs((prev) => { const n = { ...prev }; delete n[v]; return n; });
  };

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    taps.forEach((v) => m.set(v, (m.get(v) || 0) + 1));
    return m;
  }, [taps]);

  const manualNum = Math.max(0, parseFloat(manual.replace(/,/g, '')) || 0);
  const received = taps.reduce((a, b) => a + b, 0) + manualNum;
  const diff = received - total;

  const removeOne = (v: number) => {
    setTaps((prev) => {
      const i = prev.lastIndexOf(v);
      if (i < 0) return prev;
      return [...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // لا نتدخل أثناء الكتابة في حقل المبلغ اليدوي إلا بـ Esc
      const inInput = (e.target as HTMLElement)?.tagName === 'INPUT';
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Backspace' && !inInput) {
        e.preventDefault();
        setTaps((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter' && !inInput) {
        // لا حفظ عرضي بـ Enter أثناء الحساب
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-3" dir="rtl" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#0b1728] text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-black">💵 حاسبة الباقي</h3>
          <span className="text-[11px] text-slate-500">اضغط الفئة المستلمة · Backspace تراجع · Esc إغلاق</span>
        </div>

        <div className="p-3 sm:p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (pickFor.current != null) saveNoteImage(pickFor.current, e.target.files?.[0]); }} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {NOTES.map(({ v, bg, fg }) => {
              const c = counts.get(v) || 0;
              const active = c > 0;
              return (
                <div key={v} className="relative pt-2.5">
                  {active && (
                    <>
                      <span className="absolute top-0 right-1 z-10 min-w-[24px] h-6 px-1.5 rounded-full bg-yellow-400 text-slate-900 text-xs font-black flex items-center justify-center shadow ring-2 ring-white">
                        {c}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeOne(v)}
                        aria-label="تنقيص واحدة"
                        className="absolute top-0 left-1 z-10 w-6 h-6 min-h-0 rounded-full bg-white text-slate-700 border border-slate-300 flex items-center justify-center shadow cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setTaps((prev) => [...prev, v])}
                    style={imgs[v] ? undefined : { backgroundColor: active ? '#fde047' : bg, color: active ? '#422006' : fg }}
                    className={`relative overflow-hidden w-full aspect-[2/1] rounded-xl border-2 flex flex-col items-center justify-center font-black transition cursor-pointer select-none active:scale-95 ${
                      active ? 'border-yellow-500 ring-2 ring-yellow-300 shadow-md' : 'border-black/10 hover:brightness-95'
                    }`}
                  >
                    {imgs[v] ? (
                      <>
                        <img src={imgs[v]} alt={`${v}`} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                        {active && <span className="absolute inset-0 bg-yellow-300/55" />}
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-mono leading-none">{v.toLocaleString('en-US')}</span>
                        <span className="text-[11px] opacity-70 mt-1">دينار</span>
                      </>
                    )}
                  </button>
                  {customize && (
                    <div className="absolute bottom-1 inset-x-1 z-10 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => { pickFor.current = v; fileRef.current?.click(); }}
                        className="w-7 h-7 min-h-0 rounded-full bg-white/95 text-slate-800 border border-slate-300 shadow flex items-center justify-center cursor-pointer"
                        title="اختيار صورة لهذه الفئة"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                      {customImgs[v] && (
                        <button
                          type="button"
                          onClick={() => clearNoteImage(v)}
                          className="w-7 h-7 min-h-0 rounded-full bg-white/95 text-rose-600 border border-rose-300 shadow flex items-center justify-center cursor-pointer"
                          title="حذف الصورة"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="font-bold text-slate-600 dark:text-slate-300 shrink-0">+ مبلغ آخر مستلم:</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="0"
              className="w-36 text-center font-mono font-bold border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-[#0b1728]"
            />
            <button
              type="button"
              onClick={() => setCustomize((c) => !c)}
              className={`mr-auto flex items-center gap-1 px-3 py-1.5 rounded-lg border font-bold cursor-pointer ${customize ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
              title="أضف صورة الورقة النقدية لكل فئة (تُحفظ على هذا الجهاز)"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              صور الفئات
            </button>
            <button
              type="button"
              onClick={() => { setTaps([]); setManual(''); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              مسح الكل
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-2 py-2.5">
              <div className="text-[11px] font-bold text-slate-500">مجموع القائمة</div>
              <div className="text-lg font-black font-mono">{formatMoney(total)}</div>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-2 py-2.5">
              <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300">المستلم</div>
              <div className="text-lg font-black font-mono text-amber-900 dark:text-amber-200">{formatMoney(received)}</div>
            </div>
            <div
              className={`rounded-xl px-2 py-2.5 ${
                received === 0
                  ? 'bg-slate-100 dark:bg-slate-800'
                  : diff >= 0
                  ? 'bg-emerald-500 text-white'
                  : 'bg-rose-500 text-white'
              }`}
            >
              <div className="text-[11px] font-bold opacity-90">
                {received === 0 ? 'الباقي' : diff >= 0 ? 'الباقي للزبون' : 'ناقص على الزبون'}
              </div>
              <div className="text-xl font-black font-mono">{received === 0 ? '—' : formatMoney(Math.abs(diff))}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => onSave(true)}
              className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              حفظ وطباعة
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => onSave(false)}
              className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              حفظ فقط
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-sm cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

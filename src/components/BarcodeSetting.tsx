import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { labelOptsFromSettings, printLabels } from '../utils/barcodeSheet';

const PRESETS: { k: string; t: string; w: number; h: number }[] = [
  { k: '50x30', t: '50 × 30 (الأشهر)', w: 50, h: 30 },
  { k: '40x30', t: '40 × 30', w: 40, h: 30 },
  { k: '40x25', t: '40 × 25', w: 40, h: 25 },
  { k: '58x40', t: '58 × 40', w: 58, h: 40 },
  { k: '60x40', t: '60 × 40', w: 60, h: 40 },
  { k: '38x25', t: '38 × 25', w: 38, h: 25 },
  { k: '30x20', t: '30 × 20', w: 30, h: 20 },
  { k: '70x40', t: '70 × 40', w: 70, h: 40 },
  { k: '100x50', t: '100 × 50', w: 100, h: 50 },
];

/** إعدادات طباعة الباركود من قائمة المخزن (كليك يمين ← طباعة باركود) */
export default function BarcodeSetting() {
  const { settings, updateSettings } = useApp() as any;
  const mode: 'ask' | 'one' | 'fixed' = settings?.barcodePrintMode || 'ask';
  const o = labelOptsFromSettings(settings);
  const [printers, setPrinters] = useState<any[]>([]);
  useEffect(() => {
    const api = (window as any).electronAPI || (window as any).electron;
    if (api && typeof api.getPrinters === 'function') api.getPrinters().then((l: any) => { if (Array.isArray(l)) setPrinters(l); }).catch(() => {});
  }, []);
  const isElectron = !!((window as any).electronAPI?.printSilent);
  const num = (v: any, d: number) => (Number(v) > 0 ? Number(v) : d);
  const Opt = ({ v, title }: { v: 'ask' | 'one' | 'fixed'; title: string }) => (
    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
      <input type="radio" name="bc-mode" data-testid={`bc-mode-${v}`} checked={mode === v} onChange={() => updateSettings({ barcodePrintMode: v })} className="w-4 h-4 text-emerald-600" />
      {title}
    </label>
  );
  const inp = 'w-20 h-8 px-2 text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-xs';
  const sel = 'h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold';
  const lbl = 'flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 flex-wrap';
  const presetKey = PRESETS.find((p) => p.w === o.w && p.h === o.h)?.k || 'custom';
  const setNum = (key: string, lo: number, hi: number) => (e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ [key]: Math.max(lo, Math.min(hi, Number(e.target.value) || 0)) });

  return (
    <div data-testid="barcode-setting" className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <div className="text-xs font-black text-slate-900 dark:text-white">🏷️ طباعة الباركود (كليك يمين على المادة في المخزن)</div>
      <div className="space-y-2">
        <Opt v="ask" title="أسأل عن العدد في كل مرة" />
        <Opt v="one" title="اطبع ملصقاً واحداً تلقائياً" />
        <Opt v="fixed" title="اطبع عدداً ثابتاً تلقائياً" />
        {mode === 'fixed' && (
          <div className="flex items-center gap-2 pr-6 text-xs text-slate-600 dark:text-slate-300">
            العدد: <input type="number" min={1} max={999} data-testid="bc-fixed-count" className={inp} value={num(settings?.barcodePrintCount, 1)} onChange={(e) => updateSettings({ barcodePrintCount: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })} />
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
        <div className="text-[11px] font-black text-slate-700 dark:text-slate-200">نوع الورق</div>
        <div className="space-y-1.5">
          <label className="flex items-start gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
            <input type="radio" name="bc-paper" data-testid="bc-paper-label" checked={o.mode === 'label'} onChange={() => updateSettings({ barcodePaperMode: 'label' })} className="w-4 h-4 mt-0.5" />
            <span>ورق ملصقات (ليبل) جاهز <span className="block font-normal text-[11px] text-slate-500">كل ملصق في مكانه على الرول، والطابعة تقطع/تتوقف عند الفجوة.</span></span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
            <input type="radio" name="bc-paper" data-testid="bc-paper-roll" checked={o.mode === 'roll'} onChange={() => updateSettings({ barcodePaperMode: 'roll' })} className="w-4 h-4 mt-0.5" />
            <span>ورق متصل / طابعة فواتير <span className="block font-normal text-[11px] text-slate-500">تُترك مسافة وخط قص متقطع ✂ بين كل ملصق وآخر لتقصّها وتلصقها على المادة.</span></span>
          </label>
        </div>
      </div>

      <div className={lbl}>
        مقاس الملصق (مم):
        <select className={sel} data-testid="bc-preset" value={presetKey} onChange={(e) => { const p = PRESETS.find((x) => x.k === e.target.value); if (p) updateSettings({ barcodeLabelW: p.w, barcodeLabelH: p.h }); }}>
          {PRESETS.map((p) => <option key={p.k} value={p.k}>{p.t}</option>)}
          <option value="custom">مخصص</option>
        </select>
        <input type="number" min={20} max={120} className={inp} value={o.w} data-testid="bc-w" onChange={setNum('barcodeLabelW', 20, 120)} />
        ×
        <input type="number" min={15} max={120} className={inp} value={o.h} data-testid="bc-h" onChange={setNum('barcodeLabelH', 15, 120)} />
      </div>
      {o.mode === 'roll' && (
        <div className={lbl}>
          عرض الورق (مم): <input type="number" min={40} max={120} className={inp} value={o.rollW} data-testid="bc-rollw" onChange={setNum('barcodeRollW', 40, 120)} />
          الفراغ بين الملصقات (مم): <input type="number" min={2} max={30} className={inp} value={o.gap} data-testid="bc-gap" onChange={setNum('barcodeGap', 2, 30)} />
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-700 dark:text-slate-200">
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={o.showName} onChange={(e) => updateSettings({ barcodeShowName: e.target.checked })} /> اسم المادة</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={o.showNumber} onChange={(e) => updateSettings({ barcodeShowNumber: e.target.checked })} /> رقم الباركود</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={o.rotate} onChange={(e) => updateSettings({ barcodeRotate: e.target.checked })} /> تدوير 90° (إذا خرج الملصق على جنبه)</label>
      </div>

      <details className="text-xs text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-bold">معايرة دقيقة (إزاحة الطباعة)</summary>
        <div className={`${lbl} mt-2`}>
          أفقياً (مم): <input type="number" step={0.5} min={-10} max={10} className={inp} value={o.offsetX} onChange={(e) => updateSettings({ barcodeOffsetX: Math.max(-10, Math.min(10, Number(e.target.value) || 0)) })} />
          عمودياً (مم): <input type="number" step={0.5} min={-10} max={10} className={inp} value={o.offsetY} onChange={(e) => updateSettings({ barcodeOffsetY: Math.max(-10, Math.min(10, Number(e.target.value) || 0)) })} />
        </div>
        <p className="text-[11px] text-slate-500 mt-1">إن كان الملصق مزاحاً قليلاً عن حافة الورق فحرّكه بهذه القيم (موجب لليمين/للأسفل).</p>
      </details>

      <div className={lbl}>
        الطابعة:
        {isElectron ? (
          <select className={`${sel} max-w-[260px]`} data-testid="bc-printer" value={settings?.barcodePrinter || ''} onChange={(e) => updateSettings({ barcodePrinter: e.target.value })}>
            <option value="">نافذة الطباعة (أختار الطابعة كل مرة)</option>
            {printers.map((p) => <option key={p.name} value={p.name}>{p.displayName || p.name}{p.isDefault ? ' (الافتراضية)' : ''}</option>)}
          </select>
        ) : <span className="text-[11px] text-slate-500">تظهر نافذة الطباعة: اختر طابعة الملصقات، وحجم الورق نفس مقاس الملصق أعلاه، والمقياس «الحجم الفعلي» (100%) وبلا هوامش.</span>}
        <button type="button" data-testid="bc-test" onClick={() => printLabels('منتج تجريبي — اختبار الطباعة', '6281001234567', 2, o, settings?.barcodePrinter || undefined)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer">طباعة ملصقين تجريبيين</button>
      </div>
      {isElectron && <p className="text-[11px] text-slate-500 dark:text-slate-400">عند اختيار طابعة الملصقات تُطبع مباشرة بدون نافذة وبمقاس الورق الدقيق. تأكد أن تعريف الطابعة يدعم مقاساً مخصصاً أو أن مقاس الورق في إعدادات التعريف يساوي مقاس الملصق.</p>}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">النوع المستخدم: EAN-13 للأرقام التجارية الصحيحة، وإلا Code 128 (مضغوط للأرقام فيخرج قصيراً وواضحاً حتى على أضعف القارئات الليزرية).</p>
    </div>
  );
}

import React from 'react';
import { useApp } from '../context/AppContext';

/** إعدادات طباعة الباركود من قائمة المخزن (كليك يمين ← طباعة باركود) */
export default function BarcodeSetting() {
  const { settings, updateSettings } = useApp() as any;
  const mode: 'ask' | 'one' | 'fixed' = settings?.barcodePrintMode || 'ask';
  const num = (v: any, d: number) => (Number(v) > 0 ? Number(v) : d);
  const Opt = ({ v, title }: { v: 'ask' | 'one' | 'fixed'; title: string }) => (
    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
      <input type="radio" name="bc-mode" data-testid={`bc-mode-${v}`} checked={mode === v} onChange={() => updateSettings({ barcodePrintMode: v })} className="w-4 h-4 text-emerald-600" />
      {title}
    </label>
  );
  const inp = 'w-20 h-8 px-2 text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold text-xs';
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
      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
        مقاس الملصق (مم):
        <input type="number" min={20} max={120} className={inp} value={num(settings?.barcodeLabelW, 50)} onChange={(e) => updateSettings({ barcodeLabelW: Math.max(20, Math.min(120, Number(e.target.value) || 50)) })} />
        ×
        <input type="number" min={15} max={120} className={inp} value={num(settings?.barcodeLabelH, 30)} onChange={(e) => updateSettings({ barcodeLabelH: Math.max(15, Math.min(120, Number(e.target.value) || 30)) })} />
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">النوع المستخدم: EAN-13 للأرقام التجارية الصحيحة، وإلا Code 128 (مضغوط للأرقام فيخرج قصيراً وواضحاً حتى على أضعف القارئات الليزرية).</p>
    </div>
  );
}

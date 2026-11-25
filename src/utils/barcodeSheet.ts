import { useSyncExternalStore } from 'react';
import { encodeBarcode, barcodeSvg } from './barcodeSvg';

/** ورقة الباركودات المجمّعة: محفوظة على هذا الجهاز فقط (لا تُرفع للسحابة) */
export interface SheetItem { productId: string; name: string; code: string; qty: number; }
export interface SheetLayout { cols: number; barHeightMm: number; nameFontPt: number; showName: boolean; }
interface SheetState { items: SheetItem[]; layout: SheetLayout; }

const KEY = 'mufakir_barcode_sheet_v1';
export const DEFAULT_LAYOUT: SheetLayout = { cols: 3, barHeightMm: 14, nameFontPt: 9, showName: true };

function load(): SheetState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && Array.isArray(raw.items)) {
      return { items: raw.items.filter((i: any) => i && i.code), layout: { ...DEFAULT_LAYOUT, ...(raw.layout || {}) } };
    }
  } catch { /* ignore */ }
  return { items: [], layout: { ...DEFAULT_LAYOUT } };
}

let state: SheetState = load();
const listeners = new Set<() => void>();
function commit(next: SheetState) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useBarcodeSheet(): SheetState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const barcodeSheet = {
  get: () => state,
  add(item: { productId: string; name: string; code: string }, qty = 1) {
    if (!item.code) return;
    const items = [...state.items];
    const i = items.findIndex((x) => x.productId === item.productId);
    if (i >= 0) items[i] = { ...items[i], qty: items[i].qty + qty };
    else items.push({ ...item, qty });
    commit({ ...state, items });
  },
  setQty(productId: string, qty: number) {
    const q = Math.max(1, Math.min(999, Math.floor(qty) || 1));
    commit({ ...state, items: state.items.map((x) => (x.productId === productId ? { ...x, qty: q } : x)) });
  },
  remove(productId: string) { commit({ ...state, items: state.items.filter((x) => x.productId !== productId) }); },
  clear() { commit({ ...state, items: [] }); },
  setLayout(p: Partial<SheetLayout>) { commit({ ...state, layout: { ...state.layout, ...p } }); },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** عرض الباركود المناسب لعرض الخلية: وحدة 0.33مم (أمان للقارئات الضعيفة) وتصغر حتى 0.26 إن ضاقت الخلية */
function fitModule(code: string, cellWidthMm: number): number {
  const total = encodeBarcode(code).total;
  const ideal = 0.4;
  const fit = (cellWidthMm - 2) / total;
  return Math.max(0.26, Math.min(ideal, fit));
}

function cell(name: string, code: string, cellW: number, barH: number, fontPt: number, showName: boolean) {
  const mod = fitModule(code, cellW);
  const { svg } = barcodeSvg(code, { moduleMm: mod, heightMm: barH });
  return `<div class="bc-cell">${showName ? `<div class="bc-name" style="font-size:${fontPt}pt">${esc(name)}</div>` : ''}${svg}<div class="bc-num" style="font-size:${Math.max(7, fontPt - 1)}pt">${esc(code)}</div></div>`;
}

const BASE_CSS = `
.bc-sheet{display:grid;gap:0;direction:ltr;background:#fff;color:#000}
.bc-cell{box-sizing:border-box;border:0.2mm dashed #b8b8b8;padding:1.6mm 1mm 1.2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;break-inside:avoid;page-break-inside:avoid;overflow:hidden;font-family:Tahoma,Arial,sans-serif}
.bc-name{font-weight:700;text-align:center;line-height:1.25;max-height:2.55em;overflow:hidden;width:100%;direction:rtl;margin-bottom:0.8mm}
.bc-cell svg{display:block;max-width:100%}
.bc-num{font-family:"Courier New",monospace;letter-spacing:0.35mm;margin-top:0.7mm;font-weight:600}
.bc-label{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;font-family:Tahoma,Arial,sans-serif;background:#fff;color:#000}
`;

/** ورقة A4 مرتبة: كل مادة تتكرر بعدد الكمية */
export function buildSheetHtml(items: SheetItem[], layout: SheetLayout): string {
  const cols = Math.min(6, Math.max(1, layout.cols));
  const cellW = (210 - 12) / cols; // هوامش 6مم
  const cells: string[] = [];
  for (const it of items) for (let i = 0; i < it.qty; i++) cells.push(cell(it.name, it.code, cellW, layout.barHeightMm, layout.nameFontPt, layout.showName));
  return `<style>${BASE_CSS}</style><div class="bc-sheet" style="grid-template-columns:repeat(${cols},1fr)">${cells.join('')}</div>`;
}

export interface LabelSize { w: number; h: number; }

/** خيارات ملصق الباركود المنفرد (ملصق لكل صفحة) — تُقرأ من إعدادات المتجر */
export interface LabelOpts {
  w: number; h: number;
  /** label: ورق ليبل جاهز (صفحة = الملصق) | roll: ورق متصل/طابعة فواتير (يُترك فراغ وخط قص بين الملصقات) */
  mode: 'label' | 'roll';
  rollW: number;       // عرض ورق الرول (مم) في وضع roll
  gap: number;         // الفراغ بين الملصقات (مم) في وضع roll
  rotate: boolean;     // تدوير 90° (لبعض الطابعات التي تغذّي الورق بالعرض)
  offsetX: number; offsetY: number; // إزاحة دقيقة (مم) لمعايرة الطابعة
  showName: boolean; showNumber: boolean;
}
export const DEFAULT_LABEL_OPTS: LabelOpts = { w: 50, h: 30, mode: 'label', rollW: 80, gap: 4, rotate: false, offsetX: 0, offsetY: 0, showName: true, showNumber: true };

export function labelOptsFromSettings(s: any): LabelOpts {
  const n = (v: any, d: number, lo: number, hi: number) => { const x = Number(v); return Number.isFinite(x) && v !== '' && v !== null && v !== undefined ? Math.max(lo, Math.min(hi, x)) : d; };
  return {
    w: n(s?.barcodeLabelW, 50, 20, 120), h: n(s?.barcodeLabelH, 30, 15, 120),
    mode: s?.barcodePaperMode === 'roll' ? 'roll' : 'label',
    rollW: n(s?.barcodeRollW, 80, 40, 120), gap: n(s?.barcodeGap, 4, 2, 30),
    rotate: s?.barcodeRotate === true,
    offsetX: n(s?.barcodeOffsetX, 0, -10, 10), offsetY: n(s?.barcodeOffsetY, 0, -10, 10),
    showName: s?.barcodeShowName !== false, showNumber: s?.barcodeShowNumber !== false,
  };
}

/** حجم صفحة الطباعة (مم) لهذه الخيارات: ملصق لكل صفحة */
export function labelPageMm(o: LabelOpts): { w: number; h: number } {
  const w = o.mode === 'roll' ? o.rollW : o.w;
  const h = o.mode === 'roll' ? o.h + o.gap : o.h;
  return o.rotate ? { w: h, h: w } : { w, h };
}

/**
 * ملصق واحد لكل صفحة. المحتوى يتحجّم بوحدات الحاوية (cqh/cqw) فيتلاءم مع أي مقاس ملصق،
 * والارتفاع يُنقَص 0.4مم حتى لا ينقسم الملصق على صفحتين (كان يظهر نصفه في صفحة ونصفه في أخرى).
 * في وضع الورق المتصل تُضاف مسافة وخط قص متقطع بين كل ملصق وآخر ليُقصّ ويُلصق.
 */
export function buildLabelsHtml(name: string, code: string, count: number, size: LabelSize | Partial<LabelOpts>): string {
  const o: LabelOpts = { ...DEFAULT_LABEL_OPTS, ...(size as any) };
  const page = labelPageMm(o);
  const total = encodeBarcode(code).total;
  const { svg } = barcodeSvg(code, { moduleMm: 0.4, heightMm: 10 });
  const svgFlex = svg.replace(/ width="[^"]*" height="[^"]*"/, ' width="100%" height="100%"');
  const long = name.length > 26;
  // عرض الوحدة (أرق شريط) من مضاعفات نقطة الطابعة الحرارية 203dpi (0.125مم) فتخرج الأشرطة حادة غير مموّهة
  const availMm = o.w * 0.9;
  let mod = availMm / total;
  if (mod >= 0.25) mod = Math.min(0.5, Math.floor(mod / 0.125 + 1e-6) * 0.125);
  const barMm = +(total * mod).toFixed(3);
  const css = `
.bcl-page{box-sizing:border-box;width:${page.w}mm;height:${page.h}mm;position:relative;overflow:hidden;background:#fff;color:#000;page-break-after:always;break-after:page}
.bcl-page:last-child{page-break-after:auto;break-after:auto}
.bcl-rot{position:absolute;left:0;top:0;width:${o.w}mm;height:${o.mode === 'roll' ? o.h + o.gap : o.h}mm;${o.rotate ? `transform-origin:0 0;transform:translateX(${page.w}mm) rotate(90deg);` : ''}}
.bcl{box-sizing:border-box;container-type:size;position:absolute;left:${o.mode === 'roll' ? (page.w - o.w) / 2 : 0}mm;top:0;width:${o.w}mm;height:${o.h - 0.4}mm;transform:translate(${o.offsetX}mm,${o.offsetY}mm);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5cqh 4cqw 4cqh;gap:2.5cqh;font-family:Tahoma,Arial,sans-serif;overflow:hidden}
.bcl-name{width:100%;direction:rtl;text-align:center;font-weight:800;line-height:1.15;font-size:${long ? 8.5 : 10.5}cqh;max-height:2.35em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:none}
.bcl-bar{flex:1 1 auto;min-height:0;width:${barMm}mm;max-width:100%;max-height:min(${o.showName ? 56 : 70}cqh,24mm)}
.bcl-bar svg{display:block;width:100%;height:100%}
.bcl-num{flex:none;font-family:"Courier New",monospace;font-weight:700;letter-spacing:.25mm;font-size:10.5cqh;line-height:1;direction:ltr}
.bcl-cut{position:absolute;left:0;right:0;bottom:${o.gap / 2}mm;border-top:0.25mm dashed #000;height:0}
.bcl-cut:after{content:"✂";position:absolute;right:1mm;top:-2.2mm;font-size:7pt;background:#fff;padding:0 .6mm;line-height:1}
`;
  const one = `<div class="bcl-page"><div class="bcl-rot"><div class="bcl">${o.showName ? `<div class="bcl-name">${esc(name)}</div>` : ''}<div class="bcl-bar">${svgFlex}</div>${o.showNumber ? `<div class="bcl-num">${esc(code)}</div>` : ''}</div>${o.mode === 'roll' ? '<div class="bcl-cut"></div>' : ''}</div></div>`;
  return `<style>${css}</style>${Array.from({ length: Math.max(1, count) }, () => one).join('')}`;
}

export interface PrintDevice { deviceName?: string; silent?: boolean }

/** يطبع HTML عبر عنصر مؤقت: لا نافذة منبثقة (تعمل في المتصفح وإلكترون) */
export function printBarcodeHtml(html: string, page: { size: string; margin: string }, dev?: { deviceName?: string; pageMm?: { w: number; h: number } }) {
  const old = document.getElementById('bc-print-root'); if (old) old.remove();
  const oldStyle = document.getElementById('bc-print-style'); if (oldStyle) oldStyle.remove();
  const root = document.createElement('div');
  root.id = 'bc-print-root';
  root.innerHTML = html;
  const st = document.createElement('style');
  st.id = 'bc-print-style';
  st.textContent = `#bc-print-root{display:none}@media print{@page{size:${page.size};margin:${page.margin}}html,body{background:#fff!important;margin:0!important;padding:0!important;height:auto!important;overflow:visible!important}body>*:not(#bc-print-root){display:none!important}#bc-print-root{display:block!important}}`;
  document.head.appendChild(st);
  document.body.appendChild(root);
  const cleanup = () => { root.remove(); st.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  const api = (window as any).electronAPI;
  const direct = !!(dev?.deviceName && dev.pageMm && api && typeof api.printSilent === 'function');
  setTimeout(async () => {
    try {
      if (direct) {
        // إلكترون: طباعة مباشرة على طابعة الليبل المحددة بمقاس الورق الدقيق (دون نافذة ودون اختلاف مقاس الورق)
        const ok = await api.printSilent({ deviceName: dev!.deviceName, customPageMm: dev!.pageMm });
        if (!ok) window.print();
      } else window.print();
    } catch { cleanup(); }
  }, 60);
  setTimeout(cleanup, 120000);
}

export function printSheet(items: SheetItem[], layout: SheetLayout) {
  printBarcodeHtml(buildSheetHtml(items, layout), { size: 'A4 portrait', margin: '6mm' });
}
export function printLabels(name: string, code: string, count: number, size: LabelSize | Partial<LabelOpts>, deviceName?: string) {
  const o: LabelOpts = { ...DEFAULT_LABEL_OPTS, ...(size as any) };
  const pg = labelPageMm(o);
  printBarcodeHtml(buildLabelsHtml(name, code, count, o), { size: `${pg.w}mm ${pg.h}mm`, margin: '0' }, { deviceName, pageMm: pg });
}

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Product } from '../types';
import { newId } from '../utils/suppliers';

/** سطر القائمة الكلاسيكية: كل خانة فارغة = تبقى كما هي في المخزون */
export interface CLine {
  key: string;
  productId?: string;
  name: string;
  perCarton: string;
  cartons: string;
  loose: string;
  newPrice: string;
  /** سعر البيع (للقطعة): يُملأ تلقائياً بسعر المادة الحالي */
  sell: string;
  priceBy: 'piece' | 'carton';
  disc: string;
  showDisc: boolean;
  prod: string;
  exp: string;
}

export const emptyCLine = (): CLine => ({ key: newId('cl'), name: '', perCarton: '', cartons: '', loose: '', newPrice: '', sell: '', priceBy: 'piece', disc: '', showDisc: false, prod: '', exp: '' });

export const withTrailingEmpty = (lines: CLine[]): CLine[] => {
  const last = lines[lines.length - 1];
  return !last || last.name.trim() || last.productId ? [...lines, emptyCLine()] : lines;
};

export interface CCalc {
  per: number; cartons: number; loose: number; pieces: number;
  oldPiece: number; pricePiece: number; gross: number; disc: number; total: number; effPiece: number;
  sell: number; sellChanged: boolean;
  hasNew: boolean; packChanged: boolean; priceChanged: boolean; weighted: boolean;
}

export const calcCLine = (l: CLine, p?: Product): CCalc => {
  const weighted = Boolean(p && (p.isWeighted || p.unit === 'كغم' || p.unit === 'كيلو'));
  const prodPer = Math.max(1, p?.piecesPerCarton || 1);
  const typedPer = Math.floor(parseFloat(l.perCarton) || 0);
  const per = weighted ? 1 : typedPer > 0 ? typedPer : prodPer;
  const cartons = weighted ? 0 : Math.max(0, parseFloat(l.cartons) || 0);
  const loose = Math.max(0, parseFloat(l.loose) || 0);
  const pieces = Math.round((cartons * per + loose) * 1000) / 1000;
  const oldPiece = p?.costPrice || 0;
  const np = parseFloat(l.newPrice);
  const filled = l.newPrice.trim() !== '' && Number.isFinite(np) && np >= 0;
  const asPiece = filled ? (l.priceBy === 'carton' && !weighted ? np / per : np) : oldPiece;
  // السعر المعبّأ تلقائياً بالقديم لا يُعدّ تغييراً
  const hasNew = filled && (!p || Math.abs(asPiece - oldPiece) > 0.0005);
  const pricePiece = hasNew ? asPiece : oldPiece;
  const sellN = parseFloat(l.sell);
  const sell = l.sell.trim() !== '' && Number.isFinite(sellN) && sellN >= 0 ? sellN : (p?.retailPrice || 0);
  const sellChanged = !!p && l.sell.trim() !== '' && Number.isFinite(sellN) && sellN >= 0 && Math.abs(sellN - (p.retailPrice || 0)) > 0.0005;
  const gross = pieces * pricePiece;
  const disc = Math.min(gross, Math.max(0, parseFloat(l.disc) || 0));
  const total = Math.round(gross - disc);
  const effPiece = pieces > 0 ? (gross - disc) / pieces : pricePiece;
  return { sell, sellChanged, per, cartons, loose, pieces, oldPiece, pricePiece, gross, disc, total, effPiece, hasNew, packChanged: !!p && !weighted && typedPer > 0 && typedPer !== prodPer, priceChanged: hasNew || disc > 0, weighted };
};

const cell = 'w-full border border-slate-300 rounded-md px-1.5 py-1.5 text-xs text-center font-mono bg-white text-slate-900 focus:outline-none focus:border-emerald-500';

export function ClassicReceiveLines({ lines, setLines, products, formatMoney, showDates }: {
  lines: CLine[];
  setLines: (l: CLine[]) => void;
  products: Product[];
  formatMoney: (n: number) => string;
  showDates: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const prodOf = (l: CLine) => (l.productId ? products.find((x) => x.id === l.productId) : undefined);

  const patch = (key: string, u: Partial<CLine>) => setLines(withTrailingEmpty(lines.map((l) => (l.key === key ? { ...l, ...u } : l))));
  const remove = (key: string) => { const next = lines.filter((l) => l.key !== key); setLines(next.length ? withTrailingEmpty(next) : [emptyCLine()]); };

  const suggestions = (name: string) => {
    const words = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [] as Product[];
    return products.filter((p) => {
      const hay = `${p.name} ${p.code || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 7);
  };

  const pick = (key: string, p: Product) => {
    const byCarton = (p.piecesPerCarton || 1) > 1 && !(p.isWeighted || p.unit === 'كغم' || p.unit === 'كيلو');
    const old = (p.costPrice || 0) * (byCarton ? Math.max(1, p.piecesPerCarton || 1) : 1);
    patch(key, { productId: p.id, name: p.name, perCarton: '', newPrice: old > 0 ? String(Math.round(old * 1000) / 1000) : '', sell: p.retailPrice ? String(p.retailPrice) : '', priceBy: byCarton ? 'carton' : 'piece' });
    setActive(null);
  };

  const colSpan = 9 + (showDates ? 2 : 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
      <table className="w-full text-xs min-w-[980px]">
        <thead className="bg-slate-100 text-[11px] text-slate-700">
          <tr>
            <th className="px-1.5 py-2 w-7">#</th>
            <th className="px-2 py-2 text-right min-w-[190px]">اسم المادة</th>
            <th className="px-1.5 py-2 w-[74px]">السعة</th>
            <th className="px-1.5 py-2 w-[70px]">عدد الكراتين</th>
            <th className="px-1.5 py-2 w-[70px]">عدد القطع</th>
            <th className="px-1.5 py-2 w-[165px]">السعر</th>
            <th className="px-1.5 py-2 w-[96px]">سعر البيع <span className="block text-[9px] font-normal text-slate-500">للقطعة</span></th>
            <th className="px-1.5 py-2 w-[86px]">الخصم</th>
            {showDates && <><th className="px-1.5 py-2 w-[110px]">الإنتاج</th><th className="px-1.5 py-2 w-[110px]">الانتهاء</th></>}
            <th className="px-1.5 py-2 w-[92px]">المجموع</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const p = prodOf(l);
            const c = calcCLine(l, p);
            const sugg = active === l.key && l.name.trim() && !l.productId ? suggestions(l.name) : [];
            const empty = !l.name.trim() && !l.productId;
            const basisCarton = l.priceBy === 'carton' && !c.weighted;
            const oldShown = basisCarton ? c.oldPiece * c.per : c.oldPiece;
            return (
              <React.Fragment key={l.key}>
                <tr className="border-t border-slate-100 align-middle">
                  <td className="px-1.5 py-1 text-center text-slate-400">{empty ? '' : i + 1}</td>
                  <td className="px-1.5 py-1">
                    <input
                      value={l.name}
                      onFocus={() => setActive(l.key)}
                      onChange={(e) => patch(l.key, { name: e.target.value, productId: undefined, perCarton: l.productId ? '' : l.perCarton })}
                      placeholder="اكتب اسم المادة..."
                      className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                    {!empty && (l.productId
                      ? <span className="text-[9px] font-bold text-emerald-700">مسجلة · الرصيد {p?.stock}</span>
                      : <span className="text-[9px] font-bold text-indigo-700">غير مسجلة (لا تزيد المخزون)</span>)}
                  </td>
                  <td className="px-1.5 py-1"><input type="number" min="1" disabled={empty || c.weighted} value={l.perCarton} onChange={(e) => patch(l.key, { perCarton: e.target.value })} placeholder={p ? String(Math.max(1, p.piecesPerCarton || 1)) : '1'} className={`${cell} ${c.packChanged ? 'border-amber-500 bg-amber-50' : ''}`} title="اتركها فارغة لتبقى تعبئة المادة كما هي" /></td>
                  <td className="px-1.5 py-1"><input type="number" min="0" disabled={empty || c.weighted} value={l.cartons} onChange={(e) => patch(l.key, { cartons: e.target.value })} className={cell} /></td>
                  <td className="px-1.5 py-1"><input type="number" min="0" step={c.weighted ? '0.001' : '1'} disabled={empty} value={l.loose} onChange={(e) => patch(l.key, { loose: e.target.value })} className={cell} /></td>
                  <td className="px-1.5 py-1">
                    <div className="flex gap-1">
                      <input type="number" min="0" disabled={empty} value={l.newPrice} onChange={(e) => patch(l.key, { newPrice: e.target.value })} placeholder="السعر" className={`${cell} ${c.hasNew ? 'border-amber-500 bg-amber-50' : ''}`} />
                      {!c.weighted && (
                        <select value={l.priceBy} disabled={empty} onChange={(e) => { const by = e.target.value as CLine['priceBy']; const v = parseFloat(l.newPrice); patch(l.key, { priceBy: by, ...(Number.isFinite(v) && l.newPrice.trim() !== '' ? { newPrice: String(Math.round((by === 'carton' ? v * c.per : v / c.per) * 1000) / 1000) } : {}) }); }} className="border border-slate-300 rounded-md text-[10px] bg-white px-0.5" title="السعر للقطعة أم للكرتون">
                          <option value="piece">قطعة</option>
                          <option value="carton">كرتون</option>
                        </select>
                      )}
                    </div>
                  {p && c.hasNew && <div className="text-[9px] text-slate-500 text-center mt-0.5">كان {Math.round(oldShown * 100) / 100}</div>}
                  </td>
                  <td className="px-1.5 py-1">
                    <input type="number" min="0" disabled={empty} value={l.sell} onChange={(e) => patch(l.key, { sell: e.target.value })} placeholder="سعر البيع" title="سعر بيع القطعة (يُملأ بالسعر الحالي ويتغير فقط إذا عدّلته)" className={`${cell} ${c.sellChanged ? 'border-amber-500 bg-amber-50' : ''}`} />
                    {p && c.sellChanged && <div className="text-[9px] text-slate-500 text-center mt-0.5">كان {p.retailPrice}</div>}
                  </td>
                  <td className="px-1.5 py-1 text-center">
                    {l.showDisc ? (
                      <input type="number" min="0" autoFocus value={l.disc} onChange={(e) => patch(l.key, { disc: e.target.value })} placeholder="مبلغ" className={`${cell} border-rose-400`} />
                    ) : (
                      <button type="button" disabled={empty} onClick={() => patch(l.key, { showDisc: true })} className="px-2 py-1 rounded-md bg-rose-50 text-rose-700 text-[11px] font-bold hover:bg-rose-100 disabled:opacity-30">خصم</button>
                    )}
                  </td>
                  {showDates && (<>
                    <td className="px-1.5 py-1"><input type="date" disabled={!l.productId} value={l.prod} onChange={(e) => patch(l.key, { prod: e.target.value })} className={cell} /></td>
                    <td className="px-1.5 py-1"><input type="date" disabled={!l.productId} value={l.exp} onChange={(e) => patch(l.key, { exp: e.target.value })} className={cell} /></td>
                  </>)}
                  <td className="px-1.5 py-1 text-center font-black text-slate-800">{empty ? '' : <>{formatMoney(c.total)}{c.pieces > 0 && <div className="text-[9px] font-bold text-slate-500">{c.pieces} قطعة</div>}</>}</td>
                  <td className="px-1 py-1 text-center">{!empty && <button type="button" onClick={() => remove(l.key)} className="p-1 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
                </tr>
                {sugg.length > 0 && (
                  <tr className="bg-emerald-50/60">
                    <td></td>
                    <td colSpan={colSpan - 1} className="px-1.5 py-1.5">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-bold text-slate-500">اقتراحات:</span>
                        {sugg.map((s) => (
                          <button key={s.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(l.key, s)} className="px-2 py-1 rounded-lg bg-white border border-emerald-300 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100">
                            {s.name}{(s.piecesPerCarton || 1) > 1 ? <span className="text-slate-400 mr-1">×{s.piecesPerCarton}</span> : null}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

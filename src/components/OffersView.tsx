import React, { useMemo, useState } from 'react';
import { Tag, Plus, Pause, Play, Pencil, Trash2, X, Search, Gift, Percent, CalendarDays } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Product, Promotion, PromotionKind } from '../types';
import {
  PROMO_KIND_LABELS,
  describePromotion,
  getPromoStatus,
  todayKey,
  type PromoStatus,
} from '../utils/promotions';

const STATUS_STYLE: Record<PromoStatus, { label: string; cls: string }> = {
  running: { label: 'جارٍ', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  scheduled: { label: 'مجدول', cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  expired: { label: 'منتهٍ', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  paused: { label: 'موقوف', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
};

interface FormState {
  id?: string;
  kind: PromotionKind;
  productId: string;
  discountType: 'percent' | 'amount';
  discountValue: string;
  buyQty: string;
  getQty: string;
  rewardProductId: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

const emptyForm = (): FormState => ({
  kind: 'discount',
  productId: '',
  discountType: 'percent',
  discountValue: '',
  buyQty: '3',
  getQty: '1',
  rewardProductId: '',
  startDate: todayKey(),
  endDate: '',
  active: true,
});

function ProductPicker({
  label,
  products,
  value,
  onChange,
}: {
  label: string;
  products: Product[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const selected = products.find((p) => p.id === value);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(t) || String(p.code || '').toLowerCase().includes(t))
      .slice(0, 8);
  }, [q, products]);

  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
      {selected ? (
        <div className="flex items-center justify-between gap-2 border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 text-sm font-bold text-emerald-900">
          <span className="truncate">{selected.name}</span>
          <button type="button" onClick={() => onChange('')} className="text-xs text-rose-600 font-bold shrink-0">
            تغيير
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المادة أو رمزها..."
            className="w-full border border-slate-300 rounded-lg pr-9 pl-3 py-2 text-sm bg-white text-slate-900"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-56 overflow-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setQ('');
                  }}
                  className="w-full text-right px-3 py-2 text-sm hover:bg-slate-100 text-slate-900 border-b border-slate-100 last:border-0"
                >
                  {p.name}
                  {p.code ? <span className="text-slate-400 text-xs mr-2 font-mono">{p.code}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OffersView() {
  const { products, settings, updateSettings } = useApp() as any;
  const promotions: Promotion[] = settings.promotions || [];
  const [filter, setFilter] = useState<'all' | PromoStatus>('all');
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const save = (next: Promotion[]) => updateSettings({ promotions: next });

  const productName = (id?: string) => (products as Product[]).find((p) => p.id === id)?.name || '';

  const visible = useMemo(() => {
    const list = [...promotions].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return filter === 'all' ? list : list.filter((p) => getPromoStatus(p) === filter);
  }, [promotions, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: promotions.length, running: 0, scheduled: 0, expired: 0, paused: 0 };
    promotions.forEach((p) => {
      c[getPromoStatus(p)]++;
    });
    return c;
  }, [promotions]);

  const openNew = () => {
    setError('');
    setForm(emptyForm());
  };

  const openEdit = (p: Promotion) => {
    setError('');
    setForm({
      id: p.id,
      kind: p.kind,
      productId: p.productId,
      discountType: p.discountType || 'percent',
      discountValue: p.discountValue != null ? String(p.discountValue) : '',
      buyQty: String(p.buyQty ?? 3),
      getQty: String(p.getQty ?? 1),
      rewardProductId: p.rewardProductId || '',
      startDate: p.startDate || '',
      endDate: p.endDate || '',
      active: p.active,
    });
  };

  const submit = () => {
    if (!form) return;
    if (!form.productId) return setError('اختر المادة أولاً.');
    const now = new Date().toISOString();
    const base: Promotion = {
      id: form.id || 'promo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      kind: form.kind,
      productId: form.productId,
      productName: productName(form.productId),
      active: form.active,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      createdAt: promotions.find((p) => p.id === form.id)?.createdAt || now,
      updatedAt: now,
    };
    if (base.startDate && base.endDate && base.endDate < base.startDate) {
      return setError('تاريخ النهاية يجب أن يكون بعد تاريخ البداية.');
    }
    if (form.kind === 'discount') {
      const v = Number(form.discountValue);
      if (!(v > 0)) return setError('أدخل قيمة الخصم.');
      if (form.discountType === 'percent' && v > 100) return setError('النسبة المئوية لا تتجاوز 100.');
      base.discountType = form.discountType;
      base.discountValue = v;
    } else {
      const buy = Math.floor(Number(form.buyQty));
      const get = Math.floor(Number(form.getQty));
      if (!(buy >= 1) || !(get >= 1)) return setError('أدخل أعداداً صحيحة أكبر من صفر لشراء المادة والهدية.');
      base.buyQty = buy;
      base.getQty = get;
      if (form.kind === 'bonus_other') {
        if (!form.rewardProductId) return setError('اختر المادة الهدية.');
        base.rewardProductId = form.rewardProductId;
        base.rewardProductName = productName(form.rewardProductId);
      }
    }
    const exists = promotions.some((p) => p.id === base.id);
    save(exists ? promotions.map((p) => (p.id === base.id ? base : p)) : [base, ...promotions]);
    setForm(null);
  };

  const toggleActive = (p: Promotion) =>
    save(promotions.map((x) => (x.id === p.id ? { ...x, active: !x.active, updatedAt: new Date().toISOString() } : x)));

  const remove = (id: string) => {
    save(promotions.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-slate-900 text-base">العروض والخصومات</h2>
            <p className="text-xs text-slate-500">
              تُطبّق تلقائياً في نقطة البيع على المواد المشمولة. طريقة ذكرها في القائمة من الإعدادات.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="px-4 py-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> عرض أو خصم جديد
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['all', 'running', 'scheduled', 'paused', 'expired'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
              filter === f
                ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'الكل' : STATUS_STYLE[f].label} ({counts[f]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-sm">
          لا توجد عروض أو خصومات {filter === 'all' ? 'بعد' : 'في هذه الحالة'}.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((p) => {
            const st = getPromoStatus(p);
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.kind === 'discount' ? (
                      <Percent className="w-4 h-4 text-fuchsia-600 shrink-0" />
                    ) : (
                      <Gift className="w-4 h-4 text-fuchsia-600 shrink-0" />
                    )}
                    <span className="font-black text-slate-900 text-sm leading-snug">{describePromotion(p)}</span>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[st].cls}`}>
                    {STATUS_STYLE[st].label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {p.startDate ? `من ${p.startDate}` : 'من الآن'} ·{' '}
                  {p.endDate ? `حتى ${p.endDate}` : 'حتى الإيقاف أو الحذف'}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                  >
                    {p.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {p.active ? 'إيقاف' : 'تشغيل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" /> تعديل
                  </button>
                  {confirmDeleteId === p.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                      >
                        تأكيد الحذف
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-600"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-300 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="font-black text-slate-900">{form.id ? 'تعديل' : 'إنشاء'} عرض / خصم</h3>
              <button type="button" onClick={() => setForm(null)} className="text-slate-500 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">النوع</label>
                <select
                  value={form.kind}
                  onChange={(e) => set('kind', e.target.value as PromotionKind)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
                >
                  {(Object.keys(PROMO_KIND_LABELS) as PromotionKind[]).map((k) => (
                    <option key={k} value={k}>
                      {PROMO_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <ProductPicker
                label={form.kind === 'discount' ? 'المادة' : 'المادة المشتراة'}
                products={products}
                value={form.productId}
                onChange={(id) => set('productId', id)}
              />

              {form.kind === 'discount' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نوع الخصم</label>
                    <select
                      value={form.discountType}
                      onChange={(e) => set('discountType', e.target.value as 'percent' | 'amount')}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
                    >
                      <option value="percent">نسبة مئوية %</option>
                      <option value="amount">مبلغ لكل قطعة (دينار)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {form.discountType === 'percent' ? 'النسبة %' : 'المبلغ لكل قطعة'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.discountValue}
                      onChange={(e) => set('discountValue', e.target.value)}
                      placeholder={form.discountType === 'percent' ? '10' : '500'}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {form.kind === 'nth_free' ? 'عدد القطع المدفوعة (N)' : 'اشترِ (N)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={form.buyQty}
                        onChange={(e) => set('buyQty', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {form.kind === 'nth_free' ? 'القطع المجانية بعدها (M)' : 'وخذ مجاناً (M)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={form.getQty}
                        onChange={(e) => set('getQty', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
                      />
                    </div>
                  </div>
                  {form.kind === 'bonus_other' && (
                    <ProductPicker
                      label="المادة الهدية المجانية"
                      products={products}
                      value={form.rewardProductId}
                      onChange={(id) => set('rewardProductId', id)}
                    />
                  )}
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {form.kind === 'nth_free'
                      ? 'مثال: 2 و 1 ← من كل 3 قطع في القائمة تُدفع 2 وتكون الثالثة مجانية.'
                      : 'مثال: 3 و 1 ← كل 3 قطع تُشترى تُضاف قطعة مجانية إلى القائمة. يتكرر العرض مع الكمية الأكبر (6 ← 2 مجاناً).'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">يبدأ من</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ينتهي في (اختياري)</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || undefined}
                    onChange={(e) => set('endDate', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 -mt-2">
                اترك تاريخ النهاية فارغاً ليبقى العرض مفتوحاً حتى توقفه أو تحذفه.
              </p>

              <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => set('active', e.target.checked)}
                  className="w-4 h-4"
                />
                مفعّل
              </label>

              {error && (
                <div className="text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 py-3 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={submit}
                className="flex-1 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold text-sm"
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

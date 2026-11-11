import React, { useRef, useState } from 'react';
import { X, ImagePlus, Trash2, UploadCloud, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { removeProductImage, saveProductImage, useProductImage, useProductImageIds } from '../utils/productImages';

interface Props { product: Product | null; onClose: () => void; }

export const ProductImageModal: React.FC<Props> = ({ product, onClose }) => {
  const ids = useProductImageIds();
  const full = useProductImage(product?.id, 'full');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!product) return null;
  const hasImage = ids.has(product.id);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      await saveProductImage(product.id, file);
    } catch (e: any) {
      setError(e?.message || 'تعذر حفظ الصورة');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3" dir="rtl" onClick={onClose}>
      <div className="bg-white dark:bg-[#0b1728] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="font-bold text-sm text-slate-900 dark:text-white truncate">صورة المادة: {product.name}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {hasImage && (
            <div className="rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center min-h-[200px]">
              {full ? (
                <img src={full} alt={product.name} className="max-h-[60vh] max-w-full object-contain rounded-xl" />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              )}
            </div>
          )}

          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition ${drag ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'}`}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            {busy ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
            ) : (
              <>
                <UploadCloud className="w-7 h-7 mx-auto text-emerald-600 mb-1" />
                <div className="font-bold text-slate-800 dark:text-slate-100">
                  {hasImage ? 'اسحب صورة جديدة هنا أو اضغط لاستبدالها' : 'اسحب الصورة هنا أو اضغط لاختيارها من ملفاتك'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">JPG أو PNG أو WEBP</div>
              </>
            )}
          </div>

          {error && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">{error}</div>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              تُحفظ الصورة على هذا الكمبيوتر فقط ولا تُرفع إلى السحابة، فلا تستهلك مساحة التخزين السحابي، ولا تظهر على الأجهزة الأخرى.
            </span>
            {hasImage && (
              <button
                type="button"
                onClick={async () => { setBusy(true); try { await removeProductImage(product.id); } finally { setBusy(false); } }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> حذف الصورة
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** صورة مصغرة قابلة للضغط لعرض الصورة الكاملة */
export const ProductThumb: React.FC<{ product: Product; onOpen: () => void }> = ({ product, onOpen }) => {
  const thumb = useProductImage(product.id, 'thumb');
  if (!thumb) return null;
  return (
    <button type="button" onClick={onOpen} title="عرض الصورة كاملة" className="shrink-0">
      <img src={thumb} alt={product.name} className="w-11 h-11 rounded-lg object-cover border border-slate-200 hover:ring-2 hover:ring-emerald-400 transition" />
    </button>
  );
};

export const ProductImageButton: React.FC<{ onOpen: () => void; has: boolean }> = ({ onOpen, has }) => (
  <button
    onClick={onOpen}
    className={`p-1.5 rounded-lg transition ${has ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
    title={has ? 'عرض الصورة أو تغييرها' : 'إضافة صورة للمادة'}
  >
    <ImagePlus className="w-4 h-4" />
  </button>
);

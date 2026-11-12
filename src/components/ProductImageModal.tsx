import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ImagePlus, Trash2, UploadCloud, Loader2, Camera } from 'lucide-react';
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
  const camInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const isPhone = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // الهاتف: كاميرا الجهاز مباشرة. الكمبيوتر: معاينة حية داخل النافذة ثم التقاط
  const openCamera = async () => {
    setError(null);
    if (isPhone) { camInputRef.current?.click(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      }, 0);
    } catch {
      // لا توجد كاميرا أو رُفض الإذن: نستخدم اختيار الملف مع خيار الكاميرا إن وُجد
      camInputRef.current?.click();
    }
  };

  const takePhoto = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    stopCamera();
    c.toBlob(async (blob) => {
      if (blob) await handleFile(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

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

          {cameraOn && (
            <div className="rounded-xl overflow-hidden bg-black relative">
              <video ref={videoRef} playsInline muted className="w-full max-h-[55vh] object-contain" />
              <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                <button type="button" onClick={takePhoto} className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg">
                  <Camera className="w-4 h-4" /> التقاط
                </button>
                <button type="button" onClick={stopCamera} className="px-4 py-2.5 rounded-full bg-white/90 text-slate-800 font-bold text-sm">إلغاء</button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCamera}
              disabled={busy || cameraOn}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" /> التقاط بالكاميرا
            </button>
            <input ref={camInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          </div>

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
              تُحفظ الصورة على هذا الجهاز فقط ولا تُرفع إلى السحابة، فلا تستهلك مساحة التخزين السحابي، ولا تظهر على الأجهزة الأخرى. لنقلها لجهاز آخر استخدم «حفظ نسخة للصور فقط» من الإعدادات.
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

/** مصغرة تعرض الصورة كاملة عند الضغط قرب مؤشر الماوس (عرض فقط بدون تعديل) */
export const ProductThumbPreview: React.FC<{ product: Product; size?: number }> = ({ product, size = 40 }) => {
  const thumb = useProductImage(product.id, 'thumb');
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [wantFull, setWantFull] = useState(false);
  const full = useProductImage(wantFull ? product.id : undefined, 'full');

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPos(null); setWantFull(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pos]);

  if (!thumb) return null;

  const close = () => { setPos(null); setWantFull(false); };
  const W = 320, H = 340;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = pos ? Math.max(8, Math.min(pos.x + 14, vw - W - 8)) : 0;
  const top = pos ? Math.max(8, Math.min(pos.y + 14, vh - H - 8)) : 0;

  return (
    <>
      <button
        type="button"
        title="عرض الصورة"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setWantFull(true); setPos({ x: e.clientX, y: e.clientY }); }}
        className="shrink-0 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-emerald-400 transition"
        style={{ width: size, height: size }}
      >
        <img src={thumb} alt="" className="w-full h-full object-cover" draggable={false} />
      </button>
      {pos && createPortal(
        <div className="fixed inset-0 z-[200]" onClick={(e) => { e.stopPropagation(); close(); }} onContextMenu={(e) => { e.preventDefault(); close(); }}>
          <div
            className="absolute bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 flex flex-col items-center"
            style={{ left, top, width: W, maxHeight: H }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between gap-2 px-1 pb-1.5" dir="rtl">
              <span className="text-xs font-bold text-slate-800 truncate">{product.name}</span>
              <button type="button" onClick={close} className="p-1 rounded-md hover:bg-slate-100 text-slate-500"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="w-full flex-1 flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden" style={{ minHeight: 200 }}>
              {full || thumb ? (
                <img src={full || thumb || ''} alt={product.name} className="max-w-full object-contain" style={{ maxHeight: H - 70 }} draggable={false} />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

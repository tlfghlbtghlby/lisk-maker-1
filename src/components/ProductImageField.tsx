import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Camera, Trash2, UploadCloud, Loader2 } from 'lucide-react';

interface Props {
  /** صورة موجودة (مصغّرة) أو معاينة صورة مختارة لمادة جديدة */
  preview: string | null;
  onFile: (file: File) => Promise<void> | void;
  onClear?: () => void;
  onOpenPreview?: () => void;
}

/** خانة صورة المادة داخل نافذة المادة: الكاميرا مباشرة، سحب وإفلات ملف، أو اختيار من الجهاز */
export const ProductImageField: React.FC<Props> = ({ preview, onFile, onClear, onOpenPreview }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const camInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPhone = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const handle = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('الملف المختار ليس صورة.'); return; }
    setBusy(true);
    setError(null);
    try {
      await onFile(file);
    } catch (e: any) {
      setError(e?.message || 'تعذر حفظ الصورة');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
      if (camInputRef.current) camInputRef.current.value = '';
    }
  };

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
      setError('تعذر تشغيل الكاميرا. تأكد من السماح للبرنامج باستخدامها، أو اختر ملفاً.');
    }
  };

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((blob) => {
      stopCamera();
      if (blob) handle(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="mx-5 mt-3">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      <input ref={camInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />

      {cameraOn ? (
        <div className="rounded-xl overflow-hidden bg-black relative">
          <video ref={videoRef} playsInline muted className="w-full max-h-[40vh] object-contain" />
          <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-2">
            <button type="button" onClick={takePhoto} className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer">
              <Camera className="w-4 h-4" /> التقاط
            </button>
            <button type="button" onClick={stopCamera} className="px-4 py-2 rounded-full bg-white/90 text-slate-800 font-bold text-xs shadow-lg cursor-pointer">
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
          className={`rounded-xl border-2 border-dashed p-2.5 flex items-center gap-3 transition ${
            drag ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40'
          }`}
        >
          <button
            type="button"
            onClick={onOpenPreview}
            disabled={!preview || !onOpenPreview}
            className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center cursor-pointer disabled:cursor-default"
            title={preview ? 'عرض الصورة' : undefined}
          >
            {busy ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : preview ? (
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-6 h-6 text-slate-400" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5" />
              صورة المادة
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              اسحب صورة وأفلتها هنا، أو التقطها بالكاميرا مباشرة، أو اختر ملفاً. تُحفظ على هذا الجهاز فقط.
            </div>
            {error && <div className="text-[11px] font-bold text-rose-600 mt-0.5">{error}</div>}
          </div>

          <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
            <button type="button" onClick={openCamera} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <Camera className="w-3.5 h-3.5" /> كاميرا
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <ImagePlus className="w-3.5 h-3.5" /> ملف
            </button>
            {preview && onClear && (
              <button type="button" onClick={onClear} className="px-2.5 py-1.5 rounded-lg border border-rose-300 text-rose-600 text-xs font-bold flex items-center justify-center hover:bg-rose-50 cursor-pointer" title="حذف الصورة">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

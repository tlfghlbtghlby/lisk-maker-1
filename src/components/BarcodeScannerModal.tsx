import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle, Scan, Volume2, Flashlight } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'ماسح الباركود بالكاميرا',
}) => {
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'reader-barcode-viewport';

  const playSuccessBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 1050; // crisp register beep
      gain.gain.value = 0.15;
      osc.start();
      setTimeout(() => {
        osc.stop();
        audioCtx.close();
      }, 100);
    } catch (e) {
      // Audio might be muted or blocked by browser policy
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    // Small delay to ensure the DOM element exists
    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    setError(null);
    setIsScanning(true);

    try {
      const viewportEl = document.getElementById(scannerDivId);
      if (!viewportEl) return;

      // Stop any existing instance
      if (scannerInstanceRef.current) {
        try {
          if (scannerInstanceRef.current.isScanning) {
            await scannerInstanceRef.current.stop();
          }
          scannerInstanceRef.current.clear();
        } catch (e) {}
      }

      const html5QrCode = new Html5Qrcode(scannerDivId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      scannerInstanceRef.current = html5QrCode;

      const config = {
        fps: 12,
        qrbox: { width: 260, height: 180 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleDetected(decodedText);
        },
        () => {
          // ignore scan frame misses
        }
      );
      setIsScanning(true);
    } catch (err: any) {
      console.warn('Camera scanner init error:', err);
      setError(
        err?.message ||
        'تعذر فتح الكاميرا. يرجى التأكد من منح الإذن لاستخدام الكاميرا في المتصفح.'
      );
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerInstanceRef.current) {
      try {
        if (scannerInstanceRef.current.isScanning) {
          await scannerInstanceRef.current.stop();
        }
        scannerInstanceRef.current.clear();
      } catch (e) {
        console.warn('Stop scanner warning:', e);
      }
      scannerInstanceRef.current = null;
    }
    setIsScanning(false);
  };

  const handleDetected = (codeStr: string) => {
    const clean = codeStr.trim();
    if (!clean) return;

    playSuccessBeep();
    stopScanner();
    onScan(clean);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleDetected(manualCode.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-white">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">{title}</h3>
              <p className="text-[11px] text-slate-400">يدعم باركود المواد والـ QR Code تلقائياً</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport container */}
        <div className="p-4 flex flex-col items-center">
          <div className="relative w-full aspect-square max-w-[320px] bg-black rounded-xl overflow-hidden border-2 border-emerald-500/50 flex items-center justify-center">
            
            {/* Target element for Html5Qrcode */}
            <div id={scannerDivId} className="w-full h-full overflow-hidden" />

            {/* Scanning guide overlay */}
            <div className="absolute inset-6 border-2 border-dashed border-emerald-400/60 rounded-xl pointer-events-none flex flex-col items-center justify-center">
              <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse"></div>
            </div>

            {error && (
              <div className="absolute inset-0 bg-slate-900/95 p-4 flex flex-col items-center justify-center text-center z-20">
                <AlertCircle className="w-9 h-9 text-amber-400 mb-2" />
                <p className="text-xs text-amber-200 mb-3 leading-relaxed">{error}</p>
                <button
                  type="button"
                  onClick={startScanner}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  إعادة تشغيل الكاميرا
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between w-full mt-2.5 px-1 text-[11px] text-slate-400">
            <span>وجّه كاميرا الهاتف نحو باركود الصنف</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              مسح مباشر
            </span>
          </div>

          {/* Manual barcode input */}
          <form onSubmit={handleManualSubmit} className="w-full mt-4 flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="أو أدخل رقم الباركود يدوياً..."
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono text-left"
              dir="ltr"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
            >
              تأكيد
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default BarcodeScannerModal;

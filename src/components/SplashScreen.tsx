import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Zap, ArrowLeft } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('تهيئة النظام الذكي...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 2400; // 2.4 seconds intro

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (pct < 30) {
        setStatusText('تهيئة محرك الحسابات الذكي...');
      } else if (pct < 65) {
        setStatusText('تحميل قاعدة البيانات والمخازن المحلية...');
      } else if (pct < 90) {
        setStatusText('مزامنة الجلسات وإعدادات النظام...');
      } else {
        setStatusText('جاهز للانطلاق بنجاح...');
      }

      if (pct >= 100) {
        clearInterval(timer);
        setIsFadingOut(true);
        setTimeout(() => {
          onComplete();
        }, 350);
      }
    }, 40);

    return () => clearInterval(timer);
  }, [onComplete]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 150);
  };

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-10 select-none overflow-hidden transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'radial-gradient(ellipse at center, #10203a 0%, #070d18 70%, #03060b 100%)',
      }}
    >
      {/* Background Animated Tech Grid & Radial Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #d4af37 0%, #0284c7 60%, transparent 80%)' }}
        />
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(#caa165 1px, transparent 1px), linear-gradient(90deg, #caa165 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Top Header with Skip Button */}
      <div className="w-full max-w-2xl flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-amber-500/30 text-amber-300 text-xs font-semibold backdrop-blur-md">
          <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>المفكر سمارت • الإصدار الحديث</span>
        </div>

        <button
          onClick={handleSkip}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition shadow-sm backdrop-blur-md cursor-pointer"
        >
          <span>تخطي</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Cinematic Logo Badge */}
      <div className="relative z-10 flex flex-col items-center my-auto text-center px-4">
        {/* Glowing Circuit Halo */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute w-48 h-48 sm:w-56 sm:h-56 rounded-full border border-amber-400/30 animate-[spin_12s_linear_infinite]" />
          <div className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full border-2 border-dashed border-sky-400/30 animate-[spin_16s_linear_infinite_reverse]" />
          <div className="absolute inset-0 rounded-full blur-xl bg-amber-500/25 animate-pulse" />
          
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full p-1.5 bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 shadow-2xl shadow-amber-500/30 flex items-center justify-center">
            <img
              src="/assets/aistudio/1792973910260_3946b0af.jpg"
              alt="شعار برنامج المفكر المحاسبي"
              className="w-full h-full object-cover rounded-full shadow-inner ring-2 ring-slate-950"
            />
          </div>
        </div>

        {/* Title & Brand Slogan */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-100 tracking-wide drop-shadow-sm font-['Tajawal','Almarai','Cairo',sans-serif] pb-1">
            برنامج المفكر المحاسبي
          </h1>
          <p className="text-xs sm:text-sm text-sky-200/90 font-medium tracking-wide flex items-center justify-center gap-2">
            <span>AL-MUFAKIR SMART POS SYSTEM</span>
            <span className="inline-block w-1 h-1 rounded-full bg-amber-400" />
            <span className="text-amber-300 font-bold">المفكر سمارت</span>
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
            نظام إدارة المبيعات ونقاط البيع السريعة، المخازن، حسابات الديون، وأرباح المندوبين
          </p>
        </div>
      </div>

      {/* Bottom Progress Bar & Status */}
      <div className="w-full max-w-md relative z-10 space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1.5 text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            {statusText}
          </span>
          <span className="text-slate-300 font-mono font-bold">{progress}%</span>
        </div>

        {/* Custom Glowing Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800/80 p-0.5 border border-slate-700/60 overflow-hidden shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-sky-400 shadow-lg shadow-amber-500/50 transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            قاعدة بيانات مؤمنة محلياً وسحابياً
          </span>
          <span>•</span>
          <span>دعم العمل بدون إنترنت</span>
        </div>
      </div>
    </div>
  );
};

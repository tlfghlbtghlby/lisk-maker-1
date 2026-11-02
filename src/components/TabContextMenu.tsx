import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Monitor, ArrowRight, CheckCircle2, Sparkles, X, Layers, Copy } from 'lucide-react';
import { TabType } from './Navigation';

interface TabContextMenuProps {
  x: number;
  y: number;
  tabId: TabType;
  tabLabel: string;
  tabIcon: React.ReactNode;
  onClose: () => void;
  onSelectTab: (tabId: TabType) => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  x,
  y,
  tabId,
  tabLabel,
  tabIcon,
  onClose,
  onSelectTab
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCreatingShortcut, setIsCreatingShortcut] = useState(false);

  // إغلاق القائمة عند النقر في الخارج أو الضغط على Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // تعديل الموقع لضمان بقاء القائمة داخل حدود الشاشة
  const adjustedX = Math.min(Math.max(10, x), window.innerWidth - 280);
  const adjustedY = Math.min(Math.max(10, y), window.innerHeight - 240);

  // 1. فتح في نافذة مستقلة
  const handleOpenStandalone = async () => {
    try {
      const electron = (window as any).electronAPI || (window as any).electron;
      if (electron && typeof electron.openSectionWindow === 'function') {
        await electron.openSectionWindow({
          route: tabId,
          title: tabLabel
        });
        setFeedback('✅ تم فتح القسم في نافذة مستقلة بنجاح!');
        setTimeout(onClose, 1000);
        return;
      }

      // في المتصفح العادي: فتح نافذة مستقلة منبثقة بالحجم المثالي ومربوطة بالـ BroadcastChannel
      const currentUrl = new URL(window.location.href);
      currentUrl.hash = `#${tabId}?standalone=true`;
      currentUrl.searchParams.set('open-route', tabId);
      currentUrl.searchParams.set('route', tabId);
      currentUrl.searchParams.set('standalone', 'true');

      const win = window.open(
        currentUrl.toString(),
        `mufakir_win_${tabId}_${Date.now()}`,
        'width=1280,height=820,left=100,top=80,menubar=no,toolbar=no,location=no,status=no'
      );
      if (win) {
        setFeedback('✅ تم فتح القسم في نافذة مستقلة متزامنة!');
        setTimeout(onClose, 1000);
      } else {
        setFeedback('⚠️ يرجى السماح بالنوافذ المنبثقة من إعدادات المتصفح');
      }
    } catch (e: any) {
      console.warn('Open standalone window error:', e);
      setFeedback('تعذر فتح النافذة المنفصلة');
    }
  };

  // 2. إنشاء اختصار رسمي على سطح المكتب عبر Electron فقط بصيغة .lnk
  const handleCreateDesktopShortcut = async () => {
    setIsCreatingShortcut(true);
    try {
      const api = (window as any).electronAPI || (window as any).electron;

      if (api && typeof api.createDesktopShortcut === 'function') {
        const res = await api.createDesktopShortcut({ 
          route: tabId, 
          name: tabLabel,
          title: tabLabel 
        });

        if (res && res.success) {
          setFeedback(`✅ تم إنشاء اختصار "${tabLabel}" على سطح المكتب بنجاح!`);
        } else {
          setFeedback('⚠️ تعذر إنشاء الاختصار على سطح المكتب');
        }
      } else {
        setFeedback('ℹ️ ميزة إنشاء اختصارات سطح المكتب تعمل داخل تطبيق البرنامج المثبت فقط');
      }

      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.warn('Shortcut creation error:', err);
      setFeedback('تعذر إنشاء الاختصار');
      setTimeout(() => setFeedback(null), 2000);
    } finally {
      setIsCreatingShortcut(false);
    }
  };

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 w-72 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 p-2 animate-fadeIn text-right select-none"
      dir="rtl"
    >
      {/* رأس القائمة */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 font-black text-amber-300">
          <span className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
            {tabIcon}
          </span>
          <span className="truncate max-w-[170px]">{tabLabel}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {feedback && (
        <div className="mx-2 mt-2 p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* خيارات القائمة المنبثقة */}
      <div className="py-1 space-y-1 text-xs">
        {/* الخيار 1: فتح في نافذة مستقلة */}
        <button
          type="button"
          onClick={handleOpenStandalone}
          className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-indigo-600/30 border border-transparent hover:border-indigo-500/50 transition cursor-pointer text-right group"
        >
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 group-hover:bg-indigo-500 group-hover:text-white transition shrink-0 mt-0.5">
            <ExternalLink className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-100 group-hover:text-white flex items-center gap-1.5">
              <span>فتح في نافذة مستقلة</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold">
                RAM 0ms
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
              نافذة منفصلة متزامنة لحظياً بالذاكرة بدون ريفريش
            </div>
          </div>
        </button>

        {/* الخيار 2: إنشاء اختصار على سطح المكتب */}
        <button
          type="button"
          onClick={handleCreateDesktopShortcut}
          disabled={isCreatingShortcut}
          className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-amber-600/30 border border-transparent hover:border-amber-500/50 transition cursor-pointer text-right group disabled:opacity-50"
        >
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 group-hover:bg-amber-500 group-hover:text-slate-950 transition shrink-0 mt-0.5">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-100 group-hover:text-white flex items-center gap-1.5">
              <span>إنشاء اختصار على سطح المكتب</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-mono font-bold">
                .lnk
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
              تشغيل هذا القسم مباشرة (--open-route={tabId})
            </div>
          </div>
        </button>

        {/* الخيار 3: التبديل للقسم في هذه النافذة */}
        <button
          type="button"
          onClick={() => {
            onSelectTab(tabId);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-800 transition cursor-pointer text-right text-slate-300 hover:text-white"
        >
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-[11px]">الذهاب لهذا القسم هنا</span>
        </button>
      </div>

      <div className="px-3 py-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-indigo-400" />
          <span>مزامنة فورية بالرام</span>
        </span>
        <span className="text-emerald-400 font-mono font-bold">&lt; 1ms</span>
      </div>
    </div>
  );
};

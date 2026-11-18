import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Home, ShoppingCart, Boxes, Users, BarChart3, Settings, Moon, Sun, Maximize } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { TabType } from './Navigation';

const POS_KEY = 'mufakir_dock_pos';

// «شريط التحكم»: شريط عائم قابل للسحب يعطي وصولاً سريعاً من أي شاشة (مضمَّن في البرنامج).
export default function ModernDock({ activeTab, onSelectTab }: { activeTab: TabType; onSelectTab: (t: TabType) => void }) {
  const { hasPermission, toggleTheme, settings } = useApp() as any;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try { const r = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); if (r && typeof r.x === 'number') return r; } catch { /* ignore */ }
    return { x: 12, y: Math.max(12, (typeof window !== 'undefined' ? window.innerHeight : 700) - 72) }; // أسفل اليسار افتراضياً حتى لا يغطي الترويسة
  });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const clamp = (x: number, y: number) => {
    const w = ref.current?.offsetWidth || 120, h = ref.current?.offsetHeight || 40;
    return { x: Math.max(0, Math.min(window.innerWidth - w, x)), y: Math.max(0, Math.min(window.innerHeight - h, y)) };
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      d.moved = true;
      setPos(clamp(d.ox + dx, d.oy + dy));
    };
    const up = () => {
      const d = drag.current; drag.current = null;
      if (d?.moved) { try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch { /* ignore */ } }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);
  const posRef = useRef(pos); posRef.current = pos;

  const start = (e: React.PointerEvent) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false }; };
  const go = (t: TabType) => { setOpen(false); onSelectTab(t); };

  const items: { id: TabType; label: string; icon: React.ReactNode; ok: boolean }[] = [
    { id: 'home', label: 'الرئيسية', icon: <Home className="w-4 h-4" />, ok: true },
    { id: 'pos', label: 'البيع', icon: <ShoppingCart className="w-4 h-4" />, ok: hasPermission('canSell') },
    { id: 'inventory', label: 'المخزن', icon: <Boxes className="w-4 h-4" />, ok: hasPermission('canAccessInventory') },
    { id: 'customers', label: 'الديون', icon: <Users className="w-4 h-4" />, ok: hasPermission('canViewCustomers') },
    { id: 'reports', label: 'التقارير', icon: <BarChart3 className="w-4 h-4" />, ok: hasPermission('canViewReports') },
    { id: 'settings', label: 'الضبط', icon: <Settings className="w-4 h-4" />, ok: hasPermission('canAccessSettings') },
  ];
  const dark = settings?.theme === 'dark' || document.documentElement.classList.contains('dark');

  return (
    <div
      ref={ref}
      data-testid="modern-dock"
      className="no-print fixed z-40 select-none"
      style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
      dir="rtl"
    >
      <div className="rounded-2xl bg-slate-900/95 text-white border border-orange-400/40 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          <span onPointerDown={start} className="cursor-grab active:cursor-grabbing text-slate-400 p-0.5" title="اسحب لتحريك الشريط"><GripVertical className="w-4 h-4" /></span>
          <button type="button" data-testid="dock-toggle" onClick={() => setOpen((o) => !o)} className="text-xs font-black cursor-pointer">شريط التحكم</button>
        </div>
        {open && (
          <div className="flex flex-wrap gap-1.5 p-2 pt-0 max-w-[260px]">
            {items.filter((i) => i.ok).map((i) => (
              <button
                key={i.id}
                type="button"
                data-testid={`dock-${i.id}`}
                onClick={() => go(i.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${activeTab === i.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
              >{i.icon}<span>{i.label}</span></button>
            ))}
            <button type="button" onClick={() => toggleTheme?.()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}<span>المظهر</span>
            </button>
            <button type="button" onClick={() => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch { /* ignore */ } }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">
              <Maximize className="w-4 h-4" /><span>ملء الشاشة</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

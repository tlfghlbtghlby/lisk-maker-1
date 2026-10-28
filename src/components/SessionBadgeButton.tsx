import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, UserCheck, Users, Lock, ChevronDown } from 'lucide-react';

interface SessionBadgeButtonProps {
  className?: string;
  compact?: boolean;
}

export const SessionBadgeButton: React.FC<SessionBadgeButtonProps> = ({ className = '', compact = false }) => {
  const { sessionRole, openSessionModal, activeSupervisorName } = useApp();

  const getRoleConfig = () => {
    switch (sessionRole) {
      case 'admin':
        return {
          title: 'جلسة الأدمن',
          sub: 'كامل الصلاحيات',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          btnClass: 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700 shadow-xs ring-1 ring-emerald-500/40',
          badgeClass: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
        };
      case 'supervisor':
        return {
          title: activeSupervisorName ? `جلسة ${activeSupervisorName}` : 'جلسة المشرف',
          sub: 'صلاحيات إشرافية',
          icon: <UserCheck className="w-3.5 h-3.5 text-blue-300 shrink-0" />,
          btnClass: 'bg-blue-900 hover:bg-blue-800 text-white border-blue-700 shadow-xs ring-1 ring-blue-400/40',
          badgeClass: 'bg-blue-950 text-blue-200 border border-blue-800',
        };
      case 'employee':
      default:
        return {
          title: 'جلسة الموظف',
          sub: 'بيع وإدخال فقط',
          icon: <Users className="w-3.5 h-3.5 text-emerald-300 shrink-0" />,
          btnClass: 'bg-emerald-800 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs',
          badgeClass: 'bg-emerald-950 text-emerald-300 border border-emerald-700',
        };
    }
  };

  const config = getRoleConfig();

  return (
    <button
      type="button"
      onClick={() => openSessionModal()}
      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer whitespace-nowrap ${config.btnClass} ${className}`}
      title="انقر هنا للتبديل بين جلسة الأدمن وجلسة المشرف وجلسة الموظف العادي"
    >
      {config.icon}
      <span>{config.title}</span>
      {!compact && (
        <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal hidden sm:inline ${config.badgeClass}`}>
          {config.sub}
        </span>
      )}
      <ChevronDown className="w-3 h-3 opacity-70" />
    </button>
  );
};

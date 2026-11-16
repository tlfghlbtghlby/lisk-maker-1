import React from 'react';
import { RolePermissions } from '../types';

const LABELS: { key: keyof RolePermissions; label: string }[] = [
  { key: 'canSell', label: 'البيع في نقطة البيع' },
  { key: 'canAddNewProduct', label: 'إضافة مادة جديدة' },
  { key: 'canEditProductPrice', label: 'تعديل سعر المادة' },
  { key: 'canViewInvoices', label: 'سجل الفواتير' },
  { key: 'canReturnInvoice', label: 'استرجاع المواد' },
  { key: 'canEditInvoice', label: 'تعديل القوائم' },
  { key: 'canDeleteInvoice', label: 'حذف القوائم' },
  { key: 'canViewCustomers', label: 'الديون والعملاء' },
  { key: 'canViewReports', label: 'التقارير والأرباح' },
  { key: 'canViewCostPrice', label: 'سعر التكلفة والشراء' },
  { key: 'canAccessInventory', label: 'المخزن' },
  { key: 'canAccessShifts', label: 'الشفتات' },
  { key: 'canManageShifts', label: 'بدء وإنهاء الشفت' },
  { key: 'canConfigureShifts', label: 'إعداد الشفتات' },
  { key: 'canManageSalesReps', label: 'المندوبون' },
  { key: 'canAccessSettings', label: 'الإعدادات' },
];

/**
 * تحديد صلاحيات فرعية (لشفت أو لمشرف). تتبع صلاحيات الدور في الإعدادات:
 * إن كانت الصلاحية مغلقة في الدور تظهر مغلقة هنا ولا يمكن تفعيلها، ولا تُفتح إلا بعد تفعيلها في الدور.
 */
export default function PermissionSubsetEditor({
  rolePerms, value, onChange, roleName,
}: {
  rolePerms: RolePermissions;
  value: Partial<RolePermissions> | undefined;
  onChange: (v: Partial<RolePermissions>) => void;
  roleName: string;
}) {
  const v = value || {};
  const toggle = (k: keyof RolePermissions, checked: boolean) => {
    const next: any = { ...v };
    if (checked) delete next[k]; else next[k] = false;
    onChange(next);
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5" data-testid="perm-subset">
      {LABELS.map(({ key, label }) => {
        const roleOn = !!rolePerms[key];
        const on = roleOn && v[key] !== false;
        return (
          <label key={key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px] font-bold ${roleOn ? 'cursor-pointer border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200' : 'opacity-60 border-dashed border-slate-300 dark:border-slate-700 text-slate-500'}`}>
            <input type="checkbox" checked={on} disabled={!roleOn} onChange={(e) => toggle(key, e.target.checked)} className="w-3.5 h-3.5 rounded text-emerald-600" />
            <span className="flex-1">{label}</span>
            {!roleOn && <span className="text-[9px] text-red-600">مغلقة في صلاحيات {roleName}</span>}
          </label>
        );
      })}
    </div>
  );
}

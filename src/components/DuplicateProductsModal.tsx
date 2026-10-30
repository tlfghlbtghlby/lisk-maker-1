import React, { useState, useMemo } from 'react';
import { 
  X, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Barcode, 
  Sparkles, 
  Info, 
  Check, 
  RefreshCw,
  Copy,
  ArrowRight,
  Tag
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { findDuplicateGroups } from '../utils/duplicateCleaner';

interface DuplicateProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConfirmDialogState = 
  | { type: 'selected'; count: number }
  | { type: 'all'; count: number; scopeTitle: string }
  | { type: 'single'; item: Product; primaryItem: Product }
  | null;

export const DuplicateProductsModal: React.FC<DuplicateProductsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { products, batchDeleteProducts, formatMoney } = useApp();

  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set());
  const [mergeStockOnClean, setMergeStockOnClean] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'barcode' | 'exact' | 'name_price'>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  // Group all duplicates only when modal is open
  const duplicateGroups = useMemo(() => {
    if (!isOpen) return [];
    return findDuplicateGroups(products);
  }, [products, isOpen]);

  // Filtered groups:
  // - barcode: matches identical barcode
  // - exact: matches 100% data details except addition date (createdAt)
  // - name_price: matches name and retail price
  const filteredGroups = useMemo(() => {
    if (filterType === 'barcode') {
      return duplicateGroups.filter(g => g.isBarcodeMatch || g.matchType === 'barcode' || g.matchType === 'both');
    }
    if (filterType === 'exact') {
      return duplicateGroups.filter(g => g.isExactMatch || g.matchType === 'exact_details' || g.matchType === 'both');
    }
    if (filterType === 'name_price') {
      return duplicateGroups.filter(g => g.isNamePriceMatch || g.matchType === 'name_price');
    }
    return duplicateGroups;
  }, [duplicateGroups, filterType]);

  // Counts of duplicate items for filter tabs
  const barcodeDuplicateItemsCount = useMemo(() => {
    return duplicateGroups
      .filter(g => g.isBarcodeMatch || g.matchType === 'barcode' || g.matchType === 'both')
      .reduce((sum, g) => sum + g.duplicateItems.length, 0);
  }, [duplicateGroups]);

  const exactDuplicateItemsCount = useMemo(() => {
    return duplicateGroups
      .filter(g => g.isExactMatch || g.matchType === 'exact_details' || g.matchType === 'both')
      .reduce((sum, g) => sum + g.duplicateItems.length, 0);
  }, [duplicateGroups]);

  const namePriceDuplicateItemsCount = useMemo(() => {
    return duplicateGroups
      .filter(g => g.isNamePriceMatch || g.matchType === 'name_price')
      .reduce((sum, g) => sum + g.duplicateItems.length, 0);
  }, [duplicateGroups]);

  // Total duplicates count that can be cleaned across all groups
  const totalDuplicateCount = useMemo(() => {
    return duplicateGroups.reduce((sum, g) => sum + g.duplicateItems.length, 0);
  }, [duplicateGroups]);

  // Duplicate items in the currently active tab
  const activeTabDuplicateCount = useMemo(() => {
    return filteredGroups.reduce((sum, g) => sum + g.duplicateItems.length, 0);
  }, [filteredGroups]);

  // Current tab human-readable title
  const currentTabTitle = useMemo(() => {
    if (filterType === 'barcode') return 'قسم تطابق الباركود';
    if (filterType === 'exact') return 'قسم تشابه 100% بالبيانات';
    if (filterType === 'name_price') return 'قسم تشابه في الاسم والسعر';
    return 'كافة الأقسام';
  }, [filterType]);

  // Toggle single item selection
  const toggleSelect = (id: string) => {
    setSelectedDuplicateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all duplicate items in current filtered view
  const selectAllVisibleDuplicates = () => {
    const next = new Set<string>();
    filteredGroups.forEach(g => {
      g.duplicateItems.forEach(d => next.add(d.id));
    });
    setSelectedDuplicateIds(next);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedDuplicateIds(new Set());
  };

  // Execute batch deletion atomically with optional stock merge
  const executeBatchDelete = async (idsToDelete: string[], isAll: boolean, scopeName?: string) => {
    if (idsToDelete.length === 0) return;

    setIsProcessing(true);
    try {
      const stockIncrements: Record<string, number> = {};
      const idSet = new Set(idsToDelete);

      if (mergeStockOnClean) {
        duplicateGroups.forEach(group => {
          const duplicatesToMerge = group.duplicateItems.filter(d => idSet.has(d.id));
          const totalStockToTransfer = duplicatesToMerge.reduce((acc, curr) => acc + (curr.stock || 0), 0);
          if (totalStockToTransfer > 0) {
            stockIncrements[group.primaryItem.id] = (stockIncrements[group.primaryItem.id] || 0) + totalStockToTransfer;
          }
        });
      }

      const res = await batchDeleteProducts(idsToDelete, stockIncrements);

      if (res.success) {
        setSelectedDuplicateIds(prev => {
          const next = new Set(prev);
          idsToDelete.forEach(id => next.delete(id));
          return next;
        });
        setConfirmDialog(null);
        if (isAll) {
          setActionNotice(`🎉 تم بنجاح تنظيف وحذف كافة مكررات ${scopeName || 'القسم المحدد'} (${res.deletedCount} مادة مكررة).`);
        } else {
          setActionNotice(`✅ تم بنجاح حذف ${res.deletedCount} مادة مكررة محددة وتحديث رصيد المخزن.`);
        }
        setTimeout(() => setActionNotice(null), 5000);
      } else {
        setActionNotice(`⚠️ تعذر الحذف: ${res.error || 'حدث خطأ غير متوقع'}`);
      }
    } catch (err: any) {
      setActionNotice(`⚠️ حدث خطأ أثناء الحذف: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Execute single item delete
  const executeSingleDelete = async (dup: Product, primaryItem: Product) => {
    setIsProcessing(true);
    try {
      const stockIncrements: Record<string, number> = {};
      if (mergeStockOnClean && (dup.stock || 0) > 0) {
        stockIncrements[primaryItem.id] = dup.stock;
      }

      const res = await batchDeleteProducts([dup.id], stockIncrements);

      if (res.success) {
        setSelectedDuplicateIds(prev => {
          const next = new Set(prev);
          next.delete(dup.id);
          return next;
        });
        setConfirmDialog(null);
        setActionNotice(`✅ تم حذف النسخة المكررة (${dup.name}) بنجاح`);
        setTimeout(() => setActionNotice(null), 3500);
      } else {
        setActionNotice(`⚠️ تعذر الحذف: ${res.error || 'حدث خطأ'}`);
      }
    } catch (err: any) {
      setActionNotice(`⚠️ حدث خطأ: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Triggers for buttons to open in-app confirmation
  const handleOpenDeleteSelectedConfirm = () => {
    if (selectedDuplicateIds.size === 0) return;
    setConfirmDialog({ type: 'selected', count: selectedDuplicateIds.size });
  };

  const handleOpenAutoCleanAllConfirm = () => {
    if (activeTabDuplicateCount === 0) return;
    setConfirmDialog({ 
      type: 'all', 
      count: activeTabDuplicateCount,
      scopeTitle: currentTabTitle
    });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog) return;

    if (confirmDialog.type === 'selected') {
      executeBatchDelete(Array.from(selectedDuplicateIds), false);
    } else if (confirmDialog.type === 'all') {
      // Strictly collect duplicate IDs from filteredGroups (the currently active tab!)
      const targetIds: string[] = [];
      filteredGroups.forEach(g => {
        g.duplicateItems.forEach(d => targetIds.push(d.id));
      });
      executeBatchDelete(targetIds, true, confirmDialog.scopeTitle);
    } else if (confirmDialog.type === 'single') {
      executeSingleDelete(confirmDialog.item, confirmDialog.primaryItem);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-white to-indigo-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>أداة كشف وإلغاء المواد المكررة</span>
                {totalDuplicateCount > 0 ? (
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                    {totalDuplicateCount} مادة مكررة
                  </span>
                ) : (
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    المخزن نظيف وخالٍ من التكرار
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                فحص المواد المتطابقة في الباركود، أو المتطابقة بنسبة 100% في بياناتها (ما عدا تاريخ الإضافة)، أو المتشابهة في الاسم والسعر مع إمكانية مراجعتها وتنظيفها.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* In-App Confirmation Prompt (Prevents browser popup block in iframe) */}
        {confirmDialog && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-950 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black">
                  {confirmDialog.type === 'all'
                    ? `تأكيد تنظيف وحذف مكررات ${confirmDialog.scopeTitle} (${confirmDialog.count} مادة مكررة)`
                    : confirmDialog.type === 'selected'
                    ? `تأكيد حذف المواد المحددة (${confirmDialog.count} مادة)`
                    : `تأكيد حذف النسخة المكررة (${confirmDialog.item.name})`}
                </h4>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  {confirmDialog.type === 'all'
                    ? `سيتم تنظيف وحذف المواد المكررة التابعة لـ (${confirmDialog.scopeTitle}) فقط والاحتفاظ بالمادة الأساسية لكل صنف دون المساس بباقي الأقسام.`
                    : 'سيتم حذف المواد المختارة نهائياً من قاعدة بيانات المخزن.'}
                  {mergeStockOnClean && (
                    <span className="block mt-1 font-bold text-emerald-800">
                      ✓ سيتم دمج وجمع رصيد المواد المحذوفة تلقائياً في المادة الأصلية لحماية بضاعتك من أي نقص.
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleConfirmAction}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 active:scale-98"
                  >
                    {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span>نعم، تأكيد الحذف الآن</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition cursor-pointer"
                  >
                    إلغاء وتراجع
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Batch Actions Bar */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Filter Type */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({totalDuplicateCount} مكرر)
            </button>
            <button
              type="button"
              onClick={() => setFilterType('barcode')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                filterType === 'barcode'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>تطابق الباركود ({barcodeDuplicateItemsCount} مكرر)</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('exact')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                filterType === 'exact'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>تشابه 100% بالبيانات ما عدا تاريخ الإضافة ({exactDuplicateItemsCount} مكرر)</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('name_price')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                filterType === 'name_price'
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>تشابه في الاسم والسعر ({namePriceDuplicateItemsCount} مكرر)</span>
            </button>
          </div>

          {/* Merge Stock Toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 hover:border-slate-300 transition">
            <input
              type="checkbox"
              checked={mergeStockOnClean}
              onChange={(e) => setMergeStockOnClean(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <span>دمج رصيد المخزن في المادة الأصلية قبل الحذف (حماية من ضياع الرصيد)</span>
          </label>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {totalDuplicateCount === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-base font-extrabold text-slate-800">المخزن منظم وخالٍ تماماً من أي مواد مكررة</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                كافة المواد ({products.length} مادة) متميزة وفريدة في الباركود والتفاصيل. لا توجد نسخ مكررة مطابقة في النظام.
              </p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="py-14 text-center text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Info className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">لا توجد مواد مكررة في هذا التصنيف المحدد</h4>
              <p className="text-xs text-slate-500 mt-1">
                يمكنك التبديل إلى قسم "الكل" لعرض كافة المواد المكررة الأخرى.
              </p>
            </div>
          ) : (
            <>
              {/* Review Tip */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>طريقة المراجعة:</strong> يتم تمييز المادة الأصلية باللون الأخضر (التي ستبقى في المخزن)، بينما تظهر النسخ المكررة الإضافية باللون البرتقالي/الأبيض ويمكنك حذفها فرادى أو تحديدها وحذفها معاً.
                </div>
              </div>

              {/* Group Cards */}
              <div className="space-y-4">
                {filteredGroups.map((group, groupIdx) => {
                  const isBarcodeMatch = group.matchType === 'barcode' || group.matchType === 'both';
                  const isExactMatch = group.matchType === 'exact_details' || group.matchType === 'both';

                  return (
                    <div
                      key={group.id}
                      className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition hover:border-slate-300"
                    >
                      {/* Group Header */}
                      <div className="p-3.5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">
                            {groupIdx + 1}
                          </span>
                          <div>
                            <span className="font-extrabold text-xs text-slate-900">
                              {group.matchLabel}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              اسم المادة: <strong className="text-slate-800">{group.primaryItem.name}</strong> · إجمالي النسخ: {group.allProducts.length}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isBarcodeMatch && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 font-mono">
                              كود: {group.primaryItem.code || group.matchKey}
                            </span>
                          )}
                          {isExactMatch && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold border border-indigo-200">
                              تطابق 100% بالبيانات (ما عدا تاريخ الإضافة)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items List in Group */}
                      <div className="divide-y divide-slate-100">
                        {/* 1. Primary Item (Keeper) */}
                        <div className="p-3.5 bg-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-extrabold flex items-center gap-1 shrink-0 shadow-2xs">
                              <Check className="w-3.5 h-3.5" />
                              المادة الأساسية (ستبقى)
                            </span>
                            <div>
                              <div className="text-xs font-black text-slate-900">
                                {group.primaryItem.name}
                              </div>
                              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                                <span>الكود: <strong className="font-mono text-slate-700">{group.primaryItem.code || 'بدون كود'}</strong></span>
                                <span>التصنيف: <strong>{group.primaryItem.category || 'عام'}</strong></span>
                                <span>الوحدة: <strong>{group.primaryItem.unit || 'قطعة'}</strong></span>
                                <span>تاريخ الإضافة: {group.primaryItem.createdAt ? new Date(group.primaryItem.createdAt).toLocaleDateString('ar-IQ') : 'قديم'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                            <div className="text-left">
                              <span className="text-[11px] text-slate-400 block">سعر البيع:</span>
                              <span className="text-xs font-bold text-emerald-700">{formatMoney(group.primaryItem.retailPrice)}</span>
                            </div>
                            <div className="text-left bg-emerald-100/70 border border-emerald-300/80 px-2.5 py-1 rounded-lg">
                              <span className="text-[10px] text-emerald-800 block font-bold">الرصيد بالمخزن:</span>
                              <span className="text-xs font-black text-emerald-950">{group.primaryItem.stock} {group.primaryItem.unit}</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Duplicate Items (To be pruned) */}
                        {group.duplicateItems.map((dup, dupIdx) => {
                          const isSelected = selectedDuplicateIds.has(dup.id);

                          return (
                            <div
                              key={`${dup.id}_${dupIdx}`}
                              className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                                isSelected ? 'bg-rose-50/80 border-r-4 border-r-rose-600' : 'bg-white hover:bg-slate-50/70'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelect(dup.id)}
                                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                                  />
                                </label>
                                <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold shrink-0">
                                  نسخة مكررة #{dupIdx + 1}
                                </span>
                                <div>
                                  <div className="text-xs font-bold text-slate-800">
                                    {dup.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                                    <span>الكود: <strong className="font-mono text-slate-700">{dup.code || 'بدون كود'}</strong></span>
                                    <span>التصنيف: <strong>{dup.category || 'عام'}</strong></span>
                                    <span>الوحدة: <strong>{dup.unit || 'قطعة'}</strong></span>
                                    <span>تاريخ الإضافة: {dup.createdAt ? new Date(dup.createdAt).toLocaleDateString('ar-IQ') : 'لاحق'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                                <div className="text-left">
                                  <span className="text-[11px] text-slate-400 block">سعر البيع:</span>
                                  <span className="text-xs font-bold text-slate-700">{formatMoney(dup.retailPrice)}</span>
                                </div>
                                <div className="text-left bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                                  <span className="text-[10px] text-slate-500 block">الرصيد:</span>
                                  <span className="text-xs font-black text-slate-800">{dup.stock} {dup.unit}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDialog({ type: 'single', item: dup, primaryItem: group.primaryItem })}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                                  title="حذف هذه النسخة المكررة فقط"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>حذف</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            {selectedDuplicateIds.size > 0 ? (
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-700">
                  تم تحديد {selectedDuplicateIds.size} مادة مكررة
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-slate-500 hover:text-slate-800 underline text-[11px] cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
            ) : activeTabDuplicateCount > 0 ? (
              <button
                type="button"
                onClick={selectAllVisibleDuplicates}
                className="text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
              >
                تحديد كافة المواد المكررة في هذا القسم ({activeTabDuplicateCount})
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex-1 sm:flex-initial text-center"
            >
              إغلاق
            </button>

            {selectedDuplicateIds.size > 0 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleOpenDeleteSelectedConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs flex-1 sm:flex-initial active:scale-98"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف المحدد ({selectedDuplicateIds.size})</span>
              </button>
            )}

            {activeTabDuplicateCount > 0 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleOpenAutoCleanAllConfirm}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 flex-1 sm:flex-initial active:scale-98"
                title={`حذف كافة المواد المكررة في ${currentTabTitle} فقط`}
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {filterType === 'barcode'
                    ? `تنظيف وحذف كافة مكررات الباركود (${activeTabDuplicateCount})`
                    : filterType === 'exact'
                    ? `تنظيف وحذف كافة مكررات تشابه 100% (${activeTabDuplicateCount})`
                    : filterType === 'name_price'
                    ? `تنظيف وحذف كافة مكررات الاسم والسعر (${activeTabDuplicateCount})`
                    : `تنظيف وحذف كافة المكررات (${activeTabDuplicateCount})`}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  ArrowUpDown, 
  Boxes,
  TrendingUp,
  Tag,
  Download,
  Filter,
  Box,
  Scan,
  Zap,
  Copy
} from 'lucide-react';
import { getCartonBreakdown } from '../utils/cartonUtils';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { DuplicateProductsModal } from './DuplicateProductsModal';

interface InventoryViewProps {
  onOpenNewProduct: () => void;
  onEditProduct: (product: Product) => void;
  onOpenQuickAdd?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  onOpenNewProduct,
  onEditProduct,
  onOpenQuickAdd,
}) => {
  const { 
    products, 
    deleteProduct, 
    adjustStock, 
    formatMoney, 
    settings, 
    sessionRole,
    duplicateGroups,
    isDuplicatesModalOpen,
    setIsDuplicatesModalOpen
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'profit' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((prod) => {
        const matchCat = selectedCategory === 'all' || prod.category === selectedCategory;
        const q = searchQuery.toLowerCase().trim();
        const matchSearch =
          !q ||
          prod.name.toLowerCase().includes(q) ||
          prod.code.toLowerCase().includes(q) ||
          prod.category.toLowerCase().includes(q);

        let matchStock = true;
        if (stockFilter === 'low') {
          matchStock = prod.stock <= prod.minStock && prod.stock > 0;
        } else if (stockFilter === 'out') {
          matchStock = prod.stock <= 0;
        }

        return matchCat && matchSearch && matchStock;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'name') diff = a.name.localeCompare(b.name, 'ar');
        else if (sortBy === 'stock') diff = a.stock - b.stock;
        else if (sortBy === 'price') diff = a.retailPrice - b.retailPrice;
        else if (sortBy === 'profit') {
          const profitA = a.retailPrice - a.costPrice;
          const profitB = b.retailPrice - b.costPrice;
          diff = profitA - profitB;
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [products, selectedCategory, searchQuery, stockFilter, sortBy, sortOrder]);

  // Pagination State (تسريع عرض الجدول ومنع تجميد الشاشة)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // إعادة الترقيم للصفحة الأولى عند تغير خيارات البحث أو التصفية
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, stockFilter, sortBy, sortOrder]);

  const effectivePageSize = pageSize === -1 ? (filteredProducts.length || 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / effectivePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    if (pageSize === -1) return filteredProducts;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, safeCurrentPage, pageSize]);

  // Overall Inventory Stats
  const totalItemsCount = products.reduce((sum, p) => sum + p.stock, 0);
  const totalCostValuation = products.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + p.retailPrice * p.stock, 0);
  const expectedProfitValuation = totalRetailValuation - totalCostValuation;
  const lowStockCount = products.filter((p) => p.stock <= p.minStock && p.stock > 0).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;

  const handleDelete = (prod: Product) => {
    if (confirm(`هل أنت متأكد من حذف المادة (${prod.name}) من المخزن؟`)) {
      deleteProduct(prod.id);
    }
  };

  const handleExportCSV = () => {
    const headers = ['الكود', 'اسم المادة', 'الفئة', 'الوحدة', 'سعر الجملة', 'سعر التجزئة', 'سعر بيع الجملة', 'الكمية بالمخزن', 'الحد الأدنى'];
    const rows = products.map((p) => [
      `"${p.code}"`,
      `"${p.name}"`,
      `"${p.category}"`,
      `"${p.unit}"`,
      p.costPrice,
      p.retailPrice,
      p.wholesalePrice,
      p.stock,
      p.minStock,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `قائمة_المواد_والمخزون_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Valuation Summary Cards */}
      {sessionRole === 'admin' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">إجمالي أنواع المواد بالمخزن</div>
            <div className="text-2xl font-black text-slate-900 flex items-center justify-between">
              <span>{products.length} صنف</span>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {totalItemsCount} قطعة/وحدة
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">قيمة المخزون بسعر الجملة (التكلفة)</div>
            <div className="text-2xl font-black text-slate-900">
              {formatMoney(totalCostValuation)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">قيمة المخزون بسعر البيع (المتوقع)</div>
            <div className="text-2xl font-black text-emerald-700">
              {formatMoney(totalRetailValuation)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">الربح الصافي المتوقع عند تصريف المخزون</div>
            <div className="text-2xl font-black text-blue-700 flex items-center gap-1.5">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <span>{formatMoney(expectedProfitValuation)}</span>
            </div>
          </div>

        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">إجمالي المواد المتوفرة بالمخزن</div>
            <div className="text-2xl font-black text-slate-900 flex items-center justify-between">
              <span>{products.length} صنف</span>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {totalItemsCount} قطعة
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">المواد التي قاربت على النفاد</div>
            <div className="text-2xl font-black text-amber-600 flex items-center justify-between">
              <span>{lowStockCount} مادة</span>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                تحت حد الطلب
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-500 mb-1">المواد المنتهية الرصيد</div>
            <div className="text-2xl font-black text-rose-600 flex items-center justify-between">
              <span>{outOfStockCount} صنف</span>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                رصيدها صفر
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Search, Filters, Add Button */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search */}
          <div className="relative flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم المادة، الرمز، أو الباركود..."
                className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 cursor-pointer font-bold"
                >
                  مسح
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="مسح باركود بالكاميرا للبحث عن المادة فوراً"
            >
              <Scan className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">مسح باركود</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* زر كشف وإلغاء المواد المكررة */}
            <button
              type="button"
              onClick={() => setIsDuplicatesModalOpen(true)}
              className={`px-3 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                duplicateGroups.length > 0
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-400/30 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="كشف المواد المكررة بالباركود، أو المتطابقة 100% بالبيانات وإلغاؤها وحذفها"
            >
              <Copy className="w-3.5 h-3.5 text-amber-600" />
              <span>فحص المواد المكررة</span>
              {duplicateGroups.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-black">
                  {duplicateGroups.reduce((sum, g) => sum + g.duplicateItems.length, 0)} مكرر
                </span>
              )}
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 flex items-center gap-1.5 transition"
              title="تصدير جدول المواد إلى Excel/CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={onOpenNewProduct}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إدخال مادة جديدة</span>
            </button>

            {onOpenQuickAdd && (
              <button
                onClick={onOpenQuickAdd}
                className="px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-100/90 hover:bg-amber-200 border border-amber-300/80 rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
                title="إضافة مواد سريعة متعددة بأسطر وفواصل"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>إضافة مواد سريعة</span>
              </button>
            )}
          </div>

        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          
          {/* Categories */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-slate-500 font-medium ml-1">التصنيف:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'الكل' : cat}
              </button>
            ))}
          </div>

          {/* Stock state filter */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium ml-1">حالة المخزن:</span>
            <button
              onClick={() => setStockFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                stockFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              الكل ({products.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                stockFilter === 'low' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              قارب النفاد ({lowStockCount})
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                stockFilter === 'out' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              نافد ({products.filter((p) => p.stock <= 0).length})
            </button>
          </div>

        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100/80 text-slate-700 text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">الرمز</th>
                <th className="py-3 px-4">اسم المادة / الصنف</th>
                <th className="py-3 px-4">التصنيف</th>
                <th className="py-3 px-4">الوحدة</th>
                <th className="py-3 px-4 text-emerald-800">سعر تكلفة الجملة (الشراء)</th>
                <th className="py-3 px-4 text-slate-900">سعر بيع المفرد</th>
                {settings.enableWholesale && (
                  <th className="py-3 px-4 text-blue-900">سعر بيع الجملة</th>
                )}
                <th className="py-3 px-4 text-slate-700">هامش الربح (مفرق)</th>
                <th className="py-3 px-4 text-center">الكمية المتوفرة</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={settings.enableWholesale ? 10 : 9} className="py-12 text-center text-slate-400">
                    <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">لا توجد مواد مطابقة لخيارات البحث</p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((prod) => {
                  const retailProfit = prod.retailPrice - prod.costPrice;
                  const retailMarginPercent = prod.costPrice > 0 ? ((retailProfit / prod.costPrice) * 100).toFixed(0) : '100';
                  const isLow = prod.stock <= prod.minStock && prod.stock > 0;
                  const isOut = prod.stock <= 0;

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50/70 transition group"
                    >
                      {/* Code */}
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        #{prod.code}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{prod.name}</div>
                        {prod.notes && (
                          <div className="text-[11px] text-slate-400 font-normal">{prod.notes}</div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {prod.category}
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {prod.unit}
                      </td>

                      {/* Cost Price */}
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {formatMoney(prod.costPrice)}
                      </td>

                      {/* Retail Price */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatMoney(prod.retailPrice)}
                      </td>

                      {/* Wholesale Selling Price - only if wholesale enabled */}
                      {settings.enableWholesale && (
                        <td className="py-3 px-4 font-bold text-blue-700">
                          {formatMoney(prod.wholesalePrice)}
                        </td>
                      )}

                      {/* Margin */}
                      <td className="py-3 px-4 text-xs">
                        <div className="font-bold text-emerald-600">
                          +{formatMoney(retailProfit)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          ربح {retailMarginPercent}%
                        </div>
                      </td>

                      {/* Stock with quick +/- */}
                      <td className="py-3 px-4">
                        {(() => {
                          const isWeight = Boolean(prod.isWeighted || prod.unit === 'كغم' || prod.unit === 'كيلو' || prod.unit === 'غرام' || prod.unit === 'غم');
                          const ppc = prod.piecesPerCarton || 1;
                          const breakdown = getCartonBreakdown(prod.stock, ppc);

                          if (isWeight) {
                            return (
                              <div className="flex flex-col items-center gap-1.5 min-w-[140px]">
                                <span
                                  className={`text-center font-bold text-xs px-2.5 py-1 rounded-md whitespace-nowrap shadow-2xs ${
                                    isOut
                                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                      : isLow
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}
                                  title={`الرصيد بالوزن: ${prod.stock} كغم`}
                                >
                                  {prod.stock} كغم {typeof prod.itemCount === 'number' && prod.itemCount > 0 ? `(${prod.itemCount} عدد/كيس)` : ''}
                                </span>

                                {/* Quick Adjustment Controls for Weight */}
                                <div className="flex items-center gap-1 text-[11px] whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => adjustStock(prod.id, -1)}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                                    title="خصم 1 كغم"
                                  >
                                    -1 كغم
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => adjustStock(prod.id, 1)}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                                    title="إضافة 1 كغم"
                                  >
                                    +1 كغم
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <button
                                    type="button"
                                    onClick={() => adjustStock(prod.id, 5)}
                                    className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition"
                                    title="إضافة 5 كغم"
                                  >
                                    +5 كغم
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col items-center gap-1.5 min-w-[140px]">
                              <span
                                className={`text-center font-bold text-xs px-2.5 py-1 rounded-md whitespace-nowrap shadow-2xs ${
                                  isOut
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                                title={`إجمالي القطع بالمخزن: ${prod.stock} قطعة`}
                              >
                                {breakdown.formatted}
                              </span>

                              {/* Quick Adjustment Controls */}
                              <div className="flex items-center gap-1 text-[11px] whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => adjustStock(prod.id, -1)}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                                  title="خصم قطعة واحدة"
                                >
                                  -1 ق
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustStock(prod.id, 1)}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                                  title="إضافة قطعة واحدة"
                                >
                                  +1 ق
                                </button>
                                {ppc > 1 && (
                                  <>
                                    <span className="text-slate-300">|</span>
                                    <button
                                      type="button"
                                      onClick={() => adjustStock(prod.id, -ppc)}
                                      className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200 transition"
                                      title={`خصم كارتون كامل (${ppc} قطعة)`}
                                    >
                                      -1 كارتون
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => adjustStock(prod.id, ppc)}
                                      className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition"
                                      title={`إضافة كارتون كامل (${ppc} قطعة)`}
                                    >
                                      +1 كارتون
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onEditProduct(prod)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="تعديل المادة والأسعار"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {sessionRole === 'admin' && (
                            <button
                              onClick={() => handleDelete(prod)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="حذف المادة من المخزن (خاص بالأدمن)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredProducts.length > 0 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-medium">عرض:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 focus:outline-none"
              >
                <option value={25}>25 مادة</option>
                <option value={50}>50 مادة</option>
                <option value={100}>100 مادة</option>
                <option value={-1}>عرض الكل ({filteredProducts.length})</option>
              </select>
              <span className="text-slate-500">
                | عرض {((safeCurrentPage - 1) * effectivePageSize) + 1} إلى {Math.min(safeCurrentPage * effectivePageSize, filteredProducts.length)} من أصل {filteredProducts.length} مادة
              </span>
            </div>

            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold cursor-pointer"
                >
                  السابق
                </button>
                <div className="flex items-center gap-1 font-bold">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                    let pageNum = idx + 1;
                    if (totalPages > 5 && safeCurrentPage > 3) {
                      pageNum = safeCurrentPage - 2 + idx;
                      if (pageNum > totalPages) pageNum = totalPages - 4 + idx;
                    }
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg transition text-xs font-bold cursor-pointer ${
                          safeCurrentPage === pageNum
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold cursor-pointer"
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(scanned) => {
          setSearchQuery(scanned);
          setIsScannerOpen(false);
        }}
        title="مسح باركود المادة في المخزن"
      />

      <DuplicateProductsModal
        isOpen={isDuplicatesModalOpen}
        onClose={() => setIsDuplicatesModalOpen(false)}
      />

    </div>
  );
};

import ReturnItemsModal from './ReturnItemsModal';
import { matchAr } from '../utils/arabicSearch';
import { isAndroidApp } from '../utils/androidOnly';
import { isOverlayOpen } from '../utils/modalKeyGuard';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { dozenName } from '../utils/packLabel';
import { useApp } from '../context/AppContext';
import { registerPosScanHandler } from '../utils/barcodeBus';
import { allCodes, productsByCode } from '../utils/productCodes';
import { Product, SaleType, PriceType, InvoiceItem, Invoice } from '../types';
import { getPiecePrice as getPiecePriceBase, resolvePiecePrice, hasOwnPrice, PRICE_TYPE_LABELS } from '../utils/pricing';
import { applyPromotions } from '../utils/promotions';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  Receipt, 
  UserCheck, 
  CreditCard, 
  DollarSign, 
  AlertCircle, 
  Calendar, 
  CheckCircle2, 
  Tag, 
  Clock, 
  Printer, 
  Settings,
  ArrowLeft,
  ArrowRight,
  Scan,
  UserPlus,
  Pencil,
  AlignJustify,
  Box,
  Save,
  X,
  Package,
  Check,
  AlertTriangle,
  Play,
  LayoutGrid,
  List,
  Scale,
  Briefcase,
  Percent,
  Sparkles
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ChangeCalculatorModal } from './ChangeCalculatorModal';
import { ProductThumbPreview } from './ProductImageModal';
import { SessionBadgeButton } from './SessionBadgeButton';

interface POSViewProps {
  onInvoiceCreated: (invoice: Invoice, andPrint: boolean) => void;
  onOpenNewProduct: (initialBarcode?: string) => void;
  onEditProduct?: (product: Product) => void;
  onOpenSettings?: () => void;
}

const playScannerBeep = (type: 'success' | 'alert' | 'unfound' = 'success') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'unfound') {
      // تنبيه مختلف: ثلاث نبضات متناوبة عالية/منخفضة تدل أن المادة لم تدخل القائمة
      osc.type = 'square';
      const t0 = ctx.currentTime;
      [880, 480, 880, 480, 880].forEach((f, i) => osc.frequency.setValueAtTime(f, t0 + i * 0.14));
      gain.gain.setValueAtTime(0.28, t0);
      gain.gain.setValueAtTime(0.28, t0 + 0.68);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(t0 + 0.75);
      try { navigator.vibrate?.([120, 60, 120, 60, 200]); } catch (e) {}
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1700, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {}
};



/** خلية إدخال اسم المادة في وضع القائمة: اقتراحات من المخزن المحلي مع السعر بجانب كل اسم */
const ListEntryCell: React.FC<{
  products: Product[];
  priceOf: (p: Product) => number;
  priceLabel: string;
  formatMoney: (n: number) => string;
  onPick: (p: Product) => void;
  onEmptyEnter?: () => void;
}> = ({ products, priceOf, priceLabel, formatMoney, onPick, onEmptyEnter }) => {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const list = useMemo(() => {
    const t = q.trim();
    if (!t) return [] as Product[];
    const tl = t.toLowerCase();
    const exact = products.filter((p) => p && p.id && (String(p.code || '').toLowerCase() === tl || (p.extraCodes || []).some((c) => String(c).toLowerCase() === tl)));
    if (exact.length) return exact.slice(0, 8);
    return products.filter((p) => p && p.id && (matchAr(p.name, t) || String(p.code || '').toLowerCase().includes(tl))).slice(0, 8);
  }, [q, products]);
  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, top: r.bottom + 2, width: Math.max(r.width, 320) });
  };
  const pick = (p: Product) => {
    onPick(p);
    setQ(''); setHi(0); setOpen(false);
  };
  return (
    <>
      <input
        ref={ref}
        data-list-entry="1"
        value={q}
        placeholder="اكتب اسم المادة أو الباركود…"
        onChange={(e) => { setQ(e.target.value); setHi(0); setOpen(true); place(); }}
        onFocus={() => { place(); if (q) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') return;
          e.stopPropagation();
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(list.length - 1, h + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (list[hi]) pick(list[hi]); else if (!q.trim()) onEmptyEnter?.(); }
          else if (e.key === 'Escape') { setQ(''); setOpen(false); }
        }}
        className="w-full bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 focus:bg-white px-1.5 py-1 text-[12px] font-bold text-slate-900"
      />
      {open && list.length > 0 && rect && createPortal(
        <div className="fixed z-[200] bg-white border border-slate-400 rounded-lg shadow-2xl overflow-hidden" style={{ left: rect.left, top: rect.top, width: rect.width }} dir="rtl" data-testid="list-suggestions">
          {list.map((p, i) => (
            <button
              key={p.id}
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setHi(i)}
              className={`w-full flex items-center justify-between gap-3 px-2.5 py-1.5 text-right text-[12px] cursor-pointer border-b border-slate-100 last:border-0 ${i === hi ? 'bg-emerald-100' : 'bg-white'}`}
            >
              <span className="font-bold text-slate-900 truncate">{p.name}</span>
              <span className="shrink-0 flex items-center gap-2 text-[11px]">
                <span className={`font-mono ${p.stock <= 0 ? 'text-rose-600' : 'text-slate-500'}`}>رصيد {p.stock}</span>
                <span className="font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5">{priceLabel}: {formatMoney(priceOf(p))}</span>
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

/** خلية «هدية» في جدول القائمة: كتابة عدد تعرض اقتراحات (قطعة / كرتون) تحتها */
const GiftHelperCell: React.FC<{
  existing: number;
  canCarton: boolean;
  cartonLabel: string;
  onPick: (qty: number, unit: 'piece' | 'carton') => void;
}> = ({ existing, canCarton, cartonLabel, onPick }) => {
  const [v, setV] = useState('');
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const n = parseFloat(v);
  const ok = Number.isFinite(n) && n > 0;
  const place = () => { const r = ref.current?.getBoundingClientRect(); if (r) setRect({ left: r.left, top: r.bottom + 2, width: Math.max(r.width, 130) }); };
  const pick = (u: 'piece' | 'carton') => { if (ok) onPick(n, u); setV(''); setOpen(false); };
  return (
    <>
      <input
        ref={ref}
        data-testid="gift-helper-input"
        inputMode="decimal"
        value={v}
        placeholder={existing > 0 ? String(existing) : ''}
        onChange={(e) => { setV(e.target.value.replace(/[^\d.]/g, '')); setOpen(true); place(); }}
        onFocus={() => { place(); if (v) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && ok) { e.preventDefault(); e.stopPropagation(); pick('piece'); }
          else if (e.key === 'Escape') { setV(''); setOpen(false); }
        }}
        className="w-full bg-transparent border-0 text-center font-mono text-pink-700 placeholder:text-pink-700 placeholder:font-bold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-pink-400 px-0.5 py-1"
      />
      {open && ok && rect && createPortal(
        <div className="fixed z-[200] bg-white border border-pink-300 rounded-lg shadow-2xl overflow-hidden" style={{ left: rect.left, top: rect.top, width: rect.width }} dir="rtl" data-testid="gift-suggestions">
          <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); pick('piece'); }} className="w-full px-2.5 py-1.5 text-right text-[12px] font-bold hover:bg-pink-100 border-b border-slate-100 cursor-pointer">🎁 {n} قطعة</button>
          {canCarton && <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); pick('carton'); }} className="w-full px-2.5 py-1.5 text-right text-[12px] font-bold hover:bg-pink-100 cursor-pointer">🎁 {n} {cartonLabel}</button>}
        </div>,
        document.body
      )}
    </>
  );
};

/** خلية إدخال رقمية لجدول القائمة الكلاسيكي */
const ClassicCell: React.FC<{
  value: number;
  cellId: string;
  onCommit: (n: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  step?: string;
  readOnly?: boolean;
  invalid?: boolean;
}> = ({ value, cellId, onCommit, onKeyDown, step = '1', readOnly, invalid }) => {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <input
      data-cell={cellId}
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      readOnly={readOnly}
      value={txt !== null ? txt : (value ? String(value) : '')}
      placeholder="0"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setTxt(e.target.value);
        const n = parseFloat(e.target.value);
        onCommit(isFinite(n) && n >= 0 ? n : 0);
      }}
      onBlur={() => setTxt(null)}
      onKeyDown={onKeyDown}
      className={`w-full min-w-[40px] text-center font-mono font-bold bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 focus:bg-emerald-50 py-0.5 ${invalid ? 'bg-rose-50 text-rose-700' : ''}`}
    />
  );
};

export const POSView: React.FC<POSViewProps> = ({ onInvoiceCreated, onOpenNewProduct, onEditProduct, onOpenSettings }) => {
  const { 
    products, 
    customers, 
    createInvoice, 
    updateSettings, 
    formatMoney, 
    settings, 
    addCustomer, 
    updateProduct,
    sessionRole,
    hasPermission,
    activeShift,
    setIsStartShiftModalOpen,
    draftOrders,
    activeDraftId,
    activeDraft,
    updateActiveDraft,
    addNewDraft,
    switchToDraft,
    clearCurrentDraft,
    deleteCurrentDraft,
    completeActiveDraft,
    priceTypeOn,
    invoices
  } = useApp();

  // فحص صلاحية إظهار سعر الشراء والتكلفة
  const canViewCost = hasPermission('canViewCostPrice');

  // Active Draft Properties
  const cartItems = activeDraft.cartItems || [];
  const saleType = activeDraft.saleType || 'direct';
  const rawGlobalPriceType = activeDraft.globalPriceType || 'retail';
  const globalPriceType: PriceType = priceTypeOn(rawGlobalPriceType) ? rawGlobalPriceType : 'retail';
  const tieredMode = !!settings.enableWholesale && (priceTypeOn('wholesale') || priceTypeOn('special'));
  const selectedCustomerId = activeDraft.selectedCustomerId || '';
  const customCustomerName = activeDraft.customCustomerName || '';
  const customerPhone = activeDraft.customerPhone || '';
  const discountRaw = Math.max(0, Number(activeDraft.discount) || 0);
  const discountMode: 'amount' | 'percent' = activeDraft.discountMode === 'percent' ? 'percent' : 'amount';
  const paidAmount = activeDraft.paidAmount || 0;
  const dueDate = activeDraft.dueDate || '';
  const notes = activeDraft.notes || '';
  const selectedSalesRepId = activeDraft.selectedSalesRepId || '';
  const showRepOnInvoice = activeDraft.showRepOnInvoice !== undefined
    ? activeDraft.showRepOnInvoice
    : (settings.defaultShowRepOnInvoice ?? true);

  const setCartItems = (action: InvoiceItem[] | ((prev: InvoiceItem[]) => InvoiceItem[])) => {
    let next: InvoiceItem[];
    if (typeof action === 'function') {
      next = action(activeDraft.cartItems || []);
    } else {
      next = action;
    }
    updateActiveDraft({ cartItems: next });
  };

  const setSaleType = (val: SaleType) => updateActiveDraft({ saleType: val });
  const setGlobalPriceType = (val: PriceType) => updateActiveDraft({ globalPriceType: val });
  const setSelectedCustomerId = (val: string) => updateActiveDraft({ selectedCustomerId: val });
  const setCustomCustomerName = (val: string) => updateActiveDraft({ customCustomerName: val });
  const setCustomerPhone = (val: string) => updateActiveDraft({ customerPhone: val });
  const setPaidAmount = (val: number) => updateActiveDraft({ paidAmount: val });
  const setDiscountRaw = (val: number) => updateActiveDraft({ discount: Math.max(0, val) });
  const setDiscountMode = (m: 'amount' | 'percent') => updateActiveDraft({ discountMode: m, discount: 0 });
  const setDueDate = (val: string) => updateActiveDraft({ dueDate: val });
  const setNotes = (val: string) => updateActiveDraft({ notes: val });
  const specialNoteOn = activeDraft.specialNoteOn === true;
  const specialNote = activeDraft.specialNote || '';

  const setSelectedSalesRepId = (val: string) => {
    const rep = (settings.salesReps || []).find(r => r.id === val);
    updateActiveDraft({ 
      selectedSalesRepId: val,
      showRepOnInvoice: rep?.showOnInvoice !== undefined ? rep.showOnInvoice : (settings.defaultShowRepOnInvoice ?? true)
    });
  };
  const setShowRepOnInvoice = (val: boolean) => updateActiveDraft({ showRepOnInvoice: val });

  const [isSelectRepModalOpen, setIsSelectRepModalOpen] = useState(false);
  const [pendingPrintAfterRepSelect, setPendingPrintAfterRepSelect] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  // وضع Enter ولوحة الإدخال (كرتون / قطعة / عدد)
  type EntryStep = 'unit' | 'cartons' | 'pieces' | 'qty';
  type EntryState = { product: Product; step: EntryStep; unit: 'piece' | 'dozen' | 'carton'; cartons: string; pieces: string; qty: string };
  const [entry, setEntry] = useState<EntryState | null>(null);
  const entryRef = useRef<EntryState | null>(null);
  entryRef.current = entry;
  const [kbZone, setKbZone] = useState<'search' | 'list'>('search');
  const [kbIndex, setKbIndex] = useState(0);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  // «بيع آجل» السريع: اختيار زبون من قائمة ثم حفظ القائمة آجلاً مباشرة
  const [creditPickOpen, setCreditPickOpen] = useState(false);
  const [creditSearch, setCreditSearch] = useState('');
  const [pendingCreditId, setPendingCreditId] = useState<string | null>(null);
  const [pendingCash, setPendingCash] = useState(false);
  const [debtorsView, setDebtorsViewState] = useState<'cards' | 'list' | 'strip'>(() => {
    try { const v = localStorage.getItem('mufakir_debtors_view'); return v === 'cards' || v === 'strip' ? v : 'list'; } catch { return 'list'; }
  });
  const setDebtorsView = (v: 'cards' | 'list' | 'strip') => {
    setDebtorsViewState(v);
    try { localStorage.setItem('mufakir_debtors_view', v); } catch {}
  };
  const [scanChoice, setScanChoice] = useState<{ code: string; items: Product[] } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // تغيير عرض الجهات بالسحب (سطح المكتب)
  const splitWrapRef = useRef<HTMLDivElement>(null);
  // حجم جداول القائمة (خط الجدول وعرض الورقة): يُحفظ على الجهاز
  const [tblScale, setTblScaleRaw] = useState<number>(() => { try { const v = parseFloat(localStorage.getItem('pos_tbl_scale') || ''); return v >= 0.7 && v <= 2 ? v : 1; } catch { return 1; } });
  const [paperW, setPaperWRaw] = useState<number>(() => { try { const v = parseInt(localStorage.getItem('pos_paper_w') || '', 10); return v >= 700 && v <= 1800 ? v : 1180; } catch { return 1180; } });
  // عمود التكلفة في وضع القائمة: للعرض في واجهة البيع فقط ولا يُطبع في الوصل
  const [showCostCol, setShowCostColRaw] = useState<boolean>(() => { try { return localStorage.getItem('pos_list_cost') === '1'; } catch { return false; } });
  const setShowCostCol = (v: boolean) => { setShowCostColRaw(v); try { localStorage.setItem('pos_list_cost', v ? '1' : '0'); } catch {} };
  const setTblScale = (v: number) => { const n = Math.max(0.7, Math.min(2, Math.round(v * 20) / 20)); setTblScaleRaw(n); try { localStorage.setItem('pos_tbl_scale', String(n)); } catch {} };
  const setPaperW = (v: number) => { const n = Math.max(700, Math.min(1800, Math.round(v / 20) * 20)); setPaperWRaw(n); try { localStorage.setItem('pos_paper_w', String(n)); } catch {} };
  const [cartWidth, setCartWidth] = useState<number | null>(() => {
    try { const v = parseInt(localStorage.getItem('pos_cart_width') || '', 10); return v > 0 ? v : null; } catch { return null; }
  });
  const [isLgScreen, setIsLgScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => {
    const on = () => setIsLgScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const startSplitDrag = (ev: React.PointerEvent) => {
    ev.preventDefault();
    const wrap = splitWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const move = (e: PointerEvent) => {
      const w = Math.round(e.clientX - rect.left - 6);
      setCartWidth(Math.max(300, Math.min(w, rect.width - 360)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setCartWidth((cur) => {
        try { if (cur) localStorage.setItem('pos_cart_width', String(cur)); } catch {}
        return cur;
      });
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const entryCartonRef = useRef<HTMLInputElement>(null);
  const entryPieceRef = useRef<HTMLInputElement>(null);
  const entryQtyRef = useRef<HTMLInputElement>(null);
  const entryUnitRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showChangeCalc, setShowChangeCalc] = useState(false);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'strips'>(() => {
    try {
      const saved = localStorage.getItem('pos_products_view_mode');
      if (saved === 'list' || saved === 'grid' || saved === 'strips') return saved;
    } catch (e) {}
    return 'grid';
  });

  const handleViewModeChange = (mode: 'grid' | 'list' | 'strips') => {
    setViewMode(mode);
    try {
      localStorage.setItem('pos_products_view_mode', mode);
    } catch (e) {}
  };
  
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [quickCustomerAddress, setQuickCustomerAddress] = useState('');
  const [quickCustomerInitialDebt, setQuickCustomerInitialDebt] = useState<number | ''>('');
  const [quickCustomerError, setQuickCustomerError] = useState('');

  const [productForPriceEdit, setProductForPriceEdit] = useState<Product | null>(null);
  const [editRetailPrice, setEditRetailPrice] = useState<number | ''>('');
  const [editWholesalePrice, setEditWholesalePrice] = useState<number | ''>('');
  const [editSuperWholesalePrice, setEditSuperWholesalePrice] = useState<number | ''>('');
  const [editSpecialPrice, setEditSpecialPrice] = useState<number | ''>('');
  const [editCostPrice, setEditCostPrice] = useState<number | ''>('');
  const [editPiecesPerCarton, setEditPiecesPerCarton] = useState<number | ''>('');

  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [tempItemPrice, setTempItemPrice] = useState<string>('');

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [cartErrorNotice, setCartErrorNotice] = useState<string | null>(null);
  const [unfoundBarcodePrompt, setUnfoundBarcodePrompt] = useState<string | null>(null);
  // الوضع المضمّن: قائمة الباركودات غير الموجودة (إنذار أحمر لكل واحد تحت الآخر) دون أي حجب للمسح
  const [unfoundList, setUnfoundList] = useState<string[]>([]);
  // آخر مسح باركود (لمنع Enter القادم من الماسح من أن يُحفظ القائمة)
  const lastScanRef = useRef(0);

  const handleOpenPriceEdit = (prod: Product) => {
    setProductForPriceEdit(prod);
    setEditRetailPrice(prod.retailPrice);
    setEditWholesalePrice(prod.wholesalePrice);
    setEditSuperWholesalePrice(prod.superWholesalePrice || '');
    setEditSpecialPrice(prod.specialPrice || '');
    setEditCostPrice(prod.costPrice);
    setEditPiecesPerCarton(prod.piecesPerCarton || 1);
  };

  const handleSavePriceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForPriceEdit) return;

    const newRetail = typeof editRetailPrice === 'number' ? editRetailPrice : productForPriceEdit.retailPrice;
    const newWholesale = typeof editWholesalePrice === 'number' ? editWholesalePrice : productForPriceEdit.wholesalePrice;
    const newSuper = typeof editSuperWholesalePrice === 'number' ? editSuperWholesalePrice : 0;
    const newSpecial = typeof editSpecialPrice === 'number' ? editSpecialPrice : 0;
    const newCost = typeof editCostPrice === 'number' ? editCostPrice : productForPriceEdit.costPrice;
    const newCarton = typeof editPiecesPerCarton === 'number' && editPiecesPerCarton > 0 ? editPiecesPerCarton : (productForPriceEdit.piecesPerCarton || 1);

    updateProduct(productForPriceEdit.id, {
      retailPrice: newRetail,
      wholesalePrice: newWholesale,
      superWholesalePrice: newSuper,
      specialPrice: newSpecial,
      costPrice: newCost,
      piecesPerCarton: newCarton,
    });

    setCartItems(prev => prev.map(item => {
      if (item.productId === productForPriceEdit.id && !item.isGift) {
        const basePiece = getPiecePrice(
          { retailPrice: newRetail, wholesalePrice: newWholesale, superWholesalePrice: newSuper, specialPrice: newSpecial },
          item.priceType
        );
        const isCarton = item.unitType === 'carton';
        const lineCap = item.packLabel ? Math.max(1, item.piecesPerCarton || 1) : newCarton;
        const effectiveUnit = isCarton ? basePiece * lineCap : basePiece;
        return {
          ...item,
          costPrice: newCost,
          piecesPerCarton: lineCap,
          unitPrice: effectiveUnit,
          deductedPieces: isCarton ? item.quantity * lineCap : item.quantity,
          total: item.quantity * effectiveUnit,
        };
      }
      return item;
    }));

    setScanNotice(`تم تحديث أسعار مادة "${productForPriceEdit.name}" بنجاح`);
    setTimeout(() => setScanNotice(null), 3000);
    setProductForPriceEdit(null);
  };

  const handleToggleEditCartItemPrice = (item: InvoiceItem) => {
    if (editingPriceProductId === lineKeyOf(item)) {
      setEditingPriceProductId(null);
      setTempItemPrice('');
    } else {
      setEditingPriceProductId(lineKeyOf(item));
      setTempItemPrice(String(item.unitPrice));
    }
  };

  const handleSaveCartItemPrice = (productId: string) => {
    const parsed = parseFloat(tempItemPrice);
    if (isNaN(parsed) || parsed < 0) {
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => {
        if (lineKeyOf(item) === productId) {
          return {
            ...item,
            unitPrice: parsed,
            total: item.quantity * parsed,
            isCustomPrice: true,
          };
        }
        return item;
      })
    );
    setEditingPriceProductId(null);
    setTempItemPrice('');
  };

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['all', ...Array.from(set)];
  }, [products]);

  // البدائل التي حددها صاحب المتجر عند غياب سعر المستوى (نفس إعدادات روابط الأسعار)
  const priceFallbacks = {
    wholesale: settings.checkerFallbackWholesale,
    super: settings.checkerFallbackSuper,
    special: settings.checkerFallbackSpecial,
  };
  const getPiecePrice = (p: Parameters<typeof getPiecePriceBase>[0], t: PriceType): number => getPiecePriceBase(p, t, priceFallbacks);
  const resolveFor = (p: Parameters<typeof getPiecePriceBase>[0], t: PriceType): number | null => resolvePiecePrice(p, t, priceFallbacks);

  const filteredProducts = useMemo(() => {
    const seen = new Set<string>();
    return products.filter((prod) => {
      if (!prod || !prod.id) return false;
      if (seen.has(prod.id)) return false;
      seen.add(prod.id);
      const matchCat = selectedCategory === 'all' || prod.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        matchAr(prod.name, q) ||
        allCodes(prod).some((c) => c.toLowerCase().includes(q)) ||
        matchAr(prod.category, q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const [displayLimit, setDisplayLimit] = useState(48);

  useEffect(() => {
    setDisplayLimit(48);
  }, [searchQuery, selectedCategory]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, displayLimit);
  }, [filteredProducts, displayLimit]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // آخر سعر بيع لكل مادة/وحدة لنفس الزبون (يظهر كملاحظة فوق شريط البحث إن اختلف عن السعر الحالي)
  const lastPriceNotes = useMemo(() => {
    if (settings.showLastCustomerPrice !== true || !selectedCustomerId) return [] as { key: string; name: string; last: number; current: number; invNo?: string; invDate?: string }[];
    const keyOf = (it: any) => `${it.productId}|${it.unitType || 'piece'}|${it.piecesPerCarton || 1}`;
    const wanted = new Set((cartItems || []).filter((c: any) => !c.isGift).map(keyOf));
    if (wanted.size === 0) return [];
    const last = new Map<string, number>();
    const lastInv = new Map<string, { no?: string; date?: string }>();
    const mine = (invoices || [])
      .filter((inv: any) => inv.customerId === selectedCustomerId && inv.status !== 'returned')
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    for (const inv of mine) {
      for (const it of inv.items || []) {
        if (it.isGift) continue;
        const k = keyOf(it);
        if (wanted.has(k) && !last.has(k)) {
          last.set(k, Number(it.unitPrice) || 0);
          lastInv.set(k, { no: inv.invoiceNumber, date: inv.date });
        }
      }
      if (last.size === wanted.size) break;
    }
    const out: { key: string; name: string; last: number; current: number; invNo?: string; invDate?: string }[] = [];
    for (const c of [...(cartItems || [])].reverse() as any[]) {
      const k = keyOf(c);
      const l = last.get(k);
      if (l !== undefined && Math.abs(l - (Number(c.unitPrice) || 0)) > 0.0005 && !out.some((o) => o.key === k)) {
        out.push({ key: k, name: c.name || c.productName, last: l, current: Number(c.unitPrice) || 0, invNo: lastInv.get(k)?.no, invDate: lastInv.get(k)?.date });
      }
    }
    return out.slice(0, 4);
  }, [settings.showLastCustomerPrice, selectedCustomerId, cartItems, invoices]);

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    if (id) {
      const cust = customers.find((c) => c.id === id);
      if (cust) {
        setCustomCustomerName(cust.name);
        setCustomerPhone(cust.phone);
      }
    } else {
      setCustomCustomerName('');
      setCustomerPhone('');
    }
  };

  const handleOpenQuickAddCustomer = (presetName?: string) => {
    setQuickCustomerName(presetName ?? (customCustomerName.trim() || ''));
    setQuickCustomerPhone(customerPhone.trim() || '');
    setQuickCustomerAddress('');
    setQuickCustomerInitialDebt('');
    setQuickCustomerError('');
    setShowQuickAddModal(true);
  };

  const handleSaveQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = quickCustomerName.trim();
    if (!cleanName) {
      setQuickCustomerError('يرجى إدخال اسم الزبون');
      return;
    }

    const created = addCustomer({
      name: cleanName,
      phone: quickCustomerPhone.trim(),
      address: quickCustomerAddress.trim(),
      initialDebt: typeof quickCustomerInitialDebt === 'number' ? quickCustomerInitialDebt : 0,
    });

    setSelectedCustomerId(created.id);
    setCustomCustomerName(created.name);
    setCustomerPhone(created.phone);
    setShowQuickAddModal(false);
    setScanNotice(`تمت إضافة واعتماد الزبون "${created.name}" في النظام بنجاح`);
    setTimeout(() => setScanNotice(null), 4000);
  };

  // مفتاح السطر: سطر الهدية منفصل عن السطر العادي لنفس المادة
  const lineKeyOf = (item: { productId: string; isGift?: boolean }) =>
    item.isGift ? `${item.productId}__gift` : item.productId;
  const baseIdOf = (key: string) => key.replace(/__gift$/, '');

  // الكمية السريعة: آخر مادة أُضيفت بالنقر تنتظر ضغط رقم لتحديد كميتها
  const quickQtyArmedRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  });

  const [giftMenu, setGiftMenu] = useState<{ x: number; y: number; product: Product } | null>(null);
  // ترتيب عناصر الشريط العلوي (كليك يمين ← تغيير ← سحب). يُحفظ على هذا الجهاز فقط.
  const TB_DEFAULT = ['search', 'views', 'scan', 'new', 'return'];
  const [tbOrder, setTbOrder] = useState<string[]>(() => {
    try {
      const a = JSON.parse(localStorage.getItem('pos_topbar_order') || 'null');
      if (Array.isArray(a)) return [...a.filter((x: string) => TB_DEFAULT.includes(x)), ...TB_DEFAULT.filter((x) => !a.includes(x))];
    } catch {}
    return TB_DEFAULT;
  });
  const [tbEdit, setTbEdit] = useState(false);
  const [tbMenu, setTbMenu] = useState<{ x: number; y: number } | null>(null);
  const tbDragRef = useRef<string | null>(null);
  const saveTbOrder = (a: string[]) => { setTbOrder(a); try { localStorage.setItem('pos_topbar_order', JSON.stringify(a)); } catch {} };
  const tbProps = (id: string) => ({
    style: { order: tbOrder.indexOf(id), ...(tbEdit ? { outline: '2px dashed #f59e0b', outlineOffset: 2, cursor: 'grab' } : {}) } as React.CSSProperties,
    draggable: tbEdit,
    'data-tb': id,
    onDragStart: (e: React.DragEvent) => { if (!tbEdit) return; tbDragRef.current = id; try { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } catch {} },
    onDragOver: (e: React.DragEvent) => { if (tbEdit) e.preventDefault(); },
    onDrop: (e: React.DragEvent) => {
      if (!tbEdit) return;
      e.preventDefault();
      const from = tbDragRef.current; tbDragRef.current = null;
      if (!from || from === id) return;
      const a = tbOrder.filter((x) => x !== from);
      a.splice(a.indexOf(id) + (tbOrder.indexOf(from) < tbOrder.indexOf(id) ? 1 : 0), 0, from);
      saveTbOrder(a);
    },
  });
  // كليك يمين على سطر في قائمة البيع: نفس خيارات القائمة اليمنى (تعديل المادة / تعديل السعر / هدية)
  const openCartItemMenu = (e: React.MouseEvent, item: any) => {
    const prod = products.find((p) => p.id === item.productId);
    if (!prod) return;
    e.preventDefault();
    setGiftMenu({ x: e.clientX, y: e.clientY, product: prod });
  };

  const addGiftToCart = (product: Product) => {
    const isWeighted = Boolean(product.isWeighted || product.unit === 'كغم' || product.unit === 'كيلو');
    setCartItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === product.id && it.isGift);
      if (idx > -1) {
        const t = prev[idx];
        const q = Math.round((t.quantity + 1) * 1000) / 1000;
        const updated: InvoiceItem = {
          ...t,
          quantity: q,
          deductedPieces: t.unitType === 'carton' ? q * (t.piecesPerCarton || 1) : q,
          total: 0,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      }
      const cap = isWeighted ? 1 : (product.piecesPerCarton || 1);
      const gift: InvoiceItem = {
        productId: product.id,
        productName: product.name,
        code: product.code,
        unit: isWeighted ? 'كغم' : product.unit,
        priceType: 'retail',
        unitType: 'piece',
        piecesPerCarton: cap,
        deductedPieces: 1,
        costPrice: product.costPrice,
        unitPrice: 0,
        quantity: 1,
        isWeighted,
        weightGrams: isWeighted ? 1000 : undefined,
        total: 0,
        isGift: true,
        notes: 'هدية',
      } as InvoiceItem;
      return [gift, ...prev];
    });
    setScanNotice(`تمت إضافة "${product.name}" كهدية (سعر 0)`);
    setTimeout(() => setScanNotice(null), 2500);
  };

  /** مساعد الهدية: إضافة هدية بعدد ووحدة محددة (قطعة/كرتون) كسطر يدوي — لا يتداخل مع هدايا العروض */
  const addGiftQty = (product: Product, qty: number, unit: 'piece' | 'carton') => {
    const isWeighted = Boolean(product.isWeighted || product.unit === 'كغم' || product.unit === 'كيلو');
    const cap = isWeighted ? 1 : Math.max(1, product.piecesPerCarton || 1);
    const u: 'piece' | 'carton' = unit === 'carton' && cap > 1 ? 'carton' : 'piece';
    setCartItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === product.id && it.isGift);
      const base = idx > -1 ? prev[idx] : null;
      const sameUnit = base && (base.unitType || 'piece') === u;
      const q = Math.round(((sameUnit ? base!.quantity : 0) + qty) * 1000) / 1000;
      const gift: InvoiceItem = {
        ...(base || {}),
        productId: product.id, productName: product.name, code: product.code,
        unit: isWeighted ? 'كغم' : product.unit, priceType: 'retail', unitType: u,
        packLabel: u === 'carton' ? (product.packLabel || 'كرتون') : undefined,
        piecesPerCarton: cap, deductedPieces: u === 'carton' ? q * cap : q,
        costPrice: product.costPrice, unitPrice: 0, quantity: q, isWeighted, total: 0, isGift: true, notes: 'هدية',
      } as any;
      return [gift, ...prev.filter((_, i) => i !== idx)];
    });
    setScanNotice(`🎁 هدية: ${qty} ${u === 'carton' ? 'كرتون' : 'قطعة'} من "${product.name}"`);
    setTimeout(() => setScanNotice(null), 2500);
  };

  const addToCartWithPrice = (product: Product, priceType: PriceType, delta = 1) => {
    if (resolveFor(product, priceType) === null) {
      setScanNotice(`لا يوجد سعر ${PRICE_TYPE_LABELS[priceType]} للمادة "${product.name}"`);
      setTimeout(() => setScanNotice(null), 3000);
      return;
    }
    quickQtyArmedRef.current = !product.isWeighted ? product.id : null;
    const isWeighted = Boolean(product.isWeighted || product.unit === 'كغم' || product.unit === 'كيلو');
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id && !item.isGift);
      const piecePrice = getPiecePrice(product, priceType);

      if (existingIndex > -1) {
        const target = prev[existingIndex];
        const newQty = Math.round((target.quantity + delta) * 1000) / 1000;
        const cartonCap = isWeighted ? 1 : (target.piecesPerCarton || product.piecesPerCarton || 1);
        const deductedPieces = (!isWeighted && target.unitType === 'carton') ? newQty * cartonCap : newQty;
        const updatedItem: InvoiceItem = {
          ...target,
          quantity: newQty,
          isWeighted,
          weightGrams: isWeighted ? Math.round(newQty * 1000) : undefined,
          deductedPieces,
          total: Math.round(newQty * target.unitPrice),
        };

        const otherItems = prev.filter((_, idx) => idx !== existingIndex);
        return [updatedItem, ...otherItems];
      } else {
        const cartonCap = isWeighted ? 1 : (product.piecesPerCarton || 1);
        const newItem: InvoiceItem = {
          productId: product.id,
          productName: product.name,
          code: product.code,
          unit: isWeighted ? 'كغم' : product.unit,
          priceType: priceType,
          unitType: 'piece',
          piecesPerCarton: cartonCap,
          deductedPieces: delta,
          costPrice: product.costPrice,
          unitPrice: piecePrice,
          quantity: delta,
          isWeighted,
          weightGrams: isWeighted ? Math.round(delta * 1000) : undefined,
          total: Math.round(delta * piecePrice),
        };
        return [newItem, ...prev];
      }
    });
  };

  const addToCart = (product: Product, delta = 1) => {
    addToCartWithPrice(product, globalPriceType, delta);
  };

  // إضافة مادة بوحدتها الافتراضية (قطعة/درزن/كرتون) عند الضغط عليها أو مسح باركودها؛ يرجع اسم الوحدة إن لم تكن قطعة
  const addWithDefaultUnit = (prod: Product, via: 'scan' | 'click' = 'scan'): string | null => {
    // المسح يستعمل وحدة المسح؛ الضغط يستعمل وحدة الضغط (وإن لم تُحدد تتبع وحدة المسح كما كان سابقاً)
    const su = via === 'click' ? (prod.clickUnit || prod.scanUnit) : prod.scanUnit;
    const weighted = Boolean(prod.isWeighted || prod.unit === 'كغم' || prod.unit === 'كيلو');
    if (weighted) {
      // مادة وزنية: الكمية الافتراضية بالغرام للضغط/للمسح (الافتراضي كيلو)
      const g = (via === 'click' ? prod.clickWeightGrams : prod.scanWeightGrams) || 1000;
      addToCartWithPrice(prod, globalPriceType, g / 1000);
      return g === 1000 ? 'كيلو' : g === 500 ? 'نصف كيلو' : `${g} غرام`;
    }
    const dz = !weighted && (prod.piecesPerDozen || 0) > 1;
    const ok = !weighted && ((su === 'dozen' && dz) || (su === 'carton' && (prod.piecesPerCarton || 1) > 1));
    const asPieces = via === 'click' ? (prod.clickAsPieces ?? false) : (prod.scanAsPieces ?? false);
    if (ok && su && asPieces && resolveFor(prod, globalPriceType) !== null) {
      // كعدد قطع: كرتون = N قطعة تُضاف قطعاً منفردة لا كرتوناً واحداً
      const n = su === 'dozen' ? Math.floor(prod.piecesPerDozen || 1) : Math.floor(prod.piecesPerCarton || 1);
      addToCartWithPrice(prod, globalPriceType, n);
      return `${su === 'dozen' ? dozenName(prod) : 'كرتون'} = ${n} قطعة`;
    }
    if (ok && su && resolveFor(prod, globalPriceType) !== null) {
      quickQtyArmedRef.current = null;
      addEntryLine(prod, su, 1);
      return su === 'dozen' ? dozenName(prod) : 'كرتون';
    }
    addToCartWithPrice(prod, globalPriceType, 1);
    return null;
  };

  // هل الباركودان متشابهان (قُرئ الأول خطأً ثم قُرئ الثاني صحيحاً)؟
  const codesSimilar = (a: string, b: string) => {
    const x = a.toLowerCase();
    const y = b.toLowerCase();
    if (x === y) return true;
    if (Math.min(x.length, y.length) < 6) return false;
    if (x.includes(y) || y.includes(x)) return true;
    if (Math.abs(x.length - y.length) > 2) return false;
    // مسافة تحرير مبسطة (حتى حرفين)
    const m = x.length, n = y.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n] <= 2;
  };

  const handleBarcodeScanned = (scannedCode: string) => {
    const clean = scannedCode.trim();
    if (!clean) return;
    lastScanRef.current = Date.now();

    const matches = productsByCode(products as Product[], clean);
    if (matches.length > 1) {
      // نفس الباركود لأكثر من مادة: يُطلب اختيار المادة المقصودة
      playScannerBeep('success');
      setSearchQuery('');
      setUnfoundBarcodePrompt(null);
      setScanChoice({ code: clean, items: matches });
      return;
    }
    const matched = matches[0];

    if (matched) {
      playScannerBeep('success');
      const usedUnit = addWithDefaultUnit(matched, 'scan');
      quickQtyArmedRef.current = null;
      setSearchQuery('');
      setUnfoundBarcodePrompt(null);
      // إنذار باركود قُرئ خطأً سابقاً يزول عند مسح مادته بشكل صحيح
      setUnfoundList((prev) => (prev.length ? prev.filter((c) => !codesSimilar(c, clean) && !codesSimilar(c, matched.code)) : prev));
      setScanNotice(`تم مسح الباركود #${clean}: زيادة كمية "${matched.name}" في القائمة (+1${usedUnit ? ' ' + usedUnit : ''})`);
      setTimeout(() => setScanNotice(null), 3000);
    } else {
      setSearchQuery('');
      if (settings.unfoundBarcodeInline === true) {
        // إنذار مضمّن: لا نافذة تحجب المسح، ويتراكم إنذار لكل باركود غير موجود
        playScannerBeep('unfound');
        setScanNotice(null);
        setUnfoundList((prev) => (prev.includes(clean) ? prev : [...prev, clean].slice(-8)));
      } else {
        setUnfoundBarcodePrompt(clean);
        playScannerBeep('alert');
        setScanNotice(`الرمز الشريطي #${clean} غير مسجل في المخزن`);
        setTimeout(() => setScanNotice(null), 5000);
      }
    }
  };

  // مادة أُضيفت للمخزن لاحقاً بنفس الباركود: يزول إنذارها
  useEffect(() => {
    setUnfoundList((prev) => {
      if (!prev.length) return prev;
      const next = prev.filter((c) => productsByCode(products as Product[], c).length === 0);
      return next.length === prev.length ? prev : next;
    });
  }, [products]);


  // ===== وضع Enter + الفصل بين الكرتون والقطعة =====
  const kbMode = settings.posKeyboardMode === true;
  const sepMode = settings.separateCartonPieces === true;
  const cartonKey = (settings.cartonHotkey || 'c').toLowerCase();
  // وضع القائمة (ثالث الأوضاع) يُطفئ الكلاسيكي والعكس
  const listMode = settings.posListMode === true && settings.deviceMode !== 'mobile';
  const classicMode = settings.posClassicCart === true && !listMode && settings.deviceMode !== 'mobile';
  const [discTyping, setDiscTyping] = useState(false);
  const helperOn = settings.posDiscountGiftHelper === true && (listMode || classicMode);

  const isWeightedProd = (p: Product) => Boolean(p.isWeighted || p.unit === 'كغم' || p.unit === 'كيلو');
  const entryNum = (v: string) => {
    const n = parseFloat((v || '').replace(',', '.'));
    return isFinite(n) && n > 0 ? n : 0;
  };

  const openEntry = (product: Product, fromKeyboard: boolean) => {
    const weighted = isWeightedProd(product);
    const hasCarton = !weighted && ((product.piecesPerCarton || 1) > 1 || dozenOf(product) > 1);
    let step: EntryStep = 'qty';
    if (!weighted) {
      if (sepMode) step = fromKeyboard && hasCarton ? 'cartons' : 'pieces';
      else if (hasCarton) step = 'unit';
    }
    quickQtyArmedRef.current = null;
    setEntry({ product, step, unit: 'piece', cartons: '', pieces: '', qty: '1' });
  };

  // مادة نُقر عليها بالماوس: إن كان الفصل مفعلاً تُفتح لوحة الإدخال، وإلا تُضاف كما كان سابقاً
  const handleProductClick = (prod: Product) => {
    if (classicMode) classicAddAndFocus(prod, false);
    else if (sepMode) openEntry(prod, false);
    else addWithDefaultUnit(prod, 'click');
  };

  // إضافة سطر للقائمة بوحدة محددة، مع دمج السطر الموجود لنفس المادة
  const dozenOf = (p: Product) => (!isWeightedProd(p) && (p.piecesPerDozen || 0) > 1 ? Math.floor(p.piecesPerDozen!) : 0);
  const addEntryLine = (product: Product, unitType: 'piece' | 'dozen' | 'carton', q: number) => {
    const weighted = isWeightedProd(product);
    const cap = weighted ? 1 : Math.max(1, product.piecesPerCarton || 1);
    const dz = dozenOf(product);
    const useDz = unitType === 'dozen' && dz > 1;
    const reqIsPack = !weighted && (unitType === 'carton' || useDz);
    const reqCap = useDz ? dz : cap;
    const piecePrice = getPiecePrice(product, globalPriceType);
    setCartItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === product.id && !it.isGift);
      if (idx > -1) {
        const t = prev[idx];
        const tPack = !weighted && t.unitType === 'carton';
        const tCap = Math.max(1, t.piecesPerCarton || cap);
        const sameKind = tPack && reqIsPack && ((!!t.packLabel) === useDz);
        let base: InvoiceItem = t;
        let isPackLine = tPack;
        if (tPack && !sameKind) {
          base = { ...t, unitType: 'piece', packLabel: undefined, piecesPerCarton: cap, quantity: t.quantity * tCap, unitPrice: t.unitPrice / tCap, costPrice: t.costPrice / tCap };
          isPackLine = false;
        }
        const addQ = (!isPackLine && reqIsPack) ? q * reqCap : q;
        const newQty = Math.round((base.quantity + addQ) * 1000) / 1000;
        const updated: InvoiceItem = {
          ...base,
          quantity: newQty,
          isWeighted: weighted,
          weightGrams: weighted ? Math.round(newQty * 1000) : undefined,
          deductedPieces: isPackLine ? newQty * tCap : newQty,
          total: Math.round(newQty * base.unitPrice),
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      }
      const unitPrice = reqIsPack ? piecePrice * reqCap : piecePrice;
      const newItem: InvoiceItem = {
        productId: product.id,
        productName: product.name,
        code: product.code,
        unit: weighted ? 'كغم' : product.unit,
        priceType: globalPriceType,
        unitType: reqIsPack ? 'carton' : 'piece',
        packLabel: useDz ? dozenName(product) : undefined,
        piecesPerCarton: reqIsPack ? reqCap : cap,
        deductedPieces: reqIsPack ? q * reqCap : q,
        costPrice: reqIsPack ? product.costPrice * reqCap : product.costPrice,
        unitPrice,
        quantity: q,
        isWeighted: weighted,
        weightGrams: weighted ? Math.round(q * 1000) : undefined,
        total: Math.round(q * unitPrice),
      };
      return [newItem, ...prev];
    });
  };

  const focusSearchBox = () => {
    setKbZone('search');
    setTimeout(() => {
      const el = searchInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }, 0);
  };

  const closeEntry = (committed: boolean) => {
    setEntry(null);
    if (kbMode) {
      if (committed) focusSearchBox();
      else setKbZone('list');
    }
  };

  const commitEntry = () => {
    const e = entryRef.current;
    if (!e) return;
    const p = e.product;
    const weighted = isWeightedProd(p);
    const cap = Math.max(1, p.piecesPerCarton || 1);
    const hasCarton = !weighted && cap > 1;
    let note = '';
    if (weighted) {
      const kg = Math.round((entryNum(e.qty) || 1) * 1000) / 1000;
      addEntryLine(p, 'piece', kg);
      note = `${kg} كغم`;
    } else if (sepMode) {
      const c = hasCarton ? Math.floor(entryNum(e.cartons)) : 0;
      let pc = Math.floor(entryNum(e.pieces));
      if (c === 0 && pc === 0) pc = 1;
      if (pc === 0) {
        addEntryLine(p, 'carton', c);
        note = `${c} كرتون`;
      } else {
        addEntryLine(p, 'piece', c * cap + pc);
        note = c > 0 ? `${c} كرتون + ${pc} قطعة` : `${pc} قطعة`;
      }
    } else {
      const q = Math.max(1, Math.floor(entryNum(e.qty) || 1));
      const uu = hasCarton ? e.unit : 'piece';
      addEntryLine(p, uu, q);
      note = `${q} ${uu === 'carton' ? 'كرتون' : uu === 'dozen' ? dozenName(p) : 'قطعة'}`;
    }
    quickQtyArmedRef.current = null;
    setScanNotice(`تمت إضافة "${p.name}": ${note}`);
    setTimeout(() => setScanNotice(null), 2500);
    closeEntry(true);
  };

  const advanceEntry = () => {
    const e = entryRef.current;
    if (!e) return;
    if (e.step === 'unit') setEntry({ ...e, step: 'qty' });
    else if (e.step === 'cartons') setEntry({ ...e, step: 'pieces' });
    else commitEntry();
  };

  const onEntryKeyDown = (ev: React.KeyboardEvent) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') return;
    ev.stopPropagation();
    const e = entryRef.current;
    if (!e) return;
    if (ev.key === 'Enter') {
      ev.preventDefault();
      advanceEntry();
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      closeEntry(false);
      return;
    }
    if (e.step === 'unit' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(ev.key)) {
      ev.preventDefault();
      { const opts: Array<'piece'|'dozen'|'carton'> = dozenOf(e.product) > 1 ? (((e.product.piecesPerCarton || 1) > 1) ? ['piece','dozen','carton'] : ['piece','dozen']) : ['piece','carton']; const i = opts.indexOf(e.unit); setEntry({ ...e, unit: opts[(i + 1) % opts.length] }); }
      return;
    }
    if (sepMode && !ev.ctrlKey && !ev.altKey && !ev.metaKey && (e.step === 'cartons' || e.step === 'pieces') && !/\d/.test(cartonKey)) {
      const isHot = ev.key.toLowerCase() === cartonKey || (/^[a-z]$/.test(cartonKey) && ev.code === `Key${cartonKey.toUpperCase()}`);
      if (isHot && (p_hasCarton(e.product))) {
        ev.preventDefault();
        setEntry({ ...e, step: e.step === 'cartons' ? 'pieces' : 'cartons' });
      }
    }
  };
  const p_hasCarton = (p: Product) => !isWeightedProd(p) && (p.piecesPerCarton || 1) > 1;

  // التركيز على الحقل المناسب عند تغيّر خطوة الإدخال
  useEffect(() => {
    if (!entry) return;
    const el: HTMLElement | null =
      entry.step === 'cartons' ? entryCartonRef.current
      : entry.step === 'pieces' ? entryPieceRef.current
      : entry.step === 'qty' ? entryQtyRef.current
      : entryUnitRef.current;
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) el.select();
    }
  }, [entry?.step, entry?.product.id]);

  // التنقل بالأسهم في قائمة المواد (وضع Enter)
  useEffect(() => {
    if (!kbMode || kbZone !== 'list' || entry) return;
    const onKey = (ev: KeyboardEvent) => {
      if (isOverlayOpen()) return;
      if (scanChoice || showQuickAddModal || isScannerOpen || unfoundBarcodePrompt || productForPriceEdit || isSelectRepModalOpen || showClearConfirmModal || showChangeCalc || giftMenu) return;
      const t = ev.target as HTMLElement;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName) || t.isContentEditable)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const n = visibleProducts.length;
      const vertical = (dir: 'up' | 'down') => {
        const els = Array.from(document.querySelectorAll<HTMLElement>('[data-kb-index]'));
        const cur = els.find((el) => Number(el.dataset.kbIndex) === kbIndex);
        if (!cur) return kbIndex;
        const cr = cur.getBoundingClientRect();
        const cx = cr.left + cr.width / 2;
        let best: HTMLElement | null = null;
        let bestScore = Infinity;
        for (const el of els) {
          const r = el.getBoundingClientRect();
          const dy = dir === 'down' ? r.top - cr.top : cr.top - r.top;
          if (dy <= 4) continue;
          const score = dy * 1000 + Math.abs(r.left + r.width / 2 - cx);
          if (score < bestScore) { bestScore = score; best = el; }
        }
        return best ? Number((best as HTMLElement).dataset.kbIndex) : kbIndex;
      };
      const go = (next: number) => {
        ev.preventDefault();
        if (next >= n && filteredProducts.length > displayLimit) setDisplayLimit((d) => d + 48);
        setKbIndex(Math.max(0, Math.min(Math.max(0, n - 1), next)));
      };
      switch (ev.key) {
        case 'ArrowLeft': go(kbIndex + 1); return;
        case 'ArrowRight': go(kbIndex - 1); return;
        case 'ArrowDown': go(vertical('down')); return;
        case 'ArrowUp': go(vertical('up')); return;
        case 'Enter': {
          ev.preventDefault();
          ev.stopPropagation();
          const prod = visibleProducts[kbIndex];
          if (prod) { if (classicMode) classicAddAndFocus(prod, true); else openEntry(prod, true); }
          return;
        }
        case 'Escape':
        case 'Backspace':
          ev.preventDefault();
          focusSearchBox();
          return;
        default:
          if (ev.key.length === 1) focusSearchBox(); // الحرف المكتوب يستبدل نص البحث
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  useEffect(() => {
    if (!kbMode || kbZone !== 'list') return;
    const el = document.querySelector<HTMLElement>(`[data-kb-index="${kbIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [kbMode, kbZone, kbIndex]);

  useEffect(() => {
    setKbIndex(0);
  }, [searchQuery, selectedCategory]);

  const handleBarcodeScannedRef = useRef(handleBarcodeScanned);
  useEffect(() => {
    handleBarcodeScannedRef.current = handleBarcodeScanned;
  });

  // تسجيل هذه النافذة كمستقبِل للباركود القادم من نوافذ أخرى
  useEffect(() => {
    registerPosScanHandler((code) => handleBarcodeScannedRef.current(code));
    return () => registerPosScanHandler(null);
  }, []);

  const handleSaveInvoiceRef = useRef<(andPrint: boolean) => void>(() => {});
  const quickCashSaleRef = useRef<() => void>(() => {});
  useEffect(() => {
    handleSaveInvoiceRef.current = handleSaveInvoice;
  });

  // بعد أن تُطبَّق حالة (آجل + الزبون المختار) على المسودة نحفظ القائمة مرة واحدة
  useEffect(() => {
    if (!pendingCreditId) return;
    if (saleType === 'credit' && selectedCustomerId === pendingCreditId) {
      setPendingCreditId(null);
      handleSaveInvoiceRef.current((settings as any).creditSaleAction === 'print');
    }
  }, [pendingCreditId, saleType, selectedCustomerId]);

  // زر «نقد»: يُحوَّل نوع البيع إلى نقد (إن كان آجلاً) ثم تُحفظ القائمة مرة واحدة
  useEffect(() => {
    if (!pendingCash) return;
    if (saleType === 'direct') {
      setPendingCash(false);
      handleSaveInvoiceRef.current((settings as any).cashSaleAction !== 'save');
    }
  }, [pendingCash, saleType]);

  // اختصارات وضع زرّي النقد/الآجل: Enter و Ctrl+Enter لكلٍّ إجراء يختاره المستخدم (الافتراضي: Enter=نقد، Ctrl+Enter=حفظ وطباعة)
  const runQuickKey = (which: 'enter' | 'ctrl') => {
    const st = settingsRef.current as any;
    const action: string = (which === 'enter' ? st.quickEnterAction : st.quickCtrlEnterAction) || (which === 'enter' ? 'cash' : 'print');
    if (action === 'none' || cartItemsRef.current.length === 0) return false;
    if (action === 'cash') quickCashSaleRef.current();
    else if (action === 'credit') { setCreditSearch(''); setCreditPickOpen(true); }
    else handleSaveInvoiceRef.current(action === 'print');
    return true;
  };
  const runQuickKeyRef = useRef(runQuickKey);
  runQuickKeyRef.current = runQuickKey;
  const quickKeyHint = (action: 'cash' | 'credit'): string => {
    const st = settings as any;
    const e = st.quickEnterAction || 'cash';
    const c = st.quickCtrlEnterAction || 'print';
    return [e === action ? 'Enter' : '', c === action ? 'Ctrl+Enter' : ''].filter(Boolean).join(' · ');
  };
  const quickCashSale = () => {
    if (saleType === 'direct') { handleSaveInvoiceRef.current((settings as any).cashSaleAction !== 'save'); return; }
    updateActiveDraft({ saleType: 'direct', selectedCustomerId: '', paidAmount: 0 });
    setPendingCash(true);
  };
  quickCashSaleRef.current = quickCashSale;

  const pickCreditCustomer = (id: string) => {
    setCreditPickOpen(false);
    updateActiveDraft({ saleType: 'credit', selectedCustomerId: id, paidAmount: 0 });
    setPendingCreditId(id);
  };

  // وضع زرّي النقد/الآجل: مبدّل نقدي/آجل مخفي، فنعيد القائمة إلى «نقدي» تلقائياً (الآجل يتم فقط عبر زر «دين آجل»)
  useEffect(() => {
    if (settings.quickCreditButton === true && saleType === 'credit' && !pendingCreditId && !creditPickOpen) {
      updateActiveDraft({ saleType: 'direct', paidAmount: 0 });
    }
  }, [settings.quickCreditButton, saleType, pendingCreditId, creditPickOpen]);

  const cartItemsRef = useRef(cartItems);
  useEffect(() => {
    cartItemsRef.current = cartItems;
  });

  useEffect(() => {
    let buffer = '';
    let humanish = false; // وُجدت فجوة بين الأحرف تدل على كتابة يدوية وليست ماسحاً
    let lastCharT = 0;
    let quickQtyBuf = '';
    let quickQtyTime = 0;
    let quickQtyFor = '';
    let quickQtyPrev: number | null = null;

    const currentQtyOf = (key: string) => {
      const it = cartItemsRef.current.find((i) => lineKeyOf(i) === key);
      return it ? it.quantity : null;
    };
    // التراجع عن أي كمية سريعة التقطها المستمع من أرقام باركود قادم من الماسح
    const restoreQuickQty = () => {
      if (quickQtyFor && quickQtyPrev !== null && quickQtyBuf !== '') {
        updateQuantityRef.current(quickQtyFor, quickQtyPrev);
      }
      quickQtyBuf = '';
      quickQtyPrev = null;
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // نافذة منبثقة مفتوحة (من أي مكان في البرنامج): لوحة المفاتيح لها وحدها
      if (isOverlayOpen()) { buffer = ''; return; }
      // إيقاف المعالجة إذا كانت هناك نوافذ تفاعلية منبثقة مفتوحة
      // (الإنذار الأحمر المضمّن ليس نافذة ولا يوقف المسح)
      if (
        showQuickAddModal || 
        isScannerOpen || 
        !!unfoundBarcodePrompt || 
        !!scanChoice ||
        !!productForPriceEdit || 
        isSelectRepModalOpen || 
        showClearConfirmModal ||
        showChangeCalc
      ) {
        return;
      }

      if (entryRef.current && !((e.ctrlKey || e.metaKey) && e.key === 'Enter')) return;

      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const inSearchBox = !!target && target === searchInputRef.current;
      const now = Date.now();

      // 1. اختصار Ctrl + Enter (أو Cmd + Enter): حفظ القائمة فقط دون طباعة
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        buffer = '';
        if (settingsRef.current.quickCreditButton === true) { runQuickKeyRef.current('ctrl'); return; }
        if (cartItemsRef.current.length > 0) {
          handleSaveInvoiceRef.current(!!settingsRef.current.invertEnterShortcuts);
        }
        return;
      }

      // 2. Enter: نهاية قراءة ماسح الباركود، أو حفظ وطباعة القائمة عند الضغط اليدوي
      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const sinceChar = now - lastCharT;
        const scannerBurst = buffer.length >= 2 && !humanish && sinceChar < 150;
        const code = buffer.trim();
        buffer = '';
        humanish = false;

        // حقل البحث يعالج Enter بنفسه؛ لا نقرأ الباركود مرتين ولا نبيع القائمة من هنا أبداً
        if (inSearchBox) return;

        // سلسلة أرقام سريعة ثم Enter = ماسح باركود
        if (scannerBurst && code.length >= 2) {
          e.preventDefault();
          restoreQuickQty();
          handleBarcodeScannedRef.current(code);
          return;
        }

        // Enter قادم مباشرة بعد مسح أو بعد أحرف سريعة (نهاية ماسح لم تكتمل قراءته): لا يُباع شيء
        if (now - lastScanRef.current < 800 || sinceChar < 120) {
          e.preventDefault();
          return;
        }

        // وضع Enter: لا حفظ ولا طباعة بالزر Enter (الحفظ بالماوس أو Ctrl+Enter)
        if (settingsRef.current.posKeyboardMode) return;

        // إذا كان المستخدم يكتب نصاً في حقل بحث أو إدخال (نترك الحقل لمعالجة نصه أولاً)
        if (isInput) {
          const inputEl = target as HTMLInputElement;
          if (inputEl.value && inputEl.value.trim().length > 0 && inputEl.type !== 'submit' && inputEl.type !== 'button') {
            return;
          }
        }

        // وضع زرّي النقد/الآجل: Enter ينفّذ الإجراء المختار (الافتراضي نقد)
        if (settingsRef.current.quickCreditButton === true) {
          if (runQuickKeyRef.current('enter')) { e.preventDefault(); e.stopPropagation(); }
          return;
        }
        // حفظ وطباعة القائمة الحالية عند الضغط اليدوي على Enter
        if (cartItemsRef.current.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          handleSaveInvoiceRef.current(!settingsRef.current.invertEnterShortcuts);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const gap = now - lastCharT;
        lastCharT = now;
        if (gap > 120) {
          buffer = '';
          humanish = false;
        }
        if (buffer.length > 0 && gap >= 70) humanish = true;
        if (!inSearchBox && (!isInput || gap < 50)) {
          buffer += e.key;
        }

        // إدخال الكمية السريع: بعد إضافة مادة بالنقر، ضغط رقم يحدد كميتها مباشرة
        const armed = quickQtyArmedRef.current;
        if (settingsRef.current.quickQuantityEntry && !settingsRef.current.posKeyboardMode && armed && !isInput) {
          if (/^[0-9]$/.test(e.key)) {
            if (quickQtyFor !== armed) { quickQtyBuf = ''; quickQtyFor = armed; quickQtyPrev = null; }
            if (quickQtyBuf !== '' && now - quickQtyTime > 1500) quickQtyBuf = '';
            if (quickQtyBuf === '') quickQtyPrev = currentQtyOf(armed);
            if (quickQtyBuf !== '' && (gap < 60 || quickQtyBuf.length >= 4)) {
              // سرعة إدخال الماسح أو رقم طويل جداً: هذه ليست كمية → نتراجع ونترك الأرقام للماسح
              restoreQuickQty();
              quickQtyArmedRef.current = null;
            } else {
              quickQtyBuf += e.key;
              quickQtyTime = now;
              const n = parseInt(quickQtyBuf, 10);
              if (n > 0 && n <= 9999) updateQuantityRef.current(armed, n);
              e.preventDefault();
            }
          } else {
            quickQtyArmedRef.current = null;
            quickQtyBuf = '';
            quickQtyPrev = null;
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showQuickAddModal, isScannerOpen, unfoundBarcodePrompt, productForPriceEdit, isSelectRepModalOpen, showClearConfirmModal, showChangeCalc]);

  const updateQuantity = (productId: string, newQty: number) => {
    // كمية خيالية = باركود دخل في خانة الكمية بالخطأ: نتجاهلها
    if (!isFinite(newQty) || newQty > 100000) return;
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const cleanQty = Math.round(newQty * 1000) / 1000;
    setCartItems((prev) =>
      prev.map((item) => {
        if (lineKeyOf(item) === productId) {
          const cartonCap = item.piecesPerCarton || 1;
          const isCarton = !item.isWeighted && item.unitType === 'carton';
          const deductedPieces = isCarton ? cleanQty * cartonCap : cleanQty;
          return {
            ...item,
            quantity: cleanQty,
            weightGrams: item.isWeighted ? Math.round(cleanQty * 1000) : undefined,
            deductedPieces,
            total: Math.round(cleanQty * item.unitPrice),
          };
        }
        return item;
      })
    );
  };

  const updateQuantityRef = useRef(updateQuantity);
  useEffect(() => {
    updateQuantityRef.current = updateQuantity;
  });

  const updateItemWeight = (productId: string, weightKg: number) => {
    updateQuantity(productId, Math.max(0.001, Math.round(weightKg * 1000) / 1000));
  };

  const updateItemWeightInGrams = (productId: string, grams: number) => {
    if (grams <= 0) return;
    const kg = Math.round((grams / 1000) * 1000) / 1000;
    updateQuantity(productId, Math.max(0.001, kg));
  };

  const updateItemByTargetAmount = (productId: string, targetAmount: number) => {
    if (targetAmount < 0) return;
    setCartItems((prev) =>
      prev.map((item) => {
        if (lineKeyOf(item) === productId && item.isWeighted) {
          const effectivePrice = item.unitPrice > 0 ? item.unitPrice : 1;
          const computedWeightKg = Math.round((targetAmount / effectivePrice) * 1000) / 1000;
          return {
            ...item,
            quantity: Math.max(0.001, computedWeightKg),
            weightGrams: Math.round(computedWeightKg * 1000),
            deductedPieces: computedWeightKg,
            total: Math.round(targetAmount),
          };
        }
        return item;
      })
    );
  };

  const toggleItemUnitType = (productId: string, newUnitType: 'piece' | 'carton' | 'dozen') => {
    const prod = products.find((p) => p.id === baseIdOf(productId));
    if (!prod) return;

    const isDz = newUnitType === 'dozen' && dozenOf(prod) > 1;
    const cartonCapacity = isDz ? dozenOf(prod) : Math.max(1, prod.piecesPerCarton || 1);
    const storedUnit: 'piece' | 'carton' = newUnitType === 'piece' ? 'piece' : 'carton';
    const packLabel = isDz ? dozenName(prod) : undefined;

    setCartItems((prev) =>
      prev.map((item) => {
        if (lineKeyOf(item) === productId) {
          if (item.isGift) {
            const capG = storedUnit === 'carton' ? cartonCapacity : 1;
            return { ...item, unitType: storedUnit, packLabel, piecesPerCarton: cartonCapacity, unitPrice: 0, total: 0, deductedPieces: item.quantity * capG };
          }
          const piecePrice = getPiecePrice(prod, item.priceType);
          const pieceCost = prod.costPrice;
          const isCarton = storedUnit === 'carton';
          const effectiveUnitPrice = isCarton ? piecePrice * cartonCapacity : piecePrice;
          const effectiveCostPrice = isCarton ? pieceCost * cartonCapacity : pieceCost;
          const deductedPieces = isCarton ? item.quantity * cartonCapacity : item.quantity;
          const total = item.quantity * effectiveUnitPrice;

          return {
            ...item,
            unitType: storedUnit,
            packLabel,
            piecesPerCarton: isCarton ? cartonCapacity : Math.max(1, prod.piecesPerCarton || 1),
            unitPrice: effectiveUnitPrice,
            costPrice: effectiveCostPrice,
            deductedPieces,
            total,
          };
        }
        return item;
      })
    );
  };

  const handleGlobalPriceTypeChange = (type: PriceType) => {
    setGlobalPriceType(type);
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.isGift) return item;
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return item;
        const piecePrice = getPiecePrice(prod, type);
        // سطر الكرتون: السعر للكرتون الكامل = سعر القطعة × تعبئة الكرتون
        const newUnitPrice = item.unitType === 'carton'
          ? piecePrice * Math.max(1, item.piecesPerCarton || prod.piecesPerCarton || 1)
          : piecePrice;
        return {
          ...item,
          priceType: type,
          unitPrice: newUnitPrice,
          total: item.quantity * newUnitPrice,
        };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => lineKeyOf(item) !== productId));
  };

  const clearCart = () => {
    setUnfoundList([]);
    clearCurrentDraft();
  };

  const handleAddNewDraft = () => {
    addNewDraft();
    if (isMobileMode) {
      setMobileTab('products');
    }
  };

  // تطبيق العروض والخصومات الفعالة على السلة (لا تُعدّل السلة نفسها، تُحسب عند العرض والحفظ)
  const promoResult = useMemo(
    () => applyPromotions(cartItems, settings.promotions, products, settings),
    [cartItems, settings.promotions, settings.promoDiscountDisplay, settings.promoOfferDisplay, products]
  );

  const subtotal = useMemo(() => {
    return promoResult.items.reduce((sum, item) => sum + item.total, 0);
  }, [promoResult]);

  const totalCost = useMemo(() => {
    const giftCounted = settings.giftCostCounted !== false;
    return promoResult.items.reduce(
      (sum, item) => sum + (item.isGift && !giftCounted ? 0 : item.costPrice * item.quantity),
      0
    );
  }, [promoResult, settings.giftCostCounted]);

  // خصم القائمة الكاملة (مبلغ أو نسبة) لا يتجاوز مجموع القائمة
  const discountAmount = useMemo(() => {
    const raw = discountMode === 'percent' ? (subtotal * Math.min(100, discountRaw)) / 100 : discountRaw;
    return Math.round(Math.min(Math.max(0, raw), subtotal) * 100) / 100;
  }, [discountMode, discountRaw, subtotal]);
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const estimatedProfit = finalTotal - totalCost;

  const selectedRepObj = useMemo(() => {
    if (!selectedSalesRepId || !settings.salesReps) return null;
    return settings.salesReps.find(r => r.id === selectedSalesRepId) || null;
  }, [selectedSalesRepId, settings.salesReps]);

  const estimatedRepCommission = useMemo(() => {
    if (!selectedRepObj) return 0;
    const type = selectedRepObj.commissionType || settings.repCommissionDefaultType || 'percentage_profit';
    if (type === 'percentage_sales') {
      return Math.round((finalTotal * (selectedRepObj.commissionRate || 0)) / 100);
    }
    return Math.round(Math.max(0, (estimatedProfit * (selectedRepObj.commissionRate || 0)) / 100));
  }, [selectedRepObj, finalTotal, estimatedProfit, settings.repCommissionDefaultType]);

  const estimatedStoreProfit = Math.max(0, estimatedProfit - estimatedRepCommission);

  const actualPaidAmount = saleType === 'direct' ? finalTotal : Math.min(paidAmount, finalTotal);
  const remainingDebt = Math.max(0, finalTotal - actualPaidAmount);
  // المبلغ الزائد عن قيمة القائمة (آجل) يُخصم من الدين القديم بدل أن يضيع
  const extraPaid = saleType === 'credit' ? Math.max(0, paidAmount - finalTotal) : 0;
  const previousCustomerDebt = selectedCustomer ? selectedCustomer.totalDebt : 0;
  const newCustomerDebt = previousCustomerDebt + remainingDebt - extraPaid;

  const executeFinalizeInvoice = (repIdToUse?: string, andPrint = true) => {
    let finalCustomerId: string | undefined = selectedCustomerId || undefined;
    let finalCustomerName = customCustomerName.trim();
    let finalCustomerPhone = customerPhone.trim();

    if (saleType === 'credit') {
      let activeCustomer = selectedCustomer;

      if (!activeCustomer && finalCustomerName) {
        const found = customers.find(
          (c) => c.name.trim().toLowerCase() === finalCustomerName.toLowerCase()
        );
        if (found) {
          activeCustomer = found;
          finalCustomerId = found.id;
          setSelectedCustomerId(found.id);
        }
      }

      if (!activeCustomer || !finalCustomerId) {
        setCartErrorNotice(
          'لا يمكن البيع بالآجل إلا لزبون مضاف اسمه مسبقاً في النظام لضمان حفظ الديون ومتابعتها! يرجى اختيار زبون مسجل أو الضغط على زر الاقتراح.'
        );
        setTimeout(() => setCartErrorNotice(null), 6000);
        handleOpenQuickAddCustomer(finalCustomerName || undefined);
        return;
      }

      finalCustomerId = activeCustomer.id;
      finalCustomerName = activeCustomer.name;
      finalCustomerPhone = activeCustomer.phone || finalCustomerPhone;
    } else {
      if (!finalCustomerName) {
        finalCustomerName = selectedCustomer?.name || 'زبون نقدي مباشر';
      }
      if (!finalCustomerPhone && selectedCustomer) {
        finalCustomerPhone = selectedCustomer.phone || '';
      }
    }

    const effectiveRepId = repIdToUse !== undefined ? repIdToUse : selectedSalesRepId;
    const repObj = (settings.salesReps || []).find(r => r.id === effectiveRepId);

    const created = createInvoice({
      type: saleType,
      customerId: finalCustomerId,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      items: promoResult.items,
      showDiscountColumn: promoResult.showDiscountColumn,
      showGiftColumn: promoResult.showGiftColumn,
      discount: discountAmount,
      paidAmount: actualPaidAmount,
      extraPaid,
      paymentDueDate: saleType === 'credit' ? dueDate : undefined,
      notes: notes.trim(),
      specialNote: specialNoteOn ? specialNote.trim() : '',
      salesRepId: effectiveRepId || undefined,
      salesRepName: repObj?.name || undefined,
      showRepOnInvoice: showRepOnInvoice,
    });

    setIsSelectRepModalOpen(false);
    setUnfoundList([]);
    completeActiveDraft();
    onInvoiceCreated(created, andPrint);
  };

  // ===== الشكل الكلاسيكي لقائمة البيع (جدول) =====
  const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
  const cartonColsOn = settings.invoiceShowCartonColumns !== false;
  const piecePriceColOn = settings.invoiceShowPiecePrice === true;
  const [cellFocus, setCellFocus] = useState<{ id: string; col: string } | null>(null);

  useEffect(() => {
    if (!cellFocus) return;
    const el = Array.from(document.querySelectorAll<HTMLInputElement>('[data-cell]')).find(
      (x) => x.dataset.cell === `${cellFocus.id}|${cellFocus.col}`
    );
    if (el) {
      el.focus();
      el.select();
      setCellFocus(null);
    }
  }, [cellFocus, cartItems]);

  const classicColsOf = (item: InvoiceItem): string[] => {
    const cap = item.piecesPerCarton || 1;
    const cols: string[] = [];
    if (cartonColsOn && !item.isWeighted) {
      if (cap > 1) cols.push('c');
      cols.push('p');
    } else {
      cols.push('q');
    }
    // التنقل بـ Enter: كراتين ← قطع ← السعر ← ثم العودة للبحث
    if (!item.isGift) cols.push('price');
    return cols;
  };

  const breakdownOf = (item: InvoiceItem) => {
    const cap = Math.max(1, item.piecesPerCarton || 1);
    if (item.isWeighted) return { c: 0, p: item.quantity };
    if (item.unitType === 'carton') return { c: item.quantity, p: 0 };
    const c = cap > 1 ? Math.floor(item.quantity / cap) : 0;
    return { c, p: item.quantity - c * cap };
  };

  const applyBreakdown = (key: string, cN: number, pN: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (lineKeyOf(item) !== key || item.isWeighted) return item;
        const cap = Math.max(1, item.piecesPerCarton || 1);
        const c = Math.max(0, Math.floor(cN));
        const p = Math.max(0, Math.floor(pN));
        const wasCarton = item.unitType === 'carton';
        const pieceUnit = wasCarton ? item.unitPrice / cap : item.unitPrice;
        const pieceCost = wasCarton ? item.costPrice / cap : item.costPrice;
        const toCarton = p === 0 && c > 0;
        const qty = toCarton ? c : c * cap + p;
        const unitPrice = r6(toCarton ? pieceUnit * cap : pieceUnit);
        const costPrice = r6(toCarton ? pieceCost * cap : pieceCost);
        return {
          ...item,
          unitType: toCarton ? 'carton' : 'piece',
          packLabel: toCarton ? item.packLabel : undefined,
          quantity: qty,
          unitPrice,
          costPrice,
          deductedPieces: toCarton ? qty * cap : qty,
          total: Math.round(qty * unitPrice),
        };
      })
    );
  };

  // تعديل الكمية مباشرة (يسمح بالصفر مؤقتاً أثناء الكتابة)
  const setLineQty = (key: string, n: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (lineKeyOf(item) !== key) return item;
        const cap = Math.max(1, item.piecesPerCarton || 1);
        const q = item.isWeighted ? Math.round(n * 1000) / 1000 : Math.floor(n);
        return {
          ...item,
          quantity: q,
          weightGrams: item.isWeighted ? Math.round(q * 1000) : undefined,
          deductedPieces: !item.isWeighted && item.unitType === 'carton' ? q * cap : q,
          total: Math.round(q * item.unitPrice),
        };
      })
    );
  };

  const setLinePrice = (key: string, n: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        lineKeyOf(item) === key
          ? { ...item, unitPrice: n, total: Math.round(item.quantity * n), isCustomPrice: true }
          : item
      )
    );
  };

  const focusListEntry = () => setTimeout(() => (document.querySelector('[data-list-entry]') as HTMLInputElement | null)?.focus(), 0);
  const classicFinish = () => {
    if (listMode) focusListEntry();
    else if (kbMode) focusSearchBox();
    else (document.activeElement as HTMLElement | null)?.blur();
  };

  const onClassicCellKey = (e: React.KeyboardEvent, item: InvoiceItem, col: string) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') return;
    e.stopPropagation();
    const cols = classicColsOf(item);
    if (e.key === 'Enter') {
      e.preventDefault();
      const i = cols.indexOf(col);
      if (i >= 0 && i < cols.length - 1) {
        // الانتقال للعمود التالي حتى لو كان الحقل فارغاً
        setCellFocus({ id: lineKeyOf(item), col: cols[i + 1] });
        return;
      }
      // آخر عمود: سطر بلا كمية يُحذف
      if (!(item.quantity > 0)) removeFromCart(lineKeyOf(item));
      classicFinish();
      return;
    }
    // Backspace (ضغطة منفصلة وليست استمراراً بالإبقاء) على حقل فارغ: خطوة للوراء (العمود السابق، ومن أول عمود يُحذف السطر ونعود لقائمة المواد)
    if (e.key === 'Backspace' && !e.repeat && (e.currentTarget as HTMLInputElement).value === '') {
      const i = cols.indexOf(col);
      if (i > 0) {
        e.preventDefault();
        setCellFocus({ id: lineKeyOf(item), col: cols[i - 1] });
      } else if (i === 0) {
        e.preventDefault();
        removeFromCart(lineKeyOf(item));
        (document.activeElement as HTMLElement | null)?.blur();
        if (listMode) focusListEntry();
        else if (kbMode) setKbZone('list');
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      classicFinish();
      return;
    }
    if (sepMode && (col === 'c' || col === 'p') && cols.includes('c') && !/\d/.test(cartonKey) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const isHot = e.key.toLowerCase() === cartonKey || (/^[a-z]$/.test(cartonKey) && e.code === `Key${cartonKey.toUpperCase()}`);
      if (isHot) {
        e.preventDefault();
        setCellFocus({ id: lineKeyOf(item), col: col === 'c' ? 'p' : 'c' });
      }
    }
  };

  // إضافة مادة في الشكل الكلاسيكي والذهاب لخلاياها بالترتيب
  const classicAddAndFocus = (prod: Product, fromKeyboard: boolean) => {
    const weighted = isWeightedProd(prod);
    const cap = Math.max(1, prod.piecesPerCarton || 1);
    const first = cartonColsOn && !weighted ? (cap > 1 ? 'c' : 'p') : 'q';
    const exists = cartItemsRef.current.some((i) => i.productId === prod.id && !i.isGift);
    if (!exists) addEntryLine(prod, 'piece', first === 'c' ? 0 : 1);
    else if (!fromKeyboard) addToCart(prod);
    if (fromKeyboard) setCellFocus({ id: prod.id, col: first });
    else if (sepMode) setCellFocus({ id: prod.id, col: first === 'c' ? 'p' : first });
  };

  // F5: فتح حاسبة الباقي (يُمنع تحديث الصفحة ما دامت الميزة مفعّلة)
  const openChangeCalc = () => {
    if (settings.enableChangeCalculator === false) return;
    if (cartItemsRef.current.length === 0) {
      setCartErrorNotice('أضف مواد إلى القائمة أولاً لتستخدم حاسبة الباقي');
      setTimeout(() => setCartErrorNotice(null), 3000);
      return;
    }
    setShowChangeCalc(true);
  };
  // وضع «كاشير سريع» (اختياري): F2 بحث، F8 حفظ فقط، F9 حفظ وطباعة
  useEffect(() => {
    if (settings.fastCashierMode !== true) return;
    const onFast = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key !== 'F2' && e.key !== 'F8' && e.key !== 'F9') return;
      if (isOverlayOpen()) return;
      e.preventDefault();
      if (e.key === 'F2') { focusSearchBox(); return; }
      if (cartItemsRef.current.length === 0) return;
      handleSaveInvoiceRef.current(e.key === 'F9');
    };
    window.addEventListener('keydown', onFast);
    return () => window.removeEventListener('keydown', onFast);
  }, [settings.fastCashierMode]);
  useEffect(() => {
    const onF5 = (e: KeyboardEvent) => {
      if (e.key !== 'F5' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (settings.enableChangeCalculator === false) return;
      e.preventDefault();
      if (isOverlayOpen()) return;
      if (scanChoice || showQuickAddModal || isScannerOpen || unfoundBarcodePrompt || productForPriceEdit || isSelectRepModalOpen || showClearConfirmModal || showChangeCalc) return;
      openChangeCalc();
    };
    window.addEventListener('keydown', onF5);
    return () => window.removeEventListener('keydown', onF5);
  });

  const handleSaveInvoice = (andPrint: boolean) => {
    if (sessionRole === 'employee' && !activeShift) {
      setCartErrorNotice('⚠️ عذراً، لا يمكن إتمام البيع في جلسة الموظف إلا بعد بدء شفت عمل جارٍ ومعد مسبقاً.');
      setTimeout(() => setCartErrorNotice(null), 5000);
      setIsStartShiftModalOpen(true);
      return;
    }

    if (cartItems.length === 0) {
      setCartErrorNotice('الرجاء إضافة مادة واحدة على الأقل إلى القائمة');
      setTimeout(() => setCartErrorNotice(null), 4000);
      return;
    }

    if (cartItems.some((i) => !(i.quantity > 0))) {
      setCartErrorNotice('يوجد سطر بكمية صفر في القائمة، أدخل الكمية أو احذف السطر');
      setTimeout(() => setCartErrorNotice(null), 4000);
      return;
    }

    if (settings.enableSalesReps && (settings.salesReps && settings.salesReps.length > 0) && !selectedSalesRepId) {
      setPendingPrintAfterRepSelect(andPrint);
      setIsSelectRepModalOpen(true);
      return;
    }

    executeFinalizeInvoice(selectedSalesRepId, andPrint);
  };

  const isMobileMode = settings.deviceMode === 'mobile';

  // جدول القائمة (الشكل الكلاسيكي ووضع القائمة): entry=true يضيف سطر الإدخال مع الاقتراحات وسطوراً فارغة كالقائمة المطبوعة
  const renderClassicTable = (entry: boolean) => (
        <div className="overflow-x-auto">
          <div className="flex items-center justify-end gap-1 mb-1 text-[11px] text-slate-500" data-testid="table-size-controls">
            <span>حجم الجدول:</span>
            <button type="button" tabIndex={-1} onClick={() => setTblScale(tblScale - 0.1)} className="w-6 h-6 rounded border border-slate-300 font-black cursor-pointer hover:bg-slate-100" title="تصغير">−</button>
            <button type="button" tabIndex={-1} onClick={() => setTblScale(1)} className="px-1.5 h-6 rounded border border-slate-300 font-mono cursor-pointer hover:bg-slate-100" title="الحجم الافتراضي">{Math.round(tblScale * 100)}%</button>
            <button type="button" tabIndex={-1} onClick={() => setTblScale(tblScale + 0.1)} className="w-6 h-6 rounded border border-slate-300 font-black cursor-pointer hover:bg-slate-100" title="تكبير">+</button>
            {entry && canViewCost && (
              <label className="mr-2 flex items-center gap-1 cursor-pointer select-none" title="يظهر هنا فقط ولا يُطبع في الوصل">
                <input type="checkbox" data-testid="list-cost-toggle" tabIndex={-1} checked={showCostCol} onChange={(e) => setShowCostCol(e.target.checked)} className="w-3 h-3 accent-amber-600" />
                <span>إظهار التكلفة (لا تُطبع)</span>
              </label>
            )}
            {entry && (
              <>
                <span className="mr-2">عرض الورقة:</span>
                <button type="button" tabIndex={-1} onClick={() => setPaperW(paperW - 100)} className="w-6 h-6 rounded border border-slate-300 font-black cursor-pointer hover:bg-slate-100" title="تضييق">‹</button>
                <button type="button" tabIndex={-1} onClick={() => setPaperW(paperW + 100)} className="w-6 h-6 rounded border border-slate-300 font-black cursor-pointer hover:bg-slate-100" title="توسيع">›</button>
              </>
            )}
          </div>
          <table className="w-full text-right border-collapse bg-white border border-slate-800" style={{ fontSize: (entry ? 14 : 11) * tblScale }} dir="rtl">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-800 text-slate-900 font-black">
                <th className="py-1 px-1 border-l border-slate-800 text-center w-6">ت</th>
                <th className="py-1 px-1.5 border-l border-slate-800">اسم المادة</th>
                {cartonColsOn ? (
                  <>
                    <th className="py-1 px-1 border-l border-slate-800 text-center w-14">كراتين</th>
                    <th className="py-1 px-1 border-l border-slate-800 text-center w-14">قطع</th>
                    <th className="py-1 px-1 border-l border-slate-800 text-center w-10">تعبئة</th>
                  </>
                ) : (
                  <th className="py-1 px-1 border-l border-slate-800 text-center w-14">العدد</th>
                )}
                <th className="py-1 px-1 border-l border-slate-800 text-center w-16">السعر</th>
                {piecePriceColOn && <th className="py-1 px-1 border-l border-slate-800 text-center w-14">سعر القطعة</th>}
                {helperOn && <th data-testid="gift-th" className="py-1 px-1 border-l border-slate-800 text-center w-14 text-pink-700">هدية</th>}
                {entry && canViewCost && showCostCol && <th data-testid="list-cost-th" className="py-1 px-1 border-l border-slate-800 text-center w-16 text-amber-800 bg-amber-50 print:hidden">التكلفة</th>}
                <th className="py-1 px-1 border-l border-slate-800 text-center w-16">المبلغ</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item, index) => {
                const key = lineKeyOf(item);
                const cap = Math.max(1, item.piecesPerCarton || 1);
                const bd = breakdownOf(item);
                const bad = !(item.quantity > 0);
                const hasCartonCol = cartonColsOn && !item.isWeighted;
                const pieceUnitPrice = item.unitType === 'carton' ? item.unitPrice / cap : item.unitPrice;
                const kd = (col: string) => (e: React.KeyboardEvent<HTMLInputElement>) => onClassicCellKey(e, item, col);
                return (
                  <tr key={`${key}_${index}`} data-testid="cart-row" onContextMenu={(e) => openCartItemMenu(e, item)} className={`font-semibold border-b border-slate-400 ${bad ? 'bg-rose-50' : item.isGift ? 'bg-pink-50/60' : ''}`}>
                    <td className="py-0.5 px-0.5 border-l border-slate-800 text-center font-mono text-[10px]">{index + 1}</td>
                    <td className="py-0.5 px-1.5 border-l border-slate-800 break-words">
                      <span>{item.productName}</span>
                      {item.isGift && <span className="mr-1 text-[10px] font-black text-pink-700">🎁 هدية</span>}
                      {item.isWeighted && <span className="mr-1 text-[10px] text-emerald-700">(كغم)</span>}
                      {!cartonColsOn && !item.isWeighted && item.unitType === 'carton' && <span className="mr-1 text-[10px] text-amber-700">({item.packLabel || 'كرتون'})</span>}
                    </td>
                    {cartonColsOn ? (
                      <>
                        <td className="p-0 border-l border-slate-800">
                          {hasCartonCol && cap > 1 ? (
                            <ClassicCell cellId={`${key}|c`} value={bd.c} onKeyDown={kd('c')} invalid={bad}
                              onCommit={(n) => applyBreakdown(key, n, breakdownOf(cartItemsRef.current.find((i) => lineKeyOf(i) === key) || item).p)} />
                          ) : <span className="block text-center text-slate-400">-</span>}
                        </td>
                        <td className="p-0 border-l border-slate-800">
                          {hasCartonCol ? (
                            <ClassicCell cellId={`${key}|p`} value={bd.p} onKeyDown={kd('p')} invalid={bad}
                              onCommit={(n) => applyBreakdown(key, breakdownOf(cartItemsRef.current.find((i) => lineKeyOf(i) === key) || item).c, n)} />
                          ) : (
                            <ClassicCell cellId={`${key}|q`} value={item.quantity} step="0.001" onKeyDown={kd('q')} invalid={bad}
                              onCommit={(n) => setLineQty(key, n)} />
                          )}
                        </td>
                        <td className="py-0.5 px-0.5 border-l border-slate-800 text-center font-mono text-[10px]">{cap > 1 && !item.isWeighted ? cap : '-'}</td>
                      </>
                    ) : (
                      <td className="p-0 border-l border-slate-800">
                        <ClassicCell cellId={`${key}|q`} value={item.quantity} step={item.isWeighted ? '0.001' : '1'} onKeyDown={kd('q')} invalid={bad}
                          onCommit={(n) => setLineQty(key, n)} />
                      </td>
                    )}
                    <td className="p-0 border-l border-slate-800">
                      {item.isGift ? (
                        <span className="block text-center font-mono">0</span>
                      ) : (
                        <ClassicCell cellId={`${key}|price`} value={item.unitPrice} step="any" onKeyDown={kd('price')}
                          onCommit={(n) => setLinePrice(key, n)} />
                      )}
                    </td>
                    {piecePriceColOn && (
                      <td className="py-0.5 px-1 border-l border-slate-800 text-center font-mono">
                        {item.isWeighted ? '-' : formatMoney(Math.round(pieceUnitPrice))}
                      </td>
                    )}
                    {helperOn && (
                      <td className="p-0 border-l border-slate-800 bg-pink-50/40" data-testid="gift-td">
                        {item.isGift ? (
                          <span className="block text-center font-mono text-pink-700">{item.quantity}</span>
                        ) : (() => {
                          const prodH = products.find((pp) => pp.id === item.productId);
                          const promoG = (promoResult.items as any[]).filter((x) => x.productId === item.productId && !x.isGift).reduce((a, x) => a + (Number(x.giftQty) || 0), 0)
                            + (promoResult.items as any[]).filter((x) => x.productId === item.productId && x.isGift && x.promoLabel).reduce((a, x) => a + (Number(x.quantity) || 0), 0);
                          const manualG = cartItems.filter((x) => x.productId === item.productId && x.isGift).reduce((a, x) => a + (Number(x.quantity) || 0), 0);
                          return prodH ? (
                            <GiftHelperCell existing={promoG + manualG} canCarton={!item.isWeighted && (prodH.piecesPerCarton || 1) > 1} cartonLabel={prodH.packLabel || 'كرتون'} onPick={(qn, un) => addGiftQty(prodH, qn, un)} />
                          ) : <span className="block text-center text-slate-300">-</span>;
                        })()}
                      </td>
                    )}
                    {entry && canViewCost && showCostCol && (
                      <td data-testid="list-cost-td" className="py-0.5 px-1 border-l border-slate-800 text-center font-mono text-amber-800 bg-amber-50/60 print:hidden">{formatMoney(Math.round(item.costPrice || 0))}</td>
                    )}
                    <td className="py-0.5 px-1 border-l border-slate-800 text-center font-mono font-bold">{formatMoney(item.total)}</td>
                    <td className="py-0.5 px-0.5 text-center">
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => removeFromCart(key)}
                        className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="حذف السطر"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {entry && (() => {
                const total = 2 + (cartonColsOn ? 3 : 1) + 1 + (piecePriceColOn ? 1 : 0) + (helperOn ? 1 : 0) + (canViewCost && showCostCol ? 1 : 0) + 1 + 1;
                const fillers = Math.max(0, 14 - cartItems.length - 1);
                return (
                  <>
                    <tr className="font-semibold border-b border-slate-400 bg-emerald-50/50" data-testid="list-entry-row">
                      <td className="py-0.5 px-0.5 border-l border-slate-800 text-center font-mono text-[10px]">{cartItems.length + 1}</td>
                      <td className="p-0 border-l border-slate-800">
                        <ListEntryCell
                          products={products}
                          priceOf={(pr) => getPiecePrice(pr, globalPriceType)}
                          priceLabel={globalPriceType === 'wholesale' ? 'جملة' : globalPriceType === 'superWholesale' ? 'جملة الجملة' : globalPriceType === 'special' ? 'خاص' : 'مفرد'}
                          formatMoney={formatMoney}
                          onPick={(pr) => classicAddAndFocus(pr, true)}
                          onEmptyEnter={() => { if (settings.quickCreditButton === true && !kbMode) runQuickKeyRef.current('enter'); }}
                        />
                      </td>
                      <td colSpan={total - 2} className="border-l border-slate-800 text-[10px] text-slate-400 px-2">اكتب اسم المادة أو الباركود ← ↓ للاختيار ← Enter</td>
                    </tr>
                    {Array.from({ length: fillers }).map((_, i) => (
                      <tr key={`fill_${i}`} className="border-b border-slate-300 h-6 cursor-text" onClick={() => (document.querySelector('[data-list-entry]') as HTMLInputElement | null)?.focus()}>
                        <td className="border-l border-slate-300 text-center font-mono text-[10px] text-slate-300">{cartItems.length + 2 + i}</td>
                        {Array.from({ length: total - 1 }).map((__, j) => <td key={j} className="border-l border-slate-300" />)}
                      </tr>
                    ))}
                  </>
                );
              })()}
            </tbody>
          </table>
          {kbMode && (
            <p className="text-[10px] text-slate-400 mt-1 px-1">Enter = العمود التالي · في آخر عمود يعود للبحث · Esc = رجوع للبحث</p>
          )}
        </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
      </div>
      {sessionRole === 'employee' && !activeShift && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-950 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-950">جلسة الموظف: البيع متوقف حالياً لعدم وجود شفت جارٍ</div>
              <div className="text-[11px] text-amber-800">
                لا يمكن بيع أو حفظ أي فواتير في جلسة الموظف إلا بعد بدء شفت عمل معد مسبقاً من الإدارة.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsStartShiftModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>بدء شفت معد مسبقاً الآن</span>
          </button>
        </div>
      )}

      {isMobileMode && (
        <div className="flex items-center bg-slate-200/90 p-1 rounded-xl text-xs font-bold w-full shadow-inner">
          <button
            type="button"
            onClick={() => setMobileTab('products')}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mobileTab === 'products'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-slate-600" />
            <span>تصفح المواد والبحث</span>
          </button>
          
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer relative ${
              mobileTab === 'cart'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>فاتورة البيع الحالية</span>
            {cartItems.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                mobileTab === 'cart' ? 'bg-white text-emerald-800' : 'bg-emerald-600 text-white'
              }`}>
                {cartItems.length}
              </span>
            )}
          </button>
        </div>
      )}

      <div
        ref={splitWrapRef}
        className={isMobileMode ? 'flex flex-col gap-4' : (isLgScreen ? 'grid gap-0' : 'grid grid-cols-12 gap-3')}
        style={!isMobileMode && isLgScreen ? (listMode ? { gridTemplateColumns: 'minmax(0,1fr)' } : { gridTemplateColumns: `minmax(0,1fr) 12px ${cartWidth ? cartWidth + 'px' : (viewMode === 'list' ? '41%' : '33%')}` }) : undefined}
      >
        {(!isMobileMode || mobileTab === 'products') && (
          <div className={`${listMode ? 'hidden' : ''} ${isMobileMode ? 'w-full' : (isLgScreen ? '' : 'col-span-12')} flex flex-col gap-3 min-w-0`}>
            <div className={listMode ? 'hidden' : 'contents'}>
            {lastPriceNotes.length > 0 && (
              <div data-testid="last-price-notes" className="flex flex-col gap-1">
                {lastPriceNotes.map((n) => (
                  <div key={n.key} className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 flex items-center gap-2 flex-wrap">
                    <span>ملاحظة: آخر سعر بيع لـ«{selectedCustomer?.name}» لمادة «{n.name}» كان</span>
                    <span className="font-mono text-sm">{formatMoney(n.last)}</span>
                    <span className="font-normal">(السعر الحالي {formatMoney(n.current)})</span>
                    {(n.invNo || n.invDate) && (
                      <span data-testid="last-price-inv" className="font-normal text-red-600">
                        — قائمة {n.invNo ? <span className="font-mono">#{n.invNo}</span> : ''}{n.invDate ? <> بتاريخ <span className="font-mono">{(() => { const d = new Date(n.invDate); return isNaN(d.getTime()) ? String(n.invDate).slice(0, 10) : d.toLocaleDateString('en-GB'); })()}</span></> : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2.5">
              {tbEdit && (
                <div data-testid="tb-edit-bar" className="flex items-center gap-2 flex-wrap rounded-lg bg-amber-50 border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900">
                  <span>↔ اسحب العناصر وأفلتها بالترتيب الذي تريده</span>
                  <button type="button" onClick={() => saveTbOrder(TB_DEFAULT)} className="px-2 py-0.5 rounded bg-white border border-amber-300 cursor-pointer">الترتيب الافتراضي</button>
                  <button type="button" data-testid="tb-done" onClick={() => setTbEdit(false)} className="px-3 py-0.5 rounded bg-emerald-600 text-white cursor-pointer">تم</button>
                </div>
              )}
              <div
                data-testid="pos-topbar"
                className="flex items-center gap-2 flex-wrap sm:flex-nowrap"
                onContextMenu={(e) => {
                  if ((e.target as HTMLElement).closest('input, textarea')) return;
                  e.preventDefault();
                  setTbMenu({ x: e.clientX, y: e.clientY });
                }}
              >
                <div {...tbProps('search')} className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { if (kbMode) setKbZone('search'); }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        if (cartItems.length > 0) {
                          handleSaveInvoice(!!settings.invertEnterShortcuts);
                        }
                      } else if (e.key === 'Enter' && kbMode) {
                        e.preventDefault();
                        const q = searchQuery.trim();
                        const exactCode = q && productsByCode(products as Product[], q).length > 0;
                        if (exactCode || (q && filteredProducts.length === 0)) {
                          handleBarcodeScanned(q);
                        } else if (visibleProducts.length > 0) {
                          setKbIndex((i) => Math.min(i, visibleProducts.length - 1));
                          setKbZone('list');
                          e.currentTarget.blur();
                        }
                      } else if (e.key === 'Enter') {
                        if (searchQuery.trim()) {
                          e.preventDefault();
                          handleBarcodeScanned(searchQuery.trim());
                        } else if (cartItems.length > 0) {
                          e.preventDefault();
                          // Enter قادم من الماسح مباشرة بعد قراءة الباركود لا يحفظ القائمة
                          if (Date.now() - lastScanRef.current > 800) handleSaveInvoice(!settings.invertEnterShortcuts);
                        }
                      }
                    }}
                    placeholder="ابحث باسم المادة أو امسح الباركود..."
                    className="w-full pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
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

                <div {...tbProps('views')} className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('grid')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="عرض المواد على شكل مربعات مصغرة (مثل مستعرض ملفات ويندوز)"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">مربعات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('list')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="عرض المواد على شكل قائمة تفصيلية"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">قائمة</span>
                  </button>
                  <button
                    type="button"
                    data-testid="view-strips"
                    onClick={() => handleViewModeChange('strips')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      viewMode === 'strips'
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="عرض المواد كأشرطة مضغوطة: اسم + تعديل + المتوفر + التكلفة + السعر (يتسع لمواد أكثر)"
                  >
                    <AlignJustify className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">أشرطة</span>
                  </button>
                </div>

                {isAndroidApp() && (
                <button
                  type="button"
                  {...tbProps('scan')}
                  onClick={() => setIsScannerOpen(true)}
                  className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                  title="مسح باركود المادة بالكاميرا لإضافتها للسلة فوراً"
                >
                  <Scan className="w-4 h-4" />
                  <span className="hidden md:inline">مسح باركود</span>
                </button>
                )}

                <button
                  type="button"
                  {...tbProps('new')}
                  onClick={() => onOpenNewProduct()}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                  title="إضافة مادة جديدة للمخزن مباشرة دون مغادرة الشاشة"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span className="hidden md:inline">مادة جديدة</span>
                </button>

                <button
                  type="button"
                  data-testid="open-return"
                  {...tbProps('return')}
                  onClick={() => setIsReturnOpen(true)}
                  className="px-3 py-2 bg-gradient-to-l from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                  title="استرجاع مواد: صافي أو من قائمة بيع"
                >
                  <span className="text-sm leading-none">↩</span>
                  <span>إرجاع مادة</span>
                </button>
              </div>

              {settings.unfoundBarcodeInline === true && unfoundList.length > 0 && (
                <div className="flex flex-col gap-1.5" data-testid="unfound-alerts">
                  {unfoundList.map((code) => (
                    <div key={code} role="alert" className="bg-red-600 border-2 border-red-800 text-white px-3 py-2.5 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-2 animate-pulse">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="w-6 h-6 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-black">لم تُضَف المادة للقائمة! الباركود <span className="font-mono" dir="ltr">#{code}</span></div>
                          <div className="text-[11px] font-bold text-red-100">المادة غير مضافة في المخزن، أو قُرئ الباركود بشكل خاطئ. أعد المسح أو أضفها.</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => { setUnfoundList((l) => l.filter((c) => c !== code)); onOpenNewProduct(code); }} className="px-3 py-1.5 rounded-lg bg-white text-red-700 text-xs font-black hover:bg-red-50 flex items-center gap-1 cursor-pointer"><Plus className="w-3.5 h-3.5" />إضافة للمخزن</button>
                        <button type="button" onClick={() => setUnfoundList((l) => l.filter((c) => c !== code))} className="px-2.5 py-1.5 rounded-lg bg-red-800 text-white text-xs font-bold hover:bg-red-900 cursor-pointer">إخفاء</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {scanNotice && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{scanNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanNotice(null)}
                    className="text-slate-400 hover:text-slate-700 font-bold px-1"
                  >
                    ×
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer text-xs ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'جميع المواد' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 pb-24">
            {entry && (() => {
              const ep = entry.product;
              const weighted = isWeightedProd(ep);
              const cap = Math.max(1, ep.piecesPerCarton || 1);
              const hasCarton = !weighted && cap > 1;
              const inputCls = 'w-full text-center text-lg font-black rounded-xl border-2 border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300 focus:outline-none px-2 py-2 bg-white';
              const setStep = (st: EntryStep) => setEntry((cur) => (cur && cur.step !== st ? { ...cur, step: st } : cur));
              return (
                <div
                  onKeyDown={onEntryKeyDown}
                  className="mb-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-3 shadow-md"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-800 truncate">{ep.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {weighted ? 'يباع بالوزن (كغم)' : hasCarton ? `الكرتون = ${cap} قطعة` : 'قطعة'}
                        {' · المتوفر: '}{ep.stock}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => closeEntry(false)}
                      className="text-xs font-bold text-slate-500 hover:text-rose-600 px-2 py-1 cursor-pointer"
                    >
                      إلغاء (Esc)
                    </button>
                  </div>

                  {entry.step === 'unit' ? (
                    <div ref={entryUnitRef} tabIndex={0} className="flex gap-2 outline-none">
                      {((): Array<'piece' | 'dozen' | 'carton'> => { const d = dozenOf(entry.product) > 1; const c = (entry.product.piecesPerCarton || 1) > 1; return [ 'piece', ...(d ? ['dozen' as const] : []), ...(c ? ['carton' as const] : []) ]; })().map((u) => (
                        <button
                          key={u}
                          type="button"
                          tabIndex={-1}
                          onClick={() => setEntry({ ...entry, unit: u, step: 'qty' })}
                          className={`flex-1 py-3 rounded-xl text-sm font-black border-2 transition cursor-pointer ${
                            entry.unit === u ? 'bg-emerald-600 text-white border-emerald-700 ring-4 ring-emerald-300' : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {u === 'piece' ? 'قطعة' : u === 'dozen' ? `${dozenName(entry.product)} (${dozenOf(entry.product)})` : `كرتون (${cap})`}
                        </button>
                      ))}
                    </div>
                  ) : sepMode && !weighted ? (
                    <div className="flex gap-2">
                      {hasCarton && (
                        <label className="flex-1 text-[11px] font-bold text-slate-600">
                          عدد الكراتين
                          <input
                            ref={entryCartonRef}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={entry.cartons}
                            placeholder="0"
                            onFocus={() => setStep('cartons')}
                            onChange={(e) => setEntry({ ...entry, cartons: e.target.value })}
                            className={inputCls}
                          />
                        </label>
                      )}
                      <label className="flex-1 text-[11px] font-bold text-slate-600">
                        عدد القطع
                        <input
                          ref={entryPieceRef}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={entry.pieces}
                          placeholder="0"
                          onFocus={() => setStep('pieces')}
                          onChange={(e) => setEntry({ ...entry, pieces: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="block text-[11px] font-bold text-slate-600">
                      {weighted ? 'الوزن (كغم)' : `العدد (${entry.unit === 'carton' ? 'كرتون' : entry.unit === 'dozen' ? dozenName(entry.product) : 'قطعة'})`}
                      <input
                        ref={entryQtyRef}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={weighted ? '0.001' : '1'}
                        value={entry.qty}
                        onFocus={() => setStep('qty')}
                        onChange={(e) => setEntry({ ...entry, qty: e.target.value })}
                        className={inputCls}
                      />
                    </label>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500">
                      Enter = التالي/إضافة
                      {entry.step === 'unit' ? ' · الأسهم = اختيار الوحدة' : ''}
                      {sepMode && hasCarton ? ` · ${cartonKey.toUpperCase()} = تبديل كرتون/قطعة` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={commitEntry}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
                    >
                      إضافة
                    </button>
                  </div>
                </div>
              );
            })()}

              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-xl border border-slate-200 p-6">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">لا توجد مواد تطابق البحث</p>
                  <p className="text-xs text-slate-400 mt-1">تأكد من كتابة الاسم بدقة</p>
                </div>
              ) : viewMode === 'strips' ? (
                <div className="flex flex-col gap-1" data-testid="strips-list">
                  {visibleProducts.map((prod, pIdx) => {
                    const stripOut = prod.stock <= 0;
                    const stripPrice = (tieredMode ? resolveFor(prod, globalPriceType) : prod.retailPrice) ?? 0;
                    const ppc = prod.piecesPerCarton && prod.piecesPerCarton > 1 ? prod.piecesPerCarton : 0;
                    const cartons = ppc ? Math.floor(prod.stock / ppc) : 0;
                    const rest = ppc ? Math.round((prod.stock - cartons * ppc) * 1000) / 1000 : prod.stock;
                    return (
                      <div
                        key={`${prod.id}_${pIdx}`}
                        data-kb-index={pIdx}
                        onClick={() => handleProductClick(prod)}
                        onContextMenu={(e) => { e.preventDefault(); setGiftMenu({ x: e.clientX, y: e.clientY, product: prod }); }}
                        className={`bg-white rounded-lg border px-2.5 py-1.5 flex items-center gap-2 text-right cursor-pointer select-none transition ${
                          kbMode && kbZone === 'list' && pIdx === kbIndex ? 'ring-2 ring-emerald-500 border-emerald-500 ' : ''
                        }${stripOut ? 'border-rose-300 bg-rose-50/30 hover:border-rose-500' : 'border-slate-200 hover:border-emerald-500'}`}
                      >
                        <div className="flex-1 min-w-0 text-[13px] sm:text-sm font-black text-slate-900 truncate" title={prod.name}>{prod.name}</div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onEditProduct(prod); }}
                          className="shrink-0 w-7 h-7 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 flex items-center justify-center cursor-pointer"
                          title="تعديل المادة"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <div className={`shrink-0 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md border ${stripOut ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`} title="المتوفر">
                          {ppc
                            ? <>{cartons} كرتون{rest ? <> + {rest} {prod.unit}</> : null}</>
                            : <>{prod.stock} {prod.unit}</>}
                        </div>
                        {canViewCost && (
                          <div className="shrink-0 hidden sm:block text-[11px] font-bold text-slate-500 font-mono" title="سعر التكلفة (الشراء)">
                            تكلفة {formatMoney(prod.costPrice || 0)}
                          </div>
                        )}
                        <div className="shrink-0 text-xs sm:text-sm font-black text-emerald-700 font-mono min-w-[64px] text-left" title="سعر البيع">
                          {formatMoney(stripPrice)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === 'grid' ? (
                <div
                  className={isMobileMode ? 'grid grid-cols-2 sm:grid-cols-3 gap-2' : 'grid gap-2'}
                  style={isMobileMode ? undefined : { gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))' }}
                >
                  {visibleProducts.map((prod, pIdx) => {
                    const isOutOfStock = prod.stock <= 0;
                    const effectivePriceN = tieredMode
                      ? resolveFor(prod, globalPriceType)
                      : prod.retailPrice;
                    const effectivePrice = effectivePriceN ?? 0;

                    return (
                      <div
                        key={`${prod.id}_${pIdx}`}
                        data-kb-index={pIdx}
                        onClick={() => handleProductClick(prod)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setGiftMenu({ x: e.clientX, y: e.clientY, product: prod });
                        }}
                        title={
                          prod.isWeighted
                            ? `${prod.name} (يباع بالوزن - سعر الكيلو ${formatMoney(effectivePrice)})`
                            : `${prod.name} - ${formatMoney(effectivePrice)}`
                        }
                        className={`group bg-white hover:bg-emerald-50/40 border rounded-xl p-2.5 flex flex-col justify-between transition-all duration-150 select-none cursor-pointer active:scale-97 relative shadow-2xs hover:shadow-xs min-h-[82px] text-right ${
                          kbMode && kbZone === 'list' && pIdx === kbIndex ? 'ring-4 ring-emerald-500 border-emerald-500 bg-emerald-50 ' : ''
                        }${
                          isOutOfStock
                            ? 'border-rose-300 bg-rose-50/20 hover:border-rose-400'
                            : 'border-slate-200 hover:border-emerald-500'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <ProductThumbPreview product={prod} size={34} />
                          <h4 className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 leading-snug line-clamp-2 flex-1">
                            {prod.isWeighted && (
                              <span title="مادة تباع بالوزن (سعر الكيلو 1000g)">
                                <Scale className="w-3 h-3 text-emerald-600 inline ml-1 align-baseline shrink-0" />
                              </span>
                            )}
                            {prod.name}
                          </h4>
                          {isOutOfStock && (
                            <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1 py-0.2 rounded shrink-0">
                              رصيد 0
                            </span>
                          )}
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-baseline justify-between gap-1">
                          <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono">
                            {effectivePriceN === null ? 'غير متاح' : formatMoney(effectivePrice)}
                          </span>
                          {prod.isWeighted && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              / كغم
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {visibleProducts.map((prod, pIdx) => {
                    const isLowStock = prod.stock <= prod.minStock;
                    const isOutOfStock = prod.stock <= 0;
                    // يظهر سعر واحد وزره فقط: حسب نوع السعر المختار في جهة قائمة البيع (كما في شكل المربعات)
                    const own = (t: string) =>
                      t === 'wholesale' ? Number(prod.wholesalePrice) > 0
                      : t === 'superWholesale' ? hasOwnPrice(prod, 'superWholesale')
                      : t === 'special' ? hasOwnPrice(prod, 'special')
                      : true;
                    const typeEnabled = (t: string) =>
                      t === 'retail' ||
                      (!!settings.enableWholesale &&
                        priceTypeOn(t as any) &&
                        (t === 'wholesale' ||
                          (t === 'superWholesale' && settings.showSuperWholesale !== false) ||
                          (t === 'special' && settings.showSpecialPrice !== false)));
                    const showAll = settings.showAllPricesList === true; // الواجهة القديمة: كل الأسعار وتحت كل سعر زر إضافة
                    let shownType: string = typeEnabled(globalPriceType as string) ? (globalPriceType as string) : 'retail';
                    if (shownType !== 'retail' && !own(shownType)) {
                      // لا يوجد سعر لهذا المستوى: نعرض البديل الذي حدده صاحب المتجر في الإعدادات
                      const choice =
                        shownType === 'wholesale' ? (settings.checkerFallbackWholesale || 'retail')
                        : shownType === 'superWholesale' ? (settings.checkerFallbackSuper || 'wholesale')
                        : (settings.checkerFallbackSpecial || 'retail');
                      if (choice === 'none') shownType = 'none';
                      else if (choice === 'wholesale') {
                        shownType = own('wholesale') && typeEnabled('wholesale')
                          ? 'wholesale'
                          : (settings.checkerFallbackWholesale === 'none' && !own('wholesale') ? 'none' : 'retail');
                      } else shownType = 'retail';
                    }

                    return (
                      <div
                        key={`${prod.id}_${pIdx}`}
                        data-kb-index={pIdx}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setGiftMenu({ x: e.clientX, y: e.clientY, product: prod });
                        }}
                        className={`bg-white rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition text-right group select-none relative ${
                          kbMode && kbZone === 'list' && pIdx === kbIndex ? 'ring-4 ring-emerald-500 border-emerald-500 bg-emerald-50 ' : ''
                        }${
                          isOutOfStock
                            ? 'border-rose-300 bg-rose-50/20 hover:border-rose-500 hover:shadow-xs'
                            : 'border-slate-200 hover:border-emerald-500 hover:shadow-xs'
                        }`}
                      >
                        <ProductThumbPreview product={prod} size={56} />
                        <div
                          onClick={() => handleProductClick(prod)}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                            <span
                              className={`text-xs font-black px-2.5 py-0.5 rounded-md border flex items-center flex-wrap gap-1 max-w-full min-w-0 ${
                                isOutOfStock
                                  ? 'bg-rose-100 text-rose-800 border-rose-400 animate-pulse font-mono'
                                  : isLowStock
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              <Package className={`w-3.5 h-3.5 shrink-0 ${isOutOfStock ? 'text-rose-600' : ''}`} />
                              {isOutOfStock ? (
                                <span className="text-rose-700 font-black">
                                  رصيد نافد: {prod.stock} {prod.unit} (يُسمح بالبيع)
                                </span>
                              ) : (
                                <span>المتوفر: {prod.stock} {prod.unit}</span>
                              )}
                              {prod.piecesPerCarton && prod.piecesPerCarton > 1 && !isOutOfStock && (
                                <span className="text-[10px] text-slate-500 font-normal mr-1">
                                  ({Math.floor(prod.stock / prod.piecesPerCarton)} كرتون)
                                </span>
                              )}
                            </span>

                            {prod.isWeighted && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                <Scale className="w-3 h-3 text-emerald-600" />
                                <span>مادة تباع بالوزن (ميزان)</span>
                              </span>
                            )}

                            <span className="text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-bold shrink-0">
                              #{prod.code}
                            </span>
                            <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded shrink-0">
                              {prod.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug group-hover:text-emerald-700 transition">
                              {prod.name}
                            </h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPriceEdit(prod);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200/90 rounded-md transition shadow-2xs shrink-0 cursor-pointer"
                              title="تعديل سعر المادة"
                            >
                              <Pencil className="w-3 h-3 text-blue-600" />
                              <span className="text-[10px] font-bold">تعديل السعر</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-start justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                          {/* إخفاء سعر تكلفة الجملة عند عدم وجود الصلاحية */}
                          {canViewCost && (
                            <div className="bg-slate-100 border border-slate-300/80 rounded-lg px-2.5 py-1 text-right min-w-[95px] shrink-0">
                              <div className="text-[10px] text-slate-600 font-bold">
                                سعر تكلفة الجملة:
                              </div>
                              <div className="text-xs sm:text-sm font-black text-slate-800 font-mono">
                                {formatMoney(prod.costPrice)}
                              </div>
                            </div>
                          )}

                          {(shownType === 'wholesale' || (showAll && own('wholesale'))) && settings.enableWholesale && priceTypeOn('wholesale') && (
                            <div className="flex flex-col gap-1 min-w-[95px] shrink-0">
                              <div className="bg-amber-50/90 border border-amber-200/90 rounded-lg px-2.5 py-1 text-right">
                                <div className="text-[10px] text-amber-800 font-bold">
                                  سعر بيع الجملة:
                                </div>
                                <div className="text-xs sm:text-sm font-black text-amber-950 font-mono">
                                  {formatMoney(getPiecePrice(prod, 'wholesale'))}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCartWithPrice(prod, 'wholesale');
                                }}
                                className={`w-full justify-center px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer ${
                                  isOutOfStock
                                    ? 'bg-rose-700 hover:bg-rose-800 text-white ring-2 ring-rose-300'
                                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                                }`}
                                title={isOutOfStock ? "إضافة بسعر الجملة (تنبيه: الرصيد صفر في المخزن)" : "إضافة بسعر بيع الجملة"}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>جملة</span>
                              </button>
                            </div>
                          )}

                          {(shownType === 'superWholesale' || showAll) && settings.enableWholesale && priceTypeOn('superWholesale') && settings.showSuperWholesale !== false && hasOwnPrice(prod, 'superWholesale') && (
                            <div className="flex flex-col gap-1 min-w-[95px] shrink-0">
                              <div className="bg-orange-50/90 border border-orange-200/90 rounded-lg px-2.5 py-1 text-right">
                                <div className="text-[10px] text-orange-800 font-bold">
                                  جملة الجملة:
                                </div>
                                <div className="text-xs sm:text-sm font-black text-orange-950 font-mono">
                                  {formatMoney(prod.superWholesalePrice || 0)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCartWithPrice(prod, 'superWholesale');
                                }}
                                className="w-full justify-center px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer bg-orange-600 hover:bg-orange-700 text-white"
                                title="إضافة بسعر جملة الجملة"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>جملة الجملة</span>
                              </button>
                            </div>
                          )}

                          {(shownType === 'special' || showAll) && settings.enableWholesale && priceTypeOn('special') && settings.showSpecialPrice !== false && hasOwnPrice(prod, 'special') && (
                            <div className="flex flex-col gap-1 min-w-[95px] shrink-0">
                              <div className="bg-violet-50/90 border border-violet-200/90 rounded-lg px-2.5 py-1 text-right">
                                <div className="text-[10px] text-violet-800 font-bold">
                                  السعر الخاص:
                                </div>
                                <div className="text-xs sm:text-sm font-black text-violet-950 font-mono">
                                  {formatMoney(prod.specialPrice || 0)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCartWithPrice(prod, 'special');
                                }}
                                className="w-full justify-center px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer bg-violet-600 hover:bg-violet-700 text-white"
                                title="إضافة بالسعر الخاص"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>خاص</span>
                              </button>
                            </div>
                          )}

                          {!showAll && shownType === 'none' && (
                            <div className="bg-slate-100 border border-dashed border-slate-300 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-500 min-w-[105px] text-center">
                              السعر غير متاح
                            </div>
                          )}
                          {(showAll || shownType === 'retail') && (
                          <div className="flex flex-col gap-1 min-w-[95px] shrink-0">
                            <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-lg px-2.5 py-1 text-right">
                              <div className="text-[10px] text-emerald-800 font-bold">
                                {tieredMode ? 'سعر بيع المفرد:' : 'سعر البيع:'}
                              </div>
                              <div className="text-xs sm:text-sm font-black text-emerald-950 font-mono">
                                {formatMoney(prod.retailPrice)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCartWithPrice(prod, 'retail');
                              }}
                              className={`w-full justify-center px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer ${
                                isOutOfStock
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-300'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                              title={isOutOfStock ? "إضافة بسعر المفرد (تنبيه: الرصيد صفر في المخزن)" : "إضافة بسعر البيع المفرد"}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{tieredMode ? 'مفرد' : (isOutOfStock ? 'بيع (رصيد 0)' : 'إضافة للقائمة')}</span>
                            </button>
                          </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredProducts.length > displayLimit && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setDisplayLimit(prev => prev + 48)}
                    className="px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
                  >
                    عرض المزيد من المواد (متبقي {filteredProducts.length - displayLimit} مادة)
                  </button>
                </div>
              )}
            </div>

            {isMobileMode && cartItems.length > 0 && mobileTab === 'products' && (
              <div className="fixed bottom-3 left-3 right-3 z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    {cartItems.length}
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-300">مجموع القائمة:</div>
                    <div className="text-sm font-extrabold text-emerald-400 font-mono">{formatMoney(finalTotal)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTab('cart')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <span>عرض الفاتورة والمحاسبة</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            )}
            </div>
          </div>
        )}

        {!isMobileMode && isLgScreen && !listMode && (
          <div
            onPointerDown={startSplitDrag}
            onDoubleClick={() => { setCartWidth(null); try { localStorage.removeItem('pos_cart_width'); } catch {} }}
            title="اسحب لتغيير العرض (نقرتان للإرجاع للوضع الافتراضي)"
            className="group cursor-col-resize flex items-center justify-center touch-none"
          >
            <div className="w-1 h-16 rounded-full bg-slate-300 group-hover:bg-emerald-500 transition" />
          </div>
        )}
        {(!isMobileMode || mobileTab === 'cart') && (
          <div className={`${isMobileMode ? 'w-full' : (isLgScreen ? '' : 'col-span-12')} lg:sticky lg:top-2 flex flex-col min-w-0 ${listMode ? 'mx-auto w-full' : ''}`} style={listMode ? { maxWidth: paperW } : undefined}>
            {isMobileMode && (
              <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 mb-2">
                <button
                  type="button"
                  onClick={() => setMobileTab('products')}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 transition"
                >
                  <ArrowRight className="w-4 h-4 text-emerald-600" />
                  <span>العودة للمواد</span>
                </button>
                <span className="text-xs font-bold text-slate-500">
                  سلة الفاتورة: {cartItems.length} مواد
                </span>
              </div>
            )}
            
            <div data-testid={listMode ? 'list-mode-paper' : undefined} className={`bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden ${listMode ? 'border-2 border-emerald-700/60 shadow-xl' : 'border-slate-200'} ${
              !isMobileMode ? 'lg:h-[calc(100vh-80px)]' : 'h-full'
            }`}>
              {listMode && (
                <div className="px-4 py-2 bg-gradient-to-l from-emerald-800 to-emerald-600 text-white flex items-center justify-between gap-2 shrink-0">
                  <span className="text-sm font-black">📋 قائمة بيع — {settings.storeName || 'المفكر المحاسبي'}</span>
                  <span className="text-[11px] opacity-90">{new Date().toLocaleDateString('ar-IQ')} · اكتب في السطر الفارغ، ↓ للاختيار، Enter للتالي</span>
                </div>
              )}
              <div className="p-2 sm:p-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-col gap-1.5 shrink-0">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  {settings.quickCreditButton !== true && (
<div className="flex items-center bg-slate-200/90 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setSaleType('direct')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition cursor-pointer text-[11px] ${
                        saleType === 'direct'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <DollarSign className="w-3 h-3" />
                      <span>نقدي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleType('credit')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition cursor-pointer text-[11px] ${
                        saleType === 'credit'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <CreditCard className="w-3 h-3" />
                      <span>آجل (دين)</span>
                    </button>
                  </div>
)}

                  <div className="flex items-center gap-1 min-w-0 max-w-full">
                    <span data-testid="session-top" className="shrink-0"><SessionBadgeButton compact={true} /></span>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirmModal(true)}
                      className="shrink-0 w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 flex items-center justify-center transition shadow-2xs cursor-pointer"
                      title={`حذف وتفريغ القائمة الحالية (رقم ${activeDraft.orderNumber})`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleAddNewDraft}
                      className="shrink-0 w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition shadow-2xs cursor-pointer"
                      title="تعليق القائمة الحالية وبدء قائمة جديدة (+)"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    <div data-testid="draft-tabs" className="flex items-center gap-0.5 overflow-x-auto min-w-0 max-w-[9rem] sm:max-w-[13rem] py-0.5 px-0.5 scrollbar-thin">
                      {draftOrders.map((order) => {
                        const isActive = order.id === activeDraft.id;
                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => switchToDraft(order.id)}
                            className={`shrink-0 w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center transition cursor-pointer shadow-2xs ${
                              isActive
                                ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/40 ring-offset-1'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                            }`}
                            title={`الانتقال إلى القائمة ${order.orderNumber}`}
                          >
                            {order.orderNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {tieredMode ? (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-600 text-[10px]">البيع:</span>
                      <div className="flex items-center bg-slate-200 p-0.5 rounded text-[10px] font-bold">
                        <button
                          onClick={() => handleGlobalPriceTypeChange('retail')}
                          className={`px-1.5 py-0.5 rounded transition ${
                            globalPriceType === 'retail'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          مفرد
                        </button>
                        {priceTypeOn('wholesale') && (
                        <button
                          onClick={() => handleGlobalPriceTypeChange('wholesale')}
                          className={`px-1.5 py-0.5 rounded transition ${
                            globalPriceType === 'wholesale'
                              ? 'bg-white text-emerald-800 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          جملة
                        </button>
                        )}
                        {priceTypeOn('superWholesale') && settings.showSuperWholesale !== false && (
                        <button
                          onClick={() => handleGlobalPriceTypeChange('superWholesale')}
                          className={`px-1.5 py-0.5 rounded transition ${
                            globalPriceType === 'superWholesale'
                              ? 'bg-white text-orange-800 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {PRICE_TYPE_LABELS.superWholesale}
                        </button>
                        )}
                        {priceTypeOn('special') && settings.showSpecialPrice !== false && (
                        <button
                          onClick={() => handleGlobalPriceTypeChange('special')}
                          className={`px-1.5 py-0.5 rounded transition ${
                            globalPriceType === 'special'
                              ? 'bg-white text-violet-800 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {PRICE_TYPE_LABELS.special}
                        </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {sessionRole === 'employee' && !activeShift && (
                <div className="m-2 p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 flex items-center justify-between gap-1.5 text-[10px] shrink-0">
                  <div className="flex items-center gap-1.5 text-right">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-bold">يلزم بدء شفت عمل لإتمام البيع</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStartShiftModalOpen(true)}
                    className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px] shrink-0"
                  >
                    بدء الشفت
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[90px] scrollbar-thin">
                {listMode ? (
                  renderClassicTable(true)
                ) : cartItems.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-center">
                    <ShoppingCart className="w-8 h-8 mb-1.5 stroke-1 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">القائمة فارغة</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">انقر على أي مادة لإضافتها</p>
                  </div>
                ) : classicMode ? (
                  renderClassicTable(false)
                ) : (
                  cartItems.map((item, index) => {
                    const cartonCapacity = item.piecesPerCarton || 1;
                    const isDozenLine = !!item.packLabel;
                    const isCarton = !item.isWeighted && item.unitType === 'carton' && !isDozenLine;
                    const isCartonOrDozen = !item.isWeighted && item.unitType === 'carton';
                    const prodRef = products.find(p => p.id === item.productId);
                    const isStockZero = prodRef ? prodRef.stock <= 0 : false;

                    return (
                      <div
                        key={`${lineKeyOf(item)}_${index}`}
                        data-testid="cart-row"
                        onContextMenu={(e) => openCartItemMenu(e, item)}
                        className={`border rounded-lg px-2 py-1 flex flex-col gap-0.5 transition text-right ${
                          isStockZero 
                            ? 'bg-rose-50/50 border-rose-300' 
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="w-5 h-5 rounded font-mono text-[12px] font-bold flex items-center justify-center shrink-0 bg-slate-200 text-slate-700">
                                {index + 1}
                              </span>
                              <span className="text-[15px] font-bold text-slate-900 leading-tight line-clamp-2 break-words">
                                {item.productName}{item.isGift && <span className="mr-1 text-[12px] font-black text-pink-700 bg-pink-50 border border-pink-300 px-1 rounded">🎁 هدية</span>}
                              </span>

                              {item.isWeighted && (
                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1 rounded flex items-center gap-0.5">
                                  <Scale className="w-2.5 h-2.5 text-emerald-700" />
                                  <span>وزن</span>
                                </span>
                              )}
                              {item.isCustomPrice && (
                                <span className="px-1 py-0.2 rounded bg-blue-100 text-blue-800 text-[11px] font-bold border border-blue-200">
                                  سعر خاص
                                </span>
                              )}
                              {isStockZero && (
                                <span className="px-1 py-0.2 rounded bg-rose-600 text-white text-[11px] font-black">
                                  رصيد 0
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 flex-wrap">
                              {item.isWeighted ? (
                                <span>سعر الكيلو الواحد: <strong className="font-mono text-slate-700">{formatMoney(item.unitPrice)}</strong></span>
                              ) : (
                                <span>الوحدة: {isDozenLine ? `${item.packLabel} (${cartonCapacity} ق)` : isCarton ? `كرتون (${cartonCapacity} ق)` : (item.unit || 'قطعة')}</span>
                              )}
                              {canViewCost && (
                                <>
                                  <span>·</span>
                                  <span className="text-emerald-700">تكلفة: {formatMoney(item.costPrice)}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleEditCartItemPrice(item)}
                              className={`p-1 rounded border transition cursor-pointer flex items-center justify-center ${
                                editingPriceProductId === lineKeyOf(item)
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-blue-600 hover:text-blue-800 border-slate-300 hover:border-blue-400'
                              }`}
                              title="تعديل سعر البيع في هذه القائمة"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>

                            {!item.isWeighted && (
                              <div className="inline-flex items-center bg-slate-200/80 p-0.5 rounded border border-slate-300 text-[11px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => toggleItemUnitType(lineKeyOf(item), 'piece')}
                                  className={`px-1 py-0.2 rounded transition cursor-pointer ${
                                    !isCartonOrDozen
                                      ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                  title="بيع بالقطعة"
                                >
                                  قطعة
                                </button>
                                {(prodRef?.piecesPerDozen || 0) > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleItemUnitType(lineKeyOf(item), 'dozen')}
                                    className={`px-1 py-0.2 rounded transition cursor-pointer ${
                                      isDozenLine
                                        ? 'bg-sky-600 text-white shadow-2xs font-extrabold'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title={`بيع بـ${dozenName(prodRef)} (${prodRef?.piecesPerDozen} قطعة)`}
                                  >
                                    {dozenName(prodRef)}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => toggleItemUnitType(lineKeyOf(item), 'carton')}
                                  className={`px-1 py-0.2 rounded transition cursor-pointer flex items-center gap-0.5 ${
                                    isCarton
                                      ? 'bg-amber-600 text-white shadow-2xs font-extrabold'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                  title={`بيع بالكرتون (${prodRef?.piecesPerCarton || cartonCapacity} قطعة)`}
                                >
                                  <Box className="w-2.5 h-2.5" />
                                  <span>كرتون</span>
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => removeFromCart(lineKeyOf(item))}
                              className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer rounded hover:bg-rose-50"
                              title="حذف من القائمة"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {editingPriceProductId === lineKeyOf(item) && (
                          <div className="bg-blue-50 border border-blue-300 rounded-lg p-2 my-0.5 flex flex-col gap-1.5 shadow-2xs">
                            <div className="flex items-center justify-between text-[12px] font-bold text-blue-950">
                              <span>تعديل السعر للقائمة:</span>
                              {canViewCost && (
                                <span className="text-slate-600 font-mono">تكلفة: {formatMoney(item.costPrice)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={tempItemPrice}
                                onChange={(e) => setTempItemPrice(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveCartItemPrice(lineKeyOf(item));
                                  } else if (e.key === 'Escape') {
                                    setEditingPriceProductId(null);
                                  }
                                }}
                                className="flex-1 px-2 py-1 text-xs font-bold bg-white border border-blue-300 rounded focus:outline-none font-mono"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveCartItemPrice(lineKeyOf(item))}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[12px] font-bold transition cursor-pointer"
                              >
                                حفظ
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPriceProductId(null)}
                                className="px-1.5 py-1 bg-slate-200 text-slate-700 rounded text-[12px] font-bold"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        )}

                        {item.isWeighted ? (
                          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-200/70 bg-emerald-50/40 p-2 rounded-xl border border-emerald-200/60 shadow-2xs">
                            <div className="grid grid-cols-2 gap-1.5 items-center">
                              <div className="flex items-center gap-1 bg-white border border-emerald-400 rounded-lg px-1.5 py-1 shadow-2xs">
                                <span className="text-[12px] font-bold text-emerald-950 shrink-0">كغم:</span>
                                <button
                                  type="button"
                                  onClick={() => updateItemWeight(lineKeyOf(item), Math.max(0.005, item.quantity - 0.05))}
                                  className="p-0.5 hover:bg-slate-100 text-slate-700 rounded transition cursor-pointer"
                                  title="إنقاص 50 غرام"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  step="0.005"
                                  min="0.001"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) updateItemWeight(lineKeyOf(item), val);
                                  }}
                                  className="w-full text-center text-[14px] font-black focus:outline-none font-mono bg-transparent"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateItemWeight(lineKeyOf(item), item.quantity + 0.05)}
                                  className="p-0.5 hover:bg-slate-100 text-slate-700 rounded transition cursor-pointer"
                                  title="زيادة 50 غرام"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              <div className="flex items-center gap-1 bg-white border border-amber-400 rounded-lg px-2 py-1 shadow-2xs">
                                <span className="text-[12px] font-bold text-amber-950 shrink-0">غرام:</span>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.weightGrams ?? Math.round(item.quantity * 1000)}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) updateItemWeightInGrams(lineKeyOf(item), val);
                                  }}
                                  placeholder="350"
                                  className="w-full text-center text-[14px] font-black focus:outline-none font-mono bg-transparent text-amber-950"
                                />
                                <span className="text-[11px] font-bold text-amber-700">g</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <div className="flex items-center gap-1 bg-white border border-blue-400 rounded-lg px-2 py-0.5 shadow-2xs" title="حدد المبلغ المطلوب وسيحسب النظام الوزن بدقة">
                                <span className="text-[12px] font-black text-blue-950 shrink-0">بيع بمبلغ:</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="250"
                                  value={item.total}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) updateItemByTargetAmount(lineKeyOf(item), val);
                                  }}
                                  className="w-16 text-center text-[14px] font-black text-blue-900 focus:outline-none font-mono bg-transparent"
                                />
                                <span className="text-[11px] font-bold text-blue-700">{settings.currency || 'د.ع'}</span>
                              </div>

                              <div className="flex items-center gap-0.5 flex-wrap">
                                {[
                                  { label: '250g', kg: 0.25 },
                                  { label: '350g', kg: 0.35 },
                                  { label: '500g', kg: 0.5 },
                                  { label: '750g', kg: 0.75 },
                                  { label: '1kg', kg: 1.0 },
                                ].map((chip) => (
                                  <button
                                    key={chip.label}
                                    type="button"
                                    onClick={() => updateItemWeight(lineKeyOf(item), chip.kg)}
                                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                                      Math.abs(item.quantity - chip.kg) < 0.001
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-300'
                                    }`}
                                  >
                                    {chip.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[12px] text-slate-600 pt-0.5 px-0.5">
                              <span className="flex items-center gap-1 font-mono text-[12px]">
                                <span className="font-bold text-slate-800">{item.quantity} كغم</span>
                                <span className="text-slate-400">({item.weightGrams ?? Math.round(item.quantity * 1000)}g)</span>
                                <span>×</span>
                                <span className="font-bold text-slate-700">{formatMoney(item.unitPrice)}</span>
                              </span>
                              <span className="font-black text-slate-900 font-mono text-xs text-emerald-800">
                                = {formatMoney(item.total)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-0.5 border-t border-slate-200/60 text-[13px]">
                            <div className="flex items-center gap-1">
                              <div className="flex items-center bg-white border border-slate-300 rounded overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(lineKeyOf(item), item.quantity - 1)}
                                  className="p-1 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const parsed = parseFloat(e.target.value);
                                    if (!isNaN(parsed)) updateQuantity(lineKeyOf(item), parsed);
                                  }}
                                  className="w-12 text-center text-[14px] font-bold py-0 border-x border-slate-200 focus:outline-none font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(lineKeyOf(item), item.quantity + 1)}
                                  className="p-1 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              <span className="text-[12px] font-bold text-slate-600">
                                {isDozenLine ? (item.packLabel || 'درزن') : isCarton ? 'كرتون' : item.unit || 'قطعة'}
                              </span>
                            </div>

                            <div className="text-right flex items-center gap-1 text-[13px]">
                              <span className="font-mono text-slate-600 flex items-center gap-1">
                                <span>{formatMoney(item.unitPrice)} × {item.quantity} =</span>
                              </span>
                              <span className="font-black text-slate-900 font-mono text-xs">
                                {formatMoney(item.total)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-2 sm:p-2.5 bg-slate-50 border-t border-slate-200 flex flex-col gap-1.5 shrink-0 text-right">
                {promoResult.notes.length > 0 && (
                  <div className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-2 py-1 text-[11px] text-fuchsia-900 space-y-0.5">
                    <div className="font-black">🏷️ عروض وخصومات مطبقة</div>
                    {promoResult.notes.map((n, i) => (
                      <div key={i} className="font-semibold leading-snug">• {n}</div>
                    ))}
                  </div>
                )}
                <div className="space-y-1 text-[11px] text-slate-700">
                  {cartItems.length > 0 && (
                    <div className="rounded-lg border border-slate-300 bg-white px-2 py-1 flex items-center gap-1.5 text-[11px]" data-testid="cart-discount-row">
                      <Percent className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span className="font-bold text-slate-700 shrink-0">خصم القائمة:</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={discountRaw || ''}
                        placeholder="0"
                        data-testid="cart-discount-input"
                        onChange={(e) => { setDiscountRaw(parseFloat(e.target.value) || 0); setDiscTyping(true); }}
                        onBlur={() => setTimeout(() => setDiscTyping(false), 150)}
                        className="w-full min-w-0 text-left px-1.5 py-0.5 text-[11px] font-bold border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-rose-400"
                      />
                      <div className="flex shrink-0 rounded overflow-hidden border border-slate-300 text-[10px] font-black">
                        <button
                          type="button"
                          onClick={() => discountMode !== 'amount' && setDiscountMode('amount')}
                          className={`px-1.5 py-0.5 cursor-pointer ${discountMode === 'amount' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600'}`}
                        >مبلغ</button>
                        <button
                          type="button"
                          onClick={() => discountMode !== 'percent' && setDiscountMode('percent')}
                          className={`px-1.5 py-0.5 cursor-pointer ${discountMode === 'percent' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600'}`}
                        >%</button>
                      </div>
                    </div>
                  )}
                  {helperOn && discTyping && discountRaw > 0 && (
                    <div className="flex gap-1.5" data-testid="discount-suggestions">
                      {discountRaw <= 100 && (
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); updateActiveDraft({ discountMode: 'percent', discount: discountRaw }); setDiscTyping(false); }} className="flex-1 px-2 py-1 rounded border border-rose-300 bg-rose-50 text-rose-800 text-[11px] font-black cursor-pointer">{discountRaw}% (≈ {formatMoney(Math.round(subtotal * discountRaw / 100))})</button>
                      )}
                      <button type="button" onMouseDown={(e) => { e.preventDefault(); updateActiveDraft({ discountMode: 'amount', discount: discountRaw }); setDiscTyping(false); }} className="flex-1 px-2 py-1 rounded border border-rose-300 bg-rose-50 text-rose-800 text-[11px] font-black cursor-pointer">{formatMoney(discountRaw)} مبلغ ثابت</button>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center text-[11px] font-bold text-rose-700">
                      <span>المجموع قبل الخصم: <span className="font-mono text-slate-600">{formatMoney(subtotal)}</span></span>
                      <span>الخصم: <span className="font-mono">- {formatMoney(discountAmount)}</span></span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs sm:text-sm font-black text-slate-900">
                    <span>المبلغ المطلوب:</span>
                    <span className="text-emerald-700 font-mono">{formatMoney(finalTotal)}</span>
                  </div>

                  {/* إخفاء صافي الربح عند عدم وجود الصلاحية */}
                  {canViewCost && (
                    <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded flex justify-between font-medium">
                      <span>صافي الربح التقديري:</span>
                      <span className="font-bold font-mono">{formatMoney(estimatedProfit)}</span>
                    </div>
                  )}
                </div>

                {settings.quickCreditButton === true && (
                  <select
                    data-testid="quick-customer-bar"
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full text-[11px] bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- الزبون (اختياري) --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.totalDebt > 0 ? ` · دين: ${formatMoney(c.totalDebt)}` : ''}</option>
                    ))}
                  </select>
                )}
                {settings.quickCreditButton !== true && (
<div className={`p-1.5 rounded-lg border text-[11px] flex flex-col gap-1 transition ${
                  saleType === 'credit'
                    ? 'bg-amber-50/80 border-amber-300'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1 text-[10px]">
                      <UserCheck className="w-3 h-3 text-slate-600" />
                      <span>{saleType === 'credit' ? 'زبون آجل (إلزامي):' : 'الزبون (اختياري):'}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenQuickAddCustomer(customCustomerName.trim() || undefined)}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer"
                      title="اقتراح إضافة زبون جديد واعتماده"
                    >
                      + زبون جديد
                    </button>
                  </div>

                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full text-[11px] bg-white border border-slate-300 rounded px-1.5 py-1 font-bold focus:outline-none"
                  >
                    <option value="">
                      {saleType === 'credit'
                        ? '-- اضغط لاختيار الزبون المسجل --'
                        : '-- زبون نقدي مباشر --'}
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} {c.totalDebt > 0 ? `· دين: ${formatMoney(c.totalDebt)}` : ''}
                      </option>
                    ))}
                  </select>

                  {saleType === 'credit' && !selectedCustomerId && (
                    <div className="text-[10px] text-amber-900 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                      ⚠️ يجب اختيار زبون مسجل مسبقاً لحفظ الفاتورة بالدين
                    </div>
                  )}

                  {selectedCustomer && (
                    <div className="text-[10px] flex items-center justify-between text-slate-600 pt-0.5 border-t border-slate-100">
                      <span>الدين السابق: <strong className={selectedCustomer.totalDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}>{formatMoney(selectedCustomer.totalDebt)}</strong></span>
                      {saleType === 'credit' && (remainingDebt > 0 || extraPaid > 0) && (
                        <span>الدين الجديد: <strong className="text-rose-800 font-bold">{formatMoney(newCustomerDebt)}</strong></span>
                      )}
                    </div>
                  )}

                  {saleType === 'credit' && (
                    <div className="grid grid-cols-2 gap-1 pt-1 border-t border-amber-200/70 text-[10px]">
                      <div className="flex items-center gap-1">
                        <span>المسدد:</span>
                        <input
                          type="number"
                          min="0"
                          value={paidAmount || ''}
                          placeholder="0"
                          onChange={(e) => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full text-left px-1 py-0.5 text-[11px] font-bold border border-amber-300 rounded bg-white"
                        />
                      </div>
                      <div className="flex items-center justify-between font-bold text-rose-700">
                        {extraPaid > 0 ? (<><span className="text-emerald-700">زيادة تُخصم من الدين:</span><span className="font-mono text-emerald-700">{formatMoney(extraPaid)}</span></>) : (<><span>الباقي:</span><span className="font-mono">{formatMoney(remainingDebt)}</span></>)}
                      </div>
                    </div>
                  )}
                </div>
)}

                <input
                  type="text"
                  placeholder="ملاحظات تظهر بالوصل (اختياري)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-[11px] px-2 py-1 border border-slate-300 rounded-lg bg-white focus:outline-none"
                />
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer select-none -mt-1">
                  <input type="checkbox" data-testid="special-note-toggle" checked={specialNoteOn} onChange={(e) => updateActiveDraft({ specialNoteOn: e.target.checked })} className="w-3 h-3 accent-amber-600" />
                  <span>تفعيل ملاحظة خاصة بهذا الوصل</span>
                </label>
                {specialNoteOn && (
                  <input
                    type="text"
                    data-testid="special-note-input"
                    placeholder="ملاحظة خاصة: تُطبع بدل الملاحظة الافتراضية (اتركها فارغة لتظهر الافتراضية)"
                    value={specialNote}
                    onChange={(e) => updateActiveDraft({ specialNote: e.target.value })}
                    className="text-[11px] px-2 py-1 border border-amber-300 rounded-lg bg-amber-50 focus:outline-none"
                  />
                )}

                {settings.enableSalesReps && (
                  <div className="p-2 rounded-lg border bg-indigo-50/70 border-indigo-200 text-[11px] flex flex-col gap-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-950 flex items-center gap-1 text-[10px]">
                        <Briefcase className="w-3.5 h-3.5 text-indigo-700" />
                        <span>مندوب البيع:</span>
                      </span>

                      {selectedSalesRepId && (
                        <label className="flex items-center gap-1 text-[10px] text-indigo-900 cursor-pointer select-none font-bold">
                          <input
                            type="checkbox"
                            checked={showRepOnInvoice}
                            onChange={(e) => setShowRepOnInvoice(e.target.checked)}
                            className="w-3 h-3 text-indigo-600 rounded accent-indigo-600"
                          />
                          <span>إظهار اسمه بالوصل</span>
                        </label>
                      )}
                    </div>

                    <select
                      value={selectedSalesRepId}
                      onChange={(e) => setSelectedSalesRepId(e.target.value)}
                      className="w-full text-[11px] bg-white border border-indigo-300 rounded px-1.5 py-1 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- بيع مباشر (بدون مندوب) --</option>
                      {(settings.salesReps || []).filter(r => r.isActive !== false).map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.commissionRate}% {r.commissionType === 'percentage_sales' ? 'مبيعات' : 'أرباح'})
                        </option>
                      ))}
                    </select>

                    {selectedRepObj && canViewCost && (
                      <div className="text-[10px] bg-white/90 p-1.5 rounded border border-indigo-200 flex items-center justify-between font-bold text-indigo-950">
                        <span>ربح المندوب: <span className="font-mono text-indigo-700">{formatMoney(estimatedRepCommission)}</span></span>
                        <span>ربح المالك: <span className="font-mono text-emerald-700">{formatMoney(estimatedStoreProfit)}</span></span>
                      </div>
                    )}
                  </div>
                )}

                {cartErrorNotice && (
                  <div className="bg-rose-50 border border-rose-300 text-rose-800 px-2 py-1 rounded text-[10px] font-bold flex items-center justify-between">
                    <span>{cartErrorNotice}</span>
                    <button type="button" onClick={() => setCartErrorNotice(null)}>×</button>
                  </div>
                )}

                {settings.enableChangeCalculator !== false && cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={openChangeCalc}
                    className="py-1.5 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition cursor-pointer"
                    title="حاسبة الباقي: اختر فئات النقود المستلمة لمعرفة الباقي"
                  >
                    <span>💵 حاسبة الباقي</span>
                    <span className="hidden sm:inline-block px-1 py-0.2 text-[9px] bg-black/10 rounded font-mono font-bold">F5</span>
                  </button>
                )}

                {settings.quickCreditButton === true ? (
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5" data-testid="two-sale-buttons">
                    <button
                      type="button"
                      data-testid="quick-cash"
                      disabled={cartItems.length === 0}
                      onClick={quickCashSale}
                      className="py-3 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                      title={(settings as any).cashSaleAction === 'save' ? 'بيع نقداً مع حفظ القائمة فقط' : 'بيع نقداً مع حفظ وطباعة القائمة'}
                    >
                      {(settings as any).cashSaleAction === 'save' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Printer className="w-4 h-4 shrink-0" />}
                      <span>💵 نقد</span>
                      {quickKeyHint('cash') && <span className="hidden sm:inline-block px-1 text-[9px] bg-black/15 rounded font-mono font-bold">{quickKeyHint('cash')}</span>}
                    </button>
                    <button
                      type="button"
                      data-testid="quick-credit"
                      disabled={cartItems.length === 0}
                      onClick={() => { setCreditSearch(''); setCreditPickOpen(true); }}
                      className="py-3 px-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                      title="اختر زبوناً وتُحفظ القائمة عليه ديناً آجلاً"
                    >
                      <span>🧾 دين آجل</span>
                      {quickKeyHint('credit') && <span className="hidden sm:inline-block px-1 text-[9px] bg-black/15 rounded font-mono font-bold">{quickKeyHint('credit')}</span>}
                    </button>
                  </div>
                ) : (
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    disabled={cartItems.length === 0 || (saleType === 'credit' && !selectedCustomerId)}
                    onClick={() => handleSaveInvoice(true)}
                    className={`py-2 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer ${
                      sessionRole === 'employee' && !activeShift 
                        ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400' 
                        : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white'
                    }`}
                    title={`حفظ وطباعة القائمة (اضغط ${settings.invertEnterShortcuts ? "Ctrl + Enter" : "Enter"})`}
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" />
                    <span>حفظ وطباعة القائمة</span>
                    {!(kbMode && !settings.invertEnterShortcuts) && (
                      <span className="hidden sm:inline-block px-1 py-0.2 text-[9px] bg-black/20 rounded font-mono font-bold">
                        {settings.invertEnterShortcuts ? 'Ctrl+Enter' : 'Enter ↵'}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={cartItems.length === 0 || (saleType === 'credit' && !selectedCustomerId)}
                    onClick={() => handleSaveInvoice(false)}
                    className="py-2 px-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title={`حفظ القائمة فقط دون طباعة (اضغط ${settings.invertEnterShortcuts ? "Enter" : "Ctrl + Enter"})`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>حفظ فقط</span>
                    {!(kbMode && settings.invertEnterShortcuts) && (
                      <span className="hidden sm:inline-block px-1 py-0.2 text-[9px] bg-white/20 text-slate-200 rounded font-mono font-bold">
                        {settings.invertEnterShortcuts ? 'Enter ↵' : 'Ctrl+Enter'}
                      </span>
                    )}
                  </button>
                </div>
                )}

                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[10px] text-slate-400 hover:text-rose-600 text-center transition py-0.2 cursor-pointer"
                  >
                    تفريغ القائمة وإلغاء المواد
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showChangeCalc && (
        <ChangeCalculatorModal
          total={finalTotal}
          formatMoney={formatMoney}
          canSave={cartItems.length > 0 && !(saleType === 'credit' && !selectedCustomerId)}
          onClose={() => setShowChangeCalc(false)}
          onSave={(print) => {
            setShowChangeCalc(false);
            handleSaveInvoice(print);
          }}
        />
      )}

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title="ماسح باركود نقطة البيع (POS)"
      />

      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-right" dir="rtl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">إضافة زبون جديد لسجل الديون</h3>
                  <p className="text-[11px] text-slate-500">لا يمكن البيع بالآجل إلا لزبون معتمد ومسجل مسبقاً</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCustomer} className="p-4 space-y-3">
              {quickCustomerError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{quickCustomerError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الزبون الكامل <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="مثال: علي محمد حسن"
                  value={quickCustomerName}
                  onChange={(e) => setQuickCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="tel"
                    placeholder="0770..."
                    value={quickCustomerPhone}
                    onChange={(e) => setQuickCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    العنوان / المنطقة (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: الكرادة، بغداد"
                    value={quickCustomerAddress}
                    onChange={(e) => setQuickCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رصيد دين سابق إن وجد (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={quickCustomerInitialDebt}
                    onChange={(e) => setQuickCustomerInitialDebt(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {settings.currency || 'دينار'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>حفظ واعتماد الزبون للبيع الآجل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {unfoundBarcodePrompt && settings.unfoundBarcodeInline !== true && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-right" dir="rtl">
            <div className="p-4 border-b border-amber-200 bg-amber-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
                  <Scan className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950">مادة غير مسجلة في المخزن</h3>
                  <p className="text-[11px] text-amber-800">تمت قراءة الرمز الشريطي بواسطة الماسح</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnfoundBarcodePrompt(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-amber-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 font-bold mb-1">الرمز الشريطي (الباركود) المقروء:</div>
                <div className="text-lg font-black font-mono text-slate-900 tracking-wider">
                  #{unfoundBarcodePrompt}
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                تمت قراءة هذا الرمز الشريطي بنجاح، ولكنه غير موجود ضمن المواد المخزنة حالياً.
                <br />
                <strong className="text-emerald-800">هل ترغب في إضافة هذه المادة الجديدة إلى المخزن الآن واعتماد هذا الرمز لها؟</strong>
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUnfoundBarcodePrompt(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const scanned = unfoundBarcodePrompt;
                    setUnfoundBarcodePrompt(null);
                    onOpenNewProduct(scanned);
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ إضافة المادة للمخزن الآن</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {productForPriceEdit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-right" dir="rtl">
            <div className="p-4 border-b border-blue-100 bg-blue-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تعديل سعر المادة</h3>
                  <p className="text-[11px] text-blue-700 font-medium">
                    #{productForPriceEdit.code} · {productForPriceEdit.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProductForPriceEdit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-blue-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePriceEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  سعر بيع المفرد ({settings.currency}) <span className="text-emerald-600 font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editRetailPrice}
                    onChange={(e) => setEditRetailPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {settings.currency}
                  </span>
                </div>
              </div>

              {priceTypeOn('wholesale') && (
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  سعر بيع الجملة ({settings.currency})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editWholesalePrice}
                    onChange={(e) => setEditWholesalePrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {settings.currency}
                  </span>
                </div>
              </div>
              )}

              {priceTypeOn('superWholesale') && settings.showSuperWholesale !== false && (
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  جملة الجملة ({settings.currency}) <span className="text-slate-400 font-medium">(اختياري)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editSuperWholesalePrice}
                    onChange={(e) => setEditSuperWholesalePrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {settings.currency}
                  </span>
                </div>
              </div>
              )}

              {priceTypeOn('special') && settings.showSpecialPrice !== false && (
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  السعر الخاص ({settings.currency}) <span className="text-slate-400 font-medium">(اختياري)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editSpecialPrice}
                    onChange={(e) => setEditSpecialPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {settings.currency}
                  </span>
                </div>
              </div>
              )}

              {canViewCost && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    سعر الشراء / التكلفة ({settings.currency})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editCostPrice}
                      onChange={(e) => setEditCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                      className="w-full pl-12 pr-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {settings.currency}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  سعة الكرتون الواحد (كم قطعة بالكرتون):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={editPiecesPerCarton}
                    onChange={(e) => setEditPiecesPerCarton(e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg bg-white"
                  />
                  <span className="text-xs text-slate-500 font-semibold">قطعة لكل كرتون</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {onEditProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      const prod = productForPriceEdit;
                      setProductForPriceEdit(null);
                      onEditProduct(prod);
                    }}
                    className="text-xs text-blue-700 hover:text-blue-900 underline font-semibold cursor-pointer"
                  >
                    تعديل كامل بيانات المادة
                  </button>
                )}
                <div className="flex items-center gap-2 mr-auto">
                  <button
                    type="button"
                    onClick={() => setProductForPriceEdit(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ السعر</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClearConfirmModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  تأكيد مسح وتفريغ القائمة رقم {activeDraft.orderNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  حذف المواد المدخلة وإلغاء هذه القائمة
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-rose-50 border border-rose-100 rounded-xl p-3 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف وتفريغ القائمة الحالية؟ سيتم مسح المواد المدخلة ({cartItems.length} مواد) نهائياً من هذه المسودة.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCurrentDraft();
                  setShowClearConfirmModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>نعم، حذف وتفريغ القائمة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isSelectRepModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    تحديد المندوب لإتمام القائمة
                  </h3>
                  <p className="text-xs text-slate-500">
                    اختر المندوب الذي تمت هذه العملية بواسطته لتسجيل أرباحه وعمولته
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSelectRepModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedSalesRepId('');
                  executeFinalizeInvoice('', pendingPrintAfterRepSelect);
                }}
                className="w-full text-right p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800 group-hover:text-slate-900">
                    بيع مباشر للمحل (بدون مندوب)
                  </div>
                  <div className="text-[10px] text-slate-500">
                    تحسب كامل الأرباح للمتجر بدون استقطاع عمولة
                  </div>
                </div>
                {canViewCost && (
                  <div className="text-xs font-mono font-black text-emerald-700">
                    ربح المالك: {formatMoney(estimatedProfit)}
                  </div>
                )}
              </button>

              {(settings.salesReps || []).filter(r => r.isActive !== false).map((r) => {
                const repType = r.commissionType || settings.repCommissionDefaultType || 'percentage_profit';
                const repComm = repType === 'percentage_sales'
                  ? Math.round((finalTotal * (r.commissionRate || 0)) / 100)
                  : Math.round(Math.max(0, (estimatedProfit * (r.commissionRate || 0)) / 100));
                const storeProfit = Math.max(0, estimatedProfit - repComm);

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedSalesRepId(r.id);
                      executeFinalizeInvoice(r.id, pendingPrintAfterRepSelect);
                    }}
                    className="w-full text-right p-3 rounded-xl border border-indigo-100 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50 transition flex items-center justify-between cursor-pointer group"
                  >
                    <div>
                      <div className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                        <span>{r.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                          نسبة {r.commissionRate}%
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {r.phone ? `هاتف: ${r.phone} · ` : ''}{repType === 'percentage_sales' ? 'من المبيعات' : 'من صافي الربح'}
                      </div>
                    </div>

                    {canViewCost && (
                      <div className="text-left font-mono text-[11px]">
                        <div className="text-indigo-700 font-bold">
                          عمولة: {formatMoney(repComm)}
                        </div>
                        <div className="text-emerald-700 text-[10px] font-semibold">
                          للمالك: {formatMoney(storeProfit)}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsSelectRepModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                إلغاء التراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {tbMenu && (
        <div className="fixed inset-0 z-[90]" data-key-passthrough onClick={() => setTbMenu(null)} onContextMenu={(e) => { e.preventDefault(); setTbMenu(null); }}>
          <div className="absolute bg-white border border-slate-300 rounded-xl shadow-2xl py-1 min-w-[170px] text-right" dir="rtl"
            style={{ top: Math.min(tbMenu.y, window.innerHeight - 90), left: Math.min(tbMenu.x, window.innerWidth - 190) }} onClick={(e) => e.stopPropagation()}>
            <button type="button" data-testid="tb-change" onClick={() => { setTbMenu(null); setTbEdit(true); }}
              className="w-full text-right px-3 py-2 text-xs font-bold text-slate-800 hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2 cursor-pointer">
              <span>↔</span><span>تغيير ترتيب الشريط</span>
            </button>
          </div>
        </div>
      )}

      {giftMenu && (
        <div
          className="fixed inset-0 z-[90]" data-key-passthrough
          onClick={() => setGiftMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setGiftMenu(null);
          }}
        >
          <div
            className="absolute bg-white border border-slate-300 rounded-xl shadow-2xl py-1 min-w-[190px] text-right"
            style={{
              top: Math.min(giftMenu.y, window.innerHeight - 170),
              left: Math.min(giftMenu.x, window.innerWidth - 210),
            }}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 truncate max-w-[220px]">
              {giftMenu.product.name}
            </div>
            <button
              type="button"
              onClick={() => {
                addGiftToCart(giftMenu.product);
                setGiftMenu(null);
              }}
              className="w-full text-right px-3 py-2 text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 transition flex items-center gap-2"
            >
              <span>🎁</span>
              <span>إضافة إلى القائمة كهدية (0 {settings.currency})</span>
            </button>
            {onEditProduct && (
              <button
                type="button"
                data-testid="ctx-edit-product"
                onClick={() => { const pr = giftMenu.product; setGiftMenu(null); onEditProduct(pr); }}
                className="w-full text-right px-3 py-2 text-xs font-bold text-slate-800 hover:bg-amber-50 hover:text-amber-800 transition flex items-center gap-2"
              >
                <span>✏️</span>
                <span>تعديل المادة</span>
              </button>
            )}
            <button
              type="button"
              data-testid="ctx-edit-price"
              onClick={() => { const pr = giftMenu.product; setGiftMenu(null); handleOpenPriceEdit(pr); }}
              className="w-full text-right px-3 py-2 text-xs font-bold text-slate-800 hover:bg-sky-50 hover:text-sky-800 transition flex items-center gap-2"
            >
              <span>🏷️</span>
              <span>تعديل أسعار المادة</span>
            </button>
          </div>
        </div>
      )}
      {isReturnOpen && <ReturnItemsModal onClose={() => setIsReturnOpen(false)} />}

      {scanChoice && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-3" dir="rtl" data-testid="scan-choice" onClick={() => setScanChoice(null)}>
          <div className="bg-white dark:bg-[#0b1728] rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800">
              <div className="text-sm font-black text-amber-900 dark:text-amber-200">الباركود <span className="font-mono">{scanChoice.code}</span> لأكثر من مادة</div>
              <div className="text-[11px] text-amber-800 dark:text-amber-300">اختر المادة المقصودة لإضافتها للقائمة</div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {scanChoice.items.map((it) => (
                <button key={it.id} type="button" data-testid="scan-choice-item"
                  onClick={() => {
                    setScanChoice(null);
                    const usedUnit = addWithDefaultUnit(it, 'scan');
                    setScanNotice(`تمت إضافة "${it.name}" (+1${usedUnit ? ' ' + usedUnit : ''})`);
                    setTimeout(() => setScanNotice(null), 3000);
                  }}
                  className="w-full text-right px-4 py-3 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{it.name}</span>
                  <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 shrink-0">{formatMoney(it.retailPrice)}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setScanChoice(null)} className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer">إلغاء</button>
          </div>
        </div>
      )}

      {creditPickOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3" data-testid="credit-pick" onClick={() => setCreditPickOpen(false)}>
          <div className="bg-white dark:bg-[#0b1728] rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-black text-slate-800 dark:text-white">🧾 دين آجل — اختر الزبون</div>
                <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600" data-testid="debtors-view-switch">
                  {([['cards', '▦ مربعات'], ['list', '☰ قائمة'], ['strip', '⋯ شريط']] as const).map(([v, l]) => (
                    <button key={v} type="button" data-testid={`view-${v}`} onClick={() => setDebtorsView(v)}
                      className={`px-2 py-1 text-[10px] font-bold cursor-pointer ${debtorsView === v ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}>{l}</button>
                  ))}
                </div>
              </div>
              <input
                autoFocus
                data-testid="credit-search"
                value={creditSearch}
                onChange={(e) => setCreditSearch(e.target.value)}
                placeholder="ابحث باسم الزبون أو رقم هاتفه..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#070e1b] text-slate-900 dark:text-white"
              />
            </div>
            <div className={`overflow-y-auto p-2 ${debtorsView === 'cards' ? 'grid grid-cols-2 gap-2' : debtorsView === 'strip' ? 'flex flex-wrap gap-1.5' : 'space-y-1.5'}`} data-testid="credit-list" data-view={debtorsView}>
              {customers
                .filter((c) => {
                  const q = creditSearch.trim().toLowerCase();
                  return !q || matchAr(c.name, q) || (c.phone || '').includes(q);
                })
                .map((c) => {
                  const debt = c.totalDebt > 0;
                  if (debtorsView === 'strip') return (
                    <button key={c.id} type="button" data-testid={`credit-cust-${c.id}`} onClick={() => pickCreditCustomer(c.id)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer ${debt ? 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/40' : 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600'} hover:ring-2 hover:ring-amber-400`}>
                      {c.name}{debt ? <span className="mr-1.5 font-mono opacity-80">{formatMoney(c.totalDebt)}</span> : null}
                    </button>
                  );
                  if (debtorsView === 'cards') return (
                    <button key={c.id} type="button" data-testid={`credit-cust-${c.id}`} onClick={() => pickCreditCustomer(c.id)}
                      className="text-right flex flex-col gap-1 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-400 cursor-pointer">
                      <span className="text-sm font-black text-slate-800 dark:text-white truncate">{c.name}</span>
                      {c.phone && <span className="text-[10px] text-slate-500 dark:text-slate-400" dir="ltr">{c.phone}</span>}
                      <span className={`text-xs font-black ${debt ? 'text-rose-600' : 'text-emerald-600'}`}>{debt ? `دين: ${formatMoney(c.totalDebt)}` : 'بلا دين'}</span>
                    </button>
                  );
                  return (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`credit-cust-${c.id}`}
                    onClick={() => pickCreditCustomer(c.id)}
                    className="w-full text-right flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-pointer"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800 dark:text-white truncate">{c.name}</span>
                      {c.phone && <span className="block text-[11px] text-slate-500 dark:text-slate-400" dir="ltr">{c.phone}</span>}
                    </span>
                    <span className={`text-xs font-black whitespace-nowrap ${debt ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {debt ? `دين: ${formatMoney(c.totalDebt)}` : 'بلا دين'}
                    </span>
                  </button>
                  );
                })}
              {customers.length === 0 && <div className="text-center text-xs text-slate-500 py-6">لا يوجد زبائن مضافون بعد.</div>}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-700">
              <button type="button" onClick={() => setCreditPickOpen(false)} className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSView;

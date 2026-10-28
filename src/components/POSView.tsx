import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Product, SaleType, PriceType, InvoiceItem, Invoice } from '../types';
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
  Percent
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { SessionBadgeButton } from './SessionBadgeButton';

interface POSViewProps {
  onInvoiceCreated: (invoice: Invoice, andPrint: boolean) => void;
  onOpenNewProduct: (initialBarcode?: string) => void;
  onEditProduct?: (product: Product) => void;
  onOpenSettings?: () => void;
}

const playScannerBeep = (type: 'success' | 'alert' = 'success') => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'success') {
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
    completeActiveDraft
  } = useApp();

  // Active Draft Properties (محفوظة دائماً ولا تختفي عند التنقل بين أقسام التطبيق)
  const cartItems = activeDraft.cartItems || [];
  const saleType = activeDraft.saleType || 'direct';
  const globalPriceType = activeDraft.globalPriceType || 'retail';
  const selectedCustomerId = activeDraft.selectedCustomerId || '';
  const customCustomerName = activeDraft.customCustomerName || '';
  const customerPhone = activeDraft.customerPhone || '';
  const discount = activeDraft.discount || 0;
  const paidAmount = activeDraft.paidAmount || 0;
  const dueDate = activeDraft.dueDate || '';
  const notes = activeDraft.notes || '';
  const selectedSalesRepId = activeDraft.selectedSalesRepId || '';
  const showRepOnInvoice = activeDraft.showRepOnInvoice !== undefined
    ? activeDraft.showRepOnInvoice
    : (settings.defaultShowRepOnInvoice ?? true);

  // Setters linked directly to persistent draft in AppContext & localStorage
  const setCartItems = (action: InvoiceItem[] | ((prev: InvoiceItem[]) => InvoiceItem[])) => {
    if (typeof action === 'function') {
      updateActiveDraft({ cartItems: action(activeDraft.cartItems || []) });
    } else {
      updateActiveDraft({ cartItems: action });
    }
  };

  const setSaleType = (val: SaleType) => updateActiveDraft({ saleType: val });
  const setGlobalPriceType = (val: PriceType) => updateActiveDraft({ globalPriceType: val });
  const setSelectedCustomerId = (val: string) => updateActiveDraft({ selectedCustomerId: val });
  const setCustomCustomerName = (val: string) => updateActiveDraft({ customCustomerName: val });
  const setCustomerPhone = (val: string) => updateActiveDraft({ customerPhone: val });
  const setDiscount = (val: number) => updateActiveDraft({ discount: val });
  const setPaidAmount = (val: number) => updateActiveDraft({ paidAmount: val });
  const setDueDate = (val: string) => updateActiveDraft({ dueDate: val });
  const setNotes = (val: string) => updateActiveDraft({ notes: val });

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('pos_products_view_mode');
      if (saved === 'list' || saved === 'grid') return saved;
    } catch (e) {}
    return 'grid';
  });

  const handleViewModeChange = (mode: 'grid' | 'list') => {
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
  const [editCostPrice, setEditCostPrice] = useState<number | ''>('');
  const [editPiecesPerCarton, setEditPiecesPerCarton] = useState<number | ''>('');

  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [tempItemPrice, setTempItemPrice] = useState<string>('');

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [cartErrorNotice, setCartErrorNotice] = useState<string | null>(null);
  const [unfoundBarcodePrompt, setUnfoundBarcodePrompt] = useState<string | null>(null);

  const handleOpenPriceEdit = (prod: Product) => {
    setProductForPriceEdit(prod);
    setEditRetailPrice(prod.retailPrice);
    setEditWholesalePrice(prod.wholesalePrice);
    setEditCostPrice(prod.costPrice);
    setEditPiecesPerCarton(prod.piecesPerCarton || 1);
  };

  const handleSavePriceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForPriceEdit) return;

    const newRetail = typeof editRetailPrice === 'number' ? editRetailPrice : productForPriceEdit.retailPrice;
    const newWholesale = typeof editWholesalePrice === 'number' ? editWholesalePrice : productForPriceEdit.wholesalePrice;
    const newCost = typeof editCostPrice === 'number' ? editCostPrice : productForPriceEdit.costPrice;
    const newCarton = typeof editPiecesPerCarton === 'number' && editPiecesPerCarton > 0 ? editPiecesPerCarton : (productForPriceEdit.piecesPerCarton || 1);

    updateProduct(productForPriceEdit.id, {
      retailPrice: newRetail,
      wholesalePrice: newWholesale,
      costPrice: newCost,
      piecesPerCarton: newCarton,
    });

    setCartItems(prev => prev.map(item => {
      if (item.productId === productForPriceEdit.id) {
        const isWholesale = item.priceType === 'wholesale';
        const basePiece = isWholesale ? newWholesale : newRetail;
        const isCarton = item.unitType === 'carton';
        const effectiveUnit = isCarton ? basePiece * newCarton : basePiece;
        return {
          ...item,
          costPrice: newCost,
          piecesPerCarton: newCarton,
          unitPrice: effectiveUnit,
          deductedPieces: isCarton ? item.quantity * newCarton : item.quantity,
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
    if (editingPriceProductId === item.productId) {
      setEditingPriceProductId(null);
      setTempItemPrice('');
    } else {
      setEditingPriceProductId(item.productId);
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
        if (item.productId === productId) {
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

  const handleResetCartItemPrice = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const cartonCap = item.piecesPerCarton || prod.piecesPerCarton || 1;
          const isCarton = item.unitType === 'carton';
          const basePiece = item.priceType === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
          const defaultUnitPrice = isCarton ? basePiece * cartonCap : basePiece;
          return {
            ...item,
            unitPrice: defaultUnitPrice,
            total: item.quantity * defaultUnitPrice,
            isCustomPrice: false,
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

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchCat = selectedCategory === 'all' || prod.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        prod.name.toLowerCase().includes(q) ||
        prod.code.toLowerCase().includes(q) ||
        prod.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // تقييد العرض المبدئي لبطاقات المواد لتسريع الشاشة ومنع التهنيج
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

  const addToCartWithPrice = (product: Product, priceType: PriceType, delta = 1) => {
    const isWeighted = Boolean(product.isWeighted || product.unit === 'كغم' || product.unit === 'كيلو');
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      const piecePrice = priceType === 'wholesale' ? product.wholesalePrice : product.retailPrice;

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

  const handleBarcodeScanned = (scannedCode: string) => {
    const clean = scannedCode.trim();
    if (!clean) return;

    const matched = products.find((p) => p.code.toLowerCase() === clean.toLowerCase())
      || products.find((p) => p.code === clean);

    if (matched) {
      playScannerBeep('success');
      addToCartWithPrice(matched, globalPriceType, 1);
      setSearchQuery('');
      setUnfoundBarcodePrompt(null);
      setScanNotice(`تم مسح الباركود #${clean}: زيادة كمية "${matched.name}" في القائمة (+1)`);
      setTimeout(() => setScanNotice(null), 3000);
    } else {
      playScannerBeep('alert');
      setSearchQuery('');
      setUnfoundBarcodePrompt(clean);
      setScanNotice(`الرمز الشريطي #${clean} غير مسجل في المخزن`);
      setTimeout(() => setScanNotice(null), 5000);
    }
  };

  const handleBarcodeScannedRef = useRef(handleBarcodeScanned);
  useEffect(() => {
    handleBarcodeScannedRef.current = handleBarcodeScanned;
  });

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (showQuickAddModal || isScannerOpen || !!unfoundBarcodePrompt) return;

      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      const now = Date.now();
      const diff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 2) {
          e.preventDefault();
          const scanned = buffer.trim();
          buffer = '';
          handleBarcodeScannedRef.current(scanned);
        }
        return;
      }

      if (e.key.length === 1) {
        if (diff > 120 && buffer.length > 0) {
          buffer = '';
        }
        if (!isInput || diff < 50) {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showQuickAddModal, isScannerOpen, unfoundBarcodePrompt]);

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const cleanQty = Math.round(newQty * 1000) / 1000;
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
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
        if (item.productId === productId && item.isWeighted) {
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

  const toggleItemUnitType = (productId: string, newUnitType: 'piece' | 'carton') => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const cartonCapacity = Math.max(1, prod.piecesPerCarton || 1);

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const piecePrice = item.priceType === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
          const pieceCost = prod.costPrice;
          const isCarton = newUnitType === 'carton';
          const effectiveUnitPrice = isCarton ? piecePrice * cartonCapacity : piecePrice;
          const effectiveCostPrice = isCarton ? pieceCost * cartonCapacity : pieceCost;
          const deductedPieces = isCarton ? item.quantity * cartonCapacity : item.quantity;
          const total = item.quantity * effectiveUnitPrice;

          return {
            ...item,
            unitType: newUnitType,
            piecesPerCarton: cartonCapacity,
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

  const toggleItemPriceType = (productId: string, newPriceType: PriceType) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const cartonCap = item.piecesPerCarton || prod.piecesPerCarton || 1;
          const isCarton = item.unitType === 'carton';
          const basePiecePrice = newPriceType === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
          const newUnitPrice = isCarton ? basePiecePrice * cartonCap : basePiecePrice;

          return {
            ...item,
            priceType: newPriceType,
            unitPrice: newUnitPrice,
            total: item.quantity * newUnitPrice,
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
        const prod = products.find((p) => p.id === item.productId);
        if (!prod) return item;
        const newUnitPrice = type === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
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
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    clearCurrentDraft();
  };

  const handleAddNewDraft = () => {
    addNewDraft();
    if (isMobileMode) {
      setMobileTab('products');
    }
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.total, 0);
  }, [cartItems]);

  const totalCost = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
  }, [cartItems]);

  const finalTotal = Math.max(0, subtotal - discount);
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
  const previousCustomerDebt = selectedCustomer ? selectedCustomer.totalDebt : 0;
  const newCustomerDebt = previousCustomerDebt + remainingDebt;

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
      items: cartItems,
      discount: discount,
      paidAmount: actualPaidAmount,
      paymentDueDate: saleType === 'credit' ? dueDate : undefined,
      notes: notes.trim(),
      salesRepId: effectiveRepId || undefined,
      salesRepName: repObj?.name || undefined,
      showRepOnInvoice: showRepOnInvoice,
    });

    setIsSelectRepModalOpen(false);
    completeActiveDraft();
    onInvoiceCreated(created, andPrint);
  };

  const handleSaveInvoice = (andPrint: boolean) => {
    // شرط الرقابة: منع البيع في جلسة الموظف بدون شفت نشط
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

    // إذا كانت ميزة المندوبين مفعلة وهناك مندوبين مسجلين ولم يتم اختيار المندوب بعد، يتم فتح نافذة اختيار المندوب قبل الطباعة
    if (settings.enableSalesReps && (settings.salesReps && settings.salesReps.length > 0) && !selectedSalesRepId) {
      setPendingPrintAfterRepSelect(andPrint);
      setIsSelectRepModalOpen(true);
      return;
    }

    executeFinalizeInvoice(selectedSalesRepId, andPrint);
  };

  const isMobileMode = settings.deviceMode === 'mobile';

  return (
    <div className="flex flex-col gap-4">
      {/* تنبيه قفل البيع في جلسة الموظف بدون شفت نشط */}
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

      <div className={isMobileMode ? 'flex flex-col gap-4' : 'grid grid-cols-12 gap-3 lg:gap-4'}>
        {(!isMobileMode || mobileTab === 'products') && (
          <div className={`${isMobileMode ? 'w-full' : (viewMode === 'grid' ? 'col-span-12 lg:col-span-8 xl:col-span-8 2xl:col-span-9' : 'col-span-12 lg:col-span-7')} flex flex-col gap-3 min-w-0`}>
            <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2.5">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        e.preventDefault();
                        handleBarcodeScanned(searchQuery.trim());
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

                {/* Windows Explorer Style View Switcher: مربعات أو قائمة */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
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
                </div>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                  title="مسح باركود المادة بالكاميرا لإضافتها للسلة فوراً"
                >
                  <Scan className="w-4 h-4" />
                  <span className="hidden md:inline">مسح باركود</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenNewProduct()}
                  className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                  title="إضافة مادة جديدة للمخزن مباشرة دون مغادرة الشاشة"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span className="hidden md:inline">مادة جديدة</span>
                </button>
              </div>

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
              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-xl border border-slate-200 p-6">
                  <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">لا توجد مواد تطابق البحث</p>
                  <p className="text-xs text-slate-400 mt-1">تأكد من كتابة الاسم بدقة</p>
                </div>
              ) : viewMode === 'grid' ? (
                /* وضع المربعات المصغرة مثل مستعرض ويندوز: يظهر فقط السعر واسم المادة */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                  {visibleProducts.map((prod) => {
                    const isOutOfStock = prod.stock <= 0;
                    const effectivePrice = globalPriceType === 'wholesale' && settings.enableWholesale 
                      ? prod.wholesalePrice 
                      : prod.retailPrice;

                    return (
                      <div
                        key={prod.id}
                        onClick={() => addToCart(prod)}
                        title={
                          prod.isWeighted
                            ? `${prod.name} (يباع بالوزن - سعر الكيلو ${formatMoney(effectivePrice)})`
                            : `${prod.name} - ${formatMoney(effectivePrice)}`
                        }
                        className={`group bg-white hover:bg-emerald-50/40 border rounded-xl p-2.5 flex flex-col justify-between transition-all duration-150 select-none cursor-pointer active:scale-97 relative shadow-2xs hover:shadow-xs min-h-[82px] text-right ${
                          isOutOfStock
                            ? 'border-rose-300 bg-rose-50/20 hover:border-rose-400'
                            : 'border-slate-200 hover:border-emerald-500'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
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
                            {formatMoney(effectivePrice)}
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
                /* وضع القائمة التفصيلية */
                <div className="flex flex-col gap-2.5">
                  {visibleProducts.map((prod) => {
                    const isLowStock = prod.stock <= prod.minStock;
                    const isOutOfStock = prod.stock <= 0;

                    return (
                      <div
                        key={prod.id}
                        className={`bg-white rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition text-right group select-none relative ${
                          isOutOfStock
                            ? 'border-rose-300 bg-rose-50/20 hover:border-rose-500 hover:shadow-xs'
                            : 'border-slate-200 hover:border-emerald-500 hover:shadow-xs'
                        }`}
                      >
                        <div
                          onClick={() => addToCart(prod)}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                            <span
                              className={`text-xs font-black px-2.5 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${
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
                                  رصيد القطع: {prod.stock} {prod.unit} (تنبيه: رصيد نافد، يُسمح بالبيع)
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

                        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                          <div className="bg-slate-100 border border-slate-300/80 rounded-lg px-2.5 py-1 text-right min-w-[95px] shrink-0">
                            <div className="text-[10px] text-slate-600 font-bold">
                              سعر تكلفة الجملة:
                            </div>
                            <div className="text-xs sm:text-sm font-black text-slate-800 font-mono">
                              {formatMoney(prod.costPrice)}
                            </div>
                          </div>

                          {settings.enableWholesale && (
                            <div className="bg-amber-50/90 border border-amber-200/90 rounded-lg px-2.5 py-1 text-right min-w-[95px] shrink-0">
                              <div className="text-[10px] text-amber-800 font-bold">
                                سعر بيع الجملة:
                              </div>
                              <div className="text-xs sm:text-sm font-black text-amber-950 font-mono">
                                {formatMoney(prod.wholesalePrice)}
                              </div>
                            </div>
                          )}

                          <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-lg px-3 py-1.5 text-right min-w-[105px] shrink-0">
                            <div className="text-[10px] text-emerald-800 font-bold">
                              {settings.enableWholesale ? 'سعر بيع المفرد:' : 'سعر البيع:'}
                            </div>
                            <div className="text-xs sm:text-base font-black text-emerald-950 font-mono">
                              {formatMoney(prod.retailPrice)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {settings.enableWholesale ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCartWithPrice(prod, 'retail');
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0 ${
                                    isOutOfStock
                                      ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-300'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                  title={isOutOfStock ? "إضافة بسعر المفرد (تنبيه: الرصيد صفر في المخزن)" : "إضافة بسعر البيع المفرد"}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>مفرد</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCartWithPrice(prod, 'wholesale');
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0 ${
                                    isOutOfStock
                                      ? 'bg-rose-700 hover:bg-rose-800 text-white ring-2 ring-rose-300'
                                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                                  }`}
                                  title={isOutOfStock ? "إضافة بسعر الجملة (تنبيه: الرصيد صفر في المخزن)" : "إضافة بسعر بيع الجملة"}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>جملة</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCartWithPrice(prod, 'retail');
                                }}
                                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0 ${
                                  isOutOfStock
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                                title={isOutOfStock ? "إضافة للقائمة (تنبيه: الرصيد صفر في المخزن)" : "إضافة المادة للقائمة بسعر المفرد"}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isOutOfStock ? 'بيع (رصيد 0)' : 'إضافة للقائمة'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* زر عرض المزيد عند كثرة المواد لتسريع الواجهة ومنع التهنيج */}
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
        )}

        {(!isMobileMode || mobileTab === 'cart') && (
          <div className={`${isMobileMode ? 'w-full' : (viewMode === 'grid' ? 'col-span-12 lg:col-span-4 xl:col-span-4 2xl:col-span-3' : 'col-span-12 lg:col-span-5')} lg:sticky lg:top-2 flex flex-col min-w-0`}>
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
            
            <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden ${
              !isMobileMode ? 'lg:h-[calc(100vh-80px)]' : 'h-full'
            }`}>
              {/* رأس لوحة القائمة (ثابت في الأعلى) */}
              <div className="p-2 sm:p-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-col gap-1.5 shrink-0">
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  {/* أزرار نوع القائمة */}
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

                  {/* Multi-Draft & Suspended Orders Bar */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowClearConfirmModal(true)}
                      className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 flex items-center justify-center transition shadow-2xs cursor-pointer"
                      title={`حذف وتفريغ القائمة الحالية (رقم ${activeDraft.orderNumber})`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleAddNewDraft}
                      className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition shadow-2xs cursor-pointer"
                      title="تعليق القائمة الحالية وبدء قائمة جديدة (+)"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    <div className="flex items-center gap-0.5">
                      {draftOrders.map((order) => {
                        const isActive = order.id === activeDraft.id;
                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => switchToDraft(order.id)}
                            className={`w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center transition cursor-pointer shadow-2xs ${
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

                {settings.enableWholesale ? (
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
                      </div>
                    </div>
                    <SessionBadgeButton compact={true} />
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                    <span className="font-bold text-slate-600 text-[10px]">الجلسة:</span>
                    <SessionBadgeButton compact={true} />
                  </div>
                )}
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

              {/* قائمة المواد في السلة (قابلة للتمرير الداخلي فقط عند الكثرة) */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[90px] scrollbar-thin">
                {cartItems.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-center">
                    <ShoppingCart className="w-8 h-8 mb-1.5 stroke-1 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">القائمة فارغة</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">انقر على أي مادة لإضافتها</p>
                  </div>
                ) : (
                  cartItems.map((item, index) => {
                    const cartonCapacity = item.piecesPerCarton || 1;
                    const isCarton = !item.isWeighted && item.unitType === 'carton';
                    const prodRef = products.find(p => p.id === item.productId);
                    const isStockZero = prodRef ? prodRef.stock <= 0 : false;

                    return (
                      <div
                        key={item.productId}
                        className={`border rounded-lg p-2 flex flex-col gap-1.5 transition text-right ${
                          isStockZero 
                            ? 'bg-rose-50/50 border-rose-300' 
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {/* سطر اسم المادة والخيارات السريعة */}
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span 
                                className="w-4 h-4 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold flex items-center justify-center shrink-0" 
                              >
                                {index + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-900 leading-snug truncate">
                                {item.productName}
                              </span>
                              {item.isWeighted && (
                                <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1 rounded flex items-center gap-0.5">
                                  <Scale className="w-2.5 h-2.5 text-emerald-700" />
                                  <span>وزن</span>
                                </span>
                              )}
                              {item.isCustomPrice && (
                                <span className="px-1 py-0.2 rounded bg-blue-100 text-blue-800 text-[9px] font-bold border border-blue-200">
                                  سعر خاص
                                </span>
                              )}
                              {isStockZero && (
                                <span className="px-1 py-0.2 rounded bg-rose-600 text-white text-[9px] font-black">
                                  رصيد 0
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5 flex-wrap">
                              {item.isWeighted ? (
                                <span>سعر الكيلو الواحد: <strong className="font-mono text-slate-700">{formatMoney(item.unitPrice)}</strong></span>
                              ) : (
                                <span>الوحدة: {isCarton ? `كرتون (${cartonCapacity} ق)` : (item.unit || 'قطعة')}</span>
                              )}
                              <span>·</span>
                              <span className="text-emerald-700">تكلفة: {formatMoney(item.costPrice)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleEditCartItemPrice(item)}
                              className={`p-1 rounded border transition cursor-pointer flex items-center justify-center ${
                                editingPriceProductId === item.productId
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-blue-600 hover:text-blue-800 border-slate-300 hover:border-blue-400'
                              }`}
                              title="تعديل سعر البيع في هذه القائمة"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>

                            {!item.isWeighted && (
                              <div className="inline-flex items-center bg-slate-200/80 p-0.5 rounded border border-slate-300 text-[9px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => toggleItemUnitType(item.productId, 'piece')}
                                  className={`px-1 py-0.2 rounded transition cursor-pointer ${
                                    !isCarton
                                      ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                  title="بيع بالقطعة"
                                >
                                  قطعة
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleItemUnitType(item.productId, 'carton')}
                                  className={`px-1 py-0.2 rounded transition cursor-pointer flex items-center gap-0.5 ${
                                    isCarton
                                      ? 'bg-amber-600 text-white shadow-2xs font-extrabold'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                  title={`بيع بالكرتون (${cartonCapacity} قطعة)`}
                                >
                                  <Box className="w-2.5 h-2.5" />
                                  <span>كرتون</span>
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => removeFromCart(item.productId)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer rounded hover:bg-rose-50"
                              title="حذف من القائمة"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* محرر السعر الخاص */}
                        {editingPriceProductId === item.productId && (
                          <div className="bg-blue-50 border border-blue-300 rounded-lg p-2 my-0.5 flex flex-col gap-1.5 shadow-2xs">
                            <div className="flex items-center justify-between text-[10px] font-bold text-blue-950">
                              <span>تعديل السعر للقائمة:</span>
                              <span className="text-slate-600 font-mono">تكلفة: {formatMoney(item.costPrice)}</span>
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
                                    handleSaveCartItemPrice(item.productId);
                                  } else if (e.key === 'Escape') {
                                    setEditingPriceProductId(null);
                                  }
                                }}
                                className="flex-1 px-2 py-1 text-xs font-bold bg-white border border-blue-300 rounded focus:outline-none font-mono"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveCartItemPrice(item.productId)}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                              >
                                حفظ
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPriceProductId(null)}
                                className="px-1.5 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        )}

                        {/* تحكم الوزن أو الكمية المباعة */}
                        {item.isWeighted ? (
                          /* تحكم بيع بالوزن (ميزان) من جهة القائمة: بالكيلو، بالغرام، أو بالمبلغ المطلوب */
                          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-200/70 bg-emerald-50/40 p-2 rounded-xl border border-emerald-200/60 shadow-2xs">
                            {/* السطر 1: إدخال بالكيلو + إدخال بالغرام */}
                            <div className="grid grid-cols-2 gap-1.5 items-center">
                              {/* إدخال بالكيلو */}
                              <div className="flex items-center gap-1 bg-white border border-emerald-400 rounded-lg px-1.5 py-1 shadow-2xs">
                                <span className="text-[10px] font-bold text-emerald-950 shrink-0">كغم:</span>
                                <button
                                  type="button"
                                  onClick={() => updateItemWeight(item.productId, Math.max(0.005, item.quantity - 0.05))}
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
                                    if (!isNaN(val)) updateItemWeight(item.productId, val);
                                  }}
                                  className="w-full text-center text-xs font-black focus:outline-none font-mono bg-transparent"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateItemWeight(item.productId, item.quantity + 0.05)}
                                  className="p-0.5 hover:bg-slate-100 text-slate-700 rounded transition cursor-pointer"
                                  title="زيادة 50 غرام"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              {/* إدخال بالغرام */}
                              <div className="flex items-center gap-1 bg-white border border-amber-400 rounded-lg px-2 py-1 shadow-2xs">
                                <span className="text-[10px] font-bold text-amber-950 shrink-0">غرام:</span>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.weightGrams ?? Math.round(item.quantity * 1000)}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) updateItemWeightInGrams(item.productId, val);
                                  }}
                                  placeholder="350"
                                  className="w-full text-center text-xs font-black focus:outline-none font-mono bg-transparent text-amber-950"
                                />
                                <span className="text-[9px] font-bold text-amber-700">g</span>
                              </div>
                            </div>

                            {/* السطر 2: البيع بالمبلغ المطلوب مباشرة (تحديد السعر من جهة القائمة) + أزرار أوزان سريعة */}
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              {/* تحديد السعر بالمبلغ من جهة القائمة */}
                              <div className="flex items-center gap-1 bg-white border border-blue-400 rounded-lg px-2 py-0.5 shadow-2xs" title="حدد المبلغ المطلوب وسيحسب النظام الوزن بدقة">
                                <span className="text-[10px] font-black text-blue-950 shrink-0">بيع بمبلغ:</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="250"
                                  value={item.total}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) updateItemByTargetAmount(item.productId, val);
                                  }}
                                  className="w-16 text-center text-xs font-black text-blue-900 focus:outline-none font-mono bg-transparent"
                                />
                                <span className="text-[9px] font-bold text-blue-700">{settings.currency || 'د.ع'}</span>
                              </div>

                              {/* أزرار أوزان سريعة (250g, 350g, 500g, 750g, 1kg) */}
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
                                    onClick={() => updateItemWeight(item.productId, chip.kg)}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer ${
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

                            {/* السطر 3: معادلة السعر التلقائي والتفاصيل */}
                            <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5 px-0.5">
                              <span className="flex items-center gap-1 font-mono text-[10px]">
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
                          /* تحكم المواد المباعة بالقطعة / الكرتون */
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                            <div className="flex items-center gap-1">
                              <div className="flex items-center bg-white border border-slate-300 rounded overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
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
                                    if (!isNaN(parsed)) updateQuantity(item.productId, parsed);
                                  }}
                                  className="w-10 text-center text-xs font-bold py-0.5 border-x border-slate-200 focus:outline-none font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                  className="p-1 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              <span className="text-[10px] font-bold text-slate-600">
                                {isCarton ? 'كرتون' : item.unit || 'قطعة'}
                              </span>
                            </div>

                            <div className="text-right flex items-center gap-1 text-[11px]">
                              <span className="font-mono text-slate-600">
                                {formatMoney(item.unitPrice)} × {item.quantity} =
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

              {/* ذيل الفاتورة والمحاسبة (ثابت دائماً في الأسفل ومرئي بالكامل بدون تمرير الصفحة) */}
              <div className="p-2 sm:p-2.5 bg-slate-50 border-t border-slate-200 flex flex-col gap-1.5 shrink-0 text-right">
                {/* الحسابات والمبالغ */}
                <div className="space-y-1 text-[11px] text-slate-700">
                  <div className="flex justify-between items-center">
                    <span>المجموع الأولي:</span>
                    <span className="font-bold text-slate-800 font-mono">{formatMoney(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>الخصم:</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={discount || ''}
                        placeholder="0"
                        onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-20 text-left px-1.5 py-0.5 text-xs font-bold border border-slate-300 rounded bg-white focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500">{settings.currency}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs sm:text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>المبلغ المطلوب:</span>
                    <span className="text-emerald-700 font-mono">{formatMoney(finalTotal)}</span>
                  </div>

                  <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded flex justify-between font-medium">
                    <span>صافي الربح التقديري:</span>
                    <span className="font-bold font-mono">{formatMoney(estimatedProfit)}</span>
                  </div>
                </div>

                {/* اختيار الزبون بشكل رشيق ومضغوط */}
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
                      {saleType === 'credit' && remainingDebt > 0 && (
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
                          max={finalTotal}
                          value={paidAmount || ''}
                          placeholder="0"
                          onChange={(e) => setPaidAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full text-left px-1 py-0.5 text-[11px] font-bold border border-amber-300 rounded bg-white"
                        />
                      </div>
                      <div className="flex items-center justify-between font-bold text-rose-700">
                        <span>الباقي:</span>
                        <span className="font-mono">{formatMoney(remainingDebt)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ملاحظات الفاتورة */}
                <input
                  type="text"
                  placeholder="ملاحظات تظهر بالوصل (اختياري)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-[11px] px-2 py-1 border border-slate-300 rounded-lg bg-white focus:outline-none"
                />

                {/* اختيار المندوب المنفذ للبيع عند تفعيل الميزة */}
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

                    {selectedRepObj && (
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

                {/* الأزرار الرئيسية للحفظ والطباعة - تظهر دائماً في أسفل الشاشة دون الحاجة للتمرير */}
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
                    title="حفظ وطباعة القائمة"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>حفظ وطباعة القائمة</span>
                  </button>

                  <button
                    type="button"
                    disabled={cartItems.length === 0 || (saleType === 'credit' && !selectedCustomerId)}
                    onClick={() => handleSaveInvoice(false)}
                    className="py-2 px-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title="حفظ القائمة فقط دون طباعة"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>حفظ فقط</span>
                  </button>
                </div>

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
                <p className="text-[10px] text-slate-400 mt-1">
                  إذا كان على الزبون دين متبقي من فترات سابقة قبل استخدام البرنامج.
                </p>
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

      {unfoundBarcodePrompt && (
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
                {typeof editPiecesPerCarton === 'number' && editPiecesPerCarton > 1 && typeof editRetailPrice === 'number' && (
                  <div className="text-[11px] text-slate-600 mt-2 font-medium">
                    💡 سعر الكرتون المفرد = <span className="font-bold text-slate-900">{formatMoney(editRetailPrice * editPiecesPerCarton)}</span>
                    {typeof editWholesalePrice === 'number' && (
                      <> · جملة = <span className="font-bold text-slate-900">{formatMoney(editWholesalePrice * editPiecesPerCarton)}</span></>
                    )}
                  </div>
                )}
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

      {/* Confirmation Modal for Clearing / Deleting Current Draft Order */}
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
      {/* نافذة حوار اختيار المندوب السريعة قبل إتمام وطباعة القائمة */}
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
              {/* خيار بيع مباشر للمحل بدون مندوب */}
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
                <div className="text-xs font-mono font-black text-emerald-700">
                  ربح المالك: {formatMoney(estimatedProfit)}
                </div>
              </button>

              {/* قائمة المندوبين المسجلين */}
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

                    <div className="text-left font-mono text-[11px]">
                      <div className="text-indigo-700 font-bold">
                        عمولة: {formatMoney(repComm)}
                      </div>
                      <div className="text-emerald-700 text-[10px] font-semibold">
                        للمالك: {formatMoney(storeProfit)}
                      </div>
                    </div>
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
    </div>
  );
};

export default POSView;

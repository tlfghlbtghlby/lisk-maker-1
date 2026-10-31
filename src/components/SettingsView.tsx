import React, { useState, useEffect, useRef, Suspense } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../context/AppContext';
import { 
  ADMIN_EMAIL,
  SessionRole,
  RolePermissions,
  DEFAULT_EMPLOYEE_PERMISSIONS,
  DEFAULT_SUPERVISOR_PERMISSIONS,
  InvoiceTemplateType,
  ModernInvoiceHeaderConfig
} from '../types';
import { changeAccountPassword } from '../firebase';
import { 
  Settings, 
  Store, 
  FileText, 
  Download, 
  Upload, 
  Check, 
  AlertTriangle,
  Cloud,
  LogOut,
  Trash2,
  RefreshCw,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Percent,
  Sliders,
  Sparkles,
  Zap,
  Printer,
  Users,
  UserCheck,
  Package,
  PackageCheck,
  PackagePlus,
  Clock,
  Plus,
  Edit2,
  X,
  UserPlus,
  Palette,
  QrCode,
  QrCode as QrCodeIcon,
  Image as ImageIcon,
  Share2,
  Send,
  Phone,
  Instagram,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Cpu,
  Copy,
  Briefcase,
  Sun,
  Moon
} from 'lucide-react';
import { PresetShift, StoreSupervisor } from '../types';
import { QuickAddItemsSection } from './QuickAddItemsSection';
import { ExportBackupModal } from './ExportBackupModal';
import { WipeProductsModal } from './WipeProductsModal';
import { ModernInvoiceHeader } from './ModernInvoiceHeader';
import { DuplicateProductsModal } from './DuplicateProductsModal';
import { ActiveSessionsModal } from './ActiveSessionsModal';

const AdminPanel = React.lazy(() => import('./AdminPanel'));

const COMMON_CURRENCIES = [
  { code: 'د.ع', name: 'دينار عراقي (IQD)' },
  { code: '$', name: 'دولار أمريكي (USD)' },
  { code: 'ر.س', name: 'ريال سعودي (SAR)' },
  { code: 'ج.م', name: 'جنيه مصري (EGP)' },
  { code: 'د.إ', name: 'درهم إماراتي (AED)' },
  { code: 'د.ك', name: 'دينار كويتي (KWD)' },
  { code: 'د.أ', name: 'دينار أردني (JOD)' },
];

interface SettingsViewProps {
  initialTab?: 'store' | 'quick-add' | 'pricing' | 'security' | 'sessions' | 'customer-qr' | 'all';
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialTab = 'store' }) => {
  const { 
    settings, 
    updateSettings, 
    exportDataJSON, 
    exportCustomBackup,
    importDataJSON, 
    importProductsOnly, 
    currentUser,
    logout,
    products,
    applyBulkPriceAdjustment,
    sessionRole,
    openSessionModal,
    hasPermission,
    addPresetShift,
    updatePresetShift,
    deletePresetShift,
    addSupervisor,
    updateSupervisor,
    deleteSupervisor,
    currentDeviceId,
    deviceSessions,
    isDuplicatesModalOpen,
    setIsDuplicatesModalOpen,
    isActiveSessionsModalOpen,
    setIsActiveSessionsModalOpen,
    duplicateGroups,
    shifts,
    activeShift,
    theme,
    setTheme
  } = useApp();

  const [storeName, setStoreName] = useState(settings.storeName);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [currency, setCurrency] = useState(settings.currency);
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(settings.invoiceFooterNote);
  
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const realStoreId = (currentUser as any)?.id 
    || currentUser?.uid 
    || (currentUser as any)?.storeId 
    || (currentUser as any)?.username 
    || (settings.storeName ? settings.storeName.trim() : 'azarstore');
  const storeIdentifier = currentUser?.uid ? `store_${currentUser.uid}` : `store_${realStoreId}`;
  const customerPriceCheckerUrl = `https://ckeckprice.vercel.app/#${(function() {
    try {
      return btoa(unescape(encodeURIComponent(String(realStoreId))));
    } catch {
      return btoa(String(realStoreId));
    }
  })()}`;

  useEffect(() => {
    if (customerPriceCheckerUrl) {
      QRCode.toDataURL(customerPriceCheckerUrl, { width: 350, margin: 2 }, (err, url) => {
        if (!err && url) {
          setQrCodeDataUrl(url);
        }
      });
    }
  }, [customerPriceCheckerUrl]);

  const [hotspotUrl, setHotspotUrl] = useState<string>('http://192.168.137.1:3456');
  const [hotspotQr, setHotspotQr] = useState<string>('');
  const [copiedHotspot, setCopiedHotspot] = useState(false);

  useEffect(() => {
    const electron = (window as any).electronAPI || (window as any).electron;
    if (electron) {
      if (typeof electron.getHotspotUrl === 'function') {
        electron.getHotspotUrl().then((url: string) => {
          if (url) setHotspotUrl(url);
        });
      }

      if (typeof electron.updateLocalCatalog === 'function') {
        electron.updateLocalCatalog({
          storeName: settings.storeName || 'المتجر',
          products: products.map(p => ({
            code: (p as any).barcode || p.code || '',
            name: p.name,
            retailPrice: p.retailPrice || (p as any).price || 0,
            currency: settings.currency || 'د.ع'
          }))
        });
      }
    }
  }, [products, settings.storeName, settings.currency]);

  useEffect(() => {
    if (hotspotUrl) {
      QRCode.toDataURL(hotspotUrl, { width: 220, margin: 1 })
        .then(url => setHotspotQr(url))
        .catch(err => console.error(err));
    }
  }, [hotspotUrl]);

  const copyToClipboard = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(customerPriceCheckerUrl);
    } else {
      const ta = document.createElement('textarea');
      ta.value = customerPriceCheckerUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQrPng = () => {
    const download = (dataUrl: string) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      const cleanStoreName = (settings.storeName || 'Store').trim().replace(/[\s/\\?%*:|"<>]/g, '_');
      a.download = `QR-PriceChecker-${cleanStoreName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    if (qrCodeDataUrl) {
      download(qrCodeDataUrl);
    } else {
      QRCode.toDataURL(customerPriceCheckerUrl, { width: 400, margin: 2 }, (err, url) => {
        if (!err && url) {
          download(url);
        }
      });
    }
  };

  const [printFormat, setPrintFormat] = useState<'a4' | 'a5' | 'thermal' | 'thermal80' | 'thermal58'>(
    settings.printFormat || 'a4'
  );
  const [directPrintEnabled, setDirectPrintEnabled] = useState<boolean>(
    settings.directPrintEnabled ?? false
  );
  const [selectedPrinterName, setSelectedPrinterName] = useState<string>(
    (settings as any).selectedPrinterName || ''
  );
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);

  useEffect(() => {
    const fetchPrinters = async () => {
      const electronBridge = (window as any).electronAPI || (window as any).electron;
      if (electronBridge && typeof electronBridge.getPrinters === 'function') {
        setIsLoadingPrinters(true);
        try {
          const list = await electronBridge.getPrinters();
          if (Array.isArray(list)) {
            setAvailablePrinters(list);
          }
        } catch (e) {
          console.warn('تعذر جلب الطابعات من النظام:', e);
        } finally {
          setIsLoadingPrinters(false);
        }
      }
    };
    fetchPrinters();
  }, []);

  const [enableWholesale, setEnableWholesale] = useState<boolean>(settings.enableWholesale ?? true);
  const [enableSalesReps, setEnableSalesReps] = useState<boolean>(settings.enableSalesReps ?? false);
  const [defaultShowRepOnInvoice, setDefaultShowRepOnInvoice] = useState<boolean>(settings.defaultShowRepOnInvoice ?? true);
  const [repCommissionDefaultType, setRepCommissionDefaultType] = useState<'percentage_profit' | 'percentage_sales'>(
    settings.repCommissionDefaultType || 'percentage_profit'
  );
  const [desktopLayout, setDesktopLayout] = useState<'full' | 'partial'>(settings.desktopLayout || 'full');

  const [headerRightSealText, setHeaderRightSealText] = useState(settings.headerRightSealText ?? (settings.enableWholesale ? 'جملة' : 'تجزئة'));
  const [headerLeftSealText, setHeaderLeftSealText] = useState(settings.headerLeftSealText ?? 'مفرد');
  const [businessSubtitle, setBusinessSubtitle] = useState(settings.businessSubtitle ?? 'تجارة عامة وبيع الجملة والمفرد');
  const [managerLabel, setManagerLabel] = useState(settings.managerLabel ?? 'بإدارة');

  const [supervisorPin, setSupervisorPin] = useState(settings.supervisorPin || '1122');
  const [defaultSessionOnLaunch, setDefaultSessionOnLaunch] = useState<SessionRole>(
    settings.defaultSessionOnLaunch || 'employee'
  );
  const [employeePermissions, setEmployeePermissions] = useState<RolePermissions>({
    ...DEFAULT_EMPLOYEE_PERMISSIONS,
    ...(settings.employeePermissions || {}),
  });
  const [supervisorPermissions, setSupervisorPermissions] = useState<RolePermissions>({
    ...DEFAULT_SUPERVISOR_PERMISSIONS,
    ...(settings.supervisorPermissions || {}),
  });
  const [showSupervisorPin, setShowSupervisorPin] = useState(false);
  const [sessionsNotice, setSessionsNotice] = useState<string | null>(null);

  // إعدادات تصعيد وتخفيض الأسعار مع أزرار النسب
  const [bulkPercent, setBulkPercent] = useState<number>(15);
  const [customPercentInput, setCustomPercentInput] = useState<string>('15');
  const [priceDirection, setPriceDirection] = useState<'increase' | 'decrease'>('increase');
  const [targetRetail, setTargetRetail] = useState(true);
  const [targetWholesale, setTargetWholesale] = useState(true);
  const [targetCost, setTargetCost] = useState(false);
  const [roundToHundreds, setRoundToHundreds] = useState(true);
  const [isApplyingBulkPrices, setIsApplyingBulkPrices] = useState(false);
  const [bulkPriceSuccess, setBulkPriceSuccess] = useState<string | null>(null);

  const [activeSettingsTab, setActiveSettingsTab] = useState<'store' | 'quick-add' | 'pricing' | 'security' | 'sessions' | 'customer-qr' | 'all'>(initialTab);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);
  const [isImportingProductsOnly, setIsImportingProductsOnly] = useState(false);

  // إدارة المشرفين المتعددين
  const [isAddingSupervisor, setIsAddingSupervisor] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupPin, setNewSupPin] = useState('');
  const [newSupCanConfigure, setNewSupCanConfigure] = useState(true);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [editSupName, setEditSupName] = useState('');
  const [editSupPin, setEditSupPin] = useState('');
  const [editSupCanConfigure, setEditSupCanConfigure] = useState(true);

  // إدارة الشفتات المسبقة
  const [isAddingPresetShift, setIsAddingPresetShift] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetCode, setNewPresetCode] = useState('');
  const [newPresetNotes, setNewPresetNotes] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetName, setEditPresetName] = useState('');
  const [editPresetCode, setEditPresetCode] = useState('');
  const [editPresetNotes, setEditPresetNotes] = useState('');

  // تفاصيل الترويسة العصرية وشبكات التواصل
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplateType>(
    settings.invoiceTemplate || 'modern'
  );
  const [modernBadgeText, setModernBadgeText] = useState(
    settings.modernHeader?.badgeText ?? 'قرطاسية'
  );
  const [modernFontFamily, setModernFontFamily] = useState(
    settings.modernHeader?.fontFamily ?? 'Aref Ruqaa'
  );
  const [modernRightColor, setModernRightColor] = useState(
    settings.modernHeader?.rightBannerColor ?? '#1e40af'
  );
  const [modernLeftColor, setModernLeftColor] = useState(
    settings.modernHeader?.leftBannerColor ?? '#ea580c'
  );
  const [modernActivitiesText, setModernActivitiesText] = useState(
    settings.modernHeader?.activitiesText ?? 'بيع كافة القرطاسية والمستلزمات المدرسية والمكتبية والهدايا ولعب الأطفال'
  );
  const [modernBadgeLeftText, setModernBadgeLeftText] = useState(
    settings.modernHeader?.badgeLeftText ?? 'جملة'
  );
  const [modernBadgeRightText, setModernBadgeRightText] = useState(
    settings.modernHeader?.badgeRightText ?? 'مفرد'
  );
  const [modernCenterIconType, setModernCenterIconType] = useState<'preset' | 'custom'>(
    settings.modernHeader?.centerIconType ?? 'preset'
  );
  const [modernCenterIconPreset, setModernCenterIconPreset] = useState(
    settings.modernHeader?.centerIconPreset ?? 'stationery'
  );
  const [modernCenterIconCustomUrl, setModernCenterIconCustomUrl] = useState(
    settings.modernHeader?.centerIconCustomUrl ?? ''
  );
  const [modernBarcodeImageUrl, setModernBarcodeImageUrl] = useState(
    settings.modernHeader?.barcodeImageUrl ?? ''
  );
  const [modernShowBarcode, setModernShowBarcode] = useState<boolean>(
    settings.modernHeader?.showBarcode ?? true
  );
  const [modernShowTelegram, setModernShowTelegram] = useState<boolean>(
    settings.modernHeader?.showTelegram ?? true
  );
  const [modernTelegramHandle, setModernTelegramHandle] = useState(
    settings.modernHeader?.telegramHandle ?? ''
  );
  const [modernShowFacebook, setModernShowFacebook] = useState<boolean>(
    settings.modernHeader?.showFacebook ?? true
  );
  const [modernFacebookName, setModernFacebookName] = useState(
    settings.modernHeader?.facebookName ?? ''
  );
  const [modernShowWhatsapp, setModernShowWhatsapp] = useState<boolean>(
    settings.modernHeader?.showWhatsapp ?? true
  );
  const [modernWhatsappNumber, setModernWhatsappNumber] = useState(
    settings.modernHeader?.whatsappNumber ?? settings.phone ?? ''
  );
  const [modernShowInstagram, setModernShowInstagram] = useState<boolean>(
    settings.modernHeader?.showInstagram ?? true
  );
  const [modernInstagramHandle, setModernInstagramHandle] = useState(
    settings.modernHeader?.instagramHandle ?? ''
  );
  const [modernDeliveryNote, setModernDeliveryNote] = useState(
    settings.modernHeader?.deliveryNote ?? 'تتوفر خدمة التوصيل إلى كافة المحافظات'
  );

  const barcodeFileInputRef = useRef<HTMLInputElement>(null);
  const centerIconFileInputRef = useRef<HTMLInputElement>(null);

  const handleBarcodeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setModernBarcodeImageUrl(event.target.result);
        setModernShowBarcode(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCenterIconFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setModernCenterIconCustomUrl(event.target.result);
        setModernCenterIconType('custom');
      }
    };
    reader.readAsDataURL(file);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const productsOnlyFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setStoreName(settings.storeName || '');
      setOwnerName(settings.ownerName || '');
      setPhone(settings.phone || '');
      setAddress(settings.address || '');
      setCurrency(settings.currency || 'د.ع');
      setInvoiceFooterNote(settings.invoiceFooterNote || '');
      if (settings.printFormat) setPrintFormat(settings.printFormat);
      if (settings.directPrintEnabled !== undefined) setDirectPrintEnabled(settings.directPrintEnabled);
      if ((settings as any).selectedPrinterName !== undefined) setSelectedPrinterName((settings as any).selectedPrinterName);
      if (settings.enableWholesale !== undefined) setEnableWholesale(settings.enableWholesale);
      if (settings.enableSalesReps !== undefined) setEnableSalesReps(settings.enableSalesReps);
      if (settings.defaultShowRepOnInvoice !== undefined) setDefaultShowRepOnInvoice(settings.defaultShowRepOnInvoice);
      if (settings.repCommissionDefaultType !== undefined) setRepCommissionDefaultType(settings.repCommissionDefaultType);
      if (settings.desktopLayout) setDesktopLayout(settings.desktopLayout);
      if (settings.headerRightSealText) setHeaderRightSealText(settings.headerRightSealText);
      if (settings.headerLeftSealText) setHeaderLeftSealText(settings.headerLeftSealText);
      if (settings.businessSubtitle) setBusinessSubtitle(settings.businessSubtitle);
      if (settings.managerLabel) setManagerLabel(settings.managerLabel);
      if (settings.supervisorPin) setSupervisorPin(settings.supervisorPin);
      if (settings.defaultSessionOnLaunch) setDefaultSessionOnLaunch(settings.defaultSessionOnLaunch);
      if (settings.invoiceTemplate) setInvoiceTemplate(settings.invoiceTemplate);
      if (settings.modernHeader) {
        const m = settings.modernHeader;
        if (m.badgeText !== undefined) setModernBadgeText(m.badgeText);
        if (m.fontFamily !== undefined) setModernFontFamily(m.fontFamily);
        if (m.rightBannerColor !== undefined) setModernRightColor(m.rightBannerColor);
        if (m.leftBannerColor !== undefined) setModernLeftColor(m.leftBannerColor);
        if (m.activitiesText !== undefined) setModernActivitiesText(m.activitiesText);
        if (m.badgeLeftText !== undefined) setModernBadgeLeftText(m.badgeLeftText);
        if (m.badgeRightText !== undefined) setModernBadgeRightText(m.badgeRightText);
        if (m.centerIconType !== undefined) setModernCenterIconType(m.centerIconType);
        if (m.centerIconPreset !== undefined) setModernCenterIconPreset(m.centerIconPreset);
        if (m.centerIconCustomUrl !== undefined) setModernCenterIconCustomUrl(m.centerIconCustomUrl);
        if (m.barcodeImageUrl !== undefined) setModernBarcodeImageUrl(m.barcodeImageUrl);
        if (m.showBarcode !== undefined) setModernShowBarcode(m.showBarcode);
        if (m.showTelegram !== undefined) setModernShowTelegram(m.showTelegram);
        if (m.telegramHandle !== undefined) setModernTelegramHandle(m.telegramHandle);
        if (m.showFacebook !== undefined) setModernShowFacebook(m.showFacebook);
        if (m.facebookName !== undefined) setModernFacebookName(m.facebookName);
        if (m.showWhatsapp !== undefined) setModernShowWhatsapp(m.showWhatsapp);
        if (m.whatsappNumber !== undefined) setModernWhatsappNumber(m.whatsappNumber);
        if (m.showInstagram !== undefined) setModernShowInstagram(m.showInstagram);
        if (m.instagramHandle !== undefined) setModernInstagramHandle(m.instagramHandle);
        if (m.deliveryNote !== undefined) setModernDeliveryNote(m.deliveryNote);
      }
    }
  }, [settings]);

  const isAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const modernHeaderConfig: ModernInvoiceHeaderConfig = {
      badgeText: modernBadgeText.trim(),
      fontFamily: modernFontFamily,
      rightBannerColor: modernRightColor,
      leftBannerColor: modernLeftColor,
      activitiesText: modernActivitiesText.trim(),
      badgeLeftText: modernBadgeLeftText.trim(),
      badgeRightText: modernBadgeRightText.trim(),
      centerIconType: modernCenterIconType,
      centerIconPreset: modernCenterIconPreset,
      centerIconCustomUrl: modernCenterIconCustomUrl,
      barcodeImageUrl: modernBarcodeImageUrl,
      showBarcode: modernShowBarcode,
      showTelegram: modernShowTelegram,
      telegramHandle: modernTelegramHandle.trim(),
      showFacebook: modernShowFacebook,
      facebookName: modernFacebookName.trim(),
      showWhatsapp: modernShowWhatsapp,
      whatsappNumber: modernWhatsappNumber.trim(),
      showInstagram: modernShowInstagram,
      instagramHandle: modernInstagramHandle.trim(),
      deliveryNote: modernDeliveryNote.trim(),
    };

    updateSettings({
      storeName: storeName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      currency: currency.trim() || 'د.ع',
      invoiceFooterNote: invoiceFooterNote.trim(),
      printFormat,
      directPrintEnabled,
      selectedPrinterName: selectedPrinterName.trim(),
      enableWholesale,
      enableSalesReps,
      defaultShowRepOnInvoice,
      repCommissionDefaultType,
      desktopLayout,
      headerRightSealText: headerRightSealText.trim() || (enableWholesale ? 'جملة' : 'تجزئة'),
      headerLeftSealText: headerLeftSealText.trim() || 'مفرد',
      businessSubtitle: businessSubtitle.trim() || 'تجارة عامة وبيع الجملة والمفرد',
      managerLabel: managerLabel.trim() || 'بإدارة',
      supervisorPin: supervisorPin.trim() || '1122',
      defaultSessionOnLaunch,
      employeePermissions,
      supervisorPermissions,
      invoiceTemplate,
      modernHeader: modernHeaderConfig,
    } as any);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSaveSessionsOnly = () => {
    updateSettings({
      supervisorPin: supervisorPin.trim() || '1122',
      defaultSessionOnLaunch,
      employeePermissions,
      supervisorPermissions,
    });
    setSessionsNotice('تم حفظ الرمز السري للمشرف والصلاحيات بنجاح!');
    setTimeout(() => setSessionsNotice(null), 3500);
  };

  const handleAddSupervisorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim() || !newSupPin.trim()) {
      setSessionsNotice('⚠️ يرجى إدخال اسم المشرف والرمز السري الخاص به');
      setTimeout(() => setSessionsNotice(null), 4000);
      return;
    }
    await addSupervisor({
      name: newSupName.trim(),
      pin: newSupPin.trim(),
      canConfigureShifts: newSupCanConfigure,
    });
    setNewSupName('');
    setNewSupPin('');
    setNewSupCanConfigure(true);
    setIsAddingSupervisor(false);
    setSessionsNotice('✅ تمت إضافة المشرف بنجاح وتخصيص رمزه السري.');
    setTimeout(() => setSessionsNotice(null), 4000);
  };

  const handleEditSupervisorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupId || !editSupName.trim() || !editSupPin.trim()) return;
    await updateSupervisor(editingSupId, {
      name: editSupName.trim(),
      pin: editSupPin.trim(),
      canConfigureShifts: editSupCanConfigure,
    });
    setEditingSupId(null);
    setSessionsNotice('✅ تم تعديل بيانات المشرف ورمزه وصلاحياته بنجاح.');
    setTimeout(() => setSessionsNotice(null), 4000);
  };

  const handleAddPresetShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim() || !newPresetCode.trim()) {
      setSessionsNotice('⚠️ يرجى إدخال اسم الشفت والرمز السري لبدئه');
      setTimeout(() => setSessionsNotice(null), 4000);
      return;
    }
    await addPresetShift({
      name: newPresetName.trim(),
      code: newPresetCode.trim(),
      notes: newPresetNotes.trim(),
    });
    setNewPresetName('');
    setNewPresetCode('');
    setNewPresetNotes('');
    setIsAddingPresetShift(false);
    setSessionsNotice('✅ تمت إضافة قالب الشفت المسبق بنجاح.');
    setTimeout(() => setSessionsNotice(null), 4000);
  };

  const handleEditPresetShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPresetId || !editPresetName.trim() || !editPresetCode.trim()) return;
    await updatePresetShift(editingPresetId, {
      name: editPresetName.trim(),
      code: editPresetCode.trim(),
      notes: editPresetNotes.trim(),
    });
    setEditingPresetId(null);
    setSessionsNotice('✅ تم تعديل بيانات الشفت المسبق بنجاح.');
    setTimeout(() => setSessionsNotice(null), 4000);
  };

  const handleApplyBulkPrices = async () => {
    const rawNum = parseFloat(customPercentInput);
    if (isNaN(rawNum) || rawNum <= 0) {
      alert('يرجى تحديد نسبة مئوية صحيحة أكبر من صفر (مثال: 15 أو 20)');
      return;
    }

    if (!targetRetail && !targetWholesale && !targetCost) {
      alert('يرجى اختيار نوع سعر واحد على الأقل للتطبيق (المفرد، الجملة، أو التكلفة)');
      return;
    }

    const actualPercent = priceDirection === 'increase' ? rawNum : -rawNum;
    const directionWord = priceDirection === 'increase' ? 'تصعيد ورفع' : 'تخفيض';

    const confirmed = confirm(
      `هل أنت متأكد من ${directionWord} أسعار المواد بنسبة ${rawNum}% لكافة مواد المخزن (${products.length} مادة)؟\n` +
      `سيتم تحديث الأسعار سحابياً ومحلياً فوراً.`
    );

    if (!confirmed) return;

    setIsApplyingBulkPrices(true);
    try {
      const res = await applyBulkPriceAdjustment(
        actualPercent,
        {
          retail: targetRetail,
          wholesale: targetWholesale,
          cost: targetCost,
        },
        roundToHundreds
      );

      setBulkPriceSuccess(
        `تم بنجاح ${directionWord} أسعار ${res.updatedCount} مادة بنسبة ${rawNum}%!`
      );
      setTimeout(() => setBulkPriceSuccess(null), 5000);
    } catch (err: any) {
      console.error('Error applying bulk prices:', err);
      alert('حدث خطأ أثناء تحديث الأسعار: ' + (err.message || err));
    } finally {
      setIsApplyingBulkPrices(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!oldPassword.trim()) {
      setPasswordFeedback({ type: 'error', message: 'يرجى إدخال كلمة المرور القديمة' });
      return;
    }
    if (!newPassword.trim()) {
      setPasswordFeedback({ type: 'error', message: 'يرجى إدخال كلمة المرور الجديدة' });
      return;
    }
    if (newPassword.trim().length < 6) {
      setPasswordFeedback({ type: 'error', message: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'كلمة المرور الجديدة غير متطابقة مع التأكيد' });
      return;
    }
    if (!currentUser) {
      setPasswordFeedback({ type: 'error', message: 'يجب تسجيل الدخول لتغيير كلمة المرور' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changeAccountPassword(currentUser.uid, oldPassword.trim(), newPassword.trim());
      if (res.success) {
        if (currentUser) {
          currentUser.password = newPassword.trim();
        }
        try {
          localStorage.setItem('last_known_account_password', newPassword.trim());
        } catch {}
        setPasswordFeedback({ type: 'success', message: res.message || 'تم حفظ وتحديث كلمة المرور الجديدة بنجاح!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordFeedback(null), 5000);
      } else {
        setPasswordFeedback({ type: 'error', message: res.error || 'فشل تحديث كلمة المرور' });
      }
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء تغيير كلمة المرور' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `نسخة_احتياطية_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDataJSON(content);
      if (res.success) {
        setImportError(null);
        setImportStatus('تمت استعادة البيانات بنجاح!');
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        setImportStatus(null);
        setImportError(res.error || 'فشلت استعادة البيانات من الملف');
        setTimeout(() => setImportError(null), 5000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProductsOnlyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingProductsOnly(true);
    setImportError(null);
    setImportStatus('جاري استيراد ورفع المواد للمخزن والسيرفر كأنها أُضيفت يدوياً...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const res = await importProductsOnly(content, 'merge');
        if (res.success) {
          setImportError(null);
          setImportStatus(`✅ تمت استعادة وإدخال ${res.count} مادة بنجاح إلى المخزن والسيرفر كأنك أدخلتها يدوياً!`);
          setTimeout(() => setImportStatus(null), 5000);
        } else {
          setImportStatus(null);
          setImportError(res.error || 'فشلت استعادة نسخة المواد');
          setTimeout(() => setImportError(null), 5000);
        }
      } catch (err: any) {
        setImportStatus(null);
        setImportError(err.message || 'حدث خطأ أثناء قراءة ملف المواد');
        setTimeout(() => setImportError(null), 5000);
      } finally {
        setIsImportingProductsOnly(false);
        if (productsOnlyFileInputRef.current) {
          productsOnlyFileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
      setImportStatus(null);
      setImportError('حدث خطأ أثناء قراءة الملف من الجهاز');
      setIsImportingProductsOnly(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {isAdmin && (
        <Suspense fallback={
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 text-center text-emerald-400 font-bold flex items-center justify-center gap-2 shadow-lg">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>جاري تحميل لوحة تحكم الإدارة العليا بأمان...</span>
          </div>
        }>
          <AdminPanel />
        </Suspense>
      )}

      {/* Cloud Account & Database Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-xl border border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">الربط السحابي والمزامنة</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                  متصل وقيد المزامنة
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentUser ? (
                  <>
                    الحساب: <strong className="text-white">{currentUser.displayName || currentUser.email}</strong> · مزامنة كاملة لجميع الأجهزة
                  </>
                ) : (
                  'أنت تعمل حالياً في وضع الضيف المحلي دون تسجيل حساب'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentUser && (
              <button
                type="button"
                onClick={logout}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="تسجيل الخروج من الحساب الحالي"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span>تسجيل الخروج</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/80 rounded-2xl overflow-x-auto border border-slate-300/60 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveSettingsTab('store')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'store'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Store className="w-4 h-4 text-slate-700" />
          <span>بيانات المحل والقوائم</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('quick-add')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'quick-add'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-amber-800 bg-amber-100/70 hover:bg-amber-200/80 border border-amber-300/70'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-500" />
          <span>إضافة مواد سريعة</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-extrabold">
            جديد
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('pricing')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'pricing'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>تصعيد وتخفيض الأسعار</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('security')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'security'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <KeyRound className="w-4 h-4 text-slate-700" />
          <span>الأمان والنسخ الاحتياطي</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('sessions')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'sessions'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-500" />
          <span>إدارة الجلسات والصلاحيات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('customer-qr')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeSettingsTab === 'customer-qr'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200'
          }`}
        >
          <QrCodeIcon className="w-4 h-4 text-emerald-600" />
          <span>قارئ أسعار الزبائن (QR)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900 font-extrabold">
            أونلاين وأوفلاين
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('all')}
          className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 whitespace-nowrap cursor-pointer mr-auto ${
            activeSettingsTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
          }`}
        >
          <span>عرض الكل</span>
        </button>
      </div>

      {/* Customer QR Price Checker Section */}
      {(activeSettingsTab === 'customer-qr' || activeSettingsTab === 'all') && (
        <div className="bg-[#0b1728] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 mb-6" dir="rtl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-sm">📱</span>
                <span>رابط ورمز QR قارئ الأسعار المشفر للزبائن</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                امسح الرمز أو انسخه لتمكين الزبائن من فحص الأسعار دون الوصول لبيانات الإدارة
              </p>
            </div>
          </div>

          {(settings.enableCustomerPriceChecker === false || (currentUser as any)?.enableCustomerPriceChecker === false) && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>تنبيه: ميزة قارئ الأسعار معطلة لهذا المتجر من قبل إدارة النظام، وستظهر للزبائن رسالة تفيد بتعطيل الميزة عند فتح الرابط.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="flex flex-col items-center justify-center p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                <img
                  src={qrCodeDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(customerPriceCheckerUrl)}&margin=10`}
                  alt="Customer Price Checker QR"
                  className="w-48 h-48 object-contain"
                />
              </div>
              <button
                type="button"
                onClick={handleDownloadQrPng}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download size={14} className="text-amber-400" />
                <span>تنزيل الرمز كصورة (PNG)</span>
              </button>
              <span className="text-[11px] text-slate-400 font-medium text-center">
                يمكنك طباعة هذا الرمز وتعليقه في المتجر
              </span>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  رابط الزبائن المباشر (مشفر بدون إظهار بيانات الحساب أو المنصة)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={customerPriceCheckerUrl}
                    className="flex-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none select-all font-mono text-left"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shrink-0 ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={16} />
                        <span>تم النسخ!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span>نسخ الرابط</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800/80 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <span>✨ ميزة القارئ الذكي المشفر:</span>
                </div>
                <p className="leading-relaxed">
                  • يستطيع الزبون مسح هذا الرمز والتجول في محلك لمعرفة سعر أي مادة فوراً بمجرد توجيه الكاميرا.
                </p>
                <p className="leading-relaxed">
                  • الرابط مشفر ونظيف تماماً ولا يظهر أي معلومات حساسة، ويعمل على تخزين المواد في ذاكرة هاتف الزبون ليعمل أوفلاين وأونلاين بدون توقف.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#0b1728] border-2 border-emerald-500/40 rounded-2xl p-6 shadow-2xl mt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 space-y-3 text-right w-full">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">رابط فحص الأسعار الأوفلاين (عبر نقطة بث الكمبيوتر Hotspot)</h3>
                  <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full">
                    أوفلاين 100%
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  يتصل هاتف الزبون بنقطة بث الكمبيوتر (Mobile Hotspot) ويمسح الرمز ليعمل معه الفحص فورياً دون الحاجة لشبكة إنترنت.
                </p>

                <div className="flex items-center gap-2 bg-[#070d18] p-2 rounded-xl border border-slate-800">
                  <input
                    type="text"
                    readOnly
                    value={hotspotUrl}
                    className="bg-transparent flex-1 text-xs text-emerald-400 font-mono px-2 focus:outline-none text-left"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(hotspotUrl);
                      setCopiedHotspot(true);
                      setTimeout(() => setCopiedHotspot(false), 2000);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition"
                  >
                    {copiedHotspot ? 'تم النسخ!' : 'نسخ الرابط'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow border-2 border-emerald-500 shrink-0">
                {hotspotQr ? (
                  <img src={hotspotQr} alt="Hotspot QR" className="w-36 h-36 object-contain" />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-slate-400 text-xs">جاري التوليد...</div>
                )}
                <span className="text-[10px] text-slate-900 font-bold mt-1">امسح للاتصال المحلي</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Store Settings Form (بيانات المحل والقوائم والترويسة الملونة والكلاسيكية كاملة) */}
      {(activeSettingsTab === 'store' || activeSettingsTab === 'all') && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">بيانات المحل والقوائم والطباعة</h2>
              <p className="text-xs text-slate-400">تظهر هذه المعلومات في ترويسة وتذييل الفواتير وإعدادات الطابعات</p>
            </div>
          </div>

          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              تم حفظ التعديلات بنجاح!
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-5">
          {/* مظهر وثيم البرنامج */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ثيم ومظهر برنامج المفكر المحاسبي
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTheme('dark');
                  updateSettings({ theme: 'dark' });
                }}
                className={`p-3 rounded-xl border-2 text-right transition cursor-pointer flex items-center justify-between ${
                  theme === 'dark'
                    ? 'border-amber-500 bg-[#0b1728] text-white shadow-md shadow-amber-500/10'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>الثيم الداكن (ليلي فاخر)</span>
                      {theme === 'dark' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTheme('light');
                  updateSettings({ theme: 'light' });
                }}
                className={`p-3 rounded-xl border-2 text-right transition cursor-pointer flex items-center justify-between ${
                  theme === 'light'
                    ? 'border-amber-500 bg-white text-slate-900 shadow-md shadow-amber-500/10'
                    : 'border-slate-300 dark:border-slate-700 bg-slate-100 text-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-600 flex items-center justify-center shrink-0 border border-sky-500/30">
                    <Sun className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>الثيم الفاتح (نهاري مشرق)</span>
                      {theme === 'light' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المحل أو المعرض / الشركة <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم صاحب المحل / الإدارة
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف (يظهر في القوائم)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العنوان والموقع التجاري
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العملة المعتمدة
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="د.ع"
                  className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex-1 text-xs bg-slate-100 border border-slate-300 rounded-lg px-2 text-slate-700"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نمط ومقاس الورق الافتراضي للطابعة
              </label>
              <select
                value={printFormat}
                onChange={(e) => setPrintFormat(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                <option value="thermal58">وصل كاشير حراري صغير (58mm)</option>
                <option value="thermal80">وصل كاشير حراري قياسي (80mm)</option>
                <option value="a5">نصف ورقة عادية (A5)</option>
                <option value="a4">فاتورة قياس A4 رسمية كاملة</option>
              </select>
            </div>
          </div>

          {/* ترويسة القائمة الملونة والكلاسيكية مع كامل التفاصيل وشبكات التواصل */}
          <div className="bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 border-2 border-indigo-200/80 rounded-2xl p-5 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>تصميم وشكل ترويسة القائمة المطبوعة</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                      جديد وحصري
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    اختر بين التصميم العصري الملون أو التصميم الكلاسيكي المعتاد
                  </p>
                </div>
              </div>

              {/* أزرار التبديل */}
              <div className="inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-300/80 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setInvoiceTemplate('modern')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    invoiceTemplate === 'modern'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>التصميم العصري الملون</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceTemplate('classic')}
                  className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    invoiceTemplate === 'classic'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>التصميم الكلاسيكي</span>
                </button>
              </div>
            </div>

            {/* تفاصيل الترويسة العصرية */}
            <div className="border-t border-indigo-100 pt-5 space-y-5">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-black text-slate-800">
                  تخصيص عناصر وهوية التصميم العصري (الألوان، الخطوط، الباركود، وشبكات التواصل)
                </h4>
              </div>

              {/* 1. الكلمة البيضوية فوق اسم المحل */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
                <label className="text-xs font-bold text-slate-700 block">
                  الكلمة في الدائرة البيضوية البيضاء فوق اسم المحل
                </label>
                <input
                  type="text"
                  value={modernBadgeText}
                  onChange={(e) => setModernBadgeText(e.target.value)}
                  placeholder="مثال: قرطاسية، سوبرماركت، أسواق، معرض..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold"
                />
              </div>

              {/* 2. الخط العربي لاسم المحل */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  الخط العربي المعتمد لكتابة اسم المحل في الفاتورة
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'Aref Ruqaa', name: 'خط الرقعة الأصيل' },
                    { id: 'Amiri', name: 'الخط الأميري الملكي' },
                    { id: 'Reem Kufi', name: 'خط ريم الكوفي' },
                    { id: 'Cairo', name: 'خط القاهرة العصري' },
                    { id: 'Tajawal', name: 'خط تجوال الاحترافي' },
                    { id: 'Changa', name: 'خط الشانغا العريض' },
                    { id: 'El Messiri', name: 'خط المسيري المزخرف' },
                    { id: 'Almarai', name: 'خط المراعي الرسمي' },
                  ].map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => setModernFontFamily(font.id)}
                      className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                        modernFontFamily === font.id
                          ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-[11px] font-bold text-slate-700">{font.name}</span>
                      <span className="text-sm font-bold text-slate-900 mt-2 block truncate" style={{ fontFamily: font.id }}>
                        {storeName || 'المحل التجاري'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. ألوان الشريط المزدوج */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  ألوان الشريط العلوي المزدوج (الجهة اليمنى والجهة اليسرى)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="color"
                      value={modernRightColor}
                      onChange={(e) => setModernRightColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
                    />
                    <div className="flex-1">
                      <div className="text-[11px] font-bold text-slate-800">لون جهة الاسم والرمز (الشريط الأيمن)</div>
                      <input
                        type="text"
                        value={modernRightColor}
                        onChange={(e) => setModernRightColor(e.target.value)}
                        className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 mt-0.5 w-24"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="color"
                      value={modernLeftColor}
                      onChange={(e) => setModernLeftColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
                    />
                    <div className="flex-1">
                      <div className="text-[11px] font-bold text-slate-800">لون جهة الأنشطة والمواد (الشريط الأيسر)</div>
                      <input
                        type="text"
                        value={modernLeftColor}
                        onChange={(e) => setModernLeftColor(e.target.value)}
                        className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 mt-0.5 w-24"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. صورة وأيقونة الوسط */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">الصورة أو الأيقونة في وسط الترويسة</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setModernCenterIconType('preset')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        modernCenterIconType === 'preset' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      أيقونات جاهزة
                    </button>
                    <button
                      type="button"
                      onClick={() => setModernCenterIconType('custom')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        modernCenterIconType === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      رفع صورة خاصة
                    </button>
                  </div>
                </div>

                {modernCenterIconType === 'preset' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                      { id: 'stationery', name: 'أدوات وقرطاسية' },
                      { id: 'market', name: 'سوبرماركت ومواد' },
                      { id: 'hardware', name: 'معدات وإنشائية' },
                      { id: 'gifts', name: 'هدايا وتزيين' },
                      { id: 'clothes', name: 'ملابس وأزياء' },
                      { id: 'general', name: 'تجارة عامة' },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setModernCenterIconPreset(preset.id)}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          modernCenterIconPreset === preset.id ? 'border-indigo-600 bg-indigo-50 font-bold' : 'border-slate-200'
                        }`}
                      >
                        <span className="text-xs text-slate-800">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input ref={centerIconFileInputRef} type="file" accept="image/*" onChange={handleCenterIconFileUpload} className="hidden" />
                    <button
                      type="button"
                      onClick={() => centerIconFileInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع صورة الوسط من الجهاز</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 5. شبكات التواصل الاجتماعي الأربعة كاملة (تليغرام، فيسبوك، واتساب، انستغرام) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-600" />
                  <label className="text-xs font-bold text-slate-800 block">
                    معرفات وأرقام شبكات التواصل الاجتماعي (مع إمكانية إظهار أو إخفاء أي منها)
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* تليغرام */}
                  <div className={`p-3 rounded-xl border transition ${modernShowTelegram ? 'bg-sky-50/50 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center">
                          <Send className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">تليغرام (Telegram)</span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-sky-800">
                        <input
                          type="checkbox"
                          checked={modernShowTelegram}
                          onChange={(e) => setModernShowTelegram(e.target.checked)}
                          className="rounded text-sky-600"
                        />
                        <span>إظهار</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={!modernShowTelegram}
                      value={modernTelegramHandle}
                      onChange={(e) => setModernTelegramHandle(e.target.value)}
                      placeholder="@username أو رقم الهاتف"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>

                  {/* فيسبوك */}
                  <div className={`p-3 rounded-xl border transition ${modernShowFacebook ? 'bg-blue-50/50 border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                          f
                        </div>
                        <span className="text-xs font-bold text-slate-800">فيسبوك (Facebook)</span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-blue-800">
                        <input
                          type="checkbox"
                          checked={modernShowFacebook}
                          onChange={(e) => setModernShowFacebook(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        <span>إظهار</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={!modernShowFacebook}
                      value={modernFacebookName}
                      onChange={(e) => setModernFacebookName(e.target.value)}
                      placeholder="اسم الصفحة على فيسبوك"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold"
                    />
                  </div>

                  {/* واتساب */}
                  <div className={`p-3 rounded-xl border transition ${modernShowWhatsapp ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Phone className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">واتساب (WhatsApp)</span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-emerald-800">
                        <input
                          type="checkbox"
                          checked={modernShowWhatsapp}
                          onChange={(e) => setModernShowWhatsapp(e.target.checked)}
                          className="rounded text-emerald-600"
                        />
                        <span>إظهار</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={!modernShowWhatsapp}
                      value={modernWhatsappNumber}
                      onChange={(e) => setModernWhatsappNumber(e.target.value)}
                      placeholder="رقم الواتساب"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>

                  {/* انستغرام */}
                  <div className={`p-3 rounded-xl border transition ${modernShowInstagram ? 'bg-pink-50/50 border-pink-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center">
                          <Instagram className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">انستغرام (Instagram)</span>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-pink-800">
                        <input
                          type="checkbox"
                          checked={modernShowInstagram}
                          onChange={(e) => setModernShowInstagram(e.target.checked)}
                          className="rounded text-pink-600"
                        />
                        <span>إظهار</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={!modernShowInstagram}
                      value={modernInstagramHandle}
                      onChange={(e) => setModernInstagramHandle(e.target.value)}
                      placeholder="@instagram_handle"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 6. نصوص الأنشطة والأنواط */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  نص الأنشطة والمواد المتوفرة (يظهر في الشريط الأيسر الملون)
                </label>
                <textarea
                  rows={2}
                  value={modernActivitiesText}
                  onChange={(e) => setModernActivitiesText(e.target.value)}
                  placeholder="مثال: بيع كافة القرطاسية والمستلزمات المدرسية والمكتبية والهدايا ولعب الأطفال"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-medium"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">شارة الشريط اليسرى (جملة)</label>
                    <input
                      type="text"
                      value={modernBadgeLeftText}
                      onChange={(e) => setModernBadgeLeftText(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">شارة الشريط اليمنى (مفرد)</label>
                    <input
                      type="text"
                      value={modernBadgeRightText}
                      onChange={(e) => setModernBadgeRightText(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">عبارة التوصيل (أسفل الترويسة)</label>
                    <input
                      type="text"
                      value={modernDeliveryNote}
                      onChange={(e) => setModernDeliveryNote(e.target.value)}
                      placeholder="تتوفر خدمة التوصيل إلى كافة المحافظات"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* الأختام والنصوص الكلاسيكية */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نص الختم الأيمن (الافتراضي: جملة أو تجزئة)</label>
                <input
                  type="text"
                  value={headerRightSealText}
                  onChange={(e) => setHeaderRightSealText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نص الختم الأيسر (الافتراضي: مفرد أو قطع)</label>
                <input
                  type="text"
                  value={headerLeftSealText}
                  onChange={(e) => setHeaderLeftSealText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">بادئة اسم المدير / الإشراف</label>
                <input
                  type="text"
                  value={managerLabel}
                  onChange={(e) => setManagerLabel(e.target.value)}
                  placeholder="بإدارة"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع التجارة والنشاط</label>
                <input
                  type="text"
                  value={businessSubtitle}
                  onChange={(e) => setBusinessSubtitle(e.target.value)}
                  placeholder="تجارة عامة وبيع الجملة والمفرد"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-medium"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة أسفل القوائم</label>
            <textarea
              rows={2}
              value={invoiceFooterNote}
              onChange={(e) => setInvoiceFooterNote(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition cursor-pointer"
            >
              حفظ إعدادات المحل والقوائم والطباعة
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Quick Add Items Section */}
      {(activeSettingsTab === 'quick-add' || activeSettingsTab === 'all') && (
        <QuickAddItemsSection />
      )}

      {/* Bulk Price Adjustment */}
      {(activeSettingsTab === 'pricing' || activeSettingsTab === 'all') && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">تصعيد أو تخفيض أسعار المواد في المخزن</h2>
              <p className="text-xs text-slate-400">رفع أو خفض الأسعار بنسبة مئوية عند تغير سعر السوق</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
            {products.length} مادة بالمخزن
          </span>
        </div>

        <div className="p-6 space-y-5">
          {bulkPriceSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-2xs animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{bulkPriceSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع العملية المطلوبة:</label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setPriceDirection('increase')}
                className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  priceDirection === 'increase'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-rose-600" />
                <span>تصعيد ورفع الأسعار (زيادة)</span>
              </button>

              <button
                type="button"
                onClick={() => setPriceDirection('decrease')}
                className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  priceDirection === 'decrease'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                <TrendingDown className="w-4 h-4 text-blue-600" />
                <span>تخفيض الأسعار (نزول السوق)</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">النسبة المئوية المراد تطبيقها:</label>
            <div className="flex flex-wrap items-center gap-2">
              {[5, 10, 15, 20, 25, 30].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setBulkPercent(pct);
                    setCustomPercentInput(String(pct));
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    customPercentInput === String(pct)
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}

              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-xs text-slate-500 font-bold">أو نسبة مخصصة:</span>
                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    max="500"
                    step="0.5"
                    value={customPercentInput}
                    onChange={(e) => {
                      setCustomPercentInput(e.target.value);
                      const parsed = parseFloat(e.target.value);
                      if (!isNaN(parsed)) setBulkPercent(parsed);
                    }}
                    placeholder="20"
                    className="w-20 pl-7 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg text-center font-black focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <label className="block text-xs font-bold text-slate-800 mb-2">الأسعار التي سيتم تعديلها:</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-emerald-400">
                <input
                  type="checkbox"
                  checked={targetRetail}
                  onChange={(e) => setTargetRetail(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-800">سعر البيع المفرد (التجزئة)</span>
              </label>

              {settings.enableWholesale && (
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-emerald-400">
                  <input
                    type="checkbox"
                    checked={targetWholesale}
                    onChange={(e) => setTargetWholesale(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-800">سعر بيع الجملة</span>
                </label>
              )}

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-emerald-400">
                <input
                  type="checkbox"
                  checked={targetCost}
                  onChange={(e) => setTargetCost(e.target.checked)}
                  className="rounded text-slate-600 focus:ring-slate-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">سعر التكلفة والشراء</span>
                  <span className="text-[10px] text-slate-400">في حال ارتفعت تكلفة الاستيراد</span>
                </div>
              </label>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={roundToHundreds}
                  onChange={(e) => setRoundToHundreds(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-700 font-semibold">تقريب الأسعار تجارياً لأقرب 250 دينار</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={isApplyingBulkPrices || products.length === 0}
              onClick={handleApplyBulkPrices}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 shadow-xs cursor-pointer ${
                isApplyingBulkPrices ? 'bg-slate-500 cursor-wait' : priceDirection === 'increase' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>تطبيق {priceDirection === 'increase' ? 'تصعيد الأسعار' : 'تخفيض الأسعار'} الآن ({customPercentInput}%)</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Security & Backup (أزرار النسخ الاحتياطي الستة كاملة) */}
      {(activeSettingsTab === 'security' || activeSettingsTab === 'all') && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shadow-2xs">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">تغيير كلمة المرور / رمز الحساب</h3>
                </div>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور القديمة</label>
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-xl"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة</label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-xl"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة المرور الجديدة</label>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-xs border border-slate-300 rounded-xl"
                    dir="ltr"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl"
              >
                حفظ كلمة المرور الجديدة
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">النسخ الاحتياطي وإدارة البيانات</h3>
                <p className="text-xs text-slate-400 mt-0.5">احفظ نسخة مخصصة من المواد، أو إعدادات الحساب، أو نسخة شاملة</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 text-right flex flex-col justify-between transition group cursor-pointer shadow-2xs"
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                    <Download className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">تخصيص حر ⚙️</span>
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900">تحميل نسخة احتياطية (تخصيص حسب الرغبة)</div>
                  <div className="text-[11px] text-slate-500 mt-1">حفظ المواد فقط بدون بيانات الزبائن، أو إعدادات الحساب، أو نسخة شاملة.</div>
                </div>
              </button>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 text-right flex flex-col justify-between transition group cursor-pointer shadow-2xs"
              >
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json" className="hidden" />
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">ملف شامل</span>
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900">استعادة نسخة شاملة من ملف</div>
                  <div className="text-[11px] text-slate-500 mt-1">رفع ملف نسخة احتياطية سابقة واسترجاع كافة البيانات.</div>
                </div>
              </div>

              <div
                onClick={() => !isImportingProductsOnly && productsOnlyFileInputRef.current?.click()}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 text-right flex flex-col justify-between transition group cursor-pointer shadow-2xs"
              >
                <input type="file" ref={productsOnlyFileInputRef} onChange={handleProductsOnlyFileSelect} accept=".json" className="hidden" />
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">للمواد فقط</span>
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900">استعادة نسخة المواد فقط (إدخال تلقائي للمخزن)</div>
                  <div className="text-[11px] text-slate-500 mt-1">رفع ملف المواد وإدخالها فوراً للمخزن والسيرفر كأنك أدخلتها يدوياً.</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsWipeModalOpen(true)}
                className="p-4 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 text-right flex flex-col justify-between transition group cursor-pointer shadow-2xs"
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">محمي برمز الحساب 🔒</span>
                </div>
                <div>
                  <div className="font-extrabold text-sm text-rose-950">مسح وتصفية كافة المواد من السيرفر</div>
                  <div className="text-[11px] text-slate-500 mt-1">تصفير وحذف جميع المواد نهائياً من قاعدة بيانات السيرفر بأمان.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsDuplicatesModalOpen(true)}
                className="p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 text-right flex flex-col justify-between transition group cursor-pointer shadow-2xs"
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition">
                    <Copy className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">المواد المكررة</span>
                </div>
                <div>
                  <div className="font-extrabold text-sm text-amber-950">كشف ومراجعة المواد المكررة وإلغاؤها</div>
                  <div className="text-[11px] text-slate-500 mt-1">فحص المواد المتطابقة في الباركود أو المتشابهة 100% بالاسم والأسعار.</div>
                </div>
              </button>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 text-right flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-950">أوفلاين مدى الحياة</span>
                </div>
                <div>
                  <div className="font-extrabold text-sm text-emerald-950">نظام أوفلاين محلي مستقل 100%</div>
                  <div className="text-[11px] text-emerald-900 mt-1">يعمل البرنامج بدون إنترنت، وجميع قواعد البيانات محفوظة مشفرة على قرص جهازك.</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sessions Management */}
      {(activeSettingsTab === 'sessions' || activeSettingsTab === 'all') && (
        <>
          {sessionsNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{sessionsNotice}</span>
            </div>
          )}

          {/* Current Session Indicator */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white">الجلسة النشطة حالياً</h3>
              <p className="text-xs text-slate-300 mt-1">
                {sessionRole === 'admin' ? 'جلسة الأدمن (كامل الصلاحيات)' : sessionRole === 'supervisor' ? 'جلسة المشرف' : 'جلسة الموظف'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openSessionModal()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl"
            >
              تبديل الجلسة
            </button>
          </div>

          {/* الأجهزة المتصلة والمتزامنة مع النظام */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span>الأجهزة المتصلة والمتزامنة مع النظام</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                      {deviceSessions.length} أجهزة
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تتبع الهواتف والكمبيوترات المتصلة، موقع كل جهاز ونوعه، وإمكانية فتح شفت مختلف في آن واحد من كل جلسة.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsActiveSessionsModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>إدارة ومراقبة الجلسات</span>
              </button>
            </div>
          </div>

          {/* إعدادات رمز المشرف والجلسة الافتراضية */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  الرمز السري لجلسة المشرف (Supervisor PIN):
                </label>
                <div className="relative">
                  <input
                    type={showSupervisorPin ? 'text' : 'password'}
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value)}
                    placeholder="1122"
                    className="w-full pl-10 pr-3.5 py-2 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupervisorPin(!showSupervisorPin)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                  >
                    {showSupervisorPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800">الجلسة الافتراضية عند فتح التطبيق:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDefaultSessionOnLaunch('employee')}
                    className={`p-2.5 rounded-lg border text-center text-xs font-bold ${
                      defaultSessionOnLaunch === 'employee' ? 'bg-emerald-700 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    الموظف
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefaultSessionOnLaunch('supervisor')}
                    className={`p-2.5 rounded-lg border text-center text-xs font-bold ${
                      defaultSessionOnLaunch === 'supervisor' ? 'bg-blue-800 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    المشرف
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefaultSessionOnLaunch('admin')}
                    className={`p-2.5 rounded-lg border text-center text-xs font-bold ${
                      defaultSessionOnLaunch === 'admin' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    الأدمن
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* إدارة المشرفين المتعددين */}
          {sessionRole === 'admin' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">إدارة المشرفين المتعددين (Supervisors)</h3>
                  </div>
                </div>

                {!isAddingSupervisor && !editingSupId && (
                  <button
                    type="button"
                    onClick={() => setIsAddingSupervisor(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>إضافة مشرف جديد</span>
                  </button>
                )}
              </div>

              {isAddingSupervisor && (
                <form onSubmit={handleAddSupervisorSubmit} className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newSupName}
                      onChange={(e) => setNewSupName(e.target.value)}
                      placeholder="اسم المشرف"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newSupPin}
                      onChange={(e) => setNewSupPin(e.target.value)}
                      placeholder="رمز PIN"
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setIsAddingSupervisor(false)} className="px-3 py-1.5 text-xs text-slate-600">إلغاء</button>
                    <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">حفظ</button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(settings.supervisors || []).map((sup) => (
                  <div key={sup.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{sup.name}</span>
                      <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">رمز: {sup.pin}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/60">
                      {(settings.supervisors || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => deleteSupervisor(sup.id)}
                          className="px-2 py-1 text-[11px] font-bold text-rose-600"
                        >
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* قوالب الشفتات المعدة مسبقاً */}
          {(sessionRole === 'admin' || hasPermission('canConfigureShifts')) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">قوالب الشفتات المعدة مسبقاً (Preset Shifts)</h3>
                  </div>
                </div>

                {!isAddingPresetShift && !editingPresetId && (
                  <button
                    type="button"
                    onClick={() => setIsAddingPresetShift(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة شفت مسبق جديد</span>
                  </button>
                )}
              </div>

              {isAddingPresetShift && (
                <form onSubmit={handleAddPresetShiftSubmit} className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      placeholder="اسم الشفت"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newPresetCode}
                      onChange={(e) => setNewPresetCode(e.target.value)}
                      placeholder="الرمز السري (PIN)"
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setIsAddingPresetShift(false)} className="px-3 py-1.5 text-xs text-slate-600">إلغاء</button>
                    <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold">حفظ</button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(settings.presetShifts || []).map((preset) => (
                  <div key={preset.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{preset.name}</span>
                      <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">رمز: {preset.code}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => deletePresetShift(preset.id)}
                        className="px-2 py-1 text-[11px] font-bold text-rose-600"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* مصفوفة الصلاحيات مع وجود canViewCostPrice */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Employee Permissions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-800" />
                  <h4 className="text-sm font-extrabold text-slate-900">صلاحيات جلسة الموظف العادي</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setEmployeePermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS })}
                  className="text-[11px] text-emerald-700 font-bold underline cursor-pointer"
                >
                  استعادة الضبط
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'canSell' as const, label: 'البيع وإعداد الفواتير الجديدة (POS)', desc: 'إنشاء وحفظ وطباعة القوائم' },
                  { key: 'canAddNewProduct' as const, label: 'إضافة مواد جديدة للمخزن', desc: 'إدخال المواد وتحديد أسعارها' },
                  { key: 'canViewCostPrice' as const, label: 'عرض أسعار التكلفة والشراء', desc: 'السماح برؤية سعر رأس المال في الجداول ونوافذ التعديل' },
                  { key: 'canEditProductPrice' as const, label: 'تعديل السعر في القائمة للزبون (أيقونة القلم الصغير)', desc: 'تعديل سعر المادة في القائمة النشطة فقط' },
                  { key: 'canViewInvoices' as const, label: 'الدخول لسجل الفواتير ومعاينة القوائم', desc: 'معاينة وطباعة القوائم السابقة دون تعديل' },
                  { key: 'canAccessInventory' as const, label: 'الدخول لقسم المواد والمخزون', desc: 'معاينة الأصناف وجرد الكميات' },
                  { key: 'canReturnInvoice' as const, label: 'استعادة الفواتير وإرجاع المواد للمخزن', desc: 'إرجاع القوائم (محظور افتراضياً للموظف)' },
                  { key: 'canDeleteInvoice' as const, label: 'حذف القوائم نهائياً', desc: 'حذف سجلات الفواتير (محظور افتراضياً للموظف)' },
                  { key: 'canViewCustomers' as const, label: 'الدخول لسجل الزبائن وحسابات الديون', desc: 'رؤية كشوفات الديون (محظور افتراضياً)' },
                  { key: 'canViewReports' as const, label: 'الدخول لسجل الأرباح والتقارير المالية', desc: 'أرباح المتجر ورأس المال (محظور افتراضياً)' },
                  { key: 'canAccessShifts' as const, label: 'الدخول لسجل وتبويب الشفتات', desc: 'معاينة شفتات العمل ومبيعاتها وقوائمها' },
                  { key: 'canManageShifts' as const, label: 'بدء وإنهاء الشفتات والورديات', desc: 'تشغيل مؤقت الشفت وإنهائه' },
                  { key: 'canAccessSettings' as const, label: 'الدخول لشاشة الإعدادات العامة', desc: 'إعدادات النظام والنسخ الاحتياطي (محظور افتراضياً)' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border transition cursor-pointer ${
                      employeePermissions[item.key] ? 'bg-emerald-50/60 border-emerald-200 text-slate-900' : 'bg-slate-50 border-slate-200/80 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!employeePermissions[item.key]}
                      onChange={(e) =>
                        setEmployeePermissions((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold leading-tight flex items-center justify-between">
                        <span>{item.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          employeePermissions[item.key] ? 'text-emerald-700 bg-emerald-100' : 'text-slate-500 bg-slate-200'
                        }`}>
                          {employeePermissions[item.key] ? 'مسموح' : 'محظور'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Supervisor Permissions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-800" />
                  <h4 className="text-sm font-extrabold text-slate-900">صلاحيات جلسة المشرف المعتمد</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSupervisorPermissions({ ...DEFAULT_SUPERVISOR_PERMISSIONS })}
                  className="text-[11px] text-blue-700 font-bold underline cursor-pointer"
                >
                  استعادة الضبط
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'canSell' as const, label: 'البيع وإعداد الفواتير الجديدة (POS)', desc: 'إنشاء وحفظ وطباعة القوائم' },
                  { key: 'canAddNewProduct' as const, label: 'إضافة مواد جديدة للمخزن', desc: 'إدخال المواد وتعديل أسعارها' },
                  { key: 'canViewCostPrice' as const, label: 'عرض أسعار التكلفة والشراء', desc: 'السماح برؤية سعر رأس المال في الجداول ونوافذ التعديل' },
                  { key: 'canEditProductPrice' as const, label: 'تعديل السعر في القائمة للزبون (أيقونة القلم الصغير)', desc: 'تعديل سعر المادة في القائمة النشطة' },
                  { key: 'canViewInvoices' as const, label: 'الدخول لسجل الفواتير ومعاينة القوائم', desc: 'معاينة وطباعة القوائم' },
                  { key: 'canReturnInvoice' as const, label: 'استعادة الفواتير وإرجاع المواد للمخزن', desc: 'إلغاء البيع واسترجاع البضاعة' },
                  { key: 'canViewCustomers' as const, label: 'الدخول لسجل الزبائن وحسابات الديون', desc: 'متابعة حسابات الزبائن' },
                  { key: 'canAccessInventory' as const, label: 'الدخول لقسم المواد والمخزون', desc: 'معاينة المخزن وجرد الأصناف' },
                  { key: 'canAccessShifts' as const, label: 'الدخول لسجل وتبويب الشفتات', desc: 'معاينة شفتات العمل ومبيعاتها وقوائمها' },
                  { key: 'canManageShifts' as const, label: 'بدء وإنهاء الشفتات والورديات', desc: 'تشغيل مؤقت الشفت وإنهائه' },
                  { key: 'canDeleteInvoice' as const, label: 'حذف القوائم نهائياً', desc: 'حذف سجلات الفواتير نهائياً' },
                  { key: 'canViewReports' as const, label: 'الدخول لسجل الأرباح والتقارير المالية', desc: 'أرباح المتجر ورأس المال' },
                  { key: 'canAccessSettings' as const, label: 'الدخول لشاشة الإعدادات العامة', desc: 'إعدادات النظام والنسخ الاحتياطي' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border transition cursor-pointer ${
                      supervisorPermissions[item.key] ? 'bg-blue-50/60 border-blue-200 text-slate-900' : 'bg-slate-50 border-slate-200/80 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!supervisorPermissions[item.key]}
                      onChange={(e) =>
                        setSupervisorPermissions((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold leading-tight flex items-center justify-between">
                        <span>{item.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          supervisorPermissions[item.key] ? 'text-blue-700 bg-blue-100' : 'text-slate-500 bg-slate-200'
                        }`}>
                          {supervisorPermissions[item.key] ? 'مسموح' : 'محظور'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSaveSessionsOnly}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black"
            >
              حفظ وتثبيت إعدادات وصلاحيات الجلسات
            </button>
          </div>
        </>
      )}

      {/* Modals */}
      <ExportBackupModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
      <WipeProductsModal isOpen={isWipeModalOpen} onClose={() => setIsWipeModalOpen(false)} />
      <DuplicateProductsModal isOpen={isDuplicatesModalOpen} onClose={() => setIsDuplicatesModalOpen(false)} />
      <ActiveSessionsModal isOpen={isActiveSessionsModalOpen} onClose={() => setIsActiveSessionsModalOpen(false)} />
    </div>
  );
};

export default SettingsView;

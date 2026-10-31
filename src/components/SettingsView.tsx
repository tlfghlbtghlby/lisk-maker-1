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
  const storeId = storeIdentifier;
  const activeStoreKey = `store_user_${realStoreId}`;

  const encryptedStoreToken = typeof window !== 'undefined' 
    ? (function() {
        try {
          return btoa(unescape(encodeURIComponent(String(realStoreId))));
        } catch {
          return btoa(String(realStoreId));
        }
      })()
    : '';
  const customerPriceCheckerUrl = `https://ckeckprice.vercel.app/#${encryptedStoreToken}`;

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

  const [isAddingSupervisor, setIsAddingSupervisor] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupPin, setNewSupPin] = useState('');
  const [newSupCanConfigure, setNewSupCanConfigure] = useState(true);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [editSupName, setEditSupName] = useState('');
  const [editSupPin, setEditSupPin] = useState('');
  const [editSupCanConfigure, setEditSupCanConfigure] = useState(true);

  const [isAddingPresetShift, setIsAddingPresetShift] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetCode, setNewPresetCode] = useState('');
  const [newPresetNotes, setNewPresetNotes] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetName, setEditPresetName] = useState('');
  const [editPresetCode, setEditPresetCode] = useState('');
  const [editPresetNotes, setEditPresetNotes] = useState('');

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

      {/* Store Settings Form */}
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
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ثيم ومظهر برنامج المفكر المحاسبي
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                متوافق بالكامل مع هوية وشعار البرنامج
              </span>
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
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      كحلي داكن مع لمسات ذهبية براقة مطابقة للشعار
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
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      رمادي فاتح نقي مع إبراز هوية المفكر سمارت
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
              <span className="text-[10px] text-slate-400 mt-1 block">
                اختيار (58mm) يقوم بضبط هوامش الفاتورة لتلائم طابعات الإيصالات الصغيرة وتفادي اقتطاع الأسعار.
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 block">
                    الطباعة الفورية الصامتة للكاشير (Direct POS Printing)
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    إرسال أمر الطباعة مباشرة لطابعة الكاشير وتجاوز نافذة الحوار عند حفظ الفاتورة
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={directPrintEnabled}
                  onChange={(e) => setDirectPrintEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="pt-3 border-t border-slate-200/80">
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                <span>تحديد طابعة الفواتير المباشرة (لتسريع خروج الوصل في أقل من ثانية):</span>
                {isLoadingPrinters && (
                  <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-normal">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    جاري فحص الطابعات...
                  </span>
                )}
              </label>
              <select
                value={selectedPrinterName}
                onChange={(e) => setSelectedPrinterName(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- استخدام الطابعة الافتراضية للنظام (Default Printer) --</option>
                {availablePrinters.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName || p.name} {p.isDefault ? '(الافتراضية الحالية)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-800 block">
                نظام البيع بالجملة وأسعار الجملة
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div
                onClick={() => setEnableWholesale(true)}
                className={`p-3 rounded-lg border cursor-pointer transition select-none flex items-start gap-2.5 ${
                  enableWholesale
                    ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-slate-100/70 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="wholesaleMode"
                  checked={enableWholesale}
                  onChange={() => setEnableWholesale(true)}
                  className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    محل يبيع جملة ومفرد (تفعيل الجملة)
                  </div>
                </div>
              </div>

              <div
                onClick={() => setEnableWholesale(false)}
                className={`p-3 rounded-lg border cursor-pointer transition select-none flex items-start gap-2.5 ${
                  !enableWholesale
                    ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-100/70 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="wholesaleMode"
                  checked={!enableWholesale}
                  onChange={() => setEnableWholesale(false)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    محل مفرد وتجزئة فقط (إلغاء بيع الجملة)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    ميزة بيع القوائم بواسطة المندوبين وتحديد الأرباح والعمولات
                  </h3>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enableSalesReps}
                  onChange={(e) => setEnableSalesReps(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {enableSalesReps && (
              <div className="pt-3 border-t border-indigo-100 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-indigo-200/80 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">إظهار اسم المندوب في القائمة المطبوعة</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={defaultShowRepOnInvoice}
                        onChange={(e) => setDefaultShowRepOnInvoice(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-indigo-200/80 flex flex-col justify-between">
                    <div className="text-xs font-bold text-slate-900 mb-1">طريقة احتساب النسبة الافتراضية للمندوب</div>
                    <select
                      value={repCommissionDefaultType}
                      onChange={(e) => setRepCommissionDefaultType(e.target.value as any)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="percentage_profit">نسبة من صافي الربح (تقتطع من هامش الربح فقط)</option>
                      <option value="percentage_sales">نسبة من إجمالي المبيعات (تقتطع من قيمة الفاتورة)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-800 block">
                نظام عرض شاشة الكمبيوتر (وضع الحاسبة)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div
                onClick={() => setDesktopLayout('full')}
                className={`p-3 rounded-lg border cursor-pointer transition select-none flex items-start gap-2.5 ${
                  desktopLayout === 'full'
                    ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-100/70 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="desktopLayoutMode"
                  checked={desktopLayout === 'full'}
                  onChange={() => setDesktopLayout('full')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>وضع الكمبيوتر الكامل</span>
                  </div>
                </div>
              </div>

              <div
                onClick={() => setDesktopLayout('partial')}
                className={`p-3 rounded-lg border cursor-pointer transition select-none flex items-start gap-2.5 ${
                  desktopLayout === 'partial'
                    ? 'bg-white border-slate-700 ring-2 ring-slate-400/20 shadow-xs'
                    : 'bg-slate-100/70 border-slate-200 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="desktopLayoutMode"
                  checked={desktopLayout === 'partial'}
                  onChange={() => setDesktopLayout('partial')}
                  className="mt-0.5 text-slate-700 focus:ring-slate-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    وضع الكمبيوتر الجزئي
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modern vs Classic Invoice Template Selection */}
          <div className="bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 border-2 border-indigo-200/80 rounded-2xl p-5 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>تصميم وشكل ترويسة القائمة المطبوعة</span>
                  </h3>
                </div>
              </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setInvoiceTemplate('modern')}
                className={`p-3.5 rounded-xl border-2 transition cursor-pointer ${
                  invoiceTemplate === 'modern'
                    ? 'border-indigo-500 bg-white shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                    <span>🎨 التصميم العصري الملون</span>
                  </span>
                  <input
                    type="radio"
                    name="invoiceTemplateRadio"
                    checked={invoiceTemplate === 'modern'}
                    onChange={() => setInvoiceTemplate('modern')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div
                onClick={() => setInvoiceTemplate('classic')}
                className={`p-3.5 rounded-xl border-2 transition cursor-pointer ${
                  invoiceTemplate === 'classic'
                    ? 'border-slate-800 bg-white shadow-xs ring-2 ring-slate-800/20'
                    : 'border-slate-200 bg-white/60 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-slate-800">
                    🏛️ التصميم الكلاسيكي التقليدي
                  </span>
                  <input
                    type="radio"
                    name="invoiceTemplateRadio"
                    checked={invoiceTemplate === 'classic'}
                    onChange={() => setInvoiceTemplate('classic')}
                    className="text-slate-800 focus:ring-slate-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نص الختم الأيمن</label>
                <input
                  type="text"
                  value={headerRightSealText}
                  onChange={(e) => setHeaderRightSealText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نص الختم الأيسر</label>
                <input
                  type="text"
                  value={headerLeftSealText}
                  onChange={(e) => setHeaderLeftSealText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold"
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
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {bulkPriceSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
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
                className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 ${
                  priceDirection === 'increase' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-rose-600" />
                <span>تصعيد ورفع الأسعار (زيادة)</span>
              </button>

              <button
                type="button"
                onClick={() => setPriceDirection('decrease')}
                className={`p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 ${
                  priceDirection === 'decrease' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <TrendingDown className="w-4 h-4 text-blue-600" />
                <span>تخفيض الأسعار (نزول السوق)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={isApplyingBulkPrices || products.length === 0}
              onClick={handleApplyBulkPrices}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
            >
              تطبيق التعديل على الأسعار
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Security & Backup */}
      {(activeSettingsTab === 'security' || activeSettingsTab === 'all') && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-amber-700" />
              <h3 className="font-bold text-base text-slate-900">تغيير كلمة المرور / رمز الحساب</h3>
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
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة</label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة المرور</label>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
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

          {/* Permissions Matrix */}
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
                  className="text-[11px] text-emerald-700 font-bold underline"
                >
                  استعادة الضبط
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'canSell' as const, label: 'البيع وإعداد الفواتير الجديدة (POS)', desc: 'إنشاء وحفظ وطباعة القوائم' },
                  { key: 'canAddNewProduct' as const, label: 'إضافة مواد جديدة للمخزن', desc: 'إدخال المواد وتحديد أسعارها' },
                  { key: 'canViewCostPrice' as const, label: 'عرض أسعار التكلفة والشراء', desc: 'السماح برؤية سعر رأس المال في الجداول ونوافذ التعديل' },
                  { key: 'canEditProductPrice' as const, label: 'تعديل السعر في القائمة للزبون', desc: 'تعديل سعر المادة في القائمة النشطة' },
                  { key: 'canViewInvoices' as const, label: 'الدخول لسجل الفواتير ومعاينة القوائم', desc: 'معاينة القوائم السابقة' },
                  { key: 'canAccessInventory' as const, label: 'الدخول لقسم المواد والمخزون', desc: 'معاينة الأصناف وجرد الكميات' },
                  { key: 'canReturnInvoice' as const, label: 'استعادة الفواتير وإرجاع المواد', desc: 'إرجاع القوائم' },
                  { key: 'canDeleteInvoice' as const, label: 'حذف القوائم نهائياً', desc: 'حذف سجلات الفواتير' },
                  { key: 'canViewCustomers' as const, label: 'الدخول لسجل الزبائن وحسابات الديون', desc: 'رؤية كشوفات الديون' },
                  { key: 'canViewReports' as const, label: 'الدخول لسجل الأرباح والتقارير المالية', desc: 'أرباح المتجر ورأس المال' },
                  { key: 'canAccessShifts' as const, label: 'الدخول لسجل وتبويب الشفتات', desc: 'معاينة شفتات العمل' },
                  { key: 'canManageShifts' as const, label: 'بدء وإنهاء الشفتات والورديات', desc: 'تشغيل مؤقت الشفت وإنهائه' },
                  { key: 'canAccessSettings' as const, label: 'الدخول لشاشة الإعدادات العامة', desc: 'إعدادات النظام والنسخ الاحتياطي' },
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
                  className="text-[11px] text-blue-700 font-bold underline"
                >
                  استعادة الضبط
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { key: 'canSell' as const, label: 'البيع وإعداد الفواتير الجديدة (POS)', desc: 'إنشاء وحفظ وطباعة القوائم' },
                  { key: 'canAddNewProduct' as const, label: 'إضافة مواد جديدة للمخزن', desc: 'إدخال المواد وتعديل أسعارها' },
                  { key: 'canViewCostPrice' as const, label: 'عرض أسعار التكلفة والشراء', desc: 'السماح برؤية سعر رأس المال في الجداول ونوافذ التعديل' },
                  { key: 'canEditProductPrice' as const, label: 'تعديل السعر في القائمة للزبون', desc: 'تعديل سعر المادة في القائمة النشطة' },
                  { key: 'canViewInvoices' as const, label: 'الدخول لسجل الفواتير ومعاينة القوائم', desc: 'معاينة وطباعة القوائم' },
                  { key: 'canReturnInvoice' as const, label: 'استعادة الفواتير وإرجاع المواد', desc: 'إلغاء البيع واسترجاع البضاعة' },
                  { key: 'canViewCustomers' as const, label: 'الدخول لسجل الزبائن وحسابات الديون', desc: 'متابعة حسابات الزبائن' },
                  { key: 'canAccessInventory' as const, label: 'الدخول لقسم المواد والمخزون', desc: 'معاينة المخزن وجرد الأصناف' },
                  { key: 'canAccessShifts' as const, label: 'الدخول لسجل وتبويب الشفتات', desc: 'معاينة شفتات العمل' },
                  { key: 'canManageShifts' as const, label: 'بدء وإنهاء الشفتات والورديات', desc: 'تشغيل مؤقت الشفت وإنهائه' },
                  { key: 'canDeleteInvoice' as const, label: 'حذف القوائم نهائياً', desc: 'حذف سجلات الفواتير' },
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

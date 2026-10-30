import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Invoice } from '../types';
import { 
  X, 
  Printer, 
  Check, 
  FileText, 
  Receipt, 
  FileDown, 
  RefreshCw, 
  Info, 
  ArrowDownAZ,
  PackageMinus,
  Sparkles
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { PartialReturnModal } from './PartialReturnModal';
import { ModernInvoiceHeader } from './ModernInvoiceHeader';

interface InvoicePrintModalProps {
  invoice: Invoice | null;
  onClose: () => void;
}

const StarburstSeal: React.FC<{ text: string }> = ({ text }) => (
  <div className="relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 select-none shrink-0">
    <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-black stroke-[2]">
      <polygon points="50,2 62,18 82,10 83,31 99,38 89,55 99,71 83,78 82,98 62,91 50,106 38,91 18,98 17,78 1,71 11,55 1,38 17,31 18,10 38,18" />
    </svg>
    <span className="absolute font-black text-xs sm:text-sm text-black" style={{ letterSpacing: 'normal' }}>{text}</span>
  </div>
);

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ invoice, onClose }) => {
  const { settings, hasPermission } = useApp();
  const [activeTemplate, setActiveTemplate] = useState<'classic' | 'modern'>(
    settings.invoiceTemplate || 'modern'
  );

  useEffect(() => {
    if (settings.invoiceTemplate) {
      setActiveTemplate(settings.invoiceTemplate);
    }
  }, [settings.invoiceTemplate]);

  const [printLayout, setPrintLayout] = useState<'a4' | 'a5' | 'thermal80' | 'thermal58'>(
    settings.printFormat === 'thermal58'
      ? 'thermal58'
      : settings.printFormat === 'thermal' || settings.printFormat === 'thermal80'
      ? 'thermal80'
      : settings.printFormat === 'a5'
      ? 'a5'
      : 'a4'
  );
  const [sortByAlphabet, setSortByAlphabet] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [isPartialReturnOpen, setIsPartialReturnOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (!invoice) return null;

  const isThermal = printLayout === 'thermal80' || printLayout === 'thermal58';
  const is58mm = printLayout === 'thermal58';

  const dateObj = new Date(invoice.date);
  const arabicDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayName = arabicDays[dateObj.getDay()];

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dateFormatted = `${year}/${month}/${day}`;

  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  const timeFormatted = `${hours}:${minutes}:${seconds}`;

  const invoiceTotal = invoice.total;
  const previousDebt = invoice.previousDebt || 0;
  const grandTotal = invoiceTotal + previousDebt;
  const paid = invoice.paidAmount;
  const totalRemainingDebt = Math.max(0, grandTotal - paid);
  const currencyLabel = settings.currency || 'د.ع';

  const displayedItems = sortByAlphabet
    ? [...invoice.items].sort((a, b) => {
        const nameA = a.name || a.productName || '';
        const nameB = b.name || b.productName || '';
        return nameA.localeCompare(nameB, 'ar');
      })
    : invoice.items;

  // توليد ملف PDF كامل الارتفاع دون قص وبدون تشويه الخطوط
  const generateInvoicePDF = async (): Promise<{ base64: string; blob: Blob; fileName: string } | null> => {
    const originalElement = document.getElementById('printable-invoice');
    if (!originalElement) return null;

    // 1. إنشاء نسخة طبق الأصل خارج إطار العرض لتحرير كامل الارتفاع
    const clone = originalElement.cloneNode(true) as HTMLElement;
    const isA4 = printLayout === 'a4';
    const isA5 = printLayout === 'a5';
    const is80 = printLayout === 'thermal80';

    // العرض القياسي الدقيق بالبكسل لتفادي أي ضغط للنصوص
    const targetPixelWidth = is58mm ? 384 : is80 ? 576 : isA5 ? 595 : 794;

    clone.style.width = `${targetPixelWidth}px`;
    clone.style.maxWidth = `${targetPixelWidth}px`;
    clone.style.minWidth = `${targetPixelWidth}px`;
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.position = 'fixed';
    clone.style.top = '-99999px';
    clone.style.left = '0';
    clone.style.zIndex = '-9999';
    clone.style.background = '#ffffff';
    clone.style.transform = 'none';

    // إزالة قيود الارتفاع من كل العناصر التابعة
    const allChildren = clone.querySelectorAll('*');
    allChildren.forEach((child) => {
      const el = child as HTMLElement;
      el.style.overflow = 'visible';
      el.style.maxHeight = 'none';
    });

    document.body.appendChild(clone);

    let dataUrl = '';
    let naturalWidth = 0;
    let naturalHeight = 0;

    try {
      dataUrl = await toPng(clone, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: true,
        style: {
          letterSpacing: 'normal',
          wordSpacing: 'normal',
          fontFamily: "'Cairo', 'Tajawal', Tahoma, Arial, sans-serif",
        },
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      naturalWidth = img.naturalWidth || targetPixelWidth;
      naturalHeight = img.naturalHeight || clone.scrollHeight;
    } finally {
      document.body.removeChild(clone);
    }

    const fileName = `قائمة_${invoice.invoiceNumber}.pdf`;
    let pdf: jsPDF;

    if (is58mm) {
      const margin = 2;
      const mmWidth = 48;
      const mmHeight = (naturalHeight * mmWidth) / naturalWidth;
      pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, mmHeight + margin * 2] });
      pdf.addImage(dataUrl, 'PNG', 5, margin, mmWidth, mmHeight, undefined, 'FAST');
    } else if (is80) {
      const margin = 3;
      const mmWidth = 72;
      const mmHeight = (naturalHeight * mmWidth) / naturalWidth;
      pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, mmHeight + margin * 2] });
      pdf.addImage(dataUrl, 'PNG', 4, margin, mmWidth, mmHeight, undefined, 'FAST');
    } else if (isA5) {
      // صفحة A5 (148 × 210 ملم) بنظام الصفحات المتعددة
      const pdfPageWidth = 148;
      const pdfPageHeight = 210;
      const margin = 5;
      const printableWidth = pdfPageWidth - margin * 2;
      const totalImgHeight = (naturalHeight * printableWidth) / naturalWidth;

      pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

      let heightLeft = totalImgHeight;
      let positionY = margin;

      pdf.addImage(dataUrl, 'PNG', margin, positionY, printableWidth, totalImgHeight, undefined, 'FAST');
      heightLeft -= (pdfPageHeight - margin * 2);

      while (heightLeft > 0) {
        positionY = margin - (totalImgHeight - heightLeft);
        pdf.addPage('a5', 'portrait');
        pdf.addImage(dataUrl, 'PNG', margin, positionY, printableWidth, totalImgHeight, undefined, 'FAST');
        heightLeft -= (pdfPageHeight - margin * 2);
      }
    } else {
      // صفحة A4 (210 × 297 ملم) بنظام الصفحات المتعددة التلقائي
      const pdfPageWidth = 210;
      const pdfPageHeight = 297;
      const margin = 6;
      const printableWidth = pdfPageWidth - margin * 2;
      const totalImgHeight = (naturalHeight * printableWidth) / naturalWidth;

      pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      let heightLeft = totalImgHeight;
      let positionY = margin;

      pdf.addImage(dataUrl, 'PNG', margin, positionY, printableWidth, totalImgHeight, undefined, 'FAST');
      heightLeft -= (pdfPageHeight - margin * 2);

      while (heightLeft > 0) {
        positionY = margin - (totalImgHeight - heightLeft);
        pdf.addPage('a4', 'portrait');
        pdf.addImage(dataUrl, 'PNG', margin, positionY, printableWidth, totalImgHeight, undefined, 'FAST');
        heightLeft -= (pdfPageHeight - margin * 2);
      }
    }

    const base64 = pdf.output('datauristring').split(',')[1];
    const blob = pdf.output('blob');
    return { base64, blob, fileName };
  };

  // دالة الحفظ المباشر داخل ملفات الهاتف (Downloads) أو مشاركة الملف
  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    setPdfNotice('جاري حفظ مستند PDF الكامل...');
    try {
      const pdfData = await generateInvoicePDF();
      if (!pdfData) return;

      const isNativeApp = Boolean((window as any).Capacitor?.isNativePlatform?.());

      if (isNativeApp) {
        try {
          const savedFile = await Filesystem.writeFile({
            path: pdfData.fileName,
            data: pdfData.base64,
            directory: Directory.Documents,
            recursive: true
          });

          await Share.share({
            title: `حفظ قائمة ${invoice.invoiceNumber}`,
            text: `تم حفظ القائمة رقم ${invoice.invoiceNumber}`,
            url: savedFile.uri,
            dialogTitle: 'اختر مجلد الحفظ أو التطبيق لفتح القائمة'
          });

          setPdfNotice('تم حفظ ومشاركة الملف بنجاح!');
          setTimeout(() => setPdfNotice(null), 4000);
          return;
        } catch (nativeErr) {
          console.warn('Filesystem error, trying fallback download:', nativeErr);
        }
      }

      // للكمبيوتر والمتصفحات
      const url = URL.createObjectURL(pdfData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfData.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfNotice('تم تحميل ملف PDF الكامل بنجاح');
      setTimeout(() => setPdfNotice(null), 3000);
    } catch (err: any) {
      console.error(err);
      setPdfNotice('حدث خطأ أثناء تنزيل الملف');
      setTimeout(() => setPdfNotice(null), 3000);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // دالة الطباعة: متوافقة مع Electron و Android و Web
  const handlePrint = async () => {
    if ((window as any).electronAPI?.printInvoice) {
      try {
        (window as any).electronAPI.printInvoice();
        return;
      } catch (e) {
        console.warn('Electron print fallback', e);
      }
    }

    const isNativeApp = Boolean((window as any).Capacitor?.isNativePlatform?.());

    if (isNativeApp) {
      setIsGeneratingPDF(true);
      setPdfNotice('جاري إرسال القائمة للطباعة...');
      try {
        const pdfData = await generateInvoicePDF();
        if (pdfData) {
          const savedFile = await Filesystem.writeFile({
            path: `طباعة_${pdfData.fileName}`,
            data: pdfData.base64,
            directory: Directory.Cache
          });

          await Share.share({
            title: `طباعة قائمة ${invoice.invoiceNumber}`,
            url: savedFile.uri,
            dialogTitle: 'اختر خدمة الطباعة أو طابعتك'
          });
          return;
        }
      } catch (e) {
        console.error('Print share error:', e);
      } finally {
        setIsGeneratingPDF(false);
        setPdfNotice(null);
      }
    }

    window.print();
  };

  const handleShareWhatsApp = async () => {
    let summaryText = `📋 *فاتورة مبيعات: ${settings.storeName}*\n`;
    summaryText += `رقم القائمة: ${invoice.invoiceNumber}\n`;
    summaryText += `التاريخ: ${dayName} ${dateFormatted}\n`;
    summaryText += `حضرة السيد: ${invoice.customerName}\n`;
    summaryText += `المبلغ المطلوب: ${invoice.total.toLocaleString()} ${currencyLabel}\n`;
    if (totalRemainingDebt > 0) {
      summaryText += `مجموع الديون بذمة العميل: ${totalRemainingDebt.toLocaleString()} ${currencyLabel}\n`;
    }

    let targetPhone = invoice.customerPhone ? invoice.customerPhone.replace(/[^0-9]/g, '') : '';
    if (targetPhone) {
      if (targetPhone.startsWith('00964')) {
        targetPhone = targetPhone.substring(2);
      } else if (targetPhone.startsWith('07') && targetPhone.length === 11) {
        targetPhone = '964' + targetPhone.substring(1);
      } else if (targetPhone.startsWith('7') && targetPhone.length === 10) {
        targetPhone = '964' + targetPhone;
      }
    }

    const whatsappUrl = targetPhone
      ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(summaryText)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;

    window.open(whatsappUrl, '_system');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  return (
    <div className="print-modal-overlay fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="print-modal-card bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden">
        
        {/* شريط التحكم العلوي */}
        <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5 no-print">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">تنسيق الطباعة:</span>
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPrintLayout('a4')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                    printLayout === 'a4' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>A4</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintLayout('a5')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition cursor-pointer ${
                    printLayout === 'a5' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>A5</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintLayout('thermal80')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md transition cursor-pointer ${
                    printLayout === 'thermal80' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>80mm</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintLayout('thermal58')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md transition cursor-pointer ${
                    printLayout === 'thermal58' ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-500/40' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>58mm</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-r border-slate-300 pr-2.5 sm:mr-1">
              <span className="text-xs font-bold text-slate-700">شكل القائمة:</span>
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTemplate('classic')}
                  className={`px-2 py-1 rounded-md transition cursor-pointer ${
                    activeTemplate === 'classic' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  كلاسيكي
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTemplate('modern')}
                  className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                    activeTemplate === 'modern' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>عصري ملون</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-r border-slate-300 pr-2.5 sm:mr-1">
              <label 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition select-none shadow-2xs ${
                  sortByAlphabet
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500/30'
                    : 'bg-white border-slate-300 hover:border-slate-400 text-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sortByAlphabet}
                  onChange={(e) => setSortByAlphabet(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                />
                <ArrowDownAZ className={`w-4 h-4 ${sortByAlphabet ? 'text-emerald-600' : 'text-slate-500'}`} />
                <span>ترتيب أبجدي (أ - ي)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isGeneratingPDF}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              {isGeneratingPDF ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Printer className="w-4 h-4" />}
              <span>طباعة القائمة</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              {isGeneratingPDF ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" /> : <FileDown className="w-3.5 h-3.5 text-emerald-700" />}
              <span>حفظ PDF</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-400 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
              <span>واتساب</span>
            </button>

            {hasPermission('canReturnInvoice') && invoice.status !== 'returned' && (
              <button
                type="button"
                onClick={() => setIsPartialReturnOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <PackageMinus className="w-3.5 h-3.5 text-indigo-600" />
                <span>استرجاع جزئي</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {pdfNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 flex items-center justify-between no-print animate-fadeIn">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{pdfNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setPdfNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 text-[11px] underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        <div 
          ref={scrollContainerRef}
          className="print-invoice-scroll-area flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/80 flex justify-center print:p-0 print:m-0 print:bg-transparent print:overflow-visible print:block"
        >
          <div
            id="printable-invoice"
            dir="rtl"
            style={{ letterSpacing: 'normal' }}
            className={`bg-white shadow-xl text-black mx-auto transition-all print:p-0 print:m-0 print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none ${
              is58mm
                ? 'w-[230px] p-2 rounded-lg border border-slate-400 font-mono text-[10px]'
                : printLayout === 'thermal80'
                ? 'w-[320px] p-4 rounded-lg border border-slate-400 font-mono text-xs'
                : printLayout === 'a5'
                ? 'w-full max-w-[640px] p-4 sm:p-6 rounded-lg border border-slate-400 font-sans text-xs'
                : 'w-full max-w-[820px] p-5 sm:p-8 rounded-lg border border-slate-400 font-sans text-xs'
            }`}
          >

            {!isThermal ? (
              <div className="space-y-2.5 text-black leading-tight">
                {activeTemplate === 'modern' ? (
                  <ModernInvoiceHeader
                    settings={settings}
                    invoiceNumber={invoice.invoiceNumber}
                    isThermal={false}
                  />
                ) : (
                  <div className="border border-black rounded-md p-2.5 sm:p-3 relative flex flex-col items-center justify-center text-center">
                    <div className="absolute right-2.5 top-2">
                      <StarburstSeal text={settings.headerRightSealText || (settings.enableWholesale ? "جملة" : "تجزئة")} />
                    </div>
                    <div className="absolute left-2.5 top-2">
                      <StarburstSeal text={settings.headerLeftSealText || "مفرد"} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-black">
                      {settings.storeName || 'المحل'}
                    </h1>
                    <div className="text-xs sm:text-sm font-bold text-black mt-1">
                      {settings.managerLabel || 'بإدارة'}: {settings.ownerName || settings.storeName} · {settings.businessSubtitle || 'تجارة عامة'}
                    </div>
                  </div>
                )}

                <div className="border border-black rounded-md px-3 py-1.5 flex items-center justify-between text-xs font-bold text-black flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span>رقم القائمة:</span>
                    <span className="font-mono text-sm underline">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>التاريخ:</span>
                    <span>{dayName}</span>
                    <span className="font-mono">{dateFormatted}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>السيد:</span>
                    <span className="font-bold underline">{invoice.customerName}</span>
                  </div>
                </div>

                <div className="border border-black rounded-md overflow-hidden">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-black text-black font-black">
                        <th className="py-1 px-2 border-l border-black text-center w-8">ت</th>
                        <th className="py-1 px-2 border-l border-black">اسم المادة</th>
                        <th className="py-1 px-2 border-l border-black text-center w-16">العدد</th>
                        <th className="py-1 px-2 border-l border-black text-center w-24">السعر</th>
                        <th className="py-1 px-2 text-center w-28">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedItems.map((item, index) => {
                        const returnedQty = item.returnedQuantity || 0;
                        const netQty = Math.max(0, item.quantity - returnedQty);
                        return (
                          <tr key={index} className="border-b border-black/40 font-bold">
                            <td className="py-1 px-2 border-l border-black text-center font-mono">{index + 1}</td>
                            <td className="py-1 px-2 border-l border-black">
                              <div>{item.name || item.productName}</div>
                            </td>
                            <td className="py-1 px-2 border-l border-black text-center font-mono">
                              {item.isWeighted ? `${item.quantity} كغم` : netQty}
                            </td>
                            <td className="py-1 px-2 border-l border-black text-center font-mono">{item.unitPrice.toLocaleString()}</td>
                            <td className="py-1 px-2 text-center font-mono">{Math.round(netQty * item.unitPrice).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-start gap-3 pt-1">
                  <div className="text-[11px] text-slate-700 flex-1">
                    {settings.invoiceFooterNote && (
                      <p className="border border-slate-300 rounded p-2 bg-slate-50 font-bold">
                        {settings.invoiceFooterNote}
                      </p>
                    )}
                  </div>

                  <div className="w-64 border border-black rounded-md overflow-hidden shrink-0">
                    <table className="w-full text-right border-collapse text-xs font-bold">
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="py-1 px-2 border-l border-black bg-slate-100">مجموع القائمة</td>
                          <td className="py-1 px-2 font-mono text-left">{invoiceTotal.toLocaleString()} {currencyLabel}</td>
                        </tr>
                        {previousDebt > 0 && (
                          <tr className="border-b border-black">
                            <td className="py-1 px-2 border-l border-black bg-slate-100">حساب سابق</td>
                            <td className="py-1 px-2 font-mono text-left">{previousDebt.toLocaleString()} {currencyLabel}</td>
                          </tr>
                        )}
                        <tr className="border-b border-black bg-slate-50 font-black">
                          <td className="py-1 px-2 border-l border-black">المجموع الكلي</td>
                          <td className="py-1 px-2 font-mono text-left text-sm">{grandTotal.toLocaleString()} {currencyLabel}</td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="py-1 px-2 border-l border-black bg-slate-100">الواصل</td>
                          <td className="py-1 px-2 font-mono text-left text-emerald-700">{paid.toLocaleString()} {currencyLabel}</td>
                        </tr>
                        <tr className="bg-slate-100 font-black">
                          <td className="py-1 px-2 border-l border-black">الباقي</td>
                          <td className="py-1 px-2 font-mono text-left text-rose-700">{totalRemainingDebt.toLocaleString()} {currencyLabel}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between pt-4 px-4 text-xs font-bold">
                  <div>توقيع المستلم: .....................</div>
                  <div>توقيع البائع: .....................</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-black font-mono leading-tight">
                {activeTemplate === 'modern' ? (
                  <ModernInvoiceHeader
                    settings={settings}
                    invoiceNumber={invoice.invoiceNumber}
                    isThermal={true}
                  />
                ) : (
                  <div className="text-center border-b border-black pb-2">
                    <h1 className={`font-black ${is58mm ? 'text-sm' : 'text-base'}`}>
                      {settings.storeName || 'المحل'}
                    </h1>
                    <p className="text-[10px] mt-0.5">{settings.businessSubtitle || 'وصل مبيعات'}</p>
                    {settings.phone && <p className="text-[10px] mt-0.5">هاتف: {settings.phone}</p>}
                  </div>
                )}

                <div className="text-[10px] border-b border-dashed border-black pb-1.5 space-y-0.5">
                  <div className="flex justify-between">
                    <span>رقم القائمة:</span>
                    <span className="font-bold">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>التاريخ:</span>
                    <span>{dateFormatted} {timeFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>العميل:</span>
                    <span className="font-bold">{invoice.customerName}</span>
                  </div>
                </div>

                <table className="w-full text-right text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-black font-black">
                      <th className="py-1">المادة</th>
                      <th className="py-1 text-center w-8">ع</th>
                      <th className="py-1 text-left w-14">المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedItems.map((item, index) => {
                      const returnedQty = item.returnedQuantity || 0;
                      const netQty = Math.max(0, item.quantity - returnedQty);
                      return (
                        <tr key={index} className="border-b border-dotted border-black/50">
                          <td className="py-0.5 leading-tight">
                            <div>{item.name || item.productName}</div>
                          </td>
                          <td className="py-0.5 text-center font-bold">
                            {item.isWeighted ? `${item.quantity} كغم` : netQty}
                          </td>
                          <td className="py-0.5 text-left font-bold">{Math.round(netQty * item.unitPrice).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="border-t border-black pt-1.5 space-y-1 text-[11px] font-bold">
                  <div className="flex justify-between">
                    <span>مجموع القائمة:</span>
                    <span>{invoiceTotal.toLocaleString()} {currencyLabel}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black border-t border-dotted border-black pt-1">
                    <span>الإجمالي:</span>
                    <span>{grandTotal.toLocaleString()} {currencyLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الواصل:</span>
                    <span>{paid.toLocaleString()} {currencyLabel}</span>
                  </div>
                  <div className="flex justify-between border-t border-black pt-1 font-black">
                    <span>المتبقي:</span>
                    <span>{totalRemainingDebt.toLocaleString()} {currencyLabel}</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      <PartialReturnModal
        invoice={invoice}
        isOpen={isPartialReturnOpen}
        onClose={() => setIsPartialReturnOpen(false)}
        onSuccess={() => {
          setIsPartialReturnOpen(false);
          onClose();
        }}
      />

    </div>
  );
};

export default InvoicePrintModal;

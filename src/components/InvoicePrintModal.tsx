import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  <div className="relative flex items-center justify-center w-12 h-12 select-none shrink-0">
    <svg viewBox="0 0 100 100" className="w-full h-full fill-none stroke-black stroke-[2]">
      <polygon points="50,2 62,18 82,10 83,31 99,38 89,55 99,71 83,78 82,98 62,91 50,106 38,91 18,98 17,78 1,71 11,55 1,38 17,31 18,10 38,18" />
    </svg>
    <span className="absolute font-black text-[11px] text-black" style={{ letterSpacing: 'normal' }}>{text}</span>
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
  const pagesContainerRef = useRef<HTMLDivElement>(null);

  const isThermal = printLayout === 'thermal80' || printLayout === 'thermal58';
  const is58mm = printLayout === 'thermal58';

  const displayedItems = useMemo(() => {
    if (!invoice?.items) return [];
    return sortByAlphabet
      ? [...invoice.items].sort((a, b) => {
          const nameA = a.name || a.productName || '';
          const nameB = b.name || b.productName || '';
          return nameA.localeCompare(nameB, 'ar');
        })
      : invoice.items;
  }, [invoice?.items, sortByAlphabet]);

  // زيادة عدد المواد لاستغلال مساحة الصفحة بالكامل مع أمان لمنع قطع السطر الأخير
  const ITEMS_PER_FIRST_PAGE = printLayout === 'a5' ? 18 : 32;
  const ITEMS_PER_SUB_PAGE = printLayout === 'a5' ? 24 : 40;

  const paginatedPages = useMemo(() => {
    if (!invoice) return [];
    if (isThermal) {
      return [{ items: displayedItems, startIndex: 0, isFirst: true, isLast: true }];
    }

    const pages = [];
    let currentIndex = 0;

    // الصفحة الأولى
    const firstPageItems = displayedItems.slice(0, ITEMS_PER_FIRST_PAGE);
    currentIndex += firstPageItems.length;
    pages.push({
      items: firstPageItems,
      startIndex: 0,
      isFirst: true,
      isLast: currentIndex >= displayedItems.length
    });

    // الصفحات اللاحقة
    while (currentIndex < displayedItems.length) {
      const nextBatch = displayedItems.slice(currentIndex, currentIndex + ITEMS_PER_SUB_PAGE);
      const isLast = (currentIndex + nextBatch.length) >= displayedItems.length;
      pages.push({
        items: nextBatch,
        startIndex: currentIndex,
        isFirst: false,
        isLast: isLast
      });
      currentIndex += nextBatch.length;
    }

    return pages;
  }, [invoice, displayedItems, isThermal, printLayout, ITEMS_PER_FIRST_PAGE, ITEMS_PER_SUB_PAGE]);

  if (!invoice) return null;

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

  // توليد PDF متعدد الصفحات بدقة واضحة ودون قطع ميكانيكي
  const generateInvoicePDF = async (): Promise<{ base64: string; blob: Blob; fileName: string } | null> => {
    const pageElements = document.querySelectorAll('.printable-invoice-page');
    if (!pageElements || pageElements.length === 0) return null;

    const isA5 = printLayout === 'a5';
    const pdfFormat = isA5 ? 'a5' : 'a4';
    const pdf = new jsPDF({ 
      orientation: 'portrait', 
      unit: 'mm', 
      format: is58mm ? [58, 200] : printLayout === 'thermal80' ? [80, 250] : pdfFormat 
    });

    const pdfPageWidth = is58mm ? 58 : printLayout === 'thermal80' ? 80 : isA5 ? 148 : 210;
    const margin = isThermal ? 3 : 5;
    const printWidth = pdfPageWidth - margin * 2;

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i] as HTMLElement;

      const dataUrl = await toPng(pageEl, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          transform: 'none',
          letterSpacing: 'normal',
          wordSpacing: 'normal',
        }
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((r) => { img.onload = r; });

      const imgHeightMm = (img.naturalHeight * printWidth) / img.naturalWidth;

      if (isThermal) {
        const thermalPdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [pdfPageWidth, imgHeightMm + margin * 2]
        });
        thermalPdf.addImage(dataUrl, 'PNG', margin, margin, printWidth, imgHeightMm, undefined, 'FAST');
        const base64 = thermalPdf.output('datauristring').split(',')[1];
        const blob = thermalPdf.output('blob');
        return { base64, blob, fileName: `قائمة_${invoice.invoiceNumber}.pdf` };
      }

      if (i > 0) {
        pdf.addPage(pdfFormat, 'portrait');
      }

      pdf.addImage(dataUrl, 'PNG', margin, margin, printWidth, imgHeightMm, undefined, 'FAST');
    }

    const fileName = `قائمة_${invoice.invoiceNumber}.pdf`;
    const base64 = pdf.output('datauristring').split(',')[1];
    const blob = pdf.output('blob');
    return { base64, blob, fileName };
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    setPdfNotice('جاري إنشاء ملف PDF بصفحات متناسقة...');
    try {
      const pdfData = await generateInvoicePDF();
      if (!pdfData) {
        setPdfNotice('حدث خطأ أثناء المعالجة، يرجى المحاولة ثانية');
        setTimeout(() => setPdfNotice(null), 3000);
        return;
      }

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

          setPdfNotice('تم حفظ الملف بنجاح!');
          setTimeout(() => setPdfNotice(null), 4000);
          return;
        } catch (nativeErr) {
          console.warn('Filesystem error, falling back:', nativeErr);
        }
      }

      const url = URL.createObjectURL(pdfData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfData.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfNotice('تم تنزيل ملف PDF بنجاح');
      setTimeout(() => setPdfNotice(null), 3000);
    } catch (err: any) {
      console.error(err);
      setPdfNotice('حدث خطأ أثناء تنزيل الملف');
      setTimeout(() => setPdfNotice(null), 3000);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

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

        {/* عرض القوائم مقسمة لصفحات واقعية تمنع انقطاع السطور */}
        <div 
          ref={pagesContainerRef}
          className="print-invoice-scroll-area flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-300 flex flex-col items-center gap-6 print:p-0 print:m-0 print:bg-transparent print:block"
        >
          {paginatedPages.map((page, pageIdx) => (
            <div
              key={pageIdx}
              className={`printable-invoice-page bg-white shadow-xl text-black transition-all print:p-0 print:m-0 print:border-none print:shadow-none print:rounded-none print:w-full print:page-break-after-always ${
                is58mm
                  ? 'w-[230px] p-2 font-mono text-[9px]'
                  : printLayout === 'thermal80'
                  ? 'w-[320px] p-3 font-mono text-[10px]'
                  : printLayout === 'a5'
                  ? 'w-[560px] min-h-[792px] p-3.5 font-sans text-[10px] flex flex-col justify-between'
                  : 'w-[794px] min-h-[1123px] p-5 font-sans text-[11px] flex flex-col justify-between'
              }`}
            >
              <div className="space-y-2">
                {/* ترويسة الصفحة الأولى فقط */}
                {page.isFirst && (
                  <>
                    {!isThermal ? (
                      activeTemplate === 'modern' ? (
                        <ModernInvoiceHeader
                          settings={settings}
                          invoiceNumber={invoice.invoiceNumber}
                          isThermal={false}
                        />
                      ) : (
                        <div className="border border-black rounded p-2 relative flex flex-col items-center justify-center text-center">
                          <div className="absolute right-2 top-1.5">
                            <StarburstSeal text={settings.headerRightSealText || (settings.enableWholesale ? "جملة" : "تجزئة")} />
                          </div>
                          <div className="absolute left-2 top-1.5">
                            <StarburstSeal text={settings.headerLeftSealText || "مفرد"} />
                          </div>
                          <h1 className="text-lg font-black text-black">
                            {settings.storeName || 'المحل'}
                          </h1>
                          <div className="text-[11px] font-bold text-black mt-0.5">
                            {settings.managerLabel || 'بإدارة'}: {settings.ownerName || settings.storeName} · {settings.businessSubtitle || 'تجارة عامة'}
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="text-center border-b border-black pb-1.5 mb-1.5">
                        <h1 className={`font-black ${is58mm ? 'text-xs' : 'text-sm'}`}>
                          {settings.storeName || 'المحل'}
                        </h1>
                        <p className="text-[9px] mt-0.5">{settings.businessSubtitle || 'وصل مبيعات'}</p>
                      </div>
                    )}

                    {/* شريط معلومات الفاتورة */}
                    <div className="border border-black rounded px-2.5 py-1 flex items-center justify-between text-[11px] font-bold text-black flex-wrap">
                      <div><span>رقم القائمة: </span><span className="font-mono underline">{invoice.invoiceNumber}</span></div>
                      <div><span>التاريخ: </span><span>{dayName} </span><span className="font-mono">{dateFormatted}</span></div>
                      <div><span>السيد: </span><span className="underline">{invoice.customerName}</span></div>
                      {!isThermal && paginatedPages.length > 1 && (
                        <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono">
                          صفحة {pageIdx + 1} من {paginatedPages.length}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ترويسة مصغرة للصفحات التالية */}
                {!page.isFirst && !isThermal && (
                  <div className="border-b-2 border-black pb-1.5 flex items-center justify-between text-[11px] font-bold text-black">
                    <div>تابع قائمة: <span className="font-mono">{invoice.invoiceNumber}</span> - السيد: {invoice.customerName}</div>
                    <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono">
                      صفحة {pageIdx + 1} من {paginatedPages.length}
                    </div>
                  </div>
                )}

                {/* جدول المواد المعروضة مع عمود الملاحظات الجديد */}
                <div className="border border-black rounded overflow-hidden">
                  <table className="w-full text-right border-collapse text-[10.5px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-black text-black font-black">
                        <th className="py-1 px-1 border-l border-black text-center w-7">ت</th>
                        <th className="py-1 px-2 border-l border-black">اسم المادة</th>
                        <th className="py-1 px-1 border-l border-black text-center w-12">العدد</th>
                        <th className="py-1 px-2 border-l border-black text-center w-20">السعر</th>
                        <th className="py-1 px-2 border-l border-black text-center w-20">المبلغ</th>
                        {!isThermal && (
                          <th className="py-1 px-2 text-center w-28">الملاحظات</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {page.items.map((item, itemIdx) => {
                        const returnedQty = item.returnedQuantity || 0;
                        const netQty = Math.max(0, item.quantity - returnedQty);
                        const rowNumber = page.startIndex + itemIdx + 1;
                        return (
                          <tr key={itemIdx} className="border-b border-black/30 font-semibold leading-normal">
                            <td className="py-0.5 px-1 border-l border-black text-center font-mono text-[10px]">{rowNumber}</td>
                            <td className="py-0.5 px-2 border-l border-black">
                              <div>{item.name || item.productName}</div>
                            </td>
                            <td className="py-0.5 px-1 border-l border-black text-center font-mono">
                              {item.isWeighted ? `${item.quantity} كغم` : netQty}
                            </td>
                            <td className="py-0.5 px-2 border-l border-black text-center font-mono">{item.unitPrice.toLocaleString()}</td>
                            <td className="py-0.5 px-2 border-l border-black text-center font-mono font-bold">{Math.round(netQty * item.unitPrice).toLocaleString()}</td>
                            {!isThermal && (
                              <td className="py-0.5 px-2 text-center text-[10px] text-slate-700 truncate max-w-[120px]">
                                {(item as any).notes || '-'}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* يظهر جدول الحسابات والملاحظات والتوقيع فقط في الصفحة الأخيرة في أسفل الورقة */}
              {page.isLast && !isThermal && (
                <div className="space-y-2.5 pt-2 mt-auto">
                  <div className="flex justify-between items-start gap-3">
                    <div className="text-[10px] text-slate-700 flex-1">
                      {settings.invoiceFooterNote && (
                        <p className="border border-slate-300 rounded p-1.5 bg-slate-50 font-bold leading-relaxed">
                          {settings.invoiceFooterNote}
                        </p>
                      )}
                    </div>

                    <div className="w-56 border border-black rounded overflow-hidden shrink-0">
                      <table className="w-full text-right border-collapse text-[10.5px] font-bold">
                        <tbody>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-l border-black bg-slate-100">مجموع القائمة</td>
                            <td className="py-0.5 px-2 font-mono text-left">{invoiceTotal.toLocaleString()} {currencyLabel}</td>
                          </tr>
                          {previousDebt > 0 && (
                            <tr className="border-b border-black">
                              <td className="py-0.5 px-2 border-l border-black bg-slate-100">حساب سابق</td>
                              <td className="py-0.5 px-2 font-mono text-left">{previousDebt.toLocaleString()} {currencyLabel}</td>
                            </tr>
                          )}
                          <tr className="border-b border-black bg-slate-50 font-black">
                            <td className="py-0.5 px-2 border-l border-black">المجموع الكلي</td>
                            <td className="py-0.5 px-2 font-mono text-left text-xs">{grandTotal.toLocaleString()} {currencyLabel}</td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="py-0.5 px-2 border-l border-black bg-slate-100">الواصل</td>
                            <td className="py-0.5 px-2 font-mono text-left text-emerald-700">{paid.toLocaleString()} {currencyLabel}</td>
                          </tr>
                          <tr className="bg-slate-100 font-black">
                            <td className="py-0.5 px-2 border-l border-black">الباقي</td>
                            <td className="py-0.5 px-2 font-mono text-left text-rose-700">{totalRemainingDebt.toLocaleString()} {currencyLabel}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2 px-6 text-[10.5px] font-bold border-t border-black/40">
                    <div>توقيع المستلم: .....................</div>
                    <div>توقيع البائع: .....................</div>
                  </div>
                </div>
              )}

              {/* أسفل الفاتورة للورق الحراري */}
              {isThermal && (
                <div className="border-t border-black pt-1 mt-2 space-y-0.5 text-[10px] font-bold">
                  <div className="flex justify-between"><span>مجموع القائمة:</span><span>{invoiceTotal.toLocaleString()} {currencyLabel}</span></div>
                  <div className="flex justify-between text-[11px] font-black border-t border-dotted border-black pt-0.5"><span>الإجمالي:</span><span>{grandTotal.toLocaleString()} {currencyLabel}</span></div>
                  <div className="flex justify-between"><span>الواصل:</span><span>{paid.toLocaleString()} {currencyLabel}</span></div>
                  <div className="flex justify-between border-t border-black pt-0.5 font-black"><span>المتبقي:</span><span>{totalRemainingDebt.toLocaleString()} {currencyLabel}</span></div>
                </div>
              )}
            </div>
          ))}
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

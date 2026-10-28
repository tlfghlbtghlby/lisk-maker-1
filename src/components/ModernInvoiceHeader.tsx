import React from 'react';
import { StoreSettings } from '../types';
import { MapPin, Phone, Send, Facebook, MessageCircle, Instagram, QrCode, Truck } from 'lucide-react';

interface ModernInvoiceHeaderProps {
  settings: StoreSettings;
  invoiceNumber?: string | number;
  isThermal?: boolean;
}

// Preset Illustrations crafted for commercial retail receipts
const PresetCenterIllustration: React.FC<{ type?: string; className?: string }> = ({ type = 'mufakir', className = 'w-16 h-16' }) => {
  switch (type) {
    case 'mufakir':
      return (
        <img 
          src="/assets/aistudio/1792973910260_3946b0af.jpg" 
          alt="شعار المفكر المحاسبي" 
          className={`${className} object-cover rounded-xl`}
        />
      );
    case 'stationery':
      return (
        <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* School Bag / Stationery basket matching user's photo */}
          <rect x="22" y="42" width="76" height="66" rx="14" fill="#fbbf24" stroke="#d97706" strokeWidth="4" />
          <path d="M42 42V26C42 20.477 46.477 16 52 16H68C73.523 16 78 20.477 78 26V42" stroke="#d97706" strokeWidth="4" />
          {/* Pouch */}
          <rect x="36" y="60" width="48" height="34" rx="8" fill="#fef3c7" stroke="#d97706" strokeWidth="3" />
          <rect x="52" y="68" width="16" height="8" rx="3" fill="#ffffff" stroke="#b45309" strokeWidth="2" />
          {/* Pens, rulers, scissors sticking out */}
          <rect x="28" y="14" width="8" height="34" rx="3" fill="#38bdf8" stroke="#0284c7" strokeWidth="2.5" transform="rotate(-18 28 14)" />
          <rect x="46" y="8" width="7" height="38" rx="2" fill="#ef4444" stroke="#b91c1c" strokeWidth="2.5" transform="rotate(-5 46 8)" />
          <rect x="64" y="6" width="10" height="40" rx="2" fill="#10b981" stroke="#047857" strokeWidth="2.5" transform="rotate(8 64 6)" />
          <polygon points="80,12 88,10 92,38 84,40" fill="#a855f7" stroke="#7e22ce" strokeWidth="2.5" transform="rotate(20 84 20)" />
          {/* Ruler lines */}
          <line x1="66" y1="12" x2="72" y2="12" stroke="#ffffff" strokeWidth="2" />
          <line x1="66" y1="18" x2="70" y2="18" stroke="#ffffff" strokeWidth="2" />
          <line x1="66" y1="24" x2="72" y2="24" stroke="#ffffff" strokeWidth="2" />
        </svg>
      );
    case 'market':
      return (
        <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Shopping basket with groceries */}
          <path d="M20 45H100L90 100H30L20 45Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="4" />
          <path d="M38 45L54 18M82 45L66 18" stroke="#0369a1" strokeWidth="4" strokeLinecap="round" />
          <circle cx="45" cy="36" r="14" fill="#ef4444" stroke="#b91c1c" strokeWidth="3" />
          <rect x="62" y="24" width="22" height="30" rx="4" fill="#fbbf24" stroke="#d97706" strokeWidth="3" />
          <line x1="28" y1="65" x2="92" y2="65" stroke="#ffffff" strokeWidth="3" />
          <line x1="32" y1="80" x2="88" y2="80" stroke="#ffffff" strokeWidth="3" />
        </svg>
      );
    case 'hardware':
      return (
        <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Toolbox & Tools */}
          <rect x="20" y="44" width="80" height="60" rx="10" fill="#dc2626" stroke="#991b1b" strokeWidth="4" />
          <path d="M42 44V30C42 26 46 22 50 22H70C74 22 78 26 78 30V44" stroke="#991b1b" strokeWidth="4" />
          <rect x="36" y="62" width="48" height="12" rx="4" fill="#f3f4f6" stroke="#4b5563" strokeWidth="2" />
          {/* Crossed wrench & hammer */}
          <line x1="24" y1="20" x2="60" y2="44" stroke="#6b7280" strokeWidth="5" strokeLinecap="round" />
          <line x1="96" y1="20" x2="60" y2="44" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case 'gifts':
      return (
        <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Gift Box with Ribbon */}
          <rect x="25" y="48" width="70" height="58" rx="8" fill="#ec4899" stroke="#be185d" strokeWidth="4" />
          <rect x="20" y="36" width="80" height="18" rx="6" fill="#f43f5e" stroke="#9f1239" strokeWidth="4" />
          <rect x="53" y="36" width="14" height="70" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
          <path d="M60 36C50 18 36 24 45 34C52 42 60 36 60 36Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2.5" />
          <path d="M60 36C70 18 84 24 75 34C68 42 60 36 60 36Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2.5" />
        </svg>
      );
    case 'clothes':
      return (
        <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Fashion & Boutique */}
          <path d="M60 22C64 16 72 20 70 26C68 30 60 32 60 38" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
          <path d="M22 52L60 38L98 52L86 64L72 58V102H48V58L34 64L22 52Z" fill="#6366f1" stroke="#4338ca" strokeWidth="4" />
          <rect x="36" y="80" width="48" height="26" rx="6" fill="#fbbf24" stroke="#b45309" strokeWidth="3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* General Storefront */}
          <rect x="25" y="48" width="70" height="60" rx="8" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="4" />
          <path d="M20 48L30 26H90L100 48H20Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="4" />
          <rect x="46" y="66" width="28" height="42" fill="#ffffff" stroke="#1d4ed8" strokeWidth="3" />
        </svg>
      );
  }
};

export const ModernInvoiceHeader: React.FC<ModernInvoiceHeaderProps> = ({
  settings,
  invoiceNumber,
  isThermal = false,
}) => {
  const conf = settings.modernHeader || {};

  // Color tokens
  const rightBg = conf.rightBannerColor || '#1e40af'; // Royal Blue (اسم المحل)
  const leftBg = conf.leftBannerColor || '#ea580c'; // Warm Orange (المعلومات والأنشطة)
  const fontFamily = conf.fontFamily || 'Aref Ruqaa';
  const badgeText = conf.badgeText || 'قرطاسية';
  const activitiesText = conf.activitiesText || settings.businessSubtitle || 'بيع كافة القرطاسية والمستلزمات المدرسية والمكتبية والهدايا ولعب الأطفال';
  const badgeLeft = conf.badgeLeftText || settings.headerRightSealText || 'جملة';
  const badgeRight = conf.badgeRightText || settings.headerLeftSealText || 'مفرد';

  // Check if at least one social handle is configured to display
  const hasSocials = (
    ((conf.showTelegram ?? true) && !!conf.telegramHandle) ||
    ((conf.showFacebook ?? true) && !!conf.facebookName) ||
    ((conf.showWhatsapp ?? true) && !!conf.whatsappNumber) ||
    ((conf.showInstagram ?? true) && !!conf.instagramHandle)
  );

  return (
    <div className="w-full text-black select-none overflow-hidden rounded-xl border border-slate-300 shadow-xs mb-3 print:border-none print:shadow-none print:rounded-none">
      
      {/* 1. Unified Single Horizontal Header Bar (شريط واحد أفقي موحد يجمع اليمين والوسط واليسار) */}
      <div 
        className={`w-full relative flex flex-row items-stretch justify-between overflow-hidden ${
          isThermal ? 'min-h-[80px]' : 'min-h-[105px] sm:min-h-[120px]'
        }`}
      >
        {!isThermal ? (
          <>
            {/* RIGHT SIDE (اسم المحل + الدائرة البيضوية البيضاء فوقه - محاذاة للوسط) */}
            <div 
              className="flex-1 p-3 sm:p-4 flex flex-col justify-center items-center text-center text-white relative z-0 transition-colors"
              style={{ backgroundColor: rightBg }}
            >
              {/* White Oval Badge above the name */}
              {badgeText && (
                <div className="inline-block bg-white text-slate-950 font-black text-[11px] sm:text-xs px-3.5 py-0.5 rounded-full shadow-xs mb-1.5 tracking-wider border border-white/60">
                  {badgeText}
                </div>
              )}

              {/* Main Store Name in chosen Arabic Calligraphy */}
              <h1 
                className="text-lg sm:text-2xl lg:text-3xl font-black text-white tracking-wide leading-tight drop-shadow-sm"
                style={{ fontFamily: fontFamily || 'Aref Ruqaa' }}
              >
                {settings.storeName || 'المتجر التجاري'}
              </h1>

              {/* Owner / Management Subtitle */}
              <div className="text-[10px] sm:text-[11px] text-white/95 font-bold mt-1">
                {settings.managerLabel || 'بإدارة'}: {settings.ownerName || settings.storeName}
              </div>
            </div>

            {/* CENTER IMAGE (الصورة الوسطية بين الاسمين في نفس مستوى الشريط) */}
            <div 
              className="relative z-10 flex items-center justify-center px-1.5 sm:px-3 self-center shrink-0"
              style={{
                background: `linear-gradient(to right, ${leftBg} 50%, ${rightBg} 50%)`,
                alignSelf: 'stretch',
              }}
            >
              <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white rounded-2xl p-1 sm:p-1.5 shadow-md border-2 border-white flex items-center justify-center my-auto transform hover:scale-105 transition-transform duration-200">
                {conf.centerIconType === 'custom' && conf.centerIconCustomUrl ? (
                  <img
                    src={conf.centerIconCustomUrl}
                    alt="شعار المتجر"
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <PresetCenterIllustration
                    type={conf.centerIconPreset || 'stationery'}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>

            {/* LEFT SIDE (المعلومات والأنشطة الأخرى + وسما الجملة والمفرد - محاذاة للوسط) */}
            <div 
              className="flex-1 p-3 sm:p-4 flex flex-col justify-center items-center text-center text-white relative z-0 transition-colors"
              style={{ backgroundColor: leftBg }}
            >
              {/* Activities and products text */}
              <div className="text-[11px] sm:text-xs md:text-sm font-black leading-relaxed tracking-wide text-white drop-shadow-xs max-w-sm sm:max-w-md">
                {activitiesText}
              </div>

              {/* Wholesale / Retail Badges */}
              <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                <span className="bg-white text-slate-900 font-extrabold text-[10px] sm:text-xs px-3 py-0.5 rounded-full shadow-xs">
                  {badgeLeft}
                </span>
                <span className="text-white font-black text-xs sm:text-sm">-</span>
                <span className="bg-white text-slate-900 font-extrabold text-[10px] sm:text-xs px-3 py-0.5 rounded-full shadow-xs">
                  {badgeRight}
                </span>
              </div>
            </div>
          </>
        ) : (
          /* Thermal (Compact unified row for 80mm & 58mm roll) */
          <div 
            className="w-full text-white text-center py-2 px-2 flex flex-col items-center justify-center gap-1"
            style={{ background: `linear-gradient(135deg, ${rightBg} 0%, ${leftBg} 100%)` }}
          >
            {badgeText && (
              <span className="inline-block bg-white text-slate-950 font-black text-[10px] px-2.5 py-0.2 rounded-full shadow-xs">
                {badgeText}
              </span>
            )}
            <h1 
              className="text-base sm:text-lg font-black text-white"
              style={{ fontFamily: fontFamily || 'Aref Ruqaa' }}
            >
              {settings.storeName || 'المتجر'}
            </h1>
            <div className="text-[10px] text-white/95 font-bold">
              {badgeLeft} - {badgeRight}
            </div>
            {activitiesText && (
              <div className="text-[9px] text-white/80 line-clamp-1">
                {activitiesText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Lower Contact & Social Section (الهاتف والموقع والباركود في الأعلى، وتحتهم شبكات التواصل) */}
      <div className="bg-white p-2.5 sm:p-3.5 border-t border-slate-200 space-y-2">
        
        {/* ROW 1: Location & Phone on the right, Barcode elevated to the left (بدون كتابة جانبية) */}
        <div className={`flex items-center justify-between gap-3 pb-2 border-b border-slate-100 text-slate-800 ${
          isThermal ? 'flex-col text-center' : 'flex-row'
        }`}>
          
          {/* Location & Address & Phone & Delivery Info */}
          <div className={`flex items-start sm:items-center gap-2 sm:gap-4 flex-wrap flex-1 text-right ${
            isThermal ? 'flex-col items-center text-center w-full' : 'flex-col sm:flex-row'
          }`}>
            {settings.address && (
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <MapPin className="w-3 h-3" />
                </span>
                <span className="leading-tight">{settings.address}</span>
              </div>
            )}

            {settings.phone && (
              <div className="flex items-center gap-1.5 text-xs font-bold font-mono">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Phone className="w-3 h-3" />
                </span>
                <span dir="ltr">{settings.phone}</span>
              </div>
            )}

            {conf.deliveryNote && (
              <span className="text-[11px] font-extrabold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                <Truck className="w-3 h-3 text-amber-600" />
                <span>{conf.deliveryNote}</span>
              </span>
            )}
          </div>

          {/* Barcode Box - Elevated to Top Left as drawn by user, pure barcode with NO side text */}
          {(conf.showBarcode ?? true) && (
            <div className={`shrink-0 p-1 bg-white border border-slate-300 rounded-lg shadow-2xs flex items-center justify-center ${
              isThermal ? 'my-1' : ''
            }`}>
              <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center overflow-hidden">
                {conf.barcodeImageUrl ? (
                  <img
                    src={conf.barcodeImageUrl}
                    alt="صورة الباركود"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-800">
                    <QrCode className="w-9 h-9 text-slate-800 stroke-[1.75]" />
                    <span className="text-[8px] font-mono font-bold leading-none mt-0.5">
                      #{invoiceNumber || 'POS'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ROW 2: Social Media Handles Grid / Row (شبكات التواصل الاجتماعي) */}
        {hasSocials && (
          <div className={`flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5 ${
            isThermal ? 'justify-center' : 'justify-center sm:justify-start'
          }`}>
            
            {/* Telegram */}
            {(conf.showTelegram ?? true) && conf.telegramHandle && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/80 text-xs font-bold text-slate-800 shadow-2xs">
                <span className="w-5 h-5 rounded-md bg-[#229ED9] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Send className="w-3 h-3 -translate-x-[1px]" />
                </span>
                <span className="font-mono text-[11px] sm:text-xs text-sky-900 dir-ltr">{conf.telegramHandle}</span>
              </div>
            )}

            {/* Facebook */}
            {(conf.showFacebook ?? true) && conf.facebookName && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200/80 text-xs font-bold text-slate-800 shadow-2xs">
                <span className="w-5 h-5 rounded-md bg-[#1877F2] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Facebook className="w-3 h-3" />
                </span>
                <span className="text-[11px] sm:text-xs text-blue-900 font-bold">{conf.facebookName}</span>
              </div>
            )}

            {/* WhatsApp */}
            {(conf.showWhatsapp ?? true) && conf.whatsappNumber && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-xs font-bold text-slate-800 shadow-2xs">
                <span className="w-5 h-5 rounded-md bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <MessageCircle className="w-3 h-3" />
                </span>
                <span className="font-mono text-[11px] sm:text-xs text-emerald-900 dir-ltr">{conf.whatsappNumber}</span>
              </div>
            )}

            {/* Instagram */}
            {(conf.showInstagram ?? true) && conf.instagramHandle && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 border border-pink-200/80 text-xs font-bold text-slate-800 shadow-2xs">
                <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Instagram className="w-3 h-3" />
                </span>
                <span className="font-mono text-[11px] sm:text-xs text-pink-900 dir-ltr">{conf.instagramHandle}</span>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
};

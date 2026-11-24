import React from 'react';

export const PROMO_TEXT = 'برنامج المفكر المحاسبي';

/** توقيع صغير أسفل القوائم والوصولات المطبوعة (ترويج للبرنامج) */
export const PromoFooter: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    data-testid="promo-footer"
    className={`text-center text-[8px] leading-tight text-slate-500 pt-1 ${className}`}
    style={{ color: '#6b7280' }}
  >
    ✦ {PROMO_TEXT} ✦
  </div>
);

export default PromoFooter;

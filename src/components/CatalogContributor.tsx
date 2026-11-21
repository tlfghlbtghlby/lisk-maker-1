import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { contributeProducts } from '../utils/catalogContribute';

/** يرفع مواد المحل للكتالوج المشترك تلقائياً بعد كل تعديل (بعد 5 ثوانٍ من الهدوء). يمكن إيقافه بـ settings.catalogContribute=false */
export default function CatalogContributor() {
  const { products, currentUser, settings } = useApp() as any;
  const timer = useRef<any>(null);
  const uid: string | undefined = currentUser?.uid;
  const off = settings?.catalogContribute === false;
  useEffect(() => {
    if (!uid || off || !Array.isArray(products) || products.length === 0) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { contributeProducts(uid, products).catch(() => {}); }, 5000);
    return () => clearTimeout(timer.current);
  }, [products, uid, off]);
  return null;
}

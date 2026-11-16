; ===== اختصار سطح المكتب =====
; (أُزيلت صفحة اختيار الاختصارات مؤقتاً لأنها كانت تكسر بناء المثبّت)

!macro customInstall
  CreateShortcut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
!macroend

!macro customUnInstall
  ; حذف الاختصارات تلقائياً عند إلغاء التثبيت
  Delete "$DESKTOP\${PRODUCT_FILENAME}.lnk"
  Delete "$DESKTOP\ نقطة البيع.lnk"
  Delete "$DESKTOP\ المواد والمخزون.lnk"
  Delete "$DESKTOP\ سجل الفواتير.lnk"
  Delete "$DESKTOP\ الشفتات والورديات.lnk"
  Delete "$DESKTOP\ البيع الآجل والديون.lnk"
  Delete "$DESKTOP\ التقارير المالية.lnk"
  Delete "$DESKTOP\ الإعدادات.lnk"
!macroend

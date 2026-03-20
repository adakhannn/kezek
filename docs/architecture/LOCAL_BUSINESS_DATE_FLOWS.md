# API Рё UI-РїРѕС‚РѕРєРё, Р·Р°РІСЏР·Р°РЅРЅС‹Рµ РЅР° Р»РѕРєР°Р»СЊРЅСѓСЋ РґР°С‚Сѓ Р±РёР·РЅРµСЃР°

**РЎС‚Р°С‚СѓСЃ:** Р°РєС‚СѓР°Р»РµРЅ  
**Р¦РµР»СЊ:** РїРµСЂРµС‡РёСЃР»РёС‚СЊ СЃС†РµРЅР°СЂРёРё, РіРґРµ РїРѕРІРµРґРµРЅРёРµ СЃРёСЃС‚РµРјС‹ Р·Р°РІРёСЃРёС‚ РЅРµ РїСЂРѕСЃС‚Рѕ РѕС‚ timestamp, Р° РёРјРµРЅРЅРѕ РѕС‚ Р»РѕРєР°Р»СЊРЅРѕРіРѕ РєР°Р»РµРЅРґР°СЂРЅРѕРіРѕ РґРЅСЏ Р±РёР·РЅРµСЃР°.

---

## Р§С‚Рѕ СЃС‡РёС‚Р°РµС‚СЃСЏ С‚Р°РєРёРј РїРѕС‚РѕРєРѕРј

РџРѕС‚РѕРє СЃС‡РёС‚Р°РµС‚СЃСЏ Р·Р°РІСЏР·Р°РЅРЅС‹Рј РЅР° Р»РѕРєР°Р»СЊРЅСѓСЋ РґР°С‚Сѓ Р±РёР·РЅРµСЃР°, РµСЃР»Рё РІ РЅС‘Рј РµСЃС‚СЊ С…РѕС‚СЏ Р±С‹ РѕРґРЅРѕ РёР· СѓСЃР»РѕРІРёР№:

- РІС‹С‡РёСЃР»СЏРµС‚СЃСЏ вЂњСЃРµРіРѕРґРЅСЏвЂќ, вЂњР·Р°РІС‚СЂР°вЂќ, вЂњРІС‡РµСЂР°вЂќ РёР»Рё РіСЂР°РЅРёС†С‹ РґРЅСЏ;
- РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `YYYY-MM-DD` РєР°Рє Р±РёР·РЅРµСЃ-РґР°С‚Р°;
- Р»РѕРіРёРєР° Р·Р°РІРёСЃРёС‚ РѕС‚ Р»РѕРєР°Р»СЊРЅРѕРіРѕ РґРЅСЏ Р±РёР·РЅРµСЃР°, Р° РЅРµ РїСЂРѕСЃС‚Рѕ РѕС‚ UTC timestamp;
- РµСЃС‚СЊ day-based С„РёР»СЊС‚СЂС‹, СЃР»РѕС‚РЅР°СЏ Р»РѕРіРёРєР°, СЃРјРµРЅС‹, РїРµСЂРёРѕРґС‹ РёР»Рё СЂР°СЃРїРёСЃР°РЅРёРµ.

---

## 1. РљСЂРёС‚РёС‡РЅС‹Рµ API-РїРѕС‚РѕРєРё

### Booking / slot / schedule

- `apps/web/src/app/b/[slug]/*`
  РџСѓР±Р»РёС‡РЅС‹Р№ booking-flow: РІС‹Р±РѕСЂ РґРЅСЏ, СЃР»РѕС‚С‹, guest booking, booking creation.

- `apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts`
  РћС‚РєСЂС‹С‚РёРµ СЃРјРµРЅС‹ РїРѕ РІС‹Р±СЂР°РЅРЅРѕР№ Р»РѕРєР°Р»СЊРЅРѕР№ РґР°С‚Рµ Р±РёР·РЅРµСЃР°.

- `apps/web/src/app/api/staff/shift/open/route.ts`
  РЎРјРµРЅР° СЃРѕС‚СЂСѓРґРЅРёРєР° Рё СЂР°СЃС‡С‘С‚ day-boundaries.

- `apps/web/src/app/api/staff/shift/close/route.ts`
  Р—Р°РєСЂС‹С‚РёРµ СЃРјРµРЅС‹, РїРѕР»РЅРѕС‡СЊ СЃР»РµРґСѓСЋС‰РµРіРѕ РґРЅСЏ, today bookings.

- `apps/web/src/app/api/staff/shift/today/route.ts`
  Р’С‹Р±РѕСЂ С‚РµРєСѓС‰РµР№ СЃРјРµРЅС‹ РїРѕ Р»РѕРєР°Р»СЊРЅРѕРјСѓ РґРЅСЋ.

- `apps/web/src/app/api/staff/shift/items/shiftItemsShiftResolver.ts`
  Р Р°Р·СЂРµС€РµРЅРёРµ РґР°С‚С‹ СЃРјРµРЅС‹ РїСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё СЏРІРЅРѕР№ РґР°С‚С‹.

### Finance

- `apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts`
  Day-based finance view, day off semantics, РІС‹Р±РѕСЂ СЃРјРµРЅС‹ Рё bookings Р·Р° РґРµРЅСЊ.

- `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`
  РЎС‚Р°С‚РёСЃС‚РёРєР° РїРѕ РїРµСЂРёРѕРґР°Рј Рё special-case РґР»СЏ РѕС‚РєСЂС‹С‚РѕР№ СЃРјРµРЅС‹ РЅР° СЃРµРіРѕРґРЅСЏ.

- `apps/web/src/app/api/dashboard/staff/finance/all/route.ts`
  РћР±С‰РёР№ finance period view.

- `apps/web/src/app/api/staff/finance/route.ts`
  Staff finance API СЃ Р»РѕРєР°Р»СЊРЅРѕР№ РґР°С‚РѕР№ Рё СЃРјРµРЅРЅРѕР№ РјРѕРґРµР»СЊСЋ.

### Analytics / system checks / cron

- `apps/web/src/app/api/dashboard/analytics/overview/route.ts`
- `apps/web/src/app/api/dashboard/analytics/load/route.ts`
- `apps/web/src/app/admin/api/analytics/*`
- `apps/web/src/app/api/cron/analytics/daily/route.ts`
- `apps/web/src/app/api/cron/analytics/hourly-load/route.ts`
- `apps/web/src/app/api/cron/recalculate-ratings/route.ts`
- `apps/web/src/app/api/admin/ratings/debug-entities/route.ts`
- `apps/web/src/app/api/admin/health-check/route.ts`
- `apps/web/src/app/admin/api/system-health/route.ts`
- `apps/web/src/app/api/cron/health-check-alerts/route.ts`

РџРѕС‡РµРјСѓ:

- СЌС‚Рё РїРѕС‚РѕРєРё СЃС‚СЂРѕСЏС‚ РґРёР°РїР°Р·РѕРЅС‹ РґР°С‚, вЂњРІС‡РµСЂР°/СЃРµРіРѕРґРЅСЏвЂќ, daily/hourly Р°РіСЂРµРіР°С†РёРё Рё РїСЂРѕРІРµСЂРєРё stale-РґР°РЅРЅС‹С….

### Promotions / calendar-date rules

- `apps/web/src/app/api/dashboard/branches/[branchId]/promotions/route.ts`
- `apps/web/src/app/api/dashboard/branches/[branchId]/promotions/[promotionId]/route.ts`

РџРѕС‡РµРјСѓ:

- `valid_from` / `valid_to` вЂ” СЌС‚Рѕ РёРјРµРЅРЅРѕ calendar date РІ Р»РѕРєР°Р»СЊРЅРѕР№ РјРѕРґРµР»Рё Р±РёР·РЅРµСЃР°.

---

## 2. РљСЂРёС‚РёС‡РЅС‹Рµ UI-РїРѕС‚РѕРєРё

### Public booking and desk booking

- `apps/web/src/app/b/[slug]/view.tsx`
- `apps/web/src/app/b/[slug]/hooks/*`
- `apps/web/src/app/dashboard/bookings/view.tsx`
- `apps/web/src/app/dashboard/bookings/components/QuickDesk.tsx`
- `apps/web/src/app/dashboard/bookings/components/FilterPresets.tsx`

РџРѕС‡РµРјСѓ:

- РІС‹Р±РѕСЂ Р±РёР·РЅРµСЃ-РґРЅСЏ, РїРѕСЃС‚СЂРѕРµРЅРёРµ slot availability, РїСЂРµСЃРµС‚С‹ вЂњtodayвЂќ.

### Staff schedule / shifts / finance

- `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`
- `apps/web/src/app/staff/schedule/ViewSchedule.tsx`
- `apps/web/src/app/staff/finance/**/*`
- `apps/web/src/app/dashboard/staff/[id]/finance/components/*`
- `apps/mobile/src/screens/ShiftQuickScreen.tsx`
- `apps/mobile/src/screens/ShiftsScreen.tsx`

РџРѕС‡РµРјСѓ:

- РЅРµРґРµР»СЏ, РґРµРЅСЊ, СЃРјРµРЅР°, РїРµСЂРёРѕРґ, РѕС‚РєСЂС‹С‚Р°СЏ СЃРјРµРЅР° вЂњРЅР° СЃРµРіРѕРґРЅСЏвЂќ.

### Cabinet / bookings display

- `apps/web/src/app/cabinet/**/*`
- `apps/web/src/app/booking/[id]/BookingLayoutClient.tsx`
- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/src/screens/CabinetScreen.tsx`
- `apps/mobile/src/screens/BookingDetailsScreen.tsx`

РџРѕС‡РµРјСѓ:

- РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ booking time/day Рё СЂР°Р·РґРµР»РµРЅРёРµ Р±СѓРґСѓС‰РёС…/РїСЂРѕС€РµРґС€РёС… Р·Р°РїРёСЃРµР№.

### Mobile booking flow

- `apps/mobile/src/screens/booking/BookingStep4Date.tsx`
- `apps/mobile/src/screens/booking/BookingStep5Time.tsx`
- `apps/mobile/src/screens/booking/BookingStep6Confirm.tsx`

РџРѕС‡РµРјСѓ:

- С€Р°РіРё РІС‹Р±РѕСЂР° РґР°С‚С‹ Рё РІСЂРµРјРµРЅРё СЃРµР№С‡Р°СЃ Р¶С‘СЃС‚РєРѕ РїСЂРёРІСЏР·Р°РЅС‹ Рє РѕРґРЅРѕР№ timezone Рё РїСЂСЏРјРѕ Р·Р°РІРёСЃСЏС‚ РѕС‚ Р»РѕРєР°Р»СЊРЅРѕРіРѕ РґРЅСЏ.

---

## 3. РЎР°РјС‹Рµ СЂРёСЃРєРѕРІР°РЅРЅС‹Рµ РїРѕС‚РѕРєРё

Р•СЃР»Рё РІС‹Р±РёСЂР°С‚СЊ, С‡С‚Рѕ РІС‹СЂР°РІРЅРёРІР°С‚СЊ РїРµСЂРІС‹Рј, СЃР°РјС‹Р№ РІС‹СЃРѕРєРёР№ СЂРёСЃРє СЂРµРіСЂРµСЃСЃРёР№ Рё СЃРєСЂС‹С‚С‹С… timezone bugs СЃРµР№С‡Р°СЃ Сѓ:

1. `staff shift` API
2. `dashboard/staff/[id]/finance*`
3. `staff/finance` web feature
4. `dashboard/staff/[id]/schedule/Client.tsx`
5. mobile booking flow

---

## 4. РЎРІСЏР·Р°РЅРЅС‹Рµ РґРѕРєСѓРјРµРЅС‚С‹

- [TIME_STANDARD.md](C:\projects\kezek\docs\architecture\TIME_STANDARD.md)
- [TIMEZONE_USAGE_AUDIT.md](C:\projects\kezek\docs\architecture\TIMEZONE_USAGE_AUDIT.md)
- [DATE_HANDLING_MODEL.md](C:\projects\kezek\docs\architecture\DATE_HANDLING_MODEL.md)
- [DATE_HANDLING_RISKS.md](C:\projects\kezek\docs\architecture\DATE_HANDLING_RISKS.md)

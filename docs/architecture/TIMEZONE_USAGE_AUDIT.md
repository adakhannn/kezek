# РђСѓРґРёС‚ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ `TZ`, `NEXT_PUBLIC_TZ` Рё `biz.tz`

**Дата проверки:** 2026-03-19  
**Источник правды:** TIME_STANDARD.md, DATE_HANDLING_MODEL.md и текущий date/time code  
**Когда пересматривать:** после каждой timezone migration wave или новых timezone bugs


**РЎС‚Р°С‚СѓСЃ:** Р°РєС‚СѓР°Р»РµРЅ  
**Р¦РµР»СЊ:** Р·Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ, РіРґРµ РїСЂРѕРµРєС‚ СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚ business timezone РєРѕСЂСЂРµРєС‚РЅРѕ, Р° РіРґРµ РєРѕРґ РІСЃС‘ РµС‰С‘ РѕРїРёСЂР°РµС‚СЃСЏ РЅР° РіР»РѕР±Р°Р»СЊРЅС‹Р№ `TZ` РёР»Рё fallback С‡РµСЂРµР· `NEXT_PUBLIC_TZ`.

---

## РљРѕСЂРѕС‚РєРёР№ РІС‹РІРѕРґ

РўРµРєСѓС‰РµРµ СЃРѕСЃС‚РѕСЏРЅРёРµ С‚Р°РєРѕРµ:

- `biz.tz` Рё `getBusinessTimezone(...)` СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ РІ РїСЂР°РІРёР»СЊРЅРѕРј РЅР°РїСЂР°РІР»РµРЅРёРё, РЅРѕ РїРѕРєР° С‚РѕС‡РµС‡РЅРѕ;
- `NEXT_PUBLIC_TZ` РІ РѕСЃРЅРѕРІРЅРѕРј РІС‹СЃС‚СѓРїР°РµС‚ РєР°Рє СЃРёСЃС‚РµРјРЅС‹Р№ fallback С‡РµСЂРµР· `getTimezone()`;
- РіР»РѕР±Р°Р»СЊРЅС‹Р№ `TZ` РїРѕ-РїСЂРµР¶РЅРµРјСѓ С€РёСЂРѕРєРѕ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ web UI, shift/finance flows, notifications Рё mobile booking screens.

Р“Р»Р°РІРЅС‹Р№ СЂРёСЃРє:

- С‚Р°Рј, РіРґРµ Сѓ СЃС†РµРЅР°СЂРёСЏ СѓР¶Рµ РµСЃС‚СЊ РєРѕРЅС‚РµРєСЃС‚ Р±РёР·РЅРµСЃР°, РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ РіР»РѕР±Р°Р»СЊРЅРѕРіРѕ `TZ` РІРјРµСЃС‚Рѕ `biz.tz` РІСЃС‘ РµС‰С‘ РјРѕР¶РµС‚ РґР°РІР°С‚СЊ СЃРєСЂС‹С‚СѓСЋ СЂР°СЃСЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЋ РєР°Р»РµРЅРґР°СЂРЅРѕРіРѕ РґРЅСЏ Рё РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РІСЂРµРјРµРЅРё.

---

## 1. Р“РґРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РіР»РѕР±Р°Р»СЊРЅС‹Р№ `TZ`

### Р’С‹СЃРѕРєРёР№ РїСЂРёРѕСЂРёС‚РµС‚

- `apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts`
- `apps/web/src/app/api/staff/shift/open/route.ts`
- `apps/web/src/app/api/staff/shift/close/route.ts`
- `apps/web/src/app/api/staff/shift/today/route.ts`
- `apps/web/src/app/api/staff/shift/items/shiftItemsShiftResolver.ts`
- `apps/web/src/app/staff/finance/**/*`
- `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`

РџРѕС‡РµРјСѓ СЌС‚Рѕ РІР°Р¶РЅРѕ:

- СЌС‚Рё РїРѕС‚РѕРєРё СЃС‡РёС‚Р°СЋС‚ вЂњСЃРµРіРѕРґРЅСЏвЂќ, РіСЂР°РЅРёС†С‹ РґРЅСЏ, СЃРјРµРЅС‹, РїРµСЂРёРѕРґС‹ Рё day-based С„РёРЅР°РЅСЃС‹;
- Р·РґРµСЃСЊ РіР»РѕР±Р°Р»СЊРЅС‹Р№ fallback РѕСЃРѕР±РµРЅРЅРѕ РѕРїР°СЃРµРЅ, РµСЃР»Рё Р±РёР·РЅРµСЃ timezone РѕС‚Р»РёС‡Р°РµС‚СЃСЏ РѕС‚ СЃРёСЃС‚РµРјРЅРѕР№.

### РЎСЂРµРґРЅРёР№ РїСЂРёРѕСЂРёС‚РµС‚

- `apps/web/src/app/api/webhooks/whatsapp/route.ts`
- `apps/web/src/lib/staffSchedule.ts`
- `apps/web/src/lib/notifications/shiftNotifications.ts`
- `apps/web/src/app/dashboard/bookings/components/BookingsList.tsx`
- `apps/web/src/app/dashboard/staff/[id]/slots/Client.tsx`
- `apps/web/src/app/staff/bookings/**/*`
- `apps/web/src/app/cabinet/**/*`

РџРѕС‡РµРјСѓ СЌС‚Рѕ РІР°Р¶РЅРѕ:

- СЌС‚Рѕ РІ РѕСЃРЅРѕРІРЅРѕРј РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РІСЂРµРјРµРЅРё Рё day-based UI;
- СЂРёСЃРє РЅРёР¶Рµ, С‡РµРј Сѓ shift/finance mutation paths, РЅРѕ РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ РІСЃС‘ РµС‰С‘ РјРѕР¶РµС‚ СЂР°СЃС…РѕРґРёС‚СЊСЃСЏ.

### РќРёР·РєРёР№ / Р»РѕРєР°Р»СЊРЅС‹Р№ РїСЂРёРѕСЂРёС‚РµС‚

- `apps/mobile/src/utils/format.ts`
- `apps/mobile/src/screens/booking/BookingStep4Date.tsx`
- `apps/mobile/src/screens/booking/BookingStep5Time.tsx`
- `apps/mobile/src/screens/booking/BookingStep6Confirm.tsx`
- `apps/web/src/lib/dateFormat.ts`

РџРѕС‡РµРјСѓ СЌС‚Рѕ РІР°Р¶РЅРѕ:

- СЌС‚Рѕ mostly presentation-level С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ;
- РЅРѕ mobile booking flow РІСЃС‘ РµС‰С‘ Р¶С‘СЃС‚РєРѕ Р·Р°С€РёС‚ РЅР° `Asia/Bishkek`.

---

## 2. Р“РґРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `NEXT_PUBLIC_TZ`

РџСЂСЏРјРѕРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:

- [time.ts](C:\projects\kezek\apps\web\src\lib\time.ts)
- [env.ts](C:\projects\kezek\apps\web\src\lib\env.ts)
- С‚РµСЃС‚С‹ [time.test.ts](C:\projects\kezek\apps\web\src\__tests__\lib\time.test.ts)

РљРѕСЃРІРµРЅРЅРѕРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ С‡РµСЂРµР· `getTimezone()`:

- analytics Рё cron routes;
- `NotificationOrchestrator`;
- С‡Р°СЃС‚СЊ cabinet UI;
- РґСЂСѓРіРёРµ РјРµСЃС‚Р°, РіРґРµ РІС‹Р·С‹РІР°РµС‚СЃСЏ `getTimezone()` РєР°Рє СЃРёСЃС‚РµРјРЅС‹Р№ fallback.

Р’С‹РІРѕРґ:

- `NEXT_PUBLIC_TZ` СЃРµР№С‡Р°СЃ РІ С†РµР»РѕРј РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РєРѕСЂСЂРµРєС‚РЅРѕ РєР°Рє РіР»РѕР±Р°Р»СЊРЅС‹Р№ fallback;
- РїСЂРѕР±Р»РµРјР° РЅРµ РІ СЃР°РјРѕРј fallback, Р° РІ С‚РѕРј, С‡С‚Рѕ С‡Р°СЃС‚СЊ business-critical СЃС†РµРЅР°СЂРёРµРІ РІСЃС‘ РµС‰С‘ РЅРµ РїРѕРґРЅРёРјР°РµС‚ timezone Р±РёР·РЅРµСЃР° РґРѕ СѓСЂРѕРІРЅСЏ РѕР±СЏР·Р°С‚РµР»СЊРЅРѕРіРѕ РїР°СЂР°РјРµС‚СЂР°.

---

## 3. Р“РґРµ СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `biz.tz`

РҐРѕСЂРѕС€РёРµ С‚РµРєСѓС‰РёРµ С‚РѕС‡РєРё:

- `apps/web/src/app/b/[slug]/view.tsx`
- `apps/web/src/app/b/[slug]/hooks/useBookingSelectionState.ts`
- `apps/web/src/app/b/[slug]/hooks/useBookingCreation.ts`
- `apps/web/src/app/b/[slug]/hooks/useGuestBooking.ts`
- `apps/web/src/app/b/[slug]/hooks/useTemporaryTransfers.ts`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/dashboard/bookings/view.tsx`
- `apps/web/src/app/dashboard/bookings/page.tsx`
- `apps/web/src/app/api/cron/analytics/hourly-load/route.ts`

Р’С‹РІРѕРґ:

- РїСѓР±Р»РёС‡РЅС‹Р№ booking-flow Рё С‡Р°СЃС‚СЊ dashboard flows СѓР¶Рµ РґРІРёРіР°СЋС‚СЃСЏ РІ РїСЂР°РІРёР»СЊРЅСѓСЋ СЃС‚РѕСЂРѕРЅСѓ;
- СЌС‚Рѕ С…РѕСЂРѕС€РёР№ Р±Р°Р·РёСЃ РґР»СЏ СЃР»РµРґСѓСЋС‰РµР№ РІРѕР»РЅС‹ РІС‹СЂР°РІРЅРёРІР°РЅРёСЏ.

---

## 4. Р§С‚Рѕ СЌС‚Рѕ Р·РЅР°С‡РёС‚ РґР»СЏ СЃР»РµРґСѓСЋС‰РµР№ РјРёРіСЂР°С†РёРё

### Р’РѕР»РЅР° 1

- `staff shift` API
- `dashboard/staff/[id]/finance*`
- `staff/finance` web feature

Р—Р°РґР°С‡Р°:

- Р·Р°РјРµРЅРёС‚СЊ РіР»РѕР±Р°Р»СЊРЅС‹Р№ `TZ` РЅР° СЏРІРЅС‹Р№ `business timezone`, РєРѕРіРґР° Р±РёР·РЅРµСЃ СѓР¶Рµ РёР·РІРµСЃС‚РµРЅ РІ СЃС†РµРЅР°СЂРёРё.

РЎС‚Р°С‚СѓСЃ С‚РµРєСѓС‰РµР№ РІРѕР»РЅС‹:

- РІС‹РїРѕР»РЅРµРЅРѕ РґР»СЏ `dashboard/staff/[id]/shift/open`;
- РІС‹РїРѕР»РЅРµРЅРѕ РґР»СЏ `dashboard/staff/[id]/finance`;
- РІС‹РїРѕР»РЅРµРЅРѕ РґР»СЏ `dashboard/staff/[id]/finance/stats`;
- РІС‹РїРѕР»РЅРµРЅРѕ РґР»СЏ `dashboard/staff/finance/all`;
- РІС‹РїРѕР»РЅРµРЅРѕ РґР»СЏ `api/staff/finance` С‡РµСЂРµР· `shiftDataService`;
- РІС‹РїРѕР»РЅРµРЅРѕ РґР»СЏ `api/staff/shift/open`;
- РІС‹РїРѕР»РЅРµРЅРѕ РґР»СЏ `api/staff/shift/close`;
- РІС‹РїРѕР»РЅРµРЅРѕ РґР»СЏ `api/staff/shift/today`;
- РІС‹РїРѕР»РЅРµРЅРѕ РґР»СЏ `api/staff/shift/items/shiftItemsShiftResolver`.

### Р’РѕР»РЅР° 2

- `dashboard/staff/[id]/schedule/Client.tsx`
- `staffSchedule.ts`
- `webhooks/whatsapp`
- booking-related cabinet and dashboard UI

Р—Р°РґР°С‡Р°:

- СЂР°Р·РґРµР»РёС‚СЊ display timezone Рё business-day timezone;
- СѓР±СЂР°С‚СЊ СЃРєСЂС‹С‚РѕРµ СЃРјРµС€РµРЅРёРµ вЂњUI formatвЂќ Рё вЂњdomain day boundaryвЂќ.

РЎС‚Р°С‚СѓСЃ С‚РµРєСѓС‰РµР№ РІРѕР»РЅС‹:

- `dashboard/bookings/view.tsx`, `QuickDesk` Рё `FilterPresets` СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓСЋС‚ timezone Р±РёР·РЅРµСЃР° РєРѕСЂСЂРµРєС‚РЅРѕ;
- `dashboard/bookings/components/BookingsList.tsx` РїРµСЂРµРІРµРґРµРЅ СЃ РіР»РѕР±Р°Р»СЊРЅРѕРіРѕ `TZ` РЅР° РІС…РѕРґРЅРѕР№ `timezone`;
- `cabinet/bookings/page.tsx` Р±РѕР»СЊС€Рµ РЅРµ РґРµР»РёС‚ upcoming/past С‡РµСЂРµР· РіР»РѕР±Р°Р»СЊРЅС‹Р№ `TZ`, Р° РёСЃРїРѕР»СЊР·СѓРµС‚ timezone РєРѕРЅРєСЂРµС‚РЅРѕРіРѕ Р±РёР·РЅРµСЃР° Р·Р°РїРёСЃРё;
- `cabinet/components/BookingCard.tsx` РїРµСЂРµРІРµРґРµРЅ РЅР° `businessTz` РёР· РґР°РЅРЅС‹С… Р·Р°РїРёСЃРё.

### Р’РѕР»РЅР° 3

- mobile booking screens
- shared/mobile formatting helpers

Р—Р°РґР°С‡Р°:

- СѓР±СЂР°С‚СЊ С…Р°СЂРґРєРѕРґ `Asia/Bishkek`;
- РїРµСЂРµРґР°РІР°С‚СЊ timezone Р±РёР·РЅРµСЃР° РёР»Рё СЃРѕРіР»Р°СЃРѕРІР°РЅРЅС‹Р№ fallback РёР· РґР°РЅРЅС‹С… СЃС†РµРЅР°СЂРёСЏ.

---

## 5. РџСЂР°РєС‚РёС‡РµСЃРєРёР№ СЃС‚Р°С‚СѓСЃ РїРѕСЃР»Рµ С‚РµРєСѓС‰РµР№ РІРѕР»РЅС‹

РЈР¶Рµ СЃРґРµР»Р°РЅРѕ:

- РІ РїСѓР±Р»РёС‡РЅРѕРј booking-flow `businessTz` РїСЂРѕР±СЂРѕС€РµРЅ РєР°Рє РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Р№ РїР°СЂР°РјРµС‚СЂ РІ critical hooks:
  - `useBookingSelectionState`
  - `useBookingCreation`
  - `useGuestBooking`
  - `useTemporaryTransfers`

РџРѕРєР° РЅРµ СЃРґРµР»Р°РЅРѕ:

- mobile booking flow;
- Р±РѕР»СЊС€Р°СЏ С‡Р°СЃС‚СЊ legacy UI, РєРѕС‚РѕСЂС‹Р№ РІСЃС‘ РµС‰С‘ С„РѕСЂРјР°С‚РёСЂСѓРµС‚ С‡РµСЂРµР· РіР»РѕР±Р°Р»СЊРЅС‹Р№ `TZ`.

РЎРґРµР»Р°РЅРѕ РІ СЌС‚РѕР№ РІРѕР»РЅРµ:

- `withManagerContext` С‚РµРїРµСЂСЊ РїРѕРґРЅРёРјР°РµС‚ `businessTz` РІ РєРѕРЅС‚РµРєСЃС‚ manager API;
- `getStaffContext` С‚РµРїРµСЂСЊ РїРѕРґРЅРёРјР°РµС‚ `businessTz` РІ РєРѕРЅС‚РµРєСЃС‚ staff API;
- high-risk shift/finance routes Р±РѕР»СЊС€Рµ РЅРµ РІС‹С‡РёСЃР»СЏСЋС‚ Р»РѕРєР°Р»СЊРЅС‹Р№ РґРµРЅСЊ Р±РёР·РЅРµСЃР° С‡РµСЂРµР· РіР»РѕР±Р°Р»СЊРЅС‹Р№ `TZ`, РµСЃР»Рё Р±РёР·РЅРµСЃ СѓР¶Рµ РѕРїСЂРµРґРµР»РµРЅ.

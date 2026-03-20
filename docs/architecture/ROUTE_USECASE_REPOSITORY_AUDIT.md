# РђСѓРґРёС‚ РїР°С‚С‚РµСЂРЅР° `route -> use case -> repository/port adapter`

**Дата проверки:** 2026-03-19  
**Источник правды:** текущие route handlers, application services и infra adapters в apps/web  
**Когда пересматривать:** после каждой новой волны thin-adapter refactor


**РЎС‚Р°С‚СѓСЃ:** Р°РєС‚СѓР°Р»РµРЅ  
**Р¦РµР»СЊ:** Р·Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ, РіРґРµ web API СѓР¶Рµ СЃР»РµРґСѓРµС‚ С†РµР»РµРІРѕРјСѓ РїР°С‚С‚РµСЂРЅСѓ, Р° РіРґРµ route handler РІСЃРµ РµС‰Рµ СЃР»РёС€РєРѕРј С‚РµСЃРЅРѕ СЃРІСЏР·Р°РЅ СЃ Supabase, С‚Р°Р±Р»РёС†Р°РјРё Рё RPC.

---

## Р¦РµР»РµРІРѕР№ РїР°С‚С‚РµСЂРЅ

Р”Р»СЏ manager/client API С†РµР»РµРІР°СЏ СЃС…РµРјР° С‚Р°РєР°СЏ:

1. `route.ts` РѕС‚РІРµС‡Р°РµС‚ С‚РѕР»СЊРєРѕ Р·Р°:
   - HTTP-РІС…РѕРґ;
   - Zod-РІР°Р»РёРґР°С†РёСЋ;
   - auth/context;
   - РІС‹Р·РѕРІ application service РёР»Рё use case;
   - РїСЂРµРѕР±СЂР°Р·РѕРІР°РЅРёРµ СЂРµР·СѓР»СЊС‚Р°С‚Р° РІ HTTP response.
2. `use case` РёР»Рё `application service` РѕС‚РІРµС‡Р°РµС‚ Р·Р° СЃС†РµРЅР°СЂРёР№:
   - orchestration С€Р°РіРѕРІ;
   - РІС‹Р·РѕРІС‹ domain helpers;
   - РїСЂРёРЅСЏС‚РёРµ СЂРµС€РµРЅРёР№ РїРѕ РІРµС‚РєР°Рј РІС‹РїРѕР»РЅРµРЅРёСЏ;
   - СЂР°Р±РѕС‚Сѓ С‡РµСЂРµР· `ports`.
3. `repository` / `port adapter` РѕС‚РІРµС‡Р°РµС‚ С‚РѕР»СЊРєРѕ Р·Р° РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂСѓ:
   - `Supabase .from(...)`;
   - `rpc(...)`;
   - РјР°РїРїРёРЅРі row/result shape;
   - РѕС‚СЃСѓС‚СЃС‚РІРёРµ Р±РёР·РЅРµСЃ-РїСЂР°РІРёР» РІРЅСѓС‚СЂРё Р°РґР°РїС‚РµСЂР°.

---

## Р“РґРµ РїР°С‚С‚РµСЂРЅ СѓР¶Рµ С…РѕСЂРѕС€РёР№

- [apps/web/src/app/api/staff/shift/items/route.ts](C:\projects\kezek\apps\web\src\app\api\staff\shift\items\route.ts)  
  Route СѓР¶Рµ СЃРІРµРґС‘РЅ Рє thin adapter. РћСЃРЅРѕРІРЅРѕР№ СЃС†РµРЅР°СЂРёР№ СЃРѕР±СЂР°РЅ С‡РµСЂРµР· [saveShiftItemsApplication.ts](C:\projects\kezek\apps\web\src\app\api\staff\shift\items\saveShiftItemsApplication.ts), Р° РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂРЅС‹Рµ РґРµС‚Р°Р»Рё СЂР°Р·Р»РѕР¶РµРЅС‹ РїРѕ `shiftItems*` РјРѕРґСѓР»СЏРј.

- [apps/web/src/app/api/quick-hold/route.ts](C:\projects\kezek\apps\web\src\app\api\quick-hold\route.ts)  
  РСЃРїРѕР»СЊР·СѓРµС‚ `createBookingUseCase`, [repositories.ts](C:\projects\kezek\apps\web\src\lib\repositories.ts) Рё [bookingCommandsSupabase.ts](C:\projects\kezek\apps\web\src\lib\bookingCommandsSupabase.ts). Route РІСЃРµ РµС‰Рµ СЃРѕРґРµСЂР¶РёС‚ auth-РІРµС‚РІР»РµРЅРёРµ web/mobile, РЅРѕ РґРѕРјРµРЅРЅРѕРµ СЂРµС€РµРЅРёРµ Рѕ СЃРѕР·РґР°РЅРёРё Р±СЂРѕРЅРё СѓР¶Рµ РІС‹РЅРµСЃРµРЅРѕ.

- [apps/web/src/app/api/notify/route.ts](C:\projects\kezek\apps\web\src\app\api\notify\route.ts)  
  РҐРѕСЂРѕС€РёР№ РїСЂРёРјРµСЂ РґРѕРјРµРЅРЅРѕРіРѕ use case С‡РµСЂРµР· `sendBookingNotificationsUseCase` Рё РїРѕСЂС‚ `BookingNotificationPort`. Route РґРµСЂР¶РёС‚ boundary, auth Рё СЃРѕР·РґР°РЅРёРµ orchestrator-Р°РґР°РїС‚РµСЂР°.

- [apps/web/src/app/api/bookings/[id]/mark-attendance/route.ts](C:\projects\kezek\apps\web\src\app\api\bookings\[id]\mark-attendance\route.ts)  
  Use case `decideMarkAttendanceUseCase` СѓР¶Рµ РѕС‚РґРµР»СЏРµС‚ domain decision РѕС‚ HTTP-СЃР»РѕСЏ. РџСЂРё СЌС‚РѕРј route РµС‰Рµ СЃРѕРґРµСЂР¶РёС‚ infra fallback Рё post-decision RPC/update РІРµС‚РєРё.

- [apps/web/src/app/api/bookings/[id]/cancel/route.ts](C:\projects\kezek\apps\web\src\app\api\bookings\[id]\cancel\route.ts)  
  РЈР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚ `cancelBookingUseCase`, РЅРѕ РІСЃРµ РµС‰Рµ СЃРѕР±РёСЂР°РµС‚ Р°РґР°РїС‚РµСЂС‹ РёРЅР»Р°Р№РЅ Рё РЅР°РїСЂСЏРјСѓСЋ Р·РЅР°РµС‚ РїСЂРѕ `bookings`, `cancel_booking`, fallback update Рё notify-РІС‹Р·РѕРІ.

- [apps/web/src/app/api/quick-book-guest/route.ts](C:\projects\kezek\apps\web\src\app\api\quick-book-guest\route.ts)  
  РџРѕСЃР»Рµ РІС‹РЅРѕСЃР° РІ [createGuestBookingApplication.ts](C:\projects\kezek\apps\web\src\app\api\quick-book-guest\createGuestBookingApplication.ts) route С‚РµРїРµСЂСЊ РґРµСЂР¶РёС‚ С‚РѕР»СЊРєРѕ HTTP-boundary, Р° СЃС†РµРЅР°СЂРёР№ `guest booking -> confirm -> notify` СЃРѕР±СЂР°РЅ С‡РµСЂРµР· application service Рё РѕС‚РґРµР»СЊРЅС‹Р№ Supabase adapter [guestBookingCommandsSupabase.ts](C:\projects\kezek\apps\web\src\app\api\quick-book-guest\guestBookingCommandsSupabase.ts).

---

## Р“РґРµ route handler РІСЃРµ РµС‰Рµ Р·РЅР°РµС‚ СЃР»РёС€РєРѕРј РјРЅРѕРіРѕ Рѕ Supabase

### Р’С‹СЃРѕРєРёР№ РїСЂРёРѕСЂРёС‚РµС‚

- [apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts](C:\projects\kezek\apps\web\src\app\api\dashboard\staff\[id]\finance\route.ts)  
  Р’ РѕРґРЅРѕРј route СЃРјРµС€Р°РЅС‹:
  - business access check;
  - date/timezone РІС‹С‡РёСЃР»РµРЅРёСЏ;
  - day-off semantics;
  - Р·Р°РіСЂСѓР·РєР° shift, shift items, bookings, staff services;
  - С„РёРЅР°Р»СЊРЅР°СЏ СЃР±РѕСЂРєР° РѕС‚РІРµС‚Р°.

- [apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts](C:\projects\kezek\apps\web\src\app\api\dashboard\staff\[id]\shift\open\route.ts)  
  Route СЃР°Рј Р·РЅР°РµС‚:
  - РєР°Рє РїСЂРѕРІРµСЂСЏС‚СЊ staff/business РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚СЊ;
  - РєР°Рє РІС‹С‡РёСЃР»СЏС‚СЊ `ymd`, `expectedStart`, `lateMinutes`;
  - РєР°Рє С‡РёС‚Р°С‚СЊ schedule rules Рё working hours;
  - РєР°Рє РїРµСЂРµРѕС‚РєСЂС‹РІР°С‚СЊ РёР»Рё СЃРѕР·РґР°РІР°С‚СЊ СЃРјРµРЅСѓ.

- [apps/web/src/app/api/webhooks/whatsapp/route.ts](C:\projects\kezek\apps\web\src\app\api\webhooks\whatsapp\route.ts)  
  РЎС†РµРЅР°СЂРёР№ РѕС‡РµРЅСЊ РєСЂСѓРїРЅС‹Р№ Рё РґРµСЂР¶РёС‚ РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ:
  - РїР°СЂСЃРёРЅРі РІС…РѕРґСЏС‰РµРіРѕ webhook payload;
  - РїРѕРёСЃРє РїСЂРѕС„РёР»СЏ Рё Р°РєС‚РёРІРЅРѕР№ Р±СЂРѕРЅРё;
  - РґРѕРјРµРЅРЅС‹Рµ РІРµС‚РєРё РѕР±СЂР°Р±РѕС‚РєРё РєРѕРјР°РЅРґ;
  - Supabase queries/RPC;
  - СЃРѕС…СЂР°РЅРµРЅРёРµ РёСЃС‚РѕСЂРёРё РїРµСЂРµРїРёСЃРєРё.

### РЎСЂРµРґРЅРёР№ РїСЂРёРѕСЂРёС‚РµС‚

- [apps/web/src/app/api/services/[id]/update/route.ts](C:\projects\kezek\apps\web\src\app\api\services\[id]\update\route.ts)  
  РЎРѕРґРµСЂР¶РёС‚ diff СЃРІСЏР·РµР№ С„РёР»РёР°Р»РѕРІ, РїСЂРѕРІРµСЂРєСѓ Р°РєС‚РёРІРЅС‹С… bookingвЂ™РѕРІ Рё РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹Рµ write-РѕРїРµСЂР°С†РёРё РїСЂСЏРјРѕ РІ route.

- [apps/web/src/app/api/services/create/route.ts](C:\projects\kezek\apps\web\src\app\api\services\create\route.ts)  
  Route РЅР°РїСЂСЏРјСѓСЋ СЃРІСЏР·С‹РІР°РµС‚ query/validation, branch lookup Рё insert-Р»РѕРіРёРєСѓ.

- [apps/web/src/app/api/services/[id]/delete/route.ts](C:\projects\kezek\apps\web\src\app\api\services\[id]\delete\route.ts)  
  Route Р·РЅР°РµС‚ РїСЂРѕ rules СѓРґР°Р»РµРЅРёСЏ, Р·Р°РІРёСЃРёРјС‹Рµ bookings Рё direct writes.

### РќРёР·РєРёР№ / СЃРїРµС†РёР°Р»СЊРЅС‹Р№ РїСЂРёРѕСЂРёС‚РµС‚

- [apps/web/src/app/api/auth/yandex/callback/route.ts](C:\projects\kezek\apps\web\src\app\api\auth\yandex\callback\route.ts)
- [apps/web/src/app/api/auth/telegram/login/route.ts](C:\projects\kezek\apps\web\src\app\api\auth\telegram\login\route.ts)
- [apps/web/src/app/api/auth/whatsapp/verify-otp/route.ts](C:\projects\kezek\apps\web\src\app\api\auth\whatsapp\verify-otp\route.ts)

Р­С‚Рё routeвЂ™С‹ С‚РѕР¶Рµ РїРµСЂРµРіСЂСѓР¶РµРЅС‹, РЅРѕ СЌС‚Рѕ auth/integration flows. РС… Р»СѓС‡С€Рµ СЂР°Р·Р±РёСЂР°С‚СЊ РѕС‚РґРµР»СЊРЅРѕР№ РІРѕР»РЅРѕР№, С‡С‚РѕР±С‹ РЅРµ СЃРјРµС€РёРІР°С‚СЊ manager CRUD/API refactor СЃ auth-РїРѕС‚РѕРєР°РјРё.

---

## Р§С‚Рѕ СѓР¶Рµ РјРѕР¶РЅРѕ СЃС‡РёС‚Р°С‚СЊ infra-СЃР»РѕРµРј

- [apps/web/src/lib/repositories.ts](C:\projects\kezek\apps\web\src\lib\repositories.ts)  
  РЎРµР№С‡Р°СЃ СЌС‚РѕС‚ С„Р°Р№Р» РІ С†РµР»РѕРј СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓРµС‚ СЂРѕР»Рё infra adapter: С‚Р°Рј РЅРµС‚ Р·Р°РјРµС‚РЅС‹С… Р±РёР·РЅРµСЃ-РІРµС‚РѕРє, Р° РµСЃС‚СЊ С‚РѕР»СЊРєРѕ Supabase-backed СЂРµР°Р»РёР·Р°С†РёРё `BookingRepository`, `BranchRepository`, `StaffRepository`, `PromotionRepository`.

- [apps/web/src/lib/bookingCommandsSupabase.ts](C:\projects\kezek\apps\web\src\lib\bookingCommandsSupabase.ts)  
  Р­С‚Рѕ С‚РѕР¶Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ infrastructure adapter РґР»СЏ `BookingCommandsPort`: РѕРЅ РґРµР»Р°РµС‚ RPC-РІС‹Р·РѕРІС‹ Рё shape/error mapping, Р° РЅРµ РґРѕРјРµРЅРЅС‹Рµ СЂРµС€РµРЅРёСЏ.

Р’С‹РІРѕРґ: РїСЂРѕР±Р»РµРјР° СЃРµР№С‡Р°СЃ РІ РјРµРЅСЊС€РµР№ СЃС‚РµРїРµРЅРё РІ СЃР°РјРёС… `repositories/adapters`, Рё РІ Р±РѕР»СЊС€РµР№ СЃС‚РµРїРµРЅРё РІ route handlerвЂ™Р°С… Рё feature-specific workflow-РєРѕРґРµ, РєРѕС‚РѕСЂС‹Р№ РµС‰Рµ РЅРµ РІС‹РЅРµСЃРµРЅ РІ application service СЃР»РѕР№.

---

## РЎР»РµРґСѓСЋС‰Р°СЏ РІРѕР»РЅР° РІС‹РЅРѕСЃР°

### Р’РѕР»РЅР° 1

- РІС‹РЅРµСЃС‚Рё `dashboard/staff/[id]/shift/open` РІ application service:
  - access/context resolve;
  - shift open decision;
  - schedule lookup adapter;
  - persistence adapter.

- РІС‹РЅРµСЃС‚Рё `quick-book-guest` РІ СЃС†РµРЅР°СЂРёР№ `guest booking -> confirm -> notify`:
  - route;
  - application service;
  - guest booking commands adapter;
  - notification adapter.

### Р’РѕР»РЅР° 2

- РІС‹РЅРµСЃС‚Рё `dashboard/staff/[id]/finance` РІ use case/read-model service;
- РІС‹РЅРµСЃС‚Рё `services/[id]/update` Рё `services/[id]/delete` РІ service-layer СЃС†РµРЅР°СЂРёРё.

### Р’РѕР»РЅР° 3

- РѕС‚РґРµР»СЊРЅРѕ СЂР°Р·РѕР±СЂР°С‚СЊ integration/auth-heavy endpoints:
  - Yandex callback;
  - Telegram login;
  - WhatsApp auth/webhook flows.

---

## Р РµС€РµРЅРёРµ РїРѕ С‚РµРєСѓС‰РµРјСѓ roadmap-РїСѓРЅРєС‚Сѓ

РќР° С‚РµРєСѓС‰РµРј СЌС‚Р°РїРµ Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅРѕ СЃР»РµРґСѓСЋС‰РµРµ:

- РїР°С‚С‚РµСЂРЅ `route -> use case -> repository/port adapter` СѓР¶Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅ РЅР° С‡Р°СЃС‚Рё booking/notifications/shift-items СЃС†РµРЅР°СЂРёРµРІ;
- РіР»Р°РІРЅС‹Р№ remaining gap вЂ” РЅРµ `lib/repositories.ts`, Р° С‚РѕР»СЃС‚С‹Рµ route handlerвЂ™С‹, РѕСЃРѕР±РµРЅРЅРѕ РІ staff finance, shift open, services Рё webhook flows;
- СЃР»РµРґСѓСЋС‰РёР№ РїСЂР°РєС‚РёС‡РµСЃРєРёР№ С€Р°Рі вЂ” РїСЂРѕРґРѕР»Р¶РёС‚СЊ РІС‹РЅРѕСЃ РїРѕРІС‚РѕСЂСЏСЋС‰РёС…СЃСЏ СЃС†РµРЅР°СЂРёРµРІ РІ application services/use cases, РЅР°С‡РёРЅР°СЏ СЃ `shift/open`, `services/[id]/update` Рё `services/[id]/delete`.

# Р РµРІРёР·РёСЏ РїРѕС‚РѕРєРѕРІ РґР»СЏ `core-domain`

**Дата проверки:** 2026-03-19  
**Источник правды:** packages/core-domain/*, PROJECT_DOCUMENTATION.md и текущие adapters/use cases  
**Когда пересматривать:** после следующей волны core-domain extraction


**Р”Р°С‚Р°:** 2026-03-19  
**Р¦РµР»СЊ:** Р·Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ РїРѕ РєР»СЋС‡РµРІС‹Рј РїРѕС‚РѕРєР°Рј, С‡С‚Рѕ СЏРІР»СЏРµС‚СЃСЏ domain rule, С‡С‚Рѕ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє application orchestration, Р° С‡С‚Рѕ РґРѕР»Р¶РЅРѕ РѕСЃС‚Р°РІР°С‚СЊСЃСЏ infra adapter.

---

## 1. Booking

### Domain rule

- СЃС‚Р°С‚СѓСЃРЅС‹Рµ РїРµСЂРµС…РѕРґС‹ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ;
- cancel / confirm / mark-attendance semantics;
- dashboard filter/status grouping;
- client booking semantics:
  - active vs past statuses;
  - timeline semantics;
  - client cancelability;
- booking invariants Рё С‡Р°СЃС‚СЊ promotion semantics.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [statusTransitions.ts](C:\projects\kezek\packages\core-domain\src\booking\statusTransitions.ts)
- [dashboardFilters.ts](C:\projects\kezek\packages\core-domain\src\booking\dashboardFilters.ts)
- [clientSemantics.ts](C:\projects\kezek\packages\core-domain\src\booking\clientSemantics.ts)
- [validation.ts](C:\projects\kezek\packages\core-domain\src\booking\validation.ts)

### Application orchestration

- СЃРѕР·РґР°РЅРёРµ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ С‡РµСЂРµР· СЃР±РѕСЂ Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№;
- РІС‹Р±РѕСЂ РІРµС‚РєРё СЃС†РµРЅР°СЂРёСЏ guest/authenticated;
- decision layer РґР»СЏ РѕС‚РїСЂР°РІРєРё РЅРѕС‚РёС„РёРєР°С†РёР№;
- orchestration mark-attendance Рё promotion application.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [useCases.ts](C:\projects\kezek\packages\core-domain\src\booking\useCases.ts)
- [route.ts](C:\projects\kezek\apps\web\src\app\api\quick-book-guest\route.ts)
- [route.ts](C:\projects\kezek\apps\web\src\app\api\bookings\[id]\cancel\route.ts)

### Infra adapter

- Supabase repositories / commands;
- HTTP route handlers;
- NotificationOrchestrator Рё РєРѕРЅРєСЂРµС‚РЅС‹Рµ РїСЂРѕРІР°Р№РґРµСЂС‹ РґРѕСЃС‚Р°РІРєРё.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [bookingCommandsSupabase.ts](C:\projects\kezek\apps\web\src\lib\bookingCommandsSupabase.ts)
- [repositories.ts](C:\projects\kezek\apps\web\src\lib\repositories.ts)
- [NotificationOrchestrator.ts](C:\projects\kezek\apps\web\src\lib\notifications\NotificationOrchestrator.ts)

---

## 2. Schedule

### Domain rule

- schedule context РїСЂРё РІСЂРµРјРµРЅРЅРѕРј РїРµСЂРµРІРѕРґРµ;
- С„РёР»СЊС‚СЂР°С†РёСЏ СЃР»РѕС‚РѕРІ РїРѕ staff/branch/min-start;
- С„РёР»СЊС‚СЂР°С†РёСЏ СѓСЃР»СѓРі РїРѕ staff/service_staff/temporary transfer;
- РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ РјР°СЃС‚РµСЂРѕРІ РїРѕ С„РёР»РёР°Р»Сѓ Рё РІСЂРµРјРµРЅРЅС‹Рј РїРµСЂРµРІРѕРґР°Рј.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [helpers.ts](C:\projects\kezek\packages\core-domain\src\schedule\helpers.ts)
- [availability.ts](C:\projects\kezek\packages\core-domain\src\schedule\availability.ts)

### Application orchestration

- РїСЂРёРЅСЏС‚РёРµ СЂРµС€РµРЅРёСЏ, РєРѕРіРґР° РґРµСЂРіР°С‚СЊ RPC;
- debounce/cache/refresh policy;
- РёРЅС‚РµСЂРїСЂРµС‚Р°С†РёСЏ РѕС€РёР±РѕРє RPC РґР»СЏ UI;
- РїСЂРѕРІРµСЂРєР° РЅР°Р»РёС‡РёСЏ schedule-rule РґР»СЏ РІСЂРµРјРµРЅРЅРѕРіРѕ РїРµСЂРµРІРѕРґР°.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [useSlotsLoader.ts](C:\projects\kezek\apps\web\src\app\b\[slug]\hooks\useSlotsLoader.ts)
- [useBookingAvailability.ts](C:\projects\kezek\apps\web\src\app\b\[slug]\hooks\useBookingAvailability.ts)

### Infra adapter

- `supabase.rpc('get_free_slots_service_day_v2')`;
- Р·Р°РїСЂРѕСЃС‹ РІ `staff_schedule_rules`;
- React hooks / query lifecycle.

---

## 3. Staff Finance

### Domain rule

- РЅРѕСЂРјР°Р»РёР·Р°С†РёСЏ РїСЂРѕС†РµРЅС‚РѕРІ;
- base/master/salon shares;
- guaranteed amount / topup;
- consumables/service totals;
- display shares;
- shift financial summary.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [index.ts](C:\projects\kezek\packages\core-domain\src\finance\index.ts)
- [shift.ts](C:\projects\kezek\packages\core-domain\src\finance\shift.ts)

### Application orchestration

- СЃС†РµРЅР°СЂРёР№ СЃРѕС…СЂР°РЅРµРЅРёСЏ СЌР»РµРјРµРЅС‚РѕРІ СЃРјРµРЅС‹;
- СЃР±РѕСЂ access/context/shift-resolution;
- orchestration around shift close / totals recomputation.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [saveShiftItemsApplication.ts](C:\projects\kezek\apps\web\src\app\api\staff\shift\items\saveShiftItemsApplication.ts)
- [shiftItemsWorkflow.ts](C:\projects\kezek\apps\web\src\app\api\staff\shift\items\shiftItemsWorkflow.ts)

### Infra adapter

- Supabase queries/mutations РїРѕ shift items;
- route handlers;
- API metrics/logging wrapper.

---

## 4. Notifications

### Domain rule

- booking event type РєР°Рє Р±РёР·РЅРµСЃ-СЃРёРіРЅР°Р»;
- Р°Р±СЃС‚СЂР°РєС†РёСЏ notification message/channel/result;
- СЂРµС€РµРЅРёРµ вЂњРєРѕРіРґР° РЅР°РґРѕ РѕС‚РїСЂР°РІРёС‚СЊ СЃРѕР±С‹С‚РёРµвЂќ.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [notifications.ts](C:\projects\kezek\packages\core-domain\src\ports\notifications.ts)
- [useCases.ts](C:\projects\kezek\packages\core-domain\src\booking\useCases.ts)

### Application orchestration

- СЃР±РѕСЂ booking data / participant data;
- fan-out РїРѕ РєР°РЅР°Р»Р°Рј;
- retries / partial failures / aggregation result.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [BookingDataService.ts](C:\projects\kezek\apps\web\src\lib\notifications\BookingDataService.ts)
- [NotificationOrchestrator.ts](C:\projects\kezek\apps\web\src\lib\notifications\NotificationOrchestrator.ts)

### Infra adapter

- Email / WhatsApp / Telegram providers;
- template rendering;
- provider-specific payload formatting.

РљР»СЋС‡РµРІС‹Рµ С„Р°Р№Р»С‹:

- [EmailNotificationService.ts](C:\projects\kezek\apps\web\src\lib\notifications\EmailNotificationService.ts)
- [WhatsAppNotificationService.ts](C:\projects\kezek\apps\web\src\lib\notifications\WhatsAppNotificationService.ts)
- [TelegramNotificationService.ts](C:\projects\kezek\apps\web\src\lib\notifications\TelegramNotificationService.ts)

---

## Р РµС€РµРЅРёРµ РїРѕ `ports`

РџСЂРѕРІРµСЂРєР° РїРѕРєР°Р·Р°Р»Р°:

- СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ booking use-cases СѓР¶Рµ Р·Р°РІСЏР·Р°РЅС‹ РЅР° РїРѕСЂС‚С‹ Рё РЅРµ С‚СЂРµР±СѓСЋС‚ СЃСЂРѕС‡РЅРѕРіРѕ СЂР°СЃС€РёСЂРµРЅРёСЏ;
- РЅРѕРІС‹Рµ РїРµСЂРµРЅРѕСЃС‹ РІ `finance`, `schedule` Рё `client booking semantics` РїРѕРєР° РѕСЃС‚Р°СЋС‚СЃСЏ С‡РёСЃС‚С‹РјРё РґРѕРјРµРЅРЅС‹РјРё helpers Рё РЅРµ СѓРїРёСЂР°СЋС‚СЃСЏ РІ РєРѕРЅРєСЂРµС‚РЅС‹Р№ Supabase/HTTP-РєРѕРґ;
- Р·РЅР°С‡РёС‚ РѕС‚РґРµР»СЊРЅРѕРµ СЂР°СЃС€РёСЂРµРЅРёРµ `packages/core-domain/src/ports/*` РІ СЌС‚РѕР№ РІРѕР»РЅРµ РЅРµ С‚СЂРµР±СѓРµС‚СЃСЏ.

РЎР»РµРґСѓСЋС‰РёР№ С‚СЂРёРіРіРµСЂ РґР»СЏ СЂР°СЃС€РёСЂРµРЅРёСЏ `ports`:

- РµСЃР»Рё `schedule availability` Р±СѓРґРµС‚ РѕС„РѕСЂРјР»СЏС‚СЊСЃСЏ РЅРµ С‚РѕР»СЊРєРѕ РєР°Рє helpers, Р° РєР°Рє РїРѕР»РЅРѕС†РµРЅРЅС‹Р№ use case СЃ Р·Р°РіСЂСѓР·РєРѕР№ schedule rules / slots С‡РµСЂРµР· РёРЅС‚РµСЂС„РµР№СЃС‹;
- РµСЃР»Рё notification use-cases РЅР°С‡РЅСѓС‚ С‚СЂРµР±РѕРІР°С‚СЊ richer delivery feedback РёР»Рё preferences contract РЅР° СѓСЂРѕРІРЅРµ РґРѕРјРµРЅР°.

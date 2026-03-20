# РђСѓРґРёС‚ РјРµСЃС‚ С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёСЏ (РґР°С‚С‹, РІСЂРµРјСЏ, С†РµРЅС‹)

**Дата проверки:** 2026-03-19  
**Источник правды:** shared formatters, UI formatting helpers и текущие screens/pages  
**Когда пересматривать:** при изменениях formatter policy или масштабной UI formatting cleanup


Р—Р°РґР°С‡Р° 7.1 REFACTOR_TASKS. Р’СЃРµ РјРµСЃС‚Р° РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ formatTimeSlot, formatDateLabel, formatPrice Рё Р°РЅР°Р»РѕРіРѕРІ РІ mobile Рё web.

---

## 1. Mobile

### 1.1 РСЃРїРѕР»СЊР·СѓСЋС‚ `@shared-client/formatters`

| Р¤Р°Р№Р» | РСЃРїРѕР»СЊР·СѓРµС‚ |
|------|------------|
| `BookingStep6Confirm.tsx` | `formatTimeSlot`, `formatDateLabel`, `formatServicePrice` |
| `BookingStep2Service.tsx` | `formatServicePrice` (Р·Р°РјРµРЅР° Р»РѕРєР°Р»СЊРЅРѕРіРѕ formatPrice) |
| `BookingStep4Date.tsx` | `formatDateLabel` РґР»СЏ day/month + Р»РѕРєР°Р»СЊРЅРѕ weekday |
| `BookingStep5Time.tsx` | `formatTimeSlot` (Р·Р°РјРµРЅР° Р»РѕРєР°Р»СЊРЅРѕР№ С„СѓРЅРєС†РёРё) |

### 1.2 Р›РѕРєР°Р»СЊРЅС‹Рµ РґСѓР±Р»РёРєР°С‚С‹ (РѕСЃС‚Р°РІС€РёРµСЃСЏ)

РќРµС‚ вЂ” С€Р°РіРё Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ РїРµСЂРµРІРµРґРµРЅС‹ РЅР° shared-client (Р·Р°РґР°С‡Р° 7.2).

### 1.3 РћР±С‰РёРµ СѓС‚РёР»РёС‚С‹ mobile (`apps/mobile/src/utils/format.ts`)

| Р¤СѓРЅРєС†РёСЏ | РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ |
|---------|----------------|
| `formatDate` | StaffScreen, ShiftsScreen, CabinetScreen, HomeScreen, BookingDetailsScreen, ShiftQuickScreen |
| `formatTime` | StaffScreen, CabinetScreen, HomeScreen, BookingDetailsScreen, ShiftQuickScreen |
| `formatDateTime` | (РѕРїСЂРµРґРµР»РµРЅР°, РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ вЂ” РїРѕ РєРѕРґСѓ) |
| `formatPrice(price, currency)` | ShiftsScreen, ShiftQuickScreen (С‡РёСЃР»Рѕ + РІР°Р»СЋС‚Р°) |

Р­С‚Рё С„СѓРЅРєС†РёРё вЂ” РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РґР°С‚С‹/РІСЂРµРјРµРЅРё/С†РµРЅ РІ РєР°СЂС‚РѕС‡РєР°С… Рё СЃРїРёСЃРєР°С…; РєРѕРЅС‚СЂР°РєС‚ (С‡РёСЃР»Рѕ, РґР°С‚Р° ISO) РѕС‚Р»РёС‡Р°РµС‚СЃСЏ РѕС‚ shared `formatServicePrice` (РѕР±СЉРµРєС‚ СЃ price_from/price_to). Р’Р°СЂРёР°РЅС‚: РІС‹РЅРµСЃС‚Рё РІ shared-client Р°РЅР°Р»РѕРі `formatPrice(amount, currency)` РґР»СЏ РµРґРёРЅРѕРѕР±СЂР°Р·РёСЏ.

### 1.4 РџСЂСЏРјРѕРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ РЅР°С‚РёРІРЅРѕРіРѕ С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёСЏ

| Р¤Р°Р№Р» | РљРѕРґ |
|------|-----|
| `ShiftsScreen.tsx` | `new Date(shift.opened_at).toLocaleTimeString('ru-RU', {...})`, `new Date(item.created_at).toLocaleTimeString('ru-RU', {...})` |

---

## 2. Web

### 2.1 Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Р№ СЃР»РѕР№ (`apps/web/src/lib/dateFormat.ts`)

- `formatDate`, `formatDateBrowser`, `formatMonthYear`, `formatTime`, `formatDateTime` вЂ” СЃ Р»РѕРєР°Р»СЏРјРё ru/ky/en Рё TZ.
- РСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ РІ: staff/finance (utils, ShiftHeader, ClientItem, StaffFinanceStats), StaffBookingsView, admin (health-check, system-health, ratings-status, ratings-debug).

### 2.2 Р›РѕРєР°Р»СЊРЅС‹Рµ РѕР±С‘СЂС‚РєРё РЅР°Рґ formatDateTime/formatDate

| Р¤Р°Р№Р» | Р§С‚Рѕ |
|------|-----|
| `admin/health-check/page.tsx` | `formatDate(value)` в†’ `formatDateTime(value, 'ru', true)` |
| `admin/system-health/SystemHealthClient.tsx` | `formatDate(dateStr)` в†’ `formatDateTime(dateStr, 'ru', true)` |
| `admin/ratings-status/page.tsx` | `formatDate(value)` в†’ value ? formatDateTime(value, 'ru', true) : 'РЅРµС‚ РґР°РЅРЅС‹С…' |
| `staff/bookings/StaffBookingsView.tsx` | `formatDateTimeLocal(iso)` в†’ `formatDateTime(iso, locale, true)` |
| `staff/finance/components/StaffFinanceStats.tsx` | Р›РѕРєР°Р»СЊРЅС‹Р№ `formatTime(iso)` РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ + РїСЂРѕРїСЃ `formatDate` РёР· dateFormat |

РРјРµРµС‚ СЃРјС‹СЃР» РѕСЃС‚Р°РІРёС‚СЊ РѕРґРёРЅ РѕР±С‰РёР№ С…РµР»РїРµСЂ РІ dateFormat РґР»СЏ В«РґР°С‚Р°+РІСЂРµРјСЏ СЃ Р»РѕРєР°Р»СЊСЋВ», С‡С‚РѕР±С‹ РЅРµ РґСѓР±Р»РёСЂРѕРІР°С‚СЊ РѕР±С‘СЂС‚РєРё.

### 2.3 РџСЂСЏРјРѕРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ `formatInTimeZone` (date-fns-tz)

РњРЅРѕРіРѕ РјРµСЃС‚ РґР»СЏ СЂР°Р±РѕС‡РёС… РґР°С‚ (yyyy-MM-dd, HH:mm, dd.MM.yyyy HH:mm):

- `QuickDesk.tsx`, `BookingsList.tsx`, `view.tsx` (dashboard/bookings), `useQuickDeskFormResets.ts`
- `lib/time.ts`, `lib/dateFormat.ts`, `lib/notifications/messageBuilders.ts`, `lib/notifications/shiftNotifications.ts`, `lib/staffSchedule.ts`
- `staff/finance` (hooks, StatsView, ShiftHeader, ClientsListHeader, ClientEditForm, FinancePage), `staff/bookings` (StaffBookingsView, page), `staff/schedule/ViewSchedule.tsx`
- `b/[slug]/view.tsx`, `useTemporaryTransfers.ts`, `cabinet/bookings/page.tsx`, `cabinet/components/BookingCard.tsx`
- `dashboard/staff/[id]/slots` (Client, page), `dashboard/finance/AllStaffFinanceStats.tsx`, `dashboard/page.tsx`
- API: `api/cron/close-shifts`, `api/dashboard/staff/[id]/shift/open`, `api/staff/shift/open`, `api/staff/shift/items`, `api/dashboard/staff/finance/all`, `api/webhooks/whatsapp`, `admin/api/system-health`
- Р”СЂСѓРіРёРµ: `terms/page.tsx`, `privacy/page.tsx`, `data-deletion/page.tsx`, `admin/businesses` (page, [id]/branches, BusinessCardEdit), `admin/page.tsx`, `b/[slug]/promotions/PromotionsPageClient.tsx`

Р§Р°СЃС‚СЊ РёР· РЅРёС… вЂ” С‡РёСЃС‚Рѕ В«СЂР°Р±РѕС‡РёРµВ» С„РѕСЂРјР°С‚С‹ (yyyy-MM-dd РґР»СЏ API/РєР°Р»РµРЅРґР°СЂСЏ), С‡Р°СЃС‚СЊ вЂ” РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ (dd.MM.yyyy HH:mm). Р”Р»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРіРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ С†РµР»РµСЃРѕРѕР±СЂР°Р·РЅРѕ РІРµР·РґРµ РёРґС‚Рё С‡РµСЂРµР· `@/lib/dateFormat` (РёР»Рё РІ РїРµСЂСЃРїРµРєС‚РёРІРµ С‡РµСЂРµР· shared-client).

### 2.4 РџСЂСЏРјРѕРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ `toLocaleDateString` / `toLocaleTimeString`

| Р¤Р°Р№Р» | РљРѕРЅС‚РµРєСЃС‚ |
|------|----------|
| `terms/page.tsx` | РџРѕСЃР»РµРґРЅРµРµ РѕР±РЅРѕРІР»РµРЅРёРµ: new Date().toLocaleDateString('ru-RU', ...) |
| `privacy/page.tsx` | РђРЅР°Р»РѕРіРёС‡РЅРѕ |
| `data-deletion/page.tsx` | РђРЅР°Р»РѕРіРёС‡РЅРѕ |
| `admin/businesses/[id]/branches/page.tsx` | РЎРѕР·РґР°РЅ: branch.created_at |
| `admin/businesses/page.tsx` | РЎРѕР·РґР°РЅ: b.created_at |
| `admin/page.tsx` | b.created_at |
| `admin/businesses/[id]/BusinessCardEdit.tsx` | initial.created_at |
| `dashboard/finance/AllStaffFinanceStats.tsx` | Р›РѕРєР°Р»РёР·РѕРІР°РЅРЅС‹Рµ РґР°С‚С‹ РґР»СЏ date/month picker |
| `b/[slug]/promotions/PromotionsPageClient.tsx` | valid_from / valid_to РїРѕ Р»РѕРєР°Р»Рё |

РРјРµРµС‚ СЃРјС‹СЃР» Р·Р°РјРµРЅРёС‚СЊ РЅР° РІС‹Р·РѕРІС‹ РёР· `@/lib/dateFormat` (РёР»Рё РѕР±С‰РµРіРѕ С„РѕСЂРјР°С‚С‚РµСЂР° СЃ Р»РѕРєР°Р»СЊСЋ).

---

## 3. РС‚РѕРі РїРѕ Р·Р°РґР°С‡Р°Рј 7.2

- **Mobile:** Р·Р°РјРµРЅРёС‚СЊ Р»РѕРєР°Р»СЊРЅС‹Рµ `formatTimeSlot` РІ Step5 Рё `formatPrice` (С†РµРЅР° СѓСЃР»СѓРіРё) РІ Step2 РЅР° `@shared-client/formatters`; РґР»СЏ Step4 СЂРµС€РёС‚СЊ, СЂР°СЃС€РёСЂСЏС‚СЊ Р»Рё `formatDateLabel` РІ shared РїРѕР»РµРј `weekday` РёР»Рё РѕСЃС‚Р°РІРёС‚СЊ С‚РѕР»СЊРєРѕ day/month РёР· shared.
- **Mobile:** СЂР°СЃСЃРјРѕС‚СЂРµС‚СЊ РїРµСЂРµРЅРѕСЃ `formatDate`/`formatTime`/`formatPrice` РёР· `utils/format.ts` РІ shared-client (РёР»Рё РїРѕРІС‚РѕСЂРЅРѕРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… С„РѕСЂРјР°С‚С‚РµСЂРѕРІ СЃ РѕР±С‰РёРј РєРѕРЅС‚СЂР°РєС‚РѕРј).
- **Web:** СЃРѕРєСЂР°С‚РёС‚СЊ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РѕР±С‘СЂС‚РѕРє `formatDate`/`formatDateTime` РІ admin Рё staff вЂ” РѕРґРёРЅ С„Р°СЃР°Рґ РІ dateFormat; РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРµ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РґР°С‚/РІСЂРµРјРµРЅРё РІРµСЃС‚Рё С‡РµСЂРµР· dateFormat; РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё РІС‹РЅРµСЃС‚Рё РѕР±С‰РёРµ С„РѕСЂРјР°С‚С‚РµСЂС‹ РІ shared-client Рё РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РІ web Рё mobile.

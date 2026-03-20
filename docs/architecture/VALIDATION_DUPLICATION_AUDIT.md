# РђСѓРґРёС‚ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ validation-РїСЂР°РІРёР»

**Дата проверки:** 2026-03-19  
**Источник правды:** VALIDATION_BOUNDARY_POLICY.md и текущие validation schemas/use cases  
**Когда пересматривать:** после изменений в boundary validation или core-domain validation


**Р”Р°С‚Р°:** 2026-03-19  
**Р¦РµР»СЊ:** Р·Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ, РіРґРµ РѕРґРЅР° Рё С‚Р° Р¶Рµ РїСЂРѕРІРµСЂРєР° Р±С‹Р»Р° РёР»Рё РѕСЃС‚Р°С‘С‚СЃСЏ СЂРµР°Р»РёР·РѕРІР°РЅР° РґРІР°Р¶РґС‹ РјРµР¶РґСѓ boundary Zod-СЃС…РµРјР°РјРё Рё `packages/core-domain`.

---

## РљРѕСЂРѕС‚РєРёР№ РІС‹РІРѕРґ

Р“Р»Р°РІРЅС‹Р№ РґСѓР±Р»СЊ Р±С‹Р» РІ booking payload validation:

- `quickHoldSchema` / `quickBookGuestSchema` СѓР¶Рµ РІР°Р»РёРґРёСЂРѕРІР°Р»Рё shape Рё С„РѕСЂРјР°С‚ payload РЅР° boundary;
- РїРѕСЃР»Рµ СЌС‚РѕРіРѕ `packages/core-domain/src/booking/validation.ts` РїРѕРІС‚РѕСЂРЅРѕ РІР°Р»РёРґРёСЂРѕРІР°Р» С‚Рµ Р¶Рµ РїРѕР»СЏ С‡РµСЂРµР·
  - `validateCreateBookingParams`
  - `validateCreateGuestBookingParams`.

Р­С‚РѕС‚ РґСѓР±Р»СЊ СѓР¶Рµ СѓСЃС‚СЂР°РЅС‘РЅ.

РЎРµР№С‡Р°СЃ `packages/core-domain/src/booking/validation.ts` РѕСЃС‚Р°РІР»РµРЅ С‚РѕР»СЊРєРѕ РґР»СЏ:

- `validateBranchForBooking`
- `validatePromotionParams`
- `extractBookingId`

РўРѕ РµСЃС‚СЊ core-domain Р±РѕР»СЊС€Рµ РЅРµ РїРѕРІС‚РѕСЂСЏРµС‚ Zod-РїСЂРѕРІРµСЂРєРё `uuid` / `email` / `phone` / `ISO datetime` РґР»СЏ booking payload.

---

## РљРµР№СЃС‹, РєРѕС‚РѕСЂС‹Рµ Р±С‹Р»Рё РґСѓР±Р»СЏРјРё Рё СѓР¶Рµ СѓСЃС‚СЂР°РЅРµРЅС‹

### 1. Booking create payload

Boundary:

- [bookingSchemas.ts](C:\projects\kezek\apps\web\src\lib\validation\bookingSchemas.ts)

Р Р°РЅСЊС€Рµ РґСѓР±Р»РёСЂРѕРІР°Р»РѕСЃСЊ РІ:

- [validation.ts](C:\projects\kezek\packages\core-domain\src\booking\validation.ts)

Р§С‚Рѕ РёРјРµРЅРЅРѕ РґСѓР±Р»РёСЂРѕРІР°Р»РѕСЃСЊ:

- РѕР±СЏР·Р°С‚РµР»СЊРЅРѕСЃС‚СЊ `biz_id`, `service_id`, `staff_id`, `start_at`;
- СЃС‚СЂРѕРєРѕРІС‹Р№ С‚РёРї СЌС‚РёС… РїРѕР»РµР№;
- Р±Р°Р·РѕРІР°СЏ РїСЂРѕРІРµСЂРєР° `branch_id`;
- Р±Р°Р·РѕРІР°СЏ РїСЂРѕРІРµСЂРєР° `start_at` РєР°Рє РґР°С‚С‹.

РЎС‚Р°С‚СѓСЃ:

- СѓСЃС‚СЂР°РЅРµРЅРѕ.

Р“РґРµ СѓРїСЂРѕС‰РµРЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:

- [route.ts](C:\projects\kezek\apps\web\src\app\api\quick-hold\route.ts)

---

### 2. Guest booking payload

Boundary:

- [bookingSchemas.ts](C:\projects\kezek\apps\web\src\lib\validation\bookingSchemas.ts)

Р Р°РЅСЊС€Рµ РґСѓР±Р»РёСЂРѕРІР°Р»РѕСЃСЊ РІ:

- [validation.ts](C:\projects\kezek\packages\core-domain\src\booking\validation.ts)

Р§С‚Рѕ РёРјРµРЅРЅРѕ РґСѓР±Р»РёСЂРѕРІР°Р»РѕСЃСЊ:

- РѕР±СЏР·Р°С‚РµР»СЊРЅРѕСЃС‚СЊ `branch_id`, `client_name`, `client_phone`;
- РїРѕРІС‚РѕСЂРЅР°СЏ email-РїСЂРѕРІРµСЂРєР°;
- РїРѕРІС‚РѕСЂРЅР°СЏ phone-РЅРѕСЂРјР°Р»РёР·Р°С†РёСЏ/shape-РїСЂРѕРІРµСЂРєР° РїРѕРІРµСЂС… СѓР¶Рµ РїСЂРѕРІР°Р»РёРґРёСЂРѕРІР°РЅРЅРѕРіРѕ payload.

РЎС‚Р°С‚СѓСЃ:

- СѓСЃС‚СЂР°РЅРµРЅРѕ.

Р“РґРµ СѓРїСЂРѕС‰РµРЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:

- [route.ts](C:\projects\kezek\apps\web\src\app\api\quick-book-guest\route.ts)

---

## РљРµР№СЃС‹, РєРѕС‚РѕСЂС‹Рµ РІС‹РіР»СЏРґСЏС‚ РїРѕС…РѕР¶Рµ, РЅРѕ РЅРµ СЃС‡РёС‚Р°СЋС‚СЃСЏ РґСѓР±Р»РµРј

### 1. `markAttendanceSchema` + `canMarkAttendance`

Boundary:

- [bookingSchemas.ts](C:\projects\kezek\apps\web\src\lib\validation\bookingSchemas.ts)
- [schemas.ts](C:\projects\kezek\apps\web\src\lib\validation\schemas.ts)

Domain:

- [statusTransitions.ts](C:\projects\kezek\packages\core-domain\src\booking\statusTransitions.ts)

РџРѕС‡РµРјСѓ СЌС‚Рѕ РЅРµ РґСѓР±Р»СЊ:

- boundary РїСЂРѕРІРµСЂСЏРµС‚ С‚РѕР»СЊРєРѕ shape payload (`attended: boolean`);
- domain РїСЂРѕРІРµСЂСЏРµС‚, РґРѕРїСѓСЃС‚РёРјРѕ Р»Рё РІРѕРѕР±С‰Рµ РѕС‚РјРµС‡Р°С‚СЊ РїРѕСЃРµС‰РµРЅРёРµ РґР»СЏ СЃС‚Р°С‚СѓСЃР° Рё РјРѕРјРµРЅС‚Р° РІСЂРµРјРµРЅРё.

---

### 2. `notifyRequestSchema` + notification use case

Boundary:

- [schemas.ts](C:\projects\kezek\apps\web\src\lib\validation\schemas.ts)

Domain:

- [useCases.ts](C:\projects\kezek\packages\core-domain\src\booking\useCases.ts)

РџРѕС‡РµРјСѓ СЌС‚Рѕ РЅРµ РґСѓР±Р»СЊ:

- Zod РІР°Р»РёРґРёСЂСѓРµС‚ `type` Рё `booking_id`;
- domain use case С‚РѕР»СЊРєРѕ РёРЅРёС†РёРёСЂСѓРµС‚ Р±РёР·РЅРµСЃ-СЃРѕР±С‹С‚РёРµ РѕС‚РїСЂР°РІРєРё.

---

### 3. `validatePromotionParams`

Boundary:

- СЏРІРЅРѕР№ Zod-СЃС…РµРјС‹ РЅР° promotion params СЃРµР№С‡Р°СЃ РЅРµС‚ РєР°Рє РѕСЃРЅРѕРІРЅРѕРіРѕ РёСЃС‚РѕС‡РЅРёРєР° РёСЃС‚РёРЅС‹.

Domain:

- [validation.ts](C:\projects\kezek\packages\core-domain\src\booking\validation.ts)

РџРѕС‡РµРјСѓ СЌС‚Рѕ РЅРµ РґСѓР±Р»СЊ:

- СЌС‚Рѕ РёРјРµРЅРЅРѕ РґРѕРјРµРЅРЅР°СЏ РїСЂРѕРІРµСЂРєР° РґРѕРїСѓСЃС‚РёРјРѕСЃС‚Рё РїР°СЂР°РјРµС‚СЂРѕРІ РґР»СЏ РєРѕРЅРєСЂРµС‚РЅРѕРіРѕ `PromotionType`.

---

### 4. `validateBranchForBooking`

Boundary:

- Zod РЅРµ Р·РЅР°РµС‚, СЃСѓС‰РµСЃС‚РІСѓРµС‚ Р»Рё С„РёР»РёР°Р» Рё Р°РєС‚РёРІРµРЅ Р»Рё РѕРЅ.

Domain:

- [validation.ts](C:\projects\kezek\packages\core-domain\src\booking\validation.ts)

РџРѕС‡РµРјСѓ СЌС‚Рѕ РЅРµ РґСѓР±Р»СЊ:

- СЌС‚Рѕ РїСЂРµРґРјРµС‚РЅС‹Р№ РёРЅРІР°СЂРёР°РЅС‚ РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё branch РёР· repository.

---

## РћСЃС‚Р°С‚РѕС‡РЅС‹Рµ Р·РѕРЅС‹ РІРЅРёРјР°РЅРёСЏ

### 1. Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ `markAttendanceSchema`

РЎРµР№С‡Р°СЃ `markAttendanceSchema` РІСЃС‚СЂРµС‡Р°РµС‚СЃСЏ РІ РґРІСѓС… РјРµСЃС‚Р°С…:

- [bookingSchemas.ts](C:\projects\kezek\apps\web\src\lib\validation\bookingSchemas.ts)
- [schemas.ts](C:\projects\kezek\apps\web\src\lib\validation\schemas.ts)

Р­С‚Рѕ СѓР¶Рµ РЅРµ boundary-vs-domain РґСѓР±Р»СЊ, Р° boundary-vs-boundary РґСѓР±Р»СЊ РІРЅСѓС‚СЂРё `apps/web`.

РџСЂРёРѕСЂРёС‚РµС‚:

- СЃСЂРµРґРЅРёР№.

Р РµС€РµРЅРёРµ:

- РѕСЃС‚Р°РІРёС‚СЊ РѕРґРёРЅ СЌРєСЃРїРѕСЂС‚ РєР°Рє РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹ Рё РІС‚РѕСЂРѕР№ РїСЂРµРІСЂР°С‚РёС‚СЊ РІ re-export РёР»Рё СѓРґР°Р»РёС‚СЊ.

---

### 2. Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ `packages/core-domain/src/booking/README.md`

Р’ СЃС‚Р°СЂРѕР№ РґРѕРєСѓРјРµРЅС‚Р°С†РёРё РІСЃС‘ РµС‰С‘ РјРѕРіСѓС‚ РІСЃС‚СЂРµС‡Р°С‚СЊСЃСЏ СЃСЃС‹Р»РєРё РЅР° СѓРґР°Р»С‘РЅРЅС‹Рµ helper-С„СѓРЅРєС†РёРё payload validation.

РџСЂРёРѕСЂРёС‚РµС‚:

- РЅРёР·РєРёР№, РЅРѕ Р»СѓС‡С€Рµ РґРѕС‡РёСЃС‚РёС‚СЊ РїСЂРё СЃР»РµРґСѓСЋС‰РµРј РїСЂРѕС…РѕРґРµ РїРѕ docs.

---

## РС‚РѕРі

РќР° СЃРµРіРѕРґРЅСЏ РєР»СЋС‡РµРІРѕР№ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅС‹Р№ РґСѓР±Р»СЊ РјРµР¶РґСѓ boundary Рё domain СѓР¶Рµ СѓР±СЂР°РЅ:

- shape/format booking payload РІР°Р»РёРґРёСЂСѓРµС‚СЃСЏ РЅР° Zod boundary;
- `core-domain` Р±РѕР»СЊС€Рµ РЅРµ РїРѕРІС‚РѕСЂСЏРµС‚ С‚Рµ Р¶Рµ РїСЂРѕРІРµСЂРєРё;
- РІ domain РѕСЃС‚Р°Р»РёСЃСЊ С‚РѕР»СЊРєРѕ СЃРјС‹СЃР»РѕРІС‹Рµ РїСЂРѕРІРµСЂРєРё Рё РёРЅРІР°СЂРёР°РЅС‚С‹.

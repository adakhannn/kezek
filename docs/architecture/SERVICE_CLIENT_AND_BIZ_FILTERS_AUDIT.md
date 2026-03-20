# РђСѓРґРёС‚: Service client Р±РµР· RLS Рё С„РёР»СЊС‚СЂС‹ РїРѕ biz_id

**Дата проверки:** 2026-03-19  
**Источник правды:** SERVICE_CLIENT_USAGE_GUIDE.md и текущий manager API code  
**Когда пересматривать:** при изменениях service client usage или manager context access rules


Р”РѕРєСѓРјРµРЅС‚ С„РёРєСЃРёСЂСѓРµС‚ РІСЃРµ РјРµСЃС‚Р° РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ service/client admin-РєР»РёРµРЅС‚Р°, РЅР°Р»РёС‡РёРµ С„РёР»СЊС‚СЂРѕРІ РїРѕ `biz_id`/`branch.biz_id`, С‚СЂРµР±РѕРІР°РЅРёСЏ Рє Р±РµР·РѕРїР°СЃРЅРѕРјСѓ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЋ Рё РїР»Р°РЅ РјРёРіСЂР°С†РёРё РЅР° РѕР±С‘СЂС‚РєСѓ `withManagerContext` (Р±Р»РѕРєРё 5.2 Рё 5.7 РІ `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md`).

---

## 1. РСЃС‚РѕС‡РЅРёРєРё service-РєР»РёРµРЅС‚Р°

| РњРѕРґСѓР»СЊ | Р¤СѓРЅРєС†РёСЏ | РќР°Р·РЅР°С‡РµРЅРёРµ |
|--------|---------|------------|
| `@/lib/supabaseService` | `getServiceClient()` | Р•РґРёРЅР°СЏ С‚РѕС‡РєР° СЃРѕР·РґР°РЅРёСЏ РєР»РёРµРЅС‚Р° СЃ Service Role Key (РѕР±С…РѕРґ RLS). |
| `@/lib/supabaseHelpers` | `createSupabaseAdminClient()` | РўРѕ Р¶Рµ, РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ authBiz, staffRoleSync, С‡Р°СЃС‚Рё API (whatsapp, restore/dismiss). |

РћР±Р° РІРѕР·РІСЂР°С‰Р°СЋС‚ РєР»РёРµРЅС‚ Р±РµР· RLS; РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚СЊ Р·Р° РѕРіСЂР°РЅРёС‡РµРЅРёРµ РґРѕСЃС‚СѓРїР° РїРѕ Р±РёР·РЅРµСЃСѓ Р»РµР¶РёС‚ РЅР° РєРѕРґРµ.

---

## 2. РЎРІРѕРґРЅР°СЏ С‚Р°Р±Р»РёС†Р° РёСЃРїРѕР»СЊР·РѕРІР°РЅРёР№

### 2.1. `/api/dashboard/*` (РєРѕРЅС‚РµРєСЃС‚ РІР»Р°РґРµР»СЊС†Р°/РјРµРЅРµРґР¶РµСЂР°)

Р’СЃРµ РјР°СЂС€СЂСѓС‚С‹ СЃРЅР°С‡Р°Р»Р° РІС‹Р·С‹РІР°СЋС‚ `getBizContextForManagers()` Рё РїРѕР»СѓС‡Р°СЋС‚ `bizId`. Service client РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ Р·Р°РїСЂРѕСЃРѕРІ Рє С‚Р°Р±Р»РёС†Р°Рј, РіРґРµ СЏРІРЅРѕ С„РёР»СЊС‚СЂСѓСЋС‚ РїРѕ `biz_id` РёР»Рё РїСЂРѕРІРµСЂСЏСЋС‚ РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚СЊ СЂРµСЃСѓСЂСЃР° С‡РµСЂРµР· `checkResourceBelongsToBiz` / `checkResourceBelongsToBusiness`.

| Р¤Р°Р№Р» | РљРѕРЅС‚РµРєСЃС‚ | Р¤РёР»СЊС‚СЂ РїРѕ biz_id / РїСЂРѕРІРµСЂРєР° |
|------|----------|-----------------------------|
| `dashboard/analytics/overview/route.ts` | getBizContextForManagers в†’ bizId | `.eq('biz_id', bizId)` РЅР° business_daily_stats |
| `dashboard/analytics/load/route.ts` | getBizContextForManagers в†’ bizId | `.eq('biz_id', bizId)` РЅР° business_hourly_load |
| `dashboard/branches/list/route.ts` | getBizContextForManagers в†’ bizId | `.eq('biz_id', bizId)` РЅР° branches |
| `dashboard/staff/[id]/shift/open/route.ts` | getBizContextForManagers в†’ bizId | РџСЂРѕРІРµСЂРєР° staff.biz_id === bizId; Р·Р°РїРёСЃСЊ РІ staff_shifts СЃ biz_id; РІСЃРµ РІС‹Р±РѕСЂРєРё РїРѕ staff_id (РєРѕСЃРІРµРЅРЅРѕ РїРѕ Р±РёР·РЅРµСЃСѓ) |
| `dashboard/staff/[id]/finance/route.ts` | getBizContextForManagers в†’ bizId | checkResourceBelongsToBiz(staff); Р·Р°РїСЂРѕСЃС‹ СЃ `.eq('biz_id', bizId)` |
| `dashboard/staff/[id]/finance/stats/route.ts` | getBizContextForManagers в†’ bizId | checkResourceBelongsToBiz(staff); Р·Р°РїСЂРѕСЃС‹ СЃ `.eq('biz_id', bizId)` |
| `dashboard/staff/[id]/finance/audit-log/route.ts` | getBizContextForManagers в†’ bizId | checkResourceBelongsToBiz(staff); `.eq('biz_id', bizId)` |
| `dashboard/staff/finance/all/route.ts` | getBizContextForManagers в†’ bizId | `.eq('biz_id', bizId)`; RPC СЃ p_biz_id |
| `dashboard/staff-shifts/[id]/update-hours/route.ts` | getBizContextForManagers в†’ bizId | checkResourceBelongsToBiz (shift С‡РµСЂРµР· staff) |
| `dashboard/branches/[branchId]/promotions/route.ts` | getBizContextForManagers в†’ bizId | check branch.biz_id === bizId; `.eq('biz_id', bizId)` |
| `dashboard/branches/[branchId]/promotions/[promotionId]/route.ts` | getBizContextForManagers в†’ bizId | branch.biz_id === bizId; Р·Р°РїСЂРѕСЃС‹ СЃ `.eq('biz_id', bizId)` |

**Р’С‹РІРѕРґ:** Р’РµР·РґРµ РµСЃС‚СЊ СЏРІРЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚ `bizId` Рё С„РёР»СЊС‚СЂР°С†РёСЏ РёР»Рё РїСЂРѕРІРµСЂРєР° РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё. РљР°РЅРґРёРґР°С‚С‹ РЅР° РїРµСЂРµС…РѕРґ РЅР° `withManagerContext(handler)` СЃ РїРµСЂРµРґР°С‡РµР№ `bizId` Рё РµРґРёРЅС‹Рј РїРѕР»СѓС‡РµРЅРёРµРј service client РІРЅСѓС‚СЂРё РѕР±С‘СЂС‚РєРё.

---

### 2.2. `/api/staff/*`, `/api/branches/*`, `/api/services/*`, `/api/bookings/*`

РђРЅР°Р»РѕРіРёС‡РЅРѕ: РєРѕРЅС‚РµРєСЃС‚ С‡РµСЂРµР· `getBizContextForManagers()`, Р·Р°С‚РµРј РїСЂРѕРІРµСЂРєРё РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё Рё/РёР»Рё `.eq('biz_id', bizId)`.

| Р”РѕРјРµРЅ | Р¤Р°Р№Р»С‹ (РїСЂРёРјРµСЂС‹) | РљРѕРЅС‚РµРєСЃС‚ | Р¤РёР»СЊС‚СЂР°С†РёСЏ |
|-------|-----------------|----------|------------|
| staff | `[id]/update`, `[id]/delete`, `[id]/transfer`, `[id]/restore`, `[id]/dismiss`, `create`, `create-from-user`, `update`, `sync-roles`, `avatar/upload`, `avatar/remove`, `shift/close`, `shift/items` | getBizContextForManagers РёР»Рё РїСЂРѕРІРµСЂРєР° staff/branch | checkResourceBelongsToBiz(staff/branch), insert СЃ biz_id |
| branches | `create`, `[id]/update`, `[id]/delete`, `[id]/schedule` | getBizContextForManagers | insert/update СЃ biz_id, РїСЂРѕРІРµСЂРєР° branch.biz_id |
| services | `create`, `[id]/update`, `[id]/delete` | getBizContextForManagers | checkResourceBelongsToBiz(service), insert СЃ biz_id (С‡РµСЂРµР· branch) |
| bookings | `[id]/mark-attendance` | getBizContextForManagers в†’ bizId | Use case СЃ bookingRepository Рё РїСЂРѕРІРµСЂРєРѕР№ BOOKING_NOT_IN_BIZ |

**Р’С‹РІРѕРґ:** РџР°С‚С‚РµСЂРЅ РµРґРёРЅРѕРѕР±СЂР°Р·РЅС‹Р№: РєРѕРЅС‚РµРєСЃС‚ в†’ РїСЂРѕРІРµСЂРєР° РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё в†’ СЂР°Р±РѕС‚Р° С‡РµСЂРµР· admin. РџРѕРґС…РѕРґРёС‚ РґР»СЏ РѕР±С‘СЂС‚РєРё `withManagerContext`.

---

### 2.3. `/api/admin/*` (СЃРёСЃС‚РµРјРЅС‹Рµ / super_admin)

РСЃРїРѕР»СЊР·СѓСЋС‚ service client РґР»СЏ РѕРїРµСЂР°С†РёР№ Р±РµР· РїСЂРёРІСЏР·РєРё Рє РѕРґРЅРѕРјСѓ Р±РёР·РЅРµСЃСѓ (РІСЃРµ Р±РёР·РЅРµСЃС‹, СЂРµР№С‚РёРЅРіРё, Р°РЅР°Р»РёС‚РёРєР° РїР»Р°С‚С„РѕСЂРјС‹, Р·РґРѕСЂРѕРІСЊРµ). РџСЂРѕРІРµСЂРєР° РґРѕСЃС‚СѓРїР° вЂ” С‡РµСЂРµР· `is_super_admin` RPC.

| Р¤Р°Р№Р» | РќР°Р·РЅР°С‡РµРЅРёРµ | biz_id |
|------|------------|--------|
| `admin/ratings/debug-entities/route.ts` | РћС‚Р»Р°РґРєР° СЃСѓС‰РЅРѕСЃС‚РµР№ СЃ СЂРµР№С‚РёРЅРіР°РјРё | РџРµСЂРµР±РѕСЂ РїРѕ businesses (is_approved) |
| `admin/initialize-ratings/route.ts` | РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ СЂРµР№С‚РёРЅРіРѕРІ | РџРѕ РІСЃРµРј РѕРґРѕР±СЂРµРЅРЅС‹Рј Р±РёР·РЅРµСЃР°Рј |
| `admin/ratings/status/route.ts` | РЎС‚Р°С‚СѓСЃ СЂРµР№С‚РёРЅРіРѕРІ | РђРіСЂРµРіР°С‚С‹ РїРѕ РїР»Р°С‚С„РѕСЂРјРµ |
| `admin/health-check/route.ts` | РџСЂРѕРІРµСЂРєР° Р·РґРѕСЂРѕРІСЊСЏ | РЎРёСЃС‚РµРјРЅС‹Рµ РїСЂРѕРІРµСЂРєРё |
| `admin/system-analytics/overview/route.ts` | РђРЅР°Р»РёС‚РёРєР° РїР»Р°С‚С„РѕСЂРјС‹ | РђРіСЂРµРіР°С‚С‹ Р±РµР· С„РёР»СЊС‚СЂР° РїРѕ РѕРґРЅРѕРјСѓ biz |
| `admin/analytics/*` (overview, load, track, conversion-funnel, promotions) | РђРЅР°Р»РёС‚РёРєР° Р°РґРјРёРЅРєРё | РњРѕРіСѓС‚ РїСЂРёРЅРёРјР°С‚СЊ biz_id РїР°СЂР°РјРµС‚СЂРѕРј РґР»СЏ РѕРґРЅРѕРіРѕ Р±РёР·РЅРµСЃР° РёР»Рё РІСЃРµ |
| `admin/promotions/debug/route.ts` | РћС‚Р»Р°РґРєР° Р°РєС†РёР№ | РџРѕ Р±РёР·РЅРµСЃР°Рј/С„РёР»РёР°Р»Р°Рј |
| `admin/performance/stats/route.ts` | РњРµС‚СЂРёРєРё РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё | РЎРёСЃС‚РµРјРЅС‹Рµ |
| `admin/api/funnel-analytics/route.ts` | Р’РѕСЂРѕРЅРєР° | РџР»Р°С‚С„РѕСЂРјР° |
| `admin/api/system-health/route.ts` | Р—РґРѕСЂРѕРІСЊРµ СЃРёСЃС‚РµРјС‹ | РЎРёСЃС‚РµРјРЅС‹Рµ |
| `admin/api/finance-logs/route.ts` | Р›РѕРіРё С„РёРЅР°РЅСЃРѕРІ | РџРѕ Р·Р°РїСЂРѕСЃСѓ (biz/С„РёР»РёР°Р») |
| `admin/api/metrics/route.ts`, `stats/route.ts` | РњРµС‚СЂРёРєРё API | РЎРёСЃС‚РµРјРЅС‹Рµ |

**Р’С‹РІРѕРґ:** Р­С‚Рѕ РЅРµ РєРѕРЅС‚РµРєСЃС‚ В«РјРµРЅРµРґР¶РµСЂР° РѕРґРЅРѕРіРѕ Р±РёР·РЅРµСЃР°В»; РѕР±С‘СЂС‚РєР° `withManagerContext` РґР»СЏ РЅРёС… РЅРµ РїРѕРґС…РѕРґРёС‚. РћСЃС‚Р°РІРёС‚СЊ РїСЂРѕРІРµСЂРєСѓ `is_super_admin` Рё СЏРІРЅРѕ Р·Р°РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°С‚СЊ, С‡С‚Рѕ РІ `/api/admin/*` service client РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ СЃРёСЃС‚РµРјРЅС‹С… РѕРїРµСЂР°С†РёР№ (РёСЃРєР»СЋС‡РµРЅРёРµ РёР· РїСЂР°РІРёР»Р° 5.2).

---

### 2.4. `/api/cron/*`

Р¤РѕРЅРѕРІС‹Рµ Р·Р°РґР°С‡Рё Р±РµР· РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕР№ СЃРµСЃСЃРёРё; СЂР°Р±РѕС‚Р° РїРѕ РІСЃРµРј Р±РёР·РЅРµСЃР°Рј РёР»Рё РїРѕ СЂР°СЃРїРёСЃР°РЅРёСЋ.

| Р¤Р°Р№Р» | РќР°Р·РЅР°С‡РµРЅРёРµ | biz_id |
|------|------------|--------|
| `cron/analytics/hourly-load/route.ts` | Р Р°СЃС‡С‘С‚ РїРѕС‡Р°СЃРѕРІРѕР№ РЅР°РіСЂСѓР·РєРё | РџРµСЂРµР±РѕСЂ biz РёР· business_* РёР»Рё РєРѕРЅС„РёРіР° |
| `cron/analytics/daily/route.ts` | Р”РЅРµРІРЅР°СЏ Р°РЅР°Р»РёС‚РёРєР° | РџРѕ РІСЃРµРј Р±РёР·РЅРµСЃР°Рј |
| `cron/recalculate-ratings/route.ts` | РџРµСЂРµСЃС‡С‘С‚ СЂРµР№С‚РёРЅРіРѕРІ | РџРѕ РІСЃРµРј РѕРґРѕР±СЂРµРЅРЅС‹Рј Р±РёР·РЅРµСЃР°Рј |
| `cron/data-retention/route.ts` | РћС‡РёСЃС‚РєР° РґР°РЅРЅС‹С… | РЎРёСЃС‚РµРјРЅР°СЏ |
| `cron/health-check-alerts/route.ts` | РђР»РµСЂС‚С‹ Р·РґРѕСЂРѕРІСЊСЏ | РЎРёСЃС‚РµРјРЅР°СЏ |
| `cron/close-shifts/route.ts` | Р—Р°РєСЂС‹С‚РёРµ СЃРјРµРЅ | РџРѕ СЃРјРµРЅР°Рј/Р±РёР·РЅРµСЃР°Рј РїРѕ Р»РѕРіРёРєРµ |

**Р’С‹РІРѕРґ:** РСЃРєР»СЋС‡РµРЅРёРµ: РЅРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё С‚РµРєСѓС‰РµРіРѕ bizId. Service client РґРѕРїСѓСЃС‚РёРј Р±РµР· `withManagerContext`; РґРѕСЃС‚СѓРї Рє cron РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ Р·Р°С‰РёС‰С‘РЅ (cron secret / Vercel cron).

---

### 2.5. РџСЂРѕС‡РёРµ API

| Р¤Р°Р№Р» | РљРѕРЅС‚РµРєСЃС‚ | Р¤РёР»СЊС‚СЂР°С†РёСЏ |
|------|----------|------------|
| `api/users/search/route.tsx` | getBizContextForManagers в†’ bizId | `.eq('biz_id', bizId)` (staff) |
| `api/funnel-events/route.ts` | РџСѓР±Р»РёС‡РЅС‹Р№: biz_id РёР· С‚РµР»Р° Р·Р°РїСЂРѕСЃР° (РІР°Р»РёРґР°С†РёСЏ zod) | Р—Р°РїРёСЃСЊ Р°РЅР°Р»РёС‚РёРєРё; biz_id РїСЂРёС…РѕРґРёС‚ РѕС‚ РєР»РёРµРЅС‚Р° (СЃС‚СЂР°РЅРёС†Р° Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ), РїСЂРѕРІРµСЂРєР° РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё Рє РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ РЅРµ С‚СЂРµР±СѓРµС‚СЃСЏ. |
| `api/metrics/frontend/route.ts` | РќРµС‚ РєРѕРЅС‚РµРєСЃС‚Р° Р±РёР·РЅРµСЃР° | RPC `log_frontend_metric`: СЃРёСЃС‚РµРјРЅС‹Рµ РјРµС‚СЂРёРєРё (Core Web Vitals, page load); РЅРµ РїСЂРёРІСЏР·Р°РЅС‹ Рє biz_id. |
| `api/webhooks/whatsapp/route.ts` | bizId РёР· Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№/РїСЂРѕС„РёР»СЏ (РЅРµ РёР· СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ) | Р Р°Р±РѕС‚Р° СЃ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏРјРё РїРѕ РёС… biz_id; РЅРµ РєРѕРЅС‚РµРєСЃС‚ РјРµРЅРµРґР¶РµСЂР°. |

---

### 2.6. Р‘РёР±Р»РёРѕС‚РµРєРё (lib)

| Р¤Р°Р№Р» | РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ | Р¤РёР»СЊС‚СЂР°С†РёСЏ |
|------|----------------|------------|
| `lib/authCheck.ts` | checkResourceBelongsToBusiness, checkBranchesBelongToBusiness | Р’СЃРµ С„СѓРЅРєС†РёРё РїСЂРёРЅРёРјР°СЋС‚ `bizId` Рё РёСЃРїРѕР»СЊР·СѓСЋС‚ РµРіРѕ РІ Р·Р°РїСЂРѕСЃР°С… (.eq('biz_id', bizId) РёР»Рё СЃСЂР°РІРЅРµРЅРёРµ СЃ РїРѕР»РµРј СЂРµСЃСѓСЂСЃР°). |
| `lib/staffRoleSync.ts` | createSupabaseAdminClient: СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЂРѕР»РµР№ staff | Р Р°Р±РѕС‚Р° РїРѕ user_id Рё biz_id РёР· РєРѕРЅС‚РµРєСЃС‚Р° (resolveStaffContext). |
| `lib/bizContextResolver.ts` | createSupabaseAdminClient: СЂР°Р·СЂРµС€РµРЅРёРµ С‚РµРєСѓС‰РµРіРѕ Р±РёР·РЅРµСЃР° | Р§С‚РµРЅРёРµ user_current_business, businesses, user_roles; РЅРµ С„РёР»СЊС‚СЂСѓРµС‚ РїРѕ В«С‡СѓР¶РёРјВ» Р±РёР·РЅРµСЃР°Рј вЂ” РѕРїСЂРµРґРµР»СЏРµС‚ СЃРІРѕР№ РєРѕРЅС‚РµРєСЃС‚. |
| `lib/staffSchedule.ts` | getServiceClient РІ С‚РёРїР°С…/РїР°СЂР°РјРµС‚СЂР°С… | РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ РєРѕРЅС‚РµРєСЃС‚Рµ, РіРґРµ СѓР¶Рµ РµСЃС‚СЊ bizId. |
| `lib/apiMetrics.ts` | getServiceClient РґР»СЏ Р·Р°РїРёСЃРё РјРµС‚СЂРёРє | РЎРёСЃС‚РµРјРЅР°СЏ Р·Р°РїРёСЃСЊ; РЅРµ РїСЂРёРІСЏР·Р°РЅР° Рє РѕРґРЅРѕРјСѓ Р±РёР·РЅРµСЃСѓ. |

**Р’С‹РІРѕРґ:** authCheck вЂ” Р±РµР·РѕРїР°СЃРµРЅ (bizId РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Р№ Р°СЂРіСѓРјРµРЅС‚). staffRoleSync Рё bizContextResolver вЂ” РєРѕРЅС‚РµРєСЃС‚ РѕРїСЂРµРґРµР»СЏСЋС‚ СЃР°РјРё, РЅРµ В«РїСЂРѕРёР·РІРѕР»СЊРЅС‹Р№ РґРѕСЃС‚СѓРї Рє Р»СЋР±РѕРјСѓ bizВ». apiMetrics вЂ” СЃРёСЃС‚РµРјРЅС‹Р№ СЃР»РѕР№.

---

### 2.7. РЎС‚СЂР°РЅРёС†С‹ Рё РєРѕРјРїРѕРЅРµРЅС‚С‹ (Server/Client)

| Р¤Р°Р№Р» | РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ | Р¤РёР»СЊС‚СЂР°С†РёСЏ |
|------|----------------|------------|
| `app/dashboard/staff/[id]/page.tsx` | getBizContextForManagers в†’ bizId; getServiceClient РґР»СЏ bookings | РџСЂРѕРІРµСЂРєР° `staff.biz_id === bizId`; Р·Р°РїСЂРѕСЃ bookings СЃ `.eq('biz_id', bizId).eq('staff_id', id)`. |
| `app/dashboard/services/[id]/page.tsx` | getBizContextForManagers в†’ bizId; getServiceClient РґР»СЏ services/branches | Р—Р°РїСЂРѕСЃ СѓСЃР»СѓРіРё СЃ `.eq('id', id).eq('biz_id', bizId)`; РїСЂРѕРІРµСЂРєР° `svc.biz_id === bizId`; branches СЃ `.eq('biz_id', bizId)`. |

---

### 2.8. РџРѕР»РЅС‹Р№ РїРµСЂРµС‡РµРЅСЊ РІС‹Р·РѕРІРѕРІ getServiceClient / createSupabaseAdminClient РїРѕ РґРѕРјРµРЅР°Рј

РќРёР¶Рµ вЂ” РІСЃРµ РјРµСЃС‚Р° РІ РєРѕРґРµ (Р±РµР· С‚РµСЃС‚РѕРІ), РіРґРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ **getServiceClient()** (`@/lib/supabaseService`) РёР»Рё **createSupabaseAdminClient()** (`@/lib/supabaseHelpers`), СЃРіСЂСѓРїРїРёСЂРѕРІР°РЅРЅС‹Рµ РїРѕ РґРѕРјРµРЅСѓ.

| Р”РѕРјРµРЅ | Р¤Р°Р№Р» | Р¤СѓРЅРєС†РёСЏ (РёСЃС‚РѕС‡РЅРёРє РєР»РёРµРЅС‚Р°) |
|-------|------|----------------------------|
| **РђРЅР°Р»РёС‚РёРєР° (admin)** | `app/admin/api/system-analytics/overview/route.ts` | getServiceClient |
| | `app/admin/api/analytics/overview/route.ts` | getServiceClient |
| | `app/admin/api/analytics/track/route.ts` | getServiceClient |
| | `app/admin/api/analytics/promotions/route.ts` | getServiceClient |
| | `app/admin/api/analytics/load/route.ts` | getServiceClient |
| | `app/admin/api/analytics/conversion-funnel/route.ts` | getServiceClient |
| | `app/admin/api/funnel-analytics/route.ts` | getServiceClient |
| **РђРЅР°Р»РёС‚РёРєР° (cron)** | `app/api/cron/analytics/hourly-load/route.ts` | getServiceClient |
| | `app/api/cron/analytics/daily/route.ts` | getServiceClient |
| **Р¤РёРЅР°РЅСЃС‹ / Р»РѕРіРё** | `app/admin/api/finance-logs/route.ts` | getServiceClient |
| **Р РµР№С‚РёРЅРіРё** | `app/api/admin/ratings/debug-entities/route.ts` | getServiceClient |
| | `app/api/admin/initialize-ratings/route.ts` | getServiceClient |
| | `app/api/admin/ratings/status/route.ts` | getServiceClient |
| **РЎРёСЃС‚РµРјР° / Р·РґРѕСЂРѕРІСЊРµ** | `app/api/admin/health-check/route.ts` | getServiceClient |
| | `app/admin/api/system-health/route.ts` | getServiceClient |
| **РџСЂРѕРјРѕ / РѕС‚Р»Р°РґРєР°** | `app/api/admin/promotions/debug/route.ts` | getServiceClient |
| **РњРµС‚СЂРёРєРё** | `app/api/admin/performance/stats/route.ts` | getServiceClient |
| | `app/admin/api/metrics/route.ts` | getServiceClient |
| | `app/admin/api/metrics/stats/route.ts` | getServiceClient |
| | `app/api/metrics/frontend/route.ts` | getServiceClient |
| **Cron (РїСЂРѕС‡РёРµ)** | `app/api/cron/recalculate-ratings/route.ts` | getServiceClient |
| | `app/api/cron/data-retention/route.ts` | getServiceClient |
| | `app/api/cron/health-check-alerts/route.ts` | getServiceClient (dynamic import) |
| | `app/api/cron/close-shifts/route.ts` | getServiceClient |
| **Staff** | `app/api/staff/[id]/update/route.ts` | getServiceClient |
| | `app/api/staff/update/route.ts` | getServiceClient |
| | `app/api/staff/sync-roles/route.ts` | getServiceClient |
| | `app/api/staff/shift/close/route.ts` | getServiceClient |
| | `app/api/staff/shift/items/route.ts` | getServiceClient |
| | `app/api/staff/create/route.ts` | getServiceClient |
| | `app/api/staff/create-from-user/route.ts` | getServiceClient |
| | `app/api/staff/avatar/upload/route.ts` | getServiceClient |
| | `app/api/staff/avatar/remove/route.ts` | getServiceClient |
| | `app/api/staff/[id]/transfer/route.ts` | getServiceClient |
| | `app/api/staff/[id]/restore/route.ts` | getServiceClient + createSupabaseAdminClient |
| | `app/api/staff/[id]/dismiss/route.ts` | getServiceClient + createSupabaseAdminClient |
| | `app/api/staff/[id]/delete/route.ts` | getServiceClient |
| **Branches** | `app/api/branches/create/route.ts` | getServiceClient |
| | `app/api/branches/[id]/update/route.ts` | getServiceClient |
| | `app/api/branches/[id]/schedule/route.ts` | getServiceClient |
| | `app/api/branches/[id]/delete/route.ts` | getServiceClient |
| **Services** | `app/api/services/create/route.ts` | getServiceClient |
| | `app/api/services/[id]/update/route.ts` | getServiceClient |
| | `app/api/services/[id]/delete/route.ts` | getServiceClient |
| **Bookings** | `app/api/bookings/[id]/mark-attendance/route.ts` | getServiceClient |
| **Users** | `app/api/users/search/route.tsx` | getServiceClient |
| **Р’РѕСЂРѕРЅРєР° / СЃРѕР±С‹С‚РёСЏ** | `app/api/funnel-events/route.ts` | getServiceClient |
| **Webhooks** | `app/api/webhooks/whatsapp/route.ts` | getServiceClient (РЅРµСЃРєРѕР»СЊРєРѕ РІС‹Р·РѕРІРѕРІ) |
| **Auth (WhatsApp)** | `app/api/auth/whatsapp/verify-otp/route.ts` | createSupabaseAdminClient |
| | `app/api/auth/whatsapp/send-otp/route.ts` | createSupabaseAdminClient |
| | `app/api/auth/whatsapp/create-session/route.ts` | createSupabaseAdminClient |
| **Dashboard (RSC)** | `app/dashboard/staff/[id]/page.tsx` | getServiceClient |
| | `app/dashboard/services/[id]/page.tsx` | getServiceClient |
| **РЎРµСЂРІРёСЃ РґР°РЅРЅС‹С… (РєР»РёРµРЅС‚)** | `app/staff/finance/services/shiftDataService.ts` | getServiceClient (dynamic import) |
| **Lib (РєРѕРЅС‚РµРєСЃС‚ / РїСЂРѕРІРµСЂРєРё)** | `lib/bizContextResolver.ts` | createSupabaseAdminClient |
| | `lib/withManagerContext.ts` | createSupabaseAdminClient (РІРЅСѓС‚СЂРё РѕР±С‘СЂС‚РєРё) |
| | `lib/staffRoleSync.ts` | createSupabaseAdminClient |
| | `lib/authCheck.ts` | getServiceClient |
| | `lib/staffSchedule.ts` | getServiceClient (С‚РёРї/РїР°СЂР°РјРµС‚СЂ) |
| | `lib/apiMetrics.ts` | getServiceClient |

**РС‚РѕРіРѕ:** getServiceClient вЂ” РІ РјР°СЂС€СЂСѓС‚Р°С… admin, cron, staff, branches, services, bookings, users, funnel, webhooks, РІ СЃС‚СЂР°РЅРёС†Р°С… dashboard Рё РІ lib (authCheck, staffSchedule, apiMetrics). createSupabaseAdminClient вЂ” РІ lib (bizContextResolver, withManagerContext, staffRoleSync), РІ staff/[id]/restore Рё dismiss, РІ auth/whatsapp. Р”Р°С€Р±РѕСЂРґРЅС‹Рµ РјР°СЂС€СЂСѓС‚С‹ `/api/dashboard/*` РїРµСЂРµРІРµРґРµРЅС‹ РЅР° `withManagerContext` Рё РїРѕР»СѓС‡Р°СЋС‚ admin С‡РµСЂРµР· РѕР±С‘СЂС‚РєСѓ (СЃРј. Рї. 4.3).

---

### 2.9. РџСЂРѕРІРµСЂРєР° С„РёР»СЊС‚СЂРѕРІ РїРѕ biz_id Рё С„РёР»РёР°Р»Р°Рј

Р”Р»СЏ РІСЃРµС… РјР°СЂС€СЂСѓС‚РѕРІ СЃ РєРѕРЅС‚РµРєСЃС‚РѕРј В«РѕРґРёРЅ Р±РёР·РЅРµСЃВ» (getBizContextForManagers / withManagerContext / getStaffContext) РїСЂРѕРІРµСЂРµРЅРѕ РЅР°Р»РёС‡РёРµ С„РёР»СЊС‚СЂР°С†РёРё.

| РћР±Р»Р°СЃС‚СЊ | РЎС‚Р°С‚СѓСЃ | РџСЂРёРјРµС‡Р°РЅРёРµ |
|---------|--------|------------|
| **Dashboard** (analytics, branches/list, staff/*, staff-shifts, promotions, integrations-status) | вњ… | Р—Р°РїСЂРѕСЃС‹ Рє С‚Р°Р±Р»РёС†Р°Рј СЃ РґР°РЅРЅС‹РјРё Р±РёР·РЅРµСЃР° вЂ” `.eq('biz_id', bizId)`; РІР»РѕР¶РµРЅРЅС‹Рµ СЃСѓС‰РЅРѕСЃС‚Рё (staff, shift, branch) вЂ” РїСЂРѕРІРµСЂРєР° С‡РµСЂРµР· `checkResourceBelongsToBiz` РёР»Рё СЃСЂР°РІРЅРµРЅРёРµ `branch.biz_id === bizId`. integrations-status РЅРµ РѕР±СЂР°С‰Р°РµС‚СЃСЏ Рє Р‘Р”. |
| **Dashboard RSC** (staff/[id]/page, services/[id]/page) | вњ… | staff: РїСЂРѕРІРµСЂРєР° staff.biz_id === bizId, Р·Р°РїСЂРѕСЃ bookings СЃ `.eq('biz_id', bizId)`. services: Р·Р°РїСЂРѕСЃ СѓСЃР»СѓРіРё СЃ `.eq('biz_id', bizId)`, РїСЂРѕРІРµСЂРєР° svc.biz_id. |
| **Staff** (create, update, [id]/update, transfer, restore, dismiss, delete, shift/close, shift/items, shift/today, sync-roles, create-from-user) | вњ… | Р’РµР·РґРµ Р»РёР±Рѕ `checkResourceBelongsToBiz(staff/branch)` + РїРѕСЃР»РµРґСѓСЋС‰РёРµ Р·Р°РїСЂРѕСЃС‹ СЃ `.eq('biz_id', bizId)`, Р»РёР±Рѕ РІС‹Р±РѕСЂРєРё/РІСЃС‚Р°РІРєРё СЃ `.eq('biz_id', bizId)`. |
| **Staff avatar** (upload, remove) | вњ… | Р”РѕР±Р°РІР»РµРЅС‹ `.eq('biz_id', bizId)` РІ select Рё update (bizId РёР· getStaffContext). |
| **Branches** (create, [id]/update, [id]/delete, [id]/schedule) | вњ… | create вЂ” insert СЃ `biz_id: bizId`; РѕСЃС‚Р°Р»СЊРЅС‹Рµ вЂ” `checkResourceBelongsToBiz(branch)` Рё РІСЃРµ Р·Р°РїСЂРѕСЃС‹ (РІ С‚.С‡. branch_working_hours, services Рё С‚.Рґ.) СЃ `.eq('biz_id', bizId)`. |
| **Services** (create, [id]/update, [id]/delete) | вњ… | РџСЂРѕРІРµСЂРєР° РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё СѓСЃР»СѓРіРё/С„РёР»РёР°Р»Р° Рё Р·Р°РїСЂРѕСЃС‹ СЃ `.eq('biz_id', bizId)`. |
| **Bookings** [id]/mark-attendance | вњ… | РљРѕРЅС‚РµРєСЃС‚ bizId РїРµСЂРµРґР°С‘С‚СЃСЏ РІ use case; РїСЂРѕРІРµСЂРєР° РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё Р±СЂРѕРЅРё Рє Р±РёР·РЅРµСЃСѓ РІ РґРѕРјРµРЅРЅРѕР№ Р»РѕРіРёРєРµ (BOOKING_NOT_IN_BIZ). |
| **Users search** | вњ… | Р’С‹Р±РѕСЂРєР° staff СЃ `.eq('biz_id', bizId)`. |
| **Admin / cron / webhooks** | вЂ” | РСЃРєР»СЋС‡РµРЅРёСЏ: СЃРёСЃС‚РµРјРЅС‹Рµ РѕРїРµСЂР°С†РёРё РёР»Рё СЂР°Р±РѕС‚Р° РїРѕ РјРЅРѕР¶РµСЃС‚РІСѓ Р±РёР·РЅРµСЃРѕРІ; С„РёР»СЊС‚СЂ РїРѕ РѕРґРЅРѕРјСѓ biz_id РЅРµ С‚СЂРµР±СѓРµС‚СЃСЏ. |

**РџСЂР°РІРёР»Рѕ РїСЂРё СЂР°Р±РѕС‚Рµ СЃ С„РёР»РёР°Р»Р°РјРё:** РїРµСЂРµРґ РёР·РјРµРЅРµРЅРёРµРј/С‡С‚РµРЅРёРµРј РґР°РЅРЅС‹С… С„РёР»РёР°Р»Р° РїСЂРѕРІРµСЂСЏС‚СЊ `branch.biz_id === bizId` (РёР»Рё С‡РµСЂРµР· `checkResourceBelongsToBiz(branch)`); РІ Р·Р°РїСЂРѕСЃР°С… Рє СЃРІСЏР·Р°РЅРЅС‹Рј С‚Р°Р±Р»РёС†Р°Рј (РЅР°РїСЂРёРјРµСЂ, branch_working_hours, promotions) РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ `.eq('biz_id', bizId)`.

---

## 3. РўСЂРµР±РѕРІР°РЅРёСЏ Рє Р±РµР·РѕРїР°СЃРЅРѕРјСѓ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЋ

### 3.1. Р’ РјР°СЂС€СЂСѓС‚Р°С… `/api/dashboard/*` Рё РІ API, РїСЂРёРІСЏР·Р°РЅРЅС‹С… Рє В«РєР°Р±РёРЅРµС‚Сѓ Р±РёР·РЅРµСЃР°В»

1. **Р’СЃРµРіРґР° РїРѕР»СѓС‡Р°С‚СЊ РєРѕРЅС‚РµРєСЃС‚ РґРѕСЃС‚СѓРїР° Рє Р±РёР·РЅРµСЃСѓ** С‡РµСЂРµР· `getBizContextForManagers()` (РёР»Рё РІ Р±СѓРґСѓС‰РµРј С‡РµСЂРµР· `withManagerContext`). РќРµ Р±СЂР°С‚СЊ `bizId` С‚РѕР»СЊРєРѕ РёР· С‚РµР»Р° Р·Р°РїСЂРѕСЃР° РёР»Рё query Р±РµР· РїСЂРѕРІРµСЂРєРё РїСЂР°РІ.
2. **Р’СЃРµ Р·Р°РїСЂРѕСЃС‹ Рє РґР°РЅРЅС‹Рј Р±РёР·РЅРµСЃР° С‡РµСЂРµР· service client** РґРѕР»Р¶РЅС‹ СЃРѕРґРµСЂР¶Р°С‚СЊ РѕРіСЂР°РЅРёС‡РµРЅРёРµ РїРѕ Р±РёР·РЅРµСЃСѓ:
   - Р»РёР±Рѕ `.eq('biz_id', bizId)` РґР»СЏ С‚Р°Р±Р»РёС† СЃ РїРѕР»РµРј `biz_id`;
   - Р»РёР±Рѕ РїСЂРѕРІРµСЂРєР° РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё СЃРІСЏР·Р°РЅРЅРѕР№ СЃСѓС‰РЅРѕСЃС‚Рё (РЅР°РїСЂРёРјРµСЂ, branch.biz_id, staff.biz_id) С‡РµСЂРµР· `checkResourceBelongsToBiz` / `checkResourceBelongsToBusiness` РїРµСЂРµРґ РёР·РјРµРЅРµРЅРёРµРј/С‡С‚РµРЅРёРµРј.
3. **РџСЂРё РІСЃС‚Р°РІРєРµ СЃС‚СЂРѕРє** РІ С‚Р°Р±Р»РёС†С‹ СЃ `biz_id` РІСЃРµРіРґР° РїРѕРґСЃС‚Р°РІР»СЏС‚СЊ РїСЂРѕРІРµСЂРµРЅРЅС‹Р№ `bizId` РёР· РєРѕРЅС‚РµРєСЃС‚Р°, Р° РЅРµ РёР· Р·Р°РїСЂРѕСЃР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
4. **Р”Р»СЏ РІР»РѕР¶РµРЅРЅС‹С… СЃСѓС‰РЅРѕСЃС‚РµР№** (РЅР°РїСЂРёРјРµСЂ, С„РёР»РёР°Р», СЃРѕС‚СЂСѓРґРЅРёРє, СѓСЃР»СѓРіР°): СЃРЅР°С‡Р°Р»Р° РїСЂРѕРІРµСЂРёС‚СЊ, С‡С‚Рѕ СЂРѕРґРёС‚РµР»СЊ РїСЂРёРЅР°РґР»РµР¶РёС‚ С‚РµРєСѓС‰РµРјСѓ Р±РёР·РЅРµСЃСѓ, Р·Р°С‚РµРј РІС‹РїРѕР»РЅСЏС‚СЊ РѕРїРµСЂР°С†РёРё.

### 3.2. Р’ РјР°СЂС€СЂСѓС‚Р°С… `/api/admin/*` Рё `/api/cron/*`

- РџСЂРѕРІРµСЂРєР° РґРѕСЃС‚СѓРїР°: `is_super_admin` РёР»Рё Р·Р°С‰РёС‚Р° cron (secret, IP).
- Р”РѕРїСѓСЃС‚РёРјРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ service client Р±РµР· РєРѕРЅС‚РµРєСЃС‚Р° В«РѕРґРёРЅ Р±РёР·РЅРµСЃВ», С‚Р°Рє РєР°Рє РѕРїРµСЂР°С†РёРё СЃРёСЃС‚РµРјРЅС‹Рµ РёР»Рё РїРѕ РјРЅРѕР¶РµСЃС‚РІСѓ Р±РёР·РЅРµСЃРѕРІ. РЇРІРЅРѕ РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°С‚СЊ РІ РєРѕРґРµ/guide.

### 3.3. РђРЅС‚Рё-РїР°С‚С‚РµСЂРЅС‹

- РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ service client РІ РјР°СЂС€СЂСѓС‚Рµ РґР°С€Р±РѕСЂРґР°/РјРµРЅРµРґР¶РµСЂР° Р±РµР· РІС‹Р·РѕРІР° `getBizContextForManagers()` (РёР»Рё Р±РµР· `withManagerContext`).
- Р§С‚РµРЅРёРµ/Р·Р°РїРёСЃСЊ С‚Р°Р±Р»РёС† СЃ `biz_id` Р±РµР· СѓСЃР»РѕРІРёСЏ РїРѕ `biz_id` РёР»Рё Р±РµР· РїСЂРµРґРІР°СЂРёС‚РµР»СЊРЅРѕР№ РїСЂРѕРІРµСЂРєРё РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё СЂРµСЃСѓСЂСЃР°.
- РџРѕРґСЃС‚Р°РЅРѕРІРєР° `biz_id` РёР· query/body Р±РµР· РїСЂРѕРІРµСЂРєРё РїСЂР°РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РЅР° СЌС‚РѕС‚ Р±РёР·РЅРµСЃ.

---

## 4. РџР»Р°РЅ РјРёРіСЂР°С†РёРё РЅР° `withManagerContext` (Р±Р»РѕРє 5.2)

### 4.1. РћР±С‘СЂС‚РєР° `withManagerContext` (СЂРµР°Р»РёР·РѕРІР°РЅРѕ)

- **РњРѕРґСѓР»СЊ:** `@/lib/withManagerContext.ts`.
- **РўРёРї РєРѕРЅС‚РµРєСЃС‚Р°:** `ManagerContext = { supabase, admin, bizId, userId }` вЂ” server client (cookies, RLS), admin client (Р±РµР· RLS), С‚РµРєСѓС‰РёР№ Р±РёР·РЅРµСЃ, ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
- **РЎРёРіРЅР°С‚СѓСЂР°:** `withManagerContext(req: NextRequest, scope: string, handler: (ctx: ManagerContext) => Promise<NextResponse>): Promise<NextResponse>`.
- **РџРѕРІРµРґРµРЅРёРµ:** РІС‹Р·РѕРІ `getBizContextForManagers()`; РїСЂРё СѓСЃРїРµС…Рµ вЂ” СЃРѕР·РґР°РЅРёРµ `admin` С‡РµСЂРµР· `createSupabaseAdminClient()`, РІС‹Р·РѕРІ `handler(ctx)`; РїСЂРё `BizAccessError`: `NOT_AUTHENTICATED` в†’ 401, РёРЅР°С‡Рµ (РІ С‚.С‡. `NO_BIZ_ACCESS`) в†’ 403.
- **Р¤РѕСЂРјР°С‚ РѕС€РёР±РѕРє:** `createErrorResponse('auth', 'РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ', undefined, 401)` Рё `createErrorResponse('forbidden', 'РќРµС‚ РґРѕСЃС‚СѓРїР° Рє РєР°Р±РёРЅРµС‚Сѓ СѓРїСЂР°РІР»РµРЅРёСЏ', undefined, 403)`.
- **РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ:** РІ route РѕР±РµСЂРЅСѓС‚СЊ Р»РѕРіРёРєСѓ РІ `withManagerContext(req, 'ScopeName', async (ctx) => { ... })`; РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё РїРѕРІРµСЂС… вЂ” `withErrorHandler('ScopeName', () => withManagerContext(req, 'ScopeName', async (ctx) => { ... }))`.

### 4.2. Р РµР°Р»РёР·РѕРІР°С‚СЊ Рё РїРѕРєСЂС‹С‚СЊ С‚РµСЃС‚Р°РјРё (СЃРґРµР»Р°РЅРѕ)

- РЈСЃРїРµС€РЅС‹Р№ РґРѕСЃС‚СѓРї (РµСЃС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ Рё Р±РёР·РЅРµСЃ) вЂ” `withManagerContext.test.ts`.
- 401 РїСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё Р°РІС‚РѕСЂРёР·Р°С†РёРё (NOT_AUTHENTICATED).
- 403 РїСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё РґРѕСЃС‚СѓРїР° Рє Р±РёР·РЅРµСЃСѓ (NO_BIZ_ACCESS).
- РџСЂРѕР±СЂРѕСЃ РЅРµ-BizAccessError (rethrows).
- Р‘Р°Р·РѕРІС‹Р№ С‚РµСЃС‚: handler РїРѕР»СѓС‡Р°РµС‚ РєРѕСЂСЂРµРєС‚РЅС‹Р№ bizId Рё РЅРµ РІРёРґРёС‚ С‡СѓР¶РёРµ РґР°РЅРЅС‹Рµ вЂ” РѕР±РµСЃРїРµС‡РёРІР°РµС‚СЃСЏ С‚РµРј, С‡С‚Рѕ РєРѕРЅС‚РµРєСЃС‚ РІС‹РґР°С‘С‚СЃСЏ С‚РѕР»СЊРєРѕ С‡РµСЂРµР· getBizContextForManagers; РІ handler РїРµСЂРµРґР°РЅ РѕРґРёРЅ СЂР°Р· РїРѕР»СѓС‡РµРЅРЅС‹Р№ admin СЃ С‚РµРј Р¶Рµ bizId.

### 4.3. РџРѕСЌС‚Р°РїРЅРѕ РїРµСЂРµРІРѕРґРёС‚СЊ РјР°СЂС€СЂСѓС‚С‹

**РџСЂРёРѕСЂРёС‚РµС‚ 1 (РґР°С€Р±РѕСЂРґ, Р°РЅР°Р»РёС‚РёРєР° Рё С„РёРЅР°РЅСЃС‹):**

- ~~`api/dashboard/analytics/overview`~~, ~~`api/dashboard/analytics/load`~~ вЂ” РїРµСЂРµРІРµРґРµРЅС‹
- ~~`api/dashboard/staff/[id]/finance/*`~~ (route, stats, audit-log), ~~`api/dashboard/staff/finance/all`~~ вЂ” РїРµСЂРµРІРµРґРµРЅС‹
- ~~`api/dashboard/staff/[id]/shift/open`~~ вЂ” РїРµСЂРµРІРµРґС‘РЅ
- ~~`api/dashboard/staff-shifts/[id]/update-hours`~~ вЂ” РїРµСЂРµРІРµРґС‘РЅ
- ~~`api/dashboard/branches/list`~~, ~~`api/dashboard/branches/[branchId]/promotions`~~ (GET/POST), ~~`api/dashboard/branches/[branchId]/promotions/[promotionId]`~~ (PATCH/DELETE) вЂ” РїРµСЂРµРІРµРґРµРЅС‹
- ~~`api/dashboard/integrations-status`~~ вЂ” РїРµСЂРµРІРµРґС‘РЅ

**РџСЂРёРѕСЂРёС‚РµС‚ 2 (staff, branches, services, bookings):**

- `api/staff/*` (create, update, [id]/update, [id]/delete, [id]/transfer, [id]/restore, [id]/dismiss, shift/close, shift/items, avatar, sync-roles, create-from-user)
- `api/branches/create`, `[id]/update`, `[id]/delete`, `[id]/schedule`
- `api/services/create`, `[id]/update`, `[id]/delete`
- `api/bookings/[id]/mark-attendance`

**РџСЂРёРѕСЂРёС‚РµС‚ 3:**

- `api/users/search`
- РћСЃС‚Р°Р»СЊРЅС‹Рµ dashboard-РјР°СЂС€СЂСѓС‚С‹, РµСЃР»Рё РїРѕСЏРІСЏС‚СЃСЏ.

РџРѕСЃР»Рµ РїРµСЂРµРІРѕРґР° РІ handler РЅРµ РІС‹Р·С‹РІР°С‚СЊ `getBizContextForManagers()` Рё РЅРµ СЃРѕР·РґР°РІР°С‚СЊ service client РІСЂСѓС‡РЅСѓСЋ вЂ” С‚РѕР»СЊРєРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РїРµСЂРµРґР°РЅРЅС‹Рµ РёР· РѕР±С‘СЂС‚РєРё `bizId`, `supabase`, `serviceClient`.

### 4.4. РСЃРєР»СЋС‡РµРЅРёСЏ (РЅРµ РїРµСЂРµРІРѕРґРёС‚СЊ РЅР° withManagerContext)

- Р’СЃРµ `/api/admin/*`: РѕСЃС‚Р°РІРёС‚СЊ РїСЂРѕРІРµСЂРєСѓ `is_super_admin` Рё РїСЂСЏРјРѕРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ getServiceClient.
- Р’СЃРµ `/api/cron/*`: Р±РµР· РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРіРѕ РєРѕРЅС‚РµРєСЃС‚Р°.
- `api/webhooks/whatsapp`: РєРѕРЅС‚РµРєСЃС‚ РїРѕ РґР°РЅРЅС‹Рј Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№, РЅРµ РїРѕ СЃРµСЃСЃРёРё РјРµРЅРµРґР¶РµСЂР°.
- `lib/authCheck.ts`: РїСЂРёРЅРёРјР°РµС‚ bizId СЃРЅР°СЂСѓР¶Рё; РІС‹Р·С‹РІР°СЋС‰РёР№ РєРѕРґ СѓР¶Рµ РґРѕР»Р¶РµРЅ РїРѕР»СѓС‡Р°С‚СЊ РєРѕРЅС‚РµРєСЃС‚ С‡РµСЂРµР· withManagerContext РёР»Рё getBizContextForManagers.
- `lib/bizContextResolver.ts`, `lib/staffRoleSync.ts`: РѕРїСЂРµРґРµР»СЏСЋС‚ РєРѕРЅС‚РµРєСЃС‚; РЅРµ В«handlersВ» Р·Р°РїСЂРѕСЃРѕРІ.

### 4.5. Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ

- Р’ `docs/` РёР»Рё РІ README РѕРїРёСЃР°С‚СЊ: РІ `/api/dashboard/*` Рё РІ API РєР°Р±РёРЅРµС‚Р° РјРµРЅРµРґР¶РµСЂР° service client РґРѕР»Р¶РµРЅ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ С‚РѕР»СЊРєРѕ С‡РµСЂРµР· `withManagerContext` (РёР»Рё С‡РµСЂРµР· СЏРІРЅРѕ СЂР°Р·СЂРµС€С‘РЅРЅС‹Рµ РёСЃРєР»СЋС‡РµРЅРёСЏ СЃ РѕР±РѕСЃРЅРѕРІР°РЅРёРµРј РІ РєРѕРґРµ).
- Р”РѕР±Р°РІРёС‚СЊ СЂР°Р·РґРµР» В«Р‘РµР·РѕРїР°СЃРЅРѕРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ service clientВ»: РєРѕРіРґР° РјРѕР¶РЅРѕ Р±РµР· РѕР±С‘СЂС‚РєРё (admin, cron, РѕРїСЂРµРґРµР»РµРЅРёРµ РєРѕРЅС‚РµРєСЃС‚Р° РІ lib), РєРѕРіРґР° РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ СЃ РєРѕРЅС‚РµРєСЃС‚РѕРј Рё С„РёР»СЊС‚СЂРѕРј РїРѕ biz_id.

---

## 5. РЎСЃС‹Р»РєРё

- Р—Р°РґР°С‡Рё: `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md` (Р±Р»РѕРє 4 вЂ” Р·Р°РґР°С‡Р° В«Service client Р±РµР· RLSВ»; Р±Р»РѕРєРё 5.2, 5.7).
- РўРµРєСѓС‰Р°СЏ РѕР±С‘СЂС‚РєР°/РїСЂРѕРІРµСЂРєРё: `getBizContextForManagers` РІ `@/lib/authBiz`, `checkResourceBelongsToBiz` РІ `@/lib/dbHelpers`, `checkResourceBelongsToBusiness` РІ `@/lib/authCheck`.
- Service client: `@/lib/supabaseService.ts` (getServiceClient), `@/lib/supabaseHelpers.ts` (createSupabaseAdminClient).

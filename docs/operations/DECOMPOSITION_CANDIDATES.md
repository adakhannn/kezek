# РђСѓРґРёС‚ С„Р°Р№Р»РѕРІ-РєР°РЅРґРёРґР°С‚РѕРІ РЅР° РґРµРєРѕРјРїРѕР·РёС†РёСЋ

**Р”Р°С‚Р°:** 2026-03-18  
**Р¦РµР»СЊ:** Р·Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ РєСЂСѓРїРЅС‹Рµ С„Р°Р№Р»С‹, РєРѕС‚РѕСЂС‹Рµ СЃС‚РѕРёС‚ РґРµРєРѕРјРїРѕР·РёСЂРѕРІР°С‚СЊ РЅРµ С‚РѕР»СЊРєРѕ РёР·-Р·Р° СЂР°Р·РјРµСЂР°, РЅРѕ Рё РёР·-Р·Р° СЃРјРµС€РµРЅРёСЏ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё.

Р­С‚РѕС‚ СЃРїРёСЃРѕРє РЅСѓР¶РµРЅ РєР°Рє СЂР°Р±РѕС‡Р°СЏ РѕС‡РµСЂРµРґСЊ РґР»СЏ СЃР»РµРґСѓСЋС‰РёС… СЂРµС„Р°РєС‚РѕСЂРёРЅРіРѕРІ. Р Р°Р·РјРµСЂ С„Р°Р№Р»Р° Р·РґРµСЃСЊ РІР°Р¶РµРЅ, РЅРѕ РЅРµ СЃР°Рј РїРѕ СЃРµР±Рµ: РїСЂРёРѕСЂРёС‚РµС‚ РїРѕР»СѓС‡Р°СЋС‚ РјРµСЃС‚Р°, РіРґРµ РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕ СЃРјРµС€Р°РЅС‹ UI, РІС‹С‡РёСЃР»РµРЅРёСЏ, side effects, СЃРµС‚РµРІРѕР№ СЃР»РѕР№ Рё orchestration.

---

## РљР°Рє С‡РёС‚Р°С‚СЊ СЌС‚РѕС‚ СЃРїРёСЃРѕРє

- `Р’С‹СЃРѕРєРёР№ РїСЂРёРѕСЂРёС‚РµС‚` вЂ” РєСЂСѓРїРЅС‹Р№ С„Р°Р№Р» СѓР¶Рµ РјРµС€Р°РµС‚ РёР·РјРµРЅРµРЅРёСЏРј Рё РїРѕРІС‹С€Р°РµС‚ СЂРёСЃРє СЂРµРіСЂРµСЃСЃРёР№.
- `РЎСЂРµРґРЅРёР№ РїСЂРёРѕСЂРёС‚РµС‚` вЂ” РґРµРєРѕРјРїРѕР·РёС†РёСЏ РґР°СЃС‚ Р·Р°РјРµС‚РЅРѕРµ СѓРїСЂРѕС‰РµРЅРёРµ, РЅРѕ РЅРµ С‚Р°Рє СЃСЂРѕС‡РЅРѕ.
- `РќРёР·РєРёР№ РїСЂРёРѕСЂРёС‚РµС‚ / РЅРµ РґРµРєРѕРјРїРѕР·РёСЂРѕРІР°С‚СЊ СЃРµР№С‡Р°СЃ` вЂ” С„Р°Р№Р» Р±РѕР»СЊС€РѕР№, РЅРѕ СЌС‚Рѕ РµС‰С‘ РЅРµ РѕР·РЅР°С‡Р°РµС‚, С‡С‚Рѕ РµРіРѕ РЅР°РґРѕ СЂРµР·Р°С‚СЊ РЅРµРјРµРґР»РµРЅРЅРѕ.

---

## Р’С‹СЃРѕРєРёР№ РїСЂРёРѕСЂРёС‚РµС‚

### 1. `apps/web/src/app/staff/finance/hooks/useShiftItems.ts`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~64 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - РІ РѕРґРЅРѕРј hook СЃРјРµС€Р°РЅС‹ Р·Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С…, РЅРѕСЂРјР°Р»РёР·Р°С†РёСЏ, РІС‹С‡РёСЃР»РµРЅРёСЏ, РјСѓС‚Р°С†РёРё Рё UI-РѕСЂРёРµРЅС‚РёСЂРѕРІР°РЅРЅС‹Рµ СЌС„С„РµРєС‚С‹;
  - СЌС‚Рѕ СѓР¶Рµ РЅРµ вЂњhookвЂќ, Р° С„Р°РєС‚РёС‡РµСЃРєРё feature-level orchestration СЃР»РѕР№;
  - Р·РѕРЅР° СЃРІСЏР·Р°РЅР° СЃ finance/shift Р»РѕРіРёРєРѕР№, РіРґРµ С†РµРЅР° СЂРµРіСЂРµСЃСЃРёРё РІС‹СЃРѕРєР°СЏ.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - РІС‹С‡РёСЃР»РµРЅРёСЏ Рё РЅРѕСЂРјР°Р»РёР·Р°С†РёСЋ РІ РѕС‚РґРµР»СЊРЅС‹Рµ finance helpers;
  - СЃРµС‚РµРІРѕР№ СЃР»РѕР№ РІ service/api client;
  - РјСѓС‚Р°С†РёРё РІ РѕС‚РґРµР»СЊРЅС‹Рµ action hooks;
  - derived state РІ РјР°Р»РµРЅСЊРєРёРµ focused hooks.

### 2. `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~61 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - СЌРєСЂР°РЅ СЃРѕРґРµСЂР¶РёС‚ СЃР»РёС€РєРѕРј РјРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ, orchestration Рё JSX РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ;
  - schedule-flow РѕР±С‹С‡РЅРѕ Р±С‹СЃС‚СЂРѕ РѕР±СЂР°СЃС‚Р°РµС‚ edge cases РїРѕ РґР°С‚Р°Рј, staff, branch Рё availability;
  - С‚СЏР¶РµР»Рѕ Р»РѕРєР°Р»СЊРЅРѕ РјРµРЅСЏС‚СЊ РїРѕРІРµРґРµРЅРёРµ Р±РµР· РїРѕРІС‚РѕСЂРЅРѕРіРѕ С‡С‚РµРЅРёСЏ РІСЃРµРіРѕ С„Р°Р№Р»Р°.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - selection/filter state;
  - date/time helpers;
  - РѕС‚РґРµР»СЊРЅС‹Рµ СЃРµРєС†РёРё UI;
  - side effects СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё Рё Р·Р°РіСЂСѓР·РєРё.

### 3. `apps/web/src/app/staff/finance/components/FinancePage.tsx`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~41 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - finance UI С‡Р°СЃС‚Рѕ РїСЂРµРІСЂР°С‰Р°РµС‚СЃСЏ РІ СЃРјРµСЃСЊ С‚Р°Р±Р»РёС†, С„РёР»СЊС‚СЂРѕРІ, totals, actions Рё conditional rendering;
  - Р·РґРµСЃСЊ РІС‹СЃРѕРє С€Р°РЅСЃ, С‡С‚Рѕ presentation Рё Р±РёР·РЅРµСЃРѕРІС‹Рµ РІС‹С‡РёСЃР»РµРЅРёСЏ РµС‰С‘ Р¶РёРІСѓС‚ РІРїРµСЂРµРјРµС€РєСѓ;
  - С„Р°Р№Р» СѓР¶Рµ РЅР°С…РѕРґРёС‚СЃСЏ РІ Р·РѕРЅРµ, РіРґРµ РЅРµРґР°РІРЅРѕ Р±С‹Р»Рё РєСЂСѓРїРЅС‹Рµ РёР·РјРµРЅРµРЅРёСЏ РІРѕРєСЂСѓРі shift items.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - С‚Р°Р±Р»РёС†С‹/РєР°СЂС‚РѕС‡РєРё СЃС‚Р°С‚РёСЃС‚РёРєРё;
  - С„РёР»СЊС‚СЂС‹ Рё selection state;
  - С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ Рё РІС‹С‡РёСЃР»РµРЅРёРµ totals/percentages;
  - РґРµР№СЃС‚РІРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РІ РѕС‚РґРµР»СЊРЅС‹Рµ handlers/hooks.

### 4. `apps/web/src/app/api/webhooks/whatsapp/route.ts`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~35 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - webhook route РѕР±С‹С‡РЅРѕ РЅРµ РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РїРѕР»РЅС‹Р№ СЃС†РµРЅР°СЂРёР№ РѕР±СЂР°Р±РѕС‚РєРё РІС…РѕРґСЏС‰РµРіРѕ СЃРѕР±С‹С‚РёСЏ;
  - РІРµСЂРѕСЏС‚РЅРѕ СЃРјРµС€Р°РЅС‹ parsing, deduplication, lookup, persistence, business decisions Рё logging;
  - СЌС‚Рѕ РёРЅС‚РµРіСЂР°С†РёРѕРЅРЅР°СЏ С‚РѕС‡РєР°, РіРґРµ Р»СѓС‡С€Рµ РёРјРµС‚СЊ thin adapter + application service.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - parsing Рё РІР°Р»РёРґР°С†РёСЋ payload;
  - use case РѕР±СЂР°Р±РѕС‚РєРё РІС…РѕРґСЏС‰РµРіРѕ СЃРѕРѕР±С‰РµРЅРёСЏ;
  - repository/integration adapters;
  - logging/metrics wrapper.

### 5. `apps/mobile/src/screens/ShiftQuickScreen.tsx`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~34 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - mobile screen С‚Р°РєРѕРіРѕ СЂР°Р·РјРµСЂР° РѕР±С‹С‡РЅРѕ СЃРѕРІРјРµС‰Р°РµС‚ РЅР°РІРёРіР°С†РёСЋ, form state, network calls Рё conditional UI;
  - finance/shift СЃС†РµРЅР°СЂРёРё СѓР¶Рµ РїСЂРёР·РЅР°РЅС‹ СЃР»РѕР¶РЅРѕР№ Р·РѕРЅРѕР№ Рё РЅР° mobile С‚РѕР¶Рµ С‚СЂРµР±СѓСЋС‚ СЂР°Р·РіСЂСѓР·РєРё;
  - РєСЂСѓРїРЅС‹Рµ СЌРєСЂР°РЅС‹ РЅР° React Native Р±С‹СЃС‚СЂРѕ СЃС‚Р°РЅРѕРІСЏС‚СЃСЏ С…СЂСѓРїРєРёРјРё РїСЂРё РґРѕСЂР°Р±РѕС‚РєР°С….
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - screen state Рё side effects РІ hooks;
  - action blocks РІ РѕС‚РґРµР»СЊРЅС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹;
  - РІС‹С‡РёСЃР»РµРЅРёСЏ Рё С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РІ helpers;
  - СЃРµС‚РµРІС‹Рµ РІС‹Р·РѕРІС‹ РІ service layer.

### 6. `apps/mobile/src/screens/HomeScreen.tsx`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~30 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - home/dashboard СЌРєСЂР°РЅС‹ С‡Р°СЃС‚Рѕ СЃРѕР±РёСЂР°СЋС‚ РјРЅРѕРіРѕ РЅРµР·Р°РІРёСЃРёРјС‹С… СЃРµРєС†РёР№ Рё РёСЃС‚РѕС‡РЅРёРєРѕРІ РґР°РЅРЅС‹С…;
  - РїСЂРё С‚Р°РєРѕРј СЂР°Р·РјРµСЂРµ С‚СЂСѓРґРЅРѕ СѓРґРµСЂР¶РёРІР°С‚СЊ РіСЂР°РЅРёС†Сѓ РјРµР¶РґСѓ layout, РґР°РЅРЅС‹РјРё Рё РёРЅС‚РµСЂР°РєС†РёСЏРјРё;
  - С…РѕСЂРѕС€РёР№ РєР°РЅРґРёРґР°С‚ РЅР° СЃРµРєС†РёРѕРЅРЅСѓСЋ РґРµРєРѕРјРїРѕР·РёС†РёСЋ Р±РµР· Р°СЂС…РёС‚РµРєС‚СѓСЂРЅРѕРіРѕ СЂРёСЃРєР°.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - СЃРµРєС†РёРё home screen РІ РѕС‚РґРµР»СЊРЅС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹;
  - Р·Р°РіСЂСѓР·РєСѓ РґР°РЅРЅС‹С… РїРѕ СЃРµРєС†РёСЏРј;
  - РѕР±СЂР°Р±РѕС‚С‡РёРєРё РЅР°РІРёРіР°С†РёРё Рё refresh logic.

---

## РЎСЂРµРґРЅРёР№ РїСЂРёРѕСЂРёС‚РµС‚

### 7. `apps/mobile/src/screens/ShiftsScreen.tsx`

- Текущий прогресс:
  - [x] Экранные типы вынесены в `shifts/types.ts`.
  - [x] Стили вынесены в `shifts/styles.ts`.
  - [x] Фильтр периода вынесен в `ShiftsPeriodFilter.tsx`.
  - [x] Overview-статистика вынесена в `ShiftsStatsOverview.tsx`.
  - [x] Карточка смены вынесена в `shifts/ShiftCard.tsx`.
  - [x] `ShiftsScreen.tsx` теперь держит в основном query/orchestration и `thin enough` для этой волны.

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~24 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - РІРµСЂРѕСЏС‚РЅРѕ СЃРјРµС€Р°РЅС‹ СЃРїРёСЃРѕРє СЃРјРµРЅ, С„РёР»СЊС‚СЂС‹, refresh, navigation actions;
  - РїРѕСЃР»Рµ СЂР°Р·РіСЂСѓР·РєРё `ShiftQuickScreen` СЌС‚РѕС‚ СЌРєСЂР°РЅ СЃС‚Р°РЅРµС‚ СЃР»РµРґСѓСЋС‰РёРј РµСЃС‚РµСЃС‚РІРµРЅРЅС‹Рј РєР°РЅРґРёРґР°С‚РѕРј.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - filters/list state;
  - СЌР»РµРјРµРЅС‚С‹ СЃРїРёСЃРєР° Рё toolbar;
  - Р·Р°РіСЂСѓР·РєСѓ Рё refresh РІ hooks.

### 7.1. `apps/mobile/src/screens/StaffScreen.tsx`

- Текущий прогресс:
  - [x] Экранные типы вынесены в `staff/types.ts`.
  - [x] Стили вынесены в `staff/styles.ts`.
  - [x] Upcoming-booking card вынесена в `StaffUpcomingBookingCard.tsx`.
  - [x] Action buttons вынесены в `StaffActionButtons.tsx`.
  - [x] Data/query слой вынесен в `useStaffScreenData.ts`.
  - [x] `StaffScreen.tsx` теперь держит в основном screen orchestration и `thin enough` для этой волны.

### 7.2. `apps/mobile/src/screens/CabinetScreen.tsx`

- Текущий прогресс:
  - [x] Экранные типы вынесены в `cabinet/types.ts`.
  - [x] Derived selectors и mapping вынесены в `cabinet/selectors.ts`.
  - [x] Data/offline orchestration вынесен в `useCabinetData.ts`.
  - [x] Header вынесен в `CabinetHeader.tsx`.
  - [x] Tabs вынесены в `CabinetTabs.tsx`.
  - [x] Booking card/list section вынесены в `CabinetBookingCard.tsx` и `CabinetBookingListSection.tsx`.
  - [x] Стили вынесены в `cabinet/styles.ts`.
  - [x] Добавлен unit-suite `cabinetSelectors.unit.test.ts`.
  - [x] Screen-level loading state вынесен в `CabinetScreenLoading.tsx`.
  - [x] Offline banner вынесен в `CabinetOfflineBanner.tsx`.
  - [x] Подготовлен render-level smoke suite `CabinetScreen.test.tsx` под normal RN test env.
  - [x] `CabinetScreen.tsx` теперь сведён к container-уровню и считается `thin enough` для этой волны.

- Почему кандидат:
  - экран смешивал online/offline source state и выбор вкладки `предстоящие/история`;
  - внутри одного файла были и React Query, и offline cache fallback, и derived booking lists, и весь presentation слой;
  - это важный клиентский поток, связанный и с офлайном, и с booking semantics.

- Что уже удалось:
  - развести `offline source` и tab state;
  - убрать большой inline presentation-блок из экрана;
  - оставить `CabinetScreen.tsx` как screen-level orchestration container.

### 7.3. `apps/mobile/src/screens/BookingDetailsScreen.tsx`

- Текущий прогресс:
  - [x] Экранные типы вынесены в `bookingDetails/types.ts`.
  - [x] Timeline helpers и label mapping вынесены в `bookingDetails/timeline.ts`.
  - [x] Screen-level loading/error states вынесены в `BookingDetailsScreenState.tsx`.
  - [x] Основная info card вынесена в `BookingDetailsInfoCard.tsx`.
  - [x] Action block вынесен в `BookingDetailsActions.tsx`.
  - [x] Стили вынесены в `bookingDetails/styles.ts`.
  - [x] Добавлен unit-suite `bookingDetailsTimeline.unit.test.ts`.
  - [x] Query/mutation и contact orchestration вынесены в `useBookingDetailsScreen.ts`.
  - [x] `BookingDetailsScreen.tsx` теперь сведён к container-уровню и считается `thin enough` для этой волны.

- Почему кандидат:
  - экран смешивал query, mutation, timeline mapping, contact actions и presentation в одном файле;
  - здесь важны booking semantics и cancel/repeat/contact сценарии, так что экран лучше держать тонким;
  - это следующий логичный mobile-узел после `CabinetScreen`.

### 8. `apps/web/src/app/staff/bookings/StaffBookingsView.tsx`

- Текущий прогресс:
  - [x] Типы вынесены в `staffBookingsTypes.ts`.
  - [x] `CreateBookingForm` вынесен в `StaffCreateBookingForm.tsx`.
  - [x] Переключатель вкладок вынесен в `StaffBookingsTabs.tsx`.
  - [x] Карточка записи вынесена в `StaffBookingCard.tsx`.
  - [x] `StaffBookingsView.tsx` теперь сведён к container-уровню и уже `thin enough` для этой волны.

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~32 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - bookings UI РѕР±С‹С‡РЅРѕ СЃРѕРґРµСЂР¶РёС‚ РјРЅРѕРіРѕ С„РёР»СЊС‚СЂРѕРІ, bulk actions, СЃС‚Р°С‚СѓСЃРѕРІ Рё derived presentation state;
  - СЌС‚Рѕ РїРѕС…РѕР¶Рµ РЅР° Р·РѕРЅСѓ, РіРґРµ РјРѕР¶РЅРѕ Р±С‹СЃС‚СЂРѕ РІС‹РёРіСЂР°С‚СЊ РІ С‡РёС‚Р°РµРјРѕСЃС‚Рё, СЂР°Р·СЂРµР·Р°РІ UI РЅР° СЃРµРєС†РёРё.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - toolbar/filters;
  - list/table presentation;
  - actions Рё side effects;
  - С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ СЃС‚Р°С‚СѓСЃРѕРІ Рё РґР°С‚.

### 9. `apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceStats.tsx`

Текущий прогресс:

- [x] Типы вынесены в `staffFinanceStatsTypes.ts`.
- [x] Fetch/state orchestration вынесен в `useStaffFinanceStats.ts`.
- [x] Жирный `ShiftCard` вынесен в `StaffFinanceShiftCard.tsx`.
- [x] Filter bar вынесен в `StaffFinanceStatsFilters.tsx`.
- [x] Overview/kpi sections вынесены в `StaffFinanceStatsOverview.tsx`.
- [x] Добавлен render-level suite `staffFinanceStatsComponents.test.tsx` на filters/overview/shift card.
- [x] `StaffFinanceStats.tsx` теперь сведён к container-уровню и считается `thin enough` для этой волны.

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~39 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - РєРѕРјРїРѕРЅРµРЅС‚ СЃС‚Р°С‚РёСЃС‚РёРєРё С‚Р°РєРѕРіРѕ СЂР°Р·РјРµСЂР° РїРѕС‡С‚Рё РЅР°РІРµСЂРЅСЏРєР° СЃРѕРґРµСЂР¶РёС‚ Рё presentation, Рё РІС‹С‡РёСЃР»РµРЅРёСЏ;
  - finance-Р»РѕРіРёРєР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РїРѕРІС‚РѕСЂРЅРѕ РёСЃРїРѕР»СЊР·СѓРµРјРѕР№, Р° РЅРµ Р·Р°С€РёС‚РѕР№ РІ РѕРґРёРЅ UI-РєРѕРјРїРѕРЅРµРЅС‚.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - stats mapping Рё Р°РіСЂРµРіР°С†РёРё;
  - РІРёР·СѓР°Р»СЊРЅС‹Рµ Р±Р»РѕРєРё РєР°СЂС‚РѕС‡РµРє/С‚Р°Р±Р»РёС†;
  - С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ С‡РёСЃРµР» Рё РїСЂРѕС†РµРЅС‚РѕРІ.

### 10. `apps/web/src/app/dashboard/finance/components/AllStaffFinanceStats.tsx`

- Текущий прогресс:
  - [x] Типы вынесены в `allStaffFinanceStatsTypes.ts`.
  - [x] Fetch/state orchestration вынесен в `useAllStaffFinanceStats.ts`.
  - [x] Filter bar вынесен в `AllStaffFinanceStatsFilters.tsx`.
  - [x] Overview/kpi sections вынесены в `AllStaffFinanceStatsOverview.tsx`.
  - [x] Mobile/desktop list presentation вынесена в `AllStaffFinanceStatsTable.tsx`.
  - [x] Добавлен render-level suite `allStaffFinanceStatsComponents.test.tsx` на filters/overview/table.
  - [x] `AllStaffFinanceStats.tsx` теперь сведён к container-уровню и считается `thin enough` для этой волны.

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~33 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - РѕС‡РµРЅСЊ РІРµСЂРѕСЏС‚РЅРѕ С‡Р°СЃС‚РёС‡РЅРѕРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ СЃРѕ `StaffFinanceStats.tsx`;
  - С…РѕСЂРѕС€Р°СЏ С‚РѕС‡РєР° РґР»СЏ РїРѕРёСЃРєР° РѕР±С‰РµРіРѕ finance presentation/model СЃР»РѕСЏ.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - РѕР±С‰РёРµ finance stats sections;
  - shared helpers Рё view models;
  - С„РёР»СЊС‚СЂС‹ Рё derived aggregates.

### 11. `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~29 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - route С‚Р°РєРѕРіРѕ СЂР°Р·РјРµСЂР° СЃ РІС‹СЃРѕРєРѕР№ РІРµСЂРѕСЏС‚РЅРѕСЃС‚СЊСЋ Р·РЅР°РµС‚ СЃР»РёС€РєРѕРј РјРЅРѕРіРѕ Рѕ С‚Р°Р±Р»РёС†Р°С… Рё СЂР°СЃС‡С‘С‚Р°С…;
  - РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕР№ СЂР°Р·РіСЂСѓР·РєРё `staff/shift/items/route.ts` СЌС‚Рѕ РїРѕС…РѕР¶РёР№ СЃР»РµРґСѓСЋС‰РёР№ РєР°РЅРґРёРґР°С‚.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - application/use case СЃР»РѕР№;
  - СЂРµРїРѕР·РёС‚РѕСЂРЅС‹Рµ Р·Р°РіСЂСѓР·РєРё;
  - finance aggregation helpers;
  - HTTP mapping РѕС‚РґРµР»СЊРЅРѕ РѕС‚ СЃС†РµРЅР°СЂРёСЏ.

### 12. `apps/web/src/app/admin/page.tsx`

- Текущий прогресс:
  - [x] Доменные/formatting helpers вынесены в `adminUtils.ts`.
  - [x] Экранные типы вынесены в `adminTypes.ts`.
  - [x] Metric card вынесен в `AdminMetricCard.tsx`.
  - [x] Status badges вынесены в `AdminBadges.tsx`.
  - [x] Крупные секции страницы вынесены в `AdminSections.tsx`.
  - [x] `admin/page.tsx` теперь сведён к data-loading и сборке секций, то есть `thin enough` для этой волны.

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~30 KB`
- РџРѕС‡РµРјСѓ РєР°РЅРґРёРґР°С‚:
  - admin dashboard С‡Р°СЃС‚Рѕ СЃРѕР±РёСЂР°РµС‚ СЂР°Р·РЅРѕС€С‘СЂСЃС‚РЅС‹Рµ СЃРµРєС†РёРё Рё Р±С‹СЃС‚СЂРѕ СЂР°СЃРїСѓС…Р°РµС‚;
  - РІС‹СЃРѕРєР°СЏ РІРµСЂРѕСЏС‚РЅРѕСЃС‚СЊ, С‡С‚Рѕ С‚СѓС‚ РїРѕР»РµР·РЅРµРµ СЂРµР·Р°С‚СЊ РїРѕ С„РёС‡Р°Рј/РїР°РЅРµР»СЏРј, Р° РЅРµ РїРѕ СЃС‚СЂРѕРєР°Рј.
- Р§С‚Рѕ РІС‹РЅРѕСЃРёС‚СЊ:
  - РѕС‚РґРµР»СЊРЅС‹Рµ admin panels;
  - Р·Р°РіСЂСѓР·РєСѓ РґР°РЅРЅС‹С… РїРѕ Р±Р»РѕРєР°Рј;
  - feature flags / actions.

---

## РќРёР·РєРёР№ РїСЂРёРѕСЂРёС‚РµС‚ РёР»Рё РѕСЃРѕР±С‹Р№ СЃР»СѓС‡Р°Р№

### `apps/web/src/types/supabase.ts`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~77 KB`
- Р РµС€РµРЅРёРµ:
  - РЅРµ СЃС‡РёС‚Р°С‚СЊ РѕР±С‹С‡РЅС‹Рј РєР°РЅРґРёРґР°С‚РѕРј РЅР° РґРµРєРѕРјРїРѕР·РёС†РёСЋ;
  - СЌС‚Рѕ generated file, Рё РµРіРѕ СЂР°Р·РјРµСЂ СЃР°Рј РїРѕ СЃРµР±Рµ РЅРµ РїСЂРѕР±Р»РµРјР° Р°СЂС…РёС‚РµРєС‚СѓСЂС‹.

### `packages/shared-client/src/api.ts`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~9 KB`
- Р РµС€РµРЅРёРµ:
  - РЅРµР±РѕР»СЊС€РѕР№ С„Р°Р№Р» РїРѕ СЃСЂР°РІРЅРµРЅРёСЋ СЃ app-level РјРѕРЅРѕР»РёС‚Р°РјРё;
  - РјРѕР¶РЅРѕ РїРµСЂРµСЃРјРѕС‚СЂРµС‚СЊ РїРѕР·Р¶Рµ, РµСЃР»Рё С‚Р°Рј РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕ СЃРјРµС€Р°РЅС‹ transport helpers Рё domain-specific client logic.

### `packages/core-domain/src/booking/validation.ts`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ: `~9 KB`
- Р РµС€РµРЅРёРµ:
  - СЌС‚Рѕ СЃРєРѕСЂРµРµ РєР°РЅРґРёРґР°С‚ РЅР° СѓРїСЂРѕС‰РµРЅРёРµ РїСЂР°РІРёР» Рё РіСЂР°РЅРёС† validation strategy, Р° РЅРµ РЅР° СЃСЂРѕС‡РЅСѓСЋ РґРµРєРѕРјРїРѕР·РёС†РёСЋ РїРѕ СЂР°Р·РјРµСЂСѓ.

---

## РџРµСЂРІР°СЏ РІРѕР»РЅР° РґРµРєРѕРјРїРѕР·РёС†РёРё

Р•СЃР»Рё РёРґС‚Рё РїРѕСЃС‚РµРїРµРЅРЅРѕ, РїРµСЂРІС‹РјРё СЃС‚РѕРёС‚ Р±СЂР°С‚СЊ:

1. `apps/web/src/app/staff/finance/hooks/useShiftItems.ts`
2. `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`
3. `apps/web/src/app/staff/finance/components/FinancePage.tsx`
4. `apps/web/src/app/api/webhooks/whatsapp/route.ts`
5. `apps/mobile/src/screens/ShiftQuickScreen.tsx`
6. `apps/mobile/src/screens/HomeScreen.tsx`

РРјРµРЅРЅРѕ СЌС‚Рё С„Р°Р№Р»С‹ СЃРµР№С‡Р°СЃ РґР°СЋС‚ Р»СѓС‡С€РёР№ Р±Р°Р»Р°РЅСЃ РјРµР¶РґСѓ СЂР°Р·РјРµСЂРѕРј, СЃРјРµС€РµРЅРёРµРј РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё Рё РѕР¶РёРґР°РµРјРѕР№ РїРѕР»СЊР·РѕР№ РѕС‚ РґРµРєРѕРјРїРѕР·РёС†РёРё.

### Р РµР·СѓР»СЊС‚Р°С‚ СЂР°СЃСЃРјРѕС‚СЂРµРЅРёСЏ РїРµСЂРІРѕР№ РІРѕР»РЅС‹

РќРёР¶Рµ Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅС‹ СѓР¶Рµ РЅРµ РїСЂРѕСЃС‚Рѕ РєР°РЅРґРёРґР°С‚С‹, Р° СЂР°Р±РѕС‡РёРµ РІС‹РІРѕРґС‹ РїРѕ РєР°Р¶РґРѕРјСѓ С„Р°Р№Р»Сѓ РїРѕСЃР»Рµ РїРµСЂРІРёС‡РЅРѕРіРѕ СЂР°Р·Р±РѕСЂР°.

#### `apps/web/src/app/staff/finance/hooks/useShiftItems.ts`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё: `1118` СЃС‚СЂРѕРє
- Р§С‚Рѕ РІРёРґРЅРѕ РїРѕ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё:
  - СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ Р»РѕРєР°Р»СЊРЅРѕРіРѕ Рё СЃРµСЂРІРµСЂРЅРѕРіРѕ state;
  - СЃР»РѕР¶РЅРѕРµ merge-РїРѕРІРµРґРµРЅРёРµ РґР»СЏ `items`;
  - debounce/autosave, retry, abort logic;
  - optimistic update Рё rollback;
  - network layer Рё toast/error side effects.
- Р’С‹РІРѕРґ:
  - СЌС‚Рѕ РіР»Р°РІРЅС‹Р№ РєР°РЅРґРёРґР°С‚ РїРµСЂРІРѕР№ РІРѕР»РЅС‹;
  - С„Р°Р№Р» СѓР¶Рµ РІС‹С€РµР» Р·Р° РіСЂР°РЅРёС†Сѓ вЂњРѕРґРЅРѕРіРѕ hookвЂќ Рё С„Р°РєС‚РёС‡РµСЃРєРё СЃС‚Р°Р» mini feature-engine.
- Р§С‚Рѕ СЂРµР·Р°С‚СЊ РїРµСЂРІС‹Рј:
  - merge/sync СЃС‚СЂР°С‚РµРіРёСЋ `items`;
  - autosave queue Рё debounce/save orchestration;
  - API-РѕРїРµСЂР°С†РёРё `add/delete/save` РІ РѕС‚РґРµР»СЊРЅС‹Р№ service/action layer.

РўРµРєСѓС‰РёР№ РїСЂРѕРіСЂРµСЃСЃ:

- [x] Р’С‹РЅРµСЃРµРЅС‹ С‡РёСЃС‚С‹Рµ helpers РІ `shiftItemsHelpers.ts`:
  - СЃРµСЂРёР°Р»РёР·Р°С†РёСЏ
  - С„РёР»СЊС‚СЂР°С†РёСЏ СЃРѕС…СЂР°РЅСЏРµРјС‹С… items
  - deduplication
  - РїРµСЂРµСЃС‡С‘С‚ `expandedItems` РїРѕСЃР»Рµ СѓРґР°Р»РµРЅРёСЏ
- [x] Р”РѕР±Р°РІР»РµРЅС‹ unit-С‚РµСЃС‚С‹ РЅР° helper-СЃР»РѕР№.
- [x] Р’С‹РЅРµСЃРµРЅ РїРѕРІС‚РѕСЂСЏСЋС‰РёР№СЃСЏ СЃРµС‚РµРІРѕР№ Рё error-mapping СЃР»РѕР№ РІ `shiftItemsApi.ts`.
- [x] Р’С‹РЅРµСЃРµРЅ autosave lifecycle РІ `useShiftItemsAutosave.ts`.
- [x] Р’С‹РЅРµСЃРµРЅР° merge/sync СЃС‚СЂР°С‚РµРіРёСЏ РІ `useShiftItemsSync.ts`.

#### `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё: `1019` СЃС‚СЂРѕРє
- Р§С‚Рѕ РІРёРґРЅРѕ РїРѕ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё:
  - РІ РѕРґРЅРѕРј С„Р°Р№Р»Рµ Р¶РёРІСѓС‚ page-level orchestration, date helpers, editable rows Рё Р±РѕР»СЊС€РѕР№ JSX;
  - Р»РѕРєР°Р»СЊРЅС‹Рµ state/effect-РІРµС‚РєРё РµСЃС‚СЊ Рё РЅР° СѓСЂРѕРІРЅРµ СЃС‚СЂР°РЅРёС†С‹, Рё РІРЅСѓС‚СЂРё РІР»РѕР¶РµРЅРЅС‹С… РєРѕРјРїРѕРЅРµРЅС‚РѕРІ;
  - РІРЅСѓС‚СЂРё С„Р°Р№Р»Р° СѓР¶Рµ СЃРїСЂСЏС‚Р°РЅС‹ РѕС‚РґРµР»СЊРЅС‹Рµ mini-components (`SingleTimeRange`, `DayRow`), РЅРѕ РІСЃС‘ РµС‰С‘ РІРЅСѓС‚СЂРё РѕРґРЅРѕРіРѕ РјРѕРЅРѕР»РёС‚Р°.
- Р’С‹РІРѕРґ:
  - С…РѕСЂРѕС€РёР№ РєР°РЅРґРёРґР°С‚ РЅР° вЂњРІРЅСѓС‚СЂРёС„Р°Р№Р»РѕРІСѓСЋвЂќ РґРµРєРѕРјРїРѕР·РёС†РёСЋ РІ РѕС‚РґРµР»СЊРЅС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹ Рё hooks;
  - СЌС‚Рѕ РЅРµ СЃС‚РѕР»СЊРєРѕ data-layer РїСЂРѕР±Р»РµРјР°, СЃРєРѕР»СЊРєРѕ СЃРјРµС€РµРЅРёРµ screen orchestration Рё UI.
- Р§С‚Рѕ СЂРµР·Р°С‚СЊ РїРµСЂРІС‹Рј:
  - `DayRow` Рё time-range UI РІ РѕС‚РґРµР»СЊРЅС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹;
  - week/date logic РІ РѕС‚РґРµР»СЊРЅС‹Р№ helper/hook;
  - Р·Р°РіСЂСѓР·РєСѓ/СЃРѕС…СЂР°РЅРµРЅРёРµ schedule РѕС‚РґРµР»СЊРЅРѕ РѕС‚ JSX-РґРµСЂРµРІР°.

РўРµРєСѓС‰РёР№ РїСЂРѕРіСЂРµСЃСЃ:

- [x] Р РµРЅРґРµСЂ schedule-СЃС‚СЂРѕРє РїРµСЂРµРІРµРґС‘РЅ РЅР° РІРЅРµС€РЅРёР№ `DayRow` РєРѕРјРїРѕРЅРµРЅС‚.
- [x] Р”РѕР±Р°РІР»РµРЅ smoke-test РЅР° РёРјРїРѕСЂС‚ РјРѕРґСѓР»СЏ РїРѕСЃР»Рµ РїРµСЂРІРѕРіРѕ С€Р°РіР° РґРµРєРѕРјРїРѕР·РёС†РёРё.
- [ ] РћСЃС‚Р°Р»РѕСЃСЊ РІС‹РЅРµСЃС‚Рё РѕСЃС‚Р°Р»СЊРЅС‹Рµ РІРЅСѓС‚СЂРµРЅРЅРёРµ UI-С‡Р°СЃС‚Рё Рё page-level state/effect СЃР»РѕР№.

#### `apps/web/src/app/staff/finance/components/FinancePage.tsx`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё: `726` СЃС‚СЂРѕРє
- Р§С‚Рѕ РІРёРґРЅРѕ РїРѕ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё:
  - СЌРєСЂР°РЅ РґРµСЂР¶РёС‚ tab state, date state, prefetching, local optimistic items, sync СЃ query data;
  - orchestration СѓР¶Рµ С‡Р°СЃС‚РёС‡РЅРѕ РІС‹РЅРµСЃРµРЅ РІ hooks, РЅРѕ СЃС‚СЂР°РЅРёС†Р° РІСЃС‘ РµС‰С‘ Р·РЅР°РµС‚ СЃР»РёС€РєРѕРј РјРЅРѕРіРѕ Рѕ data lifecycle;
  - РјРЅРѕРіРѕ СЃРІСЏР·СѓСЋС‰РµР№ Р»РѕРіРёРєРё РјРµР¶РґСѓ РІРєР»Р°РґРєР°РјРё, query cache Рё Р»РѕРєР°Р»СЊРЅС‹Рј СЃРѕСЃС‚РѕСЏРЅРёРµРј.
- Р’С‹РІРѕРґ:
  - СЌС‚Рѕ РєР°РЅРґРёРґР°С‚ РЅРµ РЅР° вЂњРіР»СѓР±РѕРєСѓСЋ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅСѓСЋ СЂР°Р·Р±РѕСЂРєСѓвЂќ, Р° РЅР° РґР°Р»СЊРЅРµР№С€РµРµ СЂР°Р·РґРµР»РµРЅРёРµ orchestration;
  - РїРѕ СЃСЂРѕС‡РЅРѕСЃС‚Рё СѓСЃС‚СѓРїР°РµС‚ `useShiftItems.ts`, РЅРѕ РёРґС‘С‚ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ РЅРµРіРѕ.
- Р§С‚Рѕ СЂРµР·Р°С‚СЊ РїРµСЂРІС‹Рј:
  - tab/date state Рё persistence active tab;
  - prefetch/navigation logic РїРѕ РґР°С‚Р°Рј;
  - local-items synchronization РІ РѕС‚РґРµР»СЊРЅС‹Р№ coordinator hook.

РўРµРєСѓС‰РёР№ РїСЂРѕРіСЂРµСЃСЃ:

- [x] `useFinancePageState.ts` РїРѕРґРєР»СЋС‡С‘РЅ РІ СЌРєСЂР°РЅ.
- [x] `useFinanceDatePrefetch.ts` РїРѕРґРєР»СЋС‡С‘РЅ РІ СЌРєСЂР°РЅ.
- [x] `useFinanceLoadingState.ts` РІС‹РЅРµСЃРµРЅ РёР· СЃС‚СЂР°РЅРёС†С‹.
- [x] `useFinanceLocalItems.ts` РІС‹РЅРµСЃРµРЅ РёР· СЃС‚СЂР°РЅРёС†С‹.
- [x] РћСЃС‚Р°С‚РѕС‡РЅС‹Р№ inline prefetch-РєРѕРґ СѓРґР°Р»С‘РЅ.
- [x] Tab-level sections РІС‹РЅРµСЃРµРЅС‹ РІ `FinanceShiftTab.tsx`, `FinanceClientsTab.tsx`, `FinanceStatsTab.tsx`.
- [x] Smoke-test `FinancePage.module.test.tsx` РїРѕРІС‚РѕСЂРЅРѕ РїСЂРѕР№РґРµРЅ РїРѕСЃР»Рµ РґРµРєРѕРјРїРѕР·РёС†РёРё.

#### `apps/mobile/src/screens/ShiftQuickScreen.tsx`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё: `863` СЃС‚СЂРѕРєРё
- Р§С‚Рѕ РІРёРґРЅРѕ РїРѕ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё:
  - РІ РѕРґРЅРѕРј СЌРєСЂР°РЅРµ СЃРјРµС€Р°РЅС‹ query/mutation СЃР»РѕР№, offline queue, secure storage cache, form state, alerts Рё UI;
  - РѕС„Р»Р°Р№РЅ-РѕС‡РµСЂРµРґСЊ Рё РєСЌС€ РїСЂСЏРјРѕ РІСЃС‚СЂРѕРµРЅС‹ РІ screen;
  - screen Р·РЅР°РµС‚ Рё РїСЂРѕ transport, Рё РїСЂРѕ persistence, Рё РїСЂРѕ presentation.
- Р’С‹РІРѕРґ:
  - СЌС‚Рѕ strongest candidate РЅР° mobile-СЃС‚РѕСЂРѕРЅРµ;
  - СЂР°Р·СЂРµР·Р°С‚СЊ РЅСѓР¶РЅРѕ РЅРµ С‚РѕР»СЊРєРѕ UI, РЅРѕ Рё offline/application СЃР»РѕР№.
- Р§С‚Рѕ СЂРµР·Р°С‚СЊ РїРµСЂРІС‹Рј:
  - offline queue/cache helpers РІ РѕС‚РґРµР»СЊРЅС‹Р№ РјРѕРґСѓР»СЊ;
  - screen actions (`open/close/add/update/delete`) РІ РѕС‚РґРµР»СЊРЅС‹Рµ mutation hooks;
  - form state РЅРѕРІРѕРіРѕ РєР»РёРµРЅС‚Р° Рё list/item UI РІ РѕС‚РґРµР»СЊРЅС‹Рµ С‡Р°СЃС‚Рё.

РўРµРєСѓС‰РёР№ РїСЂРѕРіСЂРµСЃСЃ:

- [x] Shared types РІС‹РЅРµСЃРµРЅС‹ РІ `shiftQuick/types.ts`.
- [x] Offline queue/cache helpers РІС‹РЅРµСЃРµРЅС‹ РІ `shiftQuick/storage.ts`.
- [x] Р§РёСЃС‚С‹Рµ СЂР°СЃС‡С‘С‚С‹ РІС‹РЅРµСЃРµРЅС‹ РІ `shiftQuick/calculations.ts`.
- [x] State С„РѕСЂРјС‹ РІС‹РЅРµСЃРµРЅ РІ `useShiftQuickAddClientForm.ts`.
- [x] Mutation/offline orchestration РІС‹РЅРµСЃРµРЅ РІ `useShiftQuickOperations.ts`.
- [x] UI-СЃРµРєС†РёРё РІС‹РЅРµСЃРµРЅС‹ РІ `ShiftQuickStatusCard.tsx`, `ShiftQuickStatsGrid.tsx`, `ShiftQuickAddClientCard.tsx`, `ShiftQuickClientsSection.tsx`.
- [x] РћР±С‰РёРµ СЃС‚РёР»Рё РІС‹РЅРµСЃРµРЅС‹ РІ `shiftQuick/styles.ts`.
- [x] Staff-info Рё finance query СЃР»РѕР№ РІС‹РЅРµСЃРµРЅ РІ `useShiftQuickData.ts`.
- [x] Р”РѕР±Р°РІР»РµРЅ unit-test `shiftQuickCalculations.unit.test.ts`.
- [x] Screen-level loading / not-staff / error ветки вынесены в `ShiftQuickScreenState.tsx`.
- [x] Offline queue indicator вынесен в `ShiftQuickOfflineIndicator.tsx`.
- [x] `shiftQuickCalculations.unit.test.ts` повторно пройден после финального прохода.
- [ ] РЎР»РµРґСѓСЋС‰РёР№ РїСЂРѕС…РѕРґ: РґРѕР±РёС‚СЊ screen-level empty/loading branches РёР»Рё РїСЂРёР·РЅР°С‚СЊ С„Р°Р№Р» РґРѕСЃС‚Р°С‚РѕС‡Рѕ СЂР°Р·РіСЂСѓР¶РµРЅРЅС‹Рј.

#### `apps/mobile/src/screens/HomeScreen.tsx`

- РџСЂРёРјРµСЂРЅС‹Р№ СЂР°Р·РјРµСЂ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё: `746` СЃС‚СЂРѕРє
- Р§С‚Рѕ РІРёРґРЅРѕ РїРѕ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё:
  - home screen СЃРѕРІРјРµС‰Р°РµС‚ РїРѕРёСЃРє, С„РёР»СЊС‚СЂР°С†РёСЋ, Р·Р°РіСЂСѓР·РєСѓ Р±РёР·РЅРµСЃРѕРІ, Р·Р°РіСЂСѓР·РєСѓ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№, analytics Рё navigation;
  - derived UI-model (`upcomingBookings`, `recentPlaces`, `availableCategories`) СЃС‡РёС‚Р°РµС‚СЃСЏ РїСЂСЏРјРѕ РІ СЌРєСЂР°РЅРµ;
  - СЌС‚Рѕ Р±РѕР»РµРµ вЂњСЃРµРєС†РёРѕРЅРЅС‹Р№вЂќ РјРѕРЅРѕР»РёС‚, С‡РµРј С‚СЏР¶С‘Р»С‹Р№ transactional screen.
- Р’С‹РІРѕРґ:
  - С…РѕСЂРѕС€РёР№ РєР°РЅРґРёРґР°С‚ РЅР° Р°РєРєСѓСЂР°С‚РЅСѓСЋ UI/section РґРµРєРѕРјРїРѕР·РёС†РёСЋ;
  - СЃСЂРѕС‡РЅРѕСЃС‚СЊ РЅРёР¶Рµ, С‡РµРј Сѓ `ShiftQuickScreen.tsx` Рё `useShiftItems.ts`.
- Р§С‚Рѕ СЂРµР·Р°С‚СЊ РїРµСЂРІС‹Рј:
  - sections home screen РІ РѕС‚РґРµР»СЊРЅС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹;
  - query hooks РґР»СЏ `businesses` Рё `bookings`;
  - search/filter state РѕС‚РґРµР»СЊРЅРѕ РѕС‚ rendering blocks.

РўРµРєСѓС‰РёР№ РїСЂРѕРіСЂРµСЃСЃ:

- [x] Shared types РІС‹РЅРµСЃРµРЅС‹ РІ `home/types.ts`.
- [x] Derived selectors РІС‹РЅРµСЃРµРЅС‹ РІ `home/selectors.ts`.
- [x] Data/query СЃР»РѕР№ РІС‹РЅРµСЃРµРЅ РІ `home/useHomeData.ts`.
- [x] Р”РѕР±Р°РІР»РµРЅ unit-test `homeSelectors.unit.test.ts`.
- [x] Р’РµСЂС…РЅСЏСЏ hero-СЃРµРєС†РёСЏ РІС‹РЅРµСЃРµРЅР° РІ `HomeHeroSection.tsx`.
- [x] Р‘Р»РѕРє Р±Р»РёР¶Р°Р№С€РёС… Р·Р°РїРёСЃРµР№ РІС‹РЅРµСЃРµРЅ РІ `HomeUpcomingBookingsSection.tsx`.
- [x] Search-СЃРµРєС†РёСЏ РІС‹РЅРµСЃРµРЅР° РІ `HomeSearchSection.tsx`.
- [x] Categories-СЃРµРєС†РёСЏ РІС‹РЅРµСЃРµРЅР° РІ `HomeCategoriesSection.tsx`.
- [x] Business-list СЃРµРєС†РёСЏ РІС‹РЅРµСЃРµРЅР° РІ `HomeBusinessListSection.tsx`.
- [x] Recent-places и offline-banner блоки вынесены в `HomeRecentPlacesSection.tsx` и `HomeOfflineBannerSection.tsx`.
- [x] `homeSelectors.unit.test.ts` повторно пройден после финального прохода по экрану.

#### `apps/web/src/app/api/webhooks/whatsapp/route.ts`

- [x] GET verification вынесена в `whatsappWebhookVerification.ts`.
- [x] POST payload traversal вынесен в `whatsappWebhookPayload.ts`.
- [x] Типы webhook/message/status/active booking вынесены в `whatsappWebhookTypes.ts`.
- [x] Media handler вынесен в `whatsappWebhookMedia.ts`.
- [x] Status update handler вынесен в `whatsappWebhookStatus.ts`.
- [x] Text-command parser/dispatcher вынесен в `whatsappWebhookCommands.ts`.
- [x] `cancel/confirm` handlers вынесены в `whatsappWebhookBookingActions.ts`.
- [x] `help/remind/info` handlers вынесены в `whatsappWebhookBookingInfo.ts`.
- [ ] Следующий проход: решить, нужен ли отдельный use-case/service facade над всеми webhook handlers.

#### `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`

- [x] Query/date parsing и period/date range calculation вынесены в `financeStatsParams.ts`.
- [x] Staff loading/access check вынесены в `financeStatsStaff.ts`.
- [x] Shift loading и включение открытой смены вынесены в `financeStatsShifts.ts`.
- [x] Shift items loading/grouping вынесены в `financeStatsShiftItems.ts`.
- [x] Предварительные finance aggregates для открытых смен вынесены в `financeStatsAggregates.ts`.
- [x] Финальная сборка `stats.shifts` и totals вынесена в `financeStatsPresentation.ts`.
- [x] Отдельный facade не нужен: route уже достаточно thin-adapter уровня.


#### `apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts`

- [x] Query/date parsing вынесены в `ownerShiftOpenParams.ts`.
- [x] Staff loading/access check вынесены в `ownerShiftOpenStaff.ts`.
- [x] Schedule timing / late-minutes calculation вынесены в `ownerShiftOpenSchedule.ts`.
- [x] Existing-shift resolution и create/reopen persistence вынесены в `ownerShiftOpenPersistence.ts`.
- [x] Отдельный facade не нужен: route уже достаточно thin-adapter уровня.

#### `apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts`

- [x] Query/date parsing вынесены в `financeByIdParams.ts`.
- [x] Staff loading/access check вынесены в `financeByIdStaff.ts`.
- [x] Day-off / shift loading вынесены в `financeByIdShiftContext.ts`.
- [x] Shift items loading вынесен в `financeByIdShiftItems.ts`.
- [x] Bookings/services loading и нормализация вынесены в `financeByIdRelatedData.ts`.
- [x] Current-hours/stats/all-shifts расчёты вынесены в `financeByIdStats.ts`.
- [x] Финальная сборка response вынесена в `financeByIdResponse.ts`.
- [x] Route доведён до thin-adapter уровня без дополнительного facade-слоя.

#### `apps/web/src/app/api/dashboard/staff/[id]/finance/audit-log/route.ts`

- [x] Access-check вынесен в `financeAuditLogAccess.ts`.
- [x] Загрузка audit rows и профилей вынесена в `financeAuditLogData.ts`.
- [x] Mapping response entries вынесен в `financeAuditLogResponse.ts`.
- [x] Route доведён до thin-adapter уровня без дополнительного facade-слоя.
### Р РµРєРѕРјРµРЅРґСѓРµРјС‹Р№ РїРѕСЂСЏРґРѕРє

Р•СЃР»Рё Р±СЂР°С‚СЊ РїРѕ РѕРґРЅРѕРјСѓ С„Р°Р№Р»Сѓ Р·Р° СЂР°Р·, РѕРїС‚РёРјР°Р»СЊРЅС‹Р№ РїРѕСЂСЏРґРѕРє СЃРµР№С‡Р°СЃ С‚Р°РєРѕР№:

1. `apps/web/src/app/staff/finance/hooks/useShiftItems.ts`
2. `apps/mobile/src/screens/ShiftQuickScreen.tsx`
3. `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`
4. `apps/web/src/app/staff/finance/components/FinancePage.tsx`
5. `apps/mobile/src/screens/HomeScreen.tsx`

Р­С‚РѕС‚ РїРѕСЂСЏРґРѕРє РґР°С‘С‚ Р»СѓС‡С€РёР№ Р±Р°Р»Р°РЅСЃ РјРµР¶РґСѓ СЂРёСЃРєРѕРј, СЃР»РѕР¶РЅРѕСЃС‚СЊСЋ Рё РѕР¶РёРґР°РµРјРѕР№ РёРЅР¶РµРЅРµСЂРЅРѕР№ РїРѕР»СЊР·РѕР№.

### РњР°С‚СЂРёС†Р° СЂРµС€РµРЅРёР№ РїРѕ С‚РёРїР°Рј РґРµРєРѕРјРїРѕР·РёС†РёРё

| Р¤Р°Р№Р» | Р’С‹РЅРµСЃС‚Рё РІС‹С‡РёСЃР»РµРЅРёСЏ | Р’С‹РЅРµСЃС‚Рё side effects | Р’С‹РЅРµСЃС‚Рё СЃРµС‚РµРІРѕР№ СЃР»РѕР№ | Р Р°Р·СЂРµР·Р°С‚СЊ UI |
|---|---|---|---|---|
| `apps/web/src/app/staff/finance/hooks/useShiftItems.ts` | **Р”Р°**. Merge/sync, sorting, optimistic reconciliation Рё РїРѕРґРіРѕС‚РѕРІРєСѓ payload Р»СѓС‡С€Рµ РІС‹РЅРµСЃС‚Рё РІ helpers/use-case helpers. | **Р”Р°**. Toast, autosave lifecycle, retry/abort orchestration Рё rollback Р»СѓС‡С€Рµ РѕС‚РґРµР»РёС‚СЊ РѕС‚ core state logic. | **Р”Р°**. `add/delete/save` Рё СЃРІСЏР·Р°РЅРЅС‹Рµ Р·Р°РїСЂРѕСЃС‹ РґРѕР»Р¶РЅС‹ СѓР№С‚Рё РІ service/action СЃР»РѕР№. | **РќРµС‚ РєР°Рє РѕСЃРЅРѕРІРЅРѕР№ С€Р°Рі**. Р­С‚Рѕ РЅРµ UI-С„Р°Р№Р»; Р·РґРµСЃСЊ РїСЂРёРѕСЂРёС‚РµС‚ РЅРµ РІ СЂР°Р·СЂРµР·Р°РЅРёРё JSX, Р° РІ СЂР°Р·РґРµР»РµРЅРёРё hook responsibilities. |
| `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx` | **Р”Р°**. Week/date calculations Рё РїСЂР°РІРёР»Р° СЂР°Р±РѕС‚С‹ СЃ interval/day-off СЃС‚РѕРёС‚ РІС‹РЅРµСЃС‚Рё. | **Р”Р°**. Р—Р°РіСЂСѓР·РєР°, СЃРѕС…СЂР°РЅРµРЅРёРµ, toast/error side effects Рё sync-СЌС„С„РµРєС‚С‹ Р»СѓС‡С€Рµ РІС‹РЅРµСЃС‚Рё РІ hooks. | **Р”Р°**. Fetch/save schedule logic СЃС‚РѕРёС‚ РѕС‚РґРµР»РёС‚СЊ РѕС‚ screen/rendering. | **Р”Р°**. `DayRow`, time-range controls Рё СЃРµРєС†РёРё СЌРєСЂР°РЅР° РЅСѓР¶РЅРѕ РІС‹РЅРµСЃС‚Рё РІ РѕС‚РґРµР»СЊРЅС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹. |
| `apps/web/src/app/staff/finance/components/FinancePage.tsx` | **Р§Р°СЃС‚РёС‡РЅРѕ РґР°**. Derived state РїРѕ РІРєР»Р°РґРєР°Рј, РґР°С‚Р°Рј Рё СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё local/server items СЃС‚РѕРёС‚ РІС‹РЅРµСЃС‚Рё. | **Р”Р°**. Prefetch, tab persistence Рё С‡Р°СЃС‚СЊ query-cache coordination Р»СѓС‡С€Рµ РґРµСЂР¶Р°С‚СЊ РІРЅРµ page component. | **Р§Р°СЃС‚РёС‡РЅРѕ РґР°**. РќРµ СЃС‚РѕР»СЊРєРѕ РЅРёР·РєРѕСѓСЂРѕРІРЅРµРІС‹Р№ transport, СЃРєРѕР»СЊРєРѕ orchestration РІРѕРєСЂСѓРі data fetching СЃС‚РѕРёС‚ РІС‹РЅРµСЃС‚Рё РІ coordinator hooks. | **Р§Р°СЃС‚РёС‡РЅРѕ РґР°**. UI СѓР¶Рµ С‡Р°СЃС‚РёС‡РЅРѕ СЂР°Р·СЂРµР·Р°РЅ, РЅРѕ page-level sections Рё containers РµС‰С‘ РјРѕР¶РЅРѕ СЃРґРµР»Р°С‚СЊ С‚РѕРЅСЊС€Рµ. |
| `apps/mobile/src/screens/ShiftQuickScreen.tsx` | **Р”Р°**. Р’С‹С‡РёСЃР»РµРЅРёСЏ totals, mapping offline operations Рё form/data transformations СЃС‚РѕРёС‚ РІС‹РЅРµСЃС‚Рё. | **Р”Р°**. Alerts, offline queue processing, cache sync Рё mutation side effects РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РІС‹РЅРµСЃРµРЅС‹. | **Р”Р°**. API-РѕРїРµСЂР°С†РёРё Рё secure-storage/offline persistence РЅСѓР¶РЅРѕ РѕС‚РґРµР»РёС‚СЊ РѕС‚ screen. | **Р”Р°**. Р¤РѕСЂРјС‹, СЃРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ, summary/actions Рё empty/loading states СЃС‚РѕРёС‚ СЂР°Р·РЅРµСЃС‚Рё РїРѕ РєРѕРјРїРѕРЅРµРЅС‚Р°Рј. |
| `apps/mobile/src/screens/HomeScreen.tsx` | **Р”Р°**. `upcomingBookings`, `recentPlaces`, category derivation Рё filtering logic Р»СѓС‡С€Рµ РІС‹РЅРµСЃС‚Рё РІ selectors/helpers. | **Р§Р°СЃС‚РёС‡РЅРѕ РґР°**. Analytics, refresh handling Рё network-error handling Р»СѓС‡С€Рµ РІС‹РЅРµСЃС‚Рё РІ hooks. | **Р”Р°**. Query hooks РґР»СЏ businesses/bookings Р»СѓС‡С€Рµ РѕС‚РґРµР»РёС‚СЊ РѕС‚ screen. | **Р”Р°**. Home sections, cards, filters Рё booking previews СЃС‚РѕРёС‚ РІС‹РЅРµСЃС‚Рё РІ РѕС‚РґРµР»СЊРЅС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹. |

### РљРѕСЂРѕС‚РєРёР№ РІС‹РІРѕРґ РїРѕ РјР°С‚СЂРёС†Рµ

- `useShiftItems.ts` Рё `ShiftQuickScreen.tsx` С‚СЂРµР±СѓСЋС‚ РІС‹РЅРѕСЃР° РїРѕС‡С‚Рё РїРѕ РІСЃРµРј РѕСЃСЏРј СЃСЂР°Р·Сѓ.
- `Client.tsx` С‚СЂРµР±СѓРµС‚ РїРѕР»РЅРѕС†РµРЅРЅРѕР№ screen-level РґРµРєРѕРјРїРѕР·РёС†РёРё: Рё data/side effects, Рё UI.
- `FinancePage.tsx` Р±РѕР»СЊС€Рµ РЅСѓР¶РґР°РµС‚СЃСЏ РІ СЂР°Р·РіСЂСѓР·РєРµ orchestration, С‡РµРј РІ РїРѕР»РЅРѕРј РїРµСЂРµРїРёСЃС‹РІР°РЅРёРё UI.
- `HomeScreen.tsx` Р»СѓС‡С€Рµ РІСЃРµРіРѕ СЂРµР·Р°С‚СЊ РїРѕ СЃРµРєС†РёСЏРј Рё query hooks, Р±РµР· С‚СЏР¶С‘Р»РѕРіРѕ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅРѕРіРѕ СЂРµС„Р°РєС‚РѕСЂРёРЅРіР°.

---

## РџСЂР°РєС‚РёС‡РµСЃРєРёР№ РІС‹РІРѕРґ

### 13. `apps/web/src/app/dashboard/staff/[id]/StaffDetailPageClient.tsx`

- Текущий прогресс:
  - [x] Экранные типы вынесены в `staffDetailTypes.ts`.
  - [x] Вынесены helper-функции в `staffDetailHelpers.ts`.
  - [x] Вынесена reviews-секция в `StaffReviewsSection.tsx`.
  - [x] Добавлены тесты `staffDetailHelpers.test.ts` и `staffReviewsSection.test.tsx`.
  - [x] Сам `StaffDetailPageClient.tsx` переключён на вынесенный reviews-блок и helper-слой.
  - [x] `StaffDetailPageClient.tsx` теперь считается `thin enough` для этой волны.

- Почему кандидат:
  - раньше файл держал и большой presentation-блок, и rating/reviews semantics;
  - reviews были хорошим отдельным узлом для выноса без риска ломать остальной экран;
  - здесь было важно явно зафиксировать момент остановки, чтобы не уйти в бесконечный polishing.

- Что уже можно считать стабилизированным:
  - helper-слой вокруг rating/reviews уже покрыт тестами;
  - reviews presentation уже вынесен и может дорабатываться отдельно от большого container-файла.

- Итог для этой волны:
  - reviews/rating слой больше не живёт большим встроенным блоком внутри container-файла;
  - следующий возврат к этому экрану нужен только если появится новая отдельная боль, а не ради косметического дробления.

### 14. `apps/mobile/src/screens/ProfileScreen.tsx`

- Текущий прогресс:
  - [x] Экранные типы вынесены в `profile/types.ts`.
  - [x] Чистые form/update helpers вынесены в `profile/helpers.ts`.
  - [x] Screen styles вынесены в `profile/styles.ts`.
  - [x] Loading state вынесен в `ProfileScreenState.tsx`.
  - [x] Personal info section вынесена в `ProfilePersonalInfoSection.tsx`.
  - [x] Notifications section вынесена в `ProfileNotificationsSection.tsx`.
  - [x] Actions section вынесена в `ProfileActionsSection.tsx`.
  - [x] Data/mutation/sign-out orchestration вынесены в `useProfileScreen.ts`.
  - [x] Добавлен unit-suite `profileHelpers.unit.test.ts`.
  - [x] Подготовлен screen-level smoke suite `ProfileScreen.test.tsx`.
  - [x] `ProfileScreen.tsx` уже сведён к container-уровню и считается `thin enough` для этой волны.

- Почему кандидат:
  - в одном экране были одновременно auth query, profile query, mutation, локальный form state, sign-out side effect и весь presentation слой;
  - это классический случай, где container-screen быстро становится хрупким даже без большого размера файла;
  - профиль пользователя часто меняется и является хорошей зоной для аккуратной секционной декомпозиции.

- Что уже стабилизировано:
  - чистая логика формы и payload normalization уже покрыта тестом;
  - сам `ProfileScreen.tsx` теперь не держит внутри сетевой и mutation orchestration.
  - render smoke suite уже подготовлен, но его прогон пока упирается в общий RN Jest env, а не в сам экран.

- Итог для этой волны:
  - экран уже не смешивает query, mutation, local form state и весь UI в одном файле;
  - возвращаться к нему имеет смысл только если будем отдельно чинить mobile RN test env или появится новая продуктовая сложность.

### 15. `apps/mobile/src/screens/DashboardScreen.tsx`

- Текущий прогресс:
  - [x] Экранные типы вынесены в `dashboard/types.ts`.
  - [x] Чистые helper'ы вынесены в `dashboard/helpers.ts`.
  - [x] Screen styles вынесены в `dashboard/styles.ts`.
  - [x] Data/query orchestration вынесен в `useDashboardScreen.ts`.
  - [x] Loading / not-owner / empty states вынесены в `DashboardScreenState.tsx`.
  - [x] Header вынесен в `DashboardHeader.tsx`.
  - [x] Business card/list вынесены в `DashboardBusinessCard.tsx` и `DashboardBusinessListSection.tsx`.
  - [x] Добавлен unit-suite `dashboardHelpers.unit.test.ts`.
  - [x] Подготовлен screen-level smoke suite `DashboardScreen.test.tsx`.
  - [x] `DashboardScreen.tsx` уже сведён к container-уровню и считается `thin enough` для этой волны.

- Почему кандидат:
  - в одном экране были одновременно auth-derived query state, owner check, refresh lifecycle, loading/empty branches и весь UI список бизнесов;
  - это типичный экран, который быстро становится хрупким даже при небольшом размере, если не отделить screen state от presentation;
  - после выноса `ProfileScreen` и `CabinetScreen` это был естественный следующий mobile-узел по отдаче.

- Что уже стабилизировано:
  - subtitle/primary-phone mapping вынесены в отдельный helper-слой и покрыты тестом;
  - сам экран больше не держит внутри `useQuery` и screen-state ветки;
  - `DashboardScreen.tsx` теперь читается как container с refresh wiring и сборкой секций.
  - render-level smoke suite уже подготовлен, но его прогон пока упирается в общий RN Jest env, а не в сам экран.

- Что осталось на следующий проход:
  - отдельный возврат нужен только если будем чинить общий mobile RN test env или появится новая продуктовая сложность.

### 16. `apps/mobile/src/screens/BookingScreen.tsx`

- Текущий прогресс:
  - [x] Init helper для auto-select branch вынесен в `booking/bookingInitHelpers.ts`.
  - [x] Data/query/init orchestration вынесен в `booking/useBookingScreenInit.ts`.
  - [x] Добавлен unit-suite `bookingInitHelpers.unit.test.ts`.
  - [x] Подготовлен screen-level smoke suite `BookingScreen.test.tsx`.
  - [x] `BookingScreen.tsx` больше не держит внутри init-fetch, analytics и контекстную инициализацию.
  - [x] `BookingScreen.tsx` теперь считается `thin enough` для этой волны.

- Почему кандидат:
  - это entry-point публичного mobile booking flow, и внутри него раньше были одновременно route params, init-fetch, analytics и применение данных к booking context;
  - файл не был гигантским, но держал критичную orchestration-логику в самом screen-компоненте;
  - это хорошее место для аккуратного выравнивания без тяжёлого риска.

- Что уже стабилизировано:
  - бизнесовая инициализация booking flow теперь сидит в отдельном hook;
  - auto-select единственного филиала теперь выражен отдельным helper'ом и покрыт тестом;
  - сам экран сведён к route param wiring + рендеру первого шага.
  - render-level smoke suite уже подготовлен, но его прогон пока упирается в общий RN Jest env, а не в сам экран.

- Что осталось на следующий проход:
  - отдельный возврат нужен только если будем чинить общий mobile RN test env или появится новая сложность в самом booking entry flow.

### 17. `apps/web/src/app/cabinet/components/ProfileForm.tsx`

- Текущий прогресс:
  - [x] Чистые преобразования профиля вынесены в `profileFormHelpers.ts`.
  - [x] Загрузка профиля, submit, OTP и telegram callbacks вынесены в `useProfileForm.ts`.
  - [x] Добавлен helper-suite `profileFormHelpers.test.ts`.
  - [x] Сам `ProfileForm.tsx` больше не держит внутри полный data/mutation orchestration.
  - [x] Phone block вынесен в `ProfilePhoneField.tsx`.
  - [x] Notification/telegram block вынесен в `ProfileNotificationSettings.tsx`.
  - [x] `ProfileForm.tsx` теперь считается `thin enough` для этой волны.

- Почему кандидат:
  - в одном компоненте были сразу profile load, update submit, OTP-ветка, telegram-link callbacks и большой form UI;
  - это чувствительный пользовательский кабинетный поток, где хочется снижать связанность без агрессивного переписывания;
  - хороший кандидат на безопасную декомпозицию с быстрыми тестовыми страховками.

- Что уже стабилизировано:
  - mapping профиля, payload normalization и OTP sanitization вынесены в отдельный helper-слой и покрыты тестом;
  - `ProfileForm.tsx` теперь читаетcя как form/presentation component с thin hook-обвязкой;
  - telegram already-linked check теперь оформлен отдельным helper'ом, а не рассыпан прямой строковой проверкой по компоненту.
  - крупные form-секции больше не живут цельным монолитным JSX внутри одного файла.

- Что осталось на следующий проход:
  - отдельный возврат нужен только если появится новая продуктовая сложность в cabinet profile flow.

### 18. `apps/web/src/app/dashboard/components/DashboardHomeClient.tsx`

- Текущий прогресс:
  - [x] Чистые display/date helper'ы вынесены в `dashboardHomeHelpers.ts`.
  - [x] Экранные типы вынесены в `dashboardHomeTypes.ts`.
  - [x] Hero-секция вынесена в `DashboardHeroSection.tsx`.
  - [x] Onboarding-секция вынесена в `DashboardOnboardingSection.tsx`.
  - [x] KPI-grid вынесен в `DashboardKpiGrid.tsx`.
  - [x] Rating-секция вынесена в `DashboardRatingSection.tsx`.
  - [x] Quick actions вынесены в `DashboardQuickActionsSection.tsx`.
  - [x] Добавлен helper-suite `dashboardHomeHelpers.test.ts`.
  - [x] `DashboardHomeClient.tsx` теперь считается `thin enough` для этой волны.

- Почему кандидат:
  - в одном компоненте раньше одновременно жили locale/date formatting, default business naming, onboarding hints, KPI cards, rating presentation и quick actions;
  - это типичный dashboard-монолит, где особенно быстро смешиваются orchestration и крупный JSX;
  - узел хорошо подходил для безопасной секционной декомпозиции без риска затронуть бизнес-логику.

- Что уже удалось:
  - оставить в `DashboardHomeClient.tsx` только language wiring и сборку секций;
  - вынести чистые функции в отдельный helper-слой с unit-проверкой;
  - отделить onboarding/rating/KPI/quick actions так, чтобы следующий продуктовый апдейт не требовал чтения всего файла целиком.

- Что осталось на следующий проход:
  - отдельный возврат нужен только если домашний dashboard снова начнёт быстро расти по новым продуктовым секциям.

### 19. `apps/web/src/app/cabinet/components/BookingCard.tsx`

- Текущий прогресс:
  - [x] Чистые display/status/date helper'ы вынесены в `bookingCardHelpers.ts`.
  - [x] Screen-level state и side effects вынесены в `useBookingCard.ts`.
  - [x] Header/status block вынесен в `BookingCardHeader.tsx`.
  - [x] Timeline block вынесен в `BookingCardTimelineSection.tsx`.
  - [x] Actions block вынесен в `BookingCardActions.tsx`.
  - [x] Добавлен helper-suite `bookingCardHelpers.test.ts`.
  - [x] `BookingCard.tsx` теперь считается `thin enough` для этой волны.

- Почему кандидат:
  - раньше в одном компоненте жили locale/date formatting, repeat booking state persistence, cancel mutation, review dialog state, timeline mapping и весь presentation слой;
  - это чувствительная кабинетная карточка, где быстро смешиваются screen state и большой условный JSX;
  - хороший кандидат на разрез по `hook + helpers + sections` без тяжелого переписывания сценариев.

- Что уже удалось:
  - оставить в `BookingCard.tsx` только сборку данных и диалогов;
  - вынести repeat/cancel/review side effects в отдельный hook;
  - уменьшить связанность между timeline/status formatting и action-кнопками.

- Что осталось на следующий проход:
  - отдельный возврат нужен только если кабинетная карточка снова начнёт обрастать новыми сценариями вроде reschedule или richer review flow.

Р“Р»Р°РІРЅС‹Рµ РєР°РЅРґРёРґР°С‚С‹ СЃРµР№С‡Р°СЃ Р»РµР¶Р°С‚ РІ С‚СЂС‘С… Р·РѕРЅР°С…:

- staff finance;
- schedule/dashboard screens;
- РєСЂСѓРїРЅС‹Рµ mobile screens Рё РёРЅС‚РµРіСЂР°С†РёРѕРЅРЅС‹Рµ webhook routes.

Р­С‚Рѕ С…РѕСЂРѕС€РёР№ РїСЂРёР·РЅР°Рє: РїСЂРѕРµРєС‚Сѓ РЅРµ РЅСѓР¶РµРЅ Р°Р±СЃС‚СЂР°РєС‚РЅС‹Р№ вЂњС‚РѕС‚Р°Р»СЊРЅС‹Р№ СЂРµС„Р°РєС‚РѕСЂРёРЅРівЂќ, РµРјСѓ РЅСѓР¶РЅР° РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅР°СЏ СЂР°Р·РіСЂСѓР·РєР° РЅРµСЃРєРѕР»СЊРєРёС… С‚СЏР¶С‘Р»С‹С… С‚РѕС‡РµРє, РіРґРµ СѓР¶Рµ РІРёРґРЅРѕ СЃРјРµС€РµРЅРёРµ orchestration, РІС‹С‡РёСЃР»РµРЅРёР№, СЃРµС‚РµРІРѕРіРѕ СЃР»РѕСЏ Рё UI.


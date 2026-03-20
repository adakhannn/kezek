# Booking Screen State Decision

Дата: 2026-03-18

## Решение

Для `apps/web/src/app/b/[slug]/view.tsx` отдельный `state machine` или глобальный `store` сейчас не нужен.

Текущая структура экрана уже достаточно выровнена:

- orchestration и URL/localStorage синхронизация вынесены в `useBookingSelectionState`
- правила переходов по шагам вынесены в `useBookingSteps`
- аналитика вынесена в `useBookingAnalytics`
- auth bootstrap вынесен в `useBookingAuthState`
- refresh-key и visibility refresh вынесены в `useSlotsRefreshKey`
- post-filtering слотов вынесено в `useBookingVisibleSlots`

В самом `view.tsx` остались в основном:

- композиция hooks
- вычисление display-level derived values
- локальное modal/UI state:
  - `authChoiceModalOpen`
  - `selectedSlotTime`
  - `selectedSlotStaffId`

## Почему не нужен store/state machine сейчас

- Основной flow уже выражен через специализированные hooks, а не через хаотичный набор `useState`.
- Оставшийся локальный state небольшой и UI-ориентированный.
- Нет признаков сложной конкурентной оркестрации, которая оправдывала бы `xstate`, Zustand или отдельный reducer-store.
- Введение store сейчас увеличит количество абстракций быстрее, чем снизит сложность.

## Когда решение нужно пересмотреть

Стоит вернуться к state machine/store, если появится хотя бы один из сигналов:

- booking flow станет нелинейным с ветвлениями, возвратами и guard-условиями между шагами
- появятся несколько независимых modal/auth/promo/upsell сценариев с пересекающимися переходами
- один и тот же screen state понадобится нескольким компонентам вне текущего orchestration-layer
- появятся race conditions между auth, slot refresh, booking creation и restore-from-URL flow
- `view.tsx` снова начнёт забирать в себя доменные правила вместо координации hooks

## Рекомендация

Оставить текущую модель:

- локальный UI state через `useState`
- flow rules в hooks/helpers
- без отдельного глобального store

Если сложность вырастет, следующий шаг лучше делать через scoped reducer/state machine именно для booking-flow, а не через общий app-wide store.

# Аудит ручного кеширования и query abstraction

**Дата проверки:** 2026-03-19  
**Источник правды:** CLIENT_DATA_FETCHING_STANDARD.md и актуальный client fetching code  
**Когда пересматривать:** при следующей миграции manual cache/query-layer или при появлении новых исключений


**Статус:** актуален  
**Цель:** зафиксировать, где ручное client-side кеширование и `useEffect + fetch/debounce` действительно оправданы, а где проекту лучше перейти на `React Query`.

---

## 1. Общий вывод

В проекте `React Query` уже является основным способом работы с client-side server state и должен оставаться дефолтным выбором.

Ручное кеширование и кастомный fetch orchestration сейчас нужны только в ограниченном числе мест. Они не должны рассматриваться как шаблон для нового кода.

---

## 2. Где ручное кеширование действительно оправдано

### `apps/web/src/app/b/[slug]/hooks/useSlotsLoader.ts`

**Решение:** временно оставить как инфраструктурное исключение с дальнейшей отдельной ревизией.

Почему это пока допустимо:

- это hot-path публичного booking-flow;
- там есть короткоживущий cache с TTL;
- есть debounce при быстром переключении branch/service/staff/day;
- есть локальная защита от лишних повторных запросов и race conditions;
- там смешаны не только загрузка, но и специфичный slot orchestration.

Почему это всё ещё кандидат на миграцию:

- в одном hook смешаны `fetch`, cache policy, debounce, post-processing и domain filtering;
- слой сложнее поддерживать, чем query abstraction;
- этот код уже выделен следующей волной в roadmap.

Текущее решение:

- пока оставить как осознанное исключение;
- не копировать этот паттерн в новый код;
- отдельно пересмотреть в блоке `7.2`.

### `apps/web/src/app/staff/finance/hooks/useShiftItems.ts`

**Решение:** оставить ручной orchestration-слой, но не считать его аргументом против `React Query`.

Почему это допустимо:

- это mutation-heavy autosave сценарий;
- там есть debounce, abort, rollback и защита от дублирующихся сохранений;
- ключевая сложность здесь не в чтении данных, а в управлении локальным черновиком и сохранением.

Практический вывод:

- этот участок требует декомпозиции;
- но переводить его целиком на `useQuery` как на источник истины сейчас не является приоритетом;
- query layer здесь должен оставаться рядом для серверных snapshot/refetch, а не заменять весь autosave workflow.

---

## 3. Где лучше перейти на query abstraction

### `apps/web/src/app/dashboard/bookings/components/useQuickDeskClient.ts`

**Решение:** кандидат на перевод на `React Query`.

Почему:

- это обычный search/read flow;
- сейчас используется ручной `useEffect + setTimeout + fetch`;
- локального cache ownership здесь фактически нет;
- сценарий хорошо ложится на `useQuery` с `enabled`, debounced input и управляемым refetch.

### `apps/web/src/app/admin/users/UsersClient.tsx`

**Решение:** кандидат на перевод на `React Query`.

Почему:

- поиск/список пользователей сейчас живёт через ручной debounce и отдельный fetch lifecycle;
- это типичный query-case без особого hot-path поведения;
- здесь ценность ручного orchestration низкая.

### `apps/web/src/app/admin/businesses/[id]/members/new/NewMemberExisting.tsx`

**Решение:** кандидат на перевод на `React Query`.

Почему:

- это обычный поиск существующих пользователей;
- ручной debounce здесь не даёт архитектурного выигрыша;
- query abstraction упростит loading/error/refetch.

### Похожие search/list формы в dashboard/admin

**Решение:** новые и постепенно обновляемые search/list flows должны идти через `React Query`, если это не mutation-driven локальный wizard.

---

## 4. Где ручной fetch допустим без отдельного кеша

Не каждый прямой `fetch` является архитектурной проблемой.

Допустимо оставлять ручной `fetch`, если это:

- простая `mutation` из формы или кнопки;
- единичное действие без долгоживущего server state;
- service-интеграция или runtime effect, не претендующий на shared query cache.

Типичные примеры:

- submit/update/delete в admin-формах;
- auth callback flows;
- notification / integration actions;
- mobile auth runtime.

Эти места не требуют обязательной миграции на `React Query`, если там нет повторно используемого query-state.

---

## 5. Что считать правилом на будущее

Новый код должен выбирать `React Query`, если:

- данные читаются с сервера и потом переиспользуются;
- есть loading/error/refetch/invalidation lifecycle;
- те же данные важны в нескольких компонентах или после mutation.

Ручной cache/debounce orchestration допустим только если:

- это реально hot-path или autosave-special-case;
- у участка есть явное объяснение, почему query layer не берётся;
- владелец кеша и invalidation strategy понятны из кода.

---

## 6. Приоритет следующих шагов

1. Отдельно пересмотреть `useSlotsLoader.ts` и решить, что останется special-case, а что можно вынести из него в reusable/query-friendly слой.
2. Перевести `useQuickDeskClient.ts` на query abstraction.
3. По мере касания переводить search/list flows в `admin` и `dashboard` с ручного `useEffect + fetch` на `React Query`.

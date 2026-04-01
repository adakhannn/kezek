# E2E Тесты для критичных пользовательских сценариев

## Обзор

E2E тесты используют Playwright для тестирования полных пользовательских сценариев в браузере.

**Правило:** при добавлении новых важных пользовательских сценариев добавляйте соответствующие E2E в `apps/web/e2e/`. Уже покрыты: бронирование (в т.ч. с гостем), QuickDesk (смена статусов), смены и финансы сотрудника, промо, пакеты визитов, споры по финансам, перерасчёт часов. См. также чеклист в [CONTRIBUTING.md](../../../CONTRIBUTING.md).

## Установка

```bash
cd apps/web
pnpm install
```

## Настройка

Создайте файл `.env.local` в `apps/web/` с тестовыми данными:

```env
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
E2E_TEST_BUSINESS_SLUG=test-business-slug
E2E_TEST_STAFF_EMAIL=staff@test.com
E2E_TEST_STAFF_PASSWORD=test-password
```

Важно:
- grouped E2E сценарии больше не используют fallback-значения вроде `manager@test.com` или `test-business`
- если обязательные env vars не заданы, соответствующий spec теперь должен считаться неподготовленным к запуску в данной среде
- для grouped `auth-required` и `seed-required` specs missing env теперь приводят к явному suite-level `skip`, а не к позднему падению внутри шага
- повторяющийся sign-in/bootstrap код теперь нужно выносить в `authHelpers.ts`, а env preflight и base-url helpers держать в `testEnv.ts`

### Env contract по группам

`smoke`
- не требует seeded данных или тестовых учёток

`http`
- не требует seeded browser state

`auth-required`
- `E2E_TEST_MANAGER_EMAIL`
- `E2E_TEST_SUPER_ADMIN_EMAIL`
- `E2E_TEST_MULTI_ROLE_EMAIL`
- `E2E_TEST_STAFF_EMAIL`
- `E2E_TEST_STAFF_PASSWORD`

`seed-required`
- `E2E_TEST_BUSINESS_SLUG`
- `E2E_TEST_BUSINESS_ID`
- `E2E_TEST_BRANCH_ID`
- `E2E_TEST_STAFF_ID`
- `E2E_TEST_CLIENT_SEARCH`
- плюс нужные auth env vars для сценариев, где есть вход под менеджером или сотрудником

## Запуск тестов

```bash
# Запустить стабильный smoke-набор без seeded данных
pnpm test:e2e:smoke

# Запустить HTTP-only webhook e2e
pnpm test:e2e:http

# Запустить auth/role сценарии
pnpm test:e2e:auth-required

# Запустить сценарии, которым нужны seeded данные бизнеса
pnpm test:e2e:seed-required

# Запустить все E2E тесты
pnpm test:e2e

# Запустить с UI (интерактивный режим)
pnpm test:e2e:ui

# Запустить в видимом браузере
pnpm test:e2e:headed

# Запустить конкретный тест
pnpm test:e2e e2e/booking-flow.spec.ts
```

## Тестовые сценарии

### Smoke browser gate (`smoke-public.spec.ts`)

Минимальный стабильный набор для CI без seeded данных и тестовых учёток:
- страница входа `/auth/sign-in`
- страница условий `/terms`
- страница конфиденциальности `/privacy`

Для стабильности smoke-набор запускается с `--workers=1`.

### Auth-required flows

Сценарии, которым нужны тестовые учётки и роли:
- `quickdesk.spec.ts`
- `ratings-admin-flow.spec.ts`
- `role-switching.spec.ts`
- `shift-management.spec.ts`

### Seed-required flows

Сценарии, которым нужны подготовленные бизнес-данные, branch/staff ids или стабильный seeded slug:
- `booking-flow.spec.ts`
- `branch-map.spec.ts`
- `error-recovery.spec.ts`
- `finance-disputes-verification.spec.ts`
- `hours-worked-recalculation.spec.ts`
- `promotion-application.spec.ts`
- `staff-finance-pages.spec.ts`
- `visit-packages-flow.spec.ts`
- `visual-regressions.spec.ts`

### HTTP-only E2E

Минимальный request-level сценарий без браузерной UI-навигации:
- `whatsapp-webhook.spec.ts`

Этот сценарий тоже запускается с `--workers=1`, чтобы не плодить лишнюю параллельность вокруг локального dev server.

### 1. Полный цикл бронирования (`booking-flow.spec.ts`)

Тестирует полный процесс бронирования:
- Выбор филиала
- Выбор мастера
- Выбор услуги
- Выбор даты и времени
- Заполнение данных клиента
- Подтверждение бронирования

**Расширенный сценарий — бронирование с гостем (без регистрации):**
- Прохождение шагов до выбора времени
- При появлении модалки выбора — «Запись без регистрации»
- Заполнение имени и телефона в форме гостя
- Подтверждение и проверка успешного бронирования

### 2. Управление сменой / финансы сотрудника (`shift-management.spec.ts`)

Один сценарий «финансы сотрудника»: **открытие смены → клиенты → закрытие**.
- Открытие смены сотрудником
- Добавление клиентов в смену
- Закрытие смены с расчётом финансов

### 3. Применение промо (`promotion-application.spec.ts`)

Тестирует применение промоакций:
- Отображение промоакций на странице
- Применение промо при бронировании
- Проверка скидки в итоговой сумме
- Happy-path: применение промо с процентной скидкой
- Happy-path: применение промо типа "бесплатно"
- Edge-case: промо с истекшим сроком действия
- Edge-case: промо с ограниченным количеством использований
- Edge-case: проверка возможности применения нескольких промо
- Edge-case: промо с условием минимальной суммы заказа

### 4. QuickDesk - управление бронированиями (`quickdesk.spec.ts`)

Тестирует работу с QuickDesk (быстрое управление бронированиями):
- Создание бронирования через QuickDesk
- Изменение бронирования
- Отмена бронирования
- Отметка посещения (пришёл / не пришёл)
- **Смена статусов:** подтверждение брони (hold → confirmed), затем отметка посещения (confirmed → paid / no_show)
- Happy-path: создание бронирования для существующего клиента
- Edge-case: ошибка при создании бронирования без выбора мастера
- Edge-case: ошибка при выборе прошедшей даты
- Edge-case: быстрое создание нескольких бронирований подряд

### 5. Корректировка hours_worked и перерасчёт (`hours-worked-recalculation.spec.ts`)

Тестирует корректировку отработанных часов и перерасчёт финансов:
- Обновление `hours_worked` для закрытой смены
- Проверка автоматического перерасчёта `guaranteed_amount`
- Проверка перерасчёта `master_share` и `salon_share` при изменении `hours_worked`
- Проверка `topup_amount` (доплата, если `guaranteed_amount > master_share`)
- Валидация отрицательных и слишком больших значений `hours_worked`
- Проверка, что нельзя изменить `hours_worked` для открытой смены

### 6. Пакеты визитов (`visit-packages-flow.spec.ts`)

Полный сценарий пакетов визитов:
- Создание типа пакета в дашборде (форма с `data-testid="visit-package-plan-form"`)
- QuickDesk: выбор существующего клиента, продажа пакета (модалка), создание бронирования
- Отметка посещения «Пришел» во вкладке «Список»
- Проверка остатка в «Проданные пакеты» (`sold-packages-table`, `sold-package-row`)
- Опционально при `E2E_TEST_CLIENT_EMAIL`: вход как клиент, проверка «Оплачено пакетом» и «Мои пакеты»

Требует тестовый бизнес с филиалами/услугами; опционально `E2E_TEST_CLIENT_SEARCH`, `E2E_TEST_CLIENT_EMAIL`.

### 7. Проверка совпадения сумм (споры) (`finance-disputes-verification.spec.ts`)

Тестирует корректность финансовых расчётов и совпадение сумм:
- Проверка совпадения сумм в UI с данными после закрытия смены
- Проверка корректности записи операций при добавлении/изменении клиентов
- Проверка совпадения итоговых сумм (`master_share`, `salon_share`) с данными из БД
- Проверка истории изменений в логах при корректировке `hours_worked`

## Настройка тестовой базы данных

Для корректной работы E2E тестов рекомендуется:

1. Создать отдельную тестовую базу данных
2. Настроить seed данные (тестовый бизнес, филиалы, услуги, промоакции)
3. Очищать данные перед/после каждого теста

## Селекторы

Тесты используют `data-testid` атрибуты для поиска элементов. Убедитесь, что в UI компонентах добавлены соответствующие атрибуты:

```tsx
<button data-testid="branch-select">Выбрать филиал</button>
<div data-testid="master-card">...</div>
```

## Отладка

- Используйте `await page.pause()` для остановки выполнения
- Запускайте тесты в headed режиме: `pnpm test:e2e:headed`
- Просматривайте скриншоты и видео в `test-results/`
- Используйте Playwright Inspector: `pnpm test:e2e:ui`

## CI/CD

E2E тесты автоматически запускаются в CI pipeline. Убедитесь, что:
- Тестовая база данных доступна
- Переменные окружения настроены
- Тестовые данные подготовлены


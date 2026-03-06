# STAGING_ENVIRONMENT.md — staging-окружение Kezek

Этот документ описывает, как организовать отдельное **staging‑окружение** для тестирования перед выкатыванием в прод:

- отдельный проект Supabase (отдельная БД),
- отдельные env‑переменные и URL,
- деплой по отдельной ветке или тегам.

## 1. Цели staging

- Проверять миграции БД и новые фичи на окружении, максимально похожем на прод.
- Гонять E2E‑тесты и ручной регрессионный тест перед релизом.
- Избежать влияния тестовых данных и экспериментов на боевых пользователей.

---

## 2. Staging‑БД (Supabase)

1. **Создайте отдельный проект Supabase** для staging (отдельный project ref и URL).
2. **Примените те же миграции**, что и для prod:
   - следуйте `supabase/APPLY_MIGRATIONS.md` (через SQL Editor или `supabase db push`);
   - придерживайтесь того же порядка миграций, что и для боевой БД.
3. **Инициализируйте тестовые данные**:
   - используйте `supabase/seed.sql` или отдельные SQL‑скрипты;
   - убедитесь, что есть хотя бы один тестовый бизнес, филиал, сотрудник и набор услуг для прогонов E2E.

Важно: staging‑проект Supabase должен жить **совершенно отдельно** от prod (другой project ref, другой набор ключей и URL).

---

## 3. Env‑переменные для staging

Базовый справочник по env: `ENV_GUIDE.md`. Для staging используйте отдельные файлы/env‑наборы:

- **Web (`apps/web`)**:
  - локально можно завести `apps/web/.env.staging.local` (по аналогии с `.env.local`);
  - на хостинге (например, Vercel/Render/другой провайдер) заведите отдельный проект/окружение `staging` и заполните env так же, как для prod, но:
    - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — от staging‑проекта Supabase;
    - `SUPABASE_SERVICE_ROLE_KEY` — отдельный ключ от staging‑проекта;
    - `NEXT_PUBLIC_SITE_ORIGIN` — URL staging‑сайта (например, `https://staging.kezek.kg`).

- **Mobile (`apps/mobile`)**:
  - используйте отдельный `.env.local` для подключения к staging‑API и staging‑Supabase:
    - `EXPO_PUBLIC_SUPABASE_URL` — URL staging‑проекта Supabase;
    - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — anon‑ключ staging;
    - `EXPO_PUBLIC_API_URL` — URL staging‑сайта.

### E2E‑тесты против staging

В `ci.yml` E2E‑тесты читают базовый URL из:

- `PLAYWRIGHT_TEST_BASE_URL` (`secrets.E2E_TEST_BASE_URL`).

Для прогонов по staging:

- установите `E2E_TEST_BASE_URL` в GitHub Secrets равным URL staging‑сайта;
- задайте тестовые логин/пароль/slug для staging‑данных (`E2E_TEST_*` secrets).

---

## 4. Стратегия деплоя по ветке/тегам

Рекомендуемая схема:

- **ветка `main`** → деплой на **prod**;
- **ветка `staging`** → деплой на **staging**.

Альтернатива — использовать **теги**:

- теги вида `staging-*` запускают деплой на staging;
- теги вида `release-*` используются для релизных сборок (см. `mobile_build` в `ci.yml`).

Конкретная реализация (Vercel, Docker‑деплой, собственный runner) зависит от выбранного хостинга:

- в большинстве провайдеров можно настроить:
  - auto‑deploy ветки `staging` в отдельный проект/окружение;
  - auto‑deploy ветки `main` в прод;
  - отдельные env‑наборы для каждого окружения.

---

## 5. Чек‑лист перед релизом

1. Все миграции применены на staging‑БД.
2. Web‑приложение на staging успешно собирается и открывается.
3. E2E‑тесты проходят против staging‑URL (ночные/ручные прогоны).
4. Ключевые регрессионные сценарии (публичное бронирование, кабинет клиента, staff‑кабинет, админка) проверены вручную или через автоматизированные тесты.

Документ дополняет `ENV_GUIDE.md`, `supabase/APPLY_MIGRATIONS.md` и `.github/workflows/ci.yml` и описывает именно **логическое разделение staging/prod**.


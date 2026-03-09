# Единый гайд по переменным окружения

В проекте Kezek два приложения с разными наборами переменных: **web** (Next.js) и **mobile** (Expo). Ниже — один основной гайд; специфичные интеграции (WhatsApp, Telegram) вынесены в отдельные документы со ссылками.

---

## Общие правила

- Файлы `.env.local` **не коммитятся** в git (указаны в `.gitignore`).
- Шаблоны: `apps/web/.env.example` и `apps/mobile/.env.example` — скопируйте в `.env.local` в соответствующей папке и заполните значения.
- Секреты (токены, ключи) не публикуйте в репозитории и не вставляйте в issue/PR.

---

## 1. Web (`apps/web`)

### 1.1. Минимальный набор для запуска

1. Скопируйте шаблон:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```
2. Заполните в `apps/web/.env.local` минимум:

| Переменная | Описание |
|------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase (Dashboard → Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon-ключ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role ключ (только для сервера) |
| `NEXT_PUBLIC_SITE_ORIGIN` | Origin сайта, например `http://localhost:3000` |
| `RESEND_API_KEY` | Ключ Resend для email (без него часть уведомлений не работает) |
| `EMAIL_FROM` | Адрес отправителя писем |

### 1.2. Полный список переменных (web)

Ниже приведён консолидированный список ключевых переменных web-приложения. Актуальный и исчерпывающий перечень всегда можно посмотреть в **`apps/web/.env.example`**.

| Переменная | Где используется | Обязательно | Описание / комментарий |
|-----------|------------------|------------|------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | клиент и сервер (`createBrowserSupabaseClient`, `createServerClient`) | Да | URL проекта Supabase (Dashboard → Settings → API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | клиент и сервер | Да | Публичный anon-ключ Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | серверный код (`apps/web/src/lib/supabaseAdmin.ts`, cron, миграции) | Да (prod) | Service Role ключ, обходит RLS. **Только на сервере**, никогда не в client components. |
| `NEXT_PUBLIC_SITE_ORIGIN` | ссылки в письмах, редиректы, метрики | Рекомендуется | Origin сайта, напр. `http://localhost:3000` или боевой домен. |
| `RESEND_API_KEY` | отправка email (уведомления, подтверждения) | Да, если включены email-уведомления | Ключ Resend. |
| `EMAIL_FROM` | отправка писем | Нет (есть дефолт) | Адрес отправителя, по умолчанию `Kezek <noreply@mail.kezek.kg>`. |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp webhooks/отправка сообщений | Опционально | Токен Business Cloud API; без него WhatsApp-интеграция не работает. |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp webhooks/отправка сообщений | Опционально | ID номера WhatsApp. |
| `NEXT_PUBLIC_TZ` | форматирование дат/времени | Нет (есть дефолт) | Часовой пояс по умолчанию, например `Asia/Bishkek`. |
| `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` | страница филиала с картой (админка) | Опционально | API-ключ Яндекс.Карт; без него карта может быть недоступна. |

Дополнительные переменные для логирования, Redis, cron-задач, e2e и интеграций описаны в `apps/web/.env.example` и в профильных документах.

### 1.3. Опциональные интеграции (web)

- **WhatsApp** — уведомления и авторизация: [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md)
- **Telegram** — бот для уведомлений и вход через Telegram: [TELEGRAM_AUTH_IMPLEMENTATION.md](TELEGRAM_AUTH_IMPLEMENTATION.md)

Переменные для этих интеграций перечислены в `.env.example`; детальная настройка — в указанных гайдах.

### 1.4. Синхронизация .env.local и переменных на проде (Vercel)

**Идея:** один и тот же **набор имён** переменных — локально в `apps/web/.env.local`, на проде — в Vercel. Значения разные (локально dev-ключи, на проде — боевые).

**Шаг 1 — источник истины по именам**

- Список переменных: **`apps/web/.env.example`**.  
- При добавлении новой переменной в проект: добавь её в `.env.example` (значение можно оставить пустым или с плейсхолдером).

**Шаг 2 — локально**

- Скопируй актуальный шаблон при необходимости:  
  `cp apps/web/.env.example apps/web/.env.local`
- Заполни в `.env.local` значения для разработки (Supabase dev, тестовые ключи и т.д.).

**Шаг 3 — прод (Vercel)**

1. Vercel Dashboard → твой проект → **Settings** → **Environment Variables**.
2. Добавь те же **имена** переменных, что и в `.env.example`, с **продакшен-значениями** (боевой Supabase, боевые ключи Resend, Yandex и т.д.).
3. Укажи окружения: **Production** (и при необходимости Preview, Development).
4. После изменения переменных сделай **Redeploy** последнего деплоя, чтобы новые значения подхватились.

**Чеклист «ничего не забыл на проде»**

- Открой `apps/web/.env.example` и пройдись по списку переменных.
- В Vercel → Settings → Environment Variables проверь, что для каждой переменной, нужной в проде, есть запись с правильным окружением (Production).
- Особенно проверь: `NEXT_PUBLIC_*` (попадают в клиент), `SUPABASE_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`, `CRON_SECRET` / `VERCEL_CRON_SECRET`, при использовании — WhatsApp/Telegram/Sentry.

**Важно**

- Файл `.env.local` **не коммитить** и не выкладывать в репозиторий.
- На проде хранить секреты только в Vercel (или в другом хранилище секретов вашего хостинга), не в коде.

---

## 2. Mobile (`apps/mobile`)

### 2.1. Требуемые переменные

| Переменная | Где используется | Обязательно | Описание |
|------------|------------------|------------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | клиентское мобильное приложение | Да | URL проекта Supabase. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | клиентское мобильное приложение | Да | Публичный anon-ключ Supabase. |
| `EXPO_PUBLIC_API_URL` | HTTP‑запросы из mobile в web API | Да | URL веб-приложения (`https://kezek.kg` или dev-окружение/туннель). |

### 2.2. Где взять значения

- **Supabase:** [Supabase Dashboard](https://app.supabase.com/) → проект → **Settings** → **API** → Project URL и anon public key.
- **API URL:** ваш продакшен или tunnel веб-приложения.

### 2.3. Настройка через `.env.local` (рекомендуется для разработки)

1. Создайте файл в папке приложения:
   ```bash
   cp apps/mobile/.env.example apps/mobile/.env.local
   ```
2. Заполните значения в `apps/mobile/.env.local` (без кавычек, без пробелов вокруг `=`):
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   EXPO_PUBLIC_API_URL=https://kezek.kg
   ```
3. Перезапустите Expo **с очисткой кэша**:
   ```bash
   cd apps/mobile
   npx expo start --clear
   ```
   Флаг `--clear` обязателен — Metro кэширует переменные окружения.

**Важно для Expo:**

- Переменные должны начинаться с **`EXPO_PUBLIC_`**, иначе они не попадут в клиент.
- Файл должен быть именно **`apps/mobile/.env.local`**, не в корне проекта.

### 2.4. Альтернативы для продакшена

- **EAS Secrets:** `eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "..."` (и аналогично для остальных).
- **app.json → extra:** можно задать `supabaseUrl`, `supabaseAnonKey`, `apiUrl` в `expo.extra`, но значения попадут в сборку — не храните там секреты.

Подробнее про EAS и сборки — в [apps/mobile/README.md](apps/mobile/README.md).

### 2.5. Если переменные не подхватываются (troubleshooting)

1. **Формат `.env.local`:**
   - Нет пробелов вокруг `=`
   - Нет кавычек вокруг значений
   - Каждая переменная на отдельной строке
   - Все переменные с префиксом `EXPO_PUBLIC_`

2. **Путь:** файл должен быть `apps/mobile/.env.local`, не в корне.

3. **Кэш:** обязательно перезапуск с `npx expo start --clear`.

4. **Проверка:** в логах при старте должны быть строки вида `EXPO_PUBLIC_SUPABASE_URL: SET`. Если видите `NOT SET` — переменные не загрузились.

5. Если не помогло — можно временно задать переменные через `app.json` → `expo.extra` (см. раздел 2.4 выше), но для разработки предпочтительнее `.env.local`.

---

## 3. CI/CD и секреты

Переменные для CI/CD (GitHub Actions) задаются через **Settings → Secrets and variables → Actions** в репозитории/организации.

Примеры (см. `.github/workflows/ci.yml`):

- `EXPO_TOKEN` — токен для `eas build` (mobile-сборки).
- `SUPABASE_SERVICE_ROLE_KEY` — может использоваться для миграций/скриптов в CI (строго как секрет).

Правила:

- Никогда не коммитить значения секретов в репозиторий.
- Для локальной разработки использовать `.env.local`; для CI — secrets/variables в настройках репозитория.

---

## 4. Специфичные гайды по интеграциям

| Интеграция | Документ | Что внутри |
|------------|----------|------------|
| **WhatsApp** (web) | [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md) | Токен, Phone Number ID, webhook, тестирование |
| **Telegram** (бот, авторизация) | [TELEGRAM_AUTH_IMPLEMENTATION.md](TELEGRAM_AUTH_IMPLEMENTATION.md) | Создание бота, переменные, вход через Telegram |

Переменные для WhatsApp и Telegram перечислены в `apps/web/.env.example`; полная пошаговая настройка — в указанных файлах.

---

## 5. Быстрые ссылки

- **Быстрый старт (установка + первые команды):** [GETTING_STARTED.md](GETTING_STARTED.md)
- **Web: команды и структура:** [apps/web/README.md](apps/web/README.md)
- **Шаблоны env:** `apps/web/.env.example`, `apps/mobile/.env.example`

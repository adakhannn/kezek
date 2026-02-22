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

### 1.2. Полный список переменных

См. **`apps/web/.env.example`** и **`apps/web/README.md`** — там перечислены все переменные (Supabase, сайт, Resend, WhatsApp, Telegram, Yandex, SMS, Redis, cron, E2E).

### 1.3. Опциональные интеграции (web)

- **WhatsApp** — уведомления и авторизация: [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md)
- **Telegram** — бот для уведомлений и вход через Telegram: [TELEGRAM_AUTH_IMPLEMENTATION.md](TELEGRAM_AUTH_IMPLEMENTATION.md)

Переменные для этих интеграций перечислены в `.env.example`; детальная настройка — в указанных гайдах.

---

## 2. Mobile (`apps/mobile`)

### 2.1. Требуемые переменные

| Переменная | Описание |
|------------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL проекта Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon-ключ Supabase |
| `EXPO_PUBLIC_API_URL` | URL веб-приложения (например `https://kezek.kg`) |

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

## 3. Специфичные гайды по интеграциям

| Интеграция | Документ | Что внутри |
|------------|----------|------------|
| **WhatsApp** (web) | [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md) | Токен, Phone Number ID, webhook, тестирование |
| **Telegram** (бот, авторизация) | [TELEGRAM_AUTH_IMPLEMENTATION.md](TELEGRAM_AUTH_IMPLEMENTATION.md) | Создание бота, переменные, вход через Telegram |

Переменные для WhatsApp и Telegram перечислены в `apps/web/.env.example`; полная пошаговая настройка — в указанных файлах.

---

## 4. Быстрые ссылки

- **Быстрый старт (установка + первые команды):** [GETTING_STARTED.md](GETTING_STARTED.md)
- **Web: команды и структура:** [apps/web/README.md](apps/web/README.md)
- **Шаблоны env:** `apps/web/.env.example`, `apps/mobile/.env.example`

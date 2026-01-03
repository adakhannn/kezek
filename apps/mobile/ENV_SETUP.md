# Настройка переменных окружения для мобильного приложения

## Требуемые переменные

Для работы мобильного приложения необходимы следующие переменные окружения:

1. **EXPO_PUBLIC_SUPABASE_URL** - URL вашего Supabase проекта
2. **EXPO_PUBLIC_SUPABASE_ANON_KEY** - Anon ключ Supabase
3. **EXPO_PUBLIC_API_URL** - URL веб-приложения (по умолчанию: https://kezek.kg)

## Где взять значения

### Supabase URL и Anon Key

1. Откройте [Supabase Dashboard](https://app.supabase.com/)
2. Выберите ваш проект
3. Перейдите в **Settings** → **API**
4. Скопируйте:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** ключ → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### API URL

Используйте URL вашего продакшен веб-приложения (например, `https://kezek.kg`)

## Способы настройки

### Способ 1: Файл .env.local (рекомендуется для разработки)

1. Создайте файл `apps/mobile/.env.local`:
```bash
cd apps/mobile
cp .env.local.example .env.local
```

2. Заполните значениями из продакшена:
```env
EXPO_PUBLIC_SUPABASE_URL=https://beulnmftzbmtbdlgurht.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_API_URL=https://kezek.kg
```

3. Перезапустите Expo:
```bash
npx expo start --clear
```

### Способ 2: app.json (для продакшена)

Обновите файл `apps/mobile/app.json`:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://beulnmftzbmtbdlgurht.supabase.co",
      "supabaseAnonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "apiUrl": "https://kezek.kg"
    }
  }
}
```

**Важно:** Значения в `app.json` будут включены в сборку приложения, поэтому не используйте их для секретных данных в продакшене.

### Способ 3: EAS Secrets (для продакшена)

Для продакшен сборок используйте EAS Secrets:

```bash
# Установите EAS CLI
npm install -g eas-cli

# Войдите в аккаунт
eas login

# Добавьте секреты
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://kezek.kg"
```

## Проверка

После настройки переменных проверьте логи при запуске приложения. Должны быть сообщения:

```
Final supabaseUrl: https://beulnmftzbmtbdlgurht.supabase.co...
Final supabaseAnonKey: SET
Source: { url: 'process.env', key: 'process.env' }
```

Если видите ошибку "Missing Supabase environment variables", проверьте:
1. Файл `.env.local` создан и находится в `apps/mobile/`
2. Переменные начинаются с `EXPO_PUBLIC_`
3. Вы перезапустили Expo с флагом `--clear`

## Безопасность

⚠️ **Важно:**
- Файл `.env.local` должен быть в `.gitignore` (не коммитьте его в репозиторий)
- Anon Key не является секретным, но лучше не публиковать его открыто
- Для продакшена используйте EAS Secrets или переменные окружения CI/CD


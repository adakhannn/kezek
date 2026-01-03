# Решение проблемы с переменными окружения

## Проблема
Expo не загружает переменные из `.env.local` файла.

## Решение

### Шаг 1: Проверьте формат файла `.env.local`

Файл должен находиться в `apps/mobile/.env.local` и иметь формат:

```env
EXPO_PUBLIC_SUPABASE_URL=https://beulnmftzbmtbdlgurht.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=ваш_ключ_здесь
EXPO_PUBLIC_API_URL=https://kezek.kg
```

**Важно:**
- Нет пробелов вокруг `=`
- Нет кавычек вокруг значений
- Каждая переменная на отдельной строке
- Все переменные начинаются с `EXPO_PUBLIC_`

### Шаг 2: Перезапустите Expo с очисткой кэша

**Обязательно** остановите текущий процесс (Ctrl+C) и запустите:

```bash
cd apps/mobile
npx expo start --clear
```

Флаг `--clear` критически важен - он очищает кэш Metro bundler и перезагружает переменные окружения.

### Шаг 3: Если не помогло - используйте app.json

Альтернативный способ - добавить переменные в `app.json`:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://beulnmftzbmtbdlgurht.supabase.co",
      "supabaseAnonKey": "ваш_ключ",
      "apiUrl": "https://kezek.kg"
    }
  }
}
```

Но это менее безопасно, так как значения попадут в git.

### Шаг 4: Проверьте логи

После перезапуска с `--clear` в консоли должны появиться логи:
```
=== Supabase Config Debug ===
process.env.EXPO_PUBLIC_SUPABASE_URL: SET
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY: SET
...
```

Если видите `NOT SET` - переменные не загрузились.

## Частые ошибки

1. **Файл в неправильной папке** - должен быть в `apps/mobile/.env.local`, не в корне проекта
2. **Неправильный формат** - пробелы вокруг `=`, кавычки, комментарии на той же строке
3. **Не перезапустили с --clear** - Metro bundler кэширует переменные
4. **Переменные без префикса EXPO_PUBLIC_** - Expo игнорирует переменные без этого префикса


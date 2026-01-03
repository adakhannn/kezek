# Решение проблем

## Ошибка "Something went wrong"

### 1. Проверьте переменные окружения

Убедитесь, что файл `apps/mobile/.env.local` содержит:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_API_URL=https://kezek.kg
```

**Важно:**
- Все переменные должны начинаться с `EXPO_PUBLIC_`
- Не должно быть пробелов вокруг `=`
- Не должно быть кавычек вокруг значений

### 2. Перезапустите Expo

После изменения `.env.local` **обязательно** перезапустите Expo:

1. Остановите текущий процесс (Ctrl+C в терминале)
2. Запустите снова:
```bash
cd apps/mobile
pnpm start
```

3. Очистите кэш, если проблема сохраняется:
```bash
npx expo start --clear
```

### 3. Проверьте логи

В терминале, где запущен `pnpm start`, будут видны ошибки. Ищите:
- `Missing Supabase environment variables`
- `Cannot find module`
- Другие ошибки импорта

### 4. Проверьте подключение к интернету

Убедитесь, что телефон подключен к интернету и может обращаться к:
- Supabase API
- Вашему API (kezek.kg)

### 5. Переустановите зависимости

Если проблема сохраняется:

```bash
cd apps/mobile
rm -rf node_modules
pnpm install
npx expo start --clear
```

### 6. Проверьте версию Expo Go

Убедитесь, что у вас установлена последняя версия Expo Go:
- iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
- Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

## Другие распространенные ошибки

### "Unable to resolve module"
```bash
rm -rf node_modules
pnpm install
npx expo start --clear
```

### "Network request failed"
- Проверьте подключение к интернету
- Проверьте, что API доступен
- Проверьте CORS настройки на сервере

### Белый экран
- Откройте DevTools в Expo Go (встряхните телефон)
- Проверьте логи в консоли
- Проверьте, что все импорты корректны

## Получение помощи

Если проблема не решена:
1. Скопируйте полный текст ошибки из терминала
2. Скопируйте текст ошибки из Expo Go (DevTools)
3. Проверьте, что все переменные окружения установлены правильно


# Быстрое решение ошибки "Failed to download remote update"

## Решение 1: Используйте Tunnel вместо LAN

Ошибка часто возникает из-за проблем с локальной сетью. Попробуйте использовать tunnel:

```bash
cd apps/mobile
npx expo start --tunnel
```

Это создаст туннель через интернет, что обходит проблемы с локальной сетью.

## Решение 2: Очистите кэш и переустановите

```bash
cd apps/mobile

# Остановите Expo (Ctrl+C)

# Очистите кэш
npx expo start --clear

# Если не помогло, удалите node_modules
rm -rf node_modules
pnpm install
npx expo start --clear
```

## Решение 3: Проверьте подключение

1. Убедитесь, что телефон и компьютер в одной сети Wi-Fi
2. Или используйте `--tunnel` режим (см. Решение 1)
3. Проверьте, что файрвол не блокирует порт 8081

## Решение 4: Обновите Expo Go

Убедитесь, что у вас последняя версия Expo Go:
- iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
- Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

## Решение 5: Используйте Development Build

Если проблема сохраняется, можно создать development build:

```bash
cd apps/mobile
npx expo install expo-dev-client
npx expo run:android  # или run:ios
```

Но это требует настройки Android Studio / Xcode.

## Рекомендуемый порядок действий:

1. **Сначала попробуйте tunnel:**
   ```bash
   npx expo start --tunnel
   ```

2. **Если не помогло, очистите кэш:**
   ```bash
   npx expo start --clear
   ```

3. **Если все еще не работает, переустановите зависимости:**
   ```bash
   rm -rf node_modules
   pnpm install
   npx expo start --clear --tunnel
   ```


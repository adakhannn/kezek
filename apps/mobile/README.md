# Kezek Mobile App

Мобильное приложение Kezek на React Native (Expo).

## Структура проекта

```
apps/mobile/
├── src/
│   ├── lib/           # Утилиты (Supabase, API клиент)
│   ├── navigation/    # Навигация (React Navigation)
│   ├── screens/       # Экраны приложения
│   └── types/         # TypeScript типы
├── assets/            # Иконки, изображения
├── App.tsx            # Точка входа
└── package.json
```

## Установка

1. Установи зависимости:
```bash
cd apps/mobile
npm install
# или
pnpm install
```

2. Создай файл `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=https://kezek.kg/api
```

3. Запусти приложение:
```bash
npm start
# или
pnpm start
```

## Запуск на устройстве

### iOS
```bash
npm run ios
```

### Android
```bash
npm run android
```

### Web (для тестирования)
```bash
npm run web
```

## Использование Expo Go

1. Установи Expo Go на телефон (iOS/Android)
2. Запусти `npm start`
3. Отсканируй QR-код в терминале

## Сборка для продакшена

### iOS
```bash
eas build --platform ios
```

### Android
```bash
eas build --platform android
```

Требуется настройка EAS (Expo Application Services).

## Особенности

- **Supabase Auth** - аутентификация через Supabase
- **React Navigation** - навигация между экранами
- **TypeScript** - типизация
- **React Query** - кэширование данных
- **React Hook Form** - работа с формами

## Следующие шаги

1. Реализовать экраны авторизации (SignIn, SignUp, Verify)
2. Подключить API endpoints из web версии
3. Создать экраны бронирования
4. Добавить уведомления (Expo Notifications)
5. Настроить глубокие ссылки (Deep Linking)


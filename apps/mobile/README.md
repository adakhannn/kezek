# Kezek Mobile App

Мобильное приложение для бронирования услуг в Оше.

## Технологии

- **Expo** - фреймворк для разработки React Native приложений
- **React Native** - кроссплатформенная разработка
- **TypeScript** - типизация
- **React Navigation** - навигация
- **React Query** - управление состоянием и кэширование
- **Supabase** - бэкенд и аутентификация

## Требования

- Node.js 18+
- pnpm (или npm/yarn)
- Expo CLI (устанавливается автоматически)
- Для iOS: Xcode и CocoaPods
- Для Android: Android Studio и Android SDK

## Установка

1. Установите зависимости:
```bash
cd apps/mobile
pnpm install
```

2. Создайте файл `.env.local` в корне проекта (`apps/mobile/.env.local`):
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_API_URL=https://kezek.kg
```

3. Запустите приложение:
```bash
pnpm start
```

Или:
```bash
npx expo start
```

## Запуск на устройстве

### iOS (требуется Mac)

1. Установите Expo Go из App Store на iPhone
2. Запустите `pnpm start`
3. Отсканируйте QR-код камерой iPhone или в приложении Expo Go

### Android

1. Установите Expo Go из Google Play на Android устройство
2. Запустите `pnpm start`
3. Отсканируйте QR-код в приложении Expo Go

### Эмуляторы

**iOS Simulator (только на Mac):**
```bash
pnpm ios
```

**Android Emulator:**
```bash
pnpm android
```

## Структура проекта

```
apps/mobile/
├── src/
│   ├── components/     # Переиспользуемые компоненты
│   ├── screens/        # Экраны приложения
│   ├── navigation/     # Настройка навигации
│   ├── lib/            # Утилиты и конфигурация
│   ├── hooks/          # Кастомные хуки
│   ├── contexts/       # React контексты
│   └── utils/          # Вспомогательные функции
├── App.tsx             # Точка входа
├── app.json            # Конфигурация Expo
└── package.json        # Зависимости
```

## Основные функции

- ✅ Авторизация (Email/Phone OTP, Google OAuth)
- ✅ Поиск и просмотр бизнесов
- ✅ Создание бронирований
- ✅ Личный кабинет с бронированиями
- ✅ Профиль пользователя
- ✅ Кабинет владельца бизнеса
- ✅ Кабинет сотрудника
- ✅ Уведомления (Toast)
- ✅ Pull-to-refresh
- ✅ Глубокие ссылки

## Разработка

### TypeScript проверка
```bash
pnpm typecheck
```

### Сборка для продакшена

**Android:**
```bash
eas build --platform android
```

**iOS:**
```bash
eas build --platform ios
```

## Переменные окружения

Все переменные окружения должны начинаться с `EXPO_PUBLIC_` для доступа в клиентском коде.

## Troubleshooting

### Ошибка "Unable to resolve module"
```bash
rm -rf node_modules
pnpm install
```

### Ошибка Metro bundler
```bash
npx expo start --clear
```

### Проблемы с кэшем
```bash
npx expo start -c
```

## Дополнительная информация

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Query](https://tanstack.com/query/latest)

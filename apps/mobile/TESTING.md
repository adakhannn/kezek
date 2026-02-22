# Тестирование мобильного приложения

## Обзор

Мобильное приложение использует Jest и React Native Testing Library для smoke-тестов ключевых экранов.

## Установка зависимостей

```bash
cd apps/mobile
pnpm install
```

## Запуск тестов

```bash
# Запустить все тесты
pnpm test

# Запустить тесты в watch режиме
pnpm test:watch

# Запустить тесты с покрытием
pnpm test:coverage
```

## Структура тестов

### Smoke-тесты экранов

Тесты находятся в `src/__tests__/screens/`:

- **Auth экраны** (`auth/`):
  - `SignInScreen.test.tsx` - проверка рендеринга экрана входа
  - `SignUpScreen.test.tsx` - проверка рендеринга экрана регистрации
  - `VerifyScreen.test.tsx` - проверка рендеринга экрана подтверждения
  - `WhatsAppScreen.test.tsx` - проверка рендеринга экрана WhatsApp авторизации

- **Основные экраны**:
  - `StaffScreen.test.tsx` - проверка рендеринга экрана списка смен сотрудника
  - `CabinetScreen.test.tsx` - проверка рендеринга экрана кабинета клиента
  - `BookingDetailsScreen.test.tsx` - проверка рендеринга экрана деталей бронирования

### Тесты навигации

- `src/__tests__/navigation/BookingNavigation.test.tsx` - проверка навигации между шагами бронирования

## Базовый набор тестов перед релизом

Перед каждым релизом mobile приложения должны проходить следующие smoke-тесты:

1. ✅ **Auth экраны рендерятся без ошибок**
   - SignInScreen
   - SignUpScreen
   - VerifyScreen
   - WhatsAppScreen

2. ✅ **Основные экраны рендерятся без ошибок**
   - StaffScreen (список смен)
   - CabinetScreen (кабинет клиента)
   - BookingDetailsScreen (детали бронирования)

3. ✅ **Навигация между шагами бронирования работает**
   - BookingStep1Branch → BookingStep2Service → BookingStep3Staff → BookingStep4Date → BookingStep5Time → BookingStep6Confirm

## Настройка моков

Моки настроены в `jest.setup.js`:
- Expo модули (expo-constants, expo-secure-store, expo-web-browser)
- Supabase клиент
- React Navigation
- React Query
- Toast Context
- Booking Context

## Добавление новых тестов

При добавлении нового экрана создайте соответствующий smoke-тест:

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import NewScreen from '../../screens/NewScreen';

describe('NewScreen', () => {
    test('должен отрендериться без ошибок', () => {
        render(<NewScreen />);
        expect(screen.getByTestId('new-screen') || screen.getByText(/новый экран/i)).toBeTruthy();
    });
});
```

## CI/CD

Smoke-тесты автоматически запускаются в CI pipeline перед релизом mobile приложения.

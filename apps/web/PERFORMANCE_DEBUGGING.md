# Отладка производительности

## Инструменты для выявления проблем

### 1. React DevTools Profiler

**Установка:**
- Установите расширение [React Developer Tools](https://react.dev/learn/react-developer-tools)
- Откройте DevTools → вкладка "Profiler"

**Использование:**
1. Нажмите кнопку записи (Record)
2. Выполните действия в приложении
3. Остановите запись
4. Анализируйте результаты:
   - **Желтые/красные** компоненты = частые рендеры
   - **Время рендера** = сколько времени занимает рендер
   - **Причины рендера** = почему компонент перерендерился

**Что искать:**
- Компоненты, которые рендерятся при каждом изменении родителя
- Компоненты с большим временем рендера (>16ms)
- Компоненты без `React.memo`, которые должны его иметь

### 2. Chrome DevTools Network

**Использование:**
1. Откройте DevTools → вкладка "Network"
2. Фильтруйте по "Fetch/XHR"
3. Ищите:
   - **Дубликаты** - одинаковые URL вызываются несколько раз
   - **Canceled** - запросы, которые отменяются (race conditions)
   - **Медленные запросы** - запросы >1 секунды

**Что искать:**
- Запросы, которые выполняются при каждом рендере
- Запросы, которые отменяются сразу после запуска
- Запросы без debounce/throttle

### 3. React DevTools Components

**Использование:**
1. Откройте DevTools → вкладка "Components"
2. Включите "Highlight updates when components render"
3. Выполните действия в приложении
4. Компоненты будут подсвечиваться при рендере

**Что искать:**
- Компоненты, которые подсвечиваются слишком часто
- Компоненты, которые подсвечиваются без видимых изменений

### 4. Встроенные инструменты проекта

#### useWhyDidYouRender

Хук для отслеживания причин перерендеров:

```typescript
import { useWhyDidYouRender } from '@/hooks/useWhyDidYouRender';

const MyComponent = ({ prop1, prop2, state }) => {
  useWhyDidYouRender('MyComponent', { prop1, prop2, state });
  // ...
};
```

#### useRenderCount

Хук для подсчета количества рендеров:

```typescript
import { useRenderCount } from '@/hooks/useRenderCount';

const MyComponent = () => {
  const renderCount = useRenderCount('MyComponent');
  // В консоли будет предупреждение, если компонент рендерится >5 раз
  // ...
};
```

#### API Logger

Автоматически логирует все API запросы и обнаруживает дубликаты:

```typescript
import { logApiCall } from '@/lib/apiLogger';

// В fetch обертке или axios interceptor
logApiCall(url, method, { duration, status, error });
```

#### Performance Monitor

Компонент для отображения метрик в dev режиме:

```typescript
import { PerformanceMonitor } from '@/components/dev/PerformanceMonitor';

// В корневом layout
<PerformanceMonitor />
```

## Типичные проблемы и решения

### Проблема: Компонент рендерится при каждом изменении родителя

**Решение:**
```typescript
// Было:
const MyComponent = ({ data }) => { ... };

// Стало:
const MyComponent = React.memo(({ data }) => { ... });
```

### Проблема: Функция создается заново при каждом рендере

**Решение:**
```typescript
// Было:
const handleClick = () => { ... };

// Стало:
const handleClick = useCallback(() => { ... }, [dependencies]);
```

### Проблема: Объект/массив создается заново при каждом рендере

**Решение:**
```typescript
// Было:
const config = { option: value };

// Стало:
const config = useMemo(() => ({ option: value }), [value]);
```

### Проблема: Запрос выполняется при каждом рендере

**Решение:**
```typescript
// Было:
useEffect(() => {
  fetch('/api/data').then(...);
});

// Стало:
useEffect(() => {
  fetch('/api/data').then(...);
}, [dependencies]); // Добавьте зависимости
```

### Проблема: Множественные запросы при быстрых изменениях

**Решение:**
```typescript
// Используйте debounce или AbortController
const debouncedValue = useDebounce(value, 500);
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal });
  return () => controller.abort();
}, [debouncedValue]);
```

## Чеклист для проверки производительности

- [ ] Используется `React.memo` для компонентов, которые не должны часто рендериться
- [ ] Используется `useCallback` для функций, передаваемых в дочерние компоненты
- [ ] Используется `useMemo` для дорогих вычислений
- [ ] Запросы имеют правильные зависимости в `useEffect`
- [ ] Используется debounce/throttle для частых действий
- [ ] Используется `AbortController` для отмены запросов
- [ ] Нет лишних запросов при монтировании компонента
- [ ] Нет дублирующихся запросов

## Полезные команды

```bash
# Проверить размер бандла
pnpm build

# Анализ бандла (если настроен)
pnpm analyze

# Проверить консольные логи
pnpm check-console-logs
```


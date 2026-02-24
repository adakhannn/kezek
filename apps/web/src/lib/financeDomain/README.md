# Finance Domain - Руководство для разработчиков

## Обзор

`financeDomain` — единый доменный слой для финансовой логики системы Kezek. Этот модуль содержит все бизнес-правила для расчета финансовых показателей смен сотрудников и обеспечивает единообразие расчетов между фронтендом и бэкендом.

## Архитектура

Модуль разделен на несколько подмодулей, каждый из которых отвечает за определенный аспект финансовых расчетов:

```
financeDomain/
├── normalize.ts      # Нормализация процентов
├── shares.ts         # Расчет базовых долей (мастер/салон)
├── guarantee.ts      # Расчет гарантированной суммы и доплат
├── items.ts          # Расчет сумм из массива items
├── shift.ts          # Полный расчет финансов смены
├── display.ts        # Расчет долей для отображения
└── index.ts          # Точка входа (экспорт всех функций)
```

## Основные функции

### 1. Нормализация процентов (`normalize.ts`)

```typescript
import { normalizePercentages } from '@/lib/financeDomain';

// Нормализует проценты мастера и салона
// Если сумма процентов не равна 100, нормализует их пропорционально
const result = normalizePercentages(60, 40);
// { master: 60, salon: 40, sum: 100 }

const result2 = normalizePercentages(30, 20);
// { master: 60, salon: 40, sum: 100 } - нормализуется до 100%
```

**Особенности:**
- Автоматически нормализует проценты, если их сумма не равна 100
- Обрабатывает отрицательные, NaN и Infinity значения (использует дефолтные 60/40)
- Возвращает проценты, округленные до 2 знаков

### 2. Расчет базовых долей (`shares.ts`)

```typescript
import { calculateBaseShares, calculateBaseMasterShare, calculateBaseSalonShare } from '@/lib/financeDomain';

// Расчет базовой доли мастера
const masterShare = calculateBaseMasterShare(10000, 60, 40);
// 6000 (60% от 10000)

// Расчет базовой доли салона (с учетом расходников)
const salonShare = calculateBaseSalonShare(10000, 500, 60, 40);
// 4500 (40% от 10000 + 500 расходников)

// Расчет обеих долей одновременно
const shares = calculateBaseShares(10000, 500, 60, 40);
// { masterShare: 6000, salonShare: 4500 }
```

**Важно:**
- Расходники (consumables) всегда идут 100% салону
- Результаты округляются до целого числа

### 3. Гарантированная сумма и доплаты (`guarantee.ts`)

```typescript
import { calculateGuaranteedAmount, calculateTopupAmount } from '@/lib/financeDomain';

// Расчет гарантированной суммы (часы × ставка)
const guaranteed = calculateGuaranteedAmount(8, 500);
// 4000 (8 часов × 500 сом/час)

// Расчет доплаты (если гарантия больше базовой доли)
const topup = calculateTopupAmount(5000, 3000);
// 2000 (5000 - 3000)

// Если гарантия меньше базовой доли, доплата = 0
const topup2 = calculateTopupAmount(3000, 5000);
// 0
```

**Логика:**
- Гарантированная сумма = `hoursWorked × hourlyRate`
- Доплата применяется только если гарантия > базовая доля мастера
- Доплата вычитается из доли салона

### 4. Расчет сумм из items (`items.ts`)

```typescript
import { calculateTotalServiceAmount, calculateTotalConsumables } from '@/lib/financeDomain';

const items = [
    { serviceAmount: 1000, consumablesAmount: 100 },
    { serviceAmount: 2000, consumablesAmount: 200 },
];

const totalService = calculateTotalServiceAmount(items);
// 3000

const totalConsumables = calculateTotalConsumables(items);
// 300
```

**Особенности:**
- Игнорирует `null`, `undefined`, `NaN` и отрицательные значения
- Безопасно обрабатывает пустые массивы

### 5. Полный расчет финансов смены (`shift.ts`)

```typescript
import { calculateShiftFinancials } from '@/lib/financeDomain';

const financials = calculateShiftFinancials({
    totalAmount: 10000,
    totalConsumables: 500,
    percentMaster: 60,
    percentSalon: 40,
    hoursWorked: 8,
    hourlyRate: 500,
});

// Возвращает полный объект с всеми расчетами:
// {
//   totalAmount: 10000,
//   totalConsumables: 500,
//   baseMasterShare: 6000,
//   baseSalonShare: 4500,
//   guaranteedAmount: 4000,
//   topupAmount: 0,
//   finalMasterShare: 6000,  // max(гарантия, базовая доля)
//   finalSalonShare: 4500,   // базовая доля - доплата
//   normalizedPercentMaster: 60,
//   normalizedPercentSalon: 40
// }
```

**Это основная функция для расчета финансов смены!**

### 6. Расчет долей для отображения (`display.ts`)

```typescript
import { calculateDisplayShares } from '@/lib/financeDomain';

// Для открытой смены с гарантией
const displayShares = calculateDisplayShares(6000, 4000, 8000, true);
// { masterShare: 8000, salonShare: 0 } - учитывает гарантию

// Для закрытой смены
const displayShares2 = calculateDisplayShares(6000, 4000, null, false);
// { masterShare: 6000, salonShare: 4000 } - базовые доли
```

**Использование:**
- Для открытых смен учитывает текущую гарантированную сумму
- Для закрытых смен использует сохраненные значения из БД

## Примеры использования

### На фронтенде (React hooks)

```typescript
import { calculateShiftFinancials } from '@/lib/financeDomain';

function useShiftCalculations(shift, items, isOpen) {
    const financials = useMemo(() => {
        if (!shift || !items) return null;
        
        return calculateShiftFinancials({
            totalAmount: calculateTotalServiceAmount(items),
            totalConsumables: calculateTotalConsumables(items),
            percentMaster: shift.percent_master,
            percentSalon: shift.percent_salon,
            hoursWorked: isOpen ? currentHoursWorked : shift.hours_worked,
            hourlyRate: isOpen ? currentHourlyRate : shift.hourly_rate,
        });
    }, [shift, items, isOpen]);
    
    return financials;
}
```

### На бэкенде (API routes)

```typescript
import { calculateShiftFinancials } from '@/lib/financeDomain';

export async function POST(req: Request) {
    const { items, hoursWorked } = await req.json();
    
    // Получаем настройки сотрудника
    const staff = await getStaff(staffId);
    
    // Рассчитываем финансовые показатели
    const financials = calculateShiftFinancials({
        totalAmount: calculateTotalServiceAmount(items),
        totalConsumables: calculateTotalConsumables(items),
        percentMaster: staff.percent_master,
        percentSalon: staff.percent_salon,
        hoursWorked,
        hourlyRate: staff.hourly_rate,
    });
    
    // Сохраняем в БД
    await updateShift(shiftId, {
        total_amount: financials.totalAmount,
        master_share: financials.finalMasterShare,
        salon_share: financials.finalSalonShare,
        guaranteed_amount: financials.guaranteedAmount,
        topup_amount: financials.topupAmount,
    });
}
```

## Важные правила

### 1. Нормализация процентов

Проценты всегда нормализуются, если их сумма не равна 100:
- `(30, 20)` → `(60, 40)` (нормализуется до 100%)
- `(60, 40)` → `(60, 40)` (уже нормализованы)

### 2. Гарантированная оплата

- Если `guaranteedAmount > baseMasterShare`, то:
  - `finalMasterShare = guaranteedAmount`
  - `topupAmount = guaranteedAmount - baseMasterShare`
  - `finalSalonShare = baseSalonShare - topupAmount` (минимум 0)

- Если `guaranteedAmount <= baseMasterShare`, то:
  - `finalMasterShare = baseMasterShare`
  - `topupAmount = 0`
  - `finalSalonShare = baseSalonShare`

### 3. Расходники

Расходники (consumables) всегда идут 100% салону и не участвуют в расчете долей мастера.

### 4. Округление

- Базовые доли округляются до целого числа
- Финальные доли и гарантии округляются до 2 знаков после запятой

## Тестирование

Все функции модуля покрыты unit-тестами. Тесты находятся в:
- `apps/web/src/__tests__/lib/financeDomain/`

Запуск тестов:
```bash
pnpm test financeDomain
```

## Миграция со старого кода

Если вы используете старые функции из `apps/web/src/app/staff/finance/utils/calculations.ts`, они теперь реэкспортируют функции из `financeDomain`. Рекомендуется обновить импорты:

```typescript
// Старый способ (все еще работает)
import { calculateShiftFinancials } from '@/app/staff/finance/utils/calculations';

// Новый способ (рекомендуется)
import { calculateShiftFinancials } from '@/lib/financeDomain';
```

## FAQ

**Q: Почему проценты нормализуются?**  
A: Чтобы гарантировать, что сумма процентов всегда равна 100%, даже если в БД сохранены некорректные значения.

**Q: Что происходит, если доплата больше доли салона?**  
A: Доля салона становится 0 (не может быть отрицательной).

**Q: Можно ли использовать функции на клиенте?**  
A: Да, все функции работают как на сервере, так и на клиенте. Они не имеют зависимостей от БД или API.

**Q: Как обрабатываются нулевые значения?**  
A: Все функции безопасно обрабатывают нули, null, undefined, NaN и Infinity значения, возвращая разумные дефолты.

## При добавлении новых типов выплат или формул

При добавлении новых типов выплат или изменении формул расчёта необходимо:

1. **Обновить SYSTEM_FEATURES_DOCUMENTATION** (корень репозитория) — раздел 1.5 «Финансовая система»: описание нового типа выплаты, формулы, граничные случаи (см. подраздел 1.5.6).
2. **Реализовать в этом модуле** — добавить или изменить функции в соответствующих файлах (`normalize.ts`, `shares.ts`, `guarantee.ts`, `items.ts`, `shift.ts`, `display.ts`), экспортировать через `index.ts`. Добавить JSDoc с описанием и формулой.
3. **Обновить этот README** — описать новую функцию в разделе «Основные функции», при необходимости в архитектуре.
4. **Добавить или обновить unit-тесты** в `apps/web/src/__tests__/lib/financeDomain/`.

## Дополнительные ресурсы

- [Unit-тесты](../__tests__/lib/financeDomain/) - примеры использования всех функций
- [API endpoints](../../app/api/staff/) - примеры использования в API routes
- [React hooks](../../app/staff/finance/hooks/) - примеры использования в React компонентах
- [SYSTEM_FEATURES_DOCUMENTATION](../../../../../SYSTEM_FEATURES_DOCUMENTATION.md) — раздел 1.5 (формулы и правила документирования)


# Dashboard UI Kit

Единый UI-кит для операторских компонентов дашборда.

## Компоненты

### BookingCard
Карточка бронирования с едиными стилями статусов.

```tsx
import { BookingCard } from '@/components/dashboard';

<BookingCard
    id="booking-id"
    startISO="2024-01-01T10:00:00Z"
    endISO="2024-01-01T11:00:00Z"
    status="confirmed"
    timezone="Asia/Bishkek"
    href="/booking/123"
/>
```

### ShiftCard
Карточка смены с возможностью раскрытия.

```tsx
import { ShiftCard } from '@/components/dashboard';

<ShiftCard
    shiftDate="2024-01-01"
    status="open"
    totalAmount={5000}
    clientCount={5}
    openedAt="10:00"
>
    {/* Дополнительный контент при раскрытии */}
</ShiftCard>
```

### StatusPanel
Панель статуса с заголовком и действиями.

```tsx
import { StatusPanel, StatusItem } from '@/components/dashboard';

<StatusPanel
    title="Статус на сегодня/завтра"
    loading={false}
    actions={<button>Действие</button>}
>
    <div className="grid grid-cols-2 gap-4">
        <StatusItem
            label="Сегодня"
            value="10 записей"
            subtitle="5 свободных слотов"
        />
        <StatusItem
            label="Завтра"
            value="8 записей"
        />
    </div>
</StatusPanel>
```

### FilterPanel
Панель фильтров с поиском и дополнительными фильтрами.

```tsx
import { FilterPanel, FilterSelect } from '@/components/dashboard';

<FilterPanel
    searchPlaceholder="Поиск..."
    searchValue={searchQuery}
    onSearchChange={setSearchQuery}
    filters={
        <FilterSelect
            value={filterValue}
            onChange={setFilterValue}
            options={[
                { value: 'all', label: 'Все' },
                { value: 'active', label: 'Активные' },
            ]}
        />
    }
    actions={<button>Действие</button>}
/>
```

### ConfirmDialog
Модальное окно подтверждения.

```tsx
import { ConfirmDialog } from '@/components/dashboard';

<ConfirmDialog
    isOpen={isOpen}
    title="Подтверждение"
    message="Вы уверены, что хотите выполнить это действие?"
    confirmLabel="Подтвердить"
    cancelLabel="Отмена"
    variant="danger"
    onConfirm={handleConfirm}
    onCancel={handleCancel}
/>
```

## Токены

Все компоненты используют единые токены из `tokens.ts`:

- `spacing` - отступы
- `sizes` - размеры компонентов, иконок, текста
- `bookingStatusColors` - цвета статусов бронирований
- `shiftStatusColors` - цвета статусов смен
- `statusIcons` - иконки статусов

```tsx
import { spacing, sizes, bookingStatusColors } from '@/components/dashboard/tokens';
```

## Использование

Все компоненты экспортируются из `@/components/dashboard`:

```tsx
import {
    BookingCard,
    ShiftCard,
    StatusPanel,
    StatusItem,
    FilterPanel,
    FilterSelect,
    ConfirmDialog,
    bookingStatusColors,
    spacing,
    sizes,
} from '@/components/dashboard';
```


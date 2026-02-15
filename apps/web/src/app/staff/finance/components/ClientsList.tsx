// apps/web/src/app/staff/finance/components/ClientsList.tsx

import { useMemo, useCallback } from 'react';

import type { ShiftItem, Booking, ServiceName, Shift } from '../types';
import { getItemKey } from '../utils/itemKeys';

import { ClientEditForm } from './ClientEditForm';
import { ClientItem } from './ClientItem';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

interface ClientsListProps {
    items: ShiftItem[];
    bookings: Booking[];
    serviceOptions: ServiceName[];
    shift: Shift | null;
    isOpen: boolean;
    isClosed: boolean;
    isReadOnly: boolean;
    isSaving?: boolean; // Флаг для блокировки кнопок сохранения
    staffId?: string;
    expandedItems: Set<number>;
    onExpand: (idx: number) => void;
    onCollapse: (idx: number) => void;
    onUpdateItem: (idx: number, item: ShiftItem) => void;
    onSaveItem?: (idx: number) => void;
    onDeleteItem: (idx: number) => void;
    onDuplicateItem?: (idx: number) => void;
}

export function ClientsList({
    items,
    bookings,
    serviceOptions,
    shift,
    isOpen,
    isClosed,
    isReadOnly,
    isSaving = false,
    staffId,
    expandedItems,
    onExpand,
    onCollapse,
    onUpdateItem,
    onSaveItem,
    onDeleteItem,
    onDuplicateItem,
}: ClientsListProps) {
    const { t } = useLanguage();

    // Для владельца: показываем список, даже если смена не открыта (может быть не создана)
    // Для сотрудника: показываем сообщение, если смена не открыта
    if (!staffId && (!shift || !isOpen)) {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                {t('staff.finance.clients.shiftNotOpen', 'Чтобы добавлять клиентов, необходимо сначала открыть смену на вкладке «Текущая смена».')}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('staff.finance.clients.empty', 'Пока нет добавленных клиентов. Добавьте клиента из записей или введите вручную, укажите суммы за услугу и расходники.')}
            </p>
        );
    }

    // Мемоизируем вычисление использованных booking IDs для оптимизации производительности
    // Это предотвращает повторное вычисление при каждом рендере
    const usedBookingIdsSet = useMemo(() => {
        return new Set(items.map(it => it.bookingId).filter(Boolean));
    }, [items]);

    // Мемоизируем фильтрацию доступных бронирований
    // Фильтруем только прошедшие бронирования, которые еще не использованы
    const now = useMemo(() => new Date(), []);
    const availableBookingsBase = useMemo(() => {
        return bookings.filter((b) => {
            if (usedBookingIdsSet.has(b.id)) return false;
            try {
                const start = new Date(b.start_at);
                return start <= now;
            } catch {
                return false;
            }
        });
    }, [bookings, usedBookingIdsSet, now]);

    // Мемоизируем функции-обработчики для предотвращения лишних ре-рендеров
    const handleEdit = useCallback((idx: number) => {
        onExpand(idx);
    }, [onExpand]);

    const handleDelete = useCallback((idx: number) => {
        onDeleteItem(idx);
    }, [onDeleteItem]);

    const handleDuplicate = useCallback((idx: number) => {
        if (onDuplicateItem) {
            onDuplicateItem(idx);
        }
    }, [onDuplicateItem]);

    return (
        <div className="space-y-2 text-sm">
            {/* Заголовок колонок */}
            <div className="hidden sm:grid grid-cols-[2fr,2fr,1fr,1fr,1fr,auto] gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                <span>{t('staff.finance.clients.client', 'Клиент')}</span>
                <span>{t('staff.finance.clients.service', 'Услуга / комментарий')}</span>
                <span className="text-right">{t('staff.finance.clients.amount', 'Сумма')}</span>
                <span className="text-right">{t('staff.finance.clients.consumables', 'Расходники')}</span>
                <span className="text-right">{t('staff.finance.clients.createdAt', 'Время заполнения')}</span>
                <span className="text-center">
                    {/* Для владельца: показываем заголовок, если смена не закрыта (может быть открыта или еще не создана) */}
                    {/* Для сотрудника: показываем заголовок только если смена открыта */}
                    {((staffId && !isReadOnly) || (!staffId && isOpen && !isReadOnly)) 
                        ? t('staff.finance.clients.actions', 'Действия') 
                        : ''}
                </span>
            </div>

            {items.map((item, idx) => {
                // Для каждого элемента вычисляем доступные бронирования, исключая текущий элемент
                const currentItemBookingId = item.bookingId;
                // Вычисляем доступные бронирования без useMemo (хуки нельзя вызывать в циклах)
                // Но используем мемоизированную базу и просто фильтруем
                let availableBookings = availableBookingsBase;
                if (currentItemBookingId) {
                    // Если текущий элемент использует бронирование, добавляем его обратно в доступные
                    const currentBooking = bookings.find(b => b.id === currentItemBookingId);
                    if (currentBooking) {
                        availableBookings = [...availableBookingsBase, currentBooking];
                    }
                }

                const isExpanded = expandedItems.has(idx);

                // Используем стабильный ключ для элемента списка
                const itemKey = getItemKey(item, idx);

                if (isExpanded) {
                    return (
                        <ClientEditForm
                            key={itemKey}
                            item={item}
                            idx={idx}
                            allItems={items}
                            bookings={availableBookings}
                            serviceOptions={serviceOptions}
                            isOpen={isOpen}
                            isReadOnly={isReadOnly}
                            isSaving={isSaving}
                            onUpdate={onUpdateItem}
                            onSave={onSaveItem}
                            onCollapse={onCollapse}
                        />
                    );
                }

                return (
                    <ClientItem
                        key={itemKey}
                        item={item}
                        idx={idx}
                        isOpen={isOpen}
                        isClosed={isClosed}
                        isReadOnly={isReadOnly}
                        staffId={staffId}
                        onEdit={() => handleEdit(idx)}
                        onDelete={() => handleDelete(idx)}
                        onDuplicate={onDuplicateItem ? () => handleDuplicate(idx) : undefined}
                    />
                );
            })}
        </div>
    );
}


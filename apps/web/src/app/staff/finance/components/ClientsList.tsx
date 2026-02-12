// apps/web/src/app/staff/finance/components/ClientsList.tsx

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
    staffId?: string;
    expandedItems: Set<number>;
    onExpand: (idx: number) => void;
    onCollapse: (idx: number) => void;
    onUpdateItem: (idx: number, item: ShiftItem) => void;
    onSaveItem?: (idx: number) => void;
    onDeleteItem: (idx: number) => void;
}

export function ClientsList({
    items,
    bookings,
    serviceOptions,
    shift,
    isOpen,
    isClosed,
    isReadOnly,
    staffId,
    expandedItems,
    onExpand,
    onCollapse,
    onUpdateItem,
    onSaveItem,
    onDeleteItem,
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

    const now = new Date();

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
                const usedBookingIds = items.filter((it, i) => i !== idx && it.bookingId).map(it => it.bookingId);
                const availableBookings = bookings.filter((b) => {
                    if (usedBookingIds.includes(b.id)) return false;
                    try {
                        const start = new Date(b.start_at);
                        return start <= now;
                    } catch {
                        return false;
                    }
                });
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
                        onEdit={() => onExpand(idx)}
                        onDelete={() => onDeleteItem(idx)}
                    />
                );
            })}
        </div>
    );
}


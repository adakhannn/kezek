import type { Booking, ServiceName, Shift, ShiftItem } from '../types';

import { ClientsList } from './ClientsList';
import { ClientsListHeader } from './ClientsListHeader';

interface FinanceClientsTabProps {
    staffId?: string;
    className: string;
    shiftDate: Date;
    setShiftDate: (value: Date) => void;
    isOpen: boolean;
    isClosed: boolean;
    isReadOnly: boolean;
    shift: Shift | null;
    items: ShiftItem[];
    bookings: Booking[];
    serviceOptions: ServiceName[];
    expandedItems: Set<number>;
    setExpandedItems: (updater: (prev: Set<number>) => Set<number>) => void;
    onAddClient: () => void;
    onUpdateItem: (index: number, item: ShiftItem) => void;
    onSaveItem: (index: number) => void;
    onDeleteItem: (index: number) => void;
    onDuplicateItem: (index: number) => void;
    mutations: {
        isSaving: boolean;
        isOpening: boolean;
        isClosing: boolean;
    };
}

export function FinanceClientsTab({
    staffId,
    className,
    shiftDate,
    setShiftDate,
    isOpen,
    isClosed,
    isReadOnly,
    shift,
    items,
    bookings,
    serviceOptions,
    expandedItems,
    setExpandedItems,
    onAddClient,
    onUpdateItem,
    onSaveItem,
    onDeleteItem,
    onDuplicateItem,
    mutations,
}: FinanceClientsTabProps) {
    return (
        <div className={className}>
            <ClientsListHeader
                shiftDate={shiftDate}
                onShiftDateChange={setShiftDate}
                isOpen={isOpen}
                isClosed={isClosed}
                isReadOnly={isReadOnly}
                savingItems={mutations.isSaving}
                saving={mutations.isOpening || mutations.isClosing}
                staffId={staffId}
                onAddClient={onAddClient}
                items={items}
                shift={shift}
            />

            <ClientsList
                items={items}
                bookings={bookings}
                serviceOptions={serviceOptions}
                shift={shift}
                isOpen={isOpen}
                isClosed={isClosed}
                isReadOnly={isReadOnly}
                isSaving={mutations.isSaving}
                staffId={staffId}
                expandedItems={expandedItems}
                onExpand={(idx) => setExpandedItems((prev) => new Set(prev).add(idx))}
                onCollapse={(idx) => {
                    setExpandedItems((prev) => {
                        const next = new Set(prev);
                        next.delete(idx);
                        return next;
                    });
                }}
                onUpdateItem={onUpdateItem}
                onSaveItem={onSaveItem}
                onDeleteItem={onDeleteItem}
                onDuplicateItem={onDuplicateItem}
            />
        </div>
    );
}

// apps/web/src/app/staff/finance/hooks/useShiftItems.ts

import { useEffect, useState } from 'react';

import type { ShiftItem } from '../types';

import { logError } from '@/lib/log';


interface UseShiftItemsOptions {
    items: ShiftItem[];
    isOpen: boolean;
    isReadOnly: boolean;
    isInitialLoad: boolean;
    staffId?: string;
}

interface UseShiftItemsReturn {
    items: ShiftItem[];
    setItems: React.Dispatch<React.SetStateAction<ShiftItem[]>>;
    expandedItems: Set<number>;
    setExpandedItems: React.Dispatch<React.SetStateAction<Set<number>>>;
    savingItems: boolean;
}

/**
 * Хук для управления клиентами смены (items)
 */
export function useShiftItems({ 
    items: initialItems, 
    isOpen, 
    isReadOnly, 
    isInitialLoad,
    staffId 
}: UseShiftItemsOptions): UseShiftItemsReturn {
    const [items, setItems] = useState<ShiftItem[]>(initialItems);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [savingItems, setSavingItems] = useState(false);

    // Синхронизируем items с внешним состоянием
    useEffect(() => {
        setItems(initialItems);
    }, [initialItems]);

    // Автосохранение клиентов при изменении (debounce)
    useEffect(() => {
        // Не сохраняем при первой загрузке, если смена закрыта, или в режиме просмотра
        if (isInitialLoad || !isOpen || isReadOnly) return;
        
        const timeoutId = setTimeout(async () => {
            setSavingItems(true);
            try {
                const res = await fetch('/api/staff/shift/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items, staffId: staffId || undefined }),
                });
                const json = await res.json();
                if (!json.ok) {
                    logError('ShiftItems', 'Error auto-saving items', json.error);
                }
            } catch (e) {
                logError('ShiftItems', 'Error auto-saving items', e);
            } finally {
                setSavingItems(false);
            }
        }, 1000); // сохраняем через 1 секунду после последнего изменения

        return () => clearTimeout(timeoutId);
    }, [items, isOpen, isInitialLoad, isReadOnly, staffId]);

    return {
        items,
        setItems,
        expandedItems,
        setExpandedItems,
        savingItems,
    };
}


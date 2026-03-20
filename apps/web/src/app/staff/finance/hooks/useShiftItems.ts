// apps/web/src/app/staff/finance/hooks/useShiftItems.ts

import { useEffect, useState, useRef } from 'react';

import type { ShiftItem } from '../types';
import { isAbortError } from '../utils/networkRetry';
import {
    getShiftItemsJsonErrorMessage,
    getShiftItemsResponseErrorMessage,
    getShiftItemsThrownErrorMessage,
    postShiftItemsRequest,
} from './shiftItemsApi';
import {
    deduplicateShiftItems,
    filterShiftItemsToSave,
    removeExpandedItemIndex,
    serializeShiftItems,
} from './shiftItemsHelpers';
import { useShiftItemsAutosave } from './useShiftItemsAutosave';
import { useShiftItemsSync } from './useShiftItemsSync';

import { useToast } from '@/hooks/useToast';
import { logError } from '@/lib/log';


interface UseShiftItemsOptions {
    items: ShiftItem[];
    isOpen: boolean;
    isReadOnly: boolean;
    isInitialLoad: boolean;
    staffId?: string;
    shiftDate?: Date;
    onSaveSuccess?: () => void;
    onSaveError?: (error: string) => void;
}

interface UseShiftItemsReturn {
    items: ShiftItem[];
    setItems: React.Dispatch<React.SetStateAction<ShiftItem[]>>;
    expandedItems: Set<number>;
    setExpandedItems: React.Dispatch<React.SetStateAction<Set<number>>>;
    savingItems: boolean;
    addingClient: boolean;
    deletingClient: boolean;
    addClient: (newItem: Omit<ShiftItem, 'id'>) => Promise<void>;
    deleteClient: (idx: number) => Promise<void>;
}

/**
 * Хук для управления клиентами смены (items)
 */
export function useShiftItems({ 
    items: initialItems, 
    isOpen, 
    isReadOnly, 
    isInitialLoad,
    staffId,
    shiftDate,
    onSaveSuccess,
    onSaveError
}: UseShiftItemsOptions): UseShiftItemsReturn {
    const toast = useToast();
    const toastRef = useRef(toast);
    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);
    
    const [items, setItems] = useState<ShiftItem[]>(initialItems);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [savingItems, setSavingItems] = useState(false);
    const [addingClient, setAddingClient] = useState(false);
    const [deletingClient, setDeletingClient] = useState(false);
    const prevItemsRef = useRef<string>('');
    
    // Сохраняем callback в ref, чтобы избежать повторных вызовов useEffect
    const onSaveSuccessRef = useRef(onSaveSuccess);
    const onSaveErrorRef = useRef(onSaveError);
    useEffect(() => {
        onSaveSuccessRef.current = onSaveSuccess;
        onSaveErrorRef.current = onSaveError;
    }, [onSaveSuccess, onSaveError]);
    
    // Сохраняем предыдущее состояние для отката при ошибке
    const previousItemsRef = useRef<ShiftItem[]>([]);
    const restorePreviousItems = () => {
        if (previousItemsRef.current.length > 0) {
            setItems(previousItemsRef.current);
            prevItemsRef.current = serializeShiftItems(previousItemsRef.current);
        }
    };
    const collapseOptimisticNewClient = () => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            next.delete(0);
            return next;
        });
    };

    useShiftItemsSync({
        initialItems,
        isInitialLoad,
        prevItemsRef,
        setItems,
    });

    useShiftItemsAutosave({
        items,
        isOpen,
        isInitialLoad,
        isReadOnly,
        staffId,
        shiftDate,
        prevItemsRef,
        previousItemsRef,
        restorePreviousItems,
        onSaveSuccessRef,
        onSaveErrorRef,
        toastRef,
        setSavingItems,
    });

    // Функция для прямого добавления клиента с блокировкой экрана
    const addClient = async (newItem: Omit<ShiftItem, 'id'>) => {
        setAddingClient(true);
        // Сохраняем текущее состояние для отката при ошибке
        const previousItems = [...items];
        
        // Оптимистичное обновление UI - сразу добавляем клиента в список
        const newItemWithId: ShiftItem = { ...newItem, id: undefined };
        const optimisticItems: ShiftItem[] = [newItemWithId, ...items];
        setItems(optimisticItems);
        // Автоматически разворачиваем форму редактирования для нового клиента
        setExpandedItems((prev) => {
            const next = new Set(prev);
            // Добавляем индекс 0, так как новый клиент добавлен в начало списка
            next.add(0);
            return next;
        });
        
        try {
            // Используем оптимистично обновленный список для сохранения
            const newItems = optimisticItems;
            
            const itemsToSave = filterShiftItemsToSave(newItems);
            
            // Если после фильтрации не осталось элементов для сохранения, просто обновляем UI без запроса
            if (itemsToSave.length === 0) {
                setAddingClient(false);
                return; // Не отправляем запрос, если нет данных для сохранения
            }
            
            const deduplicatedItems = deduplicateShiftItems(itemsToSave);
            
            const res = await postShiftItemsRequest({
                items: deduplicatedItems,
                staffId,
                shiftDate,
                retries: 3,
                baseDelayMs: 1000,
                maxDelayMs: 10000,
                scope: 'ShiftItemsAddClient',
            });
            
            if (!res.ok) {
                const errorMessage = await getShiftItemsResponseErrorMessage(res, 'add');
                
                // Откатываем оптимистичное обновление при ошибке
                setItems(previousItems);
                collapseOptimisticNewClient();
                onSaveErrorRef.current?.(errorMessage);
                return;
            }
            
            const json = await res.json();
            
            if (!json.ok) {
                const errorMessage = getShiftItemsJsonErrorMessage(json, 'add');
                // Откатываем оптимистичное обновление при ошибке
                setItems(previousItems);
                collapseOptimisticNewClient();
                onSaveErrorRef.current?.(errorMessage);
                return;
            }
            
            // При успешном добавлении обновляем UI через перезагрузку данных
            // (оптимистичное обновление уже было применено, но нужно получить актуальные данные с сервера)
            onSaveSuccessRef.current?.();
        } catch (e) {
            // Игнорируем ошибки отмены запроса
            if (isAbortError(e)) {
                setAddingClient(false);
                return;
            }
            
            const errorMessage = getShiftItemsThrownErrorMessage(e, 'add');

            if (e instanceof Error && e.name === 'RateLimitError') {
                // Откатываем оптимистичное обновление при ошибке
                setItems(previousItems);
                collapseOptimisticNewClient();
                onSaveErrorRef.current?.(errorMessage);
                logError('ShiftItems', 'Rate limit exceeded when adding client', e);
                return;
            }
            
            logError('ShiftItems', 'Error adding client', e);
            // Откатываем оптимистичное обновление при ошибке
            setItems(previousItems);
            collapseOptimisticNewClient();
            onSaveErrorRef.current?.(errorMessage);
        } finally {
            setAddingClient(false);
        }
    };

    // Функция для прямого удаления клиента с блокировкой экрана
    const deleteClient = async (idx: number) => {
        setDeletingClient(true);
        // Сохраняем текущее состояние для отката при ошибке
        const previousItems = [...items];
        const previousExpandedItems = new Set(expandedItems);
        
        try {
            const itemToDelete = items[idx];
            
            // Если это новый клиент без id, просто удаляем его локально
            if (!itemToDelete.id) {
                setItems((prev) => prev.filter((_, i) => i !== idx));
                setExpandedItems((prev) => {
                    return removeExpandedItemIndex(prev, idx);
                });
                setDeletingClient(false);
                return;
            }
            
            // Оптимистичное обновление UI - сразу удаляем клиента из списка
            const newItems = items.filter((_, i) => i !== idx);
            setItems(newItems);
            setExpandedItems((prev) => {
                return removeExpandedItemIndex(prev, idx);
            });
            
            // Фильтруем items для сохранения (те же условия, что и в auto-save)
            const itemsToSave = filterShiftItemsToSave(newItems);
            
            // Дедупликация: удаляем items без id, если есть соответствующий item с id
            const deduplicatedItems = deduplicateShiftItems(itemsToSave);
            
            const res = await postShiftItemsRequest({
                items: deduplicatedItems,
                staffId,
                shiftDate,
                retries: 3,
                baseDelayMs: 1000,
                maxDelayMs: 10000,
                scope: 'ShiftItemsDeleteClient',
            });
            
            if (!res.ok) {
                const errorMessage = await getShiftItemsResponseErrorMessage(res, 'delete');
                
                // Откатываем оптимистичное обновление при ошибке
                setItems(previousItems);
                setExpandedItems(previousExpandedItems);
                onSaveErrorRef.current?.(errorMessage);
                return;
            }
            
            const json = await res.json();
            
            if (!json.ok) {
                const errorMessage = getShiftItemsJsonErrorMessage(json, 'delete');
                // Откатываем оптимистичное обновление при ошибке
                setItems(previousItems);
                setExpandedItems(previousExpandedItems);
                onSaveErrorRef.current?.(errorMessage);
                return;
            }
            
            // При успешном удалении обновляем UI через перезагрузку данных
            // (оптимистичное обновление уже было применено, но нужно получить актуальные данные с сервера)
            onSaveSuccessRef.current?.();
        } catch (e) {
            // Игнорируем ошибки отмены запроса
            if (isAbortError(e)) {
                setDeletingClient(false);
                return;
            }
            
            const errorMessage = getShiftItemsThrownErrorMessage(e, 'delete');

            if (e instanceof Error && e.name === 'RateLimitError') {
                // Откатываем оптимистичное обновление при ошибке
                setItems(previousItems);
                setExpandedItems(previousExpandedItems);
                onSaveErrorRef.current?.(errorMessage);
                logError('ShiftItems', 'Rate limit exceeded when deleting client', e);
                return;
            }
            
            logError('ShiftItems', 'Error deleting client', e);
            // Откатываем оптимистичное обновление при ошибке
            setItems(previousItems);
            setExpandedItems(previousExpandedItems);
            onSaveErrorRef.current?.(errorMessage);
        } finally {
            setDeletingClient(false);
        }
    };

    return {
        items,
        setItems,
        expandedItems,
        setExpandedItems,
        savingItems,
        addingClient,
        deletingClient,
        addClient,
        deleteClient,
    };
}


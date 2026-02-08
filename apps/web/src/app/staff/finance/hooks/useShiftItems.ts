// apps/web/src/app/staff/finance/hooks/useShiftItems.ts

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState, useRef } from 'react';

import type { ShiftItem } from '../types';

import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';


interface UseShiftItemsOptions {
    items: ShiftItem[];
    isOpen: boolean;
    isReadOnly: boolean;
    isInitialLoad: boolean;
    staffId?: string;
    shiftDate?: Date;
    onSaveSuccess?: () => void;
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
    staffId,
    shiftDate,
    onSaveSuccess
}: UseShiftItemsOptions): UseShiftItemsReturn {
    const [items, setItems] = useState<ShiftItem[]>(initialItems);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [savingItems, setSavingItems] = useState(false);
    
    // Сохраняем callback в ref, чтобы избежать повторных вызовов useEffect
    const onSaveSuccessRef = useRef(onSaveSuccess);
    useEffect(() => {
        onSaveSuccessRef.current = onSaveSuccess;
    }, [onSaveSuccess]);

    // Синхронизируем items с внешним состоянием с умным слиянием
    useEffect(() => {
        // Если это первая загрузка или items пустые, просто устанавливаем initialItems
        if (isInitialLoad || initialItems.length === 0) {
            setItems(initialItems);
            return;
        }

        // Умное слияние: сохраняем локальные изменения пользователя
        setItems((prevItems) => {
            // Создаем карту загруженных items по id
            const loadedById = new Map<string, typeof initialItems[0]>();
            const loadedWithoutId: typeof initialItems = [];
            
            for (const item of initialItems) {
                if (item.id) {
                    loadedById.set(item.id, item);
                } else {
                    loadedWithoutId.push(item);
                }
            }

            // Создаем карту локальных items по id и по ключам для новых items
            const localById = new Map<string, typeof prevItems[0]>();
            const localWithoutId: typeof prevItems = [];
            
            for (const item of prevItems) {
                if (item.id) {
                    localById.set(item.id, item);
                } else {
                    localWithoutId.push(item);
                }
            }

            const merged: typeof prevItems = [];

            // 1. Обрабатываем items с id: используем локальную версию, если она есть (сохраняем пользовательские изменения)
            for (const loadedItem of initialItems) {
                if (loadedItem.id) {
                    const localItem = localById.get(loadedItem.id);
                    if (localItem) {
                        // Используем локальную версию (с пользовательскими изменениями), но обновляем createdAt если изменился
                        merged.push({
                            ...localItem,
                            createdAt: loadedItem.createdAt || localItem.createdAt,
                        });
                    } else {
                        // Новый item с id, которого не было локально - добавляем
                        merged.push(loadedItem);
                    }
                }
            }

            // 2. Обрабатываем локальные items без id: пытаемся найти соответствие в загруженных данных
            for (const localItem of localWithoutId) {
                // Ищем соответствие по clientName и createdAt (с небольшой погрешностью) во всех загруженных items
                const localCreatedAt = localItem.createdAt ? new Date(localItem.createdAt).getTime() : 0;
                const allLoadedItems = [...Array.from(loadedById.values()), ...loadedWithoutId];
                const match = allLoadedItems.find((loadedItem) => {
                    if (loadedItem.clientName !== localItem.clientName) return false;
                    if (!loadedItem.createdAt || !localItem.createdAt) return false;
                    const loadedCreatedAt = new Date(loadedItem.createdAt).getTime();
                    // Считаем совпадением, если разница во времени меньше 5 секунд
                    return Math.abs(loadedCreatedAt - localCreatedAt) < 5000;
                });

                if (match && match.id) {
                    // Нашли соответствие - проверяем, не добавили ли мы его уже в merged
                    const alreadyAdded = merged.some((m) => m.id === match.id);
                    if (!alreadyAdded) {
                        // Обновляем id, сохраняя локальные изменения
                        merged.push({
                            ...localItem,
                            id: match.id,
                            createdAt: match.createdAt || localItem.createdAt,
                        });
                    }
                    // Если уже добавлен, пропускаем (не создаем дубликат)
                } else {
                    // Не нашли соответствие - это новый item, который еще не сохранен
                    merged.push(localItem);
                }
            }

            // Сортируем по createdAt (новые сверху), затем по id для стабильности
            merged.sort((a, b) => {
                // Сначала сортируем по createdAt (новые сверху)
                if (!a.createdAt && !b.createdAt) {
                    // Если оба без времени, сортируем по id (для стабильности)
                    if (!a.id && !b.id) return 0;
                    if (!a.id) return 1;
                    if (!b.id) return -1;
                    return b.id.localeCompare(a.id);
                }
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                // Если время одинаковое (в пределах 1 секунды), сортируем по id
                if (Math.abs(timeDiff) < 1000) {
                    if (!a.id && !b.id) return 0;
                    if (!a.id) return 1;
                    if (!b.id) return -1;
                    return b.id.localeCompare(a.id);
                }
                return timeDiff;
            });

            return merged;
        });
    }, [initialItems, isInitialLoad]);

    // Автосохранение клиентов при изменении (debounce)
    // Используем ref для отслеживания предыдущего состояния, чтобы избежать лишних сохранений
    const prevItemsRef = useRef<string>('');
    const isSavingRef = useRef(false);
    
    useEffect(() => {
        // Не сохраняем при первой загрузке, если смена закрыта, или в режиме просмотра
        if (isInitialLoad || !isOpen || isReadOnly) return;
        
        // Не сохраняем, если нет items для сохранения
        if (items.length === 0) return;
        
        // Проверяем, изменились ли items (сравниваем JSON строку)
        const itemsStr = JSON.stringify(items.map(it => ({ 
            id: it.id, 
            clientName: it.clientName, 
            serviceName: it.serviceName,
            serviceAmount: it.serviceAmount,
            consumablesAmount: it.consumablesAmount,
            bookingId: it.bookingId
        })));
        
        // Если items не изменились, не сохраняем
        if (itemsStr === prevItemsRef.current) {
            return;
        }
        
        // Если уже идет сохранение, не запускаем новое
        if (isSavingRef.current) {
            return;
        }
        
        prevItemsRef.current = itemsStr;
        
        const timeoutId = setTimeout(async () => {
            // Дополнительная проверка перед отправкой - если смена закрыта, не отправляем запрос
            // Это предотвращает ошибки 400 в консоли браузера
            if (!isOpen || isReadOnly) {
                return;
            }
            
            isSavingRef.current = true;
            setSavingItems(true);
            try {
                // Дедупликация: удаляем items без id, если есть соответствующий item с id
                const deduplicatedItems = items.filter((item, index, arr) => {
                    if (item.id) {
                        // Item с id - оставляем
                        return true;
                    }
                    // Item без id - проверяем, нет ли соответствующего item с id
                    const hasDuplicateWithId = arr.some((otherItem) => {
                        if (!otherItem.id) return false;
                        if (otherItem.clientName !== item.clientName) return false;
                        // Если createdAt совпадает или очень близко (в пределах 5 секунд)
                        if (item.createdAt && otherItem.createdAt) {
                            const itemTime = new Date(item.createdAt).getTime();
                            const otherTime = new Date(otherItem.createdAt).getTime();
                            return Math.abs(itemTime - otherTime) < 5000;
                        }
                        return false;
                    });
                    // Оставляем только если нет дубликата с id
                    return !hasDuplicateWithId;
                });

                // Форматируем дату для передачи в API
                const dateStr = shiftDate ? formatInTimeZone(shiftDate, TZ, 'yyyy-MM-dd') : undefined;
                
                const res = await fetch('/api/staff/shift/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        items: deduplicatedItems, 
                        staffId: staffId || undefined,
                        shiftDate: dateStr
                    }),
                });
                const json = await res.json();
                if (!json.ok) {
                    // Не логируем ошибку, если смена не открыта - это нормальная ситуация
                    // (например, владелец просматривает закрытую смену)
                    if (json.error && typeof json.error === 'string' && json.error.includes('Нет открытой смены')) {
                        // Игнорируем эту ошибку - смена закрыта или не существует
                        return;
                    }
                    logError('ShiftItems', 'Error auto-saving items', json.error);
                } else {
                    // Перезагружаем данные только если нет локальных items без id
                    // (то есть все изменения сохранены и пользователь не редактирует)
                    const hasUnsavedItems = deduplicatedItems.some((it) => !it.id);
                    if (!hasUnsavedItems) {
                        // Вызываем callback после успешного сохранения для перезагрузки данных
                        // Используем setTimeout и ref, чтобы избежать вызова во время рендера и бесконечных циклов
                        setTimeout(() => {
                            onSaveSuccessRef.current?.();
                        }, 100);
                    }
                }
            } catch (e) {
                logError('ShiftItems', 'Error auto-saving items', e);
            } finally {
                isSavingRef.current = false;
                setSavingItems(false);
            }
        }, 1000); // сохраняем через 1 секунду после последнего изменения

        return () => clearTimeout(timeoutId);
    }, [items, isOpen, isInitialLoad, isReadOnly, staffId]);
    
    // Используем строковое представление даты для зависимостей, чтобы избежать пересоздания объекта Date
    const shiftDateStr = shiftDate ? formatInTimeZone(shiftDate, TZ, 'yyyy-MM-dd') : undefined;
    
    // Обновляем prevItemsRef при изменении даты, чтобы сбросить проверку
    useEffect(() => {
        prevItemsRef.current = '';
    }, [shiftDateStr]);

    return {
        items,
        setItems,
        expandedItems,
        setExpandedItems,
        savingItems,
    };
}


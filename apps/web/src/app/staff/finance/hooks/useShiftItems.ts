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
    onSaveError?: (error: string) => void;
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
    onSaveSuccess,
    onSaveError
}: UseShiftItemsOptions): UseShiftItemsReturn {
    const [items, setItems] = useState<ShiftItem[]>(initialItems);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [savingItems, setSavingItems] = useState(false);
    
    // Сохраняем callback в ref, чтобы избежать повторных вызовов useEffect
    const onSaveSuccessRef = useRef(onSaveSuccess);
    const onSaveErrorRef = useRef(onSaveError);
    useEffect(() => {
        onSaveSuccessRef.current = onSaveSuccess;
        onSaveErrorRef.current = onSaveError;
    }, [onSaveSuccess, onSaveError]);
    
    // Сохраняем предыдущее состояние для отката при ошибке
    const previousItemsRef = useRef<ShiftItem[]>([]);

    // Синхронизируем items с внешним состоянием с умным слиянием
    useEffect(() => {
        // Если это первая загрузка или items пустые, просто устанавливаем initialItems
        if (isInitialLoad || initialItems.length === 0) {
            setItems(initialItems);
            // Инициализируем prevItemsRef при первой загрузке, чтобы избежать отправки запроса
            if (isInitialLoad) {
                const itemsStr = JSON.stringify(initialItems.map(it => ({ 
                    id: it.id, 
                    clientName: it.clientName, 
                    serviceName: it.serviceName,
                    serviceAmount: it.serviceAmount,
                    consumablesAmount: it.consumablesAmount,
                    bookingId: it.bookingId
                })));
                prevItemsRef.current = itemsStr;
            }
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

            // Обновляем prevItemsRef сразу после слияния, чтобы избежать отправки запроса
            const mergedStr = JSON.stringify(merged.map(it => ({ 
                id: it.id, 
                clientName: it.clientName, 
                serviceName: it.serviceName,
                serviceAmount: it.serviceAmount,
                consumablesAmount: it.consumablesAmount,
                bookingId: it.bookingId
            })));
            // Используем setTimeout, чтобы обновить ref после того, как setItems выполнится
            setTimeout(() => {
                prevItemsRef.current = mergedStr;
            }, 0);
            
            return merged;
        });
    }, [initialItems, isInitialLoad]);

    // Автосохранение клиентов при изменении (debounce)
    // Используем ref для отслеживания предыдущего состояния, чтобы избежать лишних сохранений
    const prevItemsRef = useRef<string>('');
    const isSavingRef = useRef(false);
    // AbortController для отмены предыдущих запросов сохранения
    const saveAbortControllerRef = useRef<AbortController | null>(null);
    // Отслеживаем последний сохраненный items для предотвращения дублирующихся запросов
    const lastSavedItemsRef = useRef<string>('');
    // Таймаут для debounce
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    useEffect(() => {
        // Не сохраняем при первой загрузке, если смена закрыта, или в режиме просмотра
        if (isInitialLoad || !isOpen || isReadOnly) {
            // Обновляем prevItemsRef, чтобы при следующем изменении не отправлять запрос
            if (!isInitialLoad) {
                const itemsStr = JSON.stringify(items.map(it => ({ 
                    id: it.id, 
                    clientName: it.clientName, 
                    serviceName: it.serviceName,
                    serviceAmount: it.serviceAmount,
                    consumablesAmount: it.consumablesAmount,
                    bookingId: it.bookingId
                })));
                prevItemsRef.current = itemsStr;
            }
            return;
        }
        
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
        
        // Отменяем предыдущий таймаут, если он есть
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        // Отменяем предыдущий запрос сохранения, если он еще выполняется
        if (saveAbortControllerRef.current) {
            saveAbortControllerRef.current.abort();
        }
        
        // Проверяем, не сохраняем ли мы те же данные
        if (itemsStr === lastSavedItemsRef.current) {
            prevItemsRef.current = itemsStr;
            return;
        }
        
        // Сохраняем текущее состояние перед отправкой для возможного отката
        // Всегда сохраняем, чтобы можно было откатить при ошибке
        previousItemsRef.current = [...items];
        prevItemsRef.current = itemsStr;
        
        // Создаем новый AbortController для этого запроса сохранения
        const abortController = new AbortController();
        saveAbortControllerRef.current = abortController;
        
        saveTimeoutRef.current = setTimeout(async () => {
            // Проверяем, не был ли запрос отменен
            if (abortController.signal.aborted) {
                return;
            }
            
            // Дополнительная проверка перед отправкой - если смена закрыта, не отправляем запрос
            // Это предотвращает ошибки 400 в консоли браузера
            if (!isOpen || isReadOnly) {
                saveAbortControllerRef.current = null;
                return;
            }
            
            // Проверяем, не изменились ли items снова (еще одна проверка на актуальность)
            const currentItemsStr = JSON.stringify(items.map(it => ({ 
                id: it.id, 
                clientName: it.clientName, 
                serviceName: it.serviceName,
                serviceAmount: it.serviceAmount,
                consumablesAmount: it.consumablesAmount,
                bookingId: it.bookingId
            })));
            
            if (currentItemsStr !== itemsStr) {
                // Items изменились, не сохраняем старую версию
                saveAbortControllerRef.current = null;
                return;
            }
            
            // Проверяем, не сохраняем ли мы те же данные (еще одна проверка)
            if (currentItemsStr === lastSavedItemsRef.current) {
                saveAbortControllerRef.current = null;
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
                
                // Проверяем, не был ли запрос отменен перед отправкой
                if (abortController.signal.aborted) {
                    return;
                }
                
                const res = await fetch('/api/staff/shift/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        items: deduplicatedItems, 
                        staffId: staffId || undefined,
                        shiftDate: dateStr
                    }),
                    signal: abortController.signal,
                });
                
                // Проверяем, не был ли запрос отменен после получения ответа
                if (abortController.signal.aborted) {
                    return;
                }
                
                // Проверяем HTTP статус перед парсингом JSON
                if (!res.ok) {
                    let errorMessage = 'Не удалось сохранить изменения';
                    
                    // Пытаемся получить сообщение об ошибке из ответа
                    try {
                        const errorJson = await res.json();
                        if (errorJson?.error) {
                            errorMessage = errorJson.error;
                        } else if (errorJson?.message) {
                            errorMessage = errorJson.message;
                        }
                    } catch {
                        // Если не удалось распарсить JSON, используем стандартные сообщения по статусу
                    }
                    
                    // Улучшенные сообщения для разных HTTP статусов
                    if (res.status === 404) {
                        errorMessage = 'Смена не найдена. Возможно, смена была закрыта или удалена.';
                    } else if (res.status === 401) {
                        errorMessage = 'Сессия истекла. Пожалуйста, войдите в систему снова.';
                    } else if (res.status === 403) {
                        errorMessage = 'У вас нет прав для сохранения изменений.';
                    } else if (res.status === 400) {
                        errorMessage = errorMessage || 'Некорректные данные. Проверьте введенную информацию.';
                    } else if (res.status === 429) {
                        errorMessage = 'Слишком много запросов. Пожалуйста, подождите немного.';
                    } else if (res.status >= 500) {
                        errorMessage = 'Временная ошибка сервера. Изменения не были сохранены. Попробуйте снова через несколько секунд.';
                    } else if (res.status >= 400) {
                        errorMessage = errorMessage || 'Ошибка при сохранении. Проверьте подключение к интернету.';
                    }
                    
                    // Если смена закрыта или не найдена - откатываем изменения
                    // Это важно, чтобы UI соответствовал реальному состоянию на сервере
                    if (errorMessage.includes('Нет открытой смены') || errorMessage.includes('закрыта') || errorMessage.includes('не найдена')) {
                        // Откатываем изменения, если есть сохраненное состояние
                        if (previousItemsRef.current.length > 0) {
                            setItems(previousItemsRef.current);
                            const previousItemsStr = JSON.stringify(previousItemsRef.current.map(it => ({ 
                                id: it.id, 
                                clientName: it.clientName, 
                                serviceName: it.serviceName,
                                serviceAmount: it.serviceAmount,
                                consumablesAmount: it.consumablesAmount,
                                bookingId: it.bookingId
                            })));
                            prevItemsRef.current = previousItemsStr;
                        }
                        onSaveErrorRef.current?.(errorMessage);
                        return;
                    }
                    
                    // Для других ошибок откатываем изменения только если есть сохраненное состояние
                    if (previousItemsRef.current.length > 0) {
                        setItems(previousItemsRef.current);
                        const previousItemsStr = JSON.stringify(previousItemsRef.current.map(it => ({ 
                            id: it.id, 
                            clientName: it.clientName, 
                            serviceName: it.serviceName,
                            serviceAmount: it.serviceAmount,
                            consumablesAmount: it.consumablesAmount,
                            bookingId: it.bookingId
                        })));
                        prevItemsRef.current = previousItemsStr;
                    }
                    
                    logError('ShiftItems', 'Error auto-saving items', { error: errorMessage, status: res.status });
                    onSaveErrorRef.current?.(errorMessage);
                    saveAbortControllerRef.current = null;
                    return;
                }
                
                // Проверяем, не был ли запрос отменен перед парсингом JSON
                if (abortController.signal.aborted) {
                    return;
                }
                
                const json = await res.json();
                
                // Проверяем, не был ли запрос отменен после парсинга
                if (abortController.signal.aborted) {
                    return;
                }
                
                if (!json.ok) {
                    // Показываем ошибку пользователю
                    const errorMessage = json.error && typeof json.error === 'string' 
                        ? json.error 
                        : 'Не удалось сохранить изменения';
                    
                    // Если смена закрыта или не найдена - откатываем изменения
                    if (errorMessage.includes('Нет открытой смены') || errorMessage.includes('закрыта') || errorMessage.includes('не найдена')) {
                        if (previousItemsRef.current.length > 0) {
                            setItems(previousItemsRef.current);
                            const previousItemsStr = JSON.stringify(previousItemsRef.current.map(it => ({ 
                                id: it.id, 
                                clientName: it.clientName, 
                                serviceName: it.serviceName,
                                serviceAmount: it.serviceAmount,
                                consumablesAmount: it.consumablesAmount,
                                bookingId: it.bookingId
                            })));
                            prevItemsRef.current = previousItemsStr;
                        }
                        onSaveErrorRef.current?.(errorMessage);
                        return;
                    }
                    
                    // Для других ошибок откатываем изменения
                    if (previousItemsRef.current.length > 0) {
                        setItems(previousItemsRef.current);
                        const previousItemsStr = JSON.stringify(previousItemsRef.current.map(it => ({ 
                            id: it.id, 
                            clientName: it.clientName, 
                            serviceName: it.serviceName,
                            serviceAmount: it.serviceAmount,
                            consumablesAmount: it.consumablesAmount,
                            bookingId: it.bookingId
                        })));
                        prevItemsRef.current = previousItemsStr;
                    }
                    
                    logError('ShiftItems', 'Error auto-saving items', json.error);
                    onSaveErrorRef.current?.(errorMessage);
                    saveAbortControllerRef.current = null;
                } else {
                    // При успешном сохранении обновляем lastSavedItemsRef
                    lastSavedItemsRef.current = currentItemsStr;
                    
                    // При успешном сохранении всегда перезагружаем данные с сервера
                    // Это гарантирует, что UI обновляется только после успешного сохранения
                    // Используем setTimeout и ref, чтобы избежать вызова во время рендера и бесконечных циклов
                    setTimeout(() => {
                        if (!abortController.signal.aborted) {
                            onSaveSuccessRef.current?.();
                        }
                    }, 100);
                    saveAbortControllerRef.current = null;
                }
            } catch (e) {
                // Откатываем изменения при ошибке только если есть сохраненное состояние
                if (previousItemsRef.current.length > 0) {
                    setItems(previousItemsRef.current);
                    const previousItemsStr = JSON.stringify(previousItemsRef.current.map(it => ({ 
                        id: it.id, 
                        clientName: it.clientName, 
                        serviceName: it.serviceName,
                        serviceAmount: it.serviceAmount,
                        consumablesAmount: it.consumablesAmount,
                        bookingId: it.bookingId
                    })));
                    prevItemsRef.current = previousItemsStr;
                }
                
                // Улучшенная обработка различных типов ошибок
                let errorMessage = 'Не удалось сохранить изменения';
                
                if (e instanceof TypeError) {
                    if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed to fetch')) {
                        errorMessage = 'Ошибка подключения к серверу. Проверьте подключение к интернету и попробуйте снова.';
                    } else {
                        errorMessage = 'Ошибка при сохранении. Попробуйте обновить страницу.';
                    }
                } else if (e instanceof Error) {
                    if (e.message) {
                        errorMessage = e.message;
                    } else {
                        errorMessage = 'Произошла ошибка при сохранении. Попробуйте снова.';
                    }
                } else {
                    errorMessage = 'Произошла неожиданная ошибка. Попробуйте обновить страницу.';
                }
                
                logError('ShiftItems', 'Error auto-saving items', e);
                onSaveErrorRef.current?.(errorMessage);
            } finally {
                isSavingRef.current = false;
                setSavingItems(false);
                // Очищаем AbortController только если это был последний запрос
                if (saveAbortControllerRef.current === abortController) {
                    saveAbortControllerRef.current = null;
                }
            }
        }, 1000); // сохраняем через 1 секунду после последнего изменения

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            // Отменяем запрос при размонтировании или изменении зависимостей
            if (saveAbortControllerRef.current) {
                saveAbortControllerRef.current.abort();
                saveAbortControllerRef.current = null;
            }
        };
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


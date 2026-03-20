import { Alert } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';
import { logDebug, logError } from '../../lib/log';
import { getShiftTotals } from './calculations';
import { addToOfflineQueue, clearOfflineQueue, getOfflineQueue } from './storage';
import type { FinanceData, ShiftItem } from './types';

type UseShiftQuickOperationsOptions = {
    financeData?: FinanceData | null;
    refetch: () => Promise<unknown>;
};

export function useShiftQuickOperations({
    financeData,
    refetch,
}: UseShiftQuickOperationsOptions) {
    const queryClient = useQueryClient();
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

    const processOfflineQueue = useCallback(async () => {
        if (isProcessingQueue) return;
        setIsProcessingQueue(true);

        try {
            const queue = await getOfflineQueue();
            if (queue.length === 0) {
                setIsProcessingQueue(false);
                return;
            }

            logDebug('ShiftQuickScreen', 'Processing offline queue', { count: queue.length });

            for (const operation of queue) {
                try {
                    if (operation.type === 'open') {
                        await apiRequest('/api/staff/shift/open', { method: 'POST' });
                    } else if (operation.type === 'close') {
                        await apiRequest('/api/staff/shift/close', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(operation.data),
                        });
                    } else if (operation.type === 'addItem' || operation.type === 'updateItem') {
                        await apiRequest('/api/staff/shift/items', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(operation.data),
                        });
                    }
                } catch (error) {
                    logError('ShiftQuickScreen', `Failed to process operation ${operation.type}`, error);
                }
            }

            await clearOfflineQueue();
            await refetch();
        } catch (error) {
            logError('ShiftQuickScreen', 'Error processing offline queue', error);
        } finally {
            setIsProcessingQueue(false);
        }
    }, [isProcessingQueue, refetch]);

    useEffect(() => {
        processOfflineQueue();
        const interval = setInterval(processOfflineQueue, 30000);
        return () => clearInterval(interval);
    }, [processOfflineQueue]);

    const openShiftMutation = useMutation({
        mutationFn: async () => {
            try {
                const response = await apiRequest<{ ok: boolean; shift: unknown }>('/api/staff/shift/open', {
                    method: 'POST',
                });
                if (!response.ok) {
                    throw new Error('Failed to open shift');
                }
                return response;
            } catch (error) {
                await addToOfflineQueue({
                    type: 'open',
                    data: {},
                    timestamp: new Date().toISOString(),
                });
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-finance'] });
            Alert.alert('Успешно', 'Смена открыта');
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Не удалось открыть смену';
            Alert.alert('Ошибка', message);
        },
    });

    const closeShiftMutation = useMutation({
        mutationFn: async () => {
            const items = financeData?.today.items || [];
            const { totalAmount, totalConsumables: consumablesAmount } = getShiftTotals(items);

            const payload = {
                items: items.map((item) => ({
                    id: item.id,
                    clientName: item.clientName,
                    serviceName: item.serviceName,
                    serviceAmount: item.serviceAmount,
                    consumablesAmount: item.consumablesAmount,
                    bookingId: item.bookingId,
                })),
                totalAmount,
                consumablesAmount,
            };

            try {
                const response = await apiRequest<{ ok: boolean; shift: unknown }>('/api/staff/shift/close', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!response.ok) {
                    throw new Error('Failed to close shift');
                }
                return response;
            } catch (error) {
                await addToOfflineQueue({
                    type: 'close',
                    data: payload,
                    timestamp: new Date().toISOString(),
                });
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-finance'] });
            Alert.alert('Успешно', 'Смена закрыта');
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Не удалось закрыть смену';
            Alert.alert('Ошибка', message);
        },
    });

    const addClientMutation = useMutation({
        mutationFn: async (newItem: Omit<ShiftItem, 'id' | 'createdAt'>) => {
            const currentItems = financeData?.today.items || [];
            const updatedItems = [...currentItems, { ...newItem, id: undefined }];

            const payload = {
                items: updatedItems.map((item) => ({
                    id: item.id,
                    clientName: item.clientName,
                    serviceName: item.serviceName,
                    serviceAmount: item.serviceAmount,
                    consumablesAmount: item.consumablesAmount,
                    bookingId: item.bookingId,
                })),
            };

            try {
                const response = await apiRequest<{ ok: boolean }>('/api/staff/shift/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!response.ok) {
                    throw new Error('Failed to add client');
                }
                return response;
            } catch (error) {
                await addToOfflineQueue({
                    type: 'addItem',
                    data: payload,
                    timestamp: new Date().toISOString(),
                });
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-finance'] });
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Не удалось добавить клиента';
            Alert.alert('Ошибка', message);
        },
    });

    const handleOpenShift = useCallback(() => {
        if (financeData?.isDayOff) {
            Alert.alert('Выходной день', 'Сегодня у вас выходной день. Нельзя открыть смену.');
            return;
        }
        openShiftMutation.mutate();
    }, [financeData?.isDayOff, openShiftMutation]);

    const handleCloseShift = useCallback(() => {
        Alert.alert(
            'Закрыть смену?',
            'После закрытия смены вы не сможете добавлять клиентов. Продолжить?',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Закрыть',
                    style: 'destructive',
                    onPress: () => closeShiftMutation.mutate(),
                },
            ]
        );
    }, [closeShiftMutation]);

    const onRefresh = useCallback(async () => {
        await Promise.all([refetch(), processOfflineQueue()]);
    }, [processOfflineQueue, refetch]);

    return {
        isProcessingQueue,
        openShiftMutation,
        closeShiftMutation,
        addClientMutation,
        handleOpenShift,
        handleCloseShift,
        onRefresh,
    };
}

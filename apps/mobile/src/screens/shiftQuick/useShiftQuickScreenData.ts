import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { apiRequest } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { logDebug, logError } from '../../lib/log';
import { supabase } from '../../lib/supabase';
import {
    addToOfflineQueue,
    getOfflineQueue,
    getShiftCache,
    saveOfflineQueue,
    saveShiftCache,
} from './offlineStorage';
import type { FinanceData, ShiftItem, ShiftQuickMetrics } from './types';

type StaffInfo = {
    id: string;
    full_name: string;
};

type MutationResult = {
    queued: boolean;
};

type ShiftItemInput = Omit<ShiftItem, 'id' | 'createdAt'>;

function serializeShiftItems(items: ShiftItem[]) {
    return items.map((item) => ({
        id: item.id,
        clientName: item.clientName,
        serviceName: item.serviceName,
        serviceAmount: item.serviceAmount,
        consumablesAmount: item.consumablesAmount,
        bookingId: item.bookingId,
    }));
}

export function useShiftQuickScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);
    const [pendingQueueCount, setPendingQueueCount] = useState(0);
    const isProcessingQueueRef = useRef(false);
    const { user } = useAuth();
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    const refreshQueueCount = useCallback(async () => {
        const queue = await getOfflineQueue();
        setPendingQueueCount(queue.length);
    }, []);

    const { data: staffInfo } = useQuery({
        queryKey: ['staff-info', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;

            const { data, error } = await supabase
                .from('staff')
                .select('id, full_name')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();

            if (error) throw error;
            return data as StaffInfo | null;
        },
        enabled: !!user?.id,
    });

    const financeQuery = useQuery({
        queryKey: ['staff-finance', staffInfo?.id],
        queryFn: async () => {
            if (!staffInfo?.id) return null;

            try {
                const response = await apiRequest<{ ok: boolean; data: FinanceData }>('/api/staff/finance');
                if (!response.ok) {
                    throw new Error('Failed to load shift data');
                }

                await saveShiftCache(response.data);
                return response.data;
            } catch (error) {
                logDebug('ShiftQuickScreen', 'Network error, loading from cache', error);
                const cached = await getShiftCache();
                if (cached) {
                    return cached;
                }
                throw error;
            }
        },
        enabled: !!staffInfo?.id,
        retry: 1,
        staleTime: 5 * 1000,
    });
    const refetchFinance = financeQuery.refetch;

    const processOfflineQueue = useCallback(async () => {
        if (isProcessingQueueRef.current) return;
        isProcessingQueueRef.current = true;
        setIsProcessingQueue(true);

        try {
            const queue = await getOfflineQueue();
            setPendingQueueCount(queue.length);
            if (queue.length === 0) {
                return;
            }

            logDebug('ShiftQuickScreen', 'Processing offline queue', { count: queue.length });
            const failedOperations: typeof queue = [];

            for (const [index, operation] of queue.entries()) {
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
                    failedOperations.push(...queue.slice(index));
                    logDebug('ShiftQuickScreen', `Offline operation remains queued: ${operation.type}`, error);
                    break;
                }
            }

            await saveOfflineQueue(failedOperations);
            setPendingQueueCount(failedOperations.length);
            if (failedOperations.length < queue.length) {
                await refetchFinance();
            }
        } catch (error) {
            logError('ShiftQuickScreen', 'Error processing offline queue', error);
            await refreshQueueCount();
        } finally {
            isProcessingQueueRef.current = false;
            setIsProcessingQueue(false);
        }
    }, [refetchFinance, refreshQueueCount]);

    useEffect(() => {
        void refreshQueueCount();
        processOfflineQueue();
        const interval = setInterval(processOfflineQueue, 30000);
        return () => clearInterval(interval);
    }, [processOfflineQueue, refreshQueueCount]);

    const openShiftMutation = useMutation({
        mutationFn: async (): Promise<MutationResult> => {
            try {
                const response = await apiRequest<{ ok: boolean; shift: unknown }>('/api/staff/shift/open', {
                    method: 'POST',
                });
                if (!response.ok) {
                    throw new Error('Failed to open shift');
                }
                return { queued: false };
            } catch (error) {
                await addToOfflineQueue({
                    type: 'open',
                    data: {},
                    timestamp: new Date().toISOString(),
                });
                return { queued: true };
            }
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['staff-finance'] });
            if (result.queued) {
                void refreshQueueCount();
            }
            showToast(
                result.queued
                    ? 'Открытие смены сохранено в очередь и будет синхронизировано после восстановления связи.'
                    : 'РЎРјРµРЅР° РѕС‚РєСЂС‹С‚Р°.',
                result.queued ? 'warning' : 'success',
            );
        },
        onError: (error) => {
            showToast(
                getErrorMessage(error, 'Не удалось открыть смену. Попробуйте снова.'),
                'error',
            );
        },
    });

    const closeShiftMutation = useMutation({
        mutationFn: async (): Promise<MutationResult> => {
            const items = financeQuery.data?.today.items || [];
            const totalAmount = items.reduce((sum, item) => sum + (item.serviceAmount || 0), 0);
            const consumablesAmount = items.reduce((sum, item) => sum + (item.consumablesAmount || 0), 0);

            const payload = {
                items: serializeShiftItems(items),
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
                return { queued: false };
            } catch (error) {
                await addToOfflineQueue({
                    type: 'close',
                    data: payload,
                    timestamp: new Date().toISOString(),
                });
                return { queued: true };
            }
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['staff-finance'] });
            if (result.queued) {
                void refreshQueueCount();
            }
            showToast(
                result.queued
                    ? 'Закрытие смены сохранено в очередь и будет синхронизировано после восстановления связи.'
                    : 'РЎРјРµРЅР° Р·Р°РєСЂС‹С‚Р°.',
                result.queued ? 'warning' : 'success',
            );
        },
        onError: (error) => {
            showToast(
                getErrorMessage(error, 'Не удалось закрыть смену. Попробуйте снова.'),
                'error',
            );
        },
    });

    const addClientMutation = useMutation({
        mutationFn: async (newItem: ShiftItemInput): Promise<MutationResult> => {
            const currentItems = financeQuery.data?.today.items || [];
            const updatedItems = [...currentItems, { ...newItem, id: undefined }];

            const payload = {
                items: serializeShiftItems(updatedItems),
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
                return { queued: false };
            } catch (error) {
                await addToOfflineQueue({
                    type: 'addItem',
                    data: payload,
                    timestamp: new Date().toISOString(),
                });
                return { queued: true };
            }
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['staff-finance'] });
            if (result.queued) {
                void refreshQueueCount();
            }
        },
    });

    const updateClientMutation = useMutation({
        mutationFn: async ({
            itemIndex,
            item,
        }: {
            itemIndex: number;
            item: ShiftItemInput;
        }): Promise<MutationResult> => {
            const currentItems = financeQuery.data?.today.items || [];
            const existingItem = currentItems[itemIndex];
            if (!existingItem) {
                throw new Error('Shift item not found');
            }

            const updatedItems = currentItems.map((currentItem, index) =>
                index === itemIndex
                    ? {
                          ...currentItem,
                          ...item,
                          id: currentItem.id,
                          createdAt: currentItem.createdAt,
                      }
                    : currentItem,
            );

            const payload = {
                items: serializeShiftItems(updatedItems),
            };

            try {
                const response = await apiRequest<{ ok: boolean }>('/api/staff/shift/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!response.ok) {
                    throw new Error('Failed to update client');
                }
                return { queued: false };
            } catch (error) {
                await addToOfflineQueue({
                    type: 'updateItem',
                    data: payload,
                    timestamp: new Date().toISOString(),
                });
                return { queued: true };
            }
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['staff-finance'] });
            if (result.queued) {
                void refreshQueueCount();
            }
        },
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([financeQuery.refetch(), processOfflineQueue()]);
        await refreshQueueCount();
        setRefreshing(false);
    }, [financeQuery, processOfflineQueue, refreshQueueCount]);

    const metrics = useMemo<ShiftQuickMetrics>(() => {
        const items = financeQuery.data?.today.items || [];
        const totalAmount = items.reduce((sum, item) => sum + (item.serviceAmount || 0), 0);
        const totalConsumables = items.reduce((sum, item) => sum + (item.consumablesAmount || 0), 0);
        const percentMaster = financeQuery.data?.staffPercentMaster || 60;
        const percentSalon = financeQuery.data?.staffPercentSalon || 40;
        const normalizedMaster = (percentMaster / (percentMaster + percentSalon)) * 100;
        const baseMasterShare = Math.round((totalAmount * normalizedMaster) / 100);
        const currentGuaranteed = financeQuery.data?.currentGuaranteedAmount || 0;
        const finalMasterShare = currentGuaranteed > baseMasterShare ? currentGuaranteed : baseMasterShare;
        const topupAmount = Math.max(0, currentGuaranteed - baseMasterShare);
        const baseSalonShare = totalAmount - baseMasterShare + totalConsumables;
        const finalSalonShare = Math.max(0, baseSalonShare - topupAmount);

        return {
            totalAmount,
            totalConsumables,
            finalMasterShare,
            finalSalonShare,
            topupAmount,
            baseMasterShare,
            currentGuaranteed,
        };
    }, [financeQuery.data]);

    return {
        staffInfo,
        financeData: financeQuery.data,
        isLoading: financeQuery.isLoading,
        error: financeQuery.error,
        refreshing,
        isProcessingQueue,
        pendingQueueCount,
        metrics,
        openShiftMutation,
        closeShiftMutation,
        addClientMutation,
        updateClientMutation,
        onRefresh,
    };
}

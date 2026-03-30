import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { apiRequest } from '../../lib/api';
import { logDebug, logError } from '../../lib/log';
import { supabase } from '../../lib/supabase';
import { addToOfflineQueue, clearOfflineQueue, getOfflineQueue, getShiftCache, saveShiftCache } from './offlineStorage';
import type { FinanceData, ShiftItem, ShiftQuickMetrics } from './types';

type StaffInfo = {
    id: string;
    full_name: string;
};

export function useShiftQuickScreenData() {
    const [refreshing, setRefreshing] = useState(false);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);
    const { user } = useAuth();
    const queryClient = useQueryClient();

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

    const processOfflineQueue = useCallback(async () => {
        if (isProcessingQueue) return;
        setIsProcessingQueue(true);

        try {
            const queue = await getOfflineQueue();
            if (queue.length === 0) {
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
            await financeQuery.refetch();
        } catch (error) {
            logError('ShiftQuickScreen', 'Error processing offline queue', error);
        } finally {
            setIsProcessingQueue(false);
        }
    }, [financeQuery, isProcessingQueue]);

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
            const items = financeQuery.data?.today.items || [];
            const totalAmount = items.reduce((sum, item) => sum + (item.serviceAmount || 0), 0);
            const consumablesAmount = items.reduce((sum, item) => sum + (item.consumablesAmount || 0), 0);

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
            const currentItems = financeQuery.data?.today.items || [];
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
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([financeQuery.refetch(), processOfflineQueue()]);
        setRefreshing(false);
    }, [financeQuery, processOfflineQueue]);

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
        const baseSalonShare = Math.round((totalAmount * (100 - normalizedMaster)) / 100) + totalConsumables;
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
        metrics,
        openShiftMutation,
        closeShiftMutation,
        addClientMutation,
        onRefresh,
    };
}

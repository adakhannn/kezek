import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import { formatDate, formatTime } from '../utils/format';
import { formatPrice } from '../utils/format';
import { apiRequest } from '../lib/api';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import EmptyState from '../components/ui/EmptyState';
import { logError, logDebug } from '../lib/log';

type ShiftQuickScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

type ShiftItem = {
    id?: string;
    clientName: string;
    serviceName: string;
    serviceAmount: number;
    consumablesAmount: number;
    bookingId?: string | null;
    createdAt?: string | null;
};

type TodayShift = {
    exists: boolean;
    status: 'open' | 'closed' | 'none';
    shift: {
        id: string;
        shift_date: string;
        status: 'open' | 'closed';
        opened_at: string | null;
        total_amount: number;
        consumables_amount: number;
        master_share: number;
        salon_share: number;
        hours_worked: number | null;
        hourly_rate: number | null;
        guaranteed_amount: number;
    } | null;
    items: ShiftItem[];
};

type FinanceData = {
    today: TodayShift;
    staffPercentMaster: number;
    staffPercentSalon: number;
    hourlyRate: number | null;
    currentHoursWorked: number | null;
    currentGuaranteedAmount: number | null;
    isDayOff: boolean;
};

const OFFLINE_QUEUE_KEY = 'shift_offline_queue';
const OFFLINE_CACHE_KEY = 'shift_offline_cache';

/**
 * Офлайн-очередь для операций со сменой
 */
async function addToOfflineQueue(operation: {
    type: 'open' | 'close' | 'addItem' | 'updateItem' | 'deleteItem';
    data: unknown;
    timestamp: string;
}) {
    try {
        const existing = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
        const queue = existing ? JSON.parse(existing) : [];
        queue.push(operation);
        await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        logDebug('ShiftQuickScreen', 'Added to offline queue', { type: operation.type });
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to add to offline queue', error);
    }
}

/**
 * Получает очередь офлайн-операций
 */
async function getOfflineQueue(): Promise<Array<{ type: string; data: unknown; timestamp: string }>> {
    try {
        const existing = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
        return existing ? JSON.parse(existing) : [];
    } catch {
        return [];
    }
}

/**
 * Очищает очередь офлайн-операций
 */
async function clearOfflineQueue() {
    try {
        await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to clear offline queue', error);
    }
}

/**
 * Сохраняет кэш данных смены
 */
async function saveShiftCache(data: FinanceData) {
    try {
        await SecureStore.setItemAsync(OFFLINE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
        logError('ShiftQuickScreen', 'Failed to save shift cache', error);
    }
}

/**
 * Получает кэш данных смены
 */
async function getShiftCache(): Promise<FinanceData | null> {
    try {
        const cached = await SecureStore.getItemAsync(OFFLINE_CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
    } catch {
        return null;
    }
}

export default function ShiftQuickScreen() {
    const navigation = useNavigation<ShiftQuickScreenNavigationProp>();
    const [refreshing, setRefreshing] = useState(false);
    const [showAddClient, setShowAddClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newServiceName, setNewServiceName] = useState('');
    const [newServiceAmount, setNewServiceAmount] = useState('');
    const [newConsumablesAmount, setNewConsumablesAmount] = useState('');
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Получаем информацию о сотруднике
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
            return data as { id: string; full_name: string } | null;
        },
        enabled: !!user?.id,
    });

    // Загружаем данные смены
    const { data: financeData, isLoading, error, refetch } = useQuery({
        queryKey: ['staff-finance', staffInfo?.id],
        queryFn: async () => {
            if (!staffInfo?.id) return null;

            try {
                const response = await apiRequest<{ ok: boolean; data: FinanceData }>(
                    `/api/staff/finance`
                );

                if (!response.ok) {
                    throw new Error('Failed to load shift data');
                }

                // Сохраняем в кэш
                await saveShiftCache(response.data);
                return response.data;
            } catch (error) {
                // Если ошибка сети, пытаемся загрузить из кэша
                logDebug('ShiftQuickScreen', 'Network error, loading from cache', error);
                const cached = await getShiftCache();
                if (cached) {
                    return cached;
                }
                throw error;
            }
        },
        enabled: !!staffInfo?.id,
        retry: 1, // Минимальное количество повторных попыток
        staleTime: 5 * 1000, // 5 секунд
    });

    // Обработка офлайн-очереди при восстановлении сети
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
                    // Продолжаем обработку остальных операций
                }
            }

            // Очищаем очередь после успешной обработки
            await clearOfflineQueue();
            // Обновляем данные
            await refetch();
        } catch (error) {
            logError('ShiftQuickScreen', 'Error processing offline queue', error);
        } finally {
            setIsProcessingQueue(false);
        }
    }, [isProcessingQueue, refetch]);

    // Проверяем очередь при загрузке и периодически
    useEffect(() => {
        processOfflineQueue();
        const interval = setInterval(processOfflineQueue, 30000); // Каждые 30 секунд
        return () => clearInterval(interval);
    }, [processOfflineQueue]);

    // Открытие смены
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
                // Если ошибка сети, добавляем в очередь
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

    // Закрытие смены
    const closeShiftMutation = useMutation({
        mutationFn: async () => {
            const items = financeData?.today.items || [];
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
                // Если ошибка сети, добавляем в очередь
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

    // Добавление клиента
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
                const response = await apiRequest('/api/staff/shift/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!response.ok) {
                    throw new Error('Failed to add client');
                }
                return response;
            } catch (error) {
                // Если ошибка сети, добавляем в очередь
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
            setShowAddClient(false);
            setNewClientName('');
            setNewServiceName('');
            setNewServiceAmount('');
            setNewConsumablesAmount('');
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Не удалось добавить клиента';
            Alert.alert('Ошибка', message);
        },
    });

    const handleOpenShift = () => {
        if (financeData?.isDayOff) {
            Alert.alert('Выходной день', 'Сегодня у вас выходной день. Нельзя открыть смену.');
            return;
        }
        openShiftMutation.mutate();
    };

    const handleCloseShift = () => {
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
    };

    const handleAddClient = () => {
        if (!newClientName.trim()) {
            Alert.alert('Ошибка', 'Введите имя клиента');
            return;
        }

        addClientMutation.mutate({
            clientName: newClientName.trim(),
            serviceName: newServiceName.trim(),
            serviceAmount: Number(newServiceAmount) || 0,
            consumablesAmount: Number(newConsumablesAmount) || 0,
            bookingId: null,
        });
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetch(), processOfflineQueue()]);
        setRefreshing(false);
    };

    if (isLoading && !financeData) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (!staffInfo) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="briefcase"
                    title="Вы не являетесь сотрудником"
                    message="Здесь будет отображаться управление сменой после назначения сотрудником"
                />
            </ScrollView>
        );
    }

    if (error && !financeData) {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="alert-circle"
                    title="Ошибка загрузки"
                    message="Не удалось загрузить данные смены. Проверьте подключение к интернету."
                />
            </ScrollView>
        );
    }

    const shift = financeData?.today.shift;
    const items = financeData?.today.items || [];
    const isOpen = shift?.status === 'open';
    const totalAmount = items.reduce((sum, item) => sum + (item.serviceAmount || 0), 0);
    const totalConsumables = items.reduce((sum, item) => sum + (item.consumablesAmount || 0), 0);

    // Расчет текущих показателей
    const percentMaster = financeData?.staffPercentMaster || 60;
    const percentSalon = financeData?.staffPercentSalon || 40;
    const normalizedMaster = (percentMaster / (percentMaster + percentSalon)) * 100;
    const baseMasterShare = Math.round((totalAmount * normalizedMaster) / 100);
    const currentGuaranteed = financeData?.currentGuaranteedAmount || 0;
    const finalMasterShare = currentGuaranteed > baseMasterShare ? currentGuaranteed : baseMasterShare;
    const topupAmount = Math.max(0, currentGuaranteed - baseMasterShare);
    const baseSalonShare = Math.round((totalAmount * (100 - normalizedMaster)) / 100) + totalConsumables;
    const finalSalonShare = Math.max(0, baseSalonShare - topupAmount);

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Моя смена</Text>
                <Text style={styles.subtitle}>{formatDate(new Date().toISOString())}</Text>
            </View>

            {/* Статус смены и управление */}
            <Card style={styles.statusCard}>
                <View style={styles.statusRow}>
                    <View style={[styles.statusIndicator, isOpen ? styles.statusOpen : styles.statusClosed]} />
                    <Text style={styles.statusText}>
                        {isOpen ? 'Смена открыта' : shift ? 'Смена закрыта' : 'Смена не открыта'}
                    </Text>
                </View>
                {shift?.opened_at && (
                    <Text style={styles.statusTime}>
                        Открыта: {formatTime(shift.opened_at)}
                    </Text>
                )}
                {isOpen && financeData?.currentHoursWorked && (
                    <Text style={styles.statusTime}>
                        Отработано: {financeData.currentHoursWorked.toFixed(1)} ч
                    </Text>
                )}

                <View style={styles.actionsRow}>
                    {!isOpen && !shift && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.openButton]}
                            onPress={handleOpenShift}
                            disabled={openShiftMutation.isPending || financeData?.isDayOff}
                        >
                            <Ionicons name="play" size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>Открыть смену</Text>
                        </TouchableOpacity>
                    )}
                    {isOpen && (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.closeButton]}
                            onPress={handleCloseShift}
                            disabled={closeShiftMutation.isPending}
                        >
                            <Ionicons name="stop" size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>Закрыть смену</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Card>

            {/* Ключевые цифры */}
            {isOpen && (
                <View style={styles.statsGrid}>
                    <Card style={styles.statCard}>
                        <Text style={styles.statLabel}>Оборот</Text>
                        <Text style={styles.statValue}>{formatPrice(totalAmount)}</Text>
                    </Card>
                    <Card style={styles.statCard}>
                        <Text style={styles.statLabel}>Мне</Text>
                        <Text style={[styles.statValue, styles.statValueEmployee]}>
                            {formatPrice(finalMasterShare)}
                        </Text>
                        {currentGuaranteed > baseMasterShare && (
                            <Text style={styles.statHint}>
                                (гарантия: {formatPrice(currentGuaranteed)})
                            </Text>
                        )}
                    </Card>
                    <Card style={styles.statCard}>
                        <Text style={styles.statLabel}>Клиентов</Text>
                        <Text style={styles.statValue}>{items.length}</Text>
                    </Card>
                </View>
            )}

            {/* Быстрое добавление клиента */}
            {isOpen && (
                <Card style={styles.addClientCard}>
                    {!showAddClient ? (
                        <TouchableOpacity
                            style={styles.addClientButton}
                            onPress={() => setShowAddClient(true)}
                        >
                            <Ionicons name="add-circle" size={24} color="#4f46e5" />
                            <Text style={styles.addClientButtonText}>Добавить клиента</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.addClientForm}>
                            <Text style={styles.addClientFormTitle}>Новый клиент</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Имя клиента *"
                                value={newClientName}
                                onChangeText={setNewClientName}
                                autoFocus
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Услуга"
                                value={newServiceName}
                                onChangeText={setNewServiceName}
                            />
                            <View style={styles.amountRow}>
                                <TextInput
                                    style={[styles.input, styles.amountInput]}
                                    placeholder="Сумма"
                                    value={newServiceAmount}
                                    onChangeText={setNewServiceAmount}
                                    keyboardType="numeric"
                                />
                                <TextInput
                                    style={[styles.input, styles.amountInput]}
                                    placeholder="Расходники"
                                    value={newConsumablesAmount}
                                    onChangeText={setNewConsumablesAmount}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.addClientActions}>
                                <TouchableOpacity
                                    style={[styles.addClientActionButton, styles.cancelButton]}
                                    onPress={() => {
                                        setShowAddClient(false);
                                        setNewClientName('');
                                        setNewServiceName('');
                                        setNewServiceAmount('');
                                        setNewConsumablesAmount('');
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Отмена</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.addClientActionButton, styles.saveButton]}
                                    onPress={handleAddClient}
                                    disabled={addClientMutation.isPending || !newClientName.trim()}
                                >
                                    <Text style={styles.saveButtonText}>Добавить</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </Card>
            )}

            {/* Список клиентов */}
            {items.length > 0 && (
                <View style={styles.clientsSection}>
                    <Text style={styles.sectionTitle}>Клиенты ({items.length})</Text>
                    {items.map((item, index) => (
                        <Card key={item.id || index} style={styles.clientCard}>
                            <View style={styles.clientHeader}>
                                <Text style={styles.clientName}>{item.clientName || 'Клиент'}</Text>
                                {item.bookingId && (
                                    <View style={styles.bookingBadge}>
                                        <Ionicons name="calendar" size={12} color="#10b981" />
                                    </View>
                                )}
                            </View>
                            {item.serviceName && (
                                <Text style={styles.clientService}>{item.serviceName}</Text>
                            )}
                            <View style={styles.clientAmounts}>
                                {item.serviceAmount > 0 && (
                                    <Text style={styles.clientAmount}>
                                        {formatPrice(item.serviceAmount)}
                                    </Text>
                                )}
                                {item.consumablesAmount > 0 && (
                                    <Text style={styles.clientConsumables}>
                                        Расходники: {formatPrice(item.consumablesAmount)}
                                    </Text>
                                )}
                            </View>
                        </Card>
                    ))}
                </View>
            )}

            {isOpen && items.length === 0 && (
                <Card style={styles.emptyCard}>
                    <Text style={styles.emptyText}>Нет добавленных клиентов</Text>
                    <Text style={styles.emptyHint}>Нажмите "Добавить клиента" для начала работы</Text>
                </Card>
            )}

            {/* Индикатор обработки офлайн-очереди */}
            {isProcessingQueue && (
                <View style={styles.offlineIndicator}>
                    <Text style={styles.offlineText}>Синхронизация офлайн-данных...</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    statusCard: {
        margin: 16,
        padding: 16,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    statusOpen: {
        backgroundColor: '#10b981',
    },
    statusClosed: {
        backgroundColor: '#6b7280',
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    statusTime: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    actionsRow: {
        marginTop: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    openButton: {
        backgroundColor: '#10b981',
    },
    closeButton: {
        backgroundColor: '#ef4444',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
    },
    statValueEmployee: {
        color: '#059669',
    },
    statHint: {
        fontSize: 10,
        color: '#6b7280',
        marginTop: 4,
    },
    addClientCard: {
        margin: 16,
        padding: 16,
    },
    addClientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#4f46e5',
        borderStyle: 'dashed',
        gap: 8,
    },
    addClientButtonText: {
        color: '#4f46e5',
        fontSize: 16,
        fontWeight: '600',
    },
    addClientForm: {
        gap: 12,
    },
    addClientFormTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    amountRow: {
        flexDirection: 'row',
        gap: 12,
    },
    amountInput: {
        flex: 1,
    },
    addClientActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    addClientActionButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#f3f4f6',
    },
    cancelButtonText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#4f46e5',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    clientsSection: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    clientCard: {
        marginBottom: 12,
        padding: 16,
    },
    clientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    clientName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    bookingBadge: {
        marginLeft: 8,
    },
    clientService: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 8,
    },
    clientAmounts: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    clientAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    clientConsumables: {
        fontSize: 12,
        color: '#d97706',
    },
    emptyCard: {
        margin: 16,
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 12,
        color: '#9ca3af',
    },
    offlineIndicator: {
        padding: 12,
        backgroundColor: '#fef3c7',
        borderTopWidth: 1,
        borderTopColor: '#fbbf24',
    },
    offlineText: {
        fontSize: 12,
        color: '#92400e',
        textAlign: 'center',
    },
});


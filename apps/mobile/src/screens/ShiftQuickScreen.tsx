import { useState } from 'react';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { useConfirm } from '../contexts/ConfirmContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { ShiftQuickSections } from './shiftQuick/ShiftQuickSections';
import { useShiftQuickScreenData } from './shiftQuick/useShiftQuickScreenData';
import type { ShiftItem } from './shiftQuick/types';

const EDIT_CLIENT_SUCCESS = '\u041a\u043b\u0438\u0435\u043d\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d.';
const EDIT_CLIENT_QUEUED =
    '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u0438 \u0431\u0443\u0434\u0435\u0442 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u043e \u043f\u043e\u0441\u043b\u0435 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u0441\u0432\u044f\u0437\u0438.';
const EDIT_CLIENT_ERROR =
    '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430';
const CLIENT_NAME_REQUIRED =
    '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043c\u044f \u043a\u043b\u0438\u0435\u043d\u0442\u0430';
const ADD_CLIENT_SUCCESS = '\u041a\u043b\u0438\u0435\u043d\u0442 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d.';
const ADD_CLIENT_QUEUED =
    '\u041a\u043b\u0438\u0435\u043d\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d \u0432 \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u0438 \u0431\u0443\u0434\u0435\u0442 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d \u043f\u043e\u0441\u043b\u0435 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f \u0441\u0432\u044f\u0437\u0438.';
const ADD_CLIENT_ERROR =
    '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430';

export default function ShiftQuickScreen() {
    const [showAddClient, setShowAddClient] = useState(false);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
    const [newClientName, setNewClientName] = useState('');
    const [newServiceName, setNewServiceName] = useState('');
    const [newServiceAmount, setNewServiceAmount] = useState('');
    const [newConsumablesAmount, setNewConsumablesAmount] = useState('');
    const [addClientError, setAddClientError] = useState<string | null>(null);
    const { confirm } = useConfirm();
    const { showToast } = useToast();

    const {
        staffInfo,
        financeData,
        isLoading,
        error,
        refreshing,
        isProcessingQueue,
        pendingQueueCount,
        metrics,
        openShiftMutation,
        closeShiftMutation,
        addClientMutation,
        updateClientMutation,
        onRefresh,
    } = useShiftQuickScreenData();

    const resetAddClientForm = () => {
        setShowAddClient(false);
        setNewClientName('');
        setNewServiceName('');
        setNewServiceAmount('');
        setNewConsumablesAmount('');
        setAddClientError(null);
        setEditingItemIndex(null);
    };

    const startEditClient = (item: ShiftItem, itemIndex: number) => {
        if (item.bookingId) {
            return;
        }

        setEditingItemIndex(itemIndex);
        setShowAddClient(true);
        setNewClientName(item.clientName);
        setNewServiceName(item.serviceName);
        setNewServiceAmount(item.serviceAmount ? String(item.serviceAmount) : '');
        setNewConsumablesAmount(item.consumablesAmount ? String(item.consumablesAmount) : '');
        setAddClientError(null);
    };

    const handleOpenShift = () => {
        if (financeData?.isDayOff) {
            showToast(
                'Сегодня отмечен выходной день, поэтому открытие смены недоступно.',
                'warning',
            );
            return;
        }

        openShiftMutation.mutate();
    };

    const handleCloseShift = async () => {
        const shouldClose = await confirm({
            title: 'Закрыть смену?',
            message: 'После закрытия смены вы не сможете добавлять клиентов. Продолжить?',
            confirmLabel: 'Закрыть',
            cancelLabel: 'Отмена',
            variant: 'danger',
        });

        if (!shouldClose) {
            return;
        }

        closeShiftMutation.mutate();
    };

    const handleSaveClient = () => {
        if (!newClientName.trim()) {
            setAddClientError(CLIENT_NAME_REQUIRED);
            return;
        }

        const item = {
            clientName: newClientName.trim(),
            serviceName: newServiceName.trim(),
            serviceAmount: Number(newServiceAmount) || 0,
            consumablesAmount: Number(newConsumablesAmount) || 0,
            bookingId: null,
        };

        setAddClientError(null);
        if (editingItemIndex != null) {
            updateClientMutation.mutate(
                {
                    itemIndex: editingItemIndex,
                    item,
                },
                {
                    onSuccess: (result) => {
                        resetAddClientForm();
                        showToast(result.queued ? EDIT_CLIENT_QUEUED : EDIT_CLIENT_SUCCESS, result.queued ? 'warning' : 'success');
                    },
                    onError: (mutationError) => {
                        const message = mutationError instanceof Error ? mutationError.message : EDIT_CLIENT_ERROR;
                        setAddClientError(message);
                    },
                },
            );
            return;
        }

        addClientMutation.mutate(
            item,
            {
                onSuccess: (result) => {
                    resetAddClientForm();
                    showToast(
                        result.queued ? ADD_CLIENT_QUEUED : ADD_CLIENT_SUCCESS,
                        result.queued ? 'warning' : 'success',
                    );
                },
                onError: (mutationError) => {
                    const message = mutationError instanceof Error ? mutationError.message : ADD_CLIENT_ERROR;
                    setAddClientError(message);
                },
            },
        );
    };

    if (isLoading && !financeData) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (!staffInfo) {
        return (
            <EmptyState
                icon="briefcase"
                title="Вы не являетесь сотрудником"
                message="Здесь будет отображаться управление сменой после назначения сотрудником"
            />
        );
    }

    if (error && !financeData) {
        return (
            <EmptyState
                icon="alert-circle"
                title="Ошибка загрузки"
                message="Не удалось загрузить данные смены. Проверьте подключение к интернету."
                action={<Button title="Обновить" onPress={() => void onRefresh()} />}
            />
        );
    }

    if (!financeData) {
        return <LoadingSpinner message="Загрузка..." />;
    }

    return (
        <ShiftQuickSections
            financeData={financeData}
            refreshing={refreshing}
            isProcessingQueue={isProcessingQueue}
            pendingQueueCount={pendingQueueCount}
            isOpening={openShiftMutation.isPending}
            isClosing={closeShiftMutation.isPending}
            isAddingClient={addClientMutation.isPending || updateClientMutation.isPending}
            metrics={metrics}
            addClientForm={{
                showAddClient,
                editingItemIndex,
                newClientName,
                newServiceName,
                newServiceAmount,
                newConsumablesAmount,
                error: addClientError,
            }}
            addClientActions={{
                setShowAddClient,
                setNewClientName: (value) => {
                    setAddClientError(null);
                    setNewClientName(value);
                },
                setNewServiceName: (value) => {
                    setAddClientError(null);
                    setNewServiceName(value);
                },
                setNewServiceAmount: (value) => {
                    setAddClientError(null);
                    setNewServiceAmount(value);
                },
                setNewConsumablesAmount: (value) => {
                    setAddClientError(null);
                    setNewConsumablesAmount(value);
                },
                resetForm: resetAddClientForm,
                submit: handleSaveClient,
            }}
            onEditClient={startEditClient}
            onRefresh={onRefresh}
            onOpenShift={handleOpenShift}
            onCloseShift={handleCloseShift}
        />
    );
}


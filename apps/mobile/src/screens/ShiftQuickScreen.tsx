import { useState } from 'react';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { useConfirm } from '../contexts/ConfirmContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { ShiftQuickSections } from './shiftQuick/ShiftQuickSections';
import { useShiftQuickScreenData } from './shiftQuick/useShiftQuickScreenData';

export default function ShiftQuickScreen() {
    const [showAddClient, setShowAddClient] = useState(false);
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
        onRefresh,
    } = useShiftQuickScreenData();

    const resetAddClientForm = () => {
        setShowAddClient(false);
        setNewClientName('');
        setNewServiceName('');
        setNewServiceAmount('');
        setNewConsumablesAmount('');
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
            title: 'Р—Р°РєСЂС‹С‚СЊ СЃРјРµРЅСѓ?',
            message: 'После закрытия смены вы не сможете добавлять клиентов. Продолжить?',
            confirmLabel: 'Р—Р°РєСЂС‹С‚СЊ',
            cancelLabel: 'РћС‚РјРµРЅР°',
            variant: 'danger',
        });

        if (!shouldClose) {
            return;
        }

        closeShiftMutation.mutate();
    };

    const handleAddClient = () => {
        if (!newClientName.trim()) {
            setAddClientError('Введите имя клиента');
            return;
        }

        setAddClientError(null);
        addClientMutation.mutate(
            {
                clientName: newClientName.trim(),
                serviceName: newServiceName.trim(),
                serviceAmount: Number(newServiceAmount) || 0,
                consumablesAmount: Number(newConsumablesAmount) || 0,
                bookingId: null,
            },
            {
                onSuccess: (result) => {
                    resetAddClientForm();
                    showToast(
                        result.queued
                            ? 'Клиент сохранён в очередь и будет синхронизирован после восстановления связи.'
                            : 'РљР»РёРµРЅС‚ РґРѕР±Р°РІР»РµРЅ.',
                        result.queued ? 'warning' : 'success',
                    );
                },
                onError: (mutationError) => {
                    const message =
                        mutationError instanceof Error ? mutationError.message : 'Не удалось добавить клиента';
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
            isAddingClient={addClientMutation.isPending}
            metrics={metrics}
            addClientForm={{
                showAddClient,
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
                submit: handleAddClient,
            }}
            onRefresh={onRefresh}
            onOpenShift={handleOpenShift}
            onCloseShift={handleCloseShift}
        />
    );
}

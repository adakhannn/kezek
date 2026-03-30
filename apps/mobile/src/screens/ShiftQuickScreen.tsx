import { useState } from 'react';
import { Alert } from 'react-native';

import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ShiftQuickSections, confirmCloseShift } from './shiftQuick/ShiftQuickSections';
import { useShiftQuickScreenData } from './shiftQuick/useShiftQuickScreenData';

export default function ShiftQuickScreen() {
    const [showAddClient, setShowAddClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newServiceName, setNewServiceName] = useState('');
    const [newServiceAmount, setNewServiceAmount] = useState('');
    const [newConsumablesAmount, setNewConsumablesAmount] = useState('');

    const {
        staffInfo,
        financeData,
        isLoading,
        error,
        refreshing,
        isProcessingQueue,
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
    };

    const handleOpenShift = () => {
        if (financeData?.isDayOff) {
            Alert.alert('Выходной день', 'Сегодня у вас выходной день. Нельзя открыть смену.');
            return;
        }

        openShiftMutation.mutate();
    };

    const handleCloseShift = () => {
        confirmCloseShift(() => closeShiftMutation.mutate());
    };

    const handleAddClient = () => {
        if (!newClientName.trim()) {
            Alert.alert('Ошибка', 'Введите имя клиента');
            return;
        }

        addClientMutation.mutate(
            {
                clientName: newClientName.trim(),
                serviceName: newServiceName.trim(),
                serviceAmount: Number(newServiceAmount) || 0,
                consumablesAmount: Number(newConsumablesAmount) || 0,
                bookingId: null,
            },
            {
                onSuccess: () => {
                    resetAddClientForm();
                },
                onError: (mutationError) => {
                    const message =
                        mutationError instanceof Error ? mutationError.message : 'Не удалось добавить клиента';
                    Alert.alert('Ошибка', message);
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
            }}
            addClientActions={{
                setShowAddClient,
                setNewClientName,
                setNewServiceName,
                setNewServiceAmount,
                setNewConsumablesAmount,
                resetForm: resetAddClientForm,
                submit: handleAddClient,
            }}
            onRefresh={onRefresh}
            onOpenShift={handleOpenShift}
            onCloseShift={handleCloseShift}
        />
    );
}

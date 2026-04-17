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
                'РЎРµРіРѕРґРЅСЏ РѕС‚РјРµС‡РµРЅ РІС‹С…РѕРґРЅРѕР№ РґРµРЅСЊ, РїРѕСЌС‚РѕРјСѓ РѕС‚РєСЂС‹С‚РёРµ СЃРјРµРЅС‹ РЅРµРґРѕСЃС‚СѓРїРЅРѕ.',
                'warning',
            );
            return;
        }

        openShiftMutation.mutate();
    };

    const handleCloseShift = async () => {
        const shouldClose = await confirm({
            title: 'Р—Р°РєСЂС‹С‚СЊ СЃРјРµРЅСѓ?',
            message: 'РџРѕСЃР»Рµ Р·Р°РєСЂС‹С‚РёСЏ СЃРјРµРЅС‹ РІС‹ РЅРµ СЃРјРѕР¶РµС‚Рµ РґРѕР±Р°РІР»СЏС‚СЊ РєР»РёРµРЅС‚РѕРІ. РџСЂРѕРґРѕР»Р¶РёС‚СЊ?',
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
            setAddClientError('Р’РІРµРґРёС‚Рµ РёРјСЏ РєР»РёРµРЅС‚Р°');
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
                            ? 'РљР»РёРµРЅС‚ СЃРѕС…СЂР°РЅС‘РЅ РІ РѕС‡РµСЂРµРґСЊ Рё Р±СѓРґРµС‚ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅ РїРѕСЃР»Рµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ СЃРІСЏР·Рё.'
                            : 'РљР»РёРµРЅС‚ РґРѕР±Р°РІР»РµРЅ.',
                        result.queued ? 'warning' : 'success',
                    );
                },
                onError: (mutationError) => {
                    const message =
                        mutationError instanceof Error ? mutationError.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ РґРѕР±Р°РІРёС‚СЊ РєР»РёРµРЅС‚Р°';
                    setAddClientError(message);
                },
            },
        );
    };

    if (isLoading && !financeData) {
        return <LoadingSpinner message="Р—Р°РіСЂСѓР·РєР°..." />;
    }

    if (!staffInfo) {
        return (
            <EmptyState
                icon="briefcase"
                title="Р’С‹ РЅРµ СЏРІР»СЏРµС‚РµСЃСЊ СЃРѕС‚СЂСѓРґРЅРёРєРѕРј"
                message="Р—РґРµСЃСЊ Р±СѓРґРµС‚ РѕС‚РѕР±СЂР°Р¶Р°С‚СЊСЃСЏ СѓРїСЂР°РІР»РµРЅРёРµ СЃРјРµРЅРѕР№ РїРѕСЃР»Рµ РЅР°Р·РЅР°С‡РµРЅРёСЏ СЃРѕС‚СЂСѓРґРЅРёРєРѕРј"
            />
        );
    }

    if (error && !financeData) {
        return (
            <EmptyState
                icon="alert-circle"
                title="РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё"
                message="РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ СЃРјРµРЅС‹. РџСЂРѕРІРµСЂСЊС‚Рµ РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє РёРЅС‚РµСЂРЅРµС‚Сѓ."
                action={<Button title="РћР±РЅРѕРІРёС‚СЊ" onPress={() => void onRefresh()} />}
            />
        );
    }

    if (!financeData) {
        return <LoadingSpinner message="Р—Р°РіСЂСѓР·РєР°..." />;
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

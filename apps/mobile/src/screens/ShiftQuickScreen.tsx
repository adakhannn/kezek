import { useState } from 'react';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { useConfirm } from '../contexts/ConfirmContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../lib/errors';
import { ShiftQuickSections } from './shiftQuick/ShiftQuickSections';
import { useShiftQuickScreenData } from './shiftQuick/useShiftQuickScreenData';
import { captureShiftLedger, createShiftClientId, isShiftLedgerSnapshot } from './shiftQuick/commandProtocol';
import type { ShiftItem, ShiftLedgerSnapshot } from './shiftQuick/types';

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
    const [editorBase, setEditorBase] = useState<ShiftLedgerSnapshot | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | undefined>();
    const [draftClientId, setDraftClientId] = useState<string | undefined>();
    const [replacesQueuedAt, setReplacesQueuedAt] = useState<string | undefined>();
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
        reviewOperation, reviewItems, queueError, canRestoreDraft, reloadForReview, discardReviewedQueue,
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
        setEditingItemId(undefined);
        setDraftClientId(undefined);
        setEditorBase(null);
        setReplacesQueuedAt(undefined);
    };

    const startAddClient = (show: boolean) => {
        if (!show) { resetAddClientForm(); return; }
        try {
            setEditorBase(captureShiftLedger(financeData));
            setDraftClientId(createShiftClientId());
            setShowAddClient(true);
        } catch (error) { showToast(getErrorMessage(error, 'Обновите смену.'), 'error'); }
    };

    const startEditClient = (item: ShiftItem, itemIndex: number) => {
        if (item.bookingId || !item.id) {
            return;
        }
        try { setEditorBase(captureShiftLedger(financeData)); }
        catch (error) { showToast(getErrorMessage(error, 'Обновите смену.'), 'error'); return; }
        setEditingItemId(item.id);
        setDraftClientId(undefined);
        setReplacesQueuedAt(undefined);
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
        let base: ShiftLedgerSnapshot;
        try { base = captureShiftLedger(financeData); }
        catch (error) { showToast(getErrorMessage(error, 'Обновите смену.'), 'error'); return; }
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

        closeShiftMutation.mutate(base);
    };

    const restoreDraft = async () => {
        if (!canRestoreDraft || !reviewOperation?.edit) return;
        try {
            const fresh = await reloadForReview();
            const base = captureShiftLedger(fresh);
            if (!isShiftLedgerSnapshot(reviewOperation.data) || base.expectedShiftId !== reviewOperation.data.expectedShiftId) {
                throw new Error('Черновик относится к другой смене. Проверьте его отдельно: перенос в текущую смену недоступен.');
            }
            const { item } = reviewOperation.edit;
            // A lost response may already have created this exact draft row. Use its
            // stable identity when the user explicitly reviews it, not a duplicate add.
            const itemId = reviewOperation.edit.itemId ?? (item.clientId && base.items.some(entry => entry.id === item.clientId) ? item.clientId : undefined);
            const index = itemId ? base.items.findIndex(entry => entry.id === itemId) : -1;
            if (itemId && (index < 0 || base.items[index].bookingId)) {
                throw new Error('Исходная строка больше недоступна для редактирования. Сверьте сохранённый черновик с актуальной сменой.');
            }
            setEditorBase(base);
            setEditingItemId(itemId);
            setDraftClientId(itemId ? undefined : item.clientId);
            setEditingItemIndex(itemId ? index : null);
            setReplacesQueuedAt(reviewOperation.timestamp);
            setNewClientName(item.clientName);
            setNewServiceName(item.serviceName);
            setNewServiceAmount(String(item.serviceAmount));
            setNewConsumablesAmount(String(item.consumablesAmount));
            setShowAddClient(true);
            setAddClientError('Сверьте черновик со списком клиентов ниже. Сохранение создаст новую команду для загруженной версии смены.');
        } catch (error) { showToast(getErrorMessage(error, 'Не удалось загрузить актуальную смену.'), 'error'); }
    };
    const discardDraft = async () => {
        const accepted = await confirm({ title: 'Удалить сохранённый черновик?',
            message: 'Сначала сверьте его с сервером: прежняя отправка могла завершиться. Удаление черновика не отменяет операции на сервере.',
            confirmLabel: 'Удалить черновик', cancelLabel: 'Отмена', variant: 'danger' });
        if (!accepted) return;
        try {
            await reloadForReview();
            await discardReviewedQueue();
            resetAddClientForm();
        } catch (error) { showToast(getErrorMessage(error, 'Не удалось проверить смену.'), 'error'); }
    };

    const handleSaveClient = () => {
        if (!newClientName.trim()) {
            setAddClientError(CLIENT_NAME_REQUIRED);
            return;
        }
        if (!editorBase) { setAddClientError('Откройте форму заново после обновления смены.'); return; }

        const serviceAmount = newServiceAmount.trim() ? Number(newServiceAmount) : 0;
        const consumablesAmount = newConsumablesAmount.trim() ? Number(newConsumablesAmount) : 0;
        if (![serviceAmount, consumablesAmount].every(value => Number.isFinite(value) && value >= 0 && value <= 100000000)) {
            setAddClientError('Введите суммы от 0 до 100 000 000.');
            return;
        }
        const item = {
            ...(draftClientId ? { clientId: draftClientId } : {}),
            clientName: newClientName.trim(),
            serviceName: newServiceName.trim(),
            serviceAmount,
            consumablesAmount,
            bookingId: null,
        };

        setAddClientError(null);
        if (editingItemIndex != null) {
            updateClientMutation.mutate(
                {
                    base: editorBase, itemId: editingItemId, item, replacesQueuedAt,
                },
                {
                    onSuccess: (result) => {
                        resetAddClientForm();
                        showToast(result.queued ? EDIT_CLIENT_QUEUED : EDIT_CLIENT_SUCCESS, result.queued ? 'warning' : 'success');
                    },
                    onError: (mutationError) => {
                        setAddClientError(
                            getErrorMessage(mutationError, `${EDIT_CLIENT_ERROR}. Попробуйте снова.`),
                        );
                    },
                },
            );
            return;
        }

        addClientMutation.mutate(
            { base: editorBase, item, replacesQueuedAt },
            {
                onSuccess: (result) => {
                    resetAddClientForm();
                    showToast(
                        result.queued ? ADD_CLIENT_QUEUED : ADD_CLIENT_SUCCESS,
                        result.queued ? 'warning' : 'success',
                    );
                },
                onError: (mutationError) => {
                    setAddClientError(
                        getErrorMessage(mutationError, `${ADD_CLIENT_ERROR}. Попробуйте снова.`),
                    );
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
            reviewMessage={queueError ?? reviewOperation?.reason ?? (reviewOperation ? 'Сохранённая операция требует проверки.' : undefined)}
            reviewItems={reviewItems}
            onRestoreDraft={canRestoreDraft ? () => void restoreDraft() : undefined}
            onDiscardDraft={reviewOperation ? () => void discardDraft() : undefined}
            commandsBlocked={isProcessingQueue || pendingQueueCount > 0 || !!queueError}
            savingBlocked={isProcessingQueue || !!queueError || (pendingQueueCount > 0 && !replacesQueuedAt)}
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
                setShowAddClient: startAddClient,
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


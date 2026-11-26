import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { useConfirm } from '../contexts/ConfirmContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../i18n';
import { getErrorMessage } from '../lib/errors';
import type { RootStackParamList } from '../navigation/types';
import { ShiftQuickSections } from './shiftQuick/ShiftQuickSections';
import { useShiftQuickScreenData } from './shiftQuick/useShiftQuickScreenData';
import { captureShiftLedger, createShiftClientId, isShiftLedgerSnapshot } from './shiftQuick/commandProtocol';
import type { ShiftItem, ShiftLedgerSnapshot } from './shiftQuick/types';

type ShiftQuickNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShiftQuick'>;

export default function ShiftQuickScreen() {
    const navigation = useNavigation<ShiftQuickNavigationProp>();
    const { t } = useLanguage();
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
        staffLoading,
        needsSelection,
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
        deleteClientMutation,
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
            setEditorBase(captureShiftLedger(financeData, t));
            setDraftClientId(createShiftClientId());
            setShowAddClient(true);
        } catch (error) { showToast(getErrorMessage(error, t('staff.shiftQuick.refreshShift'), t), 'error'); }
    };

    const startEditClient = (item: ShiftItem, itemIndex: number) => {
        if (item.bookingId || !item.id) {
            return;
        }
        try { setEditorBase(captureShiftLedger(financeData, t)); }
        catch (error) { showToast(getErrorMessage(error, t('staff.shiftQuick.refreshShift'), t), 'error'); return; }
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

    // S4: remove a client added by mistake. The same revision-checked ledger command as an edit:
    // offline it waits in the queue, a conflict goes to review, booking rows stay read-only.
    const handleDeleteClient = async (item: ShiftItem) => {
        if (item.bookingId || !item.id) return;
        const itemId = item.id;
        let base: ShiftLedgerSnapshot;
        try { base = captureShiftLedger(financeData, t); }
        catch (error) { showToast(getErrorMessage(error, t('staff.shiftQuick.refreshShift'), t), 'error'); return; }
        const accepted = await confirm({
            title: t('staff.shiftQuick.deleteConfirmTitle'),
            message: t('staff.shiftQuick.deleteConfirmMessage', { client: item.clientName || t('staff.client') }),
            confirmLabel: t('staff.shiftQuick.delete'),
            cancelLabel: t('staff.cancel'),
            variant: 'danger',
        });
        if (!accepted) return;
        deleteClientMutation.mutate({ base, itemId }, {
            onSuccess: (result) => {
                if (editingItemId === itemId) resetAddClientForm();
                showToast(t(result.queued ? 'staff.shiftQuick.deleteQueued' : 'staff.shiftQuick.deleteSuccess'), result.queued ? 'warning' : 'success');
            },
            onError: (mutationError) => showToast(getErrorMessage(mutationError, t('staff.shiftQuick.deleteError'), t), 'error'),
        });
    };

    const handleOpenShift = () => {
        if (financeData?.isDayOff) {
            showToast(t('staff.shiftQuick.dayOffToast'), 'warning');
            return;
        }

        openShiftMutation.mutate();
    };

    const handleCloseShift = async () => {
        let base: ShiftLedgerSnapshot;
        try { base = captureShiftLedger(financeData, t); }
        catch (error) { showToast(getErrorMessage(error, t('staff.shiftQuick.refreshShift'), t), 'error'); return; }
        const shouldClose = await confirm({
            title: t('staff.shiftQuick.closeConfirmTitle'),
            message: t('staff.shiftQuick.closeConfirmMessage'),
            confirmLabel: t('staff.shiftQuick.closeConfirmLabel'),
            cancelLabel: t('staff.cancel'),
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
            const base = captureShiftLedger(fresh, t);
            if (!isShiftLedgerSnapshot(reviewOperation.data) || base.expectedShiftId !== reviewOperation.data.expectedShiftId) {
                throw new Error(t('staff.shiftQuick.draftOtherShift'));
            }
            const { item } = reviewOperation.edit;
            // A lost response may already have created this exact draft row. Use its
            // stable identity when the user explicitly reviews it, not a duplicate add.
            const itemId = reviewOperation.edit.itemId ?? (item.clientId && base.items.some(entry => entry.id === item.clientId) ? item.clientId : undefined);
            const index = itemId ? base.items.findIndex(entry => entry.id === itemId) : -1;
            if (itemId && (index < 0 || base.items[index].bookingId)) {
                throw new Error(t('staff.shiftQuick.draftRowGone'));
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
            setAddClientError(t('staff.shiftQuick.draftReviewHint'));
        } catch (error) { showToast(getErrorMessage(error, t('staff.shiftQuick.loadCurrentError'), t), 'error'); }
    };
    const discardDraft = async () => {
        const accepted = await confirm({ title: t('staff.shiftQuick.discardTitle'),
            message: t('staff.shiftQuick.discardMessage'),
            confirmLabel: t('staff.shiftQuick.discardConfirm'), cancelLabel: t('staff.cancel'), variant: 'danger' });
        if (!accepted) return;
        try {
            await reloadForReview();
            await discardReviewedQueue();
            resetAddClientForm();
        } catch (error) { showToast(getErrorMessage(error, t('staff.shiftQuick.checkError'), t), 'error'); }
    };

    const handleSaveClient = () => {
        if (!newClientName.trim()) {
            setAddClientError(t('staff.shiftQuick.clientNameRequired'));
            return;
        }
        if (!editorBase) { setAddClientError(t('staff.shiftQuick.reopenForm')); return; }

        const serviceAmount = newServiceAmount.trim() ? Number(newServiceAmount) : 0;
        const consumablesAmount = newConsumablesAmount.trim() ? Number(newConsumablesAmount) : 0;
        if (![serviceAmount, consumablesAmount].every(value => Number.isFinite(value) && value >= 0 && value <= 100000000)) {
            setAddClientError(t('staff.shiftQuick.amountRange'));
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
                        showToast(t(result.queued ? 'staff.shiftQuick.editQueued' : 'staff.shiftQuick.editSuccess'), result.queued ? 'warning' : 'success');
                    },
                    onError: (mutationError) => {
                        setAddClientError(
                            getErrorMessage(mutationError, t('staff.shiftQuick.editError'), t),
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
                        t(result.queued ? 'staff.shiftQuick.addQueued' : 'staff.shiftQuick.addSuccess'),
                        result.queued ? 'warning' : 'success',
                    );
                },
                onError: (mutationError) => {
                    setAddClientError(
                        getErrorMessage(mutationError, t('staff.shiftQuick.addError'), t),
                    );
                },
            },
        );
    };

    if (staffLoading || (isLoading && !financeData)) {
        return <LoadingSpinner message={t('common.loading')} />;
    }

    if (needsSelection) {
        return (
            <EmptyState
                icon="briefcase"
                title={t('staff.chooseBusinessOnTab', { tab: t('nav.staffTab') })}
                message={t('staff.shiftQuick.chooseBusinessMessage')}
                action={
                    <Button
                        title={t('staff.openTab', { tab: t('nav.staffTab') })}
                        onPress={() => navigation.navigate('Main', { screen: 'Staff' })}
                        fullWidth
                    />
                }
            />
        );
    }

    if (!staffInfo) {
        return (
            <EmptyState
                icon="briefcase"
                title={t('staff.notStaff')}
                message={t('staff.shiftQuick.notStaffMessage')}
            />
        );
    }

    if (error && !financeData) {
        return (
            <EmptyState
                icon="alert-circle"
                title={t('staff.shiftQuick.loadErrorTitle')}
                message={t('staff.shiftQuick.loadErrorMessage')}
                action={<Button title={t('staff.shiftQuick.refresh')} onPress={() => void onRefresh()} />}
            />
        );
    }

    if (!financeData) {
        return <LoadingSpinner message={t('common.loading')} />;
    }

    return (
        <ShiftQuickSections
            financeData={financeData}
            refreshing={refreshing}
            isProcessingQueue={isProcessingQueue}
            pendingQueueCount={pendingQueueCount}
            reviewMessage={queueError ?? reviewOperation?.reason ?? (reviewOperation ? t('staff.shiftQuick.reviewFallback') : undefined)}
            reviewItems={reviewItems}
            onRestoreDraft={canRestoreDraft ? () => void restoreDraft() : undefined}
            onDiscardDraft={reviewOperation ? () => void discardDraft() : undefined}
            commandsBlocked={isProcessingQueue || pendingQueueCount > 0 || !!queueError}
            savingBlocked={isProcessingQueue || !!queueError || (pendingQueueCount > 0 && !replacesQueuedAt)}
            isOpening={openShiftMutation.isPending}
            isClosing={closeShiftMutation.isPending}
            isAddingClient={addClientMutation.isPending || updateClientMutation.isPending}
            deletingClient={deleteClientMutation.isPending}
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
            onDeleteClient={(item) => void handleDeleteClient(item)}
            onRefresh={onRefresh}
            onOpenShift={handleOpenShift}
            onCloseShift={handleCloseShift}
        />
    );
}


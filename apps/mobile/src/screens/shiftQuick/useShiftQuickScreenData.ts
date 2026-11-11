import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { apiRequest } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { getOfflineQueue, getShiftCache, ownsOperation, saveOfflineQueue, saveShiftCache } from './offlineStorage';
import type { ShiftOfflineOperation, ShiftOwner } from './offlineStorage';
import { applySavedLedger, closeShiftLedger, editShiftLedger, errorStatus, isShiftLedgerSnapshot, readSavedLedger, UnconfirmedShiftCommandError } from './commandProtocol';
import type { FinanceData, ShiftItemEdit, ShiftLedgerSnapshot, ShiftQuickMetrics } from './types';

type StaffInfo = { id: string; full_name: string };
type MutationResult = { queued: boolean };
const REVIEW_MESSAGE = 'Смена изменилась или результат отправки неизвестен. Черновик сохранён. Загрузите актуальную смену и сверьте данные перед новой отправкой.';

export function useShiftQuickScreenData() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [queue, setQueue] = useState<ShiftOfflineOperation[]>([]);
    const [queueError, setQueueError] = useState<string | null>(null);
    // Replay and interactive commands share a lock, including synchronous double taps.
    const lock = useRef(false);
    const { data: staffInfo } = useQuery({
        queryKey: ['staff-info', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase.from('staff').select('id, full_name')
                .eq('user_id', user.id).eq('is_active', true).maybeSingle();
            if (error) throw error;
            return data as StaffInfo | null;
        },
        enabled: !!user?.id,
    });
    const owner = useMemo<ShiftOwner | null>(() => user?.id && staffInfo?.id
        ? { userId: user.id, staffId: staffInfo.id } : null, [user?.id, staffInfo?.id]);
    const ownerRef = useRef(owner);
    ownerRef.current = owner;
    const queryKey = useMemo(() => ['staff-finance', user?.id, staffInfo?.id], [user?.id, staffInfo?.id]);
    const assertOwner = useCallback(() => {
        if (!owner || ownerRef.current !== owner) throw new Error('Учётная запись изменилась. Откройте смену заново.');
        return owner;
    }, [owner]);
    const loadFinance = useCallback(async (allowCache: boolean): Promise<FinanceData> => {
        const currentOwner = assertOwner();
        try {
            const response = await apiRequest<{ ok: boolean; data: FinanceData }>('/api/staff/finance');
            if (!response.ok || !response.data?.today) throw new Error('Не удалось загрузить смену.');
            assertOwner();
            await saveShiftCache(response.data, currentOwner);
            return response.data;
        } catch (error) {
            if (allowCache && errorStatus(error) === undefined) {
                const cached = await getShiftCache(currentOwner);
                assertOwner();
                if (cached) return cached;
            }
            throw error;
        }
    }, [assertOwner]);
    const financeQuery = useQuery({
        queryKey, queryFn: () => loadFinance(true), enabled: !!owner, retry: 1, staleTime: 5000,
    });
    const readQueue = useCallback(async () => {
        try {
            const value = await getOfflineQueue();
            setQueue(value);
            setQueueError(null);
            return value;
        } catch (error) {
            setQueueError('Не удалось прочитать офлайн-очередь. Отправка остановлена, сохранённые данные не удалены.');
            throw error;
        }
    }, []);
    const persistQueue = useCallback(async (value: ShiftOfflineOperation[]) => {
        await saveOfflineQueue(value);
        setQueue(value);
        setQueueError(null);
    }, []);
    const runLocked = useCallback(async <T,>(work: () => Promise<T>): Promise<T> => {
        if (lock.current) throw new Error('Дождитесь завершения текущей операции.');
        lock.current = true;
        setBusy(true);
        try { return await work(); }
        finally { lock.current = false; setBusy(false); }
    }, []);
    const acceptSave = useCallback(async (response: unknown, payload: ShiftLedgerSnapshot) => {
        const saved = readSavedLedger(response, payload);
        const currentOwner = assertOwner();
        await queryClient.cancelQueries({ queryKey });
        const current = queryClient.getQueryData<FinanceData>(queryKey);
        if (current?.today.shift?.id === saved.shiftId && current.today.shift.ledger_revision <= saved.revision) {
            const next = applySavedLedger(current, saved);
            queryClient.setQueryData(queryKey, next);
            await saveShiftCache(next, currentOwner);
        }
    }, [assertOwner, queryClient, queryKey]);
    const sendOperation = useCallback(async (operation: ShiftOfflineOperation) => {
        const currentOwner = assertOwner();
        if (!ownsOperation(operation, currentOwner) || !isShiftLedgerSnapshot(operation.data)
            || !['addItem', 'updateItem', 'close'].includes(operation.type)) {
            throw new Error('Эта сохранённая операция требует ручной проверки.');
        }
        await queryClient.cancelQueries({ queryKey });
        assertOwner();
        const response = await apiRequest<unknown>(operation.type === 'close'
            ? '/api/staff/shift/close' : '/api/staff/shift/items', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation.data),
        });
        if (operation.type === 'close') {
            const result = response as { ok?: boolean; data?: { shift?: FinanceData['today']['shift'] } };
            const shift = result?.data?.shift;
            if (!result?.ok || !shift || shift.id !== operation.data.expectedShiftId || shift.status !== 'closed'
                || !Number.isSafeInteger(shift.ledger_revision) || shift.ledger_revision <= operation.data.expectedRevision) {
                throw new UnconfirmedShiftCommandError(REVIEW_MESSAGE);
            }
            assertOwner();
            await queryClient.cancelQueries({ queryKey });
            const current = queryClient.getQueryData<FinanceData>(queryKey);
            if (current?.today.shift?.id === shift.id && current.today.shift.ledger_revision <= shift.ledger_revision) {
                const next: FinanceData = { ...current, today: { ...current.today, shift, status: 'closed' } };
                queryClient.setQueryData(queryKey, next);
                await saveShiftCache(next, currentOwner);
            }
        } else {
            await acceptSave(response, operation.data);
        }
    }, [acceptSave, assertOwner, queryClient, queryKey]);
    const processOfflineQueue = useCallback(async () => {
        if (!owner || !financeQuery.data || lock.current) return;
        try {
            if (!(await readQueue()).length || lock.current) return;
            await runLocked(async () => {
                let pending = await readQueue();
                while (pending.length) {
                    const operation = pending[0];
                    assertOwner();
                    if (operation.state === 'review') break;
                    if (!ownsOperation(operation, owner) || !isShiftLedgerSnapshot(operation.data)
                        || !['addItem', 'updateItem', 'close'].includes(operation.type)) {
                        await persistQueue([{ ...operation, state: 'review', reason: 'Сохранённая операция не содержит подтверждённой версии или принадлежит другой учётной записи.' }, ...pending.slice(1)]);
                        break;
                    }
                    try {
                        await sendOperation(operation);
                    } catch (error) {
                        // Never replace the original revision. A lost success response
                        // becomes a conflict on exact replay and requires explicit review.
                        const status = errorStatus(error);
                        assertOwner();
                        if ((status !== undefined && status < 500) || error instanceof UnconfirmedShiftCommandError) {
                            await persistQueue([{ ...operation, state: 'review', reason: REVIEW_MESSAGE }, ...pending.slice(1)]);
                        }
                        break;
                    }
                    pending = pending.slice(1);
                    await persistQueue(pending);
                }
            });
        } catch {
            // Storage failure is visible and blocks writes; leave persisted data intact.
        }
    }, [owner, financeQuery.data, runLocked, readQueue, assertOwner, persistQueue, sendOperation]);
    useEffect(() => {
        void processOfflineQueue();
        const interval = setInterval(() => void processOfflineQueue(), 30000);
        return () => clearInterval(interval);
    }, [processOfflineQueue]);

    const executeCommand = async (type: 'close' | 'addItem' | 'updateItem', payload: ShiftLedgerSnapshot,
        edit?: ShiftItemEdit): Promise<MutationResult> => runLocked(async () => {
        const currentOwner = assertOwner();
        const pending = await readQueue();
        const replacing = edit?.replacesQueuedAt;
        if (pending.length && !(pending.length === 1 && pending[0].timestamp === replacing
            && pending[0].state === 'review' && ownsOperation(pending[0], currentOwner))) {
            throw new Error('Сначала проверьте сохранённый черновик в офлайн-очереди.');
        }
        const operation: ShiftOfflineOperation = { type, data: payload, owner: currentOwner,
            state: 'pending', timestamp: new Date().toISOString(),
            ...(edit ? { edit: { item: edit.item, itemId: edit.itemId } } : {}),
        };
        try {
            await sendOperation(operation);
        } catch (error) {
            assertOwner();
            const status = errorStatus(error);
            if (status !== undefined && status >= 400 && status < 500 && status !== 409) throw error;
            const review = status === 409 || error instanceof UnconfirmedShiftCommandError;
            await persistQueue([{ ...operation, state: review ? 'review' : 'pending', reason: review ? REVIEW_MESSAGE : undefined }]);
            if (review) throw new Error(REVIEW_MESSAGE);
            return { queued: true };
        }
        if (replacing) await persistQueue([]);
        return { queued: false };
    });
    const openShiftMutation = useMutation({
        mutationFn: () => runLocked(async () => {
            assertOwner();
            if ((await readQueue()).length) throw new Error('Сначала проверьте офлайн-очередь.');
            await queryClient.cancelQueries({ queryKey });
            // Opening has no revision precondition; never automatically replay an unknown outcome.
            const response = await apiRequest<{ ok: boolean }>('/api/staff/shift/open', { method: 'POST' });
            if (!response.ok) throw new Error('Не удалось открыть смену. Обновите данные перед повтором.');
            const data = await loadFinance(false);
            queryClient.setQueryData(queryKey, data);
        }),
        onSuccess: () => showToast('Смена открыта.', 'success'),
        onError: (error) => showToast(getErrorMessage(error, 'Не удалось открыть смену. Обновите данные перед повтором.'), 'error'),
    });
    const closeShiftMutation = useMutation({
        mutationFn: (base: ShiftLedgerSnapshot) => executeCommand('close', closeShiftLedger(base)),
        onSuccess: (result) => showToast(result.queued ? 'Закрытие сохранено в очереди. Исходная версия будет проверена при отправке.' : 'Смена закрыта.', result.queued ? 'warning' : 'success'),
        onError: (error) => showToast(getErrorMessage(error, 'Не удалось закрыть смену.'), 'error'),
    });
    const addClientMutation = useMutation({ mutationFn: (edit: ShiftItemEdit) => executeCommand('addItem', editShiftLedger(edit), edit) });
    const updateClientMutation = useMutation({ mutationFn: (edit: ShiftItemEdit) => executeCommand('updateItem', editShiftLedger(edit), edit) });

    // Explicit review bypasses the offline cache. Refresh alone never rebases a draft.
    const reloadForReview = () => runLocked(async () => {
        await queryClient.cancelQueries({ queryKey });
        const fresh = await loadFinance(false);
        queryClient.setQueryData(queryKey, fresh);
        return fresh;
    });
    const discardReviewedQueue = () => runLocked(async () => {
        const pending = await readQueue();
        assertOwner();
        if (pending[0]?.state !== 'review') throw new Error('Сначала дождитесь завершения отправки или проверки очереди.');
        await persistQueue(pending.slice(1));
    });
    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await processOfflineQueue();
            if (!lock.current) await reloadForReview();
        } catch (error) { showToast(getErrorMessage(error, 'Не удалось обновить смену.'), 'error'); }
        finally { setRefreshing(false); }
    };
    const metrics = useMemo<ShiftQuickMetrics>(() => {
        const items = financeQuery.data?.today.items || [];
        const totalAmount = items.reduce((sum, item) => sum + item.serviceAmount, 0);
        const totalConsumables = items.reduce((sum, item) => sum + item.consumablesAmount, 0);
        const percentMaster = financeQuery.data?.staffPercentMaster ?? 60;
        const percentSalon = financeQuery.data?.staffPercentSalon ?? 40;
        const normalizedMaster = percentMaster + percentSalon > 0 ? percentMaster / (percentMaster + percentSalon) : 0;
        const baseMasterShare = Math.round(totalAmount * normalizedMaster);
        const currentGuaranteed = financeQuery.data?.currentGuaranteedAmount || 0;
        const finalMasterShare = Math.max(currentGuaranteed, baseMasterShare);
        const topupAmount = Math.max(0, currentGuaranteed - baseMasterShare);
        return { totalAmount, totalConsumables, finalMasterShare, topupAmount, baseMasterShare, currentGuaranteed,
            finalSalonShare: Math.max(0, totalAmount - baseMasterShare + totalConsumables - topupAmount) };
    }, [financeQuery.data]);
    const reviewOperation = queue.find(item => item.state === 'review');
    const reviewItems = owner && reviewOperation && ownsOperation(reviewOperation, owner)
        && isShiftLedgerSnapshot(reviewOperation.data) ? reviewOperation.data.items : undefined;
    return { staffInfo, financeData: financeQuery.data, isLoading: financeQuery.isLoading, error: financeQuery.error,
        refreshing, isProcessingQueue: busy, pendingQueueCount: queue.length, reviewOperation, reviewItems,
        queueError, canRestoreDraft: queue.length === 1 && !!owner && !!reviewOperation?.edit
            && ownsOperation(reviewOperation, owner) && isShiftLedgerSnapshot(reviewOperation.data),
        reloadForReview, discardReviewedQueue, metrics, openShiftMutation, closeShiftMutation,
        addClientMutation, updateClientMutation, onRefresh };
}

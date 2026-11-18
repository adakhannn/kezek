import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pickStaffCard } from '@core-domain/staff';

import { logWarn } from '../lib/log';
import { getStaffSelection, setStaffSelection } from '../lib/staffSelectionStorage';
import { supabase } from '../lib/supabase';
import { getOfflineQueue, type ShiftOfflineOperation } from '../screens/shiftQuick/offlineStorage';
import type { StaffInfo } from '../screens/staff/types';
import { useAuth } from './useAuth';

const STAFF_CARD_COLUMNS = 'id, full_name, biz_id, created_at, branch:branches(id, name), business:businesses(id, name)';

/** Queries whose data belongs to one staff card: switching the card refreshes them. */
const STAFF_DEPENDENT_QUERY_KEYS = [['staff-bookings'], ['staff-finance'], ['staff-shifts-stats']];

const STAFF_SELECTION_UNAVAILABLE = 'Этот бизнес больше недоступен. Обновите экран.';
const STAFF_SELECTION_QUEUE_UNREADABLE =
    'Не удалось проверить неотправленные изменения смены, поэтому бизнес не переключён. Попробуйте ещё раз.';

function queueBlocksSelectionMessage(card: StaffInfo | undefined): string {
    const businessName = card?.business?.name;
    return businessName
        ? `В бизнесе «${businessName}» есть неотправленные изменения смены. Сначала откройте его и дождитесь отправки.`
        : 'В другом бизнесе есть неотправленные изменения смены. Сначала откройте его и дождитесь отправки.';
}

export type CurrentStaff = {
    /** Active staff cards of the signed-in person, oldest first: one per business. */
    staffRecords: StaffInfo[];
    /** The card every staff screen and `/api/staff/*` request acts as, or null. */
    staffInfo: StaffInfo | null;
    /** Several cards and no remembered choice that is still active: the person has to choose. */
    needsSelection: boolean;
    /** Remembers the chosen card; rejects with a message to show when switching is not allowed. */
    select: (staffId: string) => Promise<void>;
    /** Reloads the active cards (pull to refresh, retry after an error). */
    refetch: () => Promise<void>;
    /** True until both the cards and the remembered choice have loaded. */
    isLoading: boolean;
    error: Error | null;
};

/**
 * The staff card the person works as (ARCH-02). A master can be active in several businesses,
 * one card per business: a single card is used as is, with several the remembered choice is used
 * while it is still active, otherwise the person picks one in the staff workspace.
 */
export function useCurrentStaff(): CurrentStaff {
    const { user, isLoading: userLoading } = useAuth();
    const userId = user?.id;
    const queryClient = useQueryClient();

    const recordsQuery = useQuery({
        queryKey: ['staff-records', userId],
        queryFn: async (): Promise<StaffInfo[]> => {
            if (!userId) return [];

            const { data, error } = await supabase
                .from('staff')
                .select(STAFF_CARD_COLUMNS)
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true });

            if (error) throw error;
            // branch and business are many-to-one embeds: PostgREST returns objects, not arrays.
            return (data ?? []) as unknown as StaffInfo[];
        },
        enabled: !!userId,
    });

    const selectionQuery = useQuery({
        queryKey: ['staff-selection', userId],
        queryFn: () => (userId ? getStaffSelection(userId) : Promise.resolve(null)),
        enabled: !!userId,
        // Changed only here (and cleared on sign-out), so it never goes stale on its own.
        staleTime: Infinity,
    });

    const records = recordsQuery.data;
    const preferredStaffId = selectionQuery.data ?? null;
    const pick = useMemo(
        () => pickStaffCard(records ?? [], { preferredStaffId }),
        [records, preferredStaffId],
    );
    const isLoading = !!userLoading || (!!userId && (recordsQuery.isPending || selectionQuery.isPending));
    const staffInfo = !isLoading && pick.status === 'selected' ? pick.record : null;

    // A single card is remembered as the choice, so a second card added later does not interrupt
    // the person or strand shift commands queued for the first one.
    const onlyCardId = !isLoading && pick.status === 'selected' && pick.options.length === 1 ? pick.record.id : null;
    useEffect(() => {
        if (!userId || !onlyCardId || preferredStaffId === onlyCardId) return;
        let cancelled = false;
        void (async () => {
            try {
                await setStaffSelection(userId, onlyCardId);
                if (!cancelled) queryClient.setQueryData(['staff-selection', userId], onlyCardId);
            } catch (error) {
                logWarn('useCurrentStaff', 'Failed to remember the only staff card', error);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [onlyCardId, preferredStaffId, queryClient, userId]);

    const select = useCallback(async (staffId: string) => {
        if (!userId) throw new Error('Войдите в аккаунт снова.');
        const cards = records ?? [];
        if (!cards.some((card) => card.id === staffId)) throw new Error(STAFF_SELECTION_UNAVAILABLE);

        let queue: ShiftOfflineOperation[];
        try {
            queue = await getOfflineQueue();
        } catch (error) {
            logWarn('useCurrentStaff', 'Offline shift queue is unreadable; the staff card was not switched', error);
            throw new Error(STAFF_SELECTION_QUEUE_UNREADABLE);
        }
        // A queued shift command is replayed only as the card that created it, so leaving another
        // active card with unsent commands would strand them. Commands that no card of this account
        // can send (another account's, an older build's without an owner, a deactivated card's)
        // already wait for manual review under any card and do not block the switch.
        const blocking = queue.find((operation) => operation.owner?.userId === userId
            && operation.owner.staffId !== staffId
            && cards.some((card) => card.id === operation.owner?.staffId));
        if (blocking) {
            throw new Error(queueBlocksSelectionMessage(cards.find((card) => card.id === blocking.owner?.staffId)));
        }

        await setStaffSelection(userId, staffId);
        queryClient.setQueryData(['staff-selection', userId], staffId);
        // Data loaded as the previous card is refetched; nobody waits for it here.
        for (const queryKey of STAFF_DEPENDENT_QUERY_KEYS) {
            void queryClient.invalidateQueries({ queryKey });
        }
    }, [queryClient, records, userId]);

    // The remembered choice is kept in the cache whenever it changes; only the cards are reloaded.
    const { refetch: refetchRecords } = recordsQuery;
    const refetch = useCallback(async () => {
        if (!userId) return;
        await refetchRecords();
    }, [refetchRecords, userId]);

    return {
        staffRecords: pick.options,
        staffInfo,
        needsSelection: !isLoading && pick.status === 'selection_required',
        select,
        refetch,
        isLoading,
        error: recordsQuery.error ?? null,
    };
}

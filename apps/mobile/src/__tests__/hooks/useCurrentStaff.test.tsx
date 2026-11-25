import React from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { useCurrentStaff } from '../../hooks/useCurrentStaff';
import { supabase } from '../../lib/supabase';
import { staffCard, staffCardsQuery } from '../staffCards';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));

const SELECTION_KEY = 'kezek_staff_selection_user-1';
const QUEUE_KEY = 'shift_offline_queue';
const storage = new Map<string, string>();
const from = supabase.from as jest.Mock;

const older = staffCard({ id: 'staff-a', biz_id: 'biz-a', created_at: '2026-01-01T08:00:00.000Z',
    business: { id: 'biz-a', name: 'Low Fade' } });
const newer = staffCard({ id: 'staff-b', biz_id: 'biz-b', created_at: '2026-03-01T08:00:00.000Z',
    business: { id: 'biz-b', name: 'Barber One' } });

const queued = (staffId: string, userId = 'user-1') => ({ type: 'addItem', owner: { userId, staffId }, state: 'pending',
    timestamp: '2026-06-03T09:00:00.000Z', data: { expectedShiftId: 'shift-1', expectedRevision: 1, items: [] } });

function mountHook(client: QueryClient = createTestQueryClient()) {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useCurrentStaff(), { wrapper });
}

beforeEach(() => {
    jest.clearAllMocks();
    storage.clear();
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => storage.get(key) ?? null);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { storage.set(key, value); });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => { storage.delete(key); });
    from.mockReset();
    from.mockReturnValue(staffCardsQuery([newer, older]));
});

describe('useCurrentStaff (ARCH-02)', () => {
    test('loads every active card of the person, oldest first', async () => {
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.staffRecords.map((card) => card.id)).toEqual(['staff-a', 'staff-b']);
        const query = from.mock.results[0].value;
        expect(from).toHaveBeenCalledWith('staff');
        expect(query.select).toHaveBeenCalledWith(
            'id, full_name, biz_id, created_at, branch:branches(id, name), business:businesses(id, name, tz)',
        );
        expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(query.eq).toHaveBeenCalledWith('is_active', true);
        expect(query.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: true });
        expect(query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    });

    test('two cards and no remembered choice: the person has to choose', async () => {
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.needsSelection).toBe(true);
        expect(result.current.staffInfo).toBeNull();
        expect(storage.has(SELECTION_KEY)).toBe(false);
    });

    test('select remembers the card in SecureStore, uses it and refreshes the data of the previous card', async () => {
        const client = createTestQueryClient();
        const invalidate = jest.spyOn(client, 'invalidateQueries');
        const { result } = mountHook(client);
        await waitFor(() => expect(result.current.needsSelection).toBe(true));

        await act(async () => {
            await result.current.select('staff-b');
        });

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(SELECTION_KEY, 'staff-b');
        expect(storage.get(SELECTION_KEY)).toBe('staff-b');
        await waitFor(() => expect(result.current.staffInfo?.id).toBe('staff-b'));
        expect(result.current.needsSelection).toBe(false);
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff-bookings'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff-finance'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['staff-shifts-stats'] });
    });

    test('a remembered card that is still active is used without asking', async () => {
        storage.set(SELECTION_KEY, 'staff-b');
        const { result } = mountHook();

        await waitFor(() => expect(result.current.staffInfo?.id).toBe('staff-b'));
        expect(result.current.needsSelection).toBe(false);
    });

    test('a remembered card that is no longer active asks again', async () => {
        storage.set(SELECTION_KEY, 'staff-deactivated');
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.needsSelection).toBe(true);
        expect(result.current.staffInfo).toBeNull();
    });

    test('a single card is used as is, a stale choice is ignored, and the card is remembered', async () => {
        from.mockReturnValue(staffCardsQuery([older]));
        storage.set(SELECTION_KEY, 'staff-deactivated');
        const { result } = mountHook();

        await waitFor(() => expect(result.current.staffInfo?.id).toBe('staff-a'));
        expect(result.current.needsSelection).toBe(false);
        await waitFor(() => expect(storage.get(SELECTION_KEY)).toBe('staff-a'));
    });

    test('a second card added later does not interrupt a person who had one', async () => {
        from.mockReturnValue(staffCardsQuery([older]));
        const { result } = mountHook();
        await waitFor(() => expect(storage.get(SELECTION_KEY)).toBe('staff-a'));

        from.mockReturnValue(staffCardsQuery([older, newer]));
        await act(async () => {
            await result.current.refetch();
        });

        await waitFor(() => expect(result.current.staffRecords).toHaveLength(2));
        expect(result.current.staffInfo?.id).toBe('staff-a');
        expect(result.current.needsSelection).toBe(false);
    });

    test('no active card: nothing is selected and nothing is asked', async () => {
        from.mockReturnValue(staffCardsQuery([]));
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.staffInfo).toBeNull();
        expect(result.current.needsSelection).toBe(false);
        expect(result.current.error).toBeNull();
    });

    test('a failed cards query is an error, not a request to choose', async () => {
        from.mockReturnValue(staffCardsQuery([], new Error('staff query failed')));
        const { result } = mountHook();

        await waitFor(() => expect(result.current.error).toBeTruthy());
        expect(result.current.needsSelection).toBe(false);
        expect(result.current.staffInfo).toBeNull();
    });

    test('select is refused while another business has unsent shift commands', async () => {
        storage.set(SELECTION_KEY, 'staff-a');
        storage.set(QUEUE_KEY, JSON.stringify([queued('staff-a')]));
        const { result } = mountHook();
        await waitFor(() => expect(result.current.staffInfo?.id).toBe('staff-a'));

        await act(async () => {
            await expect(result.current.select('staff-b')).rejects.toThrow(
                'В бизнесе «Low Fade» есть неотправленные изменения смены. Сначала откройте его и дождитесь отправки.',
            );
        });

        expect(storage.get(SELECTION_KEY)).toBe('staff-a');
        expect(result.current.staffInfo?.id).toBe('staff-a');
        expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(SELECTION_KEY, 'staff-b');
    });

    test('the card that owns the unsent commands can still be chosen', async () => {
        storage.set(QUEUE_KEY, JSON.stringify([queued('staff-a')]));
        const { result } = mountHook();
        await waitFor(() => expect(result.current.needsSelection).toBe(true));

        await act(async () => {
            await result.current.select('staff-a');
        });

        expect(storage.get(SELECTION_KEY)).toBe('staff-a');
        await waitFor(() => expect(result.current.staffInfo?.id).toBe('staff-a'));
    });

    test.each([
        ['broken', () => storage.set(QUEUE_KEY, '{broken')],
        ['locked', () => jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => {
            if (key === QUEUE_KEY) throw new Error('keychain locked');
            return storage.get(key) ?? null;
        })],
    ])('select is refused when the offline queue cannot be read (%s)', async (_label, breakQueue) => {
        breakQueue();
        const { result } = mountHook();
        await waitFor(() => expect(result.current.needsSelection).toBe(true));

        await act(async () => {
            await expect(result.current.select('staff-b')).rejects.toThrow(
                'Не удалось проверить неотправленные изменения смены',
            );
        });

        expect(storage.has(SELECTION_KEY)).toBe(false);
        expect(result.current.needsSelection).toBe(true);
    });

    test.each([
        ['an older build without an owner', { type: 'addItem', timestamp: 'legacy', data: { items: [] } }],
        ['another account', queued('staff-x', 'user-2')],
        ['a deactivated card', queued('staff-deactivated')],
    ])('commands of %s cannot be sent by any card and do not block the choice', async (_label, operation) => {
        storage.set(QUEUE_KEY, JSON.stringify([operation]));
        const { result } = mountHook();
        await waitFor(() => expect(result.current.needsSelection).toBe(true));

        await act(async () => {
            await result.current.select('staff-b');
        });

        expect(storage.get(SELECTION_KEY)).toBe('staff-b');
    });

    test('a card that is not among the active cards cannot be chosen', async () => {
        const { result } = mountHook();
        await waitFor(() => expect(result.current.needsSelection).toBe(true));

        await act(async () => {
            await expect(result.current.select('staff-deactivated')).rejects.toThrow('Этот бизнес больше недоступен');
        });

        expect(storage.has(SELECTION_KEY)).toBe(false);
    });
});

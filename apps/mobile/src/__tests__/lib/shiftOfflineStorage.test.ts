import * as SecureStore from 'expo-secure-store';

import {
    addToOfflineQueue,
    getOfflineQueue,
    getShiftCache,
    saveShiftCache,
} from '../../screens/shiftQuick/offlineStorage';
import type { FinanceData } from '../../screens/shiftQuick/types';

describe('shift offline queue compaction', () => {
    const storage = new Map<string, string>();

    beforeEach(() => {
        storage.clear();
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
            storage.get(key) ?? null,
        );
        (SecureStore.setItemAsync as jest.Mock).mockImplementation(
            async (key: string, value: string) => {
                storage.set(key, value);
            },
        );
    });

    afterEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockReset();
        (SecureStore.setItemAsync as jest.Mock).mockReset();
    });

    test('preserves different commands instead of silently replacing their snapshots', async () => {
        await addToOfflineQueue({
            type: 'addItem',
            data: { items: [{ clientName: 'First' }] },
            timestamp: '2026-06-09T10:00:00.000Z',
        });
        await addToOfflineQueue({
            type: 'updateItem',
            data: { items: [{ clientName: 'Corrected' }] },
            timestamp: '2026-06-09T10:01:00.000Z',
        });

        expect(await getOfflineQueue()).toEqual([
            expect.objectContaining({ type: 'addItem', data: { items: [{ clientName: 'First' }] } }),
            expect.objectContaining({
                type: 'updateItem',
                data: { items: [{ clientName: 'Corrected' }] },
            }),
        ]);
    });

    test('does not merge identical payloads belonging to different owners', async () => {
        const operation = { type: 'addItem' as const, data: { expectedShiftId: 'shift', expectedRevision: 3, items: [] },
            timestamp: '2026-11-10T10:00:00Z', owner: { userId: 'a', staffId: 'staff-a' } };
        await addToOfflineQueue(operation);
        await addToOfflineQueue({ ...operation, owner: { userId: 'b', staffId: 'staff-b' } });
        expect(await getOfflineQueue()).toHaveLength(2);
    });

    test('does not treat unreadable or malformed queues as empty', async () => {
        storage.set('shift_offline_queue', '{invalid');
        await expect(getOfflineQueue()).rejects.toThrow();
        storage.set('shift_offline_queue', '{}');
        await expect(getOfflineQueue()).rejects.toThrow();
        expect(storage.get('shift_offline_queue')).toBe('{}');
        (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
        await expect(getOfflineQueue()).rejects.toThrow('storage unavailable');
    });

    test('cache is bound to both account and staff; legacy unscoped cache is not reused', async () => {
        const data = { today: { exists: false, status: 'none', shift: null, items: [] },
            staffPercentMaster: 60, staffPercentSalon: 40, hourlyRate: null, currentHoursWorked: null,
            currentGuaranteedAmount: null, isDayOff: false } satisfies FinanceData;
        const owner = { userId: 'a', staffId: 'staff-a' };
        await saveShiftCache(data, owner);
        expect(await getShiftCache(owner)).toEqual(data);
        expect(await getShiftCache({ ...owner, userId: 'b' })).toBeNull();
        expect(await getShiftCache({ ...owner, staffId: 'staff-b' })).toBeNull();
        storage.set('shift_offline_cache', JSON.stringify(data));
        expect(await getShiftCache(owner)).toBeNull();
    });

    test('does not duplicate an identical adjacent shift action', async () => {
        const operation = {
            type: 'open' as const,
            data: {},
            timestamp: '2026-06-09T10:00:00.000Z',
        };

        await addToOfflineQueue(operation);
        await addToOfflineQueue({ ...operation, timestamp: '2026-06-09T10:00:05.000Z' });

        expect(await getOfflineQueue()).toHaveLength(1);
    });

    test('does not compact item snapshots across a close/open boundary', async () => {
        await addToOfflineQueue({
            type: 'addItem',
            data: { items: [{ clientName: 'Day one' }] },
            timestamp: '2026-06-09T10:00:00.000Z',
        });
        await addToOfflineQueue({
            type: 'close',
            data: { items: [{ clientName: 'Day one' }] },
            timestamp: '2026-06-09T18:00:00.000Z',
        });
        await addToOfflineQueue({
            type: 'addItem',
            data: { items: [{ clientName: 'Day two' }] },
            timestamp: '2026-06-10T10:00:00.000Z',
        });

        expect((await getOfflineQueue()).map((item) => item.type)).toEqual([
            'addItem',
            'close',
            'addItem',
        ]);
    });
});

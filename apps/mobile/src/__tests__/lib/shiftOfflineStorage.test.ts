import * as SecureStore from 'expo-secure-store';

import {
    addToOfflineQueue,
    getOfflineQueue,
} from '../../screens/shiftQuick/offlineStorage';

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

    test('keeps only the latest consecutive item snapshot', async () => {
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
            expect.objectContaining({
                type: 'updateItem',
                data: { items: [{ clientName: 'Corrected' }] },
            }),
        ]);
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

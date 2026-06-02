import * as SecureStore from 'expo-secure-store';

import {
    loadOfflineBookings,
    saveOfflineBookings,
    type OfflineBookingsPayload,
} from '../../lib/offlineBookingsStorage';

describe('offlineBookingsStorage', () => {
    const storage = new Map<string, string>();

    beforeEach(() => {
        storage.clear();
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
            storage.has(key) ? storage.get(key) ?? null : null,
        );
        (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
            storage.set(key, value);
        });
        (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
            storage.delete(key);
        });
    });

    afterEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockReset();
        (SecureStore.setItemAsync as jest.Mock).mockReset();
        (SecureStore.deleteItemAsync as jest.Mock).mockReset();
    });

    function createLargePayload(userId = 'u1'): OfflineBookingsPayload {
        const items = Array.from({ length: 90 }).map((_, index) => ({
            id: `booking-${index}`,
            status: 'confirmed' as const,
            start_at: `2026-05-19T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
            end_at: `2026-05-19T11:${String(index % 60).padStart(2, '0')}:00.000Z`,
            branch_name: `Branch ${index}`,
            service_name: `Service ${index}`,
            staff_name: `Staff ${index}`,
            business_name: `Business ${index}`,
            created_at: '2026-05-19T09:00:00.000Z',
        }));

        return {
            userId,
            updatedAt: '2026-05-19T12:00:00.000Z',
            items,
        };
    }

    test('stores and loads large payload via chunked secure storage', async () => {
        const payload = createLargePayload('chunk-user');
        const key = 'offline:bookings:chunk-user';

        await saveOfflineBookings(payload);

        expect(storage.has(`${key}__chunks_meta`)).toBe(true);
        expect(storage.has(`${key}__chunk_0`)).toBe(true);
        expect(storage.has(key)).toBe(false);

        const loaded = await loadOfflineBookings('chunk-user');
        expect(loaded).toEqual(payload);
    });

    test('falls back to single-key value when chunk payload is partial', async () => {
        const payload = createLargePayload('fallback-user');
        const key = 'offline:bookings:fallback-user';

        await saveOfflineBookings(payload);

        const fallbackPayload: OfflineBookingsPayload = {
            userId: 'fallback-user',
            updatedAt: '2026-05-19T13:00:00.000Z',
            items: [],
        };
        storage.set(key, JSON.stringify(fallbackPayload));
        storage.delete(`${key}__chunk_0`);

        const loaded = await loadOfflineBookings('fallback-user');
        expect(loaded).toEqual(fallbackPayload);
    });

    test('does not surface save failures as console errors', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('secure store unavailable'));

        await expect(saveOfflineBookings(createLargePayload('error-user'))).resolves.toBeUndefined();

        expect(consoleErrorSpy).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});

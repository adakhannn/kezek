import * as SecureStore from 'expo-secure-store';
import { acknowledgeBookingRequest, getBookingRequestKey } from '../../lib/bookingRequest';

const store = new Map<string, string>();
beforeEach(() => {
    store.clear();
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => store.get(key) ?? null);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { store.set(key, value); });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => { store.delete(key); });
});

test('concurrent attempts and subsequent calls reuse a persisted request UUID', async () => {
    const payload = { start_at: '2026-11-10T10:00:00Z', staff_id: 'synthetic-staff' };
    const keys = await Promise.all(Array.from({ length: 8 }, () => getBookingRequestKey(payload)));
    keys.forEach(key => expect(key).toBe(keys[0]));
    expect(keys[0]).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(await getBookingRequestKey({ staff_id: payload.staff_id, start_at: payload.start_at })).toBe(keys[0]);
    expect(await getBookingRequestKey({ ...payload, start_at: '2026-11-10T11:00:00Z' })).not.toBe(keys[0]);
});

test('write failure rejects before returning an unsafe request identity and releases the storage queue', async () => {
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(getBookingRequestKey({ staff: 'a' })).rejects.toThrow('Storage unavailable');
    await expect(getBookingRequestKey({ staff: 'a' })).resolves.toMatch(/^[a-f0-9-]{36}$/);
});

test('acknowledgement permits a new deliberate booking without deleting a newer concurrent attempt', async () => {
    const input = { staff: 'a' };
    const first = await getBookingRequestKey(input);
    await acknowledgeBookingRequest(input, first);
    const next = await getBookingRequestKey(input);
    expect(next).not.toBe(first);
    await acknowledgeBookingRequest(input, first);
    expect(await getBookingRequestKey(input)).toBe(next);
});

import * as SecureStore from 'expo-secure-store';

import { apiRequest } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import { signOutSafely } from '../../lib/signOut';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));

describe('sign-out removes this install from push', () => {
    const auth = supabase.auth as unknown as { getSession: jest.Mock; signOut: jest.Mock; _removeSession?: jest.Mock };
    const store = new Map<string, string>();
    const order: string[] = [];

    beforeEach(() => {
        store.clear();
        order.length = 0;
        store.set('kezek.push.registration', JSON.stringify({ userId: 'user-1', token: 'ExponentPushToken[unit-test-install]' }));
        auth.getSession = jest.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
        auth.signOut = jest.fn(async () => { order.push('signOut'); return { error: null }; });
        auth._removeSession = jest.fn();
        jest.spyOn(queryClient, 'clear').mockImplementation(() => undefined);
        jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => store.get(key) ?? null);
        jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => { store.delete(key); });
        jest.mocked(apiRequest).mockReset().mockImplementation(async (_endpoint, options) => { order.push(String(options?.method)); return {}; });
    });

    afterEach(() => { jest.restoreAllMocks(); });

    test('the token is deleted on the server while the session exists, then the local record goes', async () => {
        await signOutSafely();
        expect(apiRequest).toHaveBeenCalledWith('/api/mobile/push-tokens', expect.objectContaining({
            method: 'DELETE', body: JSON.stringify({ token: 'ExponentPushToken[unit-test-install]' }),
        }));
        expect(order).toEqual(['DELETE', 'signOut']);
        expect(store.has('kezek.push.registration')).toBe(false);
    });

    test('a failed removal does not stop sign-out', async () => {
        jest.mocked(apiRequest).mockRejectedValue(new Error('offline'));
        await expect(signOutSafely()).resolves.toEqual({ usedLocalFallback: false });
        expect(auth.signOut).toHaveBeenCalled();
        expect(store.has('kezek.push.registration')).toBe(false);
    });
});

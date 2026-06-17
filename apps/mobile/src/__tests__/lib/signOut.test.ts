import * as SecureStore from 'expo-secure-store';

import { signOutSafely } from '../../lib/signOut';
import { queryClient } from '../../lib/queryClient';
import { supabase } from '../../lib/supabase';

describe('signOutSafely', () => {
    const auth = supabase.auth as unknown as {
        getSession: jest.Mock;
        signOut: jest.Mock;
        _removeSession?: jest.Mock;
    };
    const secureStore = new Map<string, string>();

    beforeEach(() => {
        secureStore.clear();
        auth.getSession = jest.fn().mockResolvedValue({
            data: { session: { user: { id: 'user-1' } } },
            error: null,
        });
        auth.signOut = jest.fn();
        auth._removeSession = jest.fn().mockResolvedValue(undefined);
        jest.spyOn(queryClient, 'clear').mockImplementation(() => undefined);
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
            secureStore.get(key) ?? null,
        );
        (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
            secureStore.delete(key);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('uses normal remote sign-out when available', async () => {
        [
            'google_mobile_active_login_v1',
            'telegram_mobile_active_login_v1',
            'whatsapp_mobile_active_attempt_v1',
            'shift_offline_queue',
            'shift_offline_cache',
            'offline:bookings:user-1',
        ].forEach((key) => secureStore.set(key, 'sensitive'));
        auth.signOut.mockResolvedValue({ error: null });

        await expect(signOutSafely()).resolves.toEqual({ usedLocalFallback: false });
        expect(auth._removeSession).not.toHaveBeenCalled();
        expect(queryClient.clear).toHaveBeenCalledTimes(1);
        expect([...secureStore.keys()]).toEqual([]);
    });

    test('clears the local session when remote sign-out fails', async () => {
        auth.signOut.mockImplementation(async (options?: { scope?: string }) => {
            if (options?.scope === 'local') {
                return { error: null };
            }
            throw new TypeError('Network request failed');
        });

        await expect(signOutSafely()).resolves.toEqual({ usedLocalFallback: true });
        expect(auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
        expect(auth._removeSession).not.toHaveBeenCalled();
    });

    test('falls back when Supabase returns an auth error', async () => {
        auth.signOut
            .mockResolvedValueOnce({ error: new Error('sign-out unavailable') })
            .mockResolvedValueOnce({ error: null });

        await expect(signOutSafely()).resolves.toEqual({ usedLocalFallback: true });
        expect(auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
    });

    test('uses private removal only if local scope is unavailable', async () => {
        auth.signOut
            .mockRejectedValueOnce(new TypeError('Network request failed'))
            .mockRejectedValueOnce(new Error('local scope unsupported'));

        await expect(signOutSafely()).resolves.toEqual({ usedLocalFallback: true });
        expect(auth._removeSession).toHaveBeenCalledTimes(1);
    });

    test('falls back when remote sign-out hangs', async () => {
        jest.useFakeTimers();
        auth.signOut
            .mockReturnValueOnce(new Promise(() => undefined))
            .mockResolvedValueOnce({ error: null });

        const result = signOutSafely();
        await jest.advanceTimersByTimeAsync(4000);

        await expect(result).resolves.toEqual({ usedLocalFallback: true });
        expect(auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
        jest.useRealTimers();
    });
});

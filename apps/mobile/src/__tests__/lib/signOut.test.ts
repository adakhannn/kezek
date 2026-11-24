import * as SecureStore from 'expo-secure-store';

import { createTranslate } from '../../i18n/translate';
import { countPendingShiftOperations, signOutConfirmationText, signOutSafely } from '../../lib/signOut';
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
            'kezek_staff_selection_user-1',
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

describe('sign-out confirmation (MOB-02)', () => {
    test('names unsent shift changes with the right Russian plural', () => {
        expect(signOutConfirmationText(0)).toEqual({ title: 'Выход', message: 'Вы уверены, что хотите выйти?', confirmLabel: 'Выйти' });
        const one = signOutConfirmationText(1);
        expect(one.confirmLabel).toBe('Выйти и удалить');
        expect(one.message).toContain('1 изменение смены ещё не отправлено на сервер. После выхода неотправленные изменения будут удалены');
        expect(signOutConfirmationText(3).message).toContain('3 изменения смены ещё не отправлены');
        expect(signOutConfirmationText(5).message).toContain('5 изменений смены ещё не отправлены');
        expect(signOutConfirmationText(12).message).toContain('12 изменений');
        expect(signOutConfirmationText(21).message).toContain('21 изменение смены ещё не отправлено');
    });

    test('the plural follows the language of t, not the Russian rules', () => {
        const en = createTranslate('en');
        // Russian rules would make 21 singular in English too.
        expect(signOutConfirmationText(21, en).message).toContain('21 shift changes have not been sent');
        expect(signOutConfirmationText(2, en).message).toContain('2 shift changes have not been sent');
        expect(signOutConfirmationText(1, en).message).toContain(
            '1 shift change has not been sent to the server yet. After signing out it will be deleted',
        );

        const ky = createTranslate('ky');
        expect(signOutConfirmationText(1, ky).message).toContain('1 смена өзгөртүүсү серверге али жөнөтүлө элек.');
        expect(signOutConfirmationText(21, ky).message).toContain('21 смена өзгөртүүсү серверге али жөнөтүлө элек.');
    });

    test('counts the offline shift queue; an unreadable queue is unknown, not empty', async () => {
        const operation = { type: 'save_items', timestamp: '2026-11-18T10:00:00.000Z', data: {} };
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify([operation, operation]));
        await expect(countPendingShiftOperations()).resolves.toBe(2);
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);
        await expect(countPendingShiftOperations()).resolves.toBe(0);
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify([{ id: 'damaged' }]));
        await expect(countPendingShiftOperations()).resolves.toBeNull();
        (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));
        await expect(countPendingShiftOperations()).resolves.toBeNull();
        expect(signOutConfirmationText(null).confirmLabel).toBe('Выйти и удалить');
    });
});

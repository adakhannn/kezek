import * as SecureStore from 'expo-secure-store';

import { clearLocalStateOnSessionEnd, clearLocalStateOnSignOut } from '../../lib/accountLocalState';
import { queryClient } from '../../lib/queryClient';

describe('account local state (R25-05)', () => {
    const secureStore = new Map<string, string>();
    const keys = [
        'google_mobile_active_login_v1',
        'telegram_mobile_active_login_v1',
        'whatsapp_mobile_active_attempt_v1',
        'shift_offline_queue',
        'shift_offline_cache',
        'kezek.offline.bookings.user-1',
        'kezek_staff_selection_user-1',
        'kezek.offline.bookings.user-2',
        'kezek_staff_selection_user-2',
    ];

    beforeEach(() => {
        secureStore.clear();
        keys.forEach((key) => secureStore.set(key, 'stored'));
        jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => secureStore.get(key) ?? null);
        jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key: string) => {
            secureStore.delete(key);
        });
        queryClient.setQueryData(['user'], { id: 'user-1' });
    });

    afterEach(() => {
        queryClient.clear();
    });

    test('an involuntary session end clears the cache and the account data but keeps unsent shift work', async () => {
        const pending = clearLocalStateOnSessionEnd('user-1');
        // Synchronous: the next account's first render cannot read the previous ['user'].
        expect(queryClient.getQueryData(['user'])).toBeUndefined();
        await pending;

        expect([...secureStore.keys()].sort()).toEqual([
            'google_mobile_active_login_v1',
            'kezek.offline.bookings.user-2',
            'kezek_staff_selection_user-2',
            'shift_offline_queue',
            'telegram_mobile_active_login_v1',
            'whatsapp_mobile_active_attempt_v1',
        ]);
    });

    test('the sign-out button clears everything of the account, the shift queue included', async () => {
        await clearLocalStateOnSignOut('user-1');

        expect(queryClient.getQueryData(['user'])).toBeUndefined();
        expect([...secureStore.keys()].sort()).toEqual(['kezek.offline.bookings.user-2', 'kezek_staff_selection_user-2']);
    });
});

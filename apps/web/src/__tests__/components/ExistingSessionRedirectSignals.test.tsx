/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useExistingSessionRedirect } from '@/app/auth/sign-in/useExistingSessionRedirect';
import { supabase } from '@/lib/supabaseClient';

jest.mock('@/lib/supabaseClient', () => ({
    supabase: { auth: { getUser: jest.fn(), onAuthStateChange: jest.fn() } },
}));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn() }));

type AuthListener = Parameters<typeof supabase.auth.onAuthStateChange>[0];
type UserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;
const userResult = { data: { user: { id: 'unit-existing-user' } }, error: null } as UserResult;
const session = { user: userResult.data.user } as Parameters<AuthListener>[1];

describe('existing-session redirect signals', () => {
    let listener: AuthListener;
    const unsubscribe = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(supabase.auth.getUser).mockResolvedValue(userResult);
        jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(callback => {
            listener = callback;
            return { data: { subscription: { unsubscribe } } } as ReturnType<typeof supabase.auth.onAuthStateChange>;
        });
    });

    it('coalesces the initial authenticated event and initial user lookup', async () => {
        const decideAndGo = jest.fn().mockResolvedValue(undefined);
        renderHook(() => useExistingSessionRedirect({ redirectParam: '/terms', decideAndGo }));
        await act(async () => { listener('INITIAL_SESSION', session); });
        expect(decideAndGo).toHaveBeenCalledTimes(1);
        expect(decideAndGo).toHaveBeenCalledWith('/terms');
    });

    it('does not restart a pending navigation on repeated auth notifications', async () => {
        const decideAndGo = jest.fn(() => new Promise<void>(() => {}));
        renderHook(() => useExistingSessionRedirect({ redirectParam: '/terms', decideAndGo }));
        await act(async () => { listener('SIGNED_IN', session); listener('TOKEN_REFRESHED', session); });
        expect(decideAndGo).toHaveBeenCalledTimes(1);
    });

    it('does not navigate from a user lookup completed after unmount', async () => {
        let resolveUser!: (result: UserResult) => void;
        jest.mocked(supabase.auth.getUser).mockReturnValue(new Promise(resolve => { resolveUser = resolve; }));
        const decideAndGo = jest.fn().mockResolvedValue(undefined);
        const { unmount } = renderHook(() => useExistingSessionRedirect({ redirectParam: '/terms', decideAndGo }));
        unmount();
        await act(async () => { resolveUser(userResult); });
        expect(decideAndGo).not.toHaveBeenCalled();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('keeps the guest on the sign-in form', async () => {
        jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: null } as UserResult);
        const decideAndGo = jest.fn().mockResolvedValue(undefined);
        renderHook(() => useExistingSessionRedirect({ redirectParam: '/terms', decideAndGo }));
        await act(async () => { listener('INITIAL_SESSION', null); });
        expect(decideAndGo).not.toHaveBeenCalled();
    });

    it('allows a later auth signal to retry a rejected decision', async () => {
        const decideAndGo = jest.fn()
            .mockRejectedValueOnce(new Error('unit-decision-failure'))
            .mockResolvedValue(undefined);
        renderHook(() => useExistingSessionRedirect({ redirectParam: '/terms', decideAndGo }));
        await act(async () => {});
        expect(decideAndGo).toHaveBeenCalledTimes(1);
        await act(async () => { listener('SIGNED_IN', session); });
        expect(decideAndGo).toHaveBeenCalledTimes(2);
    });
});

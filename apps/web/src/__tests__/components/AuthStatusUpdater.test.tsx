/** @jest-environment jsdom */

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { act, render } from '@testing-library/react';

import { AuthStatusUpdater } from '@/app/_components/AuthStatusWrapper';

const refresh = jest.fn();
const unsubscribe = jest.fn();
let authCallback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;

jest.mock('next/navigation', () => ({
    useRouter: () => ({ refresh }),
}));

jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        auth: {
            onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
                authCallback = callback;
                return { data: { subscription: { unsubscribe } } };
            },
        },
    },
}));

function session(userId: string): Session {
    return { user: { id: userId } } as Session;
}

describe('AuthStatusUpdater', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        refresh.mockReset();
        unsubscribe.mockReset();
        authCallback = undefined;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('does not refresh for the initial session, duplicate sign-in, or token refresh', () => {
        render(<AuthStatusUpdater />);

        act(() => {
            authCallback?.('INITIAL_SESSION', session('user-1'));
            authCallback?.('SIGNED_IN', session('user-1'));
            authCallback?.('TOKEN_REFRESHED', session('user-1'));
            jest.runAllTimers();
        });

        expect(refresh).not.toHaveBeenCalled();
    });

    it('refreshes once for a real identity change and once for sign-out', () => {
        render(<AuthStatusUpdater />);

        act(() => {
            authCallback?.('INITIAL_SESSION', session('user-1'));
            authCallback?.('SIGNED_IN', session('user-2'));
            jest.runAllTimers();
        });
        expect(refresh).toHaveBeenCalledTimes(1);

        act(() => {
            authCallback?.('SIGNED_OUT', null);
            jest.runAllTimers();
        });
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('cancels pending work and unsubscribes on unmount', () => {
        const view = render(<AuthStatusUpdater />);
        act(() => {
            authCallback?.('INITIAL_SESSION', session('user-1'));
            authCallback?.('USER_UPDATED', session('user-1'));
        });

        view.unmount();
        act(() => jest.runAllTimers());

        expect(refresh).not.toHaveBeenCalled();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});

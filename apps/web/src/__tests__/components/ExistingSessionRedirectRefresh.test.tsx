/** @jest-environment jsdom */

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { act, renderHook } from '@testing-library/react';

import { useSignInRedirectDecision } from '@/app/auth/sign-in/useSignInRedirectDecision';
import { decideSignInRedirect } from '@/lib/signInRedirectLogic';
import { supabase } from '@/lib/supabaseClient';

jest.mock('@/lib/signInRedirectLogic', () => ({ decideSignInRedirect: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getUser: jest.fn() } } }));

describe('existing session server-rendered auth recovery', () => {
    const replace = jest.fn();
    const refresh = jest.fn();
    const router = { replace, refresh } as unknown as AppRouterInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'fixture-existing-client' } }, error: null } as Awaited<ReturnType<typeof supabase.auth.getUser>>);
    });

    it.each(['/', '/cabinet/bookings'])('refreshes server auth state after resolving existing session to %s', async target => {
        jest.mocked(decideSignInRedirect).mockResolvedValue(target);
        const { result } = renderHook(() => useSignInRedirectDecision({ router }));
        await act(async () => result.current.decideAndGo(target));
        expect(decideSignInRedirect).toHaveBeenCalledWith(expect.any(Object), target, 'fixture-existing-client');
        expect(replace).toHaveBeenCalledWith(target);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(replace.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
    });

    it('does not navigate or refresh when redirect decision fails', async () => {
        jest.mocked(decideSignInRedirect).mockRejectedValue(new Error('fixture-decision-failure'));
        const { result } = renderHook(() => useSignInRedirectDecision({ router }));
        await act(async () => { await expect(result.current.decideAndGo('/')).rejects.toThrow('fixture-decision-failure'); });
        expect(replace).not.toHaveBeenCalled();
        expect(refresh).not.toHaveBeenCalled();
    });
});

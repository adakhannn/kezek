import {
    extractHashTokens,
    handleDeepLinkAuth,
    isAuthCallbackUrl,
    tryRestorePendingSession,
} from '../../navigation/useRootNavigationSession';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            setSession: jest.fn(),
            exchangeCodeForSession: jest.fn(),
        },
    },
}));

describe('useRootNavigationSession helpers', () => {
    const mockedSupabase = supabase as unknown as {
        auth: {
            setSession: jest.Mock;
            exchangeCodeForSession: jest.Mock;
        };
    };

    beforeEach(() => {
        mockedSupabase.auth.setSession.mockResolvedValue({ error: null });
        mockedSupabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
        global.fetch = jest.fn();
    });

    afterEach(() => {
        mockedSupabase.auth.setSession.mockReset();
        mockedSupabase.auth.exchangeCodeForSession.mockReset();
        jest.resetAllMocks();
    });

    test('detects auth callback urls', () => {
        expect(isAuthCallbackUrl('kezek://auth/callback?code=123')).toBe(true);
        expect(isAuthCallbackUrl('kezek://home')).toBe(false);
    });

    test('extracts hash tokens from callback url', () => {
        expect(
            extractHashTokens('kezek://auth/callback#access_token=token-1&refresh_token=token-2'),
        ).toEqual({
            accessToken: 'token-1',
            refreshToken: 'token-2',
        });
    });

    test('handles callback urls with access and refresh tokens', async () => {
        const handled = await handleDeepLinkAuth(
            'kezek://auth/callback#access_token=access-1&refresh_token=refresh-1',
            'https://kezek.kg',
        );

        expect(handled).toBe(true);
        expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
            access_token: 'access-1',
            refresh_token: 'refresh-1',
        });
    });

    test('handles callback urls with exchange_code via mobile api', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                accessToken: 'access-2',
                refreshToken: 'refresh-2',
            }),
        });

        const handled = await handleDeepLinkAuth(
            'kezek://callback-mobile?exchange_code=code-123',
            'https://kezek.kg',
        );

        expect(handled).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
            'https://kezek.kg/api/auth/mobile-exchange?code=code-123',
        );
        expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
            access_token: 'access-2',
            refresh_token: 'refresh-2',
        });
    });

    test('handles callback urls with oauth code', async () => {
        const handled = await handleDeepLinkAuth(
            'kezek://auth/callback?code=oauth-code',
            'https://kezek.kg',
        );

        expect(handled).toBe(true);
        expect(mockedSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code');
    });

    test('restores pending session via mobile exchange endpoint', async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    hasPending: true,
                    code: 'pending-123',
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    accessToken: 'access-3',
                    refreshToken: 'refresh-3',
                }),
            });

        const restored = await tryRestorePendingSession('https://kezek.kg');

        expect(restored).toBe(true);
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            'https://kezek.kg/api/auth/mobile-exchange?check=true',
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            'https://kezek.kg/api/auth/mobile-exchange?code=pending-123',
        );
        expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
            access_token: 'access-3',
            refresh_token: 'refresh-3',
        });
    });
});

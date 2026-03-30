import {
    __resetMobileExchangeStoreForTests,
    exchangeMobileTokens,
    getLatestPendingMobileExchange,
    storeMobileTokens,
} from '@/lib/mobileExchangeService';

describe('mobileExchangeService', () => {
    beforeEach(() => {
        __resetMobileExchangeStoreForTests();
    });

    test('stores tokens and exchanges them once', () => {
        const { code } = storeMobileTokens({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });

        const exchanged = exchangeMobileTokens(code);
        expect(exchanged).toEqual({
            ok: true,
            data: {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            },
        });

        const secondAttempt = exchangeMobileTokens(code);
        expect(secondAttempt).toEqual({
            ok: false,
            error: 'not_found',
            message: 'Неверный или истекший код',
            status: 404,
        });
    });

    test('returns latest pending code', () => {
        storeMobileTokens({
            accessToken: 'access-token-1',
            refreshToken: 'refresh-token-1',
        });
        const latest = storeMobileTokens({
            accessToken: 'access-token-2',
            refreshToken: 'refresh-token-2',
        });

        const pending = getLatestPendingMobileExchange();
        expect(pending).not.toBeNull();
        expect(pending?.code).toBe(latest.code);
    });
});

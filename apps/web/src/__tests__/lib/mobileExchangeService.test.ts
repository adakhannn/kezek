import {
    __resetMobileExchangeStoreForTests,
    exchangeMobileTokens,
    storeMobileTokens,
} from '@/lib/mobileExchangeService';

describe('mobileExchangeService', () => {
    beforeEach(() => {
        __resetMobileExchangeStoreForTests();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('allows exchange code only once', () => {
        const { code } = storeMobileTokens({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });

        const first = exchangeMobileTokens(code);
        expect(first.ok).toBe(true);

        const second = exchangeMobileTokens(code);
        expect(second.ok).toBe(false);
        if (second.ok) {
            return;
        }

        expect(second.error).toBe('conflict');
        expect(second.status).toBe(409);
    });

    test('expires exchange code after ttl', () => {
        const nowSpy = jest.spyOn(Date, 'now');
        nowSpy.mockReturnValue(1_000_000);

        const { code } = storeMobileTokens({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });

        nowSpy.mockReturnValue(1_000_000 + 2 * 60 * 1000 + 1);

        const result = exchangeMobileTokens(code);
        expect(result.ok).toBe(false);
        if (result.ok) {
            return;
        }

        expect(result.error).toBe('validation');
        expect(result.status).toBe(410);
    });
});

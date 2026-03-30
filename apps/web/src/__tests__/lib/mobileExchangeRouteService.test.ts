import {
    runMobileExchangeGet,
    runMobileExchangePost,
} from '@/lib/mobileExchangeRouteService';
import { __resetMobileExchangeStoreForTests } from '@/lib/mobileExchangeService';

describe('mobileExchangeRouteService', () => {
    beforeEach(() => {
        __resetMobileExchangeStoreForTests();
    });

    test('returns validation error when post payload is incomplete', () => {
        const result = runMobileExchangePost({
            accessToken: 'access-token',
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать accessToken и refreshToken',
        });
    });

    test('stores tokens and exchanges them by code', () => {
        const postResult = runMobileExchangePost({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });

        expect(postResult.ok).toBe(true);
        if (!postResult.ok) {
            return;
        }

        const getResult = runMobileExchangeGet({
            code: postResult.payload.code,
        });

        expect(getResult).toEqual({
            ok: true,
            payload: {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            },
        });
    });

    test('returns latest pending code in check mode', () => {
        runMobileExchangePost({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });

        const result = runMobileExchangeGet({
            check: true,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }
        expect(result.payload).toHaveProperty('hasPending', true);
        expect(result.payload).toHaveProperty('code');
    });
});

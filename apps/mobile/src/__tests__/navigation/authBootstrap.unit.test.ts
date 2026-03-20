import {
    buildMobileExchangeUrl,
    buildMobilePendingCheckUrl,
    extractAuthCallbackParams,
    isAuthCallbackUrl,
    resolveMobileApiUrl,
} from '../../navigation/authBootstrap';

describe('mobile auth bootstrap helpers', () => {
    test('detects callback urls used by RootNavigator', () => {
        expect(isAuthCallbackUrl('kezek://auth/callback?exchange_code=abc')).toBe(true);
        expect(isAuthCallbackUrl('https://kezek.kg/callback-mobile?code=abc')).toBe(true);
        expect(isAuthCallbackUrl('kezek://home')).toBe(false);
    });

    test('extracts exchange_code and OAuth code from query params', () => {
        expect(
            extractAuthCallbackParams('kezek://auth/callback?exchange_code=code-123&code=supa-code')
        ).toEqual({
            accessToken: null,
            refreshToken: null,
            code: 'supa-code',
            exchangeCode: 'code-123',
        });
    });

    test('extracts tokens from url hash even for non-standard deep links', () => {
        expect(
            extractAuthCallbackParams('kezek://auth#access_token=access%201&refresh_token=refresh%202')
        ).toEqual({
            accessToken: 'access 1',
            refreshToken: 'refresh 2',
            code: null,
            exchangeCode: null,
        });
    });

    test('uses the same API url precedence as RootNavigator', () => {
        expect(
            resolveMobileApiUrl({
                envApiUrl: 'https://env.example',
                expoConfigApiUrl: 'https://expo.example',
                manifestApiUrl: 'https://manifest.example',
            })
        ).toBe('https://env.example');

        expect(
            resolveMobileApiUrl({
                expoConfigApiUrl: 'https://expo.example',
                manifestApiUrl: 'https://manifest.example',
            })
        ).toBe('https://expo.example');

        expect(resolveMobileApiUrl({})).toBe('https://kezek.kg');
    });

    test('builds exchange and pending-check endpoints', () => {
        expect(buildMobileExchangeUrl('https://kezek.kg', 'a b')).toBe(
            'https://kezek.kg/api/auth/mobile-exchange?code=a%20b'
        );
        expect(buildMobilePendingCheckUrl('https://kezek.kg')).toBe(
            'https://kezek.kg/api/auth/mobile-exchange?check=true'
        );
    });
});

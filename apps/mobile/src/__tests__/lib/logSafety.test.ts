import { createLogger, maskUrl, sanitizeObject } from '@shared-client/log';

describe('log safety', () => {
    test('redacts auth data embedded in callback URLs and free-form messages', () => {
        const accessToken = 'm1-access-secret-token';
        const refreshToken = 'm1-refresh-secret-token';
        const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtMSJ9.signature';
        const result = sanitizeObject({
            url: `kezek://auth/callback#access_token=${accessToken}&refresh_token=${refreshToken}`,
            message: `request failed Authorization=Bearer ${accessToken} token=${jwt}`,
        });
        const output = JSON.stringify(result);

        expect(output).not.toContain(accessToken);
        expect(output).not.toContain(refreshToken);
        expect(output).not.toContain(jwt);
        expect(output).toContain('access_token=[REDACTED]');
        expect(output).toContain('[REDACTED]');
    });

    test('masks custom-scheme auth payloads', () => {
        const masked = maskUrl(
            'kezek://auth/callback?code=secret-code&redirect=home#access_token=access-secret',
        );

        expect(masked).not.toContain('secret-code');
        expect(masked).not.toContain('access-secret');
    });

    test('does not treat diagnostic keys containing code as OAuth secrets', () => {
        expect(sanitizeObject({ statusCode: 401, errorCode: 'unauthorized' })).toEqual({
            statusCode: 401,
            errorCode: 'unauthorized',
        });
    });

    test('logger never sends raw secrets to console', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const logger = createLogger(() => true);

        logger.logDebug('M1', 'callback', {
            url: 'kezek://auth/callback#access_token=raw-access&refresh_token=raw-refresh',
            details: 'Authorization: Bearer raw-bearer-token',
        });

        const output = JSON.stringify(consoleSpy.mock.calls);
        expect(output).not.toContain('raw-access');
        expect(output).not.toContain('raw-refresh');
        expect(output).not.toContain('raw-bearer-token');

        consoleSpy.mockRestore();
    });

    test('production error logger omits error details entirely', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const logger = createLogger(() => false);

        logger.logError('M1', 'request failed', {
            access_token: 'raw-production-token',
        });

        expect(consoleSpy).toHaveBeenCalledWith('[M1] request failed');
        expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain('raw-production-token');

        consoleSpy.mockRestore();
    });
});

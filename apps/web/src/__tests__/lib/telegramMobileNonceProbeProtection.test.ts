import {
    __resetNonceProbeProtectionForTests,
    isNonceProbeBlocked,
    registerInvalidNonceProbe,
} from '@/lib/telegramMobileNonceProbeProtection';

describe('telegramMobileNonceProbeProtection', () => {
    beforeEach(() => {
        __resetNonceProbeProtectionForTests();
    });

    test('does not block before threshold', () => {
        const identifier = 'ip:127.0.0.1';
        for (let i = 0; i < 9; i += 1) {
            registerInvalidNonceProbe(identifier);
        }

        const result = isNonceProbeBlocked(identifier);
        expect(result.blocked).toBe(false);
    });

    test('blocks after threshold of invalid nonce probes', () => {
        const identifier = 'ip:127.0.0.1';
        for (let i = 0; i < 10; i += 1) {
            registerInvalidNonceProbe(identifier);
        }

        const result = isNonceProbeBlocked(identifier);
        expect(result.blocked).toBe(true);
        expect(result.retryAfterSec).toBeGreaterThan(0);
    });
});


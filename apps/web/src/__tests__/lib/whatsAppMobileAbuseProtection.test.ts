import {
    __resetWhatsAppMobileAbuseProtectionForTests,
    checkWhatsAppMobileStartAbuse,
    checkWhatsAppMobileVerifyAbuse,
} from '@/lib/whatsAppMobileAbuseProtection';

describe('whatsAppMobileAbuseProtection', () => {
    beforeEach(() => {
        __resetWhatsAppMobileAbuseProtectionForTests();
    });

    test('start allows attempts under phone limit and blocks after threshold', () => {
        const identifier = 'ip:127.0.0.1';
        const phone = '+996500574029';

        for (let i = 0; i < 5; i += 1) {
            const result = checkWhatsAppMobileStartAbuse({ identifier, phone });
            expect(result.ok).toBe(true);
        }

        const blocked = checkWhatsAppMobileStartAbuse({ identifier, phone });
        expect(blocked.ok).toBe(false);
        if (blocked.ok) {
            return;
        }
        expect(blocked.reason).toBe('phone_rate_limit');
        expect(blocked.retryAfterSec).toBeGreaterThan(0);
    });

    test('verify allows attempts under limit and blocks after threshold', () => {
        const identifier = 'ip:127.0.0.1';
        const attemptId = 'attempt-1';

        for (let i = 0; i < 10; i += 1) {
            const result = checkWhatsAppMobileVerifyAbuse({ identifier, attemptId });
            expect(result.ok).toBe(true);
        }

        const blocked = checkWhatsAppMobileVerifyAbuse({ identifier, attemptId });
        expect(blocked.ok).toBe(false);
        if (blocked.ok) {
            return;
        }
        expect(blocked.reason).toBe('attempt_rate_limit');
        expect(blocked.retryAfterSec).toBeGreaterThan(0);
    });
});


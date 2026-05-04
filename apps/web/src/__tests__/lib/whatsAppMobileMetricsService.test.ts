import {
    trackWhatsAppMobileMetric,
    type WhatsAppMobileMetricsAdminLike,
} from '@/lib/whatsAppMobileMetricsService';

describe('whatsAppMobileMetricsService', () => {
    function createAdmin(error: { message?: string } | null = null) {
        const insert = jest.fn().mockResolvedValue({ error });
        const admin: WhatsAppMobileMetricsAdminLike = {
            from: jest.fn().mockReturnValue({
                insert,
            }),
        };

        return { admin, insert };
    }

    test('writes started metric with hashed attempt in metadata', async () => {
        const { admin, insert } = createAdmin();

        await trackWhatsAppMobileMetric(
            'mobile_whatsapp_login_started',
            {
                attemptId: 'attempt-123',
                phoneHash: 'phone-hash-1',
                metadata: {
                    flow: 'mobile_start',
                },
            },
            { admin, allowInTests: true },
        );

        expect(insert).toHaveBeenCalledTimes(1);
        const payload = insert.mock.calls[0][0] as {
            event_type: string;
            source: string;
            session_id: string | null;
            metadata: Record<string, unknown>;
        };

        expect(payload.event_type).toBe('mobile_whatsapp_login_started');
        expect(payload.source).toBe('mobile_auth_whatsapp');
        expect(typeof payload.session_id).toBe('string');
        expect(payload.metadata).toHaveProperty('flow', 'mobile_start');
        expect(payload.metadata).toHaveProperty('attempt_hash');
        expect(payload.metadata).toHaveProperty('phone_hash', 'phone-hash-1');
        expect(payload.metadata).not.toHaveProperty('attemptId');
    });

    test('does not throw on insert error', async () => {
        const { admin } = createAdmin({ message: 'db failed' });

        await expect(
            trackWhatsAppMobileMetric(
                'mobile_whatsapp_login_failed',
                { attemptId: 'attempt-err' },
                { admin, allowInTests: true },
            ),
        ).resolves.toBeUndefined();
    });
});


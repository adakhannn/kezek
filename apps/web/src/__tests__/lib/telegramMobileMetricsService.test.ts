import {
    trackTelegramMobileMetric,
    type TelegramMobileMetricsAdminLike,
} from '@/lib/telegramMobileMetricsService';

describe('telegramMobileMetricsService', () => {
    function createAdmin(error: { message?: string } | null = null) {
        const insert = jest.fn().mockResolvedValue({ error });
        const admin: TelegramMobileMetricsAdminLike = {
            from: jest.fn().mockReturnValue({
                insert,
            }),
        };

        return { admin, insert };
    }

    test('writes started metric with hashed nonce in metadata', async () => {
        const { admin, insert } = createAdmin();

        await trackTelegramMobileMetric(
            'telegram_mobile_login_started',
            {
                nonce: 'nonce-123',
                metadata: {
                    appName: 'Kezek Mobile',
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

        expect(payload.event_type).toBe('telegram_mobile_login_started');
        expect(payload.source).toBe('mobile_auth_telegram');
        expect(typeof payload.session_id).toBe('string');
        expect(payload.metadata).toHaveProperty('appName', 'Kezek Mobile');
        expect(payload.metadata).toHaveProperty('nonce_hash');
        expect(payload.metadata).not.toHaveProperty('nonce');
    });

    test('does not throw on insert error', async () => {
        const { admin } = createAdmin({ message: 'db failed' });

        await expect(
            trackTelegramMobileMetric(
                'telegram_mobile_login_failed',
                { nonce: 'nonce-err' },
                { admin, allowInTests: true },
            ),
        ).resolves.toBeUndefined();
    });
});

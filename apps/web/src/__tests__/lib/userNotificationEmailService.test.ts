import {
    removeNotificationEmailSource,
    syncNotificationEmailsFromUser,
} from '@/lib/userNotificationEmailService';

describe('userNotificationEmailService', () => {
    test('syncs account and provider emails while preserving their sources', async () => {
        const rpc = jest.fn().mockResolvedValue({ error: null });

        await syncNotificationEmailsFromUser(
            { rpc },
            {
                id: 'user-1',
                email: 'Primary@Example.com',
                email_confirmed_at: '2026-07-23T00:00:00Z',
                identities: [
                    {
                        id: 'google-subject',
                        provider: 'google',
                        identity_data: { email: 'Google@Example.com' },
                    },
                ],
                user_metadata: {
                    yandex_id: 'yandex-subject',
                    yandex_email: 'Yandex@Example.com',
                },
            },
        );

        expect(rpc).toHaveBeenCalledTimes(3);
        expect(rpc).toHaveBeenCalledWith('sync_user_notification_email', {
            target_user_id: 'user-1',
            target_email: 'Google@Example.com',
            target_source: 'google',
            target_provider_subject: 'google-subject',
        });
        expect(rpc).toHaveBeenCalledWith('sync_user_notification_email', {
            target_user_id: 'user-1',
            target_email: 'Yandex@Example.com',
            target_source: 'yandex',
            target_provider_subject: 'yandex-subject',
        });
    });

    test('removes only the disconnected provider source', async () => {
        const rpc = jest.fn().mockResolvedValue({ error: null });

        await removeNotificationEmailSource({ rpc }, 'user-1', 'google');

        expect(rpc).toHaveBeenCalledWith('remove_user_notification_email_source', {
            target_user_id: 'user-1',
            target_source: 'google',
        });
    });
});

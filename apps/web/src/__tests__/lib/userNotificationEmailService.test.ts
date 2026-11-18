import {
    removeNotificationEmailSource,
    syncNotificationEmailsFromUser,
} from '@/lib/userNotificationEmailService';

describe('userNotificationEmailService', () => {
    test('syncs only the confirmed account e-mail and Google identity e-mails', async () => {
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
                // Written by the user through supabase.auth.updateUser({ data }); ignored.
                user_metadata: { yandex_id: 'yandex-subject', yandex_email: 'Yandex@Example.com' },
            } as Parameters<typeof syncNotificationEmailsFromUser>[1],
        );

        expect(rpc).toHaveBeenCalledTimes(2);
        expect(rpc).toHaveBeenCalledWith('sync_user_notification_email', {
            target_user_id: 'user-1',
            target_email: 'Primary@Example.com',
            target_source: 'account',
            target_provider_subject: 'user-1',
        });
        expect(rpc).toHaveBeenCalledWith('sync_user_notification_email', {
            target_user_id: 'user-1',
            target_email: 'Google@Example.com',
            target_source: 'google',
            target_provider_subject: 'google-subject',
        });
        expect(rpc).not.toHaveBeenCalledWith('sync_user_notification_email', expect.objectContaining({ target_source: 'yandex' }));
    });

    test('ignores user-editable user_metadata.yandex_email (API-08)', async () => {
        const rpc = jest.fn().mockResolvedValue({ error: null });

        await syncNotificationEmailsFromUser({ rpc }, {
            id: 'user-1',
            email: null,
            identities: [],
            user_metadata: { yandex_id: '1', yandex_email: 'victim@example.com' },
        } as Parameters<typeof syncNotificationEmailsFromUser>[1]);

        expect(rpc).not.toHaveBeenCalled();
    });

    test('skips an unconfirmed account e-mail and a Google e-mail the provider marks unverified', async () => {
        const rpc = jest.fn().mockResolvedValue({ error: null });

        await syncNotificationEmailsFromUser({ rpc }, {
            id: 'user-1',
            email: 'new@example.com',
            email_confirmed_at: null,
            identities: [{ id: 'g', provider: 'google', identity_data: { email: 'x@gmail.com', email_verified: false } }],
        });

        expect(rpc).not.toHaveBeenCalled();
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

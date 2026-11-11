import { ParticipantDataService } from '@/lib/notifications/ParticipantDataService';
import type { BookingRow } from '@/lib/notifications/types';

test.each(['auth_users_view', 'profiles', 'user_notification_emails'])('worker preparation rejects %s DB failure rather than dropping a recipient', async failedTable => {
    const admin = {
        from: (table: string) => {
            const result = { data: table === 'user_notification_emails' ? [] : null, error: table === failedTable ? { message: 'synthetic failure' } : null };
            const query = { select: () => query, eq: () => query, maybeSingle: async () => result,
                then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
            return query;
        },
    };
    const service = new ParticipantDataService(admin as never, admin as never, true);
    await expect(service.getClientData({ client_id: 'synthetic-user' } as BookingRow)).rejects.toThrow('NOTIFICATION_PARTICIPANT_LOOKUP_FAILED');
});

test('owner auth lookup failure cannot silently fall back to a partial plan', async () => {
    const admin = { auth: { admin: { getUserById: jest.fn().mockResolvedValue({ data: null, error: { message: 'unavailable' } }) } } };
    await expect(new ParticipantDataService(admin as never, admin as never, true).getOwnerData({ owner_id: 'synthetic-owner' } as never)).rejects.toThrow('NOTIFICATION_PARTICIPANT_LOOKUP_FAILED');
});

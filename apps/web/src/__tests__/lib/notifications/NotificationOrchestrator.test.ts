import { NotificationOrchestrator } from '@/lib/notifications/NotificationOrchestrator';
import type { ParticipantData } from '@/lib/notifications/types';

function participant(overrides: Partial<ParticipantData>): ParticipantData {
    return {
        email: null,
        notificationEmails: [],
        name: null,
        phone: null,
        whatsappPhone: null,
        telegramId: null,
        notifyEmail: true,
        notifyWhatsApp: false,
        notifyTelegram: false,
        whatsappVerified: false,
        telegramVerified: false,
        ...overrides,
    };
}

describe('NotificationOrchestrator email recipients', () => {
    test('sends to every selected provider email and deduplicates business recipients', () => {
        const orchestrator = new NotificationOrchestrator(
            {} as never,
            {} as never,
            { apiKey: 'test', from: 'test@example.com' },
        );

        const recipients = (
            orchestrator as unknown as {
                buildEmailRecipients: (
                    client: ParticipantData,
                    staff: ParticipantData,
                    owner: ParticipantData,
                    biz: { email_notify_to: string[] | null },
                ) => Array<{ email: string; role: string }>;
            }
        ).buildEmailRecipients(
            participant({
                notificationEmails: ['client@gmail.com', 'client@yandex.ru'],
                name: 'Client',
            }),
            participant({ notifyEmail: false }),
            participant({
                notificationEmails: ['owner@gmail.com'],
                name: 'Owner',
            }),
            {
                email_notify_to: ['owner@gmail.com', 'office@example.com'],
            },
        );

        expect(recipients.map(({ email, role }) => ({ email, role }))).toEqual([
            { email: 'client@gmail.com', role: 'client' },
            { email: 'client@yandex.ru', role: 'client' },
            { email: 'owner@gmail.com', role: 'owner' },
            { email: 'office@example.com', role: 'admin' },
        ]);
    });
});

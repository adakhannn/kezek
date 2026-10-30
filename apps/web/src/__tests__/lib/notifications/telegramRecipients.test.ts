import { uniqueTelegramRecipients } from '@/lib/notifications/telegramRecipients';
import type { ParticipantData } from '@/lib/notifications/types';

function participant(overrides: Partial<ParticipantData> = {}): ParticipantData {
    return { email: null, notificationEmails: [], name: null, phone: null, whatsappPhone: null,
        telegramId: null, notifyEmail: false, notifyWhatsApp: false, notifyTelegram: true,
        whatsappVerified: false, telegramVerified: true, ...overrides };
}

describe('unique eligible Telegram booking recipients', () => {
    test('one chat gets one identical message across client, staff and owner roles', () => {
        const data = participant({ telegramId: 123 });
        expect(uniqueTelegramRecipients(data, data, data)).toEqual([{ role: 'client', data }]);
    });
    test('distinct chat recipients remain independent', () => {
        expect(uniqueTelegramRecipients(participant({ telegramId: 1 }), participant({ telegramId: 2 }), participant({ telegramId: 3 }))
            .map(({ role, data }) => [role, data.telegramId])).toEqual([['client', 1], ['staff', 2], ['owner', 3]]);
    });
    test('disabled first role does not suppress an eligible later role with the same chat', () => {
        const owner = participant({ telegramId: 123 });
        expect(uniqueTelegramRecipients(participant({ telegramId: 123, notifyTelegram: false }), participant(), owner))
            .toEqual([{ role: 'owner', data: owner }]);
    });
    test('client verification remains required, without changing staff eligibility', () => {
        const staff = participant({ telegramId: 123, telegramVerified: false });
        expect(uniqueTelegramRecipients(staff, staff, participant())).toEqual([{ role: 'staff', data: staff }]);
        expect(uniqueTelegramRecipients(staff, participant(), participant())).toEqual([]);
    });
    test('no chat or disabled notifications produce no recipients', () => {
        expect(uniqueTelegramRecipients(participant(), participant({ telegramId: 123, notifyTelegram: false }), participant())).toEqual([]);
    });
    test('deduplication is scoped to one event, not persistent across booking changes', () => {
        const data = participant({ telegramId: 123 });
        expect(uniqueTelegramRecipients(data, data, data)).toHaveLength(1);
        expect(uniqueTelegramRecipients(data, data, data)).toHaveLength(1);
    });
});

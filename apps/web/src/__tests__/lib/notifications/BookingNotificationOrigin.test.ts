import { prepareBookingNotificationContext } from '@/lib/notifications/BookingNotificationPlanner';
import { ParticipantDataService } from '@/lib/notifications/ParticipantDataService';
import type { BookingRow, ParticipantData } from '@/lib/notifications/types';

jest.mock('@/lib/notifications/ParticipantDataService');
jest.mock('@/lib/env', () => ({
    getEmailFrom: () => 'Kezek <synthetic@example.invalid>',
    getSiteOrigin: () => 'https://kezek.vercel.app',
    getTimezone: () => 'Asia/Bishkek',
}));

const participant: ParticipantData = {
    email: null, notificationEmails: [], name: 'Synthetic', phone: null, whatsappPhone: null, telegramId: null,
    notifyEmail: true, notifyWhatsApp: true, notifyTelegram: true, whatsappVerified: false, telegramVerified: false,
};

const booking: BookingRow = {
    id: 'booking', notification_revision: 1, status: 'confirmed',
    start_at: '2035-01-01T10:00:00Z', end_at: '2035-01-01T10:30:00Z', created_at: '2034-01-01T10:00:00Z',
    client_id: 'client', client_name: 'Synthetic', client_email: null, client_phone: null,
    services: { name_ru: 'Service', duration_min: 30, price_from: 100, price_to: 100 },
    staff: { full_name: 'Staff', email: null, phone: null }, branches: { name: 'Branch', address: null },
    biz: { name: 'Business', tz: 'Asia/Bishkek', slug: 'business', address: null, phones: null, email_notify_to: [] },
};

test('links in notifications use the configured origin, not the lost kezek.kg domain', async () => {
    jest.mocked(ParticipantDataService).mockImplementation(() => ({
        getClientData: jest.fn().mockResolvedValue(participant),
        getStaffData: jest.fn().mockResolvedValue(participant),
        getOwnerData: jest.fn().mockResolvedValue(participant),
    }) as unknown as ParticipantDataService);

    const { details } = await prepareBookingNotificationContext(new ParticipantDataService({} as never, {} as never), booking);

    expect(details.origin).toBe('https://kezek.vercel.app');
});

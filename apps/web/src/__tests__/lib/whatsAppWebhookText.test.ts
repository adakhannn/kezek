import {
    buildBookingChoiceText,
    buildBookingInfoText,
    buildHelpText,
    buildRemindText,
    formatBookingListLine,
    formatBookingStatusText,
} from '@/lib/whatsAppWebhookText';

describe('whatsAppWebhookText', () => {
    const booking = {
        start_at: '2026-03-31T10:00:00.000Z',
        services: { name_ru: 'Стрижка' },
        staff: { full_name: 'Алия' },
    };

    test('formats a booking list line', () => {
        expect(formatBookingListLine(booking, 2)).toContain('2. ');
        expect(formatBookingListLine(booking, 2)).toContain('Стрижка');
        expect(formatBookingListLine(booking, 2)).toContain('Алия');
    });

    test('builds choice text for ambiguous commands', () => {
        const result = buildBookingChoiceText('cancel', [booking, booking]);

        expect(result).toContain('У вас несколько бронирований');
        expect(result).toContain('"отмена 1"');
    });

    test('builds remind text', () => {
        const result = buildRemindText([booking]);

        expect(result).toContain('Ваше ближайшее бронирование');
        expect(result).toContain('Команды: "отмена 1", "подтвердить 1", "помощь"');
    });

    test('builds help text for multiple bookings', () => {
        const result = buildHelpText(2);

        expect(result).toContain('"отмена 1", "отмена 2"');
        expect(result).toContain('"подтвердить 1", "подтвердить 2"');
    });

    test('formats booking statuses', () => {
        expect(formatBookingStatusText('hold')).toBe('Ожидает подтверждения');
        expect(formatBookingStatusText('custom')).toBe('custom');
    });

    test('builds booking info text', () => {
        const result = buildBookingInfoText({
            status: 'confirmed',
            start_at: '2026-03-31T10:00:00.000Z',
            end_at: '2026-03-31T11:00:00.000Z',
            services: { name_ru: 'Стрижка' },
            staff: { full_name: 'Алия' },
            branches: { name: 'Центр', address: 'Абая 10' },
            businesses: { name: 'Salon X' },
        });

        expect(result).toContain('Подтверждено');
        expect(result).toContain('Стрижка');
        expect(result).toContain('Алия');
        expect(result).toContain('Абая 10');
        expect(result).toContain('Salon X');
    });
});

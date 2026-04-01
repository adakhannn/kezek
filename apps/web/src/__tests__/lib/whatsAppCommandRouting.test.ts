import {
    parseBookingIndex,
    routeWhatsAppTextCommand,
} from '@/lib/whatsAppCommandRouting';

describe('whatsAppCommandRouting', () => {
    test('routes remind commands', () => {
        expect(routeWhatsAppTextCommand('Напомни мне', 2)).toEqual({
            kind: 'remind',
            bookingIndex: 0,
            requiresBookingChoice: false,
        });
    });

    test('defaults cancel command to the only booking', () => {
        expect(routeWhatsAppTextCommand('отмена', 1)).toEqual({
            kind: 'cancel',
            bookingIndex: 0,
            requiresBookingChoice: false,
        });
    });

    test('requests booking choice when cancel command is ambiguous', () => {
        expect(routeWhatsAppTextCommand('отмена', 3)).toEqual({
            kind: 'cancel',
            bookingIndex: null,
            requiresBookingChoice: true,
        });
    });

    test('uses explicit booking number for cancel command', () => {
        expect(routeWhatsAppTextCommand('отмена 2', 3)).toEqual({
            kind: 'cancel',
            bookingIndex: 1,
            requiresBookingChoice: false,
        });
    });

    test('falls back to the first booking when confirm index is out of range', () => {
        expect(routeWhatsAppTextCommand('подтвердить 8', 2)).toEqual({
            kind: 'confirm',
            bookingIndex: 0,
            requiresBookingChoice: false,
        });
    });

    test('routes help commands', () => {
        expect(routeWhatsAppTextCommand('help', 0)).toEqual({
            kind: 'help',
            bookingIndex: null,
            requiresBookingChoice: false,
        });
    });

    test('falls back to booking info for unknown messages', () => {
        expect(routeWhatsAppTextCommand('моя запись', 2)).toEqual({
            kind: 'booking_info',
            bookingIndex: 0,
            requiresBookingChoice: false,
        });
    });

    test('parses indexed commands with optional wording', () => {
        expect(parseBookingIndex('отменить бронь 3', 'cancel')).toBe(3);
        expect(parseBookingIndex('подтвердить 2', 'confirm')).toBe(2);
    });
});

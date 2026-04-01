jest.mock('@/lib/log', () => ({
    logError: jest.fn(),
}));

import { executeWhatsAppBookingCommand } from '@/lib/whatsAppBookingCommandFlow';

function createBookingQuery(booking: any) {
    return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: booking }),
        }),
    };
}

describe('whatsAppBookingCommandFlow', () => {
    test('sends no-active-booking text when booking id is absent', async () => {
        const sendMessage = jest.fn();

        await executeWhatsAppBookingCommand(
            {
                supabase: { from: jest.fn() } as any,
                sendMessage,
                runAction: jest.fn(),
            },
            {
                kind: 'cancel',
                fromPhone: '+7700',
                bookingId: null,
                clientId: null,
            },
        );

        expect(sendMessage).toHaveBeenCalledWith('У вас нет активных бронирований для отмены.');
    });

    test('rejects чужое бронирование', async () => {
        const sendMessage = jest.fn();
        const supabase = {
            from: jest.fn().mockReturnValue(
                createBookingQuery({
                    id: 'booking-1',
                    status: 'hold',
                    start_at: '2026-03-31T10:00:00.000Z',
                    client_id: 'client-2',
                    client_phone: '+7999',
                    services: { name_ru: 'Стрижка' },
                    staff: { full_name: 'Алия' },
                }),
            ),
        } as any;

        await executeWhatsAppBookingCommand(
            {
                supabase,
                sendMessage,
                runAction: jest.fn(),
            },
            {
                kind: 'confirm',
                fromPhone: '+7700',
                bookingId: 'booking-1',
                clientId: 'client-1',
            },
        );

        expect(sendMessage).toHaveBeenCalledWith(
            'Это бронирование не связано с вашим номером телефона.',
        );
    });

    test('handles already confirmed booking', async () => {
        const sendMessage = jest.fn();
        const supabase = {
            from: jest.fn().mockReturnValue(
                createBookingQuery({
                    id: 'booking-1',
                    status: 'confirmed',
                    start_at: '2026-03-31T10:00:00.000Z',
                    client_id: 'client-1',
                    client_phone: '+7700',
                    services: { name_ru: 'Стрижка' },
                    staff: { full_name: 'Алия' },
                }),
            ),
        } as any;

        await executeWhatsAppBookingCommand(
            {
                supabase,
                sendMessage,
                runAction: jest.fn(),
            },
            {
                kind: 'confirm',
                fromPhone: '+7700',
                bookingId: 'booking-1',
                clientId: 'client-1',
            },
        );

        expect(sendMessage).toHaveBeenCalledWith('Это бронирование уже подтверждено.');
    });

    test('sends action failure text when booking action fails', async () => {
        const sendMessage = jest.fn();
        const supabase = {
            from: jest.fn().mockReturnValue(
                createBookingQuery({
                    id: 'booking-1',
                    status: 'hold',
                    start_at: '2026-03-31T10:00:00.000Z',
                    client_id: 'client-1',
                    client_phone: '+7700',
                    services: { name_ru: 'Стрижка' },
                    staff: { full_name: 'Алия' },
                }),
            ),
        } as any;

        await executeWhatsAppBookingCommand(
            {
                supabase,
                sendMessage,
                runAction: jest.fn().mockRejectedValue(new Error('boom')),
            },
            {
                kind: 'cancel',
                fromPhone: '+7700',
                bookingId: 'booking-1',
                clientId: 'client-1',
            },
        );

        expect(sendMessage).toHaveBeenCalledWith(
            'Не удалось отменить бронирование. Пожалуйста, попробуйте позже.',
        );
    });

    test('sends success text after successful action', async () => {
        const sendMessage = jest.fn();
        const supabase = {
            from: jest.fn().mockReturnValue(
                createBookingQuery({
                    id: 'booking-1',
                    status: 'hold',
                    start_at: '2026-03-31T10:00:00.000Z',
                    client_id: 'client-1',
                    client_phone: '+7700',
                    services: { name_ru: 'Стрижка' },
                    staff: { full_name: 'Алия' },
                }),
            ),
        } as any;

        await executeWhatsAppBookingCommand(
            {
                supabase,
                sendMessage,
                runAction: jest.fn().mockResolvedValue(undefined),
            },
            {
                kind: 'confirm',
                fromPhone: '+7700',
                bookingId: 'booking-1',
                clientId: 'client-1',
            },
        );

        expect(sendMessage).toHaveBeenCalled();
        expect(sendMessage.mock.calls[0][0]).toContain('Бронирование подтверждено.');
        expect(sendMessage.mock.calls[0][0]).toContain('Стрижка');
        expect(sendMessage.mock.calls[0][0]).toContain('Алия');
    });
});

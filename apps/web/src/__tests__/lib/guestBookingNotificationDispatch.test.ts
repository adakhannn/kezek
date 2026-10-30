import { dispatchCreatedGuestBookingNotification } from '@/lib/guestBookingNotificationDispatch';
import { BookingDataService } from '@/lib/notifications/BookingDataService';
import { deliverStoredBookingNotification } from '@/lib/notifyBookingService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/env', () => ({ getEmailFrom: () => 'test@example.com', getResendApiKey: () => 'test-key' }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/notifications/BookingDataService');
jest.mock('@/lib/notifyBookingService', () => ({ deliverStoredBookingNotification: jest.fn() }));

const command = { biz_id: 'biz', branch_id: 'branch', staff_id: 'staff', service_id: 'service', start_at: '2026-10-12T03:00:00Z', client_name: 'Guest', client_phone: '+996500574029' };
const booking = { id: 'created-id', client_id: null, status: 'confirmed' };
let query: { select: jest.Mock; eq: jest.Mock; is: jest.Mock; maybeSingle: jest.Mock };
let admin: { from: jest.Mock };

beforeEach(() => {
    jest.clearAllMocks();
    query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: booking.id }, error: null }) };
    admin = { from: jest.fn().mockReturnValue(query) };
    jest.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    jest.mocked(BookingDataService).mockImplementation(() => ({ getBookingById: jest.fn().mockResolvedValue(booking) }) as never);
    jest.mocked(deliverStoredBookingNotification).mockResolvedValue({ ok: true, data: { sent: 0, whatsappSent: 0, telegramSent: 1 } });
});

it('reads only the new guest booking in the exact command scope before internal delivery', async () => {
    await dispatchCreatedGuestBookingNotification(booking.id, 'confirm', command);
    for (const [column, value] of [['id', booking.id], ['biz_id', 'biz'], ['branch_id', 'branch'], ['staff_id', 'staff'], ['start_at', command.start_at], ['status', 'confirmed']]) {
        expect(query.eq).toHaveBeenCalledWith(column, value);
    }
    expect(query.is).toHaveBeenCalledWith('client_id', null);
    expect(deliverStoredBookingNotification).toHaveBeenCalledWith(admin, admin, booking, 'confirm', { apiKey: 'test-key', from: 'test@example.com' });
});

it.each([{ data: null, error: null }, { data: null, error: { message: 'failed' } }])('fails closed on missing or invalid command scope', async (result) => {
    query.maybeSingle.mockResolvedValue(result);
    await expect(dispatchCreatedGuestBookingNotification(booking.id, 'confirm', command)).rejects.toThrow('scope mismatch');
    expect(deliverStoredBookingNotification).not.toHaveBeenCalled();
});

it.each([null, { ...booking, client_id: 'user' }, { ...booking, status: 'cancelled' }])('does not send a cancelled, missing, or registered-user booking', async (stored) => {
    jest.mocked(BookingDataService).mockImplementation(() => ({ getBookingById: jest.fn().mockResolvedValue(stored) }) as never);
    await expect(dispatchCreatedGuestBookingNotification(booking.id, 'confirm', command)).rejects.toThrow('notification state');
    expect(deliverStoredBookingNotification).not.toHaveBeenCalled();
});

it('reports a failed delivery instead of silently claiming success', async () => {
    jest.mocked(deliverStoredBookingNotification).mockResolvedValue({ ok: false, error: 'internal', status: 500, message: 'failed' });
    await expect(dispatchCreatedGuestBookingNotification(booking.id, 'confirm', command)).rejects.toThrow('notification failed');
});

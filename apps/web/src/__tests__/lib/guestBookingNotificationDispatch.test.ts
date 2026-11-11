import { dispatchCreatedGuestBookingNotification } from '@/lib/guestBookingNotificationDispatch';
import { enqueueStoredBookingNotification } from '@/lib/notifyBookingService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/notifyBookingService', () => ({ enqueueStoredBookingNotification: jest.fn() }));
const command = { biz_id: 'biz', branch_id: 'branch', staff_id: 'staff', service_id: 'service', start_at: '2035-01-01T10:00:00Z', client_name: 'Synthetic', client_phone: '+996555000111' };
const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), maybeSingle: jest.fn() };
const admin = { from: jest.fn(() => query) };
beforeEach(() => {
    jest.clearAllMocks();
    query.maybeSingle.mockResolvedValue({ data: { id: 'booking', status: 'confirmed' }, error: null });
    jest.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    jest.mocked(enqueueStoredBookingNotification).mockResolvedValue('event');
});
test.each(['confirm', 'hold'] as const)('guest %s enqueue is constrained by the complete successful command', async type => {
    await dispatchCreatedGuestBookingNotification('booking', type, command);
    for (const [column, value] of [['id', 'booking'], ['biz_id', 'biz'], ['branch_id', 'branch'], ['staff_id', 'staff'], ['start_at', command.start_at]]) expect(query.eq).toHaveBeenCalledWith(column, value);
    expect(query.is).toHaveBeenCalledWith('client_id', null);
    expect(query.in).toHaveBeenCalledWith('status', type === 'confirm' ? ['confirmed'] : ['hold', 'pending_hold']);
    expect(enqueueStoredBookingNotification).toHaveBeenCalledWith(admin, 'booking', type);
});
test.each([{ data: null, error: null }, { data: null, error: { message: 'failed' } }])('missing/invalid ownership or state cannot enqueue', async result => {
    query.maybeSingle.mockResolvedValue(result);
    await expect(dispatchCreatedGuestBookingNotification('booking', 'confirm', command)).rejects.toThrow('scope mismatch');
    expect(enqueueStoredBookingNotification).not.toHaveBeenCalled();
});
test('enqueue failure is observable rather than claiming delivery', async () => {
    jest.mocked(enqueueStoredBookingNotification).mockRejectedValue(new Error('NOTIFICATION_ENQUEUE_FAILED'));
    await expect(dispatchCreatedGuestBookingNotification('booking', 'confirm', command)).rejects.toThrow('NOTIFICATION_ENQUEUE_FAILED');
});

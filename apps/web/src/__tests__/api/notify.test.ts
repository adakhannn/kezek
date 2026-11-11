import { POST } from '@/app/api/notify/route';
import { createMockRequest, createMockSupabase, expectErrorResponse, expectSuccessResponse } from './testHelpers';
import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { BookingDataService } from '@/lib/notifications/BookingDataService';
import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { runNotifyBooking } from '@/lib/notifyBookingService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';

jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/authCheck', () => ({ checkBookingBelongsToBusiness: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseClients: jest.fn() }));
jest.mock('@/lib/requestAuthContext', () => ({ resolveRequestAuthContext: jest.fn() }));
jest.mock('@/lib/notifications/BookingDataService');
jest.mock('@/lib/rateLimit', () => ({ withRateLimit: jest.fn((_req, _config, handler) => handler()), RateLimitConfigs: { normal: {} } }));

const bookingId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const managerId = '33333333-3333-4333-8333-333333333333';
const supabase = createMockSupabase();
const admin = createMockSupabase();
const getBookingById = jest.fn();
const request = (body: unknown = { type: 'confirm', booking_id: bookingId }) => createMockRequest('http://localhost/api/notify', { method: 'POST', body });

beforeEach(() => {
    jest.clearAllMocks();
    getBookingById.mockReset();
    admin.rpc.mockReset();
    delete process.env.RESEND_API_KEY;
    jest.mocked(createSupabaseClients).mockResolvedValue({ supabase, admin } as never);
    jest.mocked(resolveRequestAuthContext).mockResolvedValue({ supabase, user: { id: clientId }, authSource: 'cookie' } as never);
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: clientId } }, error: null });
    jest.mocked(BookingDataService).mockImplementation(() => ({ getBookingById }) as never);
    getBookingById.mockResolvedValue({ id: bookingId, client_id: clientId, status: 'confirmed' });
    admin.rpc.mockResolvedValue({ data: 'durable-event', error: null });
    jest.mocked(getBizContextForManagers).mockResolvedValue({ userId: managerId, bizId: 'biz' } as never);
    jest.mocked(checkBookingBelongsToBusiness).mockResolvedValue({ belongs: true });
    global.fetch = jest.fn(async () => { throw new Error('No provider calls in unit tests'); });
});

test('validates the event type', async () => {
    await expectErrorResponse(await POST(request({ booking_id: bookingId })), 400, 'validation');
    expect(admin.rpc).not.toHaveBeenCalled();
});

test('rejects unauthenticated requests before queue access', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expectErrorResponse(await POST(request()), 401, 'auth');
    expect(admin.rpc).not.toHaveBeenCalled();
});

test('missing booking cannot create an event', async () => {
    getBookingById.mockResolvedValueOnce(null);
    await expectErrorResponse(await POST(request()), 404, 'not_found');
    expect(admin.rpc).not.toHaveBeenCalled();
});

test('authorized client queues without provider configuration or network calls', async () => {
    const result = await expectSuccessResponse(await POST(request()));
    expect(result.data).toEqual({ queued: true, event_id: 'durable-event' });
    expect(admin.rpc).toHaveBeenCalledWith('enqueue_booking_notification', { p_booking_id: bookingId, p_type: 'confirm' });
    expect(global.fetch).not.toHaveBeenCalled();
});

test('manager with the same verified identity can enqueue only their business booking', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: managerId } }, error: null });
    await expectSuccessResponse(await POST(request()));
    expect(checkBookingBelongsToBusiness).toHaveBeenCalledWith(bookingId, 'biz');
});

test.each(['other business', 'different cookie identity'])('rejects %s without enqueue', async reason => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: managerId } }, error: null });
    if (reason === 'other business') jest.mocked(checkBookingBelongsToBusiness).mockResolvedValueOnce({ belongs: false });
    else jest.mocked(getBizContextForManagers).mockResolvedValueOnce({ userId: 'another-manager', bizId: 'biz' } as never);
    await expectErrorResponse(await POST(request()), 403, 'forbidden');
    expect(admin.rpc).not.toHaveBeenCalled();
});

test.each([
    ['NOTIFICATION_STATE_MISMATCH', 409, 'notification_state_mismatch'],
    ['storage unavailable', 503, 'service_unavailable'],
])('queue error %s cannot claim success', async (message, status, code) => {
    admin.rpc.mockResolvedValueOnce({ data: null, error: { message } });
    await expectErrorResponse(await POST(request()), status as number, code as string);
});

test('internal dispatch preserves supplied bearer identity instead of using the cookie client', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const bearer = createMockSupabase();
    bearer.auth.getUser.mockResolvedValue({ data: { user: { id: clientId } }, error: null });
    expect(await runNotifyBooking({ type: 'confirm', booking_id: bookingId }, bearer as never)).toEqual({ ok: true, data: { queued: true, event_id: 'durable-event' } });
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
});

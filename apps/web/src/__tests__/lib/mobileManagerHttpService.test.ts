import { runConfirmBookingHttp, runListManagedBusinessesHttp, runListManagerBookingsHttp } from '@/lib/mobileManagerHttpService';
import { resolveMobileBookingAuth } from '@/lib/mobileBookingAuthService';
import { listManagedBusinesses, listManagerBookings } from '@/lib/mobileManagerService';
import { managerAccessToBusiness } from '@/lib/businessManagerAccess';
import { dispatchBookingNotification } from '@/lib/bookingNotificationDispatch';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/mobileBookingAuthService', () => ({ resolveMobileBookingAuth: jest.fn() }));
jest.mock('@/lib/mobileManagerService', () => ({
    ...jest.requireActual('@/lib/mobileManagerService'),
    listManagedBusinesses: jest.fn(),
    listManagerBookings: jest.fn(),
}));
jest.mock('@/lib/businessManagerAccess', () => ({ managerAccessToBusiness: jest.fn() }));
jest.mock('@/lib/bookingNotificationDispatch', () => ({ dispatchBookingNotification: jest.fn() }));
jest.mock('@/lib/routeParams', () => ({ getRouteParamUuid: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn(), createSupabaseAdminClient: jest.fn() }));

const BIZ = '00000000-0000-4000-8000-000000000001';
const rpc = jest.fn();
const userClient = { rpc };

function adminWithBooking(data: unknown, error: unknown = null) {
    const builder = { select: jest.fn(() => builder), eq: jest.fn(() => builder), maybeSingle: jest.fn().mockResolvedValue({ data, error }) };
    const admin = { from: jest.fn(() => builder) };
    jest.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    return admin;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(resolveMobileBookingAuth).mockResolvedValue({ ok: true, client: userClient as never, user: { id: 'user-1' } });
    jest.mocked(getRouteParamUuid).mockResolvedValue('booking-1');
    rpc.mockResolvedValue({ error: null });
});

const get = (path: string) => new Request(`http://localhost${path}`, { headers: { Authorization: 'Bearer app-token' } });
const post = () => new Request('http://localhost/api/bookings/booking-1/confirm', { method: 'POST', headers: { Authorization: 'Bearer app-token' } });

describe('GET /api/mobile/manager/businesses', () => {
    test('401 without a session; otherwise the caller\'s managed businesses', async () => {
        jest.mocked(resolveMobileBookingAuth).mockResolvedValueOnce({ ok: false, error: 'auth', message: 'Not signed in', status: 401 });
        expect((await runListManagedBusinessesHttp(get('/api/mobile/manager/businesses'))).status).toBe(401);
        expect(listManagedBusinesses).not.toHaveBeenCalled();

        adminWithBooking(null);
        jest.mocked(listManagedBusinesses).mockResolvedValue({ ok: true, data: [{ id: BIZ, name: 'B', slug: 'b', address: null, phones: null, tz: 'Asia/Bishkek', role: 'admin' }] });
        const response = await runListManagedBusinessesHttp(get('/api/mobile/manager/businesses'));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true, data: [expect.objectContaining({ id: BIZ, role: 'admin' })] });
        expect(listManagedBusinesses).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    });
});

describe('GET /api/mobile/manager/bookings', () => {
    test('an invalid query is 400 without reading', async () => {
        expect((await runListManagerBookingsHttp(get('/api/mobile/manager/bookings?scope=today'))).status).toBe(400);
        expect(listManagerBookings).not.toHaveBeenCalled();
    });

    test('passes the parsed query and returns the page and time zone', async () => {
        adminWithBooking(null);
        jest.mocked(listManagerBookings).mockResolvedValue({ ok: true, data: [], timezone: 'Asia/Bishkek', page: { offset: 0, limit: 30, has_more: false, next_offset: null } });
        const response = await runListManagerBookingsHttp(get(`/api/mobile/manager/bookings?bizId=${BIZ}&scope=upcoming`));
        expect(await response.json()).toEqual({ ok: true, data: [], timezone: 'Asia/Bishkek', page: { offset: 0, limit: 30, has_more: false, next_offset: null } });
        expect(listManagerBookings).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', query: { bizId: BIZ, scope: 'upcoming', limit: 30, offset: 0 } }));
    });

    test('a refusal of the service keeps its status', async () => {
        adminWithBooking(null);
        jest.mocked(listManagerBookings).mockResolvedValue({ ok: false, error: 'forbidden', status: 403, message: 'Нет доступа к этому бизнесу' });
        expect((await runListManagerBookingsHttp(get(`/api/mobile/manager/bookings?bizId=${BIZ}&scope=today`))).status).toBe(403);
    });
});

describe('POST /api/bookings/[id]/confirm', () => {
    test('a manager of the booking\'s business confirms a hold as themselves and the notification is queued', async () => {
        const admin = adminWithBooking({ id: 'booking-1', biz_id: BIZ, status: 'hold' });
        jest.mocked(managerAccessToBusiness).mockResolvedValue('manager');
        const response = await runConfirmBookingHttp(post(), {});
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true, data: { confirmed: true, alreadyConfirmed: false } });
        expect(managerAccessToBusiness).toHaveBeenCalledWith(admin, 'user-1', BIZ);
        expect(rpc).toHaveBeenCalledWith('confirm_booking', { p_booking_id: 'booking-1' });
        expect(dispatchBookingNotification).toHaveBeenCalledWith(userClient, 'booking-1', 'confirm');
    });

    test('the client of the booking, a master or anyone else who does not manage the business is refused', async () => {
        adminWithBooking({ id: 'booking-1', biz_id: BIZ, status: 'hold' });
        jest.mocked(managerAccessToBusiness).mockResolvedValue('none');
        expect((await runConfirmBookingHttp(post(), {})).status).toBe(403);
        expect(rpc).not.toHaveBeenCalled();
        expect(dispatchBookingNotification).not.toHaveBeenCalled();
    });

    test('already confirmed is success without a second command; paid or cancelled is 409', async () => {
        jest.mocked(managerAccessToBusiness).mockResolvedValue('manager');
        adminWithBooking({ id: 'booking-1', biz_id: BIZ, status: 'confirmed' });
        expect(await (await runConfirmBookingHttp(post(), {})).json()).toEqual({ ok: true, data: { confirmed: true, alreadyConfirmed: true } });
        adminWithBooking({ id: 'booking-1', biz_id: BIZ, status: 'cancelled' });
        expect((await runConfirmBookingHttp(post(), {})).status).toBe(409);
        expect(rpc).not.toHaveBeenCalled();
    });

    test('missing booking 404, unauthenticated 401, RPC refusals mapped', async () => {
        adminWithBooking(null);
        expect((await runConfirmBookingHttp(post(), {})).status).toBe(404);
        jest.mocked(resolveMobileBookingAuth).mockResolvedValueOnce({ ok: false, error: 'auth', message: 'Not signed in', status: 401 });
        expect((await runConfirmBookingHttp(post(), {})).status).toBe(401);

        jest.mocked(managerAccessToBusiness).mockResolvedValue('manager');
        adminWithBooking({ id: 'booking-1', biz_id: BIZ, status: 'hold' });
        rpc.mockResolvedValueOnce({ error: { message: 'Booking status cannot be changed to confirmed. Current status: paid' } });
        expect((await runConfirmBookingHttp(post(), {})).status).toBe(409);
        rpc.mockResolvedValueOnce({ error: { message: 'BOOKING_FORBIDDEN' } });
        expect((await runConfirmBookingHttp(post(), {})).status).toBe(403);
        rpc.mockResolvedValueOnce({ error: { message: 'BOOKING_CHANGED' } });
        expect((await runConfirmBookingHttp(post(), {})).status).toBe(409);
        expect(dispatchBookingNotification).not.toHaveBeenCalled();
    });
});

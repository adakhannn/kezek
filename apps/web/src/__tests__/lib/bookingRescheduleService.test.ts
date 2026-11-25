import { rescheduleBooking } from '@/lib/bookingRescheduleService';

const identity = { requestId: '55555555-5555-4555-8555-555555555555' };
const input = { bookingId: '11111111-1111-4111-8111-111111111111', startAt: '2040-01-01T12:00:00Z' };

function port(result: { data: unknown; error: { message: string; code?: string } | null } | Error) {
    const rpc = jest.fn(() => ({
        abortSignal: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)),
    }));
    return { rpc };
}

async function body(response: unknown) {
    const res = response as Response;
    return { status: res.status, json: await res.json() };
}

test('passes the verified actor and request identity to the service-only command', async () => {
    const supabase = port({ data: { booking_id: input.bookingId, rescheduled: true, start_at: input.startAt, end_at: '2040-01-01T12:30:00Z' }, error: null });
    await expect(rescheduleBooking(supabase, identity, input, 'verified-user')).resolves.toEqual({
        bookingId: input.bookingId, startAt: input.startAt, endAt: '2040-01-01T12:30:00Z',
    });
    expect(supabase.rpc).toHaveBeenCalledWith('reschedule_booking_request', {
        p_request_id: identity.requestId, p_booking_id: input.bookingId, p_new_start: input.startAt, p_actor_id: 'verified-user',
    });
});

test.each([
    [{ message: 'BOOKING_ALREADY_STARTED', code: 'P0001' }, 409, 'booking_already_started', 'Запись уже началась. Перенести её может только организация.'],
    [{ message: 'BOOKING_FORBIDDEN', code: '42501' }, 403, 'forbidden', 'Перенести запись может только её клиент'],
    [{ message: 'BOOKING_NOT_FOUND', code: 'P0002' }, 404, 'not_found', 'Бронирование не найдено'],
    [{ message: 'BOOKING_STATUS_NOT_RESCHEDULABLE', code: 'P0001' }, 409, 'not_reschedulable', 'Перенести можно только подтверждённую запись'],
    [{ message: 'BOOKING_FINANCIAL_REVERSAL_REQUIRED', code: 'P0001' }, 409, 'financial_reversal_required', expect.stringContaining('обратитесь в организацию')],
    [{ message: 'BOOKING_REQUEST_CONFLICT', code: 'P0001' }, 409, 'booking_request_conflict', expect.any(String)],
    [{ message: 'BOOKING_CHANGED', code: '40001' }, 409, 'booking_changed', expect.any(String)],
    [{ message: 'time slot is already booked', code: 'P0001' }, 409, 'booking_slot_unavailable', 'Это время уже занято. Выберите другое.'],
    [{ message: 'conflicting key value violates exclusion constraint', code: '23P01' }, 409, 'booking_slot_unavailable', expect.any(String)],
    [{ message: 'SCHEDULE_SLOT_TAKEN', code: 'P0001' }, 409, 'booking_slot_unavailable', expect.any(String)],
    [{ message: 'SCHEDULE_OUTSIDE_WORKING_HOURS', code: '22023' }, 400, 'validation', 'Это время недоступно для записи. Выберите другое.'],
    [{ message: 'SLOT_IN_PAST', code: '22023' }, 400, 'validation', expect.any(String)],
    [{ message: 'RESCHEDULE_SAME_TIME', code: '22023' }, 400, 'validation', 'Запись уже назначена на это время'],
    [{ message: 'BUSINESS_NOT_BOOKABLE', code: '22023' }, 403, 'business_not_bookable', expect.any(String)],
    [{ message: 'BOOKING_AUTH_REQUIRED', code: '42501' }, 401, 'auth', expect.any(String)],
    [{ message: 'canceling statement due to lock timeout', code: '55P03' }, 503, 'service_unavailable', expect.any(String)],
])('maps %o to a stable public answer', async (error, status, code, message) => {
    const result = await rescheduleBooking(port({ data: null, error }), identity, input, 'verified-user');
    await expect(body(result)).resolves.toEqual({ status, json: { ok: false, error: code, message } });
});

test('an unknown database error never reaches the client', async () => {
    const result = await body(await rescheduleBooking(port({ data: null, error: { message: 'secret detail', code: 'XX000' } }), identity, input, 'u'));
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.json)).not.toContain('secret detail');
});

test('a lost transport answer asks for a retry of the same request', async () => {
    const result = await body(await rescheduleBooking(port(new Error('fetch failed')), identity, input, 'u'));
    expect(result).toMatchObject({ status: 503, json: { error: 'service_unavailable' } });
});

test('an unexpected success shape is not reported as a move', async () => {
    const result = await body(await rescheduleBooking(port({ data: { booking_id: input.bookingId }, error: null }), identity, input, 'u'));
    expect(result.status).toBe(503);
});

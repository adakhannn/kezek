import { runMarkAttendance } from '@/lib/markAttendanceService';
jest.mock('@/lib/performanceServer', () => ({ measurePerformance: jest.fn((_operation, run) => run()) }));
const receipt = { ok: true, status: 'paid', promotion_applied: false, subscription_applied: true, promotion_info: { title: 'Package', discount_percent: 0, discount_amount: 0, final_amount: 500 } };
function setup(data: unknown = receipt, error: unknown = null) { const admin = { rpc: jest.fn().mockResolvedValue({ data, error }), from: jest.fn() }; return { admin, run: (actorId='actor') => runMarkAttendance({ admin, bookingId: 'booking', bizId: 'biz', actorId, attended: true }) }; }
test('sends the verified actor/business and returns authoritative persisted benefit fields', async () => {
    const { admin, run } = setup(); expect(await run()).toMatchObject({ ok: true, payload: { status: 'paid', subscription_applied: true, promotion_info: receipt.promotion_info } });
    expect(admin.rpc).toHaveBeenCalledWith('mark_booking_attendance_command', { p_booking_id: 'booking', p_biz_id: 'biz', p_actor_id: 'actor', p_attended: true }); expect(admin.from).not.toHaveBeenCalled();
});
test('missing actor is forbidden before any command', async () => { const { run, admin } = setup(); expect(await run('')).toMatchObject({ ok: false, statusCode: 403 }); expect(admin.rpc).not.toHaveBeenCalled(); });
test.each([['42501',403],['P0002',404],['22023',400],['40001',409],['P0001',500],['42883',500]])('SQL %s remains non-success%s with no direct-write fallback', async (code,statusCode) => {
    const { run, admin } = setup(null,{code,message:'function does not exist'}); expect(await run()).toMatchObject({ ok: false, statusCode }); expect(admin.from).not.toHaveBeenCalled(); expect(admin.rpc).toHaveBeenCalledTimes(1);
});
test.each([null, {}, { ...receipt, status: 'no_show' }, { ...receipt, ok: false }])('an incomplete or contradictory receipt is never accepted: %j', async data => { expect(await setup(data).run()).toMatchObject({ ok: false, statusCode: 500 }); });

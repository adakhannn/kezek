import { runDashboardStaffShiftOpen } from '@/lib/dashboardStaffShiftOpenService';
import { readFinanceCalendar } from '@/lib/finance/calendar';
jest.mock('@/lib/finance/calendar', () => ({ isFinanceDate: jest.requireActual('@/lib/finance/calendar').isFinanceDate, readFinanceCalendar: jest.fn() }));
jest.mock('@/lib/scheduling/config', () => ({ explicitSchedulingEnabled: () => false }));
const calendar = { date: '2026-11-09', todayDate: '2026-11-09', timezone: 'America/New_York' };
function setup(existing: unknown = null) {
    const admin: any = { from: jest.fn(() => admin), select: jest.fn(() => admin), eq: jest.fn(() => admin), maybeSingle: jest.fn().mockResolvedValue({ data: existing, error: null }), update: jest.fn(), insert: jest.fn() };
    const supabase: any = { rpc: jest.fn().mockResolvedValue({ data: { ok: true, shift: existing }, error: null }) };
    const run = (branch: string | null = 'branch') => runDashboardStaffShiftOpen({ req: new Request('http://localhost/api/dashboard/staff/id/shift/open?date=2026-11-09'), supabase, admin, bizId: 'biz', staffId: 'staff', staff: { branch_id: branch } });
    return { run, admin, supabase };
}
beforeEach(() => { jest.clearAllMocks(); jest.mocked(readFinanceCalendar).mockResolvedValue(calendar as any); });
test('new shift still requires a branch', async () => { const { run } = setup(); expect(await run(null)).toMatchObject({ ok: false, statusCode: 400, message: expect.stringContaining('филиал') }); });
test('historical date without an existing attendance record is explicit409, never invented now', async () => {
    jest.mocked(readFinanceCalendar).mockResolvedValue({ ...calendar, todayDate: '2026-11-10' } as any);
    const { run, supabase, admin } = setup(); expect(await run()).toMatchObject({ ok: false, statusCode: 409 }); expect(supabase.rpc).not.toHaveBeenCalled(); expect(admin.insert).not.toHaveBeenCalled();
});
test('manager historical reopen uses authenticated scoped RPC, preserving attendance in SQL', async () => {
    jest.mocked(readFinanceCalendar).mockResolvedValue({ ...calendar, todayDate: '2026-11-10' } as any);
    const { run, supabase, admin } = setup({ id: 'shift', status: 'closed' }); expect(await run()).toMatchObject({ ok: true });
    expect(supabase.rpc).toHaveBeenCalledWith('open_staff_shift_safe', expect.objectContaining({ p_shift_date: '2026-11-09', p_staff_id: 'staff', p_biz_id: 'biz' })); expect(admin.update).not.toHaveBeenCalled();
    expect(readFinanceCalendar).toHaveBeenCalledWith(supabase, 'biz', 'staff', '2026-11-09');
});
test('future existing shift cannot reopen', async () => { jest.mocked(readFinanceCalendar).mockResolvedValue({ ...calendar, todayDate: '2026-11-08' } as any); const { run, supabase } = setup({ id: 'shift' }); expect(await run()).toMatchObject({ ok: false, statusCode: 409 }); expect(supabase.rpc).not.toHaveBeenCalled(); });
test('database stale/calendar error is409', async () => { const { run, supabase } = setup({ id: 'shift', status: 'closed' }); supabase.rpc.mockResolvedValue({ data: null, error: { code: '40001' } }); expect(await run()).toMatchObject({ ok: false, statusCode: 409 }); });

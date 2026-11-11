import { runFinanceAllDashboard } from '@/lib/financeAllDashboardService';

const request = () => new Request('http://localhost/api/dashboard/finance/all?period=day&date=2026-11-01');
const empty = () => ({ branches: [], staff: [], shifts: [], closedStats: [] });
function setup(data: unknown = empty(), error: unknown = null) {
    if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).shifts)) {
        const report=data as {shifts: Record<string, unknown>[]};
        report.shifts=report.shifts.map(shift=>({ledger_revision:7,timezone:'UTC',day_start:'2026-11-01T00:00Z',day_end:'2026-11-02T00:00Z',day_hours:24,...shift}));
    }
    const admin = { from: jest.fn(() => { throw new Error('REST selection is capped at 2 rows'); }), rpc: jest.fn().mockResolvedValue({ data, error }) };
    return { admin, run: () => runFinanceAllDashboard({ req: request(), supabase: admin, admin, bizId: 'biz-a' }) };
}
test('dependency failure is non-success rather than fabricated empty totals', async () => {
    expect(await setup(null, { message: 'RPC error' }).run()).toMatchObject({ ok: false, statusCode: 500, errorType: 'internal', message: 'RPC error' });
});
test.each([null, {}, { ...empty(), shifts: [{}] }, { ...empty(), staff: null }])('rejects incomplete report %j', async data => {
    expect(await setup(data).run()).toMatchObject({ ok: false, statusCode: 500 });
});
test('one scoped scalar report retains >1000 staff and ledger entries with a REST max_rows of 2', async () => {
    const staff = Array.from({ length: 1205 }, (_, index) => ({ id: `staff-${index}`, full_name: `Staff ${index}`,
        is_active: true, branch_id: 'branch-a', hourly_rate: null, percent_master: 60, percent_salon: 40 }));
    const shifts = staff.map((entry, index) => ({ id: `shift-${index}`, staff_id: entry.id, status: 'open', opened_at: null,
        percent_master: 60, percent_salon: 40, items: [{ service_amount: index % 7 + 0.25, consumables_amount: 2.5 }] }));
    const { run, admin } = setup({ ...empty(), staff, shifts });
    const result = await run(); expect(result.ok).toBe(true); if (!result.ok) return;
    expect((result.data.staffStats as unknown[]).length).toBe(1205);
    let amount = 0, master = 0;
    for (let index = 0; index < 1205; index++) { amount += index % 7 + 0.25; master += Math.round((index % 7 + 0.25) * 0.6); }
    expect(result.data.totalStats).toMatchObject({ totalAmount: amount, totalMaster: master,
        totalSalon: amount - master + 1205 * 2.5, totalConsumables: 1205 * 2.5, totalOpenShifts: 1205 });
    expect(admin.rpc).toHaveBeenCalledTimes(1); expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith('read_finance_report_snapshot', {
        p_biz_id: 'biz-a', p_date_from: '2026-11-01', p_date_to: '2026-11-01', p_staff_id: null, p_branch_id: null,
    });
});
test('closed snapshots and open ledger are counted once, including consumables and guarantee top-up', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T10:00:00Z'));
    try {
        const { run } = setup({ branches: [], staff: [{ id: 'staff-a', is_active: true, hourly_rate: 200, percent_master: 60, percent_salon: 40 }],
            closedStats: [{ staff_id: 'staff-a', closed_shifts: 2, total_amount: 1000, total_master: 600, total_salon: 500, total_consumables: 100, total_late_minutes: 5 }],
            shifts: [{ id: 'open-a', staff_id: 'staff-a', status: 'open', opened_at: '2026-11-01T08:00:00Z',
                items: [{ service_amount: 500, consumables_amount: 70 }] }],
        });
        expect(await run()).toMatchObject({ ok: true, data: { totalStats: {
            totalAmount: 1500, totalMaster: 1000, totalSalon: 670, totalConsumables: 170,
            totalShifts: 3, totalOpenShifts: 1, totalClosedShifts: 2,
        } } });
    } finally { jest.useRealTimers(); }
});


test('default day is business calendar near UTC midnight; explicit label is unchanged', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-10T00:30Z'));
    try {
        const {admin}=setup();admin.rpc.mockResolvedValueOnce({data:{todayDate:'2026-11-09',timezone:'America/New_York'},error:null});
        const result=await runFinanceAllDashboard({req:new Request('http://localhost?period=day'),admin,supabase:admin,bizId:'biz-a'});
        expect(result).toMatchObject({ok:true,data:{dateFrom:'2026-11-09',dateTo:'2026-11-09'}});
        expect(admin.rpc).toHaveBeenNthCalledWith(1,'read_business_finance_calendar',{p_biz_id:'biz-a'});
        expect(admin.rpc.mock.calls[1][1]).toMatchObject({p_date_from:'2026-11-09',p_date_to:'2026-11-09'});
    } finally {jest.useRealTimers();}
});
test('calendar dependency failure does not substitute application today', async()=>{
    const {admin}=setup(null,{message:'calendar unavailable'});
    expect(await runFinanceAllDashboard({req:new Request('http://localhost'),admin,supabase:admin,bizId:'biz-a'})).toMatchObject({ok:false,statusCode:500});
    expect(admin.rpc).toHaveBeenCalledTimes(1);
});
test('old open shift cannot accumulate guarantee past its 25h local day', async()=>{
    jest.useFakeTimers().setSystemTime(new Date('2026-11-10T00:30Z'));
    try {
        const {run}=setup({...empty(),staff:[{id:'staff',is_active:true,hourly_rate:100}],shifts:[{id:'shift',staff_id:'staff',status:'open',opened_at:'2026-11-01T04:00Z',day_start:'2026-11-01T04:00Z',day_end:'2026-11-02T05:00Z',day_hours:25,timezone:'America/New_York',items:[]}]});
        expect(await run()).toMatchObject({ok:true,data:{totalStats:{totalMaster:2500,totalSalon:0}}});
    } finally {jest.useRealTimers();}
});

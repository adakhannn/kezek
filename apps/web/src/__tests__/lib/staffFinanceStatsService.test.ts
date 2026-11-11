import { runStaffFinanceStats } from '@/lib/staffFinanceStatsService';

describe('staffFinanceStatsService', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2024-01-15T10:00:00.000Z')); });
    afterEach(() => jest.useRealTimers());
    function setup(shifts: Record<string, unknown>[] = [], items: Record<string, unknown>[] = []) {
        const admin = { from: jest.fn(), rpc: jest.fn().mockResolvedValue({ data: {
            branches: [], staff: [], closedStats: [], shifts: shifts.map(shift => ({ ledger_revision: 7, timezone: 'UTC', day_start: '2024-01-15T00:00Z', day_end: '2024-01-16T00:00Z', day_hours: 24, ...shift, items: items.filter(item => item.shift_id === shift.id) })),
        }, error: null }) };
        const run = (query: string) => runStaffFinanceStats({ req: new Request(`http://localhost/api/stats?${query}`), admin,
            bizId: 'biz-id', staffId: 'staff-id', staff: { full_name: 'Test Staff' } });
        return { run, admin };
    }
    test('rejects impossible calendar dates before reading data', async () => {
        const { run, admin } = setup();
        expect(await run('period=day&date=2024-02-30')).toMatchObject({ ok: false, status: 400 });
        expect(admin.rpc).not.toHaveBeenCalled();
    });
    test.each([
        ['month', '2023-12', '2023-12-01', '2023-12-31'],
        ['year', '2023', '2023-01-01', '2023-12-31'],
        ['month', '2024-02', '2024-02-01', '2024-02-29'],
    ])('reads only the requested %s period %s', async (period, date, from, to) => {
        const { run, admin } = setup();
        expect(await run(`period=${period}&date=${date}`)).toMatchObject({ ok: true, stats: { shiftsCount: 0, openShiftsCount: 0, totalAmount: 0 } });
        expect(admin.rpc).toHaveBeenCalledWith('read_finance_report_snapshot', {
            p_biz_id: 'biz-id', p_staff_id: 'staff-id', p_date_from: from, p_date_to: to, p_branch_id: null,
        });
        expect(admin.from).not.toHaveBeenCalled();
    });
    test('includes an open shift selected by the period query exactly once', async () => {
        const { run } = setup([{ id: 'open-shift', shift_date: '2024-01-15', status: 'open',
            opened_at: '2024-01-15T09:00:00.000Z', closed_at: null, hourly_rate: 500 }]);
        expect(await run('period=month&date=2024-01')).toMatchObject({ ok: true, stats: { shiftsCount: 1, openShiftsCount: 1, totalMaster: 500 } });
    });
    test('normalizes percentages, rounds base shares, and retains the saved guarantee', async () => {
        const { run } = setup([{ id: 'closed-shift', shift_date: '2024-01-15', status: 'closed',
            percent_master: 30, percent_salon: 20, master_share: 700, salon_share: 400,
            late_minutes: 5, hourly_rate: 700, guaranteed_amount: 700, hours_worked: 1,
            opened_at: '2024-01-15T09:00:00.000Z', closed_at: '2024-01-15T10:00:00.000Z' }], [{
            id: 'item-1', shift_id: 'closed-shift', client_name: 'Client', service_name: 'Service',
            service_amount: 1001, consumables_amount: 99, note: null, booking_id: null, created_at: '2024-01-15T09:30:00.000Z',
        }]);
        expect(await run('period=day&date=2024-01-15')).toMatchObject({ ok: true, stats: {
            totalAmount: 1001, totalConsumables: 99, totalBaseMasterShare: 601, totalBaseSalonShare: 499,
            totalMaster: 700, totalSalon: 400, totalGuaranteedAmount: 700, totalTopupAmount: 99,
            hasGuaranteedPayment: true, totalLateMinutes: 5, totalClients: 1,
        } });
    });
    test('does not truncate a 1501-client shift or depend on a second REST selection', async () => {
        const items = Array.from({ length: 1501 }, (_, index) => ({ id: `item-${index}`, shift_id: 'shift',
            service_amount: index % 17 + 0.25, consumables_amount: 0.5 }));
        const { run, admin } = setup([{ id: 'shift', status: 'open', percent_master: 60, percent_salon: 40 }], items);
        const expected = items.reduce((sum, item) => sum + item.service_amount, 0);
        const result = await run('period=day&date=2024-01-15');
        expect(result).toMatchObject({ ok: true, stats: { totalAmount: expected, totalConsumables: 750.5, totalClients: 1501 } });
        expect(admin.rpc).toHaveBeenCalledTimes(1); expect(admin.from).not.toHaveBeenCalled();
    });
    test('historical open preview stops at the business day boundary, including 25h DST', async () => {
        jest.setSystemTime(new Date('2026-11-10T00:00Z'));
        const { run } = setup([{ id:'dst', status:'open', shift_date:'2026-11-01', opened_at:'2026-11-01T04:00Z',
            timezone:'America/New_York', day_start:'2026-11-01T04:00Z', day_end:'2026-11-02T05:00Z', day_hours:25, hourly_rate:100 }]);
        expect(await run('period=day&date=2026-11-01')).toMatchObject({ok:true,stats:{shifts:[expect.objectContaining({hours_worked:25,guaranteed_amount:2500,day_hours:25,ledger_revision:7})]}});
    });
    test('missing original revision is not an editable success', async () => {
        const { run } = setup([{id:'shift',status:'closed',ledger_revision:undefined}]);
        expect(await run('period=day&date=2024-01-15')).toMatchObject({ok:false,status:500});
    });
    test.each([['day','2026-11-09','2026-11-09'],['month','2026-11-01','2026-11-30'],['year','2026-01-01','2026-12-31']])('default %s derives from business day near UTC midnight',async(period,from,to)=>{
        jest.setSystemTime(new Date('2026-11-10T00:30Z'));
        const {run,admin}=setup();admin.rpc.mockResolvedValueOnce({data:{todayDate:'2026-11-09',timezone:'America/New_York'},error:null});
        expect(await run('period='+period)).toMatchObject({ok:true,stats:{dateFrom:from,dateTo:to}});
        expect(admin.rpc).toHaveBeenNthCalledWith(1,'read_business_finance_calendar',{p_biz_id:'biz-id'});
        expect(admin.rpc.mock.calls[1][1]).toMatchObject({p_date_from:from,p_date_to:to});
    });
    test('calendar dependency failure cannot become an empty report for application today',async()=>{
        const {run,admin}=setup();admin.rpc.mockResolvedValueOnce({data:null,error:{message:'bad calendar'}});
        expect(await run('')).toMatchObject({ok:false,status:500});expect(admin.rpc).toHaveBeenCalledTimes(1);
    });
    test('source failure is non-success, not a zero ledger', async () => {
        const { run, admin } = setup(); admin.rpc.mockResolvedValue({ data: null, error: { message: 'items unavailable' } });
        expect(await run('period=day&date=2024-01-15')).toMatchObject({ ok: false, status: 500, message: 'items unavailable' });
    });
    test('closed financial results are authoritative even if old item details differ', async () => {
        const { run } = setup([{ id: 'shift', status: 'closed', total_amount: 1000, consumables_amount: 100,
            master_share: 700, salon_share: 400, guaranteed_amount: 700, topup_amount: 100, hours_worked: null,
            percent_master: 60, percent_salon: 40 }], [{ id: 'item', shift_id: 'shift', service_amount: 900, consumables_amount: 50 }]);
        expect(await run('period=day&date=2024-01-15')).toMatchObject({ ok: true, stats: {
            totalAmount: 1000, totalConsumables: 100, totalMaster: 700, totalSalon: 400, totalTopupAmount: 100,
            shifts: [expect.objectContaining({ hours_worked: null })],
        } });
    });
});

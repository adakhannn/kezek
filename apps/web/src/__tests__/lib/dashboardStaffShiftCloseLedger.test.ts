jest.mock('@/lib/staffShift/closeSnapshot', () => ({ ...jest.requireActual('@/lib/staffShift/closeSnapshot'), readShiftCloseSnapshot: jest.fn() }));
const { readShiftCloseSnapshot } = jest.requireMock('@/lib/staffShift/closeSnapshot');
import { runDashboardStaffShiftClose } from '@/lib/dashboardStaffShiftCloseService';

jest.mock('@/lib/performanceServer', () => ({ measurePerformance: (_name: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/lib/notifications/shiftNotifications', () => ({ sendShiftCloseNotification: jest.fn() }));

const itemId = '9c8a0a7f-6fab-4708-b204-0fb9fbdeb25d';
const row = {id:itemId,service_amount:301,consumables_amount:49,booking_id:null};
const submitted = {id:itemId,serviceAmount:301,consumablesAmount:49,bookingId:null};
const shift = {id:'11111111-1111-4111-8111-111111111111',staff_id:'staff-test',biz_id:'biz-test',shift_date:'2026-10-09',status:'open',ledger_revision:7,opened_at:'2026-10-09T00:14:00Z'};

function query(result: unknown) {
    const builder = {
        select:jest.fn(),eq:jest.fn(),gte:jest.fn(),lte:jest.fn(),neq:jest.fn(),maybeSingle:jest.fn(),
        then:jest.fn(),delete:jest.fn(),insert:jest.fn(),
    };
    for (const name of ['select','eq','gte','lte'] as const) builder[name].mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue(result);
    builder.neq.mockResolvedValue(result);
    builder.then.mockImplementation((resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve));
    return builder;
}

function setup(itemsError: unknown = null) {
    const itemQuery = query({data:[row],error:itemsError});
    if (itemsError) readShiftCloseSnapshot.mockRejectedValue(new Error('ledger unavailable'));
    else readShiftCloseSnapshot.mockResolvedValue({ shift, staff: { percent_master: 60, percent_salon: 40, hourly_rate: null }, items: [row],
        timezone: 'Asia/Bishkek', dayStart: '2026-10-08T18:00Z', closeBoundary: '2026-10-09T18:00Z', dayHours: 24 });
    const admin = {
        from:jest.fn((table: string) => table==='staff' ? query({data:{id:'staff-test',biz_id:'biz-test',percent_master:60,percent_salon:40,user_id:null}})
            : table==='staff_shifts' ? query({data:shift}) : table==='staff_shift_items' ? itemQuery : query({data:[],error:null})),
        rpc:jest.fn().mockResolvedValue({data:{ok:true,shift:{...shift,status:'closed'}},error:null}),
        auth:{admin:{getUserById:jest.fn()}},
    };
    return {admin,itemQuery};
}

function close(admin: ReturnType<typeof setup>['admin'], items: Record<string,unknown>[]) {
    return runDashboardStaffShiftClose({actorId:'actor-1',admin,bizId:'biz-test',staffId:'staff-test',
        req:new Request('http://localhost/api/dashboard/staff/staff-test/shift/close?date=2026-10-09',{
            method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({expectedShiftId:shift.id,expectedRevision:shift.ledger_revision,items,totalAmount:9999,consumablesAmount:9999}),
        }),
    });
}

test.each(['2026-10-09T01:40:00.000Z','2026-10-09T17:55:00.000Z','2026-10-09T18:05:00.000Z'])(
    'manual owner closure is bounded by the financial day %s', async instant => {
        jest.useFakeTimers().setSystemTime(new Date(instant));
        try {
            const {admin} = setup();
            expect(await close(admin,[submitted])).toMatchObject({ok:true});
            expect(admin.rpc).toHaveBeenCalledWith('close_staff_shift_command',expect.objectContaining({p_actor_id:'actor-1',p_expected_revision:7,p_calculation:expect.objectContaining({closedAt:new Date(Math.min(Date.parse(instant),Date.parse('2026-10-09T18:00Z'))).toISOString()})}));
        } finally { jest.useRealTimers(); }
    },
);

test('owner closes the saved ledger without replacing identities or trusting submitted totals',async () => {
    const {admin,itemQuery} = setup();
    expect(await close(admin,[submitted])).toMatchObject({ok:true});
    expect(readShiftCloseSnapshot).toHaveBeenCalledWith(admin,'biz-test','staff-test',shift.id);
    expect(itemQuery.delete).not.toHaveBeenCalled();
    expect(itemQuery.insert).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith('close_staff_shift_command',expect.objectContaining({
        p_expected_revision:7,p_calculation:expect.objectContaining({totalAmount:301,totalConsumables:49,finalMasterShare:181,finalSalonShare:169}),
    }));
});

test.each([
    [{...submitted,serviceAmount:999}],
    [{...submitted,id:'11111111-1111-4111-8111-111111111111'}],
    [{...submitted,bookingId:'11111111-1111-4111-8111-111111111111'}],
    [],
    [submitted,submitted],
])('rejects stale or unsaved owner snapshot before any closure: %j',async (...items) => {
    const {admin,itemQuery} = setup();
    expect(await close(admin,items)).toMatchObject({ok:false,statusCode:409});
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(itemQuery.delete).not.toHaveBeenCalled();
    expect(itemQuery.insert).not.toHaveBeenCalled();
});

test('cannot finalize with a failed ledger read',async () => {
    const {admin} = setup({message:'offline'});
    expect(await close(admin,[submitted])).toMatchObject({ok:false,statusCode:500});
    expect(admin.rpc).not.toHaveBeenCalled();
});

test('allows the matching legacy snapshot without IDs but still never rewrites rows',async () => {
    const {admin,itemQuery} = setup();
    expect(await close(admin,[{...submitted,id:undefined}])).toMatchObject({ok:true});
    expect(itemQuery.delete).not.toHaveBeenCalled();
    expect(itemQuery.insert).not.toHaveBeenCalled();
});

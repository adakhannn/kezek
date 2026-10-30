import { runDashboardStaffShiftClose } from '@/lib/dashboardStaffShiftCloseService';

jest.mock('@/lib/performance', () => ({ measurePerformance: (_name: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/lib/notifications/shiftNotifications', () => ({ sendShiftCloseNotification: jest.fn() }));

const itemId = '9c8a0a7f-6fab-4708-b204-0fb9fbdeb25d';
const row = {id:itemId,service_amount:301,consumables_amount:49,booking_id:null};
const submitted = {id:itemId,serviceAmount:301,consumablesAmount:49,bookingId:null};
const shift = {id:'shift-test',staff_id:'staff-test',biz_id:'biz-test',shift_date:'2026-10-09',status:'open',opened_at:'2026-10-09T00:14:00Z'};

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
    const admin = {
        from:jest.fn((table: string) => table==='staff' ? query({data:{id:'staff-test',biz_id:'biz-test',percent_master:60,percent_salon:40,user_id:null}})
            : table==='staff_shifts' ? query({data:shift}) : table==='staff_shift_items' ? itemQuery : query({data:[],error:null})),
        rpc:jest.fn().mockResolvedValue({data:{ok:true,shift:{...shift,status:'closed'}},error:null}),
        auth:{admin:{getUserById:jest.fn()}},
    };
    return {admin,itemQuery};
}

function close(admin: ReturnType<typeof setup>['admin'], items: Record<string,unknown>[]) {
    return runDashboardStaffShiftClose({admin,bizId:'biz-test',staffId:'staff-test',
        req:new Request('http://localhost/api/dashboard/staff/staff-test/shift/close?date=2026-10-09',{
            method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({items,totalAmount:9999,consumablesAmount:9999}),
        }),
    });
}

test.each(['2026-10-08T23:40:00.000Z','2026-10-09T17:55:00.000Z','2026-10-09T18:05:00.000Z'])(
    'manual owner closure records the actual action instant %s, not the day boundary', async instant => {
        jest.useFakeTimers().setSystemTime(new Date(instant));
        try {
            const {admin} = setup();
            expect(await close(admin,[submitted])).toMatchObject({ok:true});
            expect(admin.rpc).toHaveBeenCalledWith('close_staff_shift_safe',expect.objectContaining({p_closed_at:instant}));
        } finally { jest.useRealTimers(); }
    },
);

test('owner closes the saved ledger without replacing identities or trusting submitted totals',async () => {
    const {admin,itemQuery} = setup();
    expect(await close(admin,[submitted])).toMatchObject({ok:true});
    expect(itemQuery.eq).toHaveBeenCalledWith('shift_id','shift-test');
    expect(itemQuery.delete).not.toHaveBeenCalled();
    expect(itemQuery.insert).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith('close_staff_shift_safe',expect.objectContaining({
        p_total_amount:301,p_consumables_amount:49,p_master_share:181,p_salon_share:169,
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

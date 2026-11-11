import { POST } from '@/app/api/dashboard/staff-shifts/[id]/update-hours/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';
import { getBizContextForManagers } from '@/lib/authBiz';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
setupApiTestMocks();
jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
const shiftId='f0000000-0000-4000-8000-000000000001';
const shift={id:shiftId,biz_id:'biz',status:'closed',ledger_revision:7,total_amount:10000,consumables_amount:1000,percent_master:60,percent_salon:40,hourly_rate:500};
describe('POST update-hours version protocol', () => {
    const admin=createMockSupabase();
    const request=(body:unknown) => POST(createMockRequest('http://localhost/api/dashboard/staff-shifts/'+shiftId+'/update-hours',{method:'POST',body}),{params:{id:shiftId}});
    beforeEach(()=>{
        jest.clearAllMocks();admin.rpc.mockReset();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({supabase:admin,userId:'actor',bizId:'biz'});
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(admin);
        admin.rpc.mockResolvedValueOnce({data:{shift,dayHours:24},error:null}).mockResolvedValue({data:{ok:true,shift:{...shift,ledger_revision:8,hours_worked:8}},error:null});
    });
    test.each(['invalid-json',{}, {hours_worked:-1,expectedRevision:7},{hours_worked:26,expectedRevision:7},{hours_worked:8},{hours_worked:'8',expectedRevision:7}])('rejects invalid input %j without RPC',async body=>{
        await expectErrorResponse(await request(body),400,'validation');expect(admin.rpc).not.toHaveBeenCalled();
    });
    test('rejects a malformed shift UUID',async()=>{
        const res=await POST(createMockRequest('http://localhost',{method:'POST',body:{hours_worked:8,expectedRevision:7}}),{params:{id:'bad'}});
        expect(res.status).toBe(400);expect(admin.rpc).not.toHaveBeenCalled();
    });
    test.each([['P0002',404,'not_found'],['42501',403,'forbidden']])('scoped read failure %s',async(code,status,error)=>{
        admin.rpc.mockReset().mockResolvedValue({data:null,error:{code}});
        await expectErrorResponse(await request({hours_worked:8,expectedRevision:7}),status as number,error as string);expect(admin.from).not.toHaveBeenCalled();
    });
    test('reopened shift returns conflict without write',async()=>{
        admin.rpc.mockReset().mockResolvedValue({data:{shift:{...shift,status:'open'},dayHours:24},error:null});
        await expectErrorResponse(await request({hours_worked:8,expectedRevision:7}),409,'validation');expect(admin.rpc).toHaveBeenCalledTimes(1);
    });
    test('closed shift uses canonical guarantee and returns new revision',async()=>{
        const data=await expectSuccessResponse(await request({hours_worked:8,expectedRevision:7}),200);
        expect(data.data.shift.ledger_revision).toBe(8);
        expect(admin.rpc).toHaveBeenNthCalledWith(2,'adjust_closed_shift_hours_command',expect.objectContaining({p_actor_id:'actor',p_expected_revision:7,p_hours_worked:8,p_calculation:expect.objectContaining({guaranteedAmount:4000,finalMasterShare:6000,finalSalonShare:5000})}));
        expect(admin.from).not.toHaveBeenCalled();
    });
    test('rounds to two decimals before canonical calculation',async()=>{
        await expectSuccessResponse(await request({hours_worked:8.333333,expectedRevision:7}),200);
        expect(admin.rpc.mock.calls[1][1]).toMatchObject({p_hours_worked:8.33,p_calculation:{guaranteedAmount:4165}});
    });
    test('commit conflict does not retry or fall back to direct UPDATE',async()=>{
        admin.rpc.mockResolvedValue({data:null,error:{code:'40001'}});
        await expectErrorResponse(await request({hours_worked:8,expectedRevision:7}),409,'validation');expect(admin.rpc).toHaveBeenCalledTimes(2);expect(admin.from).not.toHaveBeenCalled();
    });
});

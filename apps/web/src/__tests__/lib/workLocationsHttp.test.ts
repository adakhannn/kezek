jest.mock('@/lib/authBiz', () => ({getBizContextForManagers:jest.fn()}));
jest.mock('@/lib/supabaseService', () => ({getServiceClient:jest.fn()}));
import { workLocationsHttp } from '@/lib/scheduling/locations';
import { getServiceClient } from '@/lib/supabaseService';
import { getBizContextForManagers } from '@/lib/authBiz';
const biz='c28c8109-bedc-4f9e-bbc2-30f4b549131e';
const url=`http://localhost/api/public/work-locations?bizId=${biz}&from=2099-01-01&to=2099-01-01`;
const service=jest.mocked(getServiceClient);
const originalFlag=process.env.SCHEDULE_V2_ENABLED;
beforeEach(() => {jest.clearAllMocks();process.env.SCHEDULE_V2_ENABLED='true';});
afterAll(() => {if(originalFlag===undefined) delete process.env.SCHEDULE_V2_ENABLED; else process.env.SCHEDULE_V2_ENABLED=originalFlag;});
function client(approved:boolean) {
    const query={select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),
        maybeSingle:jest.fn().mockResolvedValue({data:approved?{id:biz,tz:'Asia/Bishkek'}:null,error:null})};
    const admin={from:jest.fn().mockReturnValue(query),rpc:jest.fn().mockResolvedValue({data:[],error:null})};
    service.mockReturnValue(admin as unknown as ReturnType<typeof getServiceClient>);
    return {admin,query};
}
test('unapproved business is denied before the existing projection RPC', async () => {
    const {admin,query}=client(false);
    expect((await workLocationsHttp(new Request(url),false)).status).toBe(404);
    expect(query.eq).toHaveBeenCalledWith('is_approved',true);
    expect(admin.rpc).not.toHaveBeenCalled();
});
test.each(['from=2099-01-01&to=2099-04-01','from=2099-02-30&to=2099-03-01','from=2099-01-02&to=2099-01-01'])('rejects invalid or overbroad range %s before service access', async query => {
    expect((await workLocationsHttp(new Request(`http://localhost/api/public/work-locations?bizId=${biz}&${query}`),false)).status).toBe(400);
    expect(service).not.toHaveBeenCalled();
});
test('declares complete effective-day data using the existing minimal RPC only', async () => {
    const {admin}=client(true);
    const response=await workLocationsHttp(new Request(url),false);
    expect(await response.json()).toEqual({ok:true,data:[],availabilityComplete:true});
    expect(admin.rpc).toHaveBeenCalledWith('read_staff_work_locations',{p_biz:biz,p_from:'2099-01-01',p_to:'2099-01-01'});
    expect(admin.from).toHaveBeenCalledTimes(1);
    expect(getBizContextForManagers).not.toHaveBeenCalled();
});
test('legacy date rules remain explicitly transfer-only', async () => {
    process.env.SCHEDULE_V2_ENABLED='false';
    const {admin,query}=client(true);
    Object.assign(query,{gte:jest.fn().mockReturnThis(),lte:jest.fn().mockResolvedValue({data:[],error:null})});
    const response=await workLocationsHttp(new Request(url),false);
    expect(await response.json()).toEqual({ok:true,data:[],availabilityComplete:false});
    expect(admin.rpc).not.toHaveBeenCalled();
});
test('a past public period is rejected before schedule access', async () => {
    const {admin}=client(true);
    const response=await workLocationsHttp(new Request(url.replaceAll('2099-01-01','2000-01-01')),false);
    expect(response.status).toBe(400);
    expect(admin.rpc).not.toHaveBeenCalled();
});
test('manager authorization failure cannot reach a service client', async () => {
    jest.mocked(getBizContextForManagers).mockRejectedValue(new Error('forbidden'));
    expect((await workLocationsHttp(new Request(url),true)).status).toBe(403);
    expect(service).not.toHaveBeenCalled();
});
test('schedule lookup failure is an error, not successful empty availability', async () => {
    const {admin}=client(true);
    admin.rpc.mockResolvedValue({data:null,error:{message:'Unavailable'}});
    expect((await workLocationsHttp(new Request(url),false)).status).toBe(500);
});

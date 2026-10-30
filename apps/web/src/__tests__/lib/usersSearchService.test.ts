jest.mock('@/lib/supabaseService', () => ({getServiceClient:jest.fn()}));
import { getServiceClient } from '@/lib/supabaseService';
import { runUsersSearch } from '@/lib/usersSearchService';

const account = {id:'client-1',email:'known@example.test',phone:null,user_metadata:{full_name:'Provider Name'}};
function setup(users = [account], profiles: {id:string;full_name:string|null}[] = [{id:'client-1',full_name:' Edited Profile Name '}], staff: {user_id:unknown}[] = [], profileError: object|null = null) {
    const profileQuery = {select:jest.fn().mockReturnThis(),in:jest.fn().mockResolvedValue({data:profiles,error:profileError})};
    const admin = {auth:{admin:{listUsers:jest.fn().mockResolvedValue({data:{users},error:null})}},from:jest.fn(() => profileQuery)};
    const staffQuery = {select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),not:jest.fn().mockResolvedValue({data:staff,error:null})};
    const supabase = {from:jest.fn(() => staffQuery)};
    jest.mocked(getServiceClient).mockReturnValue(admin as never);
    return {admin,supabase,profileQuery,staffQuery};
}
const input = (q:string) => ({q,page:1,perPage:50});

test.each([undefined, '', '   ', '\t\n'])('blank query %j never loads the platform Auth directory', async (q) => {
    const c = setup();
    const result = await runUsersSearch({supabase:c.supabase,bizId:'biz-1',input:{q,page:1,perPage:50}});
    expect(result.items).toEqual([]);
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(c.admin.auth.admin.listUsers).not.toHaveBeenCalled();
    expect(c.supabase.from).not.toHaveBeenCalled();
});

beforeEach(() => jest.clearAllMocks());

test('searches and returns the edited canonical profile name rather than the provider name', async () => {
    const c = setup();
    const result = await runUsersSearch({supabase:c.supabase,bizId:'biz-1',input:input('edited profile')});
    expect(result.items).toEqual([{id:account.id,email:account.email,phone:null,full_name:'Edited Profile Name'}]);
    expect(c.profileQuery.select).toHaveBeenCalledWith('id,full_name');
    expect(c.profileQuery.in).toHaveBeenCalledWith('id',['client-1']);
});

test('email search returns the same canonical identity without widening contact fields', async () => {
    const c = setup();
    expect((await runUsersSearch({supabase:c.supabase,bizId:'biz-1',input:input('KNOWN@EXAMPLE.TEST')})).items).toEqual([{id:'client-1',email:account.email,phone:null,full_name:'Edited Profile Name'}]);
});

test.each([{profiles:[]},{profiles:[{id:'client-1',full_name:null}]},{profiles:[{id:'client-1',full_name:' '}]}])('falls back to provider name with missing/blank profile %j', async ({profiles}) => {
    const c = setup([account], profiles);
    expect((await runUsersSearch({supabase:c.supabase,bizId:'biz-1',input:input('provider')})).items[0]?.full_name).toBe('Provider Name');
});

test('continues excluding current business staff after resolving names', async () => {
    const c = setup([account], undefined, [{user_id:'client-1'},{user_id:null}]);
    expect((await runUsersSearch({supabase:c.supabase,bizId:'biz-1',input:input('edited')})).items).toEqual([]);
    expect(c.staffQuery.eq).toHaveBeenCalledWith('biz_id','biz-1');
});

test('empty auth page skips profile lookup', async () => {
    const c = setup([]);
    expect((await runUsersSearch({supabase:c.supabase,bizId:'biz-1',input:input('edited')})).items).toEqual([]);
    expect(c.admin.from).not.toHaveBeenCalled();
});

test('profile lookup failure is explicit instead of presenting a false no-match', async () => {
    const c = setup([account],[],[],{message:'offline'});
    await expect(runUsersSearch({supabase:c.supabase,bizId:'biz-1',input:input('edited')})).rejects.toThrow('Client profile names unavailable');
});

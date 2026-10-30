import { readRatingsStatusForCaller, readRatingsJobsForCaller } from '@/lib/ratingsAdminReadService';
import { runRatingsStatusHttp, runRatingsJobsHttp } from '@/lib/ratingsAdminHttpService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { getRatingsStatus } from '@/lib/ratingsStatusService';
import { getRatingsJobs } from '@/lib/ratingsJobsService';
jest.mock('@/lib/supabaseHelpers',()=>({createSupabaseServerClient:jest.fn()}));
jest.mock('@/lib/supabaseService',()=>({getServiceClient:jest.fn()}));
jest.mock('@/lib/ratingsStatusService',()=>({getRatingsStatus:jest.fn()}));
jest.mock('@/lib/ratingsJobsService',()=>({getRatingsJobs:jest.fn()}));
describe('Ratings authorized read shared by SSR and HTTP',()=>{
  const admin={from:jest.fn()};
  function setup(user:string|null='current',rowUser='current',scope:string|null=null,error:unknown=null){
    const filters:Record<string,unknown>={};
    const query={select:jest.fn().mockReturnThis(),eq:jest.fn((k:string,v:string)=>{filters[k]=v;return query;}),is:jest.fn((k:string,v:null)=>{filters[k]=v;return query;}),limit:jest.fn().mockReturnThis(),maybeSingle:jest.fn(async()=>({data:filters.user_id===rowUser&&filters.role_key==='super_admin'&&filters.biz_id===scope?{role_key:'super_admin',biz_id:scope}:null,error}))};
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({auth:{getUser:async()=>({data:{user:user?{id:user}:null}})},from:()=>query});
    return filters;
  }
  beforeEach(()=>{jest.resetAllMocks();(getServiceClient as jest.Mock).mockReturnValue(admin);(getRatingsStatus as jest.Mock).mockResolvedValue({staff_without_rating:1});(getRatingsJobs as jest.Mock).mockResolvedValue({ok:true,data:{jobs:[]}});});
  test('passes current globalcaller and status window to unchanged status reader',async()=>{
    const filters=setup();expect(await readRatingsStatusForCaller('3')).toEqual({ok:true,data:{staff_without_rating:1}});
    expect(filters).toEqual({user_id:'current',role_key:'super_admin',biz_id:null});expect(getRatingsStatus).toHaveBeenCalledWith(admin,{errorsWindowDaysParam:'3'});
  });
  test('reads jobs without creating or starting them',async()=>{setup();expect(await readRatingsJobsForCaller()).toEqual({ok:true,data:{jobs:[]}});expect(getRatingsJobs).toHaveBeenCalledWith({admin});});
  test.each([
    ['status guest','status',null,'current',null,null,401],['jobs guest','jobs',null,'current',null,null,401],
    ['status foreign','status','current','other',null,null,403],['jobs foreign','jobs','current','other',null,null,403],
    ['status businessscope','status','current','current','biz',null,403],['jobs businessscope','jobs','current','current','biz',null,403],
    ['status roleerror','status','current','current',null,new Error('read failed'),400],['jobs roleerror','jobs','current','current',null,new Error('read failed'),400],
  ])('denies %s before privileged reads',async(_label,kind,user,rowUser,scope,error,status)=>{
    setup(user as string|null,rowUser as string,scope as string|null,error);
    const result=await(kind==='status'?readRatingsStatusForCaller():readRatingsJobsForCaller());
    expect(result).toMatchObject({ok:false,status});expect(getServiceClient).not.toHaveBeenCalled();expect(getRatingsStatus).not.toHaveBeenCalled();expect(getRatingsJobs).not.toHaveBeenCalled();
  });
  test.each(['status','jobs'])('HTTP %s preserves denied status in standard envelope',async kind=>{
    setup(null);const response=await(kind==='status'?runRatingsStatusHttp(new Request('http://localhost/api/admin/ratings/status')):runRatingsJobsHttp());
    expect(response.status).toBe(401);expect((await response.json()).error).toBe('auth');expect(getServiceClient).not.toHaveBeenCalled();
  });
  test('preserves a jobs read failure instead of empty success',async()=>{setup();(getRatingsJobs as jest.Mock).mockResolvedValue({ok:false,error:'internal',message:'unavailable',status:500});expect(await readRatingsJobsForCaller()).toMatchObject({ok:false,status:500});});
  test('does not swallow a status reader exception as healthy empty data',async()=>{setup();(getRatingsStatus as jest.Mock).mockRejectedValue(new Error('unavailable'));await expect(readRatingsStatusForCaller()).rejects.toThrow('unavailable');});
});

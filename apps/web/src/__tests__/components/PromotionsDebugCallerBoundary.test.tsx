import PromotionsDebugPage from '@/app/admin/promotions-debug/page';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn((url: string) => { throw new Error('redirect:' + url); }) }));
jest.mock('@/app/admin/promotions-debug/PromotionsDebugClient', () => ({ PromotionsDebugClient: () => null }));

describe('Promotions debug uses the shared current global superadmin boundary', () => {
  function setup(user: string | null, rowUser='current-user', scope: string | null=null, readError: unknown=null) {
    const filters: Record<string, unknown> = {};
    let selectedTable='';
    const result = () => ({ data: selectedTable==='user_roles_with_user' && filters.user_id===rowUser && filters.role_key==='super_admin' && filters.biz_id===scope ? { role_key:'super_admin',biz_id:scope } : null,error:readError });
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn((key: string,value: string) => { filters[key]=value;return query; }),
      is: jest.fn((key: string,value: null) => { filters[key]=value;return query; }),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(async()=>result()), maybeSingle: jest.fn(async()=>result()),
    };
    const client={ auth:{getUser:jest.fn(async()=>({data:{user:user?{id:user}:null}}))},from:jest.fn((table:string)=>{selectedTable=table;return query;}) };
    (cookies as jest.Mock).mockResolvedValue({get:jest.fn()});
    (createServerClient as jest.Mock).mockReturnValue(client);
    return {client,filters};
  }
  beforeEach(()=>jest.clearAllMocks());
  test('admits the same current global role as the admin layout', async()=>{
    const {client,filters}=setup('current-user');
    expect(await PromotionsDebugPage()).toBeTruthy();
    expect(client.from).toHaveBeenCalledWith('user_roles_with_user');
    expect(filters).toEqual({user_id:'current-user',role_key:'super_admin',biz_id:null});
    expect(redirect).not.toHaveBeenCalled();
  });
  test('guest stops before any role query', async()=>{
    const {client}=setup(null);
    await expect(PromotionsDebugPage()).rejects.toThrow('redirect:/auth/sign-in');
    expect(client.from).not.toHaveBeenCalled();
  });
  test('uses only the request cookie reader and leaves cookie writes disabled', async()=>{
    setup('current-user');
    const get=jest.fn().mockReturnValue({value:'test-cookie-value'});
    (cookies as jest.Mock).mockResolvedValue({get});
    await PromotionsDebugPage();
    const adapter=(createServerClient as jest.Mock).mock.calls[0][2].cookies;
    expect(adapter.get('test-cookie-name')).toBe('test-cookie-value');
    expect(get).toHaveBeenCalledWith('test-cookie-name');
    expect(adapter.set('test-cookie-name','ignored')).toBeUndefined();
    expect(adapter.remove('test-cookie-name')).toBeUndefined();
    expect(get).toHaveBeenCalledTimes(1);
  });
  test.each([
    ['foreign global role','other-user',null,null],
    ['business-scoped role','current-user','business-id',null],
    ['role read error','current-user',null,new Error('read failed')],
  ])('rejects %s',async(_label,rowUser,scope,readError)=>{
    setup('current-user',rowUser as string,scope as string|null,readError);
    await expect(PromotionsDebugPage()).rejects.toThrow('redirect:/dashboard');
  });
});

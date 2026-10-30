import { POST } from '@/app/admin/api/categories/[id]/update/route';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

jest.mock('@supabase/ssr',()=>({createServerClient:jest.fn()}));
jest.mock('@supabase/supabase-js',()=>({createClient:jest.fn()}));
jest.mock('next/headers',()=>({cookies:jest.fn()}));

const id='c7cef81b-2959-47eb-92b8-98ec82490d1c';
const current={id,slug:'live-test-category',name_ru:'LIVE TEST',is_active:false};
const auth={auth:{getUser:jest.fn()},rpc:jest.fn()};
const read={eq:jest.fn().mockReturnThis(),maybeSingle:jest.fn()};
const write={eq:jest.fn()};
const query={select:jest.fn(()=>read),update:jest.fn(()=>write)};
const admin={from:jest.fn(()=>query),rpc:jest.fn()};
function request(body:unknown) { return new Request('http://localhost/admin/api/categories/'+id+'/update',{method:'POST',body:JSON.stringify(body)}); }
beforeEach(()=>{
    jest.clearAllMocks();
    (cookies as jest.Mock).mockResolvedValue({get:jest.fn()});
    (createServerClient as jest.Mock).mockReturnValue(auth);
    (createClient as jest.Mock).mockReturnValue(admin);
    auth.auth.getUser.mockResolvedValue({data:{user:{id:'admin'}},error:null});
    auth.rpc.mockResolvedValue({data:true,error:null});
    read.maybeSingle.mockResolvedValue({data:current,error:null});
    write.eq.mockResolvedValue({error:null});
    admin.rpc.mockResolvedValue({error:null});
});
it('awaits promised ID and updates only the requested category preserving inactive state',async()=>{
    const response=await POST(request({name_ru:'LIVE TEST EDITED',slug:current.slug,is_active:false}),{params:Promise.resolve({id})});
    expect(response.status).toBe(200);
    expect(read.eq).toHaveBeenCalledWith('id',id);
    expect(write.eq).toHaveBeenCalledWith('id',id);
    expect(query.update).toHaveBeenCalledWith({name_ru:'LIVE TEST EDITED',slug:current.slug,is_active:false});
    expect(admin.rpc).not.toHaveBeenCalled();
});
it.each(['undefined','invalid'])('rejects invalid ID %s without persistence',async invalid=>{
    const response=await POST(request({name_ru:'EDITED'}),{params:Promise.resolve({id:invalid})});
    expect(response.status).toBe(400);
    expect(admin.from).not.toHaveBeenCalled();
});
it('requires signed-in superadmin before touching category data',async()=>{
    auth.auth.getUser.mockResolvedValue({data:{user:null}});
    expect((await POST(request({}),{params:Promise.resolve({id})})).status).toBe(401);
    expect(admin.from).not.toHaveBeenCalled();
    auth.auth.getUser.mockResolvedValue({data:{user:{id:'staff'}}});
    auth.rpc.mockResolvedValue({data:false});
    expect((await POST(request({}),{params:Promise.resolve({id})})).status).toBe(403);
    expect(admin.from).not.toHaveBeenCalled();
});
it('does not update a missing category',async()=>{
    read.maybeSingle.mockResolvedValue({data:null,error:null});
    expect((await POST(request({name_ru:'EDITED'}),{params:Promise.resolve({id})})).status).toBe(404);
    expect(query.update).not.toHaveBeenCalled();
});
it('rejects empty names without clearing stored data',async()=>{
    expect((await POST(request({name_ru:' '}),{params:Promise.resolve({id})})).status).toBe(400);
    expect(query.update).not.toHaveBeenCalled();
});
it('reports a duplicate slug as conflict',async()=>{
    write.eq.mockResolvedValue({error:{code:'23505',message:'duplicate'}});
    const response=await POST(request({slug:'barbershop'}),{params:Promise.resolve({id})});
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('Такой slug уже существует');
});
it('does not write unchanged empty patches',async()=>{
    const response=await POST(request({}),{params:Promise.resolve({id})});
    expect((await response.json()).updated).toBe(false);
    expect(query.update).not.toHaveBeenCalled();
});
it('generates a slug from the new name and propagates only explicit changed slugs',async()=>{
    const response=await POST(request({name_ru:'Женская категория',slug:null,propagateSlug:true}),{params:Promise.resolve({id})});
    expect(response.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith('cat_replace_slug',{old_slug:current.slug,new_slug:'zhenskaya-kategoriya'});
    expect(query.update).toHaveBeenCalledWith({name_ru:'Женская категория',slug:'zhenskaya-kategoriya'});
});
it('rejects malformed slugs without updating',async()=>{
    expect((await POST(request({slug:'!'}),{params:Promise.resolve({id})})).status).toBe(400);
    expect(query.update).not.toHaveBeenCalled();
});
it('does not update when slug propagation fails',async()=>{
    admin.rpc.mockResolvedValue({error:{message:'propagation failed'}});
    expect((await POST(request({slug:'changed',propagateSlug:true}),{params:Promise.resolve({id})})).status).toBe(400);
    expect(query.update).not.toHaveBeenCalled();
});
it('reports lookup and permission failures without update',async()=>{
    read.maybeSingle.mockResolvedValue({data:null,error:{message:'lookup failed'}});
    expect((await POST(request({}),{params:Promise.resolve({id})})).status).toBe(400);
    auth.rpc.mockResolvedValue({data:null,error:{message:'permission lookup failed'}});
    expect((await POST(request({}),{params:Promise.resolve({id})})).status).toBe(400);
    expect(query.update).not.toHaveBeenCalled();
});

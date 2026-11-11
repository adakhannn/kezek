import { POST, PUT } from '@/app/admin/api/users/[id]/update-basic/route';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/env', () => ({
    getSupabaseUrl: () => 'https://backend.example.invalid',
    getSupabaseAnonKey: () => 'DUMMY_NOT_A_KEY',
    getSupabaseServiceRoleKey: () => 'DUMMY_NOT_A_SERVICE_KEY',
}));

const userId = '125e60ab-eb79-4d92-bc6d-d84ae534eeee';
const auth = { auth: { getUser: jest.fn() }, rpc: jest.fn() };
const admin = { auth: { admin: { getUserById: jest.fn(), updateUserById: jest.fn() } } };
const request = () => new Request('http://localhost/admin/api/users/' + userId + '/update-basic', { method: 'POST', body: JSON.stringify({ full_name: ' C203 OWN NAME TEST ', email: 'known@example.invalid', phone: null }) });
beforeEach(() => {
    jest.clearAllMocks();
    (cookies as jest.Mock).mockResolvedValue({ get: jest.fn() });
    (createServerClient as jest.Mock).mockReturnValue(auth);
    (createClient as jest.Mock).mockReturnValue(admin);
    auth.auth.getUser.mockResolvedValue({ data: { user: { id: userId } } });
    auth.rpc.mockResolvedValue({data:true,error:null});
    admin.auth.admin.getUserById.mockResolvedValue({ data: { user: { user_metadata: { retained: 'unchanged', full_name: 'ORIGINAL' } } }, error: null });
    admin.auth.admin.updateUserById.mockResolvedValue({ error: null });
});
it.each(['promised', 'plain'])('resolves %s params and preserves existing metadata on the exact user', async shape => {
    const params = shape === 'promised' ? Promise.resolve({ id: userId }) : { id: userId };
    const response = await POST(request(), { params });
    expect(response.status).toBe(200);
    expect(auth.rpc).toHaveBeenCalledWith('is_super_admin');
    expect(admin.auth.admin.getUserById).toHaveBeenCalledWith(userId);
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledTimes(1);
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(userId, {
        email: 'known@example.invalid', phone: undefined,
        user_metadata: { retained: 'unchanged', full_name: 'C203 OWN NAME TEST' },
    });
});
it('rejects a missing ID before creating either client', async () => {
    expect((await POST(request(), { params: Promise.resolve({}) })).status).toBe(400);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
});
it('requires authentication before creating an admin client', async () => {
    auth.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request(), { params: Promise.resolve({ id: userId }) })).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
});
it('preserves the superadmin denial without writing user data', async () => {
    auth.rpc.mockResolvedValue({data:false,error:null});
    expect((await POST(request(), { params: Promise.resolve({ id: userId }) })).status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
});
it('does not update a missing target user', async () => {
    admin.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request(), { params: Promise.resolve({ id: userId }) })).status).toBe(404);
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
});
it('reports update failure through the PUT alias', async () => {
    admin.auth.admin.updateUserById.mockResolvedValue({ error: { message: 'update rejected' } });
    const response = await PUT(request(), { params: Promise.resolve({ id: userId }) });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('update rejected');
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledTimes(1);
});

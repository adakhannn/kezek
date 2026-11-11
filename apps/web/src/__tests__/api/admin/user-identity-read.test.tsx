import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Children, isValidElement, type ReactNode } from 'react';
import { GET } from '@/app/admin/api/users/list/route';
import UserPage from '@/app/admin/users/[id]/page';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn(async () => ({ get: jest.fn() })) }));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/app/_components/i18n/server', () => ({ getT: jest.fn(async () => (_key: string, fallback: string) => fallback) }));
jest.mock('@/app/admin/_components/AdminEntityFlowTabs', () => ({ AdminEntityFlowTabs: () => null }));
jest.mock('@/components/admin/users/UserBasicForm', () => ({ UserBasicForm: () => null }));
jest.mock('@/components/admin/users/UserPageRedirect', () => ({ UserPageRedirect: () => null }));
jest.mock('@/components/admin/users/UserSecurityActions', () => ({ UserSecurityActions: () => null }));

const actor = '11111111-1111-4111-8111-111111111111';
const target = '22222222-2222-4222-8222-222222222222';
function renderedRoleFlags(node: ReactNode): boolean[] {
    return Children.toArray(node).flatMap(child => {
        if (!isValidElement<{ isSuper?: unknown; children?: ReactNode }>(child)) return [];
        return typeof child.props.isSuper === 'boolean' ? [child.props.isSuper] : renderedRoleFlags(child.props.children);
    });
}
function setup() {
    const caller = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: actor } }, error: null }) }, rpc: jest.fn().mockResolvedValue({ data: true, error: null }), from: jest.fn() };
    const rows = { data: [], error: null };
    const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), returns: jest.fn().mockResolvedValue(rows), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }), then: (resolve: (value: typeof rows) => unknown) => Promise.resolve(rows).then(resolve) };
    const user = { id: target, email: 'target@example.test', user_metadata: {} };
    const admin = { rpc: jest.fn().mockResolvedValue({ data: { [target]: true }, error: null }), from: jest.fn(() => query), auth: { admin: { listUsers: jest.fn().mockResolvedValue({ data: { users: [user] }, error: null }), getUserById: jest.fn().mockResolvedValue({ data: { user }, error: null }) } } };
    jest.mocked(createServerClient).mockReturnValue(caller as never);
    jest.mocked(createClient).mockReturnValue(admin as never);
    return { caller, admin };
}
beforeEach(() => jest.clearAllMocks());
test('list receives canonical target state, without reading the legacy role view', async () => {
    const { caller, admin } = setup();
    const response = await GET(new Request('http://localhost/admin/api/users/list'));
    expect(response.status).toBe(200);
    expect((await response.json()).items[0].is_super).toBe(true);
    expect(caller.rpc).toHaveBeenCalledWith('is_super_admin');
    expect(caller.from).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith('read_platform_admin_states', { p_actor_id: actor, p_target_ids: [target] });
    expect(admin.from).not.toHaveBeenCalledWith('user_roles_with_user');
});
test('target lookup failure is a list failure, never false ordinary-user flags', async () => {
    const { admin } = setup();
    admin.rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } } as never);
    expect((await GET(new Request('http://localhost/admin/api/users/list'))).status).toBe(500);
});
test('detail admits a canonical global-only caller and passes authoritative target state to UI', async () => {
    const { caller, admin } = setup();
    const page = await UserPage({ params: Promise.resolve({ id: target }) });
    expect(caller.rpc).toHaveBeenCalledWith('is_super_admin');
    expect(caller.from).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith('read_platform_admin_states', { p_actor_id: actor, p_target_ids: [target] });
    expect(renderedRoleFlags(page)).toEqual([true]);
});
test.each(['auth-error', 'ordinary', 'lookup-error'])('detail %s stops before any privileged client', async reason => {
    const { caller } = setup();
    if (reason === 'auth-error') caller.auth.getUser.mockResolvedValue({ data: { user: { id: actor } }, error: { message: 'expired' } } as never);
    else caller.rpc.mockResolvedValue({ data: reason === 'lookup-error' ? true : false, error: reason === 'lookup-error' ? { message: 'unavailable' } : null } as never);
    await UserPage({ params: Promise.resolve({ id: target }) });
    expect(createClient).not.toHaveBeenCalled();
    if (reason === 'auth-error') expect(caller.rpc).not.toHaveBeenCalled();
});

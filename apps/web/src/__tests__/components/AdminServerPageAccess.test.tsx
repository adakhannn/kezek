/** @jest-environment jsdom */
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { headers } from 'next/headers';

import CategoriesPage from '@/app/admin/categories/page';
import BusinessesPage from '@/app/admin/businesses/page';
import MembersPage from '@/app/admin/businesses/[id]/members/page';
import NewMemberPage from '@/app/admin/businesses/[id]/members/new/page';
import RolesPage from '@/app/admin/roles/page';
import RoleEditPage from '@/app/admin/roles/[id]/page';
import NewRolePage from '@/app/admin/roles/new/page';
import RatingConfigPage from '@/app/admin/rating-config/page';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('next/headers', () => ({
    cookies: jest.fn(async () => ({ get: () => undefined })),
    headers: jest.fn(async () => new Headers({ host: 'synthetic.invalid' })),
}));
jest.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
jest.mock('@/app/_components/i18n/server', () => ({
    getServerLocale: jest.fn(async () => 'ru'),
    getT: () => (key: string, fallback?: string) => fallback ?? key,
}));
jest.mock('@/app/admin/_components/AdminEntityFlowTabs', () => ({ AdminEntityFlowTabs: () => null }));
jest.mock('@/app/admin/businesses/[id]/members/MembersClient', () => ({
    __esModule: true,
    default: ({ canManage }: { canManage: boolean }) => <div data-testid="members">{canManage ? 'manage' : 'read-only'}</div>,
}));
jest.mock('@/app/admin/businesses/[id]/members/new/NewMemberExisting', () => ({
    __esModule: true, default: () => <div data-testid="new-member" />,
}));
jest.mock('@/app/admin/roles/RolesClient', () => ({ __esModule: true, default: () => <div data-testid="roles" /> }));
jest.mock('@/app/admin/roles/[id]/EditRoleClient', () => ({ __esModule: true, default: () => <div data-testid="edit-role" /> }));
jest.mock('@/app/admin/roles/new/RolesNewClient', () => ({ __esModule: true, default: () => <div data-testid="new-role" /> }));
jest.mock('@/app/admin/rating-config/RatingConfigClient', () => ({ RatingConfigClient: () => <div data-testid="rating-config" /> }));
jest.mock('@/components/admin/categories/DeleteCategoryButton', () => ({ DeleteCategoryButton: () => null }));

const bizId = '10000000-0000-4000-8000-000000000001';
const params = () => ({ params: Promise.resolve({ id: bizId }) });
type RpcResult = { data: unknown; error: Error | null };
const result = (data: unknown, error: Error | null = null): RpcResult => ({ data, error });
let superRole: RpcResult;
let ownerRole: RpcResult;
let adminRole: RpcResult;
const getUser = jest.fn();
const rpc = jest.fn();
const sessionFrom = jest.fn();
const privilegedFrom = jest.fn();
const session = { auth: { getUser }, rpc, from: sessionFrom };

function query(table: string) {
    if (table === 'user_roles_with_user') throw new Error('Unbound legacy role lookup is forbidden');
    const response = result(table === 'roles' ? { id: bizId, key: 'staff', name: 'Synthetic role' }
        : table === 'businesses' ? [] : table === 'rating_global_config' ? null : []);
    const chain = {
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), maybeSingle: jest.fn(async () => response),
        then: (resolve: (value: RpcResult) => unknown) => Promise.resolve(response).then(resolve),
    };
    return chain;
}

beforeEach(() => {
    jest.clearAllMocks();
    superRole = result(true);
    ownerRole = result(false);
    adminRole = result(false);
    getUser.mockResolvedValue({ data: { user: { id: 'verified-global-only-admin' } }, error: null });
    rpc.mockImplementation(async (name: string, args?: { p_role: string; p_biz_id: string }) => {
        if (name === 'is_super_admin') return superRole;
        if (name === 'categories_with_usage_v2') return result([]);
        if (name === 'has_role' && args?.p_biz_id === bizId) return args.p_role === 'owner' ? ownerRole : adminRole;
        throw new Error(`Unexpected RPC: ${name}`);
    });
    sessionFrom.mockImplementation(query);
    privilegedFrom.mockImplementation(query);
    (createServerClient as jest.Mock).mockReturnValue(session);
    (createClient as jest.Mock).mockReturnValue({ from: privilegedFrom });
});

const pages = [
    { name: 'categories', run: () => CategoriesPage(), allowed: () => screen.getByRole('heading', { name: 'Категории бизнеса' }) },
    { name: 'businesses', run: () => BusinessesPage(), allowed: () => screen.getByRole('heading', { name: 'Бизнесы' }) },
    { name: 'members', run: () => MembersPage(params()), allowed: () => screen.getByTestId('members') },
    { name: 'new member', run: () => NewMemberPage(params()), allowed: () => screen.getByTestId('new-member') },
    { name: 'roles', run: () => RolesPage(), allowed: () => screen.getByTestId('roles') },
    { name: 'edit role', run: () => RoleEditPage(params()), allowed: () => screen.getByTestId('edit-role') },
    { name: 'new role', run: () => NewRolePage(), allowed: () => screen.getByTestId('new-role') },
    { name: 'rating config', run: () => RatingConfigPage(), allowed: () => screen.getByRole('heading', { name: 'Настройки рейтингов' }) },
];

async function visit(run: () => Promise<React.ReactNode>) {
    try { render(await run()); } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('REDIRECT:/auth/sign-in?')) throw error;
    }
}
function expectNoProtectedReads() {
    expect(sessionFrom).not.toHaveBeenCalled();
    expect(privilegedFrom).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(headers).not.toHaveBeenCalled();
    expect(rpc.mock.calls.every(([name]) => name === 'is_super_admin' || name === 'has_role')).toBe(true);
}

describe.each(pages)('$name server page access', ({ run, allowed }) => {
    test('accepts a global-only admin using the verified session RPC, without a role-table lookup', async () => {
        await visit(run);
        expect(allowed()).toBeTruthy();
        expect(rpc).toHaveBeenCalledWith('is_super_admin');
        expect(getUser.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
        expect(sessionFrom).not.toHaveBeenCalledWith('user_roles_with_user');
    });
    test.each(['missing', 'error-with-stale-user'] as const)('rejects %s before checking roles or reading data', async mode => {
        getUser.mockResolvedValue({ data: { user: mode === 'missing' ? null : { id: 'stale-user' } }, error: mode === 'missing' ? null : new Error('expired') });
        await visit(run);
        expect(rpc).not.toHaveBeenCalled();
        expectNoProtectedReads();
    });
    test.each([
        ['denied', false, null], ['error with true', true, new Error('unavailable')],
        ['string true', 'true', null], ['null', null, null],
    ])('rejects %s role result before protected reads', async (_name, data, error) => {
        superRole = result(data, error as Error | null);
        await visit(run);
        expectNoProtectedReads();
    });
    test('closes access on a thrown role lookup failure', async () => {
        rpc.mockRejectedValueOnce(new Error('transport unavailable'));
        await visit(run);
        expectNoProtectedReads();
    });
});

describe.each([
    { name: 'member list', run: () => MembersPage(params()), marker: 'members' },
    { name: 'new member', run: () => NewMemberPage(params()), marker: 'new-member' },
])('$name business alternatives', ({ run, marker }) => {
    test.each(['owner', 'admin'])('retains exact-business %s access without a platform role', async role => {
        superRole = result(false);
        if (role === 'owner') ownerRole = result(true); else adminRole = result(true);
        await visit(run);
        expect(screen.getByTestId(marker)).toBeTruthy();
        if (marker === 'members') expect(screen.getByTestId(marker).textContent).toBe('manage');
        expect(rpc).toHaveBeenCalledWith('has_role', { p_role: role, p_biz_id: bizId });
    });
    test.each([
        ['owner error', result(true, new Error('DB unavailable')), result(true)],
        ['admin error', result(true), result(true, new Error('DB unavailable'))],
        ['string owner', result('true'), result(false)],
        ['string admin', result(false), result('true')],
        ['null owner despite admin', result(null), result(true)],
    ])('rejects %s instead of treating an unknown role result as permission', async (_label, owner, admin) => {
        superRole = result(false); ownerRole = owner as RpcResult; adminRole = admin as RpcResult;
        await visit(run);
        expect(screen.queryByTestId(marker)).toBeNull();
        expectNoProtectedReads();
    });
});

test('a platform-only member viewer does not gain business management permission', async () => {
    await visit(() => MembersPage(params()));
    expect(screen.getByTestId('members').textContent).toBe('read-only');
    expect(screen.queryByRole('link', { name: 'Добавить участника' })).toBeNull();
});
test('a platform viewer still fails closed when business management rights cannot be verified', async () => {
    ownerRole = result(true, new Error('unavailable'));
    await visit(() => MembersPage(params()));
    expectNoProtectedReads();
});

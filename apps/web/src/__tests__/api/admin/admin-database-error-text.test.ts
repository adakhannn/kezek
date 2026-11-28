jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn(), createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/adminAccess', () => ({ checkCurrentUserIsSuperAdmin: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));

import { GET as categoriesList } from '@/app/admin/api/categories/list/route';
import { POST as deleteRole } from '@/app/admin/api/roles/[id]/delete/route';
import { GET as rolesList } from '@/app/admin/api/roles/list/route';
import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { DATABASE_FAILURE_MESSAGES } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

/** Super-admin-only routes answer generic text for a failed database call and log the raw error (R25-29). */

const RAW = 'permission denied for table roles (constraint roles_pkey)';
const dbError = (code = 'XX000') => ({ code, message: RAW, details: 'raw details', hint: null });

function builder(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'delete']) chain[method] = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(() => Promise.resolve(result));
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return chain;
}

function signedIn(client: Record<string, unknown>) {
    jest.mocked(createSupabaseServerClient).mockResolvedValue({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'super-admin' } }, error: null }) },
        ...client,
    } as never);
    jest.mocked(checkCurrentUserIsSuperAdmin).mockResolvedValue({ isSuperAdmin: true, error: null } as never);
}

beforeEach(() => jest.clearAllMocks());

test('categories list: a failed super-admin check and a failed read answer generic text', async () => {
    signedIn({ rpc: jest.fn().mockResolvedValue({ data: null, error: dbError() }) });
    const check = await categoriesList();
    expect(check.status).toBe(400);
    expect(await check.json()).toEqual({ ok: false, error: DATABASE_FAILURE_MESSAGES.internal });

    signedIn({ rpc: jest.fn().mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: null, error: dbError() }) });
    const read = await categoriesList();
    expect(read.status).toBe(400);
    expect(await read.json()).toEqual({ ok: false, error: DATABASE_FAILURE_MESSAGES.load });
    expect(logError).toHaveBeenCalledWith('AdminCategoriesList', 'Database error', expect.objectContaining({ message: RAW }));
});

test('roles list: a thrown database failure is logged, the answer has no raw text', async () => {
    signedIn({ from: jest.fn(() => { throw new Error(RAW); }) });
    const response = await rolesList();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ ok: false, error: DATABASE_FAILURE_MESSAGES.internal });
    expect(logError).toHaveBeenCalledWith('AdminRoles', 'Failed to list roles', expect.any(Error));
});

test('role delete: a role in use keeps its friendly text, any other failure is generic', async () => {
    const context = { params: Promise.resolve({ id: 'role-1' }) };
    const roleRow = { data: { is_system: false }, error: null };

    signedIn({ from: jest.fn().mockReturnValueOnce(builder(roleRow)).mockReturnValueOnce(builder({ data: null, error: dbError('23503') })) });
    const inUse = await deleteRole(new Request('http://localhost', { method: 'POST' }), context);
    expect(inUse.status).toBe(400);
    expect((await inUse.json()).error).toContain('роль используется');

    signedIn({ from: jest.fn().mockReturnValueOnce(builder(roleRow)).mockReturnValueOnce(builder({ data: null, error: dbError() })) });
    const failed = await deleteRole(new Request('http://localhost', { method: 'POST' }), context);
    expect(failed.status).toBe(400);
    const body = await failed.json();
    expect(body.error).toBe(DATABASE_FAILURE_MESSAGES.delete);
    expect(JSON.stringify(body)).not.toContain('permission denied');
});

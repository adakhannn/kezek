import { BizAccessError, StaffSelectionRequiredError } from '@/lib/authDiagnostics';
import { logWarn } from '@/lib/log';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { resolveStaffContext, resolveStaffContextForRequest } from '@/lib/staffRoleSync';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logWarn: jest.fn(),
    logError: jest.fn(),
    logDebug: jest.fn(),
}));

jest.mock('@/lib/requestAuthContext', () => ({
    resolveRequestAuthContext: jest.fn(),
}));

const requestHeaders = new Map<string, string>();
const requestCookies = new Map<string, string>();
jest.mock('next/headers', () => ({
    headers: async () => ({ get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null }),
    cookies: async () => ({
        get: (name: string) => (requestCookies.has(name) ? { name, value: requestCookies.get(name) } : undefined),
    }),
}));

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '33333333-3333-4333-8333-333333333333';

type Card = { id: string; biz_id: string; branch_id: string | null; created_at?: string };
const cardA: Card = { id: STAFF_A, biz_id: 'biz-a', branch_id: 'branch-a', created_at: '2026-01-01T00:00:00Z' };
const cardB: Card = { id: STAFF_B, biz_id: 'biz-b', branch_id: null, created_at: '2026-02-01T00:00:00Z' };

// PostgREST-like: awaiting the list gives every row; maybeSingle gives PGRST116 for 2+ rows.
function createStaffListChain(rows: Card[] | null, error: { message: string } | null = null) {
    const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        order: jest.fn(() => chain),
        maybeSingle: jest.fn(async () => {
            if (rows && rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
            return { data: rows?.[0] ?? null, error };
        }),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve({ data: error ? null : rows, error }).then(resolve, reject),
    };
    return chain;
}


describe('resolveStaffContext', () => {
    const serverClient: any = {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
    };
    const adminClient: any = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        requestHeaders.clear();
        requestCookies.clear();
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(serverClient);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(adminClient);
        serverClient.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });
    });

    // ARCH-10: resolving the context never writes; the staff role follows the card in the database.
    afterEach(() => {
        expect(createSupabaseAdminClient).not.toHaveBeenCalled();
        expect(adminClient.from).not.toHaveBeenCalled();
        for (const [table] of serverClient.from.mock.calls) expect(table).toBe('staff');
    });

    it('throws NOT_AUTHENTICATED when user is missing', async () => {
        serverClient.auth.getUser.mockResolvedValueOnce({
            data: { user: null },
            error: null,
        });

        await expect(resolveStaffContext()).rejects.toMatchObject<Partial<BizAccessError>>({
            code: 'NOT_AUTHENTICATED',
        });
    });

    it('throws NO_STAFF_RECORD when the user has no active card', async () => {
        serverClient.from.mockReturnValueOnce(createStaffListChain([]));

        await expect(resolveStaffContext()).rejects.toMatchObject<Partial<BizAccessError>>({
            code: 'NO_STAFF_RECORD',
        });
    });

    it('returns the only card when its staff role already exists', async () => {
        serverClient.from.mockReturnValueOnce(createStaffListChain([cardA]));

        const result = await resolveStaffContext();

        expect(result).toEqual({
            supabase: serverClient,
            userId: 'user-1',
            staffId: STAFF_A,
            bizId: 'biz-a',
            branchId: 'branch-a',
            staffOptions: [{ staffId: STAFF_A, bizId: 'biz-a', branchId: 'branch-a' }],
        });
    });

    it('ignores a stale remembered card when there is only one card', async () => {
        requestCookies.set('kezek_staff_id', FOREIGN);
        serverClient.from.mockReturnValueOnce(createStaffListChain([cardA]));

        await expect(resolveStaffContext()).resolves.toMatchObject({ staffId: STAFF_A });
    });

    // ARCH-02: a master of two businesses was locked out (maybeSingle failed on two rows).
    it('two cards and a remembered card B: acts as B', async () => {
        requestCookies.set('kezek_staff_id', STAFF_B);
        const staffList = createStaffListChain([cardB, cardA]);
        serverClient.from.mockReturnValueOnce(staffList);

        const result = await resolveStaffContext();

        expect(staffList.maybeSingle).not.toHaveBeenCalled();
        expect(result).toMatchObject({ staffId: STAFF_B, bizId: 'biz-b', branchId: null });
        expect(result.staffOptions.map((option) => option.staffId)).toEqual([STAFF_A, STAFF_B]);
    });

    it('two cards and no choice: asks to choose, listing both cards oldest first', async () => {
        serverClient.from.mockReturnValueOnce(createStaffListChain([cardB, cardA]));

        const error = await resolveStaffContext().catch((cause: unknown) => cause);

        expect(error).toBeInstanceOf(StaffSelectionRequiredError);
        expect((error as StaffSelectionRequiredError).code).toBe('STAFF_SELECTION_REQUIRED');
        expect((error as StaffSelectionRequiredError).staffOptions).toEqual([
            { staffId: STAFF_A, bizId: 'biz-a', branchId: 'branch-a' },
            { staffId: STAFF_B, bizId: 'biz-b', branchId: null },
        ]);
        expect(adminClient.from).not.toHaveBeenCalled();
    });

    it('the request header names the card and wins over the remembered one', async () => {
        requestHeaders.set('x-kezek-staff-id', STAFF_B);
        requestCookies.set('kezek_staff_id', STAFF_A);
        serverClient.from.mockReturnValueOnce(createStaffListChain([cardA, cardB]));

        await expect(resolveStaffContext()).resolves.toMatchObject({ staffId: STAFF_B, bizId: 'biz-b' });
    });

    it('a header naming a card that is not the caller\'s is refused, even with one card', async () => {
        requestHeaders.set('x-kezek-staff-id', FOREIGN);
        serverClient.from.mockReturnValueOnce(createStaffListChain([cardA]));

        await expect(resolveStaffContext()).rejects.toMatchObject({ code: 'NO_STAFF_ACCESS' });
    });

    it('a malformed header is refused', async () => {
        requestHeaders.set('x-kezek-staff-id', 'not-a-uuid');
        serverClient.from.mockReturnValueOnce(createStaffListChain([cardA]));

        await expect(resolveStaffContext()).rejects.toMatchObject({ code: 'NO_STAFF_ACCESS' });
    });

    it('a lookup error is not reported as "not staff"', async () => {
        serverClient.from.mockReturnValueOnce(createStaffListChain(null, { message: 'timeout' }));

        await expect(resolveStaffContext()).rejects.toThrow('STAFF_LOOKUP_FAILED');
        expect(logWarn).toHaveBeenCalledWith('AuthBiz', 'Failed to list active staff cards', { message: 'timeout' });
    });

    it('works without the service role key: it needs only the caller\'s own cards', async () => {
        serverClient.from.mockReturnValueOnce(createStaffListChain([{ id: STAFF_A, biz_id: 'biz-3', branch_id: 'branch-3' }]));
        (createSupabaseAdminClient as jest.Mock).mockImplementation(() => {
            throw new Error('missing service role key');
        });

        await expect(resolveStaffContext()).resolves.toMatchObject({ bizId: 'biz-3' });
        expect(logWarn).not.toHaveBeenCalled();
    });
});

describe('resolveStaffContextForRequest', () => {
    const requestClient: any = { from: jest.fn() };
    const adminClient: any = { from: jest.fn() };

    function request(headers: Record<string, string> = {}) {
        return new Request('http://localhost/api/staff/finance', { headers });
    }

    beforeEach(() => {
        jest.clearAllMocks();
        requestHeaders.clear();
        requestCookies.clear();
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(adminClient);
    });

    afterEach(() => {
        expect(adminClient.from).not.toHaveBeenCalled();
    });

    it('a mobile Bearer request ignores the web cookie and must name the card', async () => {
        (resolveRequestAuthContext as jest.Mock).mockResolvedValue({ supabase: requestClient, user: { id: 'user-1' }, authSource: 'bearer' });
        requestCookies.set('kezek_staff_id', STAFF_B);
        requestClient.from.mockReturnValueOnce(createStaffListChain([cardA, cardB]));

        await expect(resolveStaffContextForRequest(request())).rejects.toBeInstanceOf(StaffSelectionRequiredError);

        requestClient.from.mockReturnValueOnce(createStaffListChain([cardA, cardB]));
        await expect(resolveStaffContextForRequest(request({ 'x-kezek-staff-id': STAFF_B }))).resolves.toMatchObject({ staffId: STAFF_B });
    });

    it('a cookie request uses the remembered card', async () => {
        (resolveRequestAuthContext as jest.Mock).mockResolvedValue({ supabase: requestClient, user: { id: 'user-1' }, authSource: 'cookie' });
        requestCookies.set('kezek_staff_id', STAFF_B);
        requestClient.from.mockReturnValueOnce(createStaffListChain([cardA, cardB]));

        await expect(resolveStaffContextForRequest(request())).resolves.toMatchObject({ staffId: STAFF_B, bizId: 'biz-b' });
    });

    it('a route that names the card must agree with the header', async () => {
        (resolveRequestAuthContext as jest.Mock).mockResolvedValue({ supabase: requestClient, user: { id: 'user-1' }, authSource: 'bearer' });

        await expect(
            resolveStaffContextForRequest(request({ 'x-kezek-staff-id': STAFF_A }), 'Stats', { staffId: STAFF_B }),
        ).rejects.toMatchObject({ code: 'NO_STAFF_ACCESS' });

        requestClient.from.mockReturnValueOnce(createStaffListChain([cardA, cardB]));
        await expect(resolveStaffContextForRequest(request(), 'Stats', { staffId: STAFF_B })).resolves.toMatchObject({ staffId: STAFF_B });
    });

    it('an unauthenticated request is NOT_AUTHENTICATED', async () => {
        (resolveRequestAuthContext as jest.Mock).mockResolvedValue(new Response(null, { status: 401 }));

        await expect(resolveStaffContextForRequest(request())).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
    });
});

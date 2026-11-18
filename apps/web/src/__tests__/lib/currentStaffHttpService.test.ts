import { readFileSync } from 'node:fs';
import path from 'node:path';

import { runSetCurrentStaffHttp } from '@/lib/currentStaffHttpService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn(), logDebug: jest.fn() }));

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '33333333-3333-4333-8333-333333333333';

function staffList(rows: Array<{ id: string; biz_id: string }>) {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order']) chain[method] = jest.fn(() => chain);
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
    return chain;
}

describe('POST /api/me/current-staff (ARCH-02)', () => {
    const supabase = { auth: { getUser: jest.fn() }, from: jest.fn() };
    const post = (body: unknown) =>
        new Request('http://localhost/api/me/current-staff', { method: 'POST', body: JSON.stringify(body) });

    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(supabase);
        supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
        supabase.from.mockReturnValue(staffList([{ id: STAFF_A, biz_id: 'biz-a' }, { id: STAFF_B, biz_id: 'biz-b' }]));
    });

    test('remembers one of the caller\'s own cards in an HttpOnly, SameSite=Lax cookie', async () => {
        const response = await runSetCurrentStaffHttp(post({ staffId: STAFF_B }));

        expect(response.status).toBe(200);
        const cookie = response.headers.get('set-cookie') ?? '';
        expect(cookie).toContain(`kezek_staff_id=${STAFF_B}`);
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=lax/i);
        expect(cookie).toMatch(/Path=\//);
        expect(supabase.from).toHaveBeenCalledWith('staff');
    });

    test('a card that is not the caller\'s active card is refused without a cookie', async () => {
        const response = await runSetCurrentStaffHttp(post({ staffId: FOREIGN }));

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({ error: 'forbidden', details: { code: 'NO_STAFF_ACCESS' } });
        expect(response.headers.get('set-cookie')).toBeNull();
    });

    test('a malformed id is 400 and is not looked up', async () => {
        const response = await runSetCurrentStaffHttp(post({ staffId: 'not-a-uuid' }));

        expect(response.status).toBe(400);
        expect(supabase.from).not.toHaveBeenCalled();
    });

    test('signed out is 401', async () => {
        supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

        const response = await runSetCurrentStaffHttp(post({ staffId: STAFF_A }));

        expect(response.status).toBe(401);
    });

    test('the route is rate limited like current-business', () => {
        const route = readFileSync(path.join(process.cwd(), 'src/app/api/me/current-staff/route.ts'), 'utf8');
        expect(route).toContain("routeRateLimit('api/me/current-staff', RateLimitConfigs.normal)");
        expect(route).toContain('withErrorHandler(');
    });
});

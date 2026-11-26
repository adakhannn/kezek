import { POST as ACCEPT } from '@/app/api/staff-invitations/[id]/accept/route';
import { POST as DECLINE } from '@/app/api/staff-invitations/[id]/decline/route';
import { GET } from '@/app/api/staff-invitations/route';
import { createMockRequest, createTableMock, expectErrorResponse, expectSuccessResponse } from '../testHelpers';

import { createClient } from '@supabase/supabase-js';

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

// API-06: the invited person lists, accepts and declines only their own invitations.
describe('/api/staff-invitations', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const invitationId = '33333333-3333-4333-8333-333333333333';
    const context = { params: Promise.resolve({ id: invitationId }) };
    let admin: ReturnType<typeof createTableMock>;

    function signIn(id: string | null, tables: Parameters<typeof createTableMock>[0] = {}) {
        admin = createTableMock(tables);
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({
            auth: { getUser: jest.fn().mockResolvedValue({ data: { user: id ? { id } : null }, error: null }) },
        });
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(admin);
    }

    const request = (path: string, method = 'POST', headers?: Record<string, string>) =>
        createMockRequest(`http://localhost/api/staff-invitations${path}`, { method, headers });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('auth required', () => {
        test.each([
            ['GET list', () => GET(request('', 'GET'))],
            ['accept', () => ACCEPT(request(`/${invitationId}/accept`), context)],
            ['decline', () => DECLINE(request(`/${invitationId}/decline`), context)],
        ])('%s answers 401 without a session and touches nothing', async (_, call) => {
            signIn(null);
            const res = await call();
            await expectErrorResponse(res, 401, 'auth');
            expect(admin.queries).toHaveLength(0);
            expect(admin.rpc).not.toHaveBeenCalled();
        });
    });

    describe('mobile Bearer token (C13)', () => {
        test('the app user lists and accepts their invitations with the Bearer token, without a cookie session', async () => {
            signIn(null, { staff_invitations: { data: [] } });
            const bearerGetUser = jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null });
            (createClient as jest.Mock).mockReturnValue({ auth: { getUser: bearerGetUser } });

            const list = await expectSuccessResponse(await GET(request('', 'GET', { Authorization: 'Bearer app-token' })), 200);
            expect(list.invitations).toEqual([]);
            expect(createClient).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.objectContaining({ global: { headers: { Authorization: 'Bearer app-token' } } }),
            );
            expect(createSupabaseServerClient).not.toHaveBeenCalled();

            admin.rpc.mockResolvedValue({ data: { status: 'accepted', staff_id: 'card-1', biz_id: 'biz-1', is_active: true }, error: null });
            await expectSuccessResponse(
                await ACCEPT(request(`/${invitationId}/accept`, 'POST', { Authorization: 'Bearer app-token' }), context),
                200,
            );
            expect(admin.rpc).toHaveBeenCalledWith('accept_staff_invitation', { p_invitation_id: invitationId, p_user_id: userId });
        });

        test('an invalid Bearer token is 401 and does not fall back to a cookie session', async () => {
            signIn(userId);
            (createClient as jest.Mock).mockReturnValue({
                auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } }) },
            });
            await expectErrorResponse(await DECLINE(request(`/${invitationId}/decline`, 'POST', { Authorization: 'Bearer bad' }), context), 401, 'auth');
            expect(admin.rpc).not.toHaveBeenCalled();
            expect(createSupabaseServerClient).not.toHaveBeenCalled();
        });
    });

    describe('GET', () => {
        test('lists the caller’s pending invitations with business and branch names', async () => {
            signIn(userId, {
                staff_invitations: { data: [
                    { id: 'inv-1', biz_id: 'biz-1', staff_id: 'card-1', created_at: '2026-11-19T10:00:00Z' },
                    { id: 'inv-2', biz_id: 'biz-2', staff_id: 'card-2', created_at: '2026-11-18T10:00:00Z' },
                ] },
                // card-2 was linked meanwhile: its invitation would only be cancelled, so it is not listed.
                staff: { data: [
                    { id: 'card-1', biz_id: 'biz-1', branch_id: 'branch-1', user_id: null },
                    { id: 'card-2', biz_id: 'biz-2', branch_id: 'branch-2', user_id: 'someone' },
                ] },
                businesses: { data: [{ id: 'biz-1', name: 'Salon' }] },
                branches: { data: [{ id: 'branch-1', name: 'Center' }] },
            });

            const res = await GET(request('', 'GET'));
            const data = await expectSuccessResponse(res, 200);

            expect(data.invitations).toEqual([{
                id: 'inv-1', biz_id: 'biz-1', staff_id: 'card-1', business_name: 'Salon', branch_name: 'Center', created_at: '2026-11-19T10:00:00Z',
            }]);
            const lookup = admin.queries.find((query) => query.table === 'staff_invitations');
            expect(lookup?.calls).toEqual(expect.arrayContaining([['eq', 'invited_user_id', userId], ['eq', 'status', 'pending']]));
        });

        test('an empty list needs no further reads', async () => {
            signIn(userId, { staff_invitations: { data: [] } });
            const data = await expectSuccessResponse(await GET(request('', 'GET')), 200);
            expect(data.invitations).toEqual([]);
            expect(admin.queries).toHaveLength(1);
        });

        test('a failed read is a 500', async () => {
            signIn(userId, { staff_invitations: { error: { message: 'timeout' } } });
            await expectErrorResponse(await GET(request('', 'GET')), 500, 'internal');
        });
    });

    describe('accept', () => {
        test('links the card through the command, for the session user only', async () => {
            signIn(userId);
            admin.rpc.mockResolvedValue({ data: { status: 'accepted', staff_id: 'card-1', biz_id: 'biz-1', is_active: true }, error: null });

            const data = await expectSuccessResponse(await ACCEPT(request(`/${invitationId}/accept`), context), 200);

            expect(admin.rpc).toHaveBeenCalledWith('accept_staff_invitation', { p_invitation_id: invitationId, p_user_id: userId });
            expect(data).toMatchObject({ staff_id: 'card-1', biz_id: 'biz-1', is_active: true });
        });

        test('an inactive card is reported, so the cabinet does not promise access', async () => {
            signIn(userId);
            admin.rpc.mockResolvedValue({ data: { status: 'accepted', staff_id: 'card-1', biz_id: 'biz-1', is_active: false }, error: null });

            const data = await expectSuccessResponse(await ACCEPT(request(`/${invitationId}/accept`), context), 200);
            expect(data).toMatchObject({ is_active: false });
        });

        test('a person already in the team gets 409 and the command has cancelled the invitation', async () => {
            signIn(userId);
            admin.rpc.mockResolvedValue({ data: { status: 'stale', error: 'STAFF_INVITATION_ALREADY_STAFF' }, error: null });

            await expectErrorResponse(await ACCEPT(request(`/${invitationId}/accept`), context), 409, 'conflict');
        });

        test('an invalid id is 404 without calling the command', async () => {
            signIn(userId);
            const res = await ACCEPT(request('/not-a-uuid/accept'), { params: Promise.resolve({ id: 'not-a-uuid' }) });
            await expectErrorResponse(res, 404, 'not_found');
            expect(admin.rpc).not.toHaveBeenCalled();
        });

        test.each([
            ['STAFF_INVITATION_NOT_FOUND', 404, 'not_found', 'Приглашение не найдено'],
            ['STAFF_INVITATION_NOT_PENDING', 409, 'conflict', 'Приглашение уже обработано'],
            ['STAFF_INVITATION_ALREADY_STAFF', 409, 'conflict', 'Вы уже в команде этого бизнеса'],
            ['something else', 500, 'internal', 'Не удалось обработать приглашение'],
        ])('maps %s to %s', async (code, status, error, message) => {
            signIn(userId);
            admin.rpc.mockResolvedValue({ data: null, error: { message: code } });
            const body = await expectErrorResponse(await ACCEPT(request(`/${invitationId}/accept`), context), status, error);
            expect(body.message).toBe(message);
        });

        test('a stale invitation (card changed, invitation cancelled) is 409', async () => {
            signIn(userId);
            admin.rpc.mockResolvedValue({ data: { status: 'stale', error: 'STAFF_INVITATION_STALE' }, error: null });
            const body = await expectErrorResponse(await ACCEPT(request(`/${invitationId}/accept`), context), 409, 'conflict');
            expect(body.message).toBe('Приглашение больше не действует: карточка сотрудника изменилась');
        });
    });

    describe('decline', () => {
        test('declines through the command, for the session user only', async () => {
            signIn(userId);
            admin.rpc.mockResolvedValue({ data: null, error: null });

            const res = await DECLINE(request(`/${invitationId}/decline`), context);
            await expectSuccessResponse(res, 200);
            expect(admin.rpc).toHaveBeenCalledWith('decline_staff_invitation', { p_invitation_id: invitationId, p_user_id: userId });
        });

        test('someone else’s invitation is 404', async () => {
            signIn(userId);
            admin.rpc.mockResolvedValue({ data: null, error: { message: 'STAFF_INVITATION_NOT_FOUND' } });
            await expectErrorResponse(await DECLINE(request(`/${invitationId}/decline`), context), 404, 'not_found');
        });
    });
});

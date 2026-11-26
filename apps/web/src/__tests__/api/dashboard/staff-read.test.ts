import { GET as getDetail } from '@/app/api/dashboard/staff/[id]/route';
import { GET as getScheduleContext } from '@/app/api/dashboard/staff/[id]/schedule-context/route';
import { GET as getList } from '@/app/api/dashboard/staff/route';
import { createMockRequest, expectErrorResponse, expectSuccessResponse } from '../testHelpers';

import { getBizContextForManagers } from '@/lib/authBiz';
import { loadDashboardStaffDetail, loadDashboardStaffList, loadDashboardStaffScheduleContext } from '@/lib/dashboardStaffReadService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/staffApplicationSummary', () => ({ loadStaffApplicationSummary: jest.fn(async () => ({ pending: 2 })) }));
jest.mock('@/lib/scheduling/legacyContext', () => ({ readLegacyScheduleContext: jest.fn(async () => ({ usesPublishedSchedule: false, branchHours: [], hasRegularSchedule: false, failed: false })) }));
jest.mock('@/lib/scheduling/config', () => ({ explicitSchedulingEnabled: () => false }));
jest.mock('@/lib/staffPrivateFields', () => ({ readStaffPrivateFields: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));

const staffId = '11111111-1111-4111-8111-111111111111';
const bizId = '22222222-2222-4222-8222-222222222222';

/** A PostgREST builder whose every filter returns itself and which resolves to `result`. */
function builder(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'returns', 'in']) chain[method] = jest.fn(() => chain);
    chain.maybeSingle = jest.fn(async () => result);
    chain.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
}

function client(tables: Record<string, { data: unknown; error: unknown }>) {
    return { from: jest.fn((table: string) => builder(tables[table] ?? { data: null, error: null })) };
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GET /api/dashboard/staff (the app\'s /dashboard/staff)', () => {
    test('the staff of the current business, pending invitations and the business name', async () => {
        const supabase = client({ staff: { data: [{ id: staffId, full_name: 'A', is_active: true, branch_id: 'b', branches: { name: 'Центр' } }], error: null } });
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ supabase, bizId, userId: 'u', business: { name: 'Low Fade', city: null } });
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(client({ staff_invitations: { data: [{ staff_id: staffId }, { staff_id: staffId }], error: null } }));

        const data = await expectSuccessResponse(await getList(), 200);

        expect(data).toMatchObject({
            rows: [{ id: staffId, full_name: 'A', is_active: true, branch_id: 'b', branches: { name: 'Центр' } }],
            pendingInvitationStaffIds: [staffId],
            staffApplications: { pending: 2 },
            business: { name: 'Low Fade', city: null },
        });
        expect(supabase.from).toHaveBeenCalledWith('staff');
    });

    test('a failed staff read is a 500, not an empty team', async () => {
        const supabase = client({ staff: { data: null, error: { message: 'boom' } } });
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ supabase, bizId, userId: 'u', business: null });

        await expectErrorResponse(await getList(), 500, 'internal');
    });

    test('403 without manager access', async () => {
        const { BizAccessError } = await import('@/lib/authDiagnostics');
        (getBizContextForManagers as jest.Mock).mockRejectedValue(new BizAccessError('NO_BIZ_ACCESS'));

        await expectErrorResponse(await getList(), 403, 'forbidden');
    });

    test('the list loader keeps the team when invitations are unavailable', async () => {
        const supabase = client({ staff: { data: [], error: null } });
        (createSupabaseAdminClient as jest.Mock).mockImplementation(() => { throw new Error('no key'); });
        await expect(loadDashboardStaffList({ supabase: supabase as never, bizId, userId: 'u' }))
            .resolves.toEqual({ ok: true, data: { rows: [], pendingInvitationStaffIds: [], staffApplications: { pending: 2 } } });
    });
});

describe('GET /api/dashboard/staff/[id] and /schedule-context', () => {
    const context = { params: Promise.resolve({ id: staffId }) };

    test('a card of another business is 404', async () => {
        const { readStaffPrivateFields } = await import('@/lib/staffPrivateFields');
        (readStaffPrivateFields as jest.Mock).mockResolvedValue({ data: { id: staffId, biz_id: 'other' }, error: null });
        const supabase = client({ branches: { data: [], error: null } });
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ supabase, bizId, userId: 'u' });

        await expectErrorResponse(await getDetail(createMockRequest(`http://localhost/api/dashboard/staff/${staffId}`), context), 404, 'not_found');
        await expect(loadDashboardStaffDetail({ supabase: supabase as never, bizId, userId: 'u' }, staffId)).resolves.toEqual({ ok: false, reason: 'not_found' });
    });

    test('the schedule context names the editor and the active branches', async () => {
        const supabase = client({
            staff: { data: { id: staffId, full_name: 'A', branch_id: 'b1', biz_id: bizId }, error: null },
            branches: { data: [{ id: 'b1', name: 'Центр', is_active: true }, { id: 'b2', name: 'Старый', is_active: false }], error: null },
        });
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ supabase, bizId, userId: 'u', business: { name: 'Low Fade', city: null } });

        const data = await expectSuccessResponse(await getScheduleContext(createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/schedule-context`), context), 200);

        expect(data).toMatchObject({
            staff: { id: staffId, full_name: 'A', branch_id: 'b1' },
            branches: [{ id: 'b1', name: 'Центр' }],
            explicitScheduling: false,
            legacy: { usesPublishedSchedule: false, failed: false },
            business: { name: 'Low Fade' },
        });
    });

    test('the schedule context of a staff member of another business is 404', async () => {
        const supabase = client({ staff: { data: { id: staffId, full_name: 'A', branch_id: 'b1', biz_id: 'other' }, error: null } });
        await expect(loadDashboardStaffScheduleContext({ supabase: supabase as never, bizId, userId: 'u' }, staffId))
            .resolves.toEqual({ ok: false, reason: 'not_found' });
    });
});

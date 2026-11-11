import { POST as updateContacts } from '@/app/api/dashboard/contact-settings/route';
import { PATCH as updateAdminBranch } from '@/app/admin/api/businesses/[id]/branches/[branchId]/update/route';
import { PATCH as updateBusiness } from '@/app/admin/api/businesses/[id]/update/route';
import { POST as updateOwnerBranch } from '@/app/api/branches/[id]/update/route';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getBizContextForManagers } from '@/lib/authBiz';
import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn(async () => ({ get: jest.fn() })) }));
jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/adminHttpAccess', () => ({ requireCurrentSuperAdmin: jest.fn() }));
jest.mock('@/lib/dbHelpers', () => ({ checkResourceBelongsToBiz: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/staffApplicationApprovalService', () => ({ isBusinessOwner: jest.fn(async () => true) }));
jest.mock('@/lib/rateLimit', () => ({ RateLimitConfigs: { normal: {} }, withRateLimit: (_req: Request, _config: unknown, next: () => unknown) => next() }));

const actions = [
    { name: 'owner contacts', path: '/api/dashboard/contact-settings', handler: updateContacts },
    { name: 'admin branch', path: '/admin/api/businesses/biz-1/branches/branch-1/update', handler: updateAdminBranch },
    { name: 'admin business', path: '/admin/api/businesses/biz-1/update', handler: updateBusiness },
    { name: 'owner branch', path: '/api/branches/branch-1/update', handler: updateOwnerBranch },
];

describe.each(actions)('$name update boundary', ({ handler, path }) => {
    const admin = { from: jest.fn() };
    const update = jest.fn();
    beforeEach(() => {
        jest.resetAllMocks();
        const supabase = {
            auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'actor' } }, error: null })) },
            rpc: jest.fn(async () => ({ data: true, error: null })),
        };
        (createServerClient as jest.Mock).mockReturnValue(supabase);
        (createClient as jest.Mock).mockReturnValue(admin);
        (getServiceClient as jest.Mock).mockReturnValue(admin);
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ supabase, userId: 'actor', bizId: 'biz-1' });
        (requireCurrentSuperAdmin as jest.Mock).mockResolvedValue({ ok: true, user: { id: 'actor' } });
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({ data: { id: 'branch-1', biz_id: 'biz-1' }, error: null });
        const result = { data: { id: 'biz-1', slug: 'business', contact_email: 'new@example.com' }, error: null };
        const query = {
            update, eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => result), single: jest.fn(async () => result),
            then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        };
        update.mockReturnValue(query); admin.from.mockReturnValue(query);
    });
    function send(body: string) {
        return handler(new Request(`http://localhost${path}`, { method: 'POST', body }), {
            params: Promise.resolve({ id: path.startsWith('/api/branches') ? 'branch-1' : 'biz-1', branchId: 'branch-1' }),
        });
    }
    test.each(['{', 'null', '[]', '{}', '{"contact_email":false}'])('rejects %s before mutation', async (body) => {
        const response = await send(body);
        expect(response.status).toBe(400);
        expect(update).not.toHaveBeenCalled();
    });
    test('one-field patch leaves other contacts, activity, address and coordinates untouched', async () => {
        const response = await send('{"contact_email":" NEW@EXAMPLE.COM "}');
        expect(response.status).toBe(200);
        expect(update).toHaveBeenCalledTimes(1);
        expect(update).toHaveBeenCalledWith({ contact_email: 'new@example.com' });
    });
});

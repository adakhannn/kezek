jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn(async () => ({ get: () => undefined })) }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { GET as usersList } from '@/app/admin/api/users/list/route';
import { POST as updateUser } from '@/app/admin/api/users/[id]/update-basic/route';
import { POST as deleteUser } from '@/app/admin/api/users/[id]/delete/route';
import { POST as suspendUser } from '@/app/admin/api/users/[id]/suspend/route';
import { POST as toggleSuper } from '@/app/admin/api/users/[id]/toggle-super/route';
import { POST as createRole } from '@/app/admin/api/roles/create/route';
import { GET as listRoles } from '@/app/admin/api/roles/list/route';
import { POST as updateRole } from '@/app/admin/api/roles/[id]/update/route';
import { POST as deleteRole } from '@/app/admin/api/roles/[id]/delete/route';
import { GET as getRatingConfig, POST as setRatingConfig } from '@/app/admin/api/rating-config/route';
import { GET as systemHealth } from '@/app/admin/api/system-health/route';
import { runInitializeRatingsHttp } from '@/lib/initializeRatingsHttpService';
import { runRatingsDebugEntitiesHttp } from '@/lib/ratingsDebugEntitiesHttpService';
import { runRatingsManualRecalculateHttp } from '@/lib/ratingsManualRecalculateHttpService';

const routes = [
    ['list users', usersList], ['update user', updateUser], ['delete user', deleteUser], ['suspend user', suspendUser],
    ['toggle super', toggleSuper], ['create role', createRole], ['list roles', listRoles], ['update role', updateRole],
    ['delete role', deleteRole], ['read rating config', getRatingConfig], ['write rating config', setRatingConfig],
    ['system health', systemHealth], ['initialize ratings', runInitializeRatingsHttp],
    ['ratings debug', runRatingsDebugEntitiesHttp], ['recalculate ratings', runRatingsManualRecalculateHttp],
] as const;

describe.each(routes)('%s current-user role isolation', (_name, handler) => {
    test('another global administrator never grants access to the ordinary caller', async () => {
        jest.clearAllMocks();
        const filters = new Map<string, unknown>();
        const query = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn((column: string, value: unknown) => { filters.set(column, value); return query; }),
            is: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(async () => ({
                data: filters.get('user_id') === 'ordinary-user' ? null : { role_key: 'super_admin', biz_id: null, user_id: 'someone-else' },
                error: null,
            })),
        };
        const client = { auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'ordinary-user' } }, error: null })) }, from: jest.fn(() => query), rpc: jest.fn().mockResolvedValue({ data: false, error: null }) };
        const privileged = { from: jest.fn(), rpc: jest.fn(), auth: { admin: { updateUserById: jest.fn(), deleteUser: jest.fn() } } };
        jest.mocked(createServerClient).mockReturnValue(client as never);
        jest.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
        jest.mocked(createClient).mockReturnValue(privileged as never);
        jest.mocked(getServiceClient).mockReturnValue(privileged as never);
        const invoke = handler as (req: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
        const response = await invoke(new Request('http://localhost/admin/api/test', { method: 'POST', body: '{}' }), {
            params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }),
        });
        expect(response.status).toBe(403);
        expect(client.rpc).toHaveBeenCalledWith('is_super_admin');
        expect(client.from).not.toHaveBeenCalled();
        expect(privileged.from).not.toHaveBeenCalled();
        expect(privileged.rpc).not.toHaveBeenCalled();
        expect(privileged.auth.admin.updateUserById).not.toHaveBeenCalled();
        expect(privileged.auth.admin.deleteUser).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

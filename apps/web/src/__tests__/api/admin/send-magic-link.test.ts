jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn(), createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/env', () => ({ getSiteOrigin: () => 'https://kezek.vercel.app' }));
import { POST } from '@/app/admin/api/users/[id]/send-magic-link/route';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

const target = '22222222-2222-4222-8222-222222222222';
const caller = { auth: { getUser: jest.fn() }, rpc: jest.fn() };
const admin = { auth: { admin: { getUserById: jest.fn(), generateLink: jest.fn() } } };
// Next.js 15+ hands route params over as a Promise.
const request = (id = target) => POST(new Request(`https://example.invalid/admin/api/users/${id}/send-magic-link`, { method: 'POST' }),
    { params: Promise.resolve({ id }) });

beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(createSupabaseServerClient).mockResolvedValue(caller as never);
    jest.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
    caller.auth.getUser.mockResolvedValue({ data: { user: { id: 'actor' } } });
    caller.rpc.mockResolvedValue({ data: true, error: null });
    admin.auth.admin.getUserById.mockResolvedValue({ data: { user: { email: 'user@example.invalid' } }, error: null });
    admin.auth.admin.generateLink.mockResolvedValue({ data: { properties: { action_link: 'https://link.example.invalid' } }, error: null });
});

test('resolves the async route param and redirects to the configured origin', async () => {
    const response = await request();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, link: 'https://link.example.invalid' });
    expect(admin.auth.admin.getUserById).toHaveBeenCalledWith(target);
    expect(admin.auth.admin.generateLink).toHaveBeenCalledWith({
        type: 'magiclink',
        email: 'user@example.invalid',
        options: { redirectTo: 'https://kezek.vercel.app/auth/callback?next=/admin' },
    });
});

test('rejects a malformed id before any auth or privileged work', async () => {
    expect((await request('not-a-uuid')).status).toBe(400);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

test('requires a signed-in super admin', async () => {
    caller.auth.getUser.mockResolvedValue({ data: { user: null } });
    expect((await request()).status).toBe(401);

    caller.auth.getUser.mockResolvedValue({ data: { user: { id: 'actor' } } });
    caller.rpc.mockResolvedValue({ data: false, error: null });
    expect((await request()).status).toBe(403);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

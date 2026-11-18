jest.mock('server-only', () => ({}), { virtual: true });

const mockCreateServerClient = jest.fn();
const mockGetUserRoleProfile = jest.fn();
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: () => mockCreateServerClient() }));
jest.mock('@/lib/authContext', () => ({ getUserRoleProfile: (client: unknown) => mockGetUserRoleProfile(client) }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn() }));

import { logWarn } from '@/lib/log';
import { getShellViewer } from '@/lib/shellViewer';

type Profile = { full_name: string | null; telegram_id: number | null; telegram_verified: boolean | null } | null;

function client(user: Record<string, unknown> | null, profile: Profile, profileError: unknown = null) {
    const maybeSingle = jest.fn().mockResolvedValue({ data: profile, error: profileError });
    const eq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq }));
    return {
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
        from: jest.fn(() => ({ select })),
        select,
    };
}
const roleProfile = (overrides: Record<string, unknown> = {}) => ({
    isSuperAdmin: false, canDashboard: false, canStaff: false, canAdmin: false, canCabinet: true, ...overrides,
});

beforeEach(() => jest.clearAllMocks());

test('an invalid Supabase configuration is "unavailable", a missing session is "anonymous"', async () => {
    mockCreateServerClient.mockRejectedValueOnce(new Error('bad env'));
    await expect(getShellViewer()).resolves.toEqual({ status: 'unavailable' });
    expect(logWarn).toHaveBeenCalled();

    mockCreateServerClient.mockResolvedValueOnce(client(null, null));
    await expect(getShellViewer()).resolves.toEqual({ status: 'anonymous' });
    expect(mockGetUserRoleProfile).not.toHaveBeenCalled();
});

test('one profile query gives the label and the reminder; roles come from the role profile', async () => {
    const supabase = client({ id: 'u1', email: 'u1@example.test' }, { full_name: '  Aida ', telegram_id: null, telegram_verified: null });
    mockCreateServerClient.mockResolvedValueOnce(supabase);
    mockGetUserRoleProfile.mockResolvedValueOnce(roleProfile({ canDashboard: true, canStaff: true }));

    await expect(getShellViewer()).resolves.toEqual({
        status: 'signed-in',
        userId: 'u1',
        accountLabel: 'Aida',
        roles: { hasDashboard: true, hasStaff: true, hasCabinet: true, hasAdmin: false },
        reminder: 'telegram',
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.select).toHaveBeenCalledWith('full_name, telegram_id, telegram_verified');
});

test('a missing name wins over Telegram and the label falls back to e-mail, then phone', async () => {
    mockCreateServerClient.mockResolvedValueOnce(client({ id: 'u2', email: 'u2@example.test' }, { full_name: ' ', telegram_id: null, telegram_verified: null }));
    mockGetUserRoleProfile.mockResolvedValueOnce(roleProfile());
    await expect(getShellViewer()).resolves.toMatchObject({ accountLabel: 'u2@example.test', reminder: 'name' });

    mockCreateServerClient.mockResolvedValueOnce(client({ id: 'u3', phone: '996500000000' }, null));
    mockGetUserRoleProfile.mockResolvedValueOnce(roleProfile());
    await expect(getShellViewer()).resolves.toMatchObject({ accountLabel: '996500000000', reminder: 'name' });
});

test('no reminder for a linked account, the platform admin, or when the profile could not be read', async () => {
    mockCreateServerClient.mockResolvedValueOnce(client({ id: 'u4' }, { full_name: 'Name', telegram_id: 42, telegram_verified: true }));
    mockGetUserRoleProfile.mockResolvedValueOnce(roleProfile());
    await expect(getShellViewer()).resolves.toMatchObject({ reminder: null });

    mockCreateServerClient.mockResolvedValueOnce(client({ id: 'u5' }, { full_name: null, telegram_id: null, telegram_verified: null }));
    mockGetUserRoleProfile.mockResolvedValueOnce(roleProfile({ isSuperAdmin: true, canAdmin: true }));
    await expect(getShellViewer()).resolves.toMatchObject({ reminder: null, roles: { hasAdmin: true } });

    mockCreateServerClient.mockResolvedValueOnce(client({ id: 'u6', email: 'u6@example.test' }, null, { message: 'timeout' }));
    mockGetUserRoleProfile.mockResolvedValueOnce(roleProfile());
    await expect(getShellViewer()).resolves.toMatchObject({ reminder: null, accountLabel: 'u6@example.test' });
    expect(logWarn).toHaveBeenCalledWith('ShellViewer', 'Profile lookup failed', { message: 'timeout' });
});

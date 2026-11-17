jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
import { getServiceClient } from '@/lib/supabaseService';
import { runUsersSearch } from '@/lib/usersSearchService';

type Row = Record<string, unknown>;
const account = { id: 'client-1', email: 'known@example.test', phone: '996555000111', full_name: 'Provider Name' };

function setup(options: {
    exact?: Row[];
    exactError?: object | null;
    bookings?: Row[];
    accounts?: Row[];
    profiles?: Row[];
    profileError?: object | null;
    staff?: Row[];
} = {}) {
    const bookingsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: options.bookings ?? [], error: null }),
    };
    const accountsQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: options.accounts ?? [], error: null }),
    };
    const profilesQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
            data: options.profiles ?? [{ id: 'client-1', full_name: ' Edited Profile Name ' }],
            error: options.profileError ?? null,
        }),
    };
    const tables: Record<string, unknown> = { bookings: bookingsQuery, auth_users_view: accountsQuery, profiles: profilesQuery };
    const admin = {
        auth: { admin: { listUsers: jest.fn() } },
        rpc: jest.fn().mockResolvedValue({ data: options.exact ?? [], error: options.exactError ?? null }),
        from: jest.fn((table: string) => tables[table]),
    };
    const staffQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({ data: options.staff ?? [], error: null }),
    };
    const supabase = { from: jest.fn(() => staffQuery) };
    jest.mocked(getServiceClient).mockReturnValue(admin as never);
    return { admin, supabase, bookingsQuery, accountsQuery, profilesQuery, staffQuery };
}

const search = (c: ReturnType<typeof setup>, q: string | undefined, page = 1, perPage = 50) =>
    runUsersSearch({ supabase: c.supabase, bizId: 'biz-1', input: { q, page, perPage } });

beforeEach(() => jest.clearAllMocks());

test.each([undefined, '', '   ', '\t\n'])('blank query %j never loads accounts', async (q) => {
    const c = setup();
    expect((await search(c, q)).items).toEqual([]);
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(c.supabase.from).not.toHaveBeenCalled();
});

test('a complete e-mail finds the account with that confirmed e-mail, never the Auth directory', async () => {
    const c = setup({ exact: [account] });
    const result = await search(c, ' Known@Example.test ');
    expect(c.admin.rpc).toHaveBeenCalledWith('find_accounts_by_contact', { p_email: 'Known@Example.test' });
    expect(result.items).toEqual([{ id: 'client-1', email: account.email, phone: account.phone, full_name: 'Edited Profile Name' }]);
    expect(c.profilesQuery.in).toHaveBeenCalledWith('id', ['client-1']);
    expect(c.admin.auth.admin.listUsers).not.toHaveBeenCalled();
    expect(c.admin.from).not.toHaveBeenCalledWith('bookings');
});

test.each([
    ['+996 555 000 111', '996555000111'],
    ['996555000111', '996555000111'],
    ['0555 000-111', '996555000111'],
    ['(0555) 000 111', '996555000111'],
])('a complete phone %j is matched as %j', async (q, digits) => {
    const c = setup({ exact: [account] });
    await search(c, q);
    expect(c.admin.rpc).toHaveBeenCalledWith('find_accounts_by_contact', { p_phone_digits: digits });
});

test.each(['@@', 'a@b', '555', 'known@', 'Edited'])('partial text %j searches only the business clients', async (q) => {
    const c = setup({ bookings: [{ client_id: 'client-1' }], accounts: [account] });
    await search(c, q);
    expect(c.admin.rpc).not.toHaveBeenCalled();
    expect(c.admin.auth.admin.listUsers).not.toHaveBeenCalled();
    expect(c.bookingsQuery.eq).toHaveBeenCalledWith('biz_id', 'biz-1');
    expect(c.accountsQuery.in).toHaveBeenCalledWith('id', ['client-1']);
});

test('business clients match by e-mail, name or phone digits', async () => {
    const other = { id: 'client-2', email: 'other@example.test', phone: null, full_name: 'Someone' };
    const c = setup({
        bookings: [{ client_id: 'client-1' }, { client_id: 'client-2' }, { client_id: 'client-1' }, { client_id: null }],
        accounts: [account, other],
        profiles: [],
    });
    expect((await search(c, 'provider')).items.map((item) => item.id)).toEqual(['client-1']);
    expect(c.accountsQuery.in).toHaveBeenCalledWith('id', ['client-1', 'client-2']);
    expect((await search(c, '000 111')).items.map((item) => item.id)).toEqual(['client-1']);
    expect((await search(c, 'OTHER@')).items.map((item) => item.id)).toEqual(['client-2']);
    expect((await search(c, 'nobody')).items).toEqual([]);
});

test.each(['a', '@', '+'])('a single character %j finds nothing and reads nothing', async (q) => {
    const c = setup({ bookings: [{ client_id: 'client-1' }], accounts: [account] });
    expect((await search(c, q)).items).toEqual([]);
    expect(c.admin.from).not.toHaveBeenCalled();
    expect(c.admin.rpc).not.toHaveBeenCalled();
});

test('a business without clients skips the account lookup', async () => {
    const c = setup({ bookings: [] });
    expect((await search(c, 'edited')).items).toEqual([]);
    expect(c.admin.from).not.toHaveBeenCalledWith('auth_users_view');
});

test.each([{ profiles: [] }, { profiles: [{ id: 'client-1', full_name: null }] }, { profiles: [{ id: 'client-1', full_name: ' ' }] }])(
    'falls back to the Auth name with missing or blank profile %j',
    async ({ profiles }) => {
        const c = setup({ exact: [account], profiles });
        expect((await search(c, 'known@example.test')).items[0]?.full_name).toBe('Provider Name');
    },
);

test('leaves out staff of the current business', async () => {
    const c = setup({ exact: [account], staff: [{ user_id: 'client-1' }, { user_id: null }] });
    expect((await search(c, 'known@example.test')).items).toEqual([]);
    expect(c.staffQuery.eq).toHaveBeenCalledWith('biz_id', 'biz-1');
});

test('pages the matches', async () => {
    const accounts = ['a', 'b', 'c'].map((id) => ({ id, email: `${id}@example.test`, phone: null, full_name: `Name ${id}` }));
    const c = setup({ bookings: accounts.map((a) => ({ client_id: a.id })), accounts, profiles: [] });
    const result = await search(c, 'example', 2, 2);
    expect(result).toEqual({ items: [{ id: 'c', email: 'c@example.test', phone: null, full_name: 'Name c' }], page: 2, perPage: 2 });
});

test('lookup and profile failures are explicit instead of a false no-match', async () => {
    await expect(search(setup({ exactError: { message: 'offline' } }), 'known@example.test')).rejects.toThrow('User lookup unavailable');
    await expect(search(setup({ exact: [account], profileError: { message: 'offline' } }), 'known@example.test'))
        .rejects.toThrow('Client profile names unavailable');
});

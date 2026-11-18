jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn(), createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/senders/email', () => ({ sendEmailPassword: jest.fn() }));
jest.mock('@/lib/senders/sms', () => ({ sendSMS: jest.fn() }));

import { POST } from '@/app/admin/api/businesses/[id]/members/add/route';
import { contactPhoneDigits, findAccountIdByConfirmedContact } from '@/lib/accountContactLookup';
import { sendEmailPassword } from '@/lib/senders/email';
import { sendSMS } from '@/lib/senders/sms';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

const BIZ = '11111111-1111-4111-8111-111111111111';

function setup(accounts: Array<{ id: string }>) {
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'super-admin' } } }) },
        rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    });
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const admin = {
        rpc: jest.fn().mockResolvedValue({ data: accounts, error: null }),
        from: jest.fn((table: string) => (table === 'roles'
            ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'role-manager' }, error: null }) }) }) }
            : { upsert })),
        auth: {
            admin: {
                listUsers: jest.fn(),
                createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null }),
                updateUserById: jest.fn().mockResolvedValue({ error: null }),
            },
        },
    };
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(admin);
    return { admin, upsert };
}

const add = (body: Record<string, unknown>) => POST(
    new Request(`http://localhost/admin/api/businesses/${BIZ}/members/add`, { method: 'POST', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: BIZ }) },
);

describe('POST /admin/api/businesses/[id]/members/add (ARCH-03)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('the account is found by a confirmed contact only, with one phone normalization', async () => {
        const { admin, upsert } = setup([{ id: 'confirmed-user' }]);

        const response = await add({ email: 'Owner@Example.com', phone: '0555 12-34-56', role_key: 'manager' });

        expect(response.status).toBe(200);
        expect(admin.rpc).toHaveBeenCalledWith('find_accounts_by_contact', { p_email: 'Owner@Example.com', p_phone_digits: '996555123456' });
        expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
        expect(upsert).toHaveBeenCalledWith({ user_id: 'confirmed-user', role_id: 'role-manager', biz_id: BIZ }, { onConflict: 'user_id,role_id,biz_id' });
    });

    test('an existing account keeps its password: no reset, nothing sent', async () => {
        const { admin } = setup([{ id: 'confirmed-user' }]);

        const response = await add({ email: 'owner@example.com', role_key: 'manager', sendTempPassword: true });
        const body = await response.json();

        expect(body).toMatchObject({ ok: true, created_user: false, sent_temp_email: false, temp_password_skipped: 'existing_account' });
        expect(admin.auth.admin.updateUserById).not.toHaveBeenCalledWith('confirmed-user', expect.objectContaining({ password: expect.anything() }));
        expect(sendEmailPassword).not.toHaveBeenCalled();
    });

    test('a new account gets its creation password once, at the normalized phone', async () => {
        const { admin } = setup([]);

        const response = await add({ phone: '0555 12-34-56', role_key: 'manager', sendTempPassword: true });
        const body = await response.json();

        expect(body).toMatchObject({ ok: true, created_user: true, sent_temp_sms: true });
        const created = admin.auth.admin.createUser.mock.calls[0][0] as { phone: string; password: string };
        expect(created.phone).toBe('+996555123456');
        expect(sendSMS).toHaveBeenCalledWith({ to: '+996555123456', text: `Ваш временный пароль: ${created.password}` });
        expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
    });
});

describe('findAccountIdByConfirmedContact', () => {
    test('one account or nothing: never a guess between two accounts', async () => {
        const rpc = jest.fn()
            .mockResolvedValueOnce({ data: [{ id: 'a' }], error: null })
            .mockResolvedValueOnce({ data: [{ id: 'a' }, { id: 'b' }], error: null })
            .mockResolvedValueOnce({ data: [], error: null });

        await expect(findAccountIdByConfirmedContact({ rpc } as never, { email: 'a@example.com' })).resolves.toBe('a');
        await expect(findAccountIdByConfirmedContact({ rpc } as never, { email: 'a@example.com', phone: '+996555123456' })).resolves.toBeNull();
        await expect(findAccountIdByConfirmedContact({ rpc } as never, { phone: '+996555123456' })).resolves.toBeNull();
        await expect(findAccountIdByConfirmedContact({ rpc } as never, { email: ' ', phone: 'abc' })).resolves.toBeNull();
        expect(rpc).toHaveBeenCalledTimes(3);
    });

    test('phone digits as auth.users stores them', () => {
        expect(contactPhoneDigits('0555 12-34-56')).toBe('996555123456');
        expect(contactPhoneDigits('+996 (555) 123-456')).toBe('996555123456');
        expect(contactPhoneDigits('12')).toBeNull();
    });
});

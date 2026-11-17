import { findWhatsAppOwnerByPhone } from '@/lib/whatsAppIdentityOwnershipService';

function profileQuery(linked: Array<{ id: string }>) {
    return {
        select: jest.fn().mockReturnValue({
            eq() {
                return this;
            },
            limit: jest.fn(async () => ({ data: linked, error: null })),
        }),
    };
}

function adminWith({ linked = [], confirmed = [] }: { linked?: Array<{ id: string }>; confirmed?: Array<{ id: string }> }) {
    return {
        from: jest.fn(() => profileQuery(linked)),
        rpc: jest.fn().mockResolvedValue({ data: confirmed, error: null }),
    };
}

describe('findWhatsAppOwnerByPhone (API-03)', () => {
    test('prefers the profile that linked the number through a WhatsApp OTP', async () => {
        const admin = adminWith({ linked: [{ id: 'linked-owner' }], confirmed: [{ id: 'other' }] });

        await expect(findWhatsAppOwnerByPhone(admin as never, '+996555123456')).resolves.toBe('linked-owner');
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    test('falls back to the Auth account whose phone is confirmed', async () => {
        const admin = adminWith({ confirmed: [{ id: 'confirmed-owner' }] });

        await expect(findWhatsAppOwnerByPhone(admin as never, '996 555 123 456')).resolves.toBe('confirmed-owner');
        expect(admin.rpc).toHaveBeenCalledWith('find_accounts_by_contact', { p_phone_digits: '996555123456' });
    });

    test('an unconfirmed or self-written phone is not an owner', async () => {
        // The lookup no longer pages through Auth users, so metadata and unconfirmed phones are never read.
        const admin = { ...adminWith({}), auth: { admin: { listUsers: jest.fn() } } };

        await expect(findWhatsAppOwnerByPhone(admin as never, '+996555123456')).resolves.toBeNull();
        expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    });

    test('a lookup failure is not mistaken for "no owner"', async () => {
        const admin = { from: jest.fn(() => profileQuery([])), rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'down' } }) };

        await expect(findWhatsAppOwnerByPhone(admin as never, '+996555123456')).rejects.toEqual({ message: 'down' });
    });

    test('an invalid number has no owner', async () => {
        const admin = adminWith({ linked: [{ id: 'x' }] });

        await expect(findWhatsAppOwnerByPhone(admin as never, 'not a phone')).resolves.toBeNull();
        expect(admin.from).not.toHaveBeenCalled();
    });
});

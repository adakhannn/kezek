import { findWhatsAppOwnerByPhone } from '@/lib/whatsAppIdentityOwnershipService';

function profileQuery(rowsByField: Record<string, Array<{ id: string }>>) {
    let field = '';
    return {
        select: jest.fn().mockReturnValue({
            eq(column: string) {
                if (!field) field = column;
                return this;
            },
            limit: jest.fn(async () => ({ data: rowsByField[field] ?? [], error: null })),
        }),
    };
}

describe('findWhatsAppOwnerByPhone', () => {
    test('normalizes Auth phone and metadata values', async () => {
        const admin = {
            auth: { admin: { listUsers: jest.fn().mockResolvedValue({ data: { users: [
                { id: 'owner', phone: null, user_metadata: { phone: '996 555 123 456' } },
            ] }, error: null }) } },
            from: jest.fn().mockImplementation(() => profileQuery({
                whatsapp_phone: [],
            })),
        };

        await expect(findWhatsAppOwnerByPhone(admin as never, '+996555123456')).resolves.toBe('owner');
    });

    test('prefers the explicitly linked profile over a stale phone-only auth user', async () => {
        const admin = {
            auth: { admin: { listUsers: jest.fn().mockResolvedValue({ data: { users: [
                { id: 'stale-auth-user', phone: '+996555123456' },
            ] }, error: null }) } },
            from: jest.fn().mockImplementation(() => profileQuery({
                whatsapp_phone: [{ id: 'linked-profile-owner' }],
            })),
        };

        await expect(findWhatsAppOwnerByPhone(admin as never, '+996555123456'))
            .resolves.toBe('linked-profile-owner');
        expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    });

    test('finds an owner stored in the legacy verified profile phone field', async () => {
        const admin = {
            auth: { admin: { listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }) } },
            from: jest.fn().mockImplementation(() => profileQuery({
                whatsapp_phone: [],
                phone: [{ id: 'legacy-owner' }],
            })),
        };

        await expect(findWhatsAppOwnerByPhone(admin as never, '+996555123456')).resolves.toBe('legacy-owner');
    });
});

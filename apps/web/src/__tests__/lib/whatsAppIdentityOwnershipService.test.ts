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
            from: jest.fn(),
        };

        await expect(findWhatsAppOwnerByPhone(admin as never, '+996555123456')).resolves.toBe('owner');
        expect(admin.from).not.toHaveBeenCalled();
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

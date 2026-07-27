import { resolveBusinessCategory, submitBusinessApplication } from '@/lib/businessApplicationService';

function createAdmin(options?: { duplicate?: boolean }) {
    const duplicateQuery = {
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: options?.duplicate ? { id: 'existing' } : null, error: null }),
    };
    const insertQuery = {
        insert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'application-id' }, error: null }),
    };
    return { admin: { from: jest.fn().mockReturnValueOnce(duplicateQuery).mockReturnValueOnce(insertQuery) }, insertQuery };
}

describe('businessApplicationService', () => {
    test('accepts a guest application and normalizes the phone', async () => {
        const { admin, insertQuery } = createAdmin();
        const result = await submitBusinessApplication({
            admin: admin as never,
            input: {
                contact_name: ' Ada ',
                phone: '996 555 123 456',
                business_name: ' Salon ',
                email: 'ADA@EXAMPLE.COM',
                city: ' Ош ',
            },
        });
        expect(result).toEqual({ ok: true, id: 'application-id' });
        expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            applicant_user_id: null,
            contact_name: 'Ada',
            phone: '+996555123456',
            business_name: 'Salon',
            email: 'ada@example.com',
            city: 'Ош',
        }));
    });

    test('links an authenticated application to the user', async () => {
        const { admin, insertQuery } = createAdmin();
        await submitBusinessApplication({
            admin: admin as never,
            userId: 'user-id',
            input: {
                contact_name: 'Ada',
                phone: '+996555123456',
                business_name: 'Salon',
                email: 'ada@example.com',
                city: 'Ош',
            },
        });
        expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ applicant_user_id: 'user-id' }));
    });

    test('rejects a recent duplicate phone', async () => {
        const { admin } = createAdmin({ duplicate: true });
        const result = await submitBusinessApplication({
            admin: admin as never,
            input: {
                contact_name: 'Ada',
                phone: '+996555123456',
                business_name: 'Salon',
                email: 'ada@example.com',
                city: 'Ош',
            },
        });
        expect(result).toMatchObject({ ok: false, status: 409, code: 'recent_duplicate' });
    });

    test('requires email and city', async () => {
        const { admin } = createAdmin();
        const result = await submitBusinessApplication({
            admin: admin as never,
            input: {
                contact_name: 'Ada',
                phone: '+996555123456',
                business_name: 'Salon',
            },
        });

        expect(result).toMatchObject({ ok: false, status: 400, code: 'required_fields' });
        expect(admin.from).not.toHaveBeenCalled();
    });

    test('resolves an existing category by slug', async () => {
        const query = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
                data: [{ slug: 'barbershop', name_ru: 'Барбершоп', is_active: true }],
                error: null,
            }),
        };

        await expect(resolveBusinessCategory({ from: jest.fn(() => query) } as never, 'barbershop'))
            .resolves.toBe('barbershop');
    });

    test('requires moderation before an unknown proposed category can be approved', async () => {
        const query = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
                data: [{ slug: 'barbershop', name_ru: 'Барбершоп', is_active: true }],
                error: null,
            }),
        };

        await expect(resolveBusinessCategory({ from: jest.fn(() => query) } as never, 'Груминг-салон'))
            .rejects.toThrow('Сначала добавьте предложенную категорию');
    });
});

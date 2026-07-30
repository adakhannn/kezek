import {
    approveBusinessApplicationAndCreateBusiness,
    resolveBusinessCategory,
    submitBusinessApplication,
} from '@/lib/businessApplicationService';

function createAdmin(options?: { duplicate?: boolean; existingBusinessName?: string }) {
    const businessLookupQuery = {
        select: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
            data: options?.existingBusinessName
                ? [{ id: 'business-id', name: options.existingBusinessName, slug: 'salon' }]
                : [],
            error: null,
        }),
    };
    const duplicateQuery = {
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: options?.duplicate ? { id: 'existing' } : null, error: null }),
    };
    const insertQuery = {
        insert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: 'application-id' }, error: null }),
    };
    const admin = {
        from: jest.fn((table: string) => {
            if (table === 'businesses') return businessLookupQuery;
            if (table === 'business_registration_applications') {
                return duplicateQuery.maybeSingle.mock.calls.length === 0 ? duplicateQuery : insertQuery;
            }
            throw new Error(`Unexpected table: ${table}`);
        }),
    };
    return { admin, insertQuery, businessLookupQuery };
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
            },
        });
        expect(result).toEqual({ ok: true, id: 'application-id' });
        expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            applicant_user_id: null,
            contact_name: 'Ada',
            phone: '+996555123456',
            business_name: 'Salon',
            email: 'ada@example.com',
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
            },
        });
        expect(result).toMatchObject({ ok: false, status: 409, code: 'recent_duplicate' });
    });

    test('rejects an application when the business already exists', async () => {
        const { admin, insertQuery } = createAdmin({ existingBusinessName: 'Test Business' });
        const result = await submitBusinessApplication({
            admin: admin as never,
            input: {
                contact_name: 'Ada',
                phone: '+996555123456',
                business_name: '  TEST   Business ',
                email: 'ada@example.com',
            },
        });

        expect(result).toMatchObject({ ok: false, status: 409, code: 'business_exists' });
        expect(insertQuery.insert).not.toHaveBeenCalled();
    });

    test('requires email without requiring a city', async () => {
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

    test('does not store a legacy client-provided city', async () => {
        const { admin, insertQuery } = createAdmin();
        await submitBusinessApplication({
            admin: admin as never,
            input: {
                contact_name: 'Ada',
                phone: '+996555123456',
                business_name: 'Salon',
                email: 'ada@example.com',
                city: 'Бишкек',
            } as never,
        });

        expect(insertQuery.insert.mock.calls[0][0]).not.toHaveProperty('city');
    });

    test('does not turn the legacy application city into a business address', async () => {
        const createBusiness = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'business-id' }, error: null }),
            }),
        });
        let applicationCalls = 0;
        let businessCalls = 0;
        const admin = {
            from: jest.fn((table: string) => {
                if (table === 'business_registration_applications') {
                    applicationCalls += 1;
                    if (applicationCalls === 1) {
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            maybeSingle: jest.fn().mockResolvedValue({
                                data: {
                                    id: 'application-id',
                                    applicant_user_id: 'user-id',
                                    phone: '+996555123456',
                                    business_name: 'Salon',
                                    city: 'Ош',
                                    category: 'barbershop',
                                    created_business_id: null,
                                },
                                error: null,
                            }),
                        };
                    }
                    return {
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ error: null }),
                        }),
                    };
                }
                if (table === 'businesses') {
                    businessCalls += 1;
                    if (businessCalls === 1) {
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            limit: jest.fn().mockReturnThis(),
                            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                        };
                    }
                    return { insert: createBusiness };
                }
                if (table === 'categories') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        order: jest.fn().mockResolvedValue({
                            data: [{ slug: 'barbershop', name_ru: 'Барбершоп', is_active: true }],
                            error: null,
                        }),
                    };
                }
                if (table === 'roles') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'owner-role' }, error: null }),
                    };
                }
                if (table === 'user_roles') {
                    return { insert: jest.fn().mockResolvedValue({ error: null }) };
                }
                throw new Error(`Unexpected table: ${table}`);
            }),
        };

        const result = await approveBusinessApplicationAndCreateBusiness({
            admin: admin as never,
            applicationId: 'application-id',
            reviewerUserId: 'reviewer-id',
        });

        expect(result).toMatchObject({ ok: true, businessId: 'business-id' });
        expect(createBusiness.mock.calls[0][0]).not.toHaveProperty('address');
        expect(createBusiness.mock.calls[0][0]).not.toHaveProperty('city_id');
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

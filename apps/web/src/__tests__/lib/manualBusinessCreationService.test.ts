import { createManualBusiness } from '@/lib/manualBusinessCreationService';

type Outcome = { data?: unknown; error?: { message: string; code?: string } | null };

function createBuilder(outcome: Outcome) {
    const builder: Record<string, unknown> & PromiseLike<Outcome> = {
        select: () => builder,
        eq: () => builder,
        ilike: () => builder,
        contains: () => builder,
        in: () => builder,
        limit: () => builder,
        insert: () => builder,
        delete: () => builder,
        maybeSingle: () => Promise.resolve(outcome),
        single: () => Promise.resolve(outcome),
        then: (resolve) => Promise.resolve(outcome).then(resolve),
    };
    return builder;
}

function createAdmin(outcomes: Record<string, Outcome[]>) {
    const calls = new Map<string, number>();
    return {
        from: jest.fn((table: string) => {
            const index = calls.get(table) ?? 0;
            calls.set(table, index + 1);
            return createBuilder(outcomes[table]?.[index] ?? { data: null, error: null });
        }),
    };
}

const validInput = {
    name: 'Test Business',
    slug: 'test-business',
    categories: ['barbershop'],
    branch_limit: 1,
    reason: 'Migration from the previous CRM',
    acknowledge_manual: true,
};

describe('createManualBusiness', () => {
    test('requires explicit acknowledgement before touching the database', async () => {
        const admin = createAdmin({});
        const result = await createManualBusiness({
            admin,
            actorUserId: 'admin-1',
            input: { ...validInput, acknowledge_manual: false },
        });

        expect(result).toMatchObject({ ok: false, code: 'acknowledgement_required', status: 400 });
        expect(admin.from).not.toHaveBeenCalled();
    });

    test('returns possible duplicates before inserting', async () => {
        const duplicate = {
            id: 'business-existing',
            name: 'Test Business',
            slug: 'test-business-old',
            phones: null,
        };
        const admin = createAdmin({
            businesses: [
                { data: null, error: null },
                { data: [duplicate], error: null },
            ],
            categories: [{ data: [{ slug: 'barbershop', is_active: true }], error: null }],
        });

        const result = await createManualBusiness({
            admin,
            actorUserId: 'admin-1',
            input: validInput,
        });

        expect(result).toMatchObject({
            ok: false,
            code: 'possible_duplicate',
            status: 409,
            duplicates: [{ id: duplicate.id, matchedBy: ['name'] }],
        });
        expect(admin.from).toHaveBeenCalledTimes(3);
    });

    test('creates an approved ownerless business and records manual context', async () => {
        const admin = createAdmin({
            businesses: [
                { data: null, error: null },
                { data: [], error: null },
                { data: { id: 'business-new' }, error: null },
            ],
            categories: [{ data: [{ slug: 'barbershop', is_active: true }], error: null }],
            business_creation_audit_log: [{ data: null, error: null }],
        });

        const result = await createManualBusiness({
            admin,
            actorUserId: 'admin-1',
            input: validInput,
        });

        expect(result).toEqual({ ok: true, businessId: 'business-new' });
        expect(admin.from).toHaveBeenCalledWith('business_creation_audit_log');
    });

    test('rolls back the business when the context audit cannot be written', async () => {
        const admin = createAdmin({
            businesses: [
                { data: null, error: null },
                { data: [], error: null },
                { data: { id: 'business-new' }, error: null },
                { data: null, error: null },
            ],
            categories: [{ data: [{ slug: 'barbershop', is_active: true }], error: null }],
            business_creation_audit_log: [{ data: null, error: { message: 'audit unavailable' } }],
        });

        const result = await createManualBusiness({
            admin,
            actorUserId: 'admin-1',
            input: validInput,
        });

        expect(result).toMatchObject({ ok: false, code: 'audit_failed', status: 500 });
        expect(admin.from).toHaveBeenLastCalledWith('businesses');
    });
});

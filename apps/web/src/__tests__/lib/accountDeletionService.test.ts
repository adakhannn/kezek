import { assessAccountDeletion, requestAccountDeletion } from '@/lib/accountDeletionService';

function countChain(count: number) {
    const result = { count, error: null };
    const chain = {
        select: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
        gte: jest.fn(),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    return chain;
}

function createAssessmentAdmin(counts: Record<string, number>) {
    return {
        from: jest.fn((table: string) => countChain(counts[table] ?? 0)),
    };
}

describe('accountDeletionService', () => {
    test('returns role-specific blockers for owner, staff, business roles and active bookings', async () => {
        const admin = createAssessmentAdmin({ businesses: 2, user_roles: 1, staff: 1, bookings: 3 });

        const blockers = await assessAccountDeletion(admin as never, 'user-id');

        expect(blockers.map((blocker) => blocker.code)).toEqual([
            'owned_businesses',
            'business_roles',
            'active_staff',
            'active_bookings',
        ]);
    });

    test('requires the explicit Russian confirmation phrase', async () => {
        const result = await requestAccountDeletion({} as never, 'user-id', 'удалить');

        expect(result).toEqual({
            ok: false,
            status: 400,
            message: 'Введите УДАЛИТЬ для подтверждения.',
            code: 'confirmation_required',
        });
    });
});

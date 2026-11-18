import type { StaffInfo } from '../screens/staff/types';

type QueryResult = { data: unknown; error: Error | null; count?: number | null };

type QueryStub = {
    select: jest.Mock;
    eq: jest.Mock;
    order: jest.Mock;
    then: <T>(resolve: (value: QueryResult) => T, reject?: (reason: unknown) => T) => Promise<T>;
};

/**
 * Stub of an awaited Supabase query builder: every filter returns the builder, awaiting it
 * yields the result. Matches the active staff cards query (select, eq, eq, order, order).
 */
export function supabaseQueryStub(result: QueryResult): QueryStub {
    const builder: QueryStub = {
        select: jest.fn(() => builder),
        eq: jest.fn(() => builder),
        order: jest.fn(() => builder),
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
}

export function staffCardsQuery(rows: StaffInfo[], error: Error | null = null) {
    return supabaseQueryStub({ data: error ? null : rows, error });
}

export function staffCard(overrides: Partial<StaffInfo> = {}): StaffInfo {
    return {
        id: 'staff-1',
        full_name: 'Test Staff',
        biz_id: 'biz-1',
        created_at: '2026-01-10T08:00:00.000Z',
        branch: null,
        business: null,
        ...overrides,
    };
}

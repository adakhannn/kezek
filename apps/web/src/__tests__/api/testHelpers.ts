/**
 * Общие утилиты и моки для тестирования API routes
 */

import { NextRequest } from 'next/server';
import { createTelegramMobileBotRequestAuthHeaders } from '@/lib/telegramMobileBotRequestAuth';

/**
 * Создает мок Request для тестирования API routes
 */
export function createMockRequest(
    url: string,
    options?: {
        method?: string;
        body?: unknown;
        headers?: Record<string, string>;
    }
): Request {
    const { method = 'GET', body, headers = {} } = options || {};
    
    const requestInit: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    };

    if (body) {
        requestInit.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    return new Request(url, requestInit);
}

export function createTelegramMobileSignedHeaders(params: {
    secret: string;
    body: unknown;
    now?: number;
    requestId?: string;
}) {
    const bodyRaw =
        typeof params.body === 'string' ? params.body : JSON.stringify(params.body);
    return createTelegramMobileBotRequestAuthHeaders({
        secret: params.secret,
        bodyRaw,
        now: params.now,
        requestId: params.requestId,
    });
}

/**
 * Создает мок NextRequest
 */
export function createMockNextRequest(
    url: string,
    options?: {
        method?: string;
        body?: unknown;
        headers?: Record<string, string>;
    }
): NextRequest {
    return new NextRequest(url, {
        method: options?.method || 'GET',
        headers: options?.headers || {},
        body: options?.body ? JSON.stringify(options.body) : undefined,
    });
}

/**
 * Стандартные моки для Supabase
 * 
 * Используем Record<string, unknown> вместо any для лучшей типизации,
 * но сохраняем гибкость для тестов
 */
type MockSupabaseClient = {
    auth: {
        getUser: jest.Mock;
        signOut: jest.Mock;
        updateUser?: jest.Mock;
        admin?: {
            listUsers: jest.Mock;
            getUserById: jest.Mock;
            updateUserById: jest.Mock;
            createUser: jest.Mock;
            generateLink: jest.Mock;
        };
    };
    from: jest.Mock<MockSupabaseClient>;
    select: jest.Mock<MockSupabaseClient>;
    insert: jest.Mock<MockSupabaseClient>;
    upsert?: jest.Mock<MockSupabaseClient>;
    update: jest.Mock<MockSupabaseClient>;
    delete: jest.Mock<MockSupabaseClient>;
    eq: jest.Mock<MockSupabaseClient>;
    neq: jest.Mock<MockSupabaseClient>;
    gt: jest.Mock<MockSupabaseClient>;
    gte: jest.Mock<MockSupabaseClient>;
    lt: jest.Mock<MockSupabaseClient>;
    lte: jest.Mock<MockSupabaseClient>;
    in: jest.Mock<MockSupabaseClient>;
    like: jest.Mock<MockSupabaseClient>;
    ilike: jest.Mock<MockSupabaseClient>;
    is: jest.Mock<MockSupabaseClient>;
    order: jest.Mock<MockSupabaseClient>;
    limit: jest.Mock<MockSupabaseClient>;
    range: jest.Mock<MockSupabaseClient>;
    single: jest.Mock;
    maybeSingle: jest.Mock;
    csv: jest.Mock;
    geojson: jest.Mock;
    rpc: jest.Mock;
    /** Queries built through this mock's own chain (CI-04); see expectBusinessScoped. */
    queries: RecordedQuery[];
};

/** One query the code built: the table and every builder call after from() (CI-04). */
export type RecordedQuery = { table: string; calls: Array<[method: string, ...args: unknown[]]> };

export function createMockSupabase(): MockSupabaseClient {
    const queries: RecordedQuery[] = [];
    let current: RecordedQuery | undefined;
    // Builder calls are recorded on the query the last from() started. A test that replaces from()
    // with its own chains records nothing; createTableMock records those cases.
    const step = (method: string) => jest.fn((...args: unknown[]) => {
        current?.calls.push([method, ...args]);
        return mockSupabase;
    });
    const mockSupabase: MockSupabaseClient = {
        auth: {
            getUser: jest.fn(),
            signOut: jest.fn(),
            updateUser: jest.fn(),
            admin: {
                listUsers: jest.fn(),
                getUserById: jest.fn(),
                updateUserById: jest.fn(),
                createUser: jest.fn(),
                generateLink: jest.fn(),
            },
        },
        from: jest.fn((table: string) => {
            current = { table, calls: [] };
            queries.push(current);
            return mockSupabase;
        }) as jest.Mock<MockSupabaseClient>,
        select: step('select'),
        insert: step('insert'),
        upsert: step('upsert'),
        update: step('update'),
        delete: step('delete'),
        eq: step('eq'),
        neq: step('neq'),
        gt: step('gt'),
        gte: step('gte'),
        lt: step('lt'),
        lte: step('lte'),
        in: step('in'),
        like: step('like'),
        ilike: step('ilike'),
        is: step('is'),
        order: step('order'),
        limit: step('limit'),
        range: step('range'),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        csv: jest.fn(),
        geojson: jest.fn(),
        rpc: jest.fn(),
        queries,
    };

    return mockSupabase;
}

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

const BUILDER_METHODS = [
    'select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'like', 'ilike',
    'is', 'not', 'or', 'match', 'filter', 'contains', 'order', 'limit', 'range', 'returns',
] as const;

/**
 * A Supabase client whose from(table) answers with `results[table]` (CI-04): a result object, or a
 * function of the recorded query when the answer depends on its filters. Every query is recorded, so a
 * test can check that it is limited to the business (expectBusinessScoped). rpc() and auth are jest.fn.
 */
export function createTableMock(results: Record<string, QueryResult | ((query: RecordedQuery) => QueryResult)> = {}) {
    const queries: RecordedQuery[] = [];
    const answer = (query: RecordedQuery) => {
        const result = results[query.table];
        const value = typeof result === 'function' ? result(query) : result;
        return { data: null, error: null, count: null, ...(value ?? {}) };
    };
    const chain = (query: RecordedQuery) => {
        const builder: Record<string, unknown> = {};
        for (const method of BUILDER_METHODS) {
            builder[method] = jest.fn((...args: unknown[]) => {
                query.calls.push([method, ...args]);
                return builder;
            });
        }
        builder.single = jest.fn(() => {
            query.calls.push(['single']);
            return Promise.resolve(answer(query));
        });
        builder.maybeSingle = jest.fn(() => {
            query.calls.push(['maybeSingle']);
            return Promise.resolve(answer(query));
        });
        builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve(answer(query)).then(resolve, reject);
        return builder;
    };
    return {
        queries,
        from: jest.fn((table: string) => {
            const query: RecordedQuery = { table, calls: [] };
            queries.push(query);
            return chain(query);
        }),
        rpc: jest.fn(),
        auth: {
            getUser: jest.fn(),
            admin: { getUserById: jest.fn(), listUsers: jest.fn(), updateUserById: jest.fn(), createUser: jest.fn(), generateLink: jest.fn() },
        },
    };
}

/**
 * Every recorded query on `table` is limited to the business (CI-04): reads, updates and deletes filter
 * `column` (biz_id by default) by `bizId` with eq() or match(), and inserted or upserted rows carry
 * it. The mocks answer any query, so without this a query that lost its business filter, and would
 * read or change another business's rows through the service role, passes every test.
 */
export function expectBusinessScoped(client: { queries: RecordedQuery[] }, table: string, bizId: string, column = 'biz_id'): void {
    const onTable = client.queries.filter((query) => query.table === table);
    if (onTable.length === 0) throw new Error(`no query on ${table} was recorded`);
    for (const query of onTable) {
        const write = query.calls.find(([method]) => method === 'insert' || method === 'upsert');
        if (write) {
            const rows = Array.isArray(write[1]) ? write[1] : [write[1]];
            for (const row of rows) {
                if ((row as Record<string, unknown> | null)?.[column] !== bizId) {
                    throw new Error(`${table}: a written row is not for business ${bizId}: ${JSON.stringify(row)}`);
                }
            }
            continue;
        }
        const scoped = query.calls.some(([method, first, second]) =>
            (method === 'eq' && first === column && second === bizId)
            || (method === 'match' && (first as Record<string, unknown> | null)?.[column] === bizId));
        if (!scoped) throw new Error(`${table}: a query without ${column} = ${bizId}: ${JSON.stringify(query.calls)}`);
    }
}

/**
 * Проверяет стандартный формат ответа об ошибке
 */
const LEGACY_ERROR_CODE_MAP: Record<string, string> = {
    // Старые символические коды → новые краткие значения поля error
    AUTH: 'auth',
    UNAUTHORIZED: 'auth',
    BAD_REQUEST: 'validation',
    BOOKING_NOT_FOUND: 'not_found',
    FORBIDDEN: 'forbidden',
    INTERNAL: 'internal',
    NAME_REQUIRED: 'validation',
    STAFF_NOT_FOUND: 'not_found',
    VALIDATION: 'validation',
    INVALID_BODY: 'validation',
    MISSING_REQUIRED_FIELDS: 'validation',
    INVALID_VISIT_COUNT: 'validation',
    INVALID_DISCOUNT_PERCENT: 'validation',
    BRANCH_NOT_FOUND_OR_ACCESS_DENIED: 'not_found',
    PROMOTION_NOT_FOUND_OR_ACCESS_DENIED: 'not_found',
    USER_NOT_FOUND: 'not_found',
    TARGET_BRANCH_INACTIVE: 'validation',
    TARGET_BRANCH_REQUIRED: 'validation',
    ALREADY_IN_TARGET_BRANCH: 'validation',
    STAFF_NOT_IN_THIS_BUSINESS: 'forbidden',
    BRANCH_NOT_IN_THIS_BUSINESS: 'forbidden',
    REVIEW_ALREADY_EXISTS: 'conflict',
    REVIEW_NOT_FOUND: 'not_found',
    HAS_FUTURE_BOOKINGS: 'conflict',
    // WhatsApp и прочие
    missing_data: 'validation',
    invalid_phone: 'validation',
    missing_account_id: 'validation',
    no_token: 'internal',
    user_not_found: 'not_found',
    no_phone: 'validation',
    invalid_code: 'validation',
    no_code: 'validation',
    expired: 'validation',
    wrong_code: 'validation',
    already_verified: 'validation',
    send_failed: 'internal',
};

export function expectErrorResponse(
    response: Response,
    expectedStatus: number,
    expectedError?: string,
) {
    expect(response.status).toBe(expectedStatus);
    return response.json().then((data) => {
        expect(data).toHaveProperty('ok', false);
        if (expectedError) {
            const normalizedExpected =
                LEGACY_ERROR_CODE_MAP[expectedError] ?? expectedError;
            expect(data).toHaveProperty('error', normalizedExpected);
        }
        return data;
    });
}

/**
 * Проверяет стандартный формат успешного ответа
 */
export function expectSuccessResponse(
    response: Response,
    expectedStatus: number = 200
) {
    expect(response.status).toBe(expectedStatus);
    return response.json().then((data) => {
        expect(data).toHaveProperty('ok', true);
        if (
            data &&
            typeof data === 'object' &&
            data.data &&
            typeof data.data === 'object' &&
            !Array.isArray(data.data)
        ) {
            return {
                ...data,
                ...data.data,
            };
        }
        return data;
    });
}


/**
 * Общие утилиты и моки для тестирования API routes
 */

import { NextRequest } from 'next/server';

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
    };
    from: jest.Mock<MockSupabaseClient>;
    select: jest.Mock<MockSupabaseClient>;
    insert: jest.Mock<MockSupabaseClient>;
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
};

export function createMockSupabase(): MockSupabaseClient {
    const mockSupabase: MockSupabaseClient = {
        auth: {
            getUser: jest.fn(),
            signOut: jest.fn(),
            updateUser: jest.fn(),
        },
        from: jest.fn(() => mockSupabase),
        select: jest.fn(() => mockSupabase),
        insert: jest.fn(() => mockSupabase),
        update: jest.fn(() => mockSupabase),
        delete: jest.fn(() => mockSupabase),
        eq: jest.fn(() => mockSupabase),
        neq: jest.fn(() => mockSupabase),
        gt: jest.fn(() => mockSupabase),
        gte: jest.fn(() => mockSupabase),
        lt: jest.fn(() => mockSupabase),
        lte: jest.fn(() => mockSupabase),
        in: jest.fn(() => mockSupabase),
        like: jest.fn(() => mockSupabase),
        ilike: jest.fn(() => mockSupabase),
        is: jest.fn(() => mockSupabase),
        order: jest.fn(() => mockSupabase),
        limit: jest.fn(() => mockSupabase),
        range: jest.fn(() => mockSupabase),
        single: jest.fn(),
        maybeSingle: jest.fn(),
        csv: jest.fn(),
        geojson: jest.fn(),
        rpc: jest.fn(),
    };

    return mockSupabase;
}

/**
 * Настраивает стандартные моки для тестов API routes
 */
export function setupApiTestMocks() {
    // Мокируем rate limiting
    jest.mock('@/lib/rateLimit', () => ({
        withRateLimit: jest.fn((req, config, handler) => handler()),
        RateLimitConfigs: {},
    }));

    // Мокаем next/headers
    jest.mock('next/headers', () => ({
        cookies: jest.fn(),
        headers: jest.fn(),
    }));

    // Мокаем supabase-js и ssr клиенты
    jest.mock('@supabase/supabase-js', () => ({
        createClient: jest.fn(),
    }));

    jest.mock('@supabase/ssr', () => ({
        createServerClient: jest.fn(),
    }));

    // Мокаем env переменные
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
}

/**
 * Проверяет стандартный формат ответа об ошибке
 */
const LEGACY_ERROR_CODE_MAP: Record<string, string> = {
    // Старые символические коды → новые краткие значения поля error
    UNAUTHORIZED: 'auth',
    BAD_REQUEST: 'validation',
    BOOKING_NOT_FOUND: 'not_found',
    FORBIDDEN: 'forbidden',
    REVIEW_ALREADY_EXISTS: 'conflict',
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
        return data;
    });
}


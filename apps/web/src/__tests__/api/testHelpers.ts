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
 */
export function createMockSupabase() {
    const mockSupabase: any = {
        auth: {
            getUser: jest.fn(),
            signOut: jest.fn(),
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
export function expectErrorResponse(
    response: Response,
    expectedStatus: number,
    expectedError?: string
) {
    expect(response.status).toBe(expectedStatus);
    return response.json().then((data) => {
        expect(data).toHaveProperty('ok', false);
        if (expectedError) {
            expect(data).toHaveProperty('error', expectedError);
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


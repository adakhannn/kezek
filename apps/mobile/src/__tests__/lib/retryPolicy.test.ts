import { shouldRetryQuery } from '../../lib/retryPolicy';

describe('query retry policy', () => {
    test.each([
        new TypeError('Network request failed'),
        new Error('Request timed out'),
        Object.assign(new Error('HTTP 408'), { status: 408 }),
        Object.assign(new Error('HTTP 429'), { status: 429 }),
        Object.assign(new Error('HTTP 503'), { status: 503 }),
    ])('retries transient failures', (error) => {
        expect(shouldRetryQuery(0, error)).toBe(true);
        expect(shouldRetryQuery(1, error)).toBe(true);
        expect(shouldRetryQuery(2, error)).toBe(false);
    });

    test.each([
        Object.assign(new Error('HTTP 400'), { status: 400 }),
        Object.assign(new Error('Unauthorized'), { status: 401 }),
        Object.assign(new Error('Forbidden'), { status: 403 }),
        Object.assign(new Error('Not found'), { status: 404 }),
        Object.assign(new Error('Validation failed'), { status: 422 }),
        new Error('Business rule rejected'),
    ])('does not retry permanent or domain failures', (error) => {
        expect(shouldRetryQuery(0, error)).toBe(false);
    });
});

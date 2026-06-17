import { getStableIdempotencyKey } from '../../lib/idempotency';

describe('stable idempotency keys', () => {
    test('reuses a key for the same logical request', () => {
        const first = getStableIdempotencyKey(null, '+996555000111', 'wa-start');
        const retry = getStableIdempotencyKey(first, '+996555000111', 'wa-start');

        expect(retry).toBe(first);
    });

    test('creates a new key when request input changes', () => {
        const first = getStableIdempotencyKey(null, 'attempt-1:111111', 'wa-verify');
        const corrected = getStableIdempotencyKey(first, 'attempt-1:222222', 'wa-verify');

        expect(corrected.key).not.toBe(first.key);
    });
});

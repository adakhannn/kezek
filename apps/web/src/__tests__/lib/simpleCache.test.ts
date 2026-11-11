import { BoundedJsonCache } from '@/lib/simpleCache';

describe('bounded JSON report cache', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(1000); });
    afterEach(() => jest.useRealTimers());

    test('bounds a flood of unique keys and evicts least recently read entries', () => {
        const cache = new BoundedJsonCache({ maxEntries: 2, maxBytes: 1000 });
        cache.set('a', 1, 1000); cache.set('b', 2, 1000);
        expect(cache.get('a')).toBe(1);
        cache.set('c', 3, 1000);
        expect(cache.get('b')).toBeNull();
        expect(cache.get('a')).toBe(1);
        for (let i = 0; i < 10_000; i++) cache.set(String(i), i, 1000);
        expect(cache.size).toBe(2);
        expect(cache.payloadBytes).toBeLessThanOrEqual(1000);
    });
    test('bounds retained payload size and skips oversized entries', () => {
        const cache = new BoundedJsonCache({ maxEntries: 100, maxBytes: 40 });
        cache.set('a', '1234567890', 1000);
        cache.set('b', '1234567890', 1000);
        expect(cache.get('a')).toBeNull();
        expect(cache.payloadBytes).toBeLessThanOrEqual(40);
        cache.set('oversized', 'x'.repeat(100), 1000);
        expect(cache.get('oversized')).toBeNull();
        expect(cache.size).toBe(1);
    });
    test('expires at the exact deadline and sweeps unread expired keys on write', () => {
        const cache = new BoundedJsonCache();
        cache.set('read', 1, 100); cache.set('unread', 2, 100);
        jest.setSystemTime(1100);
        expect(cache.get('read')).toBeNull();
        cache.set('new', 3, 100);
        expect(cache.size).toBe(1);
        expect(cache.get('new')).toBe(3);
    });
    test('does not allow input or returned object mutation to corrupt shared cache', () => {
        const cache = new BoundedJsonCache();
        const payload = { amount: 5 };
        cache.set('report', payload, 1000); payload.amount = 999;
        const first = cache.get<typeof payload>('report')!;
        expect(first.amount).toBe(5); first.amount = 0;
        expect(cache.get('report')).toEqual({ amount: 5 });
    });
    test('rejects invalid TTL and unserializable data, clearing the previous value', () => {
        const cache = new BoundedJsonCache();
        cache.set('a', 1, 1000); cache.set('a', 2, Number.NaN);
        cache.set('undefined', undefined, 1000);
        const cycle: { self?: unknown } = {}; cycle.self = cycle;
        cache.set('cycle', cycle, 1000);
        expect(cache.size).toBe(0);
    });
});

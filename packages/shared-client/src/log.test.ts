import { createLogger, safeExtra, sanitizeText, toLoggable } from './log';

// ARCH-04: production errors used to lose their details (an Error logged as {}), warnings were
// dropped, and nothing reached monitoring.
describe('toLoggable', () => {
    test('an Error keeps name, message, stack and its cause', () => {
        const cause = new Error('socket hang up');
        const error = Object.assign(new Error('fetch failed'), { cause, status: 502 });
        const loggable = toLoggable({ error }) as { error: Record<string, unknown> };

        expect(loggable.error).toMatchObject({ name: 'Error', message: 'fetch failed', status: 502, cause: { message: 'socket hang up' } });
        expect(String(loggable.error.stack)).toContain('fetch failed');
        expect(String(loggable.error.stack).split('\n').length).toBeLessThanOrEqual(8);
        expect(JSON.stringify(new Error('x'))).toBe('{}');
    });

    test('a PostgREST-like error keeps its code as errorCode and its details, with the phone masked', () => {
        const postgrest = { message: 'duplicate key value violates unique constraint "staff_phone_key"', code: '23505', details: 'Key (phone)=(+996555123456) already exists.', hint: null };
        const safe = safeExtra({ error: postgrest }) as { error: Record<string, unknown> };

        expect(safe.error.errorCode).toBe('23505');
        expect(String(safe.error.details)).toContain('[REDACTED_PHONE]');
        expect(String(safe.error.details)).not.toContain('555123456');
    });

    test('cycles, depth, dates, bigints and long arrays become plain data', () => {
        const cycle: Record<string, unknown> = { at: new Date('2026-11-18T10:00:00Z'), big: BigInt(7), list: Array.from({ length: 60 }, (_, i) => i) };
        cycle.self = cycle;
        const loggable = toLoggable(cycle) as Record<string, unknown>;

        expect(loggable.at).toBe('2026-11-18T10:00:00.000Z');
        expect(loggable.big).toBe('7');
        expect(loggable.self).toBe('[Circular]');
        expect((loggable.list as unknown[]).length).toBe(51);
        expect(() => JSON.stringify(loggable)).not.toThrow();
    });
});

describe('sanitizeText', () => {
    test('masks contacts, including their URL-encoded forms, and keeps ids, statuses and dates', () => {
        const text = sanitizeText('user ada.l@example.kg phone +996555123456 query email=eq.ada%40example.kg&phone=eq.%2B996555123456 id 6f1c2a3b-1111-4222-8333-444455556666 status 503 at 2026-11-18T10:00:00Z');

        expect(text).not.toContain('ada.l@example.kg');
        expect(text).not.toContain('ada%40example.kg');
        expect(text).not.toContain('555123456');
        expect(text).toContain('[REDACTED_EMAIL]');
        expect(text).toContain('[REDACTED_PHONE]');
        expect(text).toContain('6f1c2a3b-1111-4222-8333-444455556666');
        expect(text).toContain('status 503');
        expect(text).toContain('2026-11-18T10:00:00Z');
    });

    test('a 200 KB string without "@" is handled fast and truncated', () => {
        const big = 'a'.repeat(200_000);
        const started = Date.now();
        const text = sanitizeText(big);

        expect(Date.now() - started).toBeLessThan(100);
        expect(text.endsWith('…[truncated]')).toBe(true);
        expect(text.length).toBeLessThan(2100);
    });
});

describe('createLogger', () => {
    let lines: Array<{ method: string; args: unknown[] }>;
    beforeEach(() => {
        lines = [];
        for (const method of ['log', 'warn', 'error'] as const) {
            jest.spyOn(console, method).mockImplementation((...args: unknown[]) => { lines.push({ method, args }); });
        }
    });
    afterEach(() => jest.restoreAllMocks());

    test('default options keep production quiet: message-only errors, no warnings (mobile)', () => {
        const { logWarn, logError } = createLogger(() => false);
        logWarn('S', 'w', { status: 1 });
        logError('S', 'm', new Error('details'));

        expect(lines).toEqual([{ method: 'error', args: ['[S] m'] }]);
    });

    test('summary mode prints one line with sanitized details, capped at 2000 characters', () => {
        const { logWarn, logError } = createLogger(() => false, { productionDetail: 'summary', productionWarnings: true });
        logError('S', 'm', { url: 'https://x.invalid/cb?access_token=synthetic-token&page=2', status: 500 });
        logWarn('S', 'w', { blob: 'x'.repeat(5000) });
        logError('S', 'm');

        const [first, second, third] = lines;
        expect(first.args).toHaveLength(1);
        expect(String(first.args[0])).toMatch(/^\[S\] m \{/);
        expect(String(first.args[0])).not.toContain('synthetic-token');
        expect(String(first.args[0])).toContain('"status":500');
        expect(second.method).toBe('warn');
        expect(String(second.args[0]).length).toBeLessThanOrEqual('[S] w '.length + 2001);
        expect(third.args).toEqual(['[S] m']);
    });

    test('an e-mail in the message is masked in the console and in the sink event', () => {
        const sink = jest.fn();
        const { logError } = createLogger(() => false, { sink });
        logError('S', 'mail to ada.l@example.kg failed', { code: 'E1' });

        expect(String(lines[0].args[0])).toBe('[S] mail to [REDACTED_EMAIL] failed');
        expect(sink).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', scope: 'S', message: 'mail to [REDACTED_EMAIL] failed' }));
    });

    test('the sink receives warnings and errors; a throwing sink never reaches the caller', () => {
        const events: unknown[] = [];
        const { logWarn, logError } = createLogger(() => false, { sink: (event) => { events.push(event); throw new Error('sink down'); } });
        const error = new Error('boom');

        expect(() => logWarn('S', 'w', { a: 1 }, { tags: { t: 'v' } })).not.toThrow();
        expect(() => logError('S', 'e', { error })).not.toThrow();
        expect(events).toEqual([
            { level: 'warn', scope: 'S', message: 'w', extra: { a: 1 }, meta: { tags: { t: 'v' } } },
            { level: 'error', scope: 'S', message: 'e', extra: { error }, meta: undefined },
        ]);
    });

    test('development prints full sanitized details as a second argument', () => {
        const { logDebug } = createLogger(() => true);
        logDebug('S', 'd', { otp: '123456', error: new Error('boom') });

        expect(lines[0].args[0]).toBe('[S] d');
        expect(lines[0].args[1]).toMatchObject({ otp: '****', error: { message: 'boom' } });
    });
});

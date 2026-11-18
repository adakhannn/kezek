import { logSafe, logDebugSafe, logWarnSafe, logErrorSafe, sanitizeObject, maskToken, maskUrl } from '@/lib/logSafe';
import { logDebug, logWarn, logError } from '@/lib/log';

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('legacy production diagnostics keep their levels and redact nested credentials', () => {
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    const payload = { status: 503, nested: { access_token: 'synthetic-access-credential', password: 'synthetic-password' }, records: [{ otp: '123456' }], url: 'https://example.invalid/?access_token=synthetic-url-credential' };
    logSafe('Example', 'Info', payload);
    logWarnSafe('Example', 'Warning', payload);
    logErrorSafe('Example', 'Failure', payload);
    logDebugSafe('Example', 'Debug', payload);
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    for (const method of [console.log, console.warn, console.error]) {
        const output = JSON.stringify(jest.mocked(method).mock.calls);
        expect(output).not.toContain('synthetic-access-credential');
        expect(output).not.toContain('synthetic-password');
        expect(output).not.toContain('123456');
        expect(output).not.toContain('synthetic-url-credential');
        expect(output).toContain('503');
    }
    expect(payload.nested.access_token).toBe('synthetic-access-credential');
});

// ARCH-04: server logs in production (Vercel) carry sanitized details and warnings; they used
// to print the bare message, so a database failure showed up as "[Scope] Failure" and nothing else.
test('server production logs carry one sanitized line with details, and warnings', () => {
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    const dbError = Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
        details: 'Key (phone)=(+996555123456) already exists.',
    });
    logDebug('Example', 'Debug', { password: 'secret' });
    logWarn('Example', 'Warning', { password: 'secret', status: 409 });
    logError('Example', 'Failure', dbError);
    logError('Example', 'Bare');

    expect(console.log).not.toHaveBeenCalled();
    const [warnLine] = jest.mocked(console.warn).mock.calls[0] as [string];
    expect(warnLine.startsWith('[Example] Warning {')).toBe(true);
    expect(warnLine).toContain('409');
    expect(warnLine).not.toContain('secret');
    const errorCall = jest.mocked(console.error).mock.calls[0] as [string];
    expect(errorCall).toHaveLength(1);
    expect(errorCall[0]).toContain('"errorCode":"23505"');
    expect(errorCall[0]).toContain('duplicate key value');
    expect(errorCall[0]).toContain('[REDACTED_PHONE]');
    expect(errorCall[0]).not.toContain('555123456');
    expect(console.error).toHaveBeenLastCalledWith('[Example] Bare');
});

test('debug diagnostics still emit safely in development', () => {
    jest.replaceProperty(process.env, 'NODE_ENV', 'development');
    logDebugSafe('Example', 'Debug', { otp: '123456', status: 'retry' });
    expect(console.log).toHaveBeenCalledWith('[Example] Debug', { otp: '****', status: 'retry' });
});

test('safe helper exports retain recursive sanitization without mutating inputs', () => {
    const cycle: { token: string; self?: unknown } = { token: 'synthetic-long-token' };
    cycle.self = cycle;
    const output = JSON.stringify(sanitizeObject(cycle));
    expect(output).not.toContain(cycle.token);
    expect(output).toContain('[Max depth reached]');
    expect(maskToken('123456')).toBe('****');
    const url = new URL('https://example.invalid/path?code=synthetic-code&page=2#access_token=synthetic-fragment');
    const masked = maskUrl(url);
    expect(masked).not.toContain('synthetic-code');
    expect(masked).not.toContain('synthetic-fragment');
    expect(masked).toContain('page=2');
    expect(url.searchParams.get('code')).toBe('synthetic-code');
});

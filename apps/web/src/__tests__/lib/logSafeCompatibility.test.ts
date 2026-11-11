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

test('shared app production policy remains debug/warn off and error message only', () => {
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    logDebug('Example', 'Debug', { password: 'secret' });
    logWarn('Example', 'Warning', { password: 'secret' });
    logError('Example', 'Failure', { password: 'secret' });
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('[Example] Failure');
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

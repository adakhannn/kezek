import { reportErrorToMonitoring } from '@/lib/errorMonitoring';

jest.mock('@/lib/log', () => {
    const actual = jest.requireActual('@shared-client/log');
    return { logError: jest.fn(), maskUrl: actual.maskUrl };
});

const { logError } = jest.requireMock('@/lib/log');

// ARCH-04: ErrorBoundary errors reach monitoring once, through the logger, without URL secrets.
test('an ErrorBoundary error is logged once as an Error with a masked URL', () => {
    reportErrorToMonitoring({
        scope: 'BookingForm',
        error: { name: 'TypeError', message: 'x is undefined', stack: 'TypeError: x is undefined\n    at Form' },
        componentStack: 'in Form',
        url: 'https://kezek.vercel.app/auth/callback?code=secret-code#access_token=secret-token',
        timestamp: '2026-11-18T10:00:00.000Z',
    });

    expect(logError).toHaveBeenCalledTimes(1);
    const [scope, message, extra] = logError.mock.calls[0];
    expect(scope).toBe('BookingForm');
    expect(message).toBe('Captured error (ErrorBoundary)');
    expect(extra.error).toBeInstanceOf(Error);
    expect(extra.error).toMatchObject({ name: 'TypeError', message: 'x is undefined' });
    expect(JSON.stringify(extra)).not.toContain('secret');
    expect(extra.url).toContain('/auth/callback');
});

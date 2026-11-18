/** @jest-environment jsdom */
import { logError, logWarn } from '@/lib/log';
import { setMonitoringReporter } from '@/lib/monitoring';

// ARCH-04: browsers keep message-only console output (no details in the user's console), but
// every warning and error reaches monitoring when a reporter is registered.
describe('web logger in the browser', () => {
    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    });
    afterEach(() => {
        setMonitoringReporter(undefined);
        jest.restoreAllMocks();
    });

    test('production prints the message only and no warnings', () => {
        logWarn('Booking', 'Slow response', { ms: 5000 });
        logError('Booking', 'Request failed', new Error('details stay out of the console'));

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('[Booking] Request failed');
    });

    test('the registered reporter receives both events with the raw extra', () => {
        const reporter = jest.fn();
        setMonitoringReporter(reporter);
        const error = new Error('boom');

        logWarn('Booking', 'Slow response', { ms: 5000 });
        logError('Booking', 'Request failed', error);

        expect(reporter).toHaveBeenNthCalledWith(1, expect.objectContaining({ level: 'warn', scope: 'Booking', message: 'Slow response' }));
        expect(reporter).toHaveBeenNthCalledWith(2, expect.objectContaining({ level: 'error', extra: error }));
    });

    test('a failing reporter never breaks the caller', () => {
        setMonitoringReporter(() => {
            throw new Error('reporter down');
        });

        expect(() => logError('Booking', 'Request failed')).not.toThrow();
    });
});

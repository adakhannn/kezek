/** @jest-environment jsdom
 * @jest-environment-options {"url":"https://kezek.invalid/auth/sign-in"}
 */

import { act, render } from '@testing-library/react';

import { TelegramLoginWidget } from '@/components/auth/TelegramLoginWidget';
import { logError } from '@/lib/log';

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/components/auth/TelegramAccountSwitchHelp', () => ({ TelegramAccountSwitchHelp: () => null }));

describe('TelegramLoginWidget login failures (ARCH-04)', () => {
    const originalFetch = global.fetch;
    const mockFetch = jest.fn();
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = mockFetch;
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        consoleError.mockRestore();
    });

    async function authenticate() {
        const name = document.querySelector('script[data-onauth]')!
            .getAttribute('data-onauth')!.replace('(user)', '');
        const callback = (window as unknown as Record<string, (user: object) => Promise<void>>)[name];
        await act(async () => { await callback({ id: 123, auth_date: 123, hash: 'test' }); });
    }

    test('an unexpected failure is logged exactly once, without the message in the log text', async () => {
        const onError = jest.fn();
        mockFetch.mockResolvedValue({ json: async () => ({ ok: false, message: 'Server failure' }) });
        render(<TelegramLoginWidget onError={onError} />);
        await authenticate();
        expect(onError).toHaveBeenCalledWith('Server failure');
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith('TelegramLoginWidget', 'Error during login', expect.any(Error));
        expect(consoleError).not.toHaveBeenCalled();
    });

    test.each([
        'Превышен лимит запросов. Попробуйте через 30 секунд.',
        'Rate limit exceeded',
        'Вход через Telegram временно недоступен. Обратитесь к администратору сайта.',
    ])('an expected rejection (%s) is shown but not logged', async (message) => {
        const onError = jest.fn();
        mockFetch.mockResolvedValue({ json: async () => ({ ok: false, message }) });
        render(<TelegramLoginWidget onError={onError} />);
        await authenticate();
        expect(onError).toHaveBeenCalledWith(message);
        expect(logError).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
    });
});

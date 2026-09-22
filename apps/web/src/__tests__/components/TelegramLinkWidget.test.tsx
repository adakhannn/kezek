/** @jest-environment jsdom */

import { act, render, screen } from '@testing-library/react';

import { TelegramLinkWidget } from '@/app/cabinet/components/TelegramLinkWidget';
import { logError } from '@/lib/log';

const mockRefresh = jest.fn();
const mockRouter = { refresh: mockRefresh };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));
jest.mock('@/components/auth/TelegramAccountSwitchHelp', () => ({
    TelegramAccountSwitchHelp: () => null,
}));

describe('TelegramLinkWidget', () => {
    const originalFetch = global.fetch;
    const mockFetch = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = mockFetch;
    });

    afterEach(() => { global.fetch = originalFetch; });

    async function authenticate() {
        const name = document.querySelector('script[data-onauth]')!
            .getAttribute('data-onauth')!.replace('(user)', '');
        const callback = (window as unknown as Record<string, (user: object) => Promise<void>>)[name];
        await act(async () => { await callback({ id: 123, auth_date: 123, hash: 'test' }); });
    }

    test.each([
        [400, 'conflict'], [409, 'conflict'], [401, 'auth'], [400, 'validation'], [429, 'rate_limit'],
    ])('shows expected %s %s rejection without logging a crash', async (status, error) => {
        const onError = jest.fn();
        mockFetch.mockResolvedValue({ ok: false, status, json: async () => ({
            ok: false, error, message: 'Этот Telegram аккаунт уже привязан к другому пользователю',
        }) });
        render(<TelegramLinkWidget onError={onError} />);
        await authenticate();
        expect(onError).toHaveBeenCalledWith('Этот Telegram аккаунт уже привязан к другому пользователю');
        expect(logError).not.toHaveBeenCalled();
        expect(mockRefresh).not.toHaveBeenCalled();
        expect(screen.queryByText('Привязка...')).toBeNull();
    });

    test.each(['server', 'network', 'malformed'])('keeps diagnostics for %s failures', async (kind) => {
        const onError = jest.fn();
        if (kind === 'network') mockFetch.mockRejectedValue(new Error('Network failure'));
        else mockFetch.mockResolvedValue({
            ok: kind === 'malformed', status: kind === 'server' ? 500 : 200,
            json: async () => kind === 'malformed' ? {} : { ok: false, error: 'internal', message: 'Server failure' },
        });
        render(<TelegramLinkWidget onError={onError} />);
        await authenticate();
        expect(logError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(mockRefresh).not.toHaveBeenCalled();
        expect(screen.queryByText('Привязка...')).toBeNull();
    });

    test('refreshes the profile after successful linking', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
        const onSuccess = jest.fn();
        render(<TelegramLinkWidget onSuccess={onSuccess} />);
        await authenticate();
        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(logError).not.toHaveBeenCalled();
    });
});

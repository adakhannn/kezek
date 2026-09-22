/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TelegramBotLogin, safeTelegramLoginRedirect } from '@/components/auth/TelegramBotLogin';
jest.mock('@/app/_components/i18n/LanguageProvider', () => {
    const t = (key: string) => key;
    return { useLanguage: () => ({ t }) };
});
describe('Telegram bot browser login', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        global.fetch = jest.fn(async (_, options) => {
            const action = JSON.parse(options?.body as string).action;
            return { ok: true, json: async () => ({ ok: true, data: action === 'create'
                ? { token: 't'.repeat(32), botDeepLink: 'https://t.me/test_bot?start=kw1_test', code: 'ABC123', expiresAt: new Date(Date.now()+300000).toISOString() }
                : action === 'status' ? { status: 'approved', account: { id: 123, name: 'Test account' } } : { status: 'cancelled' } }) } as Response;
        });
    });
    afterEach(() => { jest.useRealTimers(); });
    test('shows a bot link and comparison code, then requires browser confirmation', async () => {
        render(<TelegramBotLogin />);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'auth.botLogin.title' })); });
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByText('ABC123')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'auth.botLogin.open' }).getAttribute('href')).toContain('https://t.me/');
        await act(async () => { jest.advanceTimersByTime(1600); });
        expect(screen.getByText('Test account', { exact: false })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'auth.botLogin.finish' })).toBeTruthy();
        expect((fetch as jest.Mock).mock.calls.some(([, o]) => JSON.parse(o.body).action === 'finish')).toBe(false);
    });
    test('blocks external redirect destinations, including protocol-relative and backslash forms', () => {
        for (const value of ['https://evil.test/', '//evil.test/', '\\\\evil.test/', 'javascript:alert(1)']) {
            expect(safeTelegramLoginRedirect(value, 'https://kezek.test')).toBe('/');
        }
        expect(safeTelegramLoginRedirect('/dashboard?tab=staff', 'https://kezek.test')).toBe('/dashboard?tab=staff');
    });
});

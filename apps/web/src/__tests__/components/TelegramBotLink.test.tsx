/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TelegramBotLink } from '@/app/cabinet/components/TelegramBotLink';
jest.mock('qrcode.react', () => ({ QRCodeSVG: () => <svg aria-label="QR" /> }));
describe('TelegramBotLink', () => {
    const originalFetch = global.fetch;
    const token = 'a'.repeat(32);
    afterEach(() => { global.fetch = originalFetch; });
    test('shows chosen account and requires browser confirmation before linking', async () => {
        const onSuccess = jest.fn();
        const calls: Array<Record<string, unknown>> = [];
        global.fetch = jest.fn(async (_url, options) => {
            const body = JSON.parse(options!.body as string); calls.push(body);
            const data = body.action === 'create' ? { token, expiresAt: new Date(Date.now()+300000).toISOString(), botDeepLink: 'https://t.me/test_bot?start=kl1_' + token }
                : body.action === 'status' ? { status: 'approved', account: { id: 123, name: 'Chosen Account', username: 'chosen' } }
                : { status: 'consumed' };
            return { ok: true, json: async () => ({ ok: true, data }) } as Response;
        });
        render(<TelegramBotLink onSuccess={onSuccess} />);
        fireEvent.click(screen.getByRole('button', { name: 'Подключить через Telegram' }));
        await screen.findByText('Chosen Account');
        expect(onSuccess).not.toHaveBeenCalled();
        expect(calls.some(c => c.action === 'finish')).toBe(false);
        fireEvent.click(screen.getByRole('button', { name: 'Подключить этот аккаунт' }));
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
        expect(calls).toContainEqual({ action: 'finish', token, telegramId: 123 });
    });
    test('shows a helpful error when setup is incomplete', async () => {
        global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ message: 'Подключение через бота ещё не настроено' }) } as Response));
        render(<TelegramBotLink onSuccess={jest.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Подключить через Telegram' }));
        expect((await screen.findByRole('alert')).textContent).toContain('ещё не настроено');
        expect(screen.queryByRole('link', { name: 'Открыть бота в Telegram' })).toBeNull();
    });
});

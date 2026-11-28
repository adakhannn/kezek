/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { AccountDeletionPanel } from '@/app/cabinet/components/AccountDeletionPanel';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ locale: 'ru', t: (_key: string, fallback: string) => fallback }),
}));

function respond(data: unknown) {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data }) }) as never;
}

const REQUEST = { requested_at: '2026-11-01T09:00:00.000Z', scheduled_for: '2026-11-08T09:00:00.000Z' };

describe('AccountDeletionPanel and a request that was not carried out', () => {
    test('a blocked request tells the user it will not be retried and what to do, with the request form available', async () => {
        respond({ request: { status: 'blocked', ...REQUEST }, blockers: [], eligible: true });
        render(<AccountDeletionPanel />);

        expect(await screen.findByText('Аккаунт не удалён')).toBeTruthy();
        expect(screen.getByText(/Сам запрос больше не повторится\. Устраните причины и запросите удаление снова\./)).toBeTruthy();
        expect(screen.getByText(/Запрос на удаление от .*2026/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Запросить удаление аккаунта' })).toBeTruthy();
    });

    test('the current blockers are listed under the notice', async () => {
        respond({
            request: { status: 'blocked', ...REQUEST },
            blockers: [{ code: 'active_bookings', count: 1, message: 'Сначала отмените или завершите будущие активные записи.' }],
            eligible: false,
        });
        render(<AccountDeletionPanel />);

        expect(await screen.findByText('Аккаунт не удалён')).toBeTruthy();
        expect(screen.getByText(/Сначала отмените или завершите будущие активные записи/)).toBeTruthy();
    });

    test('no notice for a cancelled request', async () => {
        respond({ request: { status: 'cancelled', ...REQUEST }, blockers: [], eligible: true });
        render(<AccountDeletionPanel />);

        expect(await screen.findByRole('button', { name: 'Запросить удаление аккаунта' })).toBeTruthy();
        expect(screen.queryByText('Аккаунт не удалён')).toBeNull();
    });
});

/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SellVisitPackageModal } from '@/app/dashboard/bookings/components/SellVisitPackageModal';

// A stable t(), like the real provider: a new function per render would refetch the plans forever.
const mockLanguage = { locale: 'ru', t: (_key: string, fallback?: string) => fallback ?? _key };
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => mockLanguage }));

const plan = { id: 'plan-1', name_ru: 'Пакет 5', visit_count: 5, validity_days: 30, discount_type: 'percent', discount_value: 10, is_active: true };
const plansResponse = { ok: true, json: async () => ({ ok: true, data: { plans: [plan] } }) };

// API-11: a retried sale reuses the request key, so the server can return the package it sold
// instead of selling a second one; the next sale gets a new key.
test('a retry after a lost answer sends the same Idempotency-Key; a new sale gets a new one', async () => {
    let uuid = 0;
    // jsdom has no crypto.randomUUID; browsers do.
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: () => `00000000-0000-4000-8000-00000000000${++uuid}` });
    const fetchMock = jest.fn()
        .mockResolvedValueOnce(plansResponse)
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { replayed: true, package: { id: 'pkg-1' } } }) })
        .mockResolvedValueOnce(plansResponse)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { package: { id: 'pkg-2' } } }) });
    global.fetch = fetchMock;
    const onSuccess = jest.fn();

    const { rerender } = render(<SellVisitPackageModal isOpen onClose={jest.fn()} clientId="client-1" clientName="Клиент" onSuccess={onSuccess} />);
    await screen.findByRole('option', { name: /Пакет 5/ });

    fireEvent.click(screen.getByRole('button', { name: 'Продать пакет' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Продать пакет' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Продать пакет' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    const saleHeaders = fetchMock.mock.calls.filter(([url]) => String(url).includes('/visit-packages') && !String(url).includes('plans')).map(([, init]) => init.headers['Idempotency-Key']);
    expect(saleHeaders).toEqual(['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001']);

    // The modal is opened again for the next sale.
    rerender(<SellVisitPackageModal isOpen={false} onClose={jest.fn()} clientId="client-1" clientName="Клиент" onSuccess={onSuccess} />);
    rerender(<SellVisitPackageModal isOpen onClose={jest.fn()} clientId="client-1" clientName="Клиент" onSuccess={onSuccess} />);
    await screen.findByRole('option', { name: /Пакет 5/ });
    fireEvent.click(screen.getByRole('button', { name: 'Продать пакет' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));

    const lastSale = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect(lastSale[1].headers['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000002');
});

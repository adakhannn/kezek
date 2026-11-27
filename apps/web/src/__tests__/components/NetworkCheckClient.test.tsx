/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import NetworkCheckClient from '@/app/network-check/NetworkCheckClient';

const fetchMock = jest.fn();
beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock; });

function row(id: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(`[data-probe="${id}"]`);
    if (!el) throw new Error(`no row ${id}`);
    return el;
}

test('shows each probe and «Supabase доступен» when Supabase answers', async () => {
    fetchMock.mockImplementation(async (url: string) => {
        if (url.startsWith('/icon-192.png')) return { type: 'basic', ok: true, status: 200 };
        if (url === 'https://test.supabase.co/rest/v1/') return { type: 'cors', ok: false, status: 401 };
        if (url === 'https://test.supabase.co/auth/v1/health') return { type: 'cors', ok: true, status: 200 };
        if (url.startsWith('https://www.cloudflare.com/')) return { type: 'opaque', ok: false, status: 0 };
        if (url === '/api/network-check/dns') return { type: 'basic', ok: true, status: 200,
            json: async () => ({ ok: true, data: { host: 'test.supabase.co', ipv4: ['104.18.38.10'], ipv6: [], ms: 12 } }) };
        throw new TypeError('unexpected');
    });
    render(<NetworkCheckClient />);
    expect(screen.getByRole('status').textContent).toBe('Идёт проверка…');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Supabase доступен'));
    expect(within(row('rest')).getByText(/ответ HTTP 401/)).toBeTruthy();
    expect(within(row('auth')).getByText('есть связь')).toBeTruthy();
    expect(within(row('control')).getByText(/ответ получен/)).toBeTruthy();
    await waitFor(() => expect(within(row('dns')).getByText('104.18.38.10')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith('https://test.supabase.co/rest/v1/',
        expect.objectContaining({ headers: { apikey: 'test-anon-key' }, cache: 'no-store', credentials: 'omit' }));
    expect(screen.getByText('Устройство')).toBeTruthy();
});

test('fast network errors on Supabase read as a DNS block, and «Проверить ещё раз» re-runs', async () => {
    fetchMock.mockImplementation(async (url: string) => {
        if (url.startsWith('/icon-192.png')) return { type: 'basic', ok: true, status: 200 };
        if (url === '/api/network-check/dns') return { type: 'basic', ok: false, status: 502, json: async () => ({ ok: false }) };
        throw new TypeError('Failed to fetch');
    });
    render(<NetworkCheckClient />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Supabase заблокирован: похоже по имени (DNS) или сбросом соединения'));
    expect(within(row('rest')).getByText('нет связи')).toBeTruthy();
    expect(within(row('rest')).getByText(/ошибка сети · отказ через \d+ мс/)).toBeTruthy();
    await waitFor(() => expect(within(row('dns')).getByText('адреса не получены')).toBeTruthy());
    const button = screen.getByRole('button', { name: 'Проверить ещё раз' }) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    const calls = fetchMock.mock.calls.length;
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(calls));
});

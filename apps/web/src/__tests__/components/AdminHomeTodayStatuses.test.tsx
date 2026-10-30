/** @jest-environment jsdom */

import { render, screen, within } from '@testing-library/react';

import AdminHomePage from '@/app/admin/page';

let mockStatuses: string[] = [];
let mockLocale: 'ru' | 'ky' | 'en' = 'ru';

jest.mock('@/app/_components/i18n/server', () => ({
    getT: async () => {
        const dictionaries = jest.requireActual('@/app/_components/i18n/dictionaries');
        return (key: string, fallback: string) => dictionaries[mockLocale][key] ?? fallback;
    },
}));

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        from: (table: string) => {
            const query = {
                gte: () => query,
                lt: () => query,
                order: () => query,
                limit: () => query,
                returns: async () => ({
                    error: null,
                    data: table === 'bookings' ? mockStatuses.map((status, index) => ({
                        id: `test-booking-${index}`,
                        start_at: '2026-10-26T03:00:00Z',
                        end_at: '2026-10-26T04:00:00Z',
                        status,
                        client_name: 'Test client',
                        client_phone: null,
                        services: { name_ru: 'Test service' },
                        staff: { full_name: 'Test staff' },
                        businesses: { id: 'test-business', name: 'Test business', slug: 'test-business' },
                        branches: { name: 'Test branch' },
                    })) : [],
                }),
            };
            return {
                select: (_columns: string, options?: { head?: boolean }) => options?.head
                    ? Promise.resolve({ count: 0, error: null })
                    : query,
            };
        },
    })),
}));

async function renderToday(statuses: string[], locale: 'ru' | 'ky' | 'en' = 'ru') {
    mockStatuses = statuses;
    mockLocale = locale;
    render(await AdminHomePage());
    const section = screen.getByRole('table').closest('section');
    if (!section) throw new Error('Today section missing');
    return within(section);
}

it('counts the canonical cancelled booking and gives its row a Russian status label', async () => {
    const today = await renderToday(['cancelled']);
    expect(today.getAllByText('Отменено').some(label => label.parentElement?.textContent === 'Отменено1')).toBe(true);
    expect(within(today.getByRole('table')).getByText('Отменено')).toBeTruthy();
    expect(within(today.getByRole('table')).queryByText('cancelled')).toBeNull();
});

it('retains legacy canceled status presentation', async () => {
    const today = await renderToday(['canceled']);
    expect(today.getAllByText('Отменено').some(label => label.parentElement?.textContent === 'Отменено1')).toBe(true);
    expect(within(today.getByRole('table')).getByText('Отменено')).toBeTruthy();
});

it('combines cancellation spellings while preserving hold, confirmed and paid rows', async () => {
    const today = await renderToday(['cancelled', 'canceled', 'hold', 'confirmed', 'paid']);
    for (const [label, count] of [['Отменено', 2], ['Ожидание', 1], ['Подтверждено', 1]] as const) {
        expect(today.getAllByText(label).some(node => node.parentElement?.textContent === `${label}${count}`)).toBe(true);
    }
    const table = within(today.getByRole('table'));
    expect(table.getAllByText('Отменено')).toHaveLength(2);
    expect(table.getByText('Выполнено')).toBeTruthy();
    expect(table.getAllByRole('row')).toHaveLength(6);
});

it.each([
    ['en', 'Admin Panel', 'Cancelled', 'Pending', 'Confirmed'],
    ['ky', 'Администратор панели', 'Жокко чыгарылган', 'Күтүүдө', 'Ырасталган'],
] as const)('uses the server locale for Today status labels in %s', async (locale, heading, cancelled, hold, confirmed) => {
    const today = await renderToday(['cancelled'], locale);
    expect(screen.getByRole('heading', { name: heading, exact: true })).toBeTruthy();
    expect(within(today.getByRole('table')).getByText(cancelled, { exact: true })).toBeTruthy();
    for (const [label, count] of [[cancelled, 1], [hold, 0], [confirmed, 0]] as const) {
        expect(today.getAllByText(label, { exact: true }).some(node => node.parentElement?.textContent === `${label}${count}`)).toBe(true);
    }
    expect(today.queryByText('Отменено', { exact: true })).toBeNull();
});

it('renders the English Today heading with an ordinary apostrophe and no escape characters', async () => {
    await renderToday(['cancelled'], 'en');
    expect(screen.getByRole('heading', { name: "Today's Bookings", exact: true })).toBeTruthy();
});

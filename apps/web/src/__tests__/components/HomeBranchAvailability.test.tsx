/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getServerLocale, getT } from '@/app/_components/i18n/server';
import Home from '@/app/page';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/_components/i18n/server', () => ({ getServerLocale: jest.fn(), getT: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/analyticsTrackEvent', () => ({ HomeViewTracker: () => null }));
jest.mock('@/lib/publicCategoryLabels', () => ({
    loadPublicCategoryLabels: jest.fn().mockResolvedValue({}),
    publicCategoryLabel: (_labels: unknown, value: string) => value,
}));

function responseQuery(data: unknown[], count?: number) {
    const result = Promise.resolve({ data, count, error: null });
    return ['select', 'eq', 'in', 'contains', 'or', 'range', 'order'].reduce(
        (query, method) => Object.assign(query, { [method]: () => query }), result,
    );
}

it.each(['ru', 'en', 'ky'] as const)('offers booking only for a business with active branches in %s', async locale => {
    const dictionary = { ru, en, ky }[locale];
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    (getServerLocale as jest.Mock).mockResolvedValue(locale);
    (getT as jest.Mock).mockReturnValue(t);
    (useLanguage as jest.Mock).mockReturnValue({ locale, t });
    const business = { address: null, phones: [], contact_phone: null, categories: [], rating_score: null };
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({ from: (table: string) => {
        if (table === 'businesses') return responseQuery([
            { ...business, id: 'empty', slug: 'empty', name: 'No branches' },
            { ...business, id: 'ready', slug: 'ready', name: 'Active branch' },
        ], 2);
        if (table === 'branches') return responseQuery([{ id: 'branch-1', biz_id: 'ready' }]);
        if (table === 'branch_promotions') return responseQuery([]);
        throw new Error(`Unexpected table: ${table}`);
    } });
    render(await Home({ searchParams: Promise.resolve({}) }));
    const [empty, ready] = screen.getAllByRole('article');
    expect(within(empty).queryByRole('link', { name: dictionary['home.card.book'], exact: false })).toBeNull();
    expect(empty.querySelector('a[href="/b/empty/booking"]')).toBeNull();
    expect(within(empty).getByText(dictionary['booking.step1.noBranches'])).toBeTruthy();
    expect(empty.querySelector('a[href="/b/empty"]')).toBeTruthy();
    expect(ready.querySelector('a[href="/b/ready/booking"]')).toBeTruthy();
    expect(within(ready).getByText(dictionary['home.card.onlineBooking'])).toBeTruthy();
});

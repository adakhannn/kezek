/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import BusinessInfo from '@/app/b/[slug]/BusinessInfo';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ prefetchQuery: jest.fn() }) }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/components/business/PublicContactActions', () => ({ PublicContactActions: () => null }));

const fixture = {
    biz: { id: 'biz-1', slug: 'fixture-business', name: 'Fixture business', address: '', phones: [], rating_score: null },
    branches: [{ id: 'branch-1', name: 'Fixture branch', address: 'Fixture address', rating_score: null,
        directory_links: { google_maps: 'https://example.test/google', yandex_maps: 'https://example.test/yandex' } }],
    services: [{ id: 'service-1', branch_id: 'branch-1', name_ru: 'Fixture RU', name_ky: 'Fixture KY', name_en: 'Fixture EN', duration_min: 30, price_from: 150, price_to: 275 }],
    staff: [{ id: 'staff-1', branch_id: 'branch-1', full_name: 'Fixture staff', rating_score: null }],
};

const dictionaries = { ru, ky, en };
function setLanguage(locale: keyof typeof dictionaries) {
    const dictionary = dictionaries[locale];
    const t = jest.fn((key: string, fallback?: string) => dictionary[key] ?? fallback ?? key);
    (useLanguage as jest.Mock).mockReturnValue({ locale, t });
    return t;
}

describe('BusinessInfo visible landing localization', () => {
    it.each(['ru', 'ky', 'en'] as const)('does not invite booking without active branches in %s', locale => {
        setLanguage(locale);
        const dictionary = dictionaries[locale];
        const { container } = render(<BusinessInfo data={{ ...fixture, branches: [], services: [], staff: [] }} />);
        expect(screen.queryByText(dictionary['business.hero.bookable'])).toBeNull();
        expect(screen.queryByRole('link', { name: dictionary['business.info.bookButton'], exact: true })).toBeNull();
        expect(container.querySelectorAll('a[href*="/booking"]')).toHaveLength(0);
        expect(screen.getAllByText(dictionary['booking.empty.noBranches']).length).toBeGreaterThan(0);
        expect(screen.getByRole('link', { name: dictionary['business.cta.backToCatalog'] }).getAttribute('href')).toBe('/');
        expect(screen.getByRole('heading', { name: fixture.biz.name, exact: true })).toBeTruthy();
    });

    it('restores booking actions when active branches become available', () => {
        setLanguage('ru');
        const view = render(<BusinessInfo data={{ ...fixture, branches: [], services: [], staff: [] }} />);
        expect(screen.queryByRole('link', { name: 'Записаться', exact: true })).toBeNull();
        view.rerender(<BusinessInfo data={fixture} />);
        expect(screen.getByText('Онлайн-запись доступна')).toBeTruthy();
        expect(screen.getAllByRole('link', { name: 'Записаться', exact: true })).toHaveLength(2);
        expect(screen.queryByText(ru['booking.empty.noBranches'])).toBeNull();
    });

    it.each([
        ['ru', 1, 'локация', 'услуга', 'специалист'],
        ['ru', 2, 'локации', 'услуги', 'специалиста'],
        ['ru', 5, 'локаций', 'услуг', 'специалистов'],
        ['ru', 11, 'локаций', 'услуг', 'специалистов'],
        ['ru', 21, 'локация', 'услуга', 'специалист'],
        ['en', 1, 'location', 'service', 'specialist'],
        ['en', 2, 'locations', 'services', 'specialists'],
        ['en', 5, 'locations', 'services', 'specialists'],
        ['en', 11, 'locations', 'services', 'specialists'],
        ['en', 21, 'locations', 'services', 'specialists'],
        ['ky', 1, 'жайгашкан жер', 'кызмат', 'адис'],
        ['ky', 2, 'жайгашкан жер', 'кызмат', 'адис'],
        ['ky', 5, 'жайгашкан жер', 'кызмат', 'адис'],
        ['ky', 11, 'жайгашкан жер', 'кызмат', 'адис'],
        ['ky', 21, 'жайгашкан жер', 'кызмат', 'адис'],
    ] as const)('uses correct section count forms for %s/%i', (locale, count, branchNoun, serviceNoun, staffNoun) => {
        setLanguage(locale);
        const data = {
            ...fixture,
            branches: Array.from({ length: count }, (_, i) => ({ ...fixture.branches[0], id: `branch-${i}` })),
            services: Array.from({ length: count }, (_, i) => ({ ...fixture.services[0], id: `service-${i}`, branch_id: 'branch-0' })),
            staff: Array.from({ length: count }, (_, i) => ({ ...fixture.staff[0], id: `staff-${i}`, branch_id: 'branch-0' })),
        };
        render(<BusinessInfo data={data} />);
        for (const noun of [branchNoun, serviceNoun, staffNoun]) {
            expect(screen.getByText(`${count} ${noun}`, { exact: true })).toBeTruthy();
        }
    });

    it.each(['ru', 'ky', 'en'] as const)('provides dictionary entries for every visible product label in %s', locale => {
        const t = setLanguage(locale);
        render(<BusinessInfo data={fixture} />);
        const productKeys = t.mock.calls.map(([key]) => key).filter(key => /^business\.(hero|info|metrics|trust|cta)\./.test(key));
        expect(productKeys.length).toBeGreaterThan(20);
        for (const key of productKeys) expect(dictionaries[locale][key]).toEqual(expect.any(String));
    });

    it.each([
        ['en', 'Branches', 'Services', 'Team', 'Book now', 'Back to catalog', 'Google Maps', 'Yandex Maps', 'Fixture EN'],
        ['ky', 'Филиалдар', 'Кызматтар', 'Команда', 'Жазылуу', 'Каталогго кайтуу', 'Google Карталар', 'Яндекс Карталар', 'Fixture KY'],
    ] as const)('renders translated actions and headings in %s without changing user data or destinations', (locale, branches, services, staff, book, back, google, yandex, serviceName) => {
        setLanguage(locale);
        const { container } = render(<BusinessInfo data={fixture} />);
        for (const title of [branches, services, staff]) expect(screen.getByRole('heading', { name: title, exact: true })).toBeTruthy();
        const bookingLinks = screen.getAllByRole('link', { name: book, exact: true });
        expect(bookingLinks).toHaveLength(2);
        bookingLinks.forEach(link => expect(link.getAttribute('href')).toBe('/b/fixture-business/booking'));
        expect(screen.getByRole('link', { name: back }).getAttribute('href')).toBe('/');
        expect(screen.getByRole('link', { name: google }).getAttribute('href')).toBe('https://example.test/google');
        expect(screen.getByRole('link', { name: yandex }).getAttribute('href')).toBe('https://example.test/yandex');
        expect(screen.getByRole('heading', { name: 'Fixture business' })).toBeTruthy();
        expect(screen.getByText('Fixture address')).toBeTruthy();
        expect(screen.getByRole('heading', { name: serviceName })).toBeTruthy();
        for (const oldCopy of ['Почему можно идти дальше к записи', 'Онлайн-запись доступна', 'Вернуться в каталог', 'Будет доступен в выборе специалиста']) {
            expect(container.textContent).not.toContain(oldCopy);
        }
    });

    it('updates public product copy when the active language changes', () => {
        setLanguage('ru');
        const view = render(<BusinessInfo data={fixture} />);
        expect(screen.getByRole('heading', { name: 'Услуги', exact: true })).toBeTruthy();
        setLanguage('en'); view.rerender(<BusinessInfo data={fixture} />);
        expect(screen.getByRole('heading', { name: 'Services', exact: true })).toBeTruthy();
        expect(screen.queryByRole('heading', { name: 'Услуги', exact: true })).toBeNull();
        setLanguage('ky'); view.rerender(<BusinessInfo data={fixture} />);
        expect(screen.getByRole('heading', { name: 'Кызматтар', exact: true })).toBeTruthy();
    });
});

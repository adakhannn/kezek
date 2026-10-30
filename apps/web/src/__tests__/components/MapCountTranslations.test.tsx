/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import MapPageClient from '@/app/map/MapPageClient';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/lib/yamaps', () => ({ loadYandexMaps: async () => ({
    Map: class { geoObjects = { add: jest.fn(), removeAll: jest.fn() }; controls = { add: jest.fn() }; setCenter = jest.fn(); destroy = jest.fn(); },
    control: { ZoomControl: class {} },
}) }));

const dictionaries = { ru, en, ky };

describe('map place count follows its actual number and locale', () => {
    it.each([
        ['ru', 0, 'мест для записи'],
        ['ru', 1, 'место для записи'],
        ['ru', 2, 'места для записи'],
        ['ru', 5, 'мест для записи'],
        ['ru', 11, 'мест для записи'],
        ['ru', 21, 'место для записи'],
        ['en', 0, 'places to book'],
        ['en', 1, 'place to book'],
        ['en', 2, 'places to book'],
        ['en', 5, 'places to book'],
        ['en', 11, 'places to book'],
        ['en', 21, 'places to book'],
        ['ky', 0, 'жазылуу үчүн жай'],
        ['ky', 1, 'жазылуу үчүн жай'],
        ['ky', 2, 'жазылуу үчүн жай'],
        ['ky', 5, 'жазылуу үчүн жай'],
        ['ky', 11, 'жазылуу үчүн жай'],
        ['ky', 21, 'жазылуу үчүн жай'],
    ] as const)('%s/%i renders its count form', async (locale, count, label) => {
        const dictionary = dictionaries[locale];
        jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
        global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ ok: true, data: Array.from({ length: count }, (_, i) => ({
            id: `branch-${i}`, businessId: 'fixture-biz', businessName: 'Fixture business', businessSlug: 'fixture-business',
            branchName: `Branch ${i}`, address: 'Fixture street', lat: 40, lon: 72, categoryId: 'salon', categoryName: 'Salon',
        })) }) });
        render(<MapPageClient />);
        expect(await screen.findByText(`${count} ${label}`, { exact: true })).toBeTruthy();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith('/api/branches/map?');
    });
});

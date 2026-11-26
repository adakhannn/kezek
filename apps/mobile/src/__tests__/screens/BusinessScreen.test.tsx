import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import BusinessScreen, { BusinessPageContent } from '../../screens/business/BusinessScreen';
import {
    formatServicePrice,
    promotionTitle,
    resolvePublicContacts,
    sanitizeDirectoryLinks,
    type BusinessPageData,
} from '../../screens/business/businessPageModel';
import { fetchBusinessPage } from '../../screens/business/useBusinessPageData';
import { createTranslate } from '../../i18n';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';

const mockNavigate = jest.fn();
let mockRouteParams: Record<string, unknown> = { slug: 'salon' };

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
    useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('../../lib/analytics', () => ({ trackMobileEvent: jest.fn() }));

const data: BusinessPageData = {
    business: {
        id: 'biz-1',
        slug: 'salon',
        name: 'Salon Aru',
        address: 'Ош, Ленина 1',
        phones: ['+996555000111'],
        contact_phone: '+996555000111',
        contact_whatsapp: '+996555000222',
        contact_email: null,
        website_url: 'http://insecure.example',
        rating_score: 50,
    },
    branches: [
        {
            id: 'br-1',
            name: 'Центр',
            address: 'Ленина 1',
            rating_score: 90,
            directory_links: {
                instagram: 'instagram.com/salon',
                two_gis: 'https://evil.example/2gis',
                google_maps: 'https://maps.google.com/?q=1',
                yandex_maps: null,
            },
            inherit_business_contacts: true,
        },
    ],
    services: [
        { id: 's-1', name_ru: 'Стрижка', name_en: 'Haircut', duration_min: 45, price_from: 1000, price_to: 1500, branch_id: 'br-1' },
        { id: 's-2', name_ru: 'Укладка', duration_min: 30, price_from: null, price_to: null, branch_id: 'br-1' },
    ],
    staff: [{ id: 'st-1', full_name: 'Айгуль', branch_id: 'br-1', avatar_url: null, rating_score: null }],
    promotions: [
        {
            id: 'p-1',
            branch_id: 'br-1',
            promotion_type: 'first_visit_discount',
            title_ru: '',
            description_ru: 'Для новых клиентов на любую услугу',
            params: { discount_percent: 20 },
            valid_to: '2026-12-31',
        },
    ],
};

describe('business page model', () => {
    const t = createTranslate('ru');

    test('directory links lead only to their own service, as on the web', () => {
        expect(sanitizeDirectoryLinks(data.branches[0].directory_links)).toEqual({
            instagram: 'https://instagram.com/salon',
            two_gis: null,
            google_maps: 'https://maps.google.com/?q=1',
            yandex_maps: null,
        });
    });

    test('contacts: branch values, then the business ones; only an https website', () => {
        expect(resolvePublicContacts(data.business, data.branches[0])).toEqual({
            phone: '+996555000111',
            whatsapp: '+996555000222',
            email: null,
            website: null,
        });
        expect(resolvePublicContacts(data.business, { ...data.branches[0], inherit_business_contacts: false }).phone).toBeNull();
    });

    test('prices and promotion texts', () => {
        expect(formatServicePrice(data.services[0], t)).toBe(`${(1000).toLocaleString('ru-RU')}–${(1500).toLocaleString('ru-RU')} сом`);
        expect(formatServicePrice(data.services[1], t)).toBe('Цена по запросу');
        expect(promotionTitle(data.promotions[0], t)).toBe('Скидка 20% на первый визит');
        expect(promotionTitle({ ...data.promotions[0], title_ru: 'Осень', title_en: 'Autumn' }, createTranslate('en'))).toBe('Autumn');
    });
});

describe('BusinessPageContent', () => {
    beforeEach(() => {
        jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    });

    afterEach(() => jest.restoreAllMocks());

    test('shows the rating on the 0-5 scale, branches, services, staff and promotions', () => {
        const onBook = jest.fn();
        render(<BusinessPageContent data={data} onBook={onBook} onOpenMap={jest.fn()} />);

        expect(screen.getByText('Salon Aru')).toBeTruthy();
        // The badge is hidden from screen readers (the card label carries the rating).
        const hidden = { includeHiddenElements: true };
        expect(screen.getByText('2.5', hidden)).toBeTruthy();
        expect(screen.getByText('4.5', hidden)).toBeTruthy();
        expect(screen.queryByText('50.0', hidden)).toBeNull();
        expect(screen.getByText('1 акция')).toBeTruthy();
        expect(screen.getByText('Стрижка')).toBeTruthy();
        expect(screen.getByText('45 мин')).toBeTruthy();
        expect(screen.getByText('Айгуль')).toBeTruthy();
        expect(screen.getByText('Скидка 20% на первый визит')).toBeTruthy();
        expect(screen.getByText('Для новых клиентов на любую услугу')).toBeTruthy();
        expect(screen.getByText('Центр · до 31.12.2026')).toBeTruthy();

        // Only the links of their own services; 2GIS pointed elsewhere and is hidden.
        expect(screen.getByLabelText('Instagram')).toBeTruthy();
        expect(screen.getByLabelText('Google Карты')).toBeTruthy();
        expect(screen.queryByLabelText('2ГИС')).toBeNull();
        fireEvent.press(screen.getByLabelText('Instagram'));
        expect(Linking.openURL).toHaveBeenCalledWith('https://instagram.com/salon');

        fireEvent.press(screen.getAllByText('Записаться')[0]);
        expect(onBook).toHaveBeenCalled();
    });

    test('a business without branches cannot be booked', () => {
        render(<BusinessPageContent data={{ ...data, branches: [] }} onBook={jest.fn()} onOpenMap={jest.fn()} />);

        expect(screen.queryByText('Записаться')).toBeNull();
        expect(screen.getByText('У этого бизнеса нет активных филиалов. Пожалуйста, вернитесь позже.')).toBeTruthy();
    });
});

describe('BusinessScreen', () => {
    const mockedFrom = supabase.from as jest.Mock;

    function table(result: { data: unknown; error: null }) {
        const builder: Record<string, jest.Mock> = {};
        for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
            builder[method] = jest.fn(() => builder);
        }
        builder.maybeSingle = jest.fn(async () => result);
        (builder as unknown as { then: unknown }).then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
        return builder;
    }

    beforeEach(() => {
        mockNavigate.mockClear();
        mockRouteParams = { slug: 'salon', previewName: 'Salon Aru' };
        mockedFrom.mockImplementation((name: string) => {
            switch (name) {
                case 'businesses':
                    return table({ data: data.business, error: null });
                case 'branches':
                    return table({ data: data.branches, error: null });
                case 'services':
                    return table({ data: data.services, error: null });
                case 'staff':
                    return table({ data: data.staff, error: null });
                case 'branch_promotions':
                    return table({ data: data.promotions, error: null });
                default:
                    return table({ data: [], error: null });
            }
        });
    });

    test('reads the public tables like the web page and opens the booking flow for the slug', async () => {
        const page = await fetchBusinessPage('salon');
        expect(page?.business.id).toBe('biz-1');
        expect(page?.promotions).toHaveLength(1);
        expect(mockedFrom.mock.calls.map(([name]) => name)).toEqual([
            'businesses',
            'branches',
            'services',
            'staff',
            'branch_promotions',
        ]);

        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <BusinessScreen />
            </QueryClientProvider>,
        );

        fireEvent.press((await screen.findAllByText('Записаться'))[0]);
        expect(mockNavigate).toHaveBeenCalledWith('Booking', { slug: 'salon', previewName: 'Salon Aru' });
    });

    test('an unknown slug shows the not-found state', async () => {
        mockedFrom.mockImplementation(() => table({ data: null, error: null }));

        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <BusinessScreen />
            </QueryClientProvider>,
        );

        expect(await screen.findByText('Бизнес не найден')).toBeTruthy();
        fireEvent.press(screen.getByText('Вернуться в каталог'));
        expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'Home' });
    });
});

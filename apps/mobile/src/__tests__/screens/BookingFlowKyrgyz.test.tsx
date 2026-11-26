/**
 * The booking steps and the home lists in Kyrgyz: the language stored on the device is used.
 */
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { BookingProvider } from '../../contexts/BookingContext';
import { createTranslate, LanguageProvider } from '../../i18n';
import { setRequestLocale } from '../../i18n/locale';
import { LOCALE_STORAGE_KEY } from '../../i18n/localeStorage';
import { supabase } from '../../lib/supabase';
import BookingStep1Branch from '../../screens/booking/BookingStep1Branch';
import BookingStep4Date from '../../screens/booking/BookingStep4Date';
import { formatBookingDateLabel, formatBookingPrice } from '../../screens/booking/bookingFormat';
import { BusinessListSection, NearbySection } from '../../screens/home/DiscoverySections';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
    useRoute: () => ({ params: { slug: 'test-business-slug' } }),
}));

jest.mock('../../lib/analytics', () => ({ trackMobileEvent: jest.fn() }));

jest.mock('../../hooks/useBusinessWithBranches', () => ({
    useBusinessWithBranches: () => ({
        isLoading: false,
        data: {
            business: { id: 'test-business-id', name: 'Test Salon', slug: 'test-business-slug', rating_score: 4.8 },
            branches: [{ id: 'branch-1', name: 'Main Branch', rating_score: 4.7 }],
        },
    }),
}));

function renderInKyrgyz(component: React.ReactElement) {
    return render(
        <LanguageProvider>
            <QueryClientProvider client={createTestQueryClient()}>
                <BookingProvider>{component}</BookingProvider>
            </QueryClientProvider>
        </LanguageProvider>,
    );
}

describe('booking flow in Kyrgyz', () => {
    jest.setTimeout(30000);

    beforeEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
            key === LOCALE_STORAGE_KEY ? 'ky' : null,
        );
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
    });

    afterEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockReset();
        setRequestLocale('ru');
    });

    test('step 1 shows the progress and the button in Kyrgyz', async () => {
        renderInKyrgyz(<BookingStep1Branch />);

        expect(await screen.findByLabelText('Кадам 1 / 6, Филиал', {}, { timeout: 15000 })).toBeTruthy();
        expect(screen.getByText('Филиал')).toBeTruthy();
        expect(screen.getByText('Улантуу')).toBeTruthy();
        expect(screen.getByText('Main Branch')).toBeTruthy();
        expect(screen.queryByText('Дальше')).toBeNull();
    });

    test('step 4 marks today in Kyrgyz', async () => {
        renderInKyrgyz(<BookingStep4Date />);

        expect(await screen.findByText('Бүгүн', {}, { timeout: 15000 })).toBeTruthy();
        expect(screen.getByText('Артка')).toBeTruthy();
        expect(screen.queryByText('Сегодня')).toBeNull();
    });

    test('home lists speak Kyrgyz', async () => {
        render(
            <LanguageProvider>
                <NearbySection
                    branches={[]}
                    status="idle"
                    error={null}
                    onRequestNearby={jest.fn()}
                    onOpenMap={jest.fn()}
                    onOpenBusiness={jest.fn()}
                />
                <BusinessListSection
                    businesses={[]}
                    isLoading={false}
                    isRefreshing={false}
                    error={null}
                    search="kezek"
                    selectedCategory={null}
                    onRetry={jest.fn()}
                    onClearFilters={jest.fn()}
                    onOpenBusiness={jest.fn()}
                />
            </LanguageProvider>,
        );

        expect(await screen.findByText('Жакынкы филиалдар', {}, { timeout: 15000 })).toBeTruthy();
        expect(screen.getByText('Жакындан табуу')).toBeTruthy();
        expect(screen.getByText('Эч нерсе табылган жок')).toBeTruthy();
        expect(screen.getByText('Чыпкаларды тазалоо')).toBeTruthy();
    });
});

describe('booking formatters', () => {
    test('Kyrgyz dates and prices are deterministic', () => {
        expect(formatBookingDateLabel('2026-11-23', 'ky')).toEqual({
            day: 23,
            month: 'ноябрь',
            weekday: 'Дш',
            dayMonth: '23-ноябрь',
        });
        expect(formatBookingDateLabel('2026-11-23', 'en').dayMonth).toBe('November 23');

        const ky = createTranslate('ky');
        expect(formatBookingPrice({ price_from: 500, price_to: null }, ky)).toBe('500 сомдон');
        expect(formatBookingPrice({ price_from: 500, price_to: 800 }, ky, { compact: true })).toBe('500–800 сом');
    });

    test('Russian prices keep the previous wording', () => {
        const ru = createTranslate('ru');
        expect(formatBookingPrice({ price_from: 500, price_to: null }, ru)).toBe('от 500 сом');
        expect(formatBookingPrice({ price_from: 500, price_to: null }, ru, { compact: true })).toBe('500 сом');
        expect(formatBookingPrice({ price_from: 500, price_to: 800 }, ru)).toBe('500 - 800 сом');
        expect(formatBookingPrice({ price_from: null, price_to: 800 }, ru, { compact: true })).toBe('до 800 сом');
    });
});

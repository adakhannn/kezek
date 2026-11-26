/**
 * C6: service names and promotion titles follow the app language (name_ky/name_en,
 * title_ky/title_en) with the Russian text as the fallback, as on the website.
 */
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { createTranslate, LanguageProvider } from '../../i18n';
import { setRequestLocale } from '../../i18n/locale';
import { LOCALE_STORAGE_KEY } from '../../i18n/localeStorage';
import { supabase } from '../../lib/supabase';
import BookingStep2Service from '../../screens/booking/BookingStep2Service';
import { describePromotion } from '../../screens/booking/bookingSelection';
import { BookingDetailsSections } from '../../screens/bookingDetails/BookingDetailsSections';
import type { BookingDetails } from '../../screens/bookingDetails/types';
import { bookingTitle, mapClientBookingListItemToBooking } from '../../screens/cabinet/types';
import { UpcomingBookingsSection } from '../../screens/home/BookingActivitySections';
import { getPromotionTitle, getServiceName } from '../../utils/i18n';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }),
    useRoute: () => ({ params: {} }),
}));
jest.mock('../../lib/analytics', () => ({ trackMobileEvent: jest.fn() }));

const mockBooking = {
    bookingData: {
        business: { id: 'biz-1', name: 'Salon', slug: 'salon', rating_score: null },
        branchId: 'branch-1',
        serviceIds: ['s-1'],
        services: [],
        promotions: [],
    },
    setServices: jest.fn(),
    setServiceId: jest.fn(),
    toggleServiceId: jest.fn(),
};
jest.mock('../../contexts/BookingContext', () => ({
    useBooking: () => mockBooking,
}));

/** A supabase query chain that answers `result` whatever filters are applied. */
function chain(result: unknown) {
    const query: Record<string, jest.Mock | unknown> = {};
    for (const name of ['select', 'eq', 'in', 'order']) query[name] = jest.fn(() => query);
    query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
    return query as Record<string, jest.Mock>;
}

function useStoredLocale(locale: 'ru' | 'ky' | 'en') {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
        key === LOCALE_STORAGE_KEY ? locale : null,
    );
}

beforeEach(() => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
});

afterEach(() => {
    (SecureStore.getItemAsync as jest.Mock).mockReset();
    jest.mocked(supabase.from).mockReset();
    setRequestLocale('ru');
});

describe('catalog name helpers', () => {
    test('getServiceName: ky/en names when filled, else the Russian name (transliterated for en, as the web)', () => {
        const service = { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut' };
        expect(getServiceName(service, 'ru')).toBe('Стрижка');
        expect(getServiceName(service, 'ky')).toBe('Чач кыркуу');
        expect(getServiceName(service, 'en')).toBe('Haircut');
        expect(getServiceName({ name_ru: 'Стрижка', name_ky: '' }, 'ky')).toBe('Стрижка');
        expect(getServiceName({ name_ru: 'Маникюр' }, 'en')).toMatch(/^Manik/);
    });

    test('promotion titles: ky/en titles, else the Russian title, else the type text', () => {
        const promo = { promotion_type: 'custom', title_ru: 'Акция', title_ky: 'Акция KY', title_en: 'Sale', params: null };
        expect(getPromotionTitle(promo, 'en')).toBe('Sale');
        expect(describePromotion(promo, createTranslate('ky'))).toBe('Акция KY');
        expect(describePromotion({ ...promo, title_en: null }, createTranslate('en'))).toBe('Акция');
        expect(describePromotion({ ...promo, title_ru: null, title_ky: null, title_en: null }, createTranslate('en'))).toBe(
            'A special offer is available',
        );
    });

    test('cabinet card title uses the ky/en names of all services', () => {
        const booking = mapClientBookingListItemToBooking({
            id: 'b-1',
            start_at: '2099-01-01T10:00:00Z',
            end_at: '2099-01-01T11:00:00Z',
            status: 'confirmed',
            service: { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut' },
            staff: null,
            branch: null,
            business: null,
            services: [
                { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut', duration_min: 30 },
                { name_ru: 'Борода', name_ky: null, name_en: 'Beard', duration_min: 15 },
            ],
        });
        expect(bookingTitle(booking, 'ky')).toBe('Чач кыркуу + Борода');
        expect(bookingTitle(booking, 'en')).toBe('Haircut + Beard');
        expect(bookingTitle({ ...booking, services: [] }, 'ky')).toBe('Чач кыркуу');
        // An older server or offline copy without services: the main service.
        expect(bookingTitle({ ...booking, services: undefined, service: { name_ru: 'Стрижка' } }, 'ky')).toBe('Стрижка');
    });
});

describe('screens show catalog names in the app language', () => {
    jest.setTimeout(30000);

    test('booking step 2 lists services in Kyrgyz and reads the ky/en columns', async () => {
        useStoredLocale('ky');
        const query = chain({
            data: [
                { id: 's-1', name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut', duration_min: 30, price_from: 500, price_to: null, branch_id: 'branch-1' },
                { id: 's-2', name_ru: 'Укладка', name_ky: null, name_en: null, duration_min: 20, price_from: null, price_to: null, branch_id: 'branch-1' },
            ],
            error: null,
        });
        jest.mocked(supabase.from).mockImplementation(() => query as never);

        render(
            <LanguageProvider>
                <QueryClientProvider client={createTestQueryClient()}>
                    <BookingStep2Service />
                </QueryClientProvider>
            </LanguageProvider>,
        );

        expect(await screen.findByText('Чач кыркуу', {}, { timeout: 15000 })).toBeTruthy();
        expect(screen.getByText('Укладка')).toBeTruthy();
        expect(screen.queryByText('Стрижка')).toBeNull();
        expect(query.select).toHaveBeenCalledWith(expect.stringContaining('name_ky, name_en'));
    });

    test('booking details show the English service names and promotion title', async () => {
        useStoredLocale('en');
        const booking: BookingDetails = {
            id: 'b-1',
            start_at: '2099-01-01T10:00:00Z',
            end_at: '2099-01-01T11:00:00Z',
            status: 'confirmed',
            viewer_role: 'client',
            service: { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut', duration_min: 30, price_from: null, price_to: null },
            staff: null,
            branch: null,
            business: null,
            promotion: { title: 'Скидка', title_ky: 'Арзандатуу', title_en: 'Discount', discount_percent: null, final_amount: null },
        };
        const noop = jest.fn();

        render(
            <LanguageProvider>
                <BookingDetailsSections
                    booking={booking}
                    timelineSteps={[]}
                    canCancel={false}
                    isCancelling={false}
                    canReschedule={false}
                    startedNotice={false}
                    benefitRescheduleNotice={false}
                    primaryPhone={null}
                    onRepeat={noop}
                    onCancel={noop}
                    onReschedule={noop}
                    onCall={noop}
                    onWhatsApp={noop}
                />
            </LanguageProvider>,
        );

        expect(await screen.findByText('Haircut', {}, { timeout: 15000 })).toBeTruthy();
        expect(screen.getByText(/Discount/)).toBeTruthy();
        expect(screen.queryByText('Стрижка')).toBeNull();
        expect(screen.queryByText(/Скидка/)).toBeNull();
    });

    test('home upcoming bookings show the Kyrgyz service name', async () => {
        useStoredLocale('ky');

        render(
            <LanguageProvider>
                <UpcomingBookingsSection
                    bookings={[
                        {
                            id: 'b-1',
                            start_at: '2099-01-01T10:00:00Z',
                            end_at: '2099-01-01T11:00:00Z',
                            status: 'confirmed',
                            business: { name: 'Salon', slug: 'salon', tz: null },
                            branch: null,
                            service: { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: 'Haircut' },
                        },
                    ]}
                    onOpenAll={jest.fn()}
                    onOpenBooking={jest.fn()}
                />
            </LanguageProvider>,
        );

        expect(await screen.findByText('Чач кыркуу', {}, { timeout: 15000 })).toBeTruthy();
        expect(screen.queryByText('Стрижка')).toBeNull();
    });
});

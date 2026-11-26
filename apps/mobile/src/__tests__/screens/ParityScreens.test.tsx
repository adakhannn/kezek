import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { createTranslate } from '../../i18n';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import PromotionsScreen from '../../screens/business/PromotionsScreen';
import { groupPromotionsByBranch, promotionDetail, promotionPeriod } from '../../screens/business/promotionsModel';
import type { BusinessPageData, BusinessPagePromotion } from '../../screens/business/businessPageModel';
import { useBusinessPageData } from '../../screens/business/useBusinessPageData';
import { fetchServerCurrentBusinessId } from '../../screens/dashboard/useDashboardScreenData';
import {
    bookableSlots,
    buildInternalBookingInput,
    createInternalBooking,
    pickedServices,
    servicesOfBranch,
    totalDuration,
    type StaffBookingService,
} from '../../screens/staff/staffCreateBooking';
import { staffServicePriceKey, toStaffServices } from '../../screens/staff/useStaffServices';
import { createTestQueryClient } from '../testQueryClient';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
    useRoute: () => ({ params: { slug: 'salon' } }),
}));
jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../screens/business/useBusinessPageData', () => ({ useBusinessPageData: jest.fn() }));
jest.mock('../../lib/bookingRequest', () => ({
    getBookingRequestKey: jest.fn(async () => '11111111-2222-4333-8444-555555555555'),
    acknowledgeBookingRequest: jest.fn(async () => undefined),
}));

const ru = createTranslate('ru');
const mockedApi = apiRequest as jest.Mock;

const promo = (extra: Partial<BusinessPagePromotion>): BusinessPagePromotion => ({
    id: 'p', branch_id: 'br-1', promotion_type: 'first_visit_discount', title_ru: null, params: { discount_percent: 10 }, ...extra,
});

describe('promotions page model', () => {
    const branches = [
        { id: 'br-1', name: 'Центр', address: 'Ленина 1', rating_score: null },
        { id: 'br-2', name: 'Юг', address: null, rating_score: null },
    ] as BusinessPageData['branches'];

    test('groups by branch in the order of the first promotion', () => {
        const groups = groupPromotionsByBranch([promo({ id: 'a', branch_id: 'br-2' }), promo({ id: 'b' }), promo({ id: 'c', branch_id: 'br-2' })], branches);
        expect(groups.map((group) => [group.branchId, group.promotions.map((item) => item.id)])).toEqual([['br-2', ['a', 'c']], ['br-1', ['b']]]);
        expect(groups[1].branch?.name).toBe('Центр');
    });

    test('detail and validity texts', () => {
        expect(promotionDetail(promo({}), ru)).toBe('Скидка 10%');
        expect(promotionDetail(promo({ promotion_type: 'free_after_n_visits', params: { visit_count: 5 } }), ru)).toBe('Каждая 5-я услуга бесплатно');
        expect(promotionDetail(promo({ promotion_type: 'referral_free', params: {} }), ru)).toBeNull();
        expect(promotionPeriod(promo({ valid_from: '2026-11-01', valid_to: null }), ru)).toBe('Действует: 01.11.2026 — без ограничений');
        expect(promotionPeriod(promo({}), ru)).toBeNull();
    });
});

const mockPage = (data: BusinessPageData) =>
    (useBusinessPageData as jest.Mock).mockReturnValue({ data, isLoading: false, isError: false, isRefetching: false, refetch: jest.fn() });

describe('PromotionsScreen', () => {
    test('shows the promotions by branch and books from there', async () => {
        mockPage({
            business: { id: 'b', slug: 'salon', name: 'Salon Aru', address: 'Ош', phones: [], rating_score: null },
            branches: [{ id: 'br-1', name: 'Центр', address: 'Ленина 1', rating_score: null }],
            services: [],
            staff: [],
            promotions: [promo({ id: 'p1', title_ru: 'Первый визит', description_ru: 'Для новых клиентов', valid_to: '2026-12-31' })],
        } satisfies BusinessPageData);
        render(<QueryClientProvider client={createTestQueryClient()}><PromotionsScreen /></QueryClientProvider>);

        // The header says "Акции"; the page opens with the business.
        expect(await screen.findByText('Salon Aru')).toBeTruthy();
        expect(screen.getByText('Первый визит')).toBeTruthy();
        expect(screen.getByText('Скидка 10%')).toBeTruthy();
        expect(screen.getByText('Действует: с начала — 31.12.2026')).toBeTruthy();
        expect(screen.getByTestId('promotions-branch-br-1')).toBeTruthy();

        fireEvent.press(screen.getByText('Записаться сейчас'));
        expect(mockNavigate).toHaveBeenCalledWith('Booking', { slug: 'salon', previewName: 'Salon Aru' });
    });

    test('no promotions', async () => {
        mockPage({
            business: { id: 'b', slug: 'salon', name: 'Salon Aru', address: null, phones: [], rating_score: null },
            branches: [], services: [], staff: [], promotions: [],
        });
        render(<QueryClientProvider client={createTestQueryClient()}><PromotionsScreen /></QueryClientProvider>);
        expect(await screen.findByText('На данный момент нет активных акций')).toBeTruthy();
    });
});

describe('staff booking of a client (web CreateBookingForm)', () => {
    const services: StaffBookingService[] = [
        { id: 's1', name_ru: 'Стрижка', duration_min: 45, branch_id: 'br-1' },
        { id: 's2', name_ru: 'Укладка', duration_min: 30, branch_id: 'br-1' },
        { id: 's3', name_ru: 'Маникюр', duration_min: 60, branch_id: 'br-2' },
    ];

    test('services of the branch, in the order picked, and their total', () => {
        expect(servicesOfBranch(services, 'br-1').map((service) => service.id)).toEqual(['s1', 's2']);
        expect(servicesOfBranch(services, '')).toEqual([]);
        const picked = pickedServices(servicesOfBranch(services, 'br-1'), ['s2', 's1', 's3']);
        expect(picked.map((service) => service.id)).toEqual(['s2', 's1']);
        expect(totalDuration(picked)).toBe(75);
    });

    test('slots: this master and branch, more than 30 minutes ahead, each start once', () => {
        const now = new Date('2026-11-26T10:00:00Z');
        const slot = (start: string, staff = 'st1', branch = 'br-1') => ({ staff_id: staff, branch_id: branch, start_at: start, end_at: start });
        const result = bookableSlots([
            slot('2026-11-26T10:15:00Z'),
            slot('2026-11-26T11:00:00Z'),
            slot('2026-11-26T11:00:00Z'),
            slot('2026-11-26T12:00:00Z', 'st2'),
            slot('2026-11-26T13:00:00Z', 'st1', 'br-2'),
        ], 'st1', 'br-1', now);
        expect(result.map((item) => item.start_at)).toEqual(['2026-11-26T11:00:00Z']);
    });

    test('one service is a simple booking, several a complex one', () => {
        const base = { bizId: 'b', branchId: 'br-1', staffId: 'st1', startAt: '2026-11-26T11:00:00Z', clientName: ' Aida ', clientPhone: ' +996555000111 ' };
        expect(buildInternalBookingInput({ ...base, services: [services[0]] })).toEqual({
            mode: 'simple', biz_id: 'b', branch_id: 'br-1', staff_id: 'st1', service_id: 's1', start_at: base.startAt,
            duration_min: 45, client_id: null, client_name: 'Aida', client_phone: '+996555000111',
        });
        const complex = buildInternalBookingInput({ ...base, services: [services[1], services[0]] });
        expect(complex.mode).toBe('complex');
        expect(complex.mode === 'complex' && complex.services).toEqual([
            { service_id: 's2', duration_min: 30, order_index: 0 },
            { service_id: 's1', duration_min: 45, order_index: 1 },
        ]);
    });

    test('sends /api/bookings/internal with the Idempotency-Key and needs a confirmed answer', async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
        mockedApi.mockResolvedValueOnce({ ok: true, data: { booking_id: 'bk-123456789', confirmed: true } });
        const input = buildInternalBookingInput({
            bizId: 'b', branchId: 'br-1', staffId: 'st1', startAt: 'x', clientName: 'A', clientPhone: '+1', services: [services[0]],
        });

        await expect(createInternalBooking(input)).resolves.toBe('bk-123456789');
        expect(mockedApi).toHaveBeenCalledWith('/api/bookings/internal', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ 'Idempotency-Key': '11111111-2222-4333-8444-555555555555' }),
        }));

        mockedApi.mockResolvedValueOnce({ ok: true, data: { booking_id: 'bk', confirmed: false } });
        await expect(createInternalBooking(input)).rejects.toThrow('Booking was not confirmed');
    });
});

describe('staff services (web "Мои услуги")', () => {
    test('active services of active assignments only', () => {
        const service = { id: 's1', name_ru: 'Стрижка', duration_min: 45, price_from: 500, price_to: null };
        expect(toStaffServices([
            { is_active: true, services: { ...service, active: true } },
            { is_active: true, services: [{ ...service, id: 's2', active: false }] },
            { is_active: false, services: { ...service, id: 's3', active: true } },
            { is_active: true, services: null },
        ])).toEqual([service]);
    });

    test('price text', () => {
        expect(staffServicePriceKey({ price_from: 500, price_to: 800 })).toEqual({ key: 'parity.staffServices.priceBetween', params: { from: '500', to: '800' } });
        expect(staffServicePriceKey({ price_from: null, price_to: 800 })?.key).toBe('parity.staffServices.priceToValue');
        expect(staffServicePriceKey({ price_from: null, price_to: null })).toBeNull();
    });
});

describe('current business of the web cabinet', () => {
    test('reads the server choice', async () => {
        mockedApi.mockResolvedValueOnce({ ok: true, data: { currentBizId: 'biz-2', businesses: [] } });
        await expect(fetchServerCurrentBusinessId()).resolves.toBe('biz-2');
        expect(mockedApi).toHaveBeenCalledWith('/me/current-business');
        mockedApi.mockResolvedValueOnce({ ok: false });
        await expect(fetchServerCurrentBusinessId()).resolves.toBeNull();
    });
});

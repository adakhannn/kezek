/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { formatInTimeZone } from 'date-fns-tz';

import { branchesRu } from '@/app/_components/i18n/dictionaries/branches.ru';
import MyVisitPackagesBlock from '@/app/cabinet/components/MyVisitPackagesBlock';
import { CalendarDaySection } from '@/app/dashboard/bookings/components/BookingsViewSections';
import BranchPromotionsPanel from '@/app/dashboard/branches/[id]/BranchPromotionsPanel';
import { TransfersTab } from '@/app/dashboard/staff/[id]/schedule/TransfersTab';
import { CreateBookingForm } from '@/app/staff/bookings/CreateBookingForm';
import { getFreeSlotsForServiceDay } from '@/lib/bookingDashboardService';
import { TZ } from '@/lib/time';

// FE-08: each of these screens used to turn a failed load into an empty state (a vanished block,
// a free-looking day, "no free slots", "no transfers", "no promotions"). A failure is now an
// error with a retry, and a successful empty result keeps its empty state.

const dictionary: Record<string, string> = branchesRu;
const mockLanguage = { locale: 'ru', t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key };
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => mockLanguage }));
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }));
jest.mock('@/lib/funnelEvents', () => ({ getSessionId: () => 'test-session', trackFunnelEvent: jest.fn() }));
jest.mock('@/lib/bookingDashboardService', () => ({
    getFreeSlotsForServiceDay: jest.fn(), getFreeSlotsForComplexDay: jest.fn(),
    createInternalBooking: jest.fn(), createInternalComplexBooking: jest.fn(),
}));
const mockQueryResult = jest.fn();
jest.mock('@/lib/supabaseClient', () => ({ supabase: { from: () => {
    const query: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'neq', 'gte', 'lte', 'lt']) query[name] = () => query;
    query.order = () => mockQueryResult();
    return query;
} } }));

const jsonReply = (body: unknown) => Promise.resolve({ ok: true, json: async () => body });
const retry = () => fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));

beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult.mockReset();
});

describe('client cabinet visit packages', () => {
    const pkg = {
        id: 'pkg-1', plan_id: 'plan-1', plan_name_ru: 'Пять стрижек', plan_name_ky: null, plan_name_en: null,
        remaining_visits: 3, plan_visit_count: 5, valid_until: '2999-01-01', purchased_at: '2026-01-01', created_at: '2026-01-01', is_active: true,
    };

    test.each([
        ['an error envelope', () => jsonReply({ ok: false, error: 'internal' })],
        ['a network failure', () => Promise.reject(new Error('offline'))],
    ])('keeps the heading and shows an error with a retry after %s', async (_label, failure) => {
        global.fetch = jest.fn().mockImplementationOnce(failure).mockImplementationOnce(() => jsonReply({ ok: true, data: { packages: [pkg] } }));
        render(<MyVisitPackagesBlock />);

        expect(await screen.findByText('Не удалось загрузить ваши пакеты визитов')).toBeTruthy();
        expect(screen.getByText('Мои пакеты')).toBeTruthy();
        retry();
        expect(await screen.findByText('Пять стрижек')).toBeTruthy();
        expect(screen.queryByText('Не удалось загрузить ваши пакеты визитов')).toBeNull();
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    test('a client without packages still sees no block', async () => {
        global.fetch = jest.fn().mockImplementation(() => jsonReply({ ok: true, data: { packages: [] } }));
        const { container } = render(<MyVisitPackagesBlock />);
        await waitFor(() => expect(container.innerHTML).toBe(''));
    });
});

describe('owner day calendar', () => {
    const props = {
        bizId: 'biz-1', timezone: 'Asia/Bishkek',
        branches: [{ id: 'branch-1', name: 'Branch one' }],
        staff: [{ id: 'staff-1', full_name: 'Мастер', branch_id: 'branch-1' }],
    };
    const exportButton = () => screen.getByRole('button', { name: 'Экспорт CSV' }) as HTMLButtonElement;

    test('a failed day load is an error with a retry, not a free day of dashes', async () => {
        mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'synthetic' } })
            .mockResolvedValueOnce({ data: [], error: null });
        render(<CalendarDaySection {...props} />);

        expect(await screen.findByText('Не удалось загрузить записи на этот день')).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.queryAllByText('—')).toHaveLength(0);
        expect(exportButton().disabled).toBe(true);

        retry();
        expect(await screen.findByRole('table')).toBeTruthy();
        // A day that loaded and has no bookings keeps its "—" cells.
        expect(screen.getAllByText('—').length).toBeGreaterThan(0);
        expect(exportButton().disabled).toBe(false);
        expect(mockQueryResult).toHaveBeenCalledTimes(2);
    });
});

describe('staff cabinet create-booking form', () => {
    const props = {
        bizId: 'biz-1', staffId: 'staff-1', defaultBranchId: 'branch-1',
        services: [{ id: 'svc-1', name_ru: 'Стрижка', duration_min: 60, active: true, branch_id: 'branch-1' }],
        branches: [{ id: 'branch-1', name: 'Branch one', is_active: true }],
    };
    const slot = { staff_id: 'staff-1', branch_id: 'branch-1', start_at: '2030-01-10T06:00:00Z', end_at: '2030-01-10T07:00:00Z' };

    test('a failed slot load is an error with a retry, not "no free slots"', async () => {
        jest.mocked(getFreeSlotsForServiceDay).mockRejectedValueOnce(new Error('synthetic')).mockResolvedValueOnce([slot]);
        const { container } = render(<CreateBookingForm {...props} />);
        fireEvent.change(container.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2030-01-10' } });
        fireEvent.click(screen.getByRole('checkbox'));

        expect(await screen.findByText('Не удалось загрузить свободное время')).toBeTruthy();
        expect(screen.queryByText('Нет свободных слотов')).toBeNull();
        retry();
        expect(await screen.findByRole('button', { name: formatInTimeZone(new Date(slot.start_at), TZ, 'HH:mm') })).toBeTruthy();
        expect(screen.queryByText('Не удалось загрузить свободное время')).toBeNull();
        expect(getFreeSlotsForServiceDay).toHaveBeenCalledTimes(2);
    });
});

describe('staff schedule temporary transfers tab', () => {
    const branches = [{ id: 'branch-home', name: 'Home branch' }, { id: 'branch-other', name: 'Other branch' }];

    test('a failed read is an error with a retry, not "no temporary transfers"', async () => {
        mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'synthetic' } })
            .mockResolvedValueOnce({ data: [{ id: 'rule-1', date_on: '2030-01-10', branch_id: 'branch-other' }], error: null });
        render(<TransfersTab bizId="biz-1" staffId="staff-1" branches={branches} homeBranchId="branch-home" />);

        expect(await screen.findByText('Не удалось загрузить временные переводы')).toBeTruthy();
        expect(screen.queryByText('Нет временных переводов')).toBeNull();
        retry();
        expect(await screen.findByText('Other branch')).toBeTruthy();
        expect(screen.queryByText('Не удалось загрузить временные переводы')).toBeNull();
    });
});

describe('branch promotions panel', () => {
    const promotion = {
        id: 'promotion-1', title_ru: 'Седьмой визит бесплатно', promotion_type: 'free_after_n_visits',
        params: { visit_count: 7 }, is_active: true, created_at: '2026-10-09T00:00:00Z', usage_count: 0,
    };

    test.each([
        ['an error envelope', () => jsonReply({ ok: false, error: 'internal' })],
        ['a network failure', () => Promise.reject(new Error('offline'))],
    ])('shows an error with a retry, not the empty state, after %s', async (_label, failure) => {
        global.fetch = jest.fn().mockImplementationOnce(failure).mockImplementationOnce(() => jsonReply({ ok: true, data: { promotions: [promotion] } }));
        render(<BranchPromotionsPanel branchId="branch-1" />);

        expect(await screen.findByText(branchesRu['branches.promotions.error.load'])).toBeTruthy();
        expect(screen.queryByText(branchesRu['branches.promotions.emptyTitle'])).toBeNull();
        retry();
        expect(await screen.findByText(promotion.title_ru)).toBeTruthy();
        expect(screen.queryByText(branchesRu['branches.promotions.error.load'])).toBeNull();
    });
});

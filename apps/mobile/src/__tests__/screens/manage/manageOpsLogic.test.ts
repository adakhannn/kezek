import { createTranslate } from '../../../i18n';
import { apiRequest } from '../../../lib/api';
import { fetchAnalytics, loadByHour, presetStart, promoShare, rangeError } from '../../../screens/manage/analytics/analyticsData';
import {
    fetchAllStaffFinance,
    fetchStaffFinanceStats,
    financeDateAnchor,
    financePeriodDate,
    guaranteeTopup,
    shiftFinanceAnchor,
    totalWithConsumables,
} from '../../../screens/manage/finance/financeData';
import { csvCell, toCsv } from '../../../screens/manage/opsKit/csv';
import { addDaysToDate, dayRangeInclusive, hourInTz, isValidDateString, todayInTz } from '../../../screens/manage/opsKit/dates';
import { formatMoney, formatMoneyRounded, formatNumber, formatShare } from '../../../screens/manage/opsKit/money';
import { homeFocus, onboardingItems, type DashboardOverview } from '../../../screens/manage/overview/overviewData';
import { decisionBody, historyNotice } from '../../../screens/manage/roleApplications/roleApplicationsData';
import { parseFormNumber } from '../../../screens/manage/visitPackages/ManageVisitPackagePlanScreen';
import {
    formatBinding,
    formatDiscount,
    NEW_PLAN_FORM,
    planFormError,
    planPayload,
    planTerms,
    sellPackage,
    toggleBranch,
} from '../../../screens/manage/visitPackages/visitPackagesData';

jest.mock('../../../lib/api', () => ({ apiRequest: jest.fn() }));
const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const ru = createTranslate('ru');
const en = createTranslate('en');
const ky = createTranslate('ky');

beforeEach(() => api.mockReset());

describe('money and numbers', () => {
    test('grouped as the website writes them, with the dictionary unit', () => {
        expect(formatNumber(1234567, 'ru')).toBe('1 234 567');
        expect(formatNumber(1234567.5, 'en')).toBe('1,234,567.5');
        expect(formatNumber(-1500.256, 'ru')).toBe('-1 500,26');
        expect(formatNumber(Number.NaN, 'en')).toBe('0');
        expect(formatMoney(15000, ru)).toBe('15 000 сом');
        expect(formatMoney(15000, en)).toBe('15,000 som');
        expect(formatMoney(0, ky)).toBe('0 сом');
        expect(formatMoneyRounded(999.6, ru)).toBe('1 000 сом');
    });

    test('shares of a total', () => {
        expect(formatShare(250, 1000)).toBe('25.0%');
        expect(formatShare(1, 0)).toBe('0%');
        expect(totalWithConsumables({ totalAmount: 1000, totalConsumables: 250 })).toBe(1250);
    });
});

describe('business dates', () => {
    test('today and the day bounds follow businesses.tz', () => {
        const now = new Date('2026-11-26T20:30:00Z');
        expect(todayInTz('Asia/Bishkek', now)).toBe('2026-11-27');
        expect(todayInTz('Europe/London', now)).toBe('2026-11-26');
        expect(dayRangeInclusive('2026-11-27', 'Asia/Bishkek')).toEqual({ start: '2026-11-26T18:00:00.000Z', end: '2026-11-27T17:59:59.999Z' });
        expect(hourInTz('2026-11-26T03:15:00Z', 'Asia/Bishkek')).toBe(9);
        expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01');
        expect(isValidDateString('2026-02-30')).toBe(false);
        expect(isValidDateString('2026-02-28')).toBe(true);
    });
});

describe('csv', () => {
    test('quotes cells and neutralises formulas, keeps phones', () => {
        expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
        expect(csvCell('+996 555 123')).toBe('"+996 555 123"');
        expect(toCsv([['a', null], [1, 'b;=c']])).toBe('"a",""\n"1","b;\'=c"');
    });
});

describe('analytics', () => {
    test('presets include both ends; the period is checked like on the website', () => {
        expect(presetStart('2026-11-26', 30)).toBe('2026-10-28');
        expect(presetStart('2026-11-26', 7)).toBe('2026-11-20');
        expect(rangeError('', '2026-11-26')).toBe('ops.analytics.dateRequired');
        expect(rangeError('2026-11-31', '2026-12-01')).toBe('ops.analytics.dateFormat');
        expect(rangeError('2026-11-27', '2026-11-26')).toBe('ops.analytics.dateOrder');
        expect(rangeError('2026-11-01', '2026-11-26')).toBeNull();
    });

    test('promo share with two decimals and the load by hour', () => {
        const summary = { period: { startDate: '', endDate: '' }, bookings: { created: 0, confirmedOrPaid: 0 },
            funnel: { homeViews: 0, businessPageViews: 0, bookingFlowStarts: 0, conversionHomeToBooking: 0 },
            revenue: { total: 3000, promoBookings: 1, promoRevenue: 1000 } };
        expect(promoShare(summary)).toBe(33.33);
        expect(promoShare({ ...summary, revenue: { ...summary.revenue, total: 0 } })).toBe(0);
        const hours = loadByHour([
            { date: '2026-11-25', hour: 10, bookingsCount: 2, promoBookingsCount: 1 },
            { date: '2026-11-26', hour: 10, bookingsCount: 3, promoBookingsCount: 0 },
            { date: '2026-11-26', hour: 15, bookingsCount: 1, promoBookingsCount: 0 },
        ]);
        expect(hours).toHaveLength(24);
        expect(hours[10]).toEqual({ hour: 10, total: 5, promo: 1, intensity: 1 });
        expect(hours[15].intensity).toBeCloseTo(1 / 3);
        expect(hours[0]).toEqual({ hour: 0, total: 0, promo: 0, intensity: 0 });
    });

    test('reads the overview for the period and the load for the branch', async () => {
        api.mockImplementation(async (endpoint: string) => endpoint.includes('/overview')
            ? { ok: true, data: { summary: {}, byDay: [] } }
            : { ok: true, data: { period: {}, points: [] } });
        await fetchAnalytics('2026-11-01', '2026-11-26', 'br-1');
        expect(api).toHaveBeenCalledWith('/api/dashboard/analytics/overview?startDate=2026-11-01&endDate=2026-11-26');
        expect(api).toHaveBeenCalledWith('/api/dashboard/analytics/load?startDate=2026-11-01&endDate=2026-11-26&branchId=br-1');
        api.mockResolvedValue({ ok: false });
        await expect(fetchAnalytics('2026-11-01', '2026-11-26', 'all')).rejects.toThrow();
    });
});

describe('finance', () => {
    test('period precision and stepping', () => {
        expect(financePeriodDate('day', '2026-11-26')).toBe('2026-11-26');
        expect(financePeriodDate('month', '2026-11-26')).toBe('2026-11');
        expect(financePeriodDate('year', '2026-11-26')).toBe('2026');
        expect(financeDateAnchor('month', '2026-11')).toBe('2026-11-01');
        expect(shiftFinanceAnchor('day', '2026-11-30', 1)).toBe('2026-12-01');
        expect(shiftFinanceAnchor('month', '2026-01-15', -1)).toBe('2025-12-01');
        expect(shiftFinanceAnchor('month', '2026-12-01', 1)).toBe('2027-01-01');
        expect(shiftFinanceAnchor('year', '2026-11-26', -1)).toBe('2025-01-01');
    });

    test('the totals come from the server; the query carries period, date and branch', async () => {
        const totalStats = { totalAmount: 5000, totalMaster: 2500, totalSalon: 2500, totalConsumables: 300, totalLateMinutes: 0, totalShifts: 2, totalOpenShifts: 1, totalClosedShifts: 1 };
        api.mockResolvedValueOnce({ ok: true, data: { dateFrom: '2026-11-01', branches: [{ id: 'br-1', name: 'Центр' }], staffStats: [], totalStats } });
        const result = await fetchAllStaffFinance('month', '2026-11-26', 'br-1');
        expect(api).toHaveBeenCalledWith('/api/dashboard/finance/all?period=month&date=2026-11&branchId=br-1');
        expect(result.totalStats).toBe(totalStats);
        expect(result.dateFrom).toBe('2026-11-01');

        api.mockResolvedValueOnce({ ok: true, data: { staffStats: [] } });
        await fetchAllStaffFinance('day', null, 'all');
        expect(api).toHaveBeenLastCalledWith('/api/dashboard/finance/all?period=day');
    });

    test('one master\'s stats and the guarantee top-up', async () => {
        api.mockResolvedValueOnce({ ok: true, data: { stats: { dateFrom: '2026-11-26', shifts: [] } } });
        await fetchStaffFinanceStats('st 1', 'year', '2026-11-26');
        expect(api).toHaveBeenCalledWith('/api/dashboard/finance/st%201/stats?period=year&date=2026');
        expect(guaranteeTopup({ totalTopupAmount: 700, shifts: [] })).toBe(700);
        expect(guaranteeTopup({ shifts: [
            { guaranteed_amount: 1000, master_share: 600, base_master_share: 600 },
            { guaranteed_amount: 500, master_share: 800, topup_amount: undefined },
        ] as never })).toBe(400);
    });
});

describe('visit packages', () => {
    test('the form is checked in the website order', () => {
        expect(planFormError({ ...NEW_PLAN_FORM, name_ru: ' ' }, ru)).toBe('Название (русский) обязательно');
        expect(planFormError({ ...NEW_PLAN_FORM, name_ru: 'Пакет', visit_count: 0 }, ru)).toBe('Количество визитов: от 1 до 1000');
        expect(planFormError({ ...NEW_PLAN_FORM, name_ru: 'Пакет', validity_days: 4000 }, ru)).toBe('Срок действия: от 1 до 3650 дней');
        expect(planFormError({ ...NEW_PLAN_FORM, name_ru: 'Пакет', discount_value: 101 }, ru)).toBe('При типе «Процент» значение не должно превышать 100');
        expect(planFormError({ ...NEW_PLAN_FORM, name_ru: 'Пакет', discount_type: 'fixed_price', discount_value: 200000 }, ru)).toBe('Значение скидки: от 0 до 100000');
        expect(planFormError({ ...NEW_PLAN_FORM, name_ru: 'Пакет' }, ru)).toBeNull();
    });

    test('payload: trimmed names, empty branches mean all, is_active only when editing', () => {
        const form = { ...NEW_PLAN_FORM, name_ru: ' 5 визитов ', name_ky: ' ', branch_ids: [], is_active: false };
        expect(planPayload(form, false)).toEqual({
            name_ru: '5 визитов', name_ky: null, name_en: null, visit_count: 5, validity_days: 30,
            discount_type: 'percent', discount_value: 10, service_id: null, branch_ids: null,
        });
        expect(planPayload(form, true)).toMatchObject({ is_active: false });
        expect(toggleBranch(null, 'a')).toEqual(['a']);
        expect(toggleBranch(['a'], 'a')).toBeNull();
        expect(parseFormNumber('12,5', true)).toBe(12.5);
        expect(parseFormNumber('abc', false)).toBe(0);
    });

    test('plan texts', () => {
        const plan = { discount_type: 'percent' as const, discount_value: 10, visit_count: 5, validity_days: 30, service_id: null, branch_ids: ['a', 'b'] };
        expect(formatDiscount(plan)).toBe('10%');
        expect(formatDiscount({ ...plan, discount_type: 'fixed_price', discount_value: 450 })).toBe('450');
        expect(formatBinding(plan, ru)).toBe('любая услуга, 2 фил.');
        expect(planTerms(plan, ru)).toBe('Визиты: 5, Срок (дней): 30, Скидка: 10%');
    });

    test('a sale sends the plan with its Idempotency-Key', async () => {
        api.mockResolvedValueOnce({ ok: true, data: {} });
        await sellPackage('client-1', 'plan-1', '11111111-1111-4111-8111-111111111111');
        expect(api).toHaveBeenCalledWith('/api/dashboard/clients/client-1/visit-packages', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ plan_id: 'plan-1' }),
            headers: expect.objectContaining({ 'Idempotency-Key': '11111111-1111-4111-8111-111111111111' }),
        }));
    });
});

describe('staff applications', () => {
    test('the decision body of each action', () => {
        expect(decisionBody({ action: 'approve', branchId: 'br-1', isActive: false, note: 'x' }))
            .toEqual({ action: 'approve', note: undefined, block_days: undefined, block_id: undefined, branch_id: 'br-1', is_active: false });
        expect(decisionBody({ action: 'reject', note: 'Нет опыта', blockDays: 30 }))
            .toEqual({ action: 'reject', note: 'Нет опыта', block_days: 30, block_id: undefined });
        expect(decisionBody({ action: 'unblock', blockId: 'blk-1' }))
            .toEqual({ action: 'unblock', note: undefined, block_days: undefined, block_id: 'blk-1' });
    });

    test('the history notice', () => {
        expect(historyNotice(0, [])).toBeNull();
        expect(historyNotice(2, ['prior_rejection'])).toEqual({
            titleKey: 'ops.applications.history.repeat',
            lines: ['ops.applications.history.scope', 'ops.applications.history.rejected'],
        });
        expect(historyNotice(0, ['something_else'])).toEqual({ titleKey: 'ops.applications.history.title', lines: ['ops.applications.history.other'] });
    });
});

describe('dashboard home', () => {
    const data: DashboardOverview = {
        staffApplications: null, bizName: 'Low Fade', bizCity: null, formattedDate: '2026-11-26T06:00:00Z', timezone: 'Asia/Bishkek',
        bookingsToday: 3, staffActive: 2, servicesActive: 4, branchesCount: 1, needOnboarding: false,
        ratingScore: 70, ratingConfigScope: 'global', ratingWeights: null,
    };

    test('pending applications come first, then setup, today and growth', () => {
        expect(homeFocus({ ...data, staffApplications: { pending: 2 } })).toMatchObject({ kind: 'applications', section: 'roleApplications', count: 2 });
        expect(homeFocus({ ...data, branchesCount: 0, needOnboarding: true })).toMatchObject({
            kind: 'setup', section: 'branches', descriptionKey: 'ops.home.onboarding.noBranches',
        });
        expect(homeFocus({ ...data, staffActive: 0, needOnboarding: true })).toMatchObject({ kind: 'setup', section: 'staff' });
        expect(homeFocus(data)).toMatchObject({ kind: 'today', section: 'bookings' });
        expect(homeFocus({ ...data, bookingsToday: 0 })).toMatchObject({ kind: 'growth', section: 'services' });
        expect(homeFocus({ ...data, staffApplications: { pending: null } }).kind).toBe('today');
    });

    test('the missing setup steps in the website order', () => {
        expect(onboardingItems({ branchesCount: 0, servicesActive: 0, staffActive: 0, bookingsToday: 0 })).toEqual([
            'ops.home.onboarding.noBranches', 'ops.home.onboarding.noServices', 'ops.home.onboarding.noStaff', 'ops.home.onboarding.noBookings',
        ]);
    });
});

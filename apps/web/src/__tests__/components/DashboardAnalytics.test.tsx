/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import Page from '@/app/dashboard/analytics/page';
import { useDashboardAnalyticsPageData } from '@/app/dashboard/analytics/useDashboardAnalyticsPageData';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { analyticsRu, analyticsKy, analyticsEn } from '@/app/_components/i18n/dictionaries/analytics';
import { analyticsPresetStart, analyticsRangeError } from '@/app/dashboard/analytics/analyticsPeriod';

jest.mock('@/app/dashboard/analytics/useDashboardAnalyticsPageData', () => ({useDashboardAnalyticsPageData: jest.fn()}));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({useLanguage: jest.fn()}));

const emptyData = {
    summary: {period: {startDate: '2026-10-03', endDate: '2026-10-09'},
        bookings: {created: 0, confirmedOrPaid: 0},
        funnel: {homeViews: 0, businessPageViews: 0, bookingFlowStarts: 0, conversionHomeToBooking: 0},
        revenue: {total: 0, promoBookings: 0, promoRevenue: 0}}, byDay: [],
};
const base = () => ({loading: false, error: null, rangeError: null, periodPreset: '7' as const,
    startDate: '2026-10-03', endDate: '2026-10-09', branchId: 'all', branches: [{id: 'b1', name: 'Test Branch'}],
    data: {...emptyData,byDay:[{date:'2026-10-09',homeViews:0,businessPageViews:0,bookingFlowStarts:0,bookingsCreated:0,bookingsConfirmedOrPaid:0,promoBookings:0,promoRevenue:0,totalRevenue:0}]}, loadData: {period: emptyData.summary.period, points: []}, trendChartData: null, promoShare: 0,
    setBranchId: jest.fn(), handlePresetChange: jest.fn(), retry: jest.fn(), setStartDateAndCustom: jest.fn(), setEndDateAndCustom: jest.fn()});

beforeEach(() => jest.mocked(useDashboardAnalyticsPageData).mockReturnValue(base()));

test.each([['ru', analyticsRu], ['ky', analyticsKy], ['en', analyticsEn]] as const)(
    'uses %s translations across filters, KPI, trends, load and errors', (locale, dictionary) => {
        jest.mocked(useLanguage).mockReturnValue({locale, t: (key: string) => (dictionary as Record<string,string>)[key] ?? key} as ReturnType<typeof useLanguage>);
        const {unmount} = render(<Page />);
        expect(screen.getByRole('heading', {name: dictionary['analytics.title']})).toBeTruthy();
        expect(screen.getByRole('heading', {name: dictionary['analytics.load']})).toBeTruthy();
        expect(screen.getByText(dictionary['analytics.created'])).toBeTruthy();
        expect(screen.getByLabelText(dictionary['analytics.start'])).toBeTruthy();
        expect(screen.getByRole('option', {name: dictionary['analytics.allBranches']})).toBeTruthy();
        unmount();
        const state = {...base(), error: 'Overview HTTP 400'};
        jest.mocked(useDashboardAnalyticsPageData).mockReturnValue(state);
        render(<Page />);
        expect(screen.getByText(dictionary['analytics.loadError'])).toBeTruthy();
        expect(screen.queryByText('Overview HTTP 400')).toBeNull();
        expect(screen.queryByText(dictionary['analytics.created'])).toBeNull();
        expect(screen.getByLabelText(dictionary['analytics.start'])).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {name: dictionary['analytics.days7']}));
        expect(state.handlePresetChange).toHaveBeenCalledWith('7');
    },
);

test('keeps filters when invalid dates are reported and hides stale statistics', () => {
    const state = {...base(), rangeError: 'analytics.dateOrder' as const};
    jest.mocked(useLanguage).mockReturnValue({locale:'en', t:(key:string)=>(analyticsEn as Record<string,string>)[key] ?? key} as ReturnType<typeof useLanguage>);
    jest.mocked(useDashboardAnalyticsPageData).mockReturnValue(state);
    render(<Page />);
    expect(screen.getByText(analyticsEn['analytics.dateOrder'])).toBeTruthy();
    fireEvent.change(screen.getByLabelText('End'), {target: {value: '2026-10-12'}});
    expect(state.setEndDateAndCustom).toHaveBeenCalledWith('2026-10-12');
    expect(screen.queryByText('Bookings created')).toBeNull();
});

test.each([[7,'2026-10-03'],[30,'2026-09-10'],[90,'2026-07-12']] as const)(
    '%i day preset includes exactly that many calendar days', (days, expected) => {
        expect(analyticsPresetStart('2026-10-09', days)).toBe(expected);
    },
);

test('range validation rejects missing, impossible, malformed and reversed dates', () => {
    expect(analyticsRangeError('', '2026-10-09')).toBe('analytics.dateRequired');
    expect(analyticsRangeError('20260-10-02', '2026-10-09')).toBe('analytics.dateFormat');
    expect(analyticsRangeError('2026-02-30', '2026-10-09')).toBe('analytics.dateFormat');
    expect(analyticsRangeError('2026-10-12', '2026-10-09')).toBe('analytics.dateOrder');
    expect(analyticsRangeError('2026-10-09', '2026-10-09')).toBeNull();
    expect(analyticsRangeError('2024-02-29', '2026-10-09')).toBeNull();
});

test.each([
 ['ru',analyticsRu,'Статистика ещё не рассчитана'],
 ['ky',analyticsKy,'Статистика азырынча эсептелген жок'],
 ['en',analyticsEn,'Statistics have not been calculated yet'],
] as const)('distinguishes absent aggregates from calculated zero in %s',(locale,dictionary,title)=>{
 jest.mocked(useLanguage).mockReturnValue({locale,t:(key:string)=>(dictionary as Record<string,string>)[key]??key} as ReturnType<typeof useLanguage>);
 jest.mocked(useDashboardAnalyticsPageData).mockReturnValue({...base(),data:emptyData});
 render(<Page/>);
 expect(screen.getByRole('heading',{name:title})).toBeTruthy();
 expect(screen.queryByText(dictionary['analytics.created'])).toBeNull();
 expect(screen.queryByText(dictionary['analytics.revenue'])).toBeNull();
 expect(screen.getByLabelText(dictionary['analytics.start'])).toBeTruthy();
});

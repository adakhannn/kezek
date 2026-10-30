/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDashboardAnalyticsPageData } from '@/app/dashboard/analytics/useDashboardAnalyticsPageData';

jest.mock('@/lib/time', () => ({...jest.requireActual('@/lib/time'), todayDateString: () => '2026-10-09'}));

const data = {summary: {period: {startDate:'2026-09-10', endDate:'2026-10-09'}, bookings:{created:0,confirmedOrPaid:0},
    funnel:{homeViews:0,businessPageViews:0,bookingFlowStarts:0,conversionHomeToBooking:0},revenue:{total:0,promoBookings:0,promoRevenue:0}},byDay:[]};
let fetchMock: jest.Mock;
beforeEach(() => {
    fetchMock = jest.fn(async (url: string) => ({ok:true, json:async () => ({ok:true,
        data: url.includes('branches') ? [] : url.includes('overview') ? data : {period:data.summary.period,points:[]}})}));
    global.fetch = fetchMock;
});

it('requests exactly thirty inclusive days by default and changes seven/ninety presets', async () => {
    const {result} = renderHook(useDashboardAnalyticsPageData);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('startDate=2026-09-10&endDate=2026-10-09'), expect.anything());
    act(() => result.current.handlePresetChange('7'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.startDate).toBe('2026-10-03');
    act(() => result.current.handlePresetChange('90'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.startDate).toBe('2026-07-12');
});

it('does not request invalid ranges and recovers through a preset', async () => {
    const {result} = renderHook(useDashboardAnalyticsPageData);
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchMock.mockClear();
    act(() => result.current.setStartDateAndCustom('20260-10-02'));
    expect(result.current.rangeError).toBe('analytics.dateFormat');
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => result.current.setStartDateAndCustom(''));
    expect(result.current.rangeError).toBe('analytics.dateRequired');
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => result.current.handlePresetChange('7'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rangeError).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('startDate=2026-10-03'), expect.anything());
});

it('permits correcting filters after an HTTP error', async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes('overview') ? {ok:false,status:500} : {ok:true,json:async () => ({ok:true,data:[]})});
    const {result} = renderHook(useDashboardAnalyticsPageData);
    await waitFor(() => expect(result.current.error).toBe('Overview HTTP 500'));
    fetchMock.mockImplementation(async (url: string) => ({ok:true,json:async () => ({ok:true,data:url.includes('overview') ? data : {points:[],period:data.summary.period}})}));
    act(() => result.current.handlePresetChange('7'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(data);
});

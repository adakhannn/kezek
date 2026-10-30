/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import AllStaffFinanceStats from '@/app/dashboard/finance/components/AllStaffFinanceStats';
import { AllStaffFinanceStatsFilters } from '@/app/dashboard/finance/components/AllStaffFinanceStatsSections';
import { financeDateAnchor, financePeriodDate } from '@/app/dashboard/finance/components/financePeriodDate';
import { useAllStaffFinanceStatsData } from '@/app/dashboard/finance/components/useAllStaffFinanceStatsData';

const t = (_key: string, fallback?: string) => fallback ?? _key;
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({useLanguage: () => ({locale: 'ru', t})}));
jest.mock('@/app/dashboard/finance/components/useAllStaffFinanceStatsData', () => ({useAllStaffFinanceStatsData: jest.fn()}));

test.each([
    ['day', '2026-10-09', '2026-10-12', '2026-10-12'],
    ['month', '2026-10', '2026-11', '2026-11-01'],
    ['year', '2026', '2027', '2027-01-01'],
] as const)('%s presents the correct native input value and retains a canonical date on change', (period, value, next, anchor) => {
    const onDateChange = jest.fn();
    render(<AllStaffFinanceStatsFilters period={period} date="2026-10-09" branchId="all" branches={[]} loading={false}
        onPeriodChange={jest.fn()} onDateChange={onDateChange} onBranchChange={jest.fn()} onRefresh={jest.fn()} t={t} />);
    fireEvent.change(screen.getByDisplayValue(value), {target: {value: next}});
    expect(onDateChange).toHaveBeenCalledWith(anchor);
});

it('keeps period/date/branch recovery controls visible after a failed request', () => {
    const setPeriod = jest.fn();
    jest.mocked(useAllStaffFinanceStatsData).mockReturnValue({
        loading: false, period: 'month', date: '2026-10-09', staffStats: [], totalStats: null,
        error: 'Invalid query parameters', branches: [{id: 'b1', name: 'Branch One'}], branchId: 'all',
        setPeriod, setDate: jest.fn(), setBranchId: jest.fn(), loadStats: jest.fn(),
    });
    render(<AllStaffFinanceStats />);
    expect(screen.getByText('Invalid query parameters')).toBeTruthy();
    expect(screen.getByDisplayValue('2026-10')).toBeTruthy();
    expect(screen.getByRole('option', {name: 'Branch One'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'День'}));
    expect(setPeriod).toHaveBeenCalledWith('day');
});

it('does not manufacture an invalid anchor when a period input is cleared', () => {
    expect(financeDateAnchor('month', '')).toBe('');
    expect(financeDateAnchor('year', '')).toBe('');
    expect(financePeriodDate('year', financeDateAnchor('year', '20'))).toBe('20');
});

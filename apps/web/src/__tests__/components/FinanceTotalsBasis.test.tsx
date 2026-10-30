/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { AllStaffFinanceStatsTotals } from '@/app/dashboard/finance/components/AllStaffFinanceStatsSections';
import { financeRu } from '@/app/_components/i18n/dictionaries/finance.ru';
import { financeKy } from '@/app/_components/i18n/dictionaries/finance.ky';
import { financeEn } from '@/app/_components/i18n/dictionaries/finance.en';
import type { TotalStats } from '@/app/dashboard/finance/components/allStaffFinanceStatsTypes';

const totals: TotalStats = {
    totalAmount:301,totalConsumables:49,totalMaster:181,totalSalon:169,totalLateMinutes:0,
    totalShifts:1,totalOpenShifts:0,totalClosedShifts:1,
};

test.each([['ru',financeRu],['ky',financeKy],['en',financeEn]] as const)(
    'shows service/material breakdown and one common allocation basis in %s', (locale,dictionary) => {
        const t = (key: string,fallback?: string) => (dictionary as Record<string,string>)[key] ?? fallback ?? key;
        render(<AllStaffFinanceStatsTotals totalStats={totals} locale={locale} periodLabel="LIVE TEST" t={t} />);
        expect(screen.getByText(dictionary['finance.totalWithConsumables'])).toBeTruthy();
        expect(screen.getByText('350 сом')).toBeTruthy();
        expect(screen.getByText(`${dictionary['finance.servicesRevenue']}: 301 сом · ${dictionary['finance.consumablesRevenue']}: 49 сом`)).toBeTruthy();
        expect(screen.getByText(`51.7% ${dictionary['finance.ofTotal']}`)).toBeTruthy();
        expect(screen.getByText(`48.3% ${dictionary['finance.ofTotal']}`)).toBeTruthy();
        expect(screen.queryByText('56.1%')).toBeNull();
    },
);

const t = (key: string,fallback?: string) => (financeRu as Record<string,string>)[key] ?? fallback ?? key;

test('does not show NaN or Infinity for an empty period',() => {
    render(<AllStaffFinanceStatsTotals totalStats={{...totals,totalAmount:0,totalConsumables:0,totalMaster:0,totalSalon:0}}
        locale="ru" periodLabel="Empty" t={t} />);
    expect(screen.getAllByText('0% от общей суммы')).toHaveLength(2);
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
});

test('materials-only receipts remain a valid allocation base',() => {
    render(<AllStaffFinanceStatsTotals totalStats={{...totals,totalAmount:0,totalConsumables:49,totalMaster:0,totalSalon:49}}
        locale="ru" periodLabel="Materials" t={t} />);
    expect(screen.getByText('100.0% от общей суммы')).toBeTruthy();
});

test('does not clamp actual payouts or business losses to a misleading percentage',() => {
    render(<AllStaffFinanceStatsTotals totalStats={{...totals,totalAmount:100,totalConsumables:0,totalMaster:200,totalSalon:-100}}
        locale="ru" periodLabel="Guarantee" t={t} />);
    expect(screen.getByText('200.0% от общей суммы')).toBeTruthy();
    expect(screen.getByText('-100.0% от общей суммы')).toBeTruthy();
});

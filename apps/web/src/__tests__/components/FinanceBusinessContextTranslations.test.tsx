/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { financeEn } from '@/app/_components/i18n/dictionaries/finance.en';
import { financeKy } from '@/app/_components/i18n/dictionaries/finance.ky';
import { financeRu } from '@/app/_components/i18n/dictionaries/finance.ru';
import FinancePageClient from '@/app/dashboard/finance/FinancePageClient';
import { AllStaffFinanceStatsFilters } from '@/app/dashboard/finance/components/AllStaffFinanceStatsSections';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/app/dashboard/finance/components/AllStaffFinanceStats', () => ({ __esModule: true, default: () => null }));

test.each([
    ['ru', financeRu, 'Бизнес', 'Все филиалы'],
    ['en', financeEn, 'Business', 'All branches'],
    ['ky', financeKy, 'Бизнес', 'Бардык филиалдар'],
] as const)('localizes static finance context and all-branches option in %s without renaming authored content', (locale, dictionary, businessLabel, allLabel) => {
    const t = (key: string, fallback?: string) => (dictionary as Record<string, string>)[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({ locale, t } as ReturnType<typeof useLanguage>);
    const onBranchChange = jest.fn();
    render(<>
        <FinancePageClient bizName="Тестовый бизнес 2" bizCity="Ош" />
        <AllStaffFinanceStatsFilters period="year" date="2026-10-16" branchId="all"
            branches={[{ id: 'branch-1', name: 'Филиал 1 Бизнеса 2' }, { id: 'branch-2', name: 'Филиал 2 Бизнеса 2' }]}
            loading={false} onPeriodChange={jest.fn()} onDateChange={jest.fn()}
            onBranchChange={onBranchChange} onRefresh={jest.fn()} t={t} />
    </>);
    expect(screen.getByText(`${businessLabel}: Тестовый бизнес 2 · Ош`, { exact: true })).toBeTruthy();
    expect(screen.getByRole('option', { name: allLabel, exact: true })).toHaveProperty('selected', true);
    expect(screen.getByRole('option', { name: 'Филиал 2 Бизнеса 2', exact: true })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'branch-2' } });
    expect(onBranchChange).toHaveBeenCalledWith('branch-2');
});

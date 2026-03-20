import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AllStaffFinanceStatsFilters } from '@/app/dashboard/finance/components/AllStaffFinanceStatsFilters';
import { AllStaffFinanceStatsOverview } from '@/app/dashboard/finance/components/AllStaffFinanceStatsOverview';
import { AllStaffFinanceStatsTable } from '@/app/dashboard/finance/components/AllStaffFinanceStatsTable';
import type { BranchOption, StaffStat, TotalStats } from '@/app/dashboard/finance/components/allStaffFinanceStatsTypes';

jest.mock('next/link', () => {
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
    };
});

const t = (_key: string, fallback: string) => fallback;

describe('all staff finance stats components', () => {
    test('AllStaffFinanceStatsFilters renders branch selector and year input', () => {
        const branches: BranchOption[] = [
            { id: 'branch-1', name: 'Филиал A' },
            { id: 'branch-2', name: 'Филиал B' },
        ];

        const html = renderToStaticMarkup(
            <AllStaffFinanceStatsFilters
                t={t}
                loading={false}
                period="year"
                setPeriod={() => undefined}
                date="2026-03-20"
                setDate={() => undefined}
                branches={branches}
                branchId="all"
                setBranchId={() => undefined}
                onRefresh={() => undefined}
            />
        );

        expect(html).toContain('Все филиалы');
        expect(html).toContain('Филиал A');
        expect(html).toContain('type="number"');
        expect(html).toContain('Обновить');
    });

    test('AllStaffFinanceStatsOverview renders totals and derived percentages', () => {
        const totalStats: TotalStats = {
            totalAmount: 10000,
            totalMaster: 4000,
            totalSalon: 6000,
            totalConsumables: 0,
            totalLateMinutes: 0,
            totalShifts: 5,
            totalOpenShifts: 2,
            totalClosedShifts: 3,
        };

        const html = renderToStaticMarkup(
            <AllStaffFinanceStatsOverview
                t={t}
                locale="ru"
                totalStats={totalStats}
                formatPeriodLabel={() => '20 марта 2026'}
            />
        );

        expect(html).toContain('Общий оборот');
        expect(html).toContain('10');
        expect(html).toContain('000');
        expect(html).toContain('40.0%');
        expect(html).toContain('60.0%');
        expect(html).toContain('20 марта 2026');
        expect(html).toContain('2');
        expect(html).toContain('открыта');
        expect(html).toContain('3');
        expect(html).toContain('закрыта');
    });

    test('AllStaffFinanceStatsTable renders empty state', () => {
        const html = renderToStaticMarkup(
            <AllStaffFinanceStatsTable t={t} locale="ru" period="month" staffStats={[]} />
        );

        expect(html).toContain('Статистика по сотрудникам');
        expect(html).toContain('Нет данных за выбранный период');
    });

    test('AllStaffFinanceStatsTable renders open shift status and details link', () => {
        const staffStats: StaffStat[] = [
            {
                staffId: 'staff-1',
                staffName: 'Анна',
                isActive: true,
                shiftsCount: 1,
                openShiftsCount: 1,
                closedShiftsCount: 0,
                totalAmount: 5500,
                totalMaster: 2200,
                totalSalon: 3300,
                totalConsumables: 0,
                totalLateMinutes: 0,
            },
        ];

        const html = renderToStaticMarkup(
            <AllStaffFinanceStatsTable t={t} locale="ru" period="day" staffStats={staffStats} />
        );

        expect(html).toContain('Анна');
        expect(html).toContain('Открыта');
        expect(html).toContain('/dashboard/staff/staff-1/finance');
        expect(html).toContain('5');
        expect(html).toContain('500');
        expect(html).toContain('Детали');
    });
});

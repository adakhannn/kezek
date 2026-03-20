import { renderToStaticMarkup } from 'react-dom/server';

import { StaffFinanceShiftCard } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceShiftCard';
import { StaffFinanceStatsFilters } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceStatsFilters';
import { StaffFinanceStatsOverview } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceStatsOverview';
import type { Shift, Stats } from '@/app/dashboard/staff/[id]/finance/components/staffFinanceStatsTypes';

const t = (_key: string, fallback: string) => fallback;

describe('staff finance stats components', () => {
    test('StaffFinanceStatsFilters renders month input and refresh action', () => {
        const html = renderToStaticMarkup(
            <StaffFinanceStatsFilters
                period="month"
                setPeriod={() => undefined}
                date="2026-03"
                setDate={() => undefined}
                loading={false}
                loadStats={async () => undefined}
                t={t}
            />
        );

        expect(html).toContain('Месяц');
        expect(html).toContain('type="month"');
        expect(html).toContain('Обновить');
    });

    test('StaffFinanceStatsOverview renders guaranteed-payment breakdown', () => {
        const stats: Stats = {
            period: 'day',
            dateFrom: '2026-03-20',
            dateTo: '2026-03-20',
            staffName: 'Анна',
            shiftsCount: 2,
            openShiftsCount: 1,
            closedShiftsCount: 1,
            totalAmount: 10000,
            totalMaster: 4500,
            totalSalon: 5500,
            totalConsumables: 300,
            totalLateMinutes: 15,
            totalClients: 4,
            totalBaseMasterShare: 3000,
            totalGuaranteedAmount: 1500,
            hasGuaranteedPayment: true,
            shifts: [],
        };

        const html = renderToStaticMarkup(
            <StaffFinanceStatsOverview
                stats={stats}
                period="day"
                formatPeriodLabel="20 марта 2026"
                locale="ru"
                t={t}
            />
        );

        expect(html).toContain('Оборот');
        expect(html).toContain('45.0%');
        expect(html).toContain('Базовая доля');
        expect(html).toContain('За выход');
        expect(html).toContain('Смена открыта');
        expect(html).toContain('Клиентов');
    });

    test('StaffFinanceShiftCard renders shift summary and expanded client list for open shift', () => {
        const shift: Shift = {
            id: 'shift-1',
            shift_date: '2026-03-20',
            status: 'open',
            opened_at: '2026-03-20T09:00:00.000Z',
            closed_at: null,
            total_amount: 6200,
            consumables_amount: 400,
            master_share: 2500,
            salon_share: 3700,
            late_minutes: 0,
            hours_worked: null,
            hourly_rate: null,
            guaranteed_amount: 0,
            items: [
                {
                    id: 'item-1',
                    client_name: 'Мария',
                    service_name: 'Стрижка',
                    service_amount: 6200,
                    consumables_amount: 400,
                    note: null,
                    booking_id: 'booking-1',
                    created_at: '2026-03-20T10:15:00.000Z',
                },
            ],
        };

        const html = renderToStaticMarkup(
            <StaffFinanceShiftCard
                shift={shift}
                formatDate={(value) => value}
                locale="ru"
                t={t}
            />
        );

        expect(html).toContain('2026-03-20');
        expect(html).toContain('Открыта');
        expect(html).toContain('Список клиентов');
        expect(html).toContain('Мария');
        expect(html).toContain('Стрижка');
        expect(html).toContain('6');
        expect(html).toContain('200');
    });
});

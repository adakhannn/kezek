/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { financeEn } from '@/app/_components/i18n/dictionaries/finance.en';
import { financeKy } from '@/app/_components/i18n/dictionaries/finance.ky';
import { financeRu } from '@/app/_components/i18n/dictionaries/finance.ru';
import { StaffFinanceShiftCard } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceShiftCard';
import { StaffFinanceStatsShifts, StaffFinanceStatsSummary } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceStatsSections';
import { AllStaffFinanceStatsTotals } from '@/app/dashboard/finance/components/AllStaffFinanceStatsSections';
import type { StaffFinanceStatsPayload, StaffFinanceStatsShift } from '@/lib/finance/types';

const shift: StaffFinanceStatsShift = {
    ledger_revision: 7, timezone: 'Asia/Bishkek', day_hours:24,
    id: 'count-only', shift_date: '2026-10-13', status: 'closed', opened_at: null, closed_at: null,
    total_amount: 0, consumables_amount: 0, master_share: 0, salon_share: 0, late_minutes: 0,
    hours_worked: null, hourly_rate: null, guaranteed_amount: 0, items: [],
};
const stats: StaffFinanceStatsPayload = {
    period: 'day', dateFrom: '2026-10-13', dateTo: '2026-10-13', staffName: 'Count fixture',
    shiftsCount: 0, openShiftsCount: 0, closedShiftsCount: 0, totalAmount: 0, totalMaster: 0,
    totalSalon: 0, totalConsumables: 0, totalLateMinutes: 0, totalClients: 0,
    totalBaseMasterShare: 0, totalBaseSalonShare: 0, totalGuaranteedAmount: 0,
    hasGuaranteedPayment: false, shifts: [],
};
const dictionaries = { ru: financeRu, ky: financeKy, en: financeEn };

test.each([
    ['ru', 0, 'клиентов', 'смен'], ['ru', 1, 'клиент', 'смена'],
    ['ru', 2, 'клиента', 'смены'], ['ru', 5, 'клиентов', 'смен'],
    ['ru', 11, 'клиентов', 'смен'], ['ru', 21, 'клиент', 'смена'],
    ['en', 0, 'clients', 'shifts'], ['en', 1, 'client', 'shift'],
    ['en', 2, 'clients', 'shifts'], ['en', 5, 'clients', 'shifts'],
    ['en', 11, 'clients', 'shifts'], ['en', 21, 'clients', 'shifts'],
    ['ky', 0, 'кардар', 'смена'], ['ky', 1, 'кардар', 'смена'],
    ['ky', 2, 'кардар', 'смена'], ['ky', 5, 'кардар', 'смена'],
    ['ky', 11, 'кардар', 'смена'], ['ky', 21, 'кардар', 'смена'],
] as const)('%s/%i localizes only numbered client and shift labels', (locale, count, clients, shifts) => {
    const dictionary = dictionaries[locale] as Record<string, string>;
    const t = (key: string, fallback: string) => dictionary[key] ?? fallback;
    const items = Array.from({ length: count }, (_, i) => ({
        id: `item-${i}`, client_name: 'Count fixture', service_name: '',
        service_amount: 0, consumables_amount: 0, created_at: null, note: null, booking_id: null,
    }));
    const card = render(<StaffFinanceShiftCard shift={{ ...shift, items }} locale={locale} t={t} />);
    expect(screen.getByRole('button', { name: new RegExp(`${count} ${clients}(?: |$)`) })).toBeTruthy();
    card.unmount();
    render(<StaffFinanceStatsShifts stats={{ ...stats, shifts: Array.from({ length: count }, (_, i) => ({ ...shift, id: `shift-${i}` })) }}
        locale={locale} t={t} onHoursUpdated={jest.fn()} />);
    if (count > 0) expect(screen.getByText(`${count} ${shifts}`, { exact: true })).toBeTruthy();
    else expect(screen.queryByRole('heading')).toBeNull();
});

test.each([
    ['ru', 0, 'Открытые', 'Закрытые'], ['ru', 1, 'Открытые', 'Закрытые'], ['ru', 3, 'Открытые', 'Закрытые'],
    ['en', 0, 'Open', 'Closed'], ['en', 1, 'Open', 'Closed'], ['en', 3, 'Open', 'Closed'],
    ['ky', 0, 'Ачык', 'Жабык'], ['ky', 1, 'Ачык', 'Жабык'], ['ky', 3, 'Ачык', 'Жабык'],
] as const)('%s/%i keeps shift-state counts neutral across finance summaries', (locale, count, open, closed) => {
    const dictionary = dictionaries[locale] as Record<string, string>;
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    const summary = render(<StaffFinanceStatsSummary stats={{ ...stats, openShiftsCount: count, closedShiftsCount: count }}
        locale={locale} period="year" periodLabel="2026" t={t} />);
    expect(screen.getByText(`${open}: ${count} • ${closed}: ${count}`, { exact: true })).toBeTruthy();
    summary.unmount();
    render(<AllStaffFinanceStatsTotals totalStats={{
        totalAmount: 0, totalConsumables: 0, totalMaster: 0, totalSalon: 0, totalLateMinutes: 0,
        totalShifts: count * 2, totalOpenShifts: count, totalClosedShifts: count,
    }} locale={locale} periodLabel="2026" t={t} />);
    if (count > 0) {
        expect(screen.getByText(`${open}: ${count}`, { exact: true })).toBeTruthy();
        expect(screen.getByText(`${closed}: ${count}`, { exact: true })).toBeTruthy();
    } else {
        expect(screen.queryByText(`${open}: 0`, { exact: true })).toBeNull();
        expect(screen.queryByText(`${closed}: 0`, { exact: true })).toBeNull();
    }
});

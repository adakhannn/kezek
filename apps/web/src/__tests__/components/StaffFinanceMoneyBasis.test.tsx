/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { StaffFinanceStatsSummary } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceStatsSections';
import { StaffFinanceShiftCard } from '@/app/dashboard/staff/[id]/finance/components/StaffFinanceShiftCard';
import { financeRu } from '@/app/_components/i18n/dictionaries/finance.ru';

const t = (key: string, fallback: string) => (financeRu as Record<string, string>)[key] ?? fallback;
const shift = {
    ledger_revision: 7, timezone: 'Asia/Bishkek', day_hours:24,
    id: 'live-finance', shift_date: '2026-10-13', status: 'closed' as const,
    opened_at: '2026-10-13T11:36:00Z', closed_at: '2026-10-13T11:37:00Z',
    total_amount: 600, consumables_amount: 50, base_master_share: 360, base_salon_share: 290,
    master_share: 600, salon_share: 50, guaranteed_amount: 600, topup_amount: 240,
    late_minutes: 0, hours_worked: 2, hourly_rate: 300, items: [],
};
const stats = {
    period: 'day' as const, dateFrom: '2026-10-13', dateTo: '2026-10-13', staffName: 'LIVE TEST',
    shiftsCount: 1, openShiftsCount: 0, closedShiftsCount: 1, totalAmount: 600,
    totalMaster: 600, totalSalon: 50, totalConsumables: 50, totalLateMinutes: 0, totalClients: 1,
    totalBaseMasterShare: 360, totalBaseSalonShare: 290, totalGuaranteedAmount: 600,
    totalTopupAmount: 240, hasGuaranteedPayment: true, shifts: [shift],
};

test('staff statistics use service plus materials as the payout denominator', () => {
    render(<StaffFinanceStatsSummary stats={stats} period="day" periodLabel="13Oct" locale="ru" t={t} />);
    expect(screen.getByText('650 сом')).toBeTruthy();
    expect(screen.getByText('92.3% • от оборота')).toBeTruthy();
    expect(screen.getByText('7.7% • от оборота')).toBeTruthy();
    expect(screen.getByText('240 сом')).toBeTruthy();
    expect(screen.getByText('Доплата по гарантии: 240 сом')).toBeTruthy();
});

test('a nonzero guarantee below the base is not a top-up', () => {
    const below = { ...stats, totalMaster: 360, totalSalon: 290, totalGuaranteedAmount: 6,
        totalTopupAmount: 0, hasGuaranteedPayment: false,
        shifts: [{ ...shift, guaranteed_amount: 6, master_share: 360, salon_share: 290, topup_amount: 0 }] };
    render(<StaffFinanceStatsSummary stats={below} period="day" periodLabel="13Oct" locale="ru" t={t} />);
    expect(screen.getByText('В этом периоде доплата по гарантии не применялась')).toBeTruthy();
    expect(screen.queryByText('Доплата по гарантии: 6 сом')).toBeNull();
});

test('the closed shift card shows original base separately from the guarantee payout', () => {
    render(<StaffFinanceShiftCard shift={shift} locale="ru" t={t} />);
    fireEvent.click(screen.getByRole('button', { name: /13.10.2026 Закрыта/ }));
    // The expanded card's original percentage share must stay 360, not final payout600.
    expect(screen.getByText('650 сом')).toBeTruthy();
    expect(screen.getByText('360 сом')).toBeTruthy();
});

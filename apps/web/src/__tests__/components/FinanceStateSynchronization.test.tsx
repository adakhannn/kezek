/** @jest-environment jsdom */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import FinanceSettingsAuditLog from '@/app/dashboard/staff/[id]/finance/components/FinanceSettingsAuditLog';
import { ScheduleWeekSection } from '@/app/dashboard/staff/[id]/schedule/ScheduleSections';
import { ClientEditForm } from '@/app/staff/finance/components/ClientEditForm';
import { useShiftCalculations } from '@/app/staff/finance/hooks/useShiftCalculations';
import type { Shift, ShiftItem } from '@/app/staff/finance/types';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ locale: 'en', t: (_key: string, fallback: string) => fallback }) }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const response = (name: string) => ({ ok: true, json: async () => ({ ok: true, data: { entries: [{ id: name, changed_at: '2026-11-10T00:00:00Z', changed_by_name: name, changed_by_user_id: null, field_changes: [], message: 'Changed' }] } }) }) as Response;

test('switching staff removes the old audit data while the next request is pending', async () => {
    const second = deferred<Response>();
    global.fetch = jest.fn().mockResolvedValueOnce(response('Owner A')).mockReturnValueOnce(second.promise);
    const { rerender } = render(<FinanceSettingsAuditLog staffId="staff-a" />);
    expect(await screen.findByText('Owner A')).toBeTruthy();
    rerender(<FinanceSettingsAuditLog staffId="staff-b" />);
    expect(screen.queryByText('Owner A')).toBeNull();
    expect(screen.getByText('Loading...')).toBeTruthy();
    await act(async () => { second.resolve(response('Owner B')); });
    expect(screen.getByText('Owner B')).toBeTruthy();
});

test('an old audit response cannot replace the selected staff, and failed payload is not shown as empty history', async () => {
    const first = deferred<Response>(), second = deferred<Response>();
    global.fetch = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { rerender } = render(<FinanceSettingsAuditLog staffId="staff-a" />);
    rerender(<FinanceSettingsAuditLog staffId="staff-b" />);
    await act(async () => { first.resolve(response('Owner A')); });
    expect(screen.queryByText('Owner A')).toBeNull();
    await act(async () => { second.resolve({ ok: true, json: async () => ({ ok: false, message: 'Unavailable' }) } as Response); });
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(screen.queryByText('No finance setting changes yet')).toBeNull();
});

test('service checkboxes follow the parent draft without writing back during synchronization', () => {
    const onUpdate = jest.fn();
    const item: ShiftItem = { clientName: 'Synthetic', serviceName: 'Cut+ Color', serviceAmount: 300, consumablesAmount: 50 };
    const props = { idx: 0, allItems: [item], bookings: [], serviceOptions: [{ name_ru: 'Cut' }, { name_ru: 'Color' }], isOpen: true, isReadOnly: false, onUpdate, onCollapse: jest.fn() };
    const { rerender } = render(<ClientEditForm {...props} item={item} />);
    expect((screen.getByRole('checkbox', { name: 'Cut' }) as HTMLInputElement).checked).toBe(true);
    expect(onUpdate).not.toHaveBeenCalled();
    const next = { ...item, serviceName: 'Color' };
    rerender(<ClientEditForm {...props} item={next} />);
    expect((screen.getByRole('checkbox', { name: 'Cut' }) as HTMLInputElement).checked).toBe(false);
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cut' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(0, { ...next, serviceName: 'Color + Cut' });
});

test('equivalent server schedule data retains an edited draft; changed persisted values reset it', () => {
    const rule = { intervals: [{ start: '09:00', end: '18:00' }], branch_id: 'branch-1' };
    const props = { title: 'Week', rangeLabel: 'Future', dates: [new Date('2099-01-05T06:00:00Z')], rulesByDate: new Map([['2099-01-05', rule]]), branches: [{ id: 'branch-1', name: 'Main' }], homeBranchId: 'branch-1', saving: false, onSaveDay: jest.fn(), t: (_key: string, fallback: string) => fallback };
    const { container, rerender } = render(<ScheduleWeekSection {...props} />);
    const start = () => container.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(start(), { target: { value: '10:00' } });
    rerender(<ScheduleWeekSection {...props} rulesByDate={new Map([['2099-01-05', { ...rule, intervals: [{ ...rule.intervals[0] }] }]])} />);
    expect(start().value).toBe('10:00');
    rerender(<ScheduleWeekSection {...props} rulesByDate={new Map([['2099-01-05', { ...rule, intervals: [{ start: '11:00', end: '18:00' }] }]])} />);
    expect(start().value).toBe('11:00');
});

test('memoized finance follows amount edits and then the persisted closed snapshot', () => {
    const item: ShiftItem = { serviceAmount: 1000, consumablesAmount: 100 };
    const { result, rerender } = renderHook(({ items, shift, isOpen }: { items: ShiftItem[]; shift: Shift | null; isOpen: boolean }) => useShiftCalculations(items, shift, isOpen, 60, 40, null, null), { initialProps: { items: [item], shift: null as Shift | null, isOpen: true } });
    expect(result.current).toMatchObject({ masterShare: 600, salonShare: 500 });
    rerender({ items: [{ serviceAmount: 301, consumablesAmount: 49 }], shift: null, isOpen: true });
    expect(result.current).toMatchObject({ masterShare: 181, salonShare: 169 });
    const shift: Shift = { id: 'shift', shift_date: '2026-11-10', opened_at: null, closed_at: null, expected_start: null, late_minutes: 0, status: 'closed', total_amount: 301, consumables_amount: 49, master_share: 250, salon_share: 100, percent_master: 60, percent_salon: 40 };
    rerender({ items: [item], shift, isOpen: false });
    expect(result.current).toMatchObject({ masterShare: 250, salonShare: 100, displayTotalAmount: 301 });
});

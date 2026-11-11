/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useFinanceDraft } from '@/app/staff/finance/hooks/useFinanceDraft';
import { useFinanceMutations } from '@/app/staff/finance/hooks/useFinanceMutations';
import type { FinanceData } from '@/app/staff/finance/hooks/useFinanceData';
import type { FinanceTransport } from '@/app/staff/finance/services/financeDraftSession';
import type { Shift, ShiftItem } from '@/app/staff/finance/types';

const mockQueryClient = { invalidateQueries: jest.fn().mockResolvedValue(undefined), setQueryData: jest.fn() };
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => mockQueryClient }));
jest.mock('@/app/staff/finance/hooks/useFinanceData', () => ({ fetchFinanceData: jest.fn() }));
const item: ShiftItem = { id: '22222222-2222-4222-8222-222222222222', clientName: 'Original', serviceAmount: 100, consumablesAmount: 0 };
const shift = { id: '11111111-1111-4111-8111-111111111111', ledger_revision: 7, status: 'open' } as Shift;
const data = { shift, items: [item] } as FinanceData;
const prepare = (items: ShiftItem[]) => items;
function transport(): jest.Mocked<FinanceTransport> {
    return { load: jest.fn(), save: jest.fn(), close: jest.fn(), open: jest.fn() };
}
afterEach(() => jest.restoreAllMocks());

test('a response from the previous staff/date session cannot mutate the newly selected draft', async () => {
    const a = transport(), b = transport(); let resolve!: (result: unknown) => void;
    a.save.mockImplementation(() => new Promise(yes => { resolve = yes; }));
    const { result, rerender } = renderHook(({ api, snapshot }) => useFinanceDraft(api, snapshot, prepare), {
        initialProps: { api: a, snapshot: data },
    });
    let pending!: Promise<void>;
    await act(async () => { result.current.session.setItems([{ ...item, clientName: 'A draft' }]); pending = result.current.session.save(); });
    rerender({ api: b, snapshot: { ...data, shift: { ...shift, id: '33333333-3333-4333-8333-333333333333' }, items: [{ ...item, clientName: 'B data' }] } });
    await act(async () => { resolve({ shiftId: shift.id, revision: 8, items: [{ ...item, clientName: 'A saved' }] }); await pending; });
    expect(result.current.state.items[0].clientName).toBe('B data');
    expect(result.current.state.shift?.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(b.save).not.toHaveBeenCalled();
});

test('changing labels/preparation does not recreate or silently discard an existing draft', () => {
    const api = transport();
    const { result, rerender } = renderHook(({ prepareItems }) => useFinanceDraft(api, data, prepareItems), { initialProps: { prepareItems: prepare } });
    const session = result.current.session;
    act(() => session.setItems([{ ...item, clientName: 'Unsaved' }]));
    rerender({ prepareItems: items => items.filter(entry => entry.serviceAmount > 0) });
    expect(result.current.session).toBe(session);
    expect(result.current.state.items[0].clientName).toBe('Unsaved');
});

test('HTTP transport sends the captured snapshot unchanged and keeps its original scope after navigation', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200,
        json: async () => ({ ok: true, data: { shiftId: shift.id, revision: 8, items: [item] } }) });
    global.fetch = mockFetch;
    const { result, rerender } = renderHook(({ staffId, date }) => useFinanceMutations({ staffId, date }), {
        initialProps: { staffId: 'staff-a', date: new Date('2026-11-10T12:00:00+06:00') },
    });
    const original = result.current;
    rerender({ staffId: 'staff-b', date: new Date('2026-11-11T12:00:00+06:00') });
    const receipt = await original.save([item], { expectedShiftId: shift.id, expectedRevision: 7 });
    expect(receipt.revision).toBe(8);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ staffId: 'staff-a', shiftDate: '2026-11-10', expectedShiftId: shift.id, expectedRevision: 7 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('HTTP 409 is surfaced with its status and never retried or rebased by the transport', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 409,
        json: async () => ({ ok: false, error: 'validation', message: 'Snapshot changed' }) });
    global.fetch = mockFetch;
    const { result } = renderHook(() => useFinanceMutations({ date: new Date('2026-11-10T12:00:00+06:00') }));
    await expect(result.current.save([item], { expectedShiftId: shift.id, expectedRevision: 7 })).rejects.toMatchObject({ status: 409, message: 'Snapshot changed' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
});


test('default today transport sends snapshot calendar date, not the current browser day, and Close excludes internal metadata', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { shiftId: shift.id, revision: 8, items: [item], shift } }) });
    global.fetch = mockFetch;
    const { result } = renderHook(() => useFinanceMutations({ staffId: 'staff-a', date: null }));
    const version = { expectedShiftId: shift.id, expectedRevision: 7, calendarDate: '2026-11-09' };
    await result.current.save([item], version); await result.current.close([item], version);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ shiftDate: '2026-11-09', expectedRevision: 7 });
    expect(mockFetch.mock.calls[1][0]).toBe('/api/dashboard/staff/staff-a/shift/close?date=2026-11-09');
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).not.toHaveProperty('calendarDate');
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).not.toHaveProperty('shiftDate');
});

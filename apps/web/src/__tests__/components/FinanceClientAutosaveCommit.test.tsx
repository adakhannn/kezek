/** @jest-environment jsdom */
import { Suspense } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { useFinanceClientAutosave } from '@/app/staff/finance/hooks/useFinanceClientAutosave';
import { SAVE_DEBOUNCE_MS } from '@/app/staff/finance/constants';
import type { ShiftItem, TabKey } from '@/app/staff/finance/types';

const items: ShiftItem[] = [{ clientId: '11111111-1111-4111-8111-111111111111', clientName: 'Synthetic', serviceName: 'Cut', serviceAmount: 300, consumablesAmount: 50 }];
const serializeItems = (value: ShiftItem[]) => JSON.stringify(value);
const prepareItemsForSave = (value: ShiftItem[]) => value;
function options(saveItems = jest.fn().mockResolvedValue(undefined)) {
    return { activeTab: 'clients' as TabKey, activeTabRef: { current: 'clients' as TabKey },
        previousTabRef: { current: 'clients' as TabKey | null }, localItems: items,
        isOpen: true, isReadOnlyForOwner: false, prepareItemsForSave, saveItems, serializeItems };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => { cleanup(); jest.useRealTimers(); });

test('pending autosave uses the latest committed callback and preparation without restarting its debounce', async () => {
    const first = jest.fn().mockResolvedValue(undefined), latest = jest.fn().mockResolvedValue(undefined);
    const base = options(first);
    const { rerender } = renderHook(props => useFinanceClientAutosave(props), { initialProps: base });
    act(() => jest.advanceTimersByTime(SAVE_DEBOUNCE_MS / 2));
    rerender({ ...base, saveItems: latest, prepareItemsForSave: value => value.map(item => ({ ...item, serviceAmount: 301 })) });
    await act(async () => { jest.advanceTimersByTime(SAVE_DEBOUNCE_MS / 2); });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledWith([{ ...items[0], serviceAmount: 301 }]);
});

test('a committed read-only transition cancels pending autosave and prevents unmount flush', async () => {
    const base = options();
    const { rerender, unmount } = renderHook(props => useFinanceClientAutosave(props), { initialProps: base });
    rerender({ ...base, isReadOnlyForOwner: true });
    await act(async () => { jest.advanceTimersByTime(SAVE_DEBOUNCE_MS); });
    unmount();
    expect(base.saveItems).not.toHaveBeenCalled();
});

test('a suspended render cannot replace the callback of the committed draft', async () => {
    const committed = jest.fn().mockResolvedValue(undefined), abandoned = jest.fn().mockResolvedValue(undefined);
    const base = options(committed);
    const pending = new Promise<void>(() => {});
    function Probe({ suspend, save }: { suspend: boolean; save: typeof committed }) {
        useFinanceClientAutosave({ ...base, saveItems: save });
        if (suspend) throw pending;
        return <span>Draft</span>;
    }
    const { rerender } = render(<Suspense fallback={<span>Loading</span>}><Probe suspend={false} save={committed} /></Suspense>);
    rerender(<Suspense fallback={<span>Loading</span>}><Probe suspend save={abandoned} /></Suspense>);
    await act(async () => { jest.advanceTimersByTime(SAVE_DEBOUNCE_MS); });
    expect(abandoned).not.toHaveBeenCalled();
    expect(committed).toHaveBeenCalledWith(items);
});

test('manual save deduplicates the committed payload after success', async () => {
    const base = options();
    const { result } = renderHook(() => useFinanceClientAutosave(base));
    await act(async () => { result.current.handleSaveNow(); });
    await act(async () => { result.current.handleSaveNow(); jest.advanceTimersByTime(SAVE_DEBOUNCE_MS); });
    expect(base.saveItems).toHaveBeenCalledTimes(1);
});

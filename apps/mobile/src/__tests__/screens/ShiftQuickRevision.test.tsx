import React from 'react';
import { act, renderHook, waitFor, render, screen, fireEvent } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useShiftQuickScreenData } from '../../screens/shiftQuick/useShiftQuickScreenData';
import { captureShiftLedger } from '../../screens/shiftQuick/commandProtocol';
import { getOfflineQueue, saveOfflineQueue } from '../../screens/shiftQuick/offlineStorage';
import type { ShiftOfflineOperation } from '../../screens/shiftQuick/offlineStorage';
import type { FinanceData, ShiftItem, ShiftLedgerSnapshot } from '../../screens/shiftQuick/types';
import ShiftQuickScreen from '../../screens/ShiftQuickScreen';
import { createTestQueryClient } from '../testQueryClient';

const mockConfirm = jest.fn().mockResolvedValue(true);
jest.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => ({ confirm: mockConfirm }) }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));

const owner = { userId: 'user-1', staffId: 'staff-1' };
const item: ShiftItem = { clientName: 'Draft client', serviceName: 'Haircut', serviceAmount: 500, consumablesAmount: 50, bookingId: null };
const finance = (revision = 3, items: ShiftItem[] = []): FinanceData => ({
    today: { exists: true, status: 'open', items, shift: { id: 'shift-1', ledger_revision: revision,
        shift_date: '2026-11-10', status: 'open', opened_at: '2026-11-10T08:00:00Z',
        total_amount: 0, consumables_amount: 0, master_share: 0, salon_share: 0,
        hours_worked: null, hourly_rate: null, guaranteed_amount: 0 } },
    staffPercentMaster: 60, staffPercentSalon: 40, hourlyRate: null, currentHoursWorked: null,
    currentGuaranteedAmount: null, isDayOff: false,
});
const conflict = () => Object.assign(new Error('Conflict'), { status: 409 });
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const response = (payload: ShiftLedgerSnapshot) => ({ ok: true, data: { shiftId: payload.expectedShiftId,
    revision: payload.expectedRevision + 1, items: payload.items.map((entry, index) => ({ ...entry, id: entry.id ?? entry.clientId ?? `canonical-${index}` })) } });

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const storage = new Map<string, string>();
let server: FinanceData;
const payloads = () => api.mock.calls.filter(([path]) => path === '/api/staff/shift/items')
    .map(([, options]) => JSON.parse(String(options?.body)) as ShiftLedgerSnapshot);
const createWrapper = () => {
    const client = createTestQueryClient();
    return { client, wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
};
const mountHook = async () => {
    const { wrapper, client } = createWrapper();
    const hook = renderHook(() => useShiftQuickScreenData(), { wrapper });
    await waitFor(() => expect(hook.result.current.financeData?.today.shift?.ledger_revision).toBe(3));
    await act(async () => {});
    return { ...hook, client };
};

beforeEach(() => {
    storage.clear();
    server = finance();
    mockConfirm.mockReset().mockResolvedValue(true);
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => storage.get(key) ?? null);
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => { storage.set(key, value); });
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => { storage.delete(key); });
    (supabase.from as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'staff-1', full_name: 'Test' }, error: null }) });
    api.mockReset().mockImplementation(async (path, options) => {
        if (path === '/api/staff/finance') return { ok: true, data: server };
        return response(JSON.parse(String(options?.body)));
    });
});

test('success adopts canonical IDs and revision before the next save', async () => {
    const { result } = await mountHook();
    await act(async () => { await result.current.addClientMutation.mutateAsync({ base: captureShiftLedger(result.current.financeData), item }); });
    expect(result.current.financeData?.today.shift?.ledger_revision).toBe(4);
    expect(result.current.financeData?.today.items[0].id).toBe('canonical-0');
    await act(async () => { await result.current.addClientMutation.mutateAsync({ base: captureShiftLedger(result.current.financeData), item: { ...item, clientName: 'Second' } }); });
    expect(payloads()[1]).toMatchObject({ expectedShiftId: 'shift-1', expectedRevision: 4,
        items: [expect.objectContaining({ id: 'canonical-0' }), expect.objectContaining({ clientName: 'Second' })] });
    expect(result.current.financeData?.today.shift?.ledger_revision).toBe(5);
});

test('save and close cannot dispatch concurrently, including synchronous calls', async () => {
    const pending = deferred<unknown>();
    const { result } = await mountHook();
    api.mockImplementation(async path => path === '/api/staff/finance' ? { ok: true, data: server } : pending.promise);
    const base = captureShiftLedger(result.current.financeData);
    let saving!: Promise<unknown>;
    await act(async () => { saving = result.current.addClientMutation.mutateAsync({ base, item }); });
    await act(async () => {
        await expect(result.current.closeShiftMutation.mutateAsync(base)).rejects.toThrow('Дождитесь');
    });
    expect(api.mock.calls.filter(([path]) => path === '/api/staff/shift/close')).toHaveLength(0);
    await act(async () => { pending.resolve(response({ ...base, items: [item] })); await saving; });
});

test('late save acknowledgement cannot replace an already observed newer ledger', async () => {
    const pending = deferred<unknown>();
    const { result, client } = await mountHook();
    api.mockImplementation(async path => path === '/api/staff/finance' ? { ok: true, data: server } : pending.promise);
    const base = captureShiftLedger(result.current.financeData);
    let saving!: Promise<unknown>;
    await act(async () => { saving = result.current.addClientMutation.mutateAsync({ base, item }); });
    await act(async () => { client.setQueryData(['staff-finance', 'user-1', 'staff-1'], finance(7, [{ ...item, id: 'remote', clientName: 'Latest' }])); });
    await act(async () => { pending.resolve(response({ ...base, items: [item] })); await saving; });
    expect(result.current.financeData?.today.shift?.ledger_revision).toBe(7);
    expect(result.current.financeData?.today.items[0].clientName).toBe('Latest');
});

test('review-required operation remains paused after the screen remounts', async () => {
    const operation: ShiftOfflineOperation = { type: 'addItem', owner, timestamp: 'retained', state: 'review',
        data: { expectedShiftId: 'shift-1', expectedRevision: 2, items: [item] }, edit: { item } };
    await saveOfflineQueue([operation]);
    const first = await mountHook();
    await waitFor(() => expect(first.result.current.reviewOperation).toBeDefined());
    first.unmount();
    const second = await mountHook();
    await waitFor(() => expect(second.result.current.reviewOperation).toBeDefined());
    await act(async () => { await second.result.current.onRefresh(); });
    expect(payloads()).toHaveLength(0);
    expect(await getOfflineQueue()).toEqual([operation]);
});

test('queue storage read failure blocks a write instead of assuming no pending command', async () => {
    const { result } = await mountHook();
    storage.set('shift_offline_queue', '{broken');
    await act(async () => {
        await expect(result.current.addClientMutation.mutateAsync({ base: captureShiftLedger(result.current.financeData), item })).rejects.toThrow();
    });
    expect(payloads()).toHaveLength(0);
    expect(storage.get('shift_offline_queue')).toBe('{broken');
    expect(result.current.queueError).toBeTruthy();
});

test('unknown outcome retries the exact original command, then 409 freezes it across refreshes', async () => {
    const { result } = await mountHook();
    const base = captureShiftLedger(result.current.financeData);
    api.mockImplementation(async path => {
        if (path === '/api/staff/finance') return { ok: true, data: server };
        throw new Error('Network request failed');
    });
    await act(async () => { expect(await result.current.addClientMutation.mutateAsync({ base, item })).toEqual({ queued: true }); });
    const original = (await getOfflineQueue())[0];
    expect(original).toMatchObject({ owner, state: 'pending', data: { expectedRevision: 3 } });
    server = finance(8, [{ ...item, id: 'other-device' }]);
    api.mockImplementation(async path => {
        if (path === '/api/staff/finance') return { ok: true, data: server };
        throw conflict();
    });
    await act(async () => { await result.current.onRefresh(); });
    expect(payloads()).toHaveLength(2);
    expect(payloads()[1]).toEqual(payloads()[0]);
    expect((await getOfflineQueue())[0]).toMatchObject({ state: 'review', data: original.data });
    await act(async () => { await result.current.onRefresh(); await result.current.onRefresh(); });
    expect(payloads()).toHaveLength(2);
    expect(result.current.financeData?.today.shift?.ledger_revision).toBe(8);
    expect((await getOfflineQueue())[0].data).toEqual(original.data);
});

test('409 keeps the immutable draft and rejects another unrelated write', async () => {
    const { result } = await mountHook();
    const base = captureShiftLedger(result.current.financeData);
    api.mockRejectedValue(conflict());
    await act(async () => { await expect(result.current.addClientMutation.mutateAsync({ base, item })).rejects.toThrow('Черновик сохранён'); });
    const queue = await getOfflineQueue();
    expect(queue[0]).toMatchObject({ state: 'review', edit: { item }, data: { expectedShiftId: 'shift-1', expectedRevision: 3 } });
    await act(async () => { await expect(result.current.closeShiftMutation.mutateAsync(base)).rejects.toThrow('Сначала проверьте'); });
    expect(payloads()).toHaveLength(1);
});

test.each([
    ['legacy missing version', { type: 'addItem', data: { items: [item] }, timestamp: 'legacy' }],
    ['other account', { type: 'addItem', data: { expectedShiftId: 'shift-1', expectedRevision: 3, items: [item] }, owner: { userId: 'other', staffId: 'staff-1' }, timestamp: 'foreign' }],
    ['legacy open', { type: 'open', data: {}, owner, timestamp: 'old-open' }],
] as const)('%s is retained for review and never automatically sent', async (_label, operation) => {
    await saveOfflineQueue([operation as ShiftOfflineOperation]);
    const { result } = await mountHook();
    await waitFor(() => expect(result.current.reviewOperation).toBeDefined());
    expect(api.mock.calls.every(([path]) => path === '/api/staff/finance')).toBe(true);
    expect((await getOfflineQueue())[0].data).toEqual(operation.data);
    expect(result.current.canRestoreDraft).toBe(false);
});

test('malformed success is an uncertain outcome, not a successful save or an automatic retry', async () => {
    const { result } = await mountHook();
    const base = captureShiftLedger(result.current.financeData);
    api.mockImplementation(async path => path === '/api/staff/finance' ? { ok: true, data: server } : { ok: true });
    await act(async () => { await expect(result.current.addClientMutation.mutateAsync({ base, item })).rejects.toThrow('Черновик сохранён'); });
    await act(async () => { await result.current.onRefresh(); });
    expect(payloads()).toHaveLength(1);
    expect((await getOfflineQueue())[0].state).toBe('review');
    expect(result.current.financeData?.today.shift?.ledger_revision).toBe(3);
});

test('successful Close consumes its envelope and preserves the captured revision', async () => {
    const { result } = await mountHook();
    const base = captureShiftLedger(result.current.financeData);
    api.mockResolvedValue({ ok: true, data: { shift: { ...server.today.shift, status: 'closed', ledger_revision: 4 } } });
    await act(async () => { await result.current.closeShiftMutation.mutateAsync(base); });
    expect(result.current.financeData?.today.shift).toMatchObject({ status: 'closed', ledger_revision: 4 });
    const call = api.mock.calls.find(([path]) => path === '/api/staff/shift/close');
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ expectedShiftId: 'shift-1', expectedRevision: 3, totalAmount: 0, consumablesAmount: 0 });
});

test('wire commands exclude read-only note and createdAt returned by the server', async () => {
    server = finance(3, [{ ...item, id: 'manual', note: 'Read-only note', createdAt: '2026-11-10T08:00:00Z' }]);
    const { result } = await mountHook();
    await act(async () => { await result.current.addClientMutation.mutateAsync({ base: captureShiftLedger(result.current.financeData), item }); });
    expect(payloads()[0].items[0]).not.toHaveProperty('note');
    expect(payloads()[0].items[0]).not.toHaveProperty('createdAt');
});

test('editor retains its opening revision even when background data changes', async () => {
    const { client, wrapper } = createWrapper();
    render(<ShiftQuickScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Добавить клиента'));
    fireEvent.changeText(await screen.findByPlaceholderText('Имя клиента *'), 'Typed draft');
    await act(async () => { client.setQueryData(['staff-finance', 'user-1', 'staff-1'], finance(7)); });
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(payloads()).toHaveLength(1));
    expect(payloads()[0].expectedRevision).toBe(3);
});

test('Close confirmation retains its initial version while the dialog is open', async () => {
    const answer = deferred<boolean>();
    mockConfirm.mockReturnValue(answer.promise);
    const { client, wrapper } = createWrapper();
    render(<ShiftQuickScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Закрыть смену'));
    await act(async () => { client.setQueryData(['staff-finance', 'user-1', 'staff-1'], finance(9)); });
    api.mockResolvedValue({ ok: true, data: { shift: { ...server.today.shift, status: 'closed', ledger_revision: 4 } } });
    await act(async () => { answer.resolve(true); });
    await waitFor(() => expect(api.mock.calls.some(([path]) => path === '/api/staff/shift/close')).toBe(true));
    const call = api.mock.calls.find(([path]) => path === '/api/staff/shift/close');
    expect(JSON.parse(String(call?.[1]?.body)).expectedRevision).toBe(3);
});

test('explicit review reloads fresh data and requires a new Save before replacing the old draft', async () => {
    api.mockImplementation(async path => {
        if (path === '/api/staff/finance') return { ok: true, data: server };
        throw conflict();
    });
    const { wrapper } = createWrapper();
    render(<ShiftQuickScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Добавить клиента'));
    fireEvent.changeText(await screen.findByPlaceholderText('Имя клиента *'), 'Kept draft');
    fireEvent.press(screen.getByText('Сохранить'));
    expect(await screen.findByText('Нужна сверка смены')).toBeTruthy();
    expect(screen.getByPlaceholderText('Имя клиента *').props.editable).toBe(false);
    server = finance(8, [{ ...item, id: 'remote', clientName: 'Remote client' }]);
    fireEvent.press(screen.getByText('Загрузить актуальную смену'));
    await screen.findByText('Remote client');
    expect(payloads()).toHaveLength(1);
    expect((await getOfflineQueue())[0]).toMatchObject({ data: { expectedRevision: 3 } });
    fireEvent.press(screen.getByText('Сверить черновик в редакторе'));
    await waitFor(() => expect(screen.getByPlaceholderText('Имя клиента *').props.value).toBe('Kept draft'));
    await act(async () => {});
    expect(payloads()).toHaveLength(1);
    api.mockImplementation(async (path, options) => path === '/api/staff/finance' ? { ok: true, data: server } : response(JSON.parse(String(options?.body))));
    fireEvent.press(screen.getByText('Сохранить'));
    await waitFor(() => expect(payloads()).toHaveLength(2));
    expect(payloads()[1]).toMatchObject({ expectedRevision: 8, items: [expect.objectContaining({ id: 'remote' }), expect.objectContaining({ clientName: 'Kept draft' })] });
    await waitFor(async () => expect(await getOfflineQueue()).toEqual([]));
});

test('explicit reconciliation recognizes a previously committed new draft by its client ID', async () => {
    const clientId = 'd502cd19-a551-46c4-aec3-6f49acfe0743';
    const draft = { ...item, clientId, clientName: 'Recovered draft' };
    const operation: ShiftOfflineOperation = { type: 'addItem', owner, timestamp: 'uncertain', state: 'review',
        data: { expectedShiftId: 'shift-1', expectedRevision: 2, items: [draft] }, edit: { item: draft } };
    await saveOfflineQueue([operation]);
    server = finance(3, [{ ...draft, id: clientId }]);
    const { wrapper } = createWrapper();
    render(<ShiftQuickScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Сверить черновик в редакторе'));
    await screen.findByText('Сохранить изменения');
    await act(async () => {});
    expect(payloads()).toHaveLength(0);
    fireEvent.press(screen.getByText('Сохранить изменения'));
    await waitFor(() => expect(payloads()).toHaveLength(1));
    expect(payloads()[0].items).toHaveLength(1);
    expect(payloads()[0].items[0].id).toBe(clientId);
    expect(payloads()[0].expectedRevision).toBe(3);
    await waitFor(async () => expect(await getOfflineQueue()).toEqual([]));
});

test('invalid money text is retained in the editor and never converted to a zero write', async () => {
    const { wrapper } = createWrapper();
    render(<ShiftQuickScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Добавить клиента'));
    fireEvent.changeText(await screen.findByPlaceholderText('Имя клиента *'), 'Draft');
    fireEvent.changeText(screen.getByPlaceholderText('Сумма'), 'not a number');
    fireEvent.press(screen.getByText('Сохранить'));
    expect(screen.getAllByText('Введите суммы от 0 до 100 000 000.').length).toBeGreaterThan(0);
    expect(payloads()).toHaveLength(0);
    expect(screen.getByPlaceholderText('Сумма').props.value).toBe('not a number');
});

test('explicit review cannot silently transfer yesterday\'s draft into a different shift', async () => {
    const operation: ShiftOfflineOperation = { type: 'addItem', owner, timestamp: 'old-day', state: 'review',
        data: { expectedShiftId: 'old-shift', expectedRevision: 2, items: [item] }, edit: { item } };
    await saveOfflineQueue([operation]);
    const { wrapper } = createWrapper();
    render(<ShiftQuickScreen />, { wrapper });
    fireEvent.press(await screen.findByText('Сверить черновик в редакторе'));
    await act(async () => {});
    expect(screen.queryByPlaceholderText('Имя клиента *')).toBeNull();
    expect(payloads()).toHaveLength(0);
    expect(await getOfflineQueue()).toEqual([operation]);
});

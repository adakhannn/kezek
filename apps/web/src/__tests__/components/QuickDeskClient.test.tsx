/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useQuickDeskClient } from '@/app/dashboard/bookings/components/useQuickDeskClient';

const client = {id: 'known-client', full_name: 'Known Client', email: 'known@example.test', phone: null};
const translate = (_key: string, fallback: string) => fallback;
const originalFetch = global.fetch;
const response = (items: typeof client[]) => ({json: async () => ({ok: true, items})}) as Response;
beforeEach(() => {jest.useFakeTimers(); global.fetch = jest.fn();});
afterEach(() => {jest.useRealTimers(); global.fetch = originalFetch;});
async function finishDebounce() {
    await act(async () => {jest.advanceTimersByTime(500);});
}

it('immediately invalidates a selected client when its query changes', async () => {
    jest.mocked(fetch).mockResolvedValue(response([client]));
    const {result} = renderHook(useQuickDeskClient);
    act(() => result.current.setClientMode('existing'));
    act(() => result.current.setSearchQ('known'));
    await finishDebounce();
    act(() => result.current.setSelectedClientId(client.id));
    expect(result.current.canSubmitClient).toBe(true);
    expect(result.current.getClientPayload(translate)).toEqual({ok: true, payload: {clientId: client.id, clientName: null, clientPhone: null}});
    act(() => result.current.setSearchQ('another'));
    expect(result.current.selectedClientId).toBe('');
    expect(result.current.foundUsers).toEqual([]);
    expect(result.current.canSubmitClient).toBe(false);
    expect(result.current.getClientPayload(translate).ok).toBe(false);
});

it('does not accept a fabricated or absent selection', async () => {
    jest.mocked(fetch).mockResolvedValue(response([]));
    const {result} = renderHook(useQuickDeskClient);
    act(() => result.current.setClientMode('existing'));
    act(() => result.current.setSearchQ('none'));
    await finishDebounce();
    act(() => result.current.setSelectedClientId(client.id));
    expect(result.current.canSubmitClient).toBe(false);
    expect(result.current.getClientPayload(translate).ok).toBe(false);
});

it('ignores a slow response from the previous query even if the transport ignores abort', async () => {
    let finishOld!: (value: Response) => void;
    jest.mocked(fetch).mockReturnValueOnce(new Promise(resolve => {finishOld = resolve;})).mockResolvedValueOnce(response([]));
    const {result} = renderHook(useQuickDeskClient);
    act(() => result.current.setClientMode('existing'));
    act(() => result.current.setSearchQ('old'));
    await finishDebounce();
    act(() => result.current.setSearchQ('new'));
    await finishDebounce();
    await act(async () => {finishOld(response([client]));});
    expect(result.current.foundUsers).toEqual([]);
    expect(result.current.searchLoading).toBe(false);
    expect((jest.mocked(fetch).mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
});

it('clears client state and ignores a late response when leaving search mode', async () => {
    let finishOld!: (value: Response) => void;
    jest.mocked(fetch).mockReturnValue(new Promise(resolve => {finishOld = resolve;}));
    const {result} = renderHook(useQuickDeskClient);
    act(() => result.current.setClientMode('existing'));
    act(() => result.current.setSearchQ('known'));
    await finishDebounce();
    act(() => result.current.setClientMode('none'));
    await act(async () => {finishOld(response([client]));});
    expect(result.current.foundUsers).toEqual([]);
    expect(result.current.searchQ).toBe('');
    expect(result.current.searchLoading).toBe(false);
    expect(result.current.getClientPayload(translate)).toEqual({ok: true, payload: {clientId: null, clientName: null, clientPhone: null}});
});

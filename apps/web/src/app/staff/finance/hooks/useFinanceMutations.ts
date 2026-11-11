import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { FinanceWriteError, type FinanceTransport, type FinanceSaveReceipt } from '../services/financeDraftSession';
import type { Shift, ShiftItem } from '../types';
import { deduplicateServiceNameString } from '../utils';
import { financeDateLabel } from '../utils/calendar';

import { fetchFinanceData } from './useFinanceData';

async function command<T>(url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let json;
    try { json = await response.json(); }
    catch { throw new FinanceWriteError('Ответ сервера не получен. Проверьте смену перед следующей записью.', response.ok ? 0 : response.status); }
    if (!response.ok || !json.ok) throw new FinanceWriteError(json.message || 'Не удалось подтвердить финансовую операцию.', response.status);
    return json.data as T;
}
function wireItems(items: ShiftItem[]) {
    return items.map(item => ({
        id: item.id, clientId: item.clientId, clientName: item.clientName,
        serviceName: deduplicateServiceNameString(item.serviceName) || item.serviceName || '',
        serviceAmount: item.serviceAmount, consumablesAmount: item.consumablesAmount, bookingId: item.bookingId,
    }));
}

/** Transport only. Draft ownership, acknowledgements and serialization live in FinanceDraftSession. */
export function useFinanceMutations({ staffId, date }: { staffId?: string; date: Date | string | null }): FinanceTransport {
    const queryClient = useQueryClient();
    const dateStr = financeDateLabel(date);
    return useMemo(() => {
        // Capture primitive scope for the entire lifetime of this draft, including pending requests on navigation.
        const queryKey = ['finance', staffId || 'current', dateStr ?? 'today'];
        const endpoint = (action: 'open' | 'close', selectedDate?: string) => {
            const base = staffId ? '/api/dashboard/staff/' + staffId + '/shift/' + action : '/api/staff/shift/' + action;
            return selectedDate ? base + '?date=' + selectedDate : base;
        };
        const refresh = () => { void queryClient.invalidateQueries({ queryKey }); };
        return {
            load: async (selectedDate) => {
                const payload = await fetchFinanceData(staffId, selectedDate ?? dateStr ?? null);
                queryClient.setQueryData(queryKey, payload);
                return { shift: payload.today.shift, items: payload.today.items, calendarDate: payload.calendar?.date ?? payload.today.shift?.shift_date };
            },
            open: (selectedDate) => command(endpoint('open', selectedDate ?? dateStr)),
            save: async (items, version) => {
                const receipt = await command<FinanceSaveReceipt>('/api/staff/shift/items', {
                    items: wireItems(items), staffId, shiftDate: version.calendarDate ?? dateStr,
                    expectedShiftId: version.expectedShiftId, expectedRevision: version.expectedRevision,
                });
                refresh();
                return receipt;
            },
            close: async (items, version) => {
                const result = await command<{ shift: Shift }>(endpoint('close', version.calendarDate ?? dateStr), {
                    items: wireItems(items), totalAmount: items.reduce((sum, item) => sum + (item.serviceAmount ?? 0), 0), expectedShiftId: version.expectedShiftId, expectedRevision: version.expectedRevision,
                });
                refresh();
                return result?.shift;
            },
        };
    }, [dateStr, staffId, queryClient]);
}

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import { useSelectedStaffId } from '../../staffSelectionContext';
import { FinanceWriteError, type FinanceTransport, type FinanceSaveReceipt } from '../services/financeDraftSession';
import type { Shift, ShiftItem } from '../types';
import { deduplicateServiceNameString } from '../utils';
import { financeDateLabel } from '../utils/calendar';

import { fetchFinanceData } from './useFinanceData';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { staffSelectionHeaders } from '@/lib/staffSelection';

type Translate = (key: string, fallback: string) => string;

async function command<T>(t: Translate, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let json;
    try { json = await response.json(); }
    catch { throw new FinanceWriteError(t('staff.finance.write.noResponse', 'Ответ сервера не получен. Проверьте смену перед следующей записью.'), response.ok ? 0 : response.status); }
    if (!response.ok || !json.ok) throw new FinanceWriteError(json.message || t('staff.finance.write.unconfirmed', 'Не удалось подтвердить финансовую операцию.'), response.status);
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
    // Own shift (no staffId): every request names the card on screen (ARCH-02). A string, not an
    // object, goes into the memo: a new transport identity would start a new draft session.
    const selectedStaffId = useSelectedStaffId();
    const selfStaffId = staffId ? null : selectedStaffId;
    // The translator is read at call time: a new one must not start a new draft session.
    const { t } = useLanguage();
    const tRef = useRef(t as Translate);
    useEffect(() => { tRef.current = t as Translate; }, [t]);
    return useMemo(() => {
        // Capture primitive scope for the entire lifetime of this draft, including pending requests on navigation.
        const queryKey = ['finance', staffId || 'current', dateStr ?? 'today'];
        const headers = staffSelectionHeaders(selfStaffId);
        const endpoint = (action: 'open' | 'close', selectedDate?: string) => {
            const base = staffId ? '/api/dashboard/staff/' + staffId + '/shift/' + action : '/api/staff/shift/' + action;
            return selectedDate ? base + '?date=' + selectedDate : base;
        };
        const refresh = () => { void queryClient.invalidateQueries({ queryKey }); };
        return {
            load: async (selectedDate) => {
                const payload = await fetchFinanceData(staffId, selectedDate ?? dateStr ?? null, undefined, headers, tRef.current);
                queryClient.setQueryData(queryKey, payload);
                return { shift: payload.today.shift, items: payload.today.items, calendarDate: payload.calendar?.date ?? payload.today.shift?.shift_date };
            },
            open: (selectedDate) => command(tRef.current, endpoint('open', selectedDate ?? dateStr), undefined, headers),
            save: async (items, version) => {
                const receipt = await command<FinanceSaveReceipt>(tRef.current, '/api/staff/shift/items', {
                    items: wireItems(items), staffId, shiftDate: version.calendarDate ?? dateStr,
                    expectedShiftId: version.expectedShiftId, expectedRevision: version.expectedRevision,
                }, headers);
                refresh();
                return receipt;
            },
            close: async (items, version) => {
                const result = await command<{ shift: Shift }>(tRef.current, endpoint('close', version.calendarDate ?? dateStr), {
                    items: wireItems(items), totalAmount: items.reduce((sum, item) => sum + (item.serviceAmount ?? 0), 0), expectedShiftId: version.expectedShiftId, expectedRevision: version.expectedRevision,
                }, headers);
                refresh();
                return result?.shift;
            },
        };
    }, [dateStr, staffId, selfStaffId, queryClient]);
}

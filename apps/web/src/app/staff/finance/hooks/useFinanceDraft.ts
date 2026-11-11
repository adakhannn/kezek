import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { FinanceDraftSession, type FinanceTransport } from '../services/financeDraftSession';
import type { ShiftItem } from '../types';

import type { FinanceData } from './useFinanceData';

export function useFinanceDraft(transport: FinanceTransport, data: FinanceData | null,
    prepare: (items: ShiftItem[]) => ShiftItem[]) {
    const session = useMemo(() => new FinanceDraftSession(transport), [transport]);
    const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
    useEffect(() => { session.setPrepare(prepare); }, [session, prepare]);
    useEffect(() => {
        if (data) session.receive({ shift: data.shift, items: data.items, calendarDate: data.calendar?.date ?? data.shift?.shift_date });
    }, [data, session]);
    return { session, state };
}

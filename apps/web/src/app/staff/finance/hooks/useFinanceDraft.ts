import { useEffect, useMemo, useSyncExternalStore } from 'react';


import { FinanceDraftSession, type FinanceTransport } from '../services/financeDraftSession';
import type { ShiftItem } from '../types';

import type { FinanceData } from './useFinanceData';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export function useFinanceDraft(transport: FinanceTransport, data: FinanceData | null,
    prepare: (items: ShiftItem[]) => ShiftItem[]) {
    const { t } = useLanguage();
    const session = useMemo(() => new FinanceDraftSession(transport), [transport]);
    useEffect(() => { session.setTranslator(t as (key: string, fallback: string) => string); }, [session, t]);
    const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
    useEffect(() => { session.setPrepare(prepare); }, [session, prepare]);
    useEffect(() => {
        if (data) session.receive({ shift: data.shift, items: data.items, calendarDate: data.calendar?.date ?? data.shift?.shift_date });
    }, [data, session]);
    return { session, state };
}

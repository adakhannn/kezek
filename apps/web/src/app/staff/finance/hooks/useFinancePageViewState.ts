import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { PeriodKey, TabKey } from '../types';

import { todayTz } from '@/lib/time';

type Options = { staffId?: string; viewScope?: string };
type View = {
    activeTab: TabKey; statsPeriod: PeriodKey;
    selectedDate: Date; selectedMonth: Date; selectedYear: number;
};
type StoredView = Omit<View, 'selectedDate' | 'selectedMonth'> & { selectedDate: string; selectedMonth: string };
const changed = 'kezek-finance-view-changed';
const fallbackViews = new Map<string, string>();
const unavailableKeys = new Set<string>();
const serverSnapshot = () => '';
const isTab = (value: unknown): value is TabKey => value === 'shift' || value === 'clients' || value === 'stats';

function storedDate(value: unknown, fallback: Date): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return fallback;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? parsed : fallback;
}

function restore(raw: string, defaults: View): View {
    let saved: Record<string, unknown> = {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>;
    } catch { /* Invalid view metadata must not break finance. */ }
    return {
        activeTab: isTab(saved.activeTab) ? saved.activeTab : defaults.activeTab,
        statsPeriod: saved.statsPeriod === 'day' || saved.statsPeriod === 'month' || saved.statsPeriod === 'year' ? saved.statsPeriod : 'all',
        selectedDate: storedDate(saved.selectedDate, defaults.selectedDate),
        selectedMonth: storedDate(saved.selectedMonth, defaults.selectedMonth),
        selectedYear: typeof saved.selectedYear === 'number' && Number.isInteger(saved.selectedYear)
            && saved.selectedYear >= 1000 && saved.selectedYear <= 9999 ? saved.selectedYear : defaults.selectedYear,
    };
}

function serialize(view: View): StoredView {
    return { ...view, selectedDate: view.selectedDate.toISOString(), selectedMonth: view.selectedMonth.toISOString() };
}

function subscribe(listener: () => void) {
    window.addEventListener(changed, listener);
    window.addEventListener('storage', listener);
    return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', listener); };
}

export function useFinancePageViewState({ staffId, viewScope }: Options) {
    const initialTab: TabKey = staffId ? 'clients' : 'shift';
    const key = viewScope ? 'finance-view-v1-' + viewScope : 'finance-active-tab-' + (staffId || 'current');
    const [dateDefaults] = useState(() => ({ selectedDate: todayTz(), selectedMonth: todayTz(), selectedYear: new Date().getFullYear() }));
    const defaults = useMemo<View>(() => ({ ...dateDefaults, activeTab: initialTab, statsPeriod: 'all' }), [dateDefaults, initialTab]);
    const read = useCallback(() => {
        if (unavailableKeys.has(key)) return fallbackViews.get(key) ?? '';
        try { return sessionStorage.getItem(key) ?? ''; }
        catch { return fallbackViews.get(key) ?? ''; }
    }, [key]);
    const raw = useSyncExternalStore(subscribe, read, serverSnapshot);
    const saved = useMemo(() => restore(raw, defaults), [raw, defaults]);
    const write = useCallback((value: string) => {
        fallbackViews.set(key, value);
        try { sessionStorage.setItem(key, value); unavailableKeys.delete(key); }
        catch { unavailableKeys.add(key); }
        window.dispatchEvent(new Event(changed));
    }, [key]);
    const update = useCallback((patch: Partial<StoredView>) => {
        write(JSON.stringify({ ...serialize(restore(read(), defaults)), ...patch }));
    }, [read, write, defaults]);

    const activeTab = viewScope ? saved.activeTab : isTab(raw) ? raw : initialTab;
    const activeTabRef = useRef<TabKey>(activeTab);
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
    const [localPeriod, setLocalPeriod] = useState<PeriodKey>('all');
    const [localDate, setLocalDate] = useState(dateDefaults.selectedDate);
    const [localMonth, setLocalMonth] = useState(dateDefaults.selectedMonth);
    const [localYear, setLocalYear] = useState(dateDefaults.selectedYear);
    // Never restore operation date, financial rows or editing/expanded state.
    const [shiftDate, setShiftDate] = useState<Date>(todayTz());
    const [showShiftDetails, setShowShiftDetails] = useState(false);
    const previousTabRef = useRef<TabKey | null>(null);

    const handleTabChange = useCallback((tab: TabKey) => {
        activeTabRef.current = tab;
        if (viewScope) update({ activeTab: tab }); else write(tab);
    }, [viewScope, update, write]);

    return {
        activeTab, activeTabRef, shiftDate, setShiftDate, showShiftDetails, setShowShiftDetails, previousTabRef, handleTabChange,
        statsPeriod: viewScope ? saved.statsPeriod : localPeriod,
        setStatsPeriod: (value: PeriodKey) => viewScope ? update({ statsPeriod: value }) : setLocalPeriod(value),
        selectedDate: viewScope ? saved.selectedDate : localDate,
        setSelectedDate: (value: Date) => viewScope ? update({ selectedDate: value.toISOString() }) : setLocalDate(value),
        selectedMonth: viewScope ? saved.selectedMonth : localMonth,
        setSelectedMonth: (value: Date) => viewScope ? update({ selectedMonth: value.toISOString() }) : setLocalMonth(value),
        selectedYear: viewScope ? saved.selectedYear : localYear,
        setSelectedYear: (value: number) => viewScope ? update({ selectedYear: value }) : setLocalYear(value),
    };
}

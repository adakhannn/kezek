import { useCallback, useEffect, useRef, useState } from 'react';

import type { PeriodKey, TabKey } from '../types';

import { todayTz } from '@/lib/time';

type Options = {
    staffId?: string;
};

export function useFinancePageViewState({ staffId }: Options) {
    const getInitialTab = useCallback((): TabKey => (staffId ? 'clients' : 'shift'), [staffId]);

    const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab);
    const activeTabRef = useRef<TabKey>(getInitialTab());
    const [statsPeriod, setStatsPeriod] = useState<PeriodKey>('all');
    const [shiftDate, setShiftDate] = useState<Date>(todayTz());
    const [selectedDate, setSelectedDate] = useState<Date>(todayTz());
    const [selectedMonth, setSelectedMonth] = useState<Date>(todayTz());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [showShiftDetails, setShowShiftDetails] = useState(false);
    const previousTabRef = useRef<TabKey | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const key = `finance-active-tab-${staffId || 'current'}`;
        const savedTab = sessionStorage.getItem(key);
        if (savedTab === 'shift' || savedTab === 'clients' || savedTab === 'stats') {
            activeTabRef.current = savedTab as TabKey;
            setActiveTab((current) => (current !== savedTab ? (savedTab as TabKey) : current));
        }
    }, [staffId, getInitialTab]);

    useEffect(() => {
        activeTabRef.current = activeTab;
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(`finance-active-tab-${staffId || 'current'}`, activeTab);
        }
    }, [activeTab, staffId]);

    const handleTabChange = useCallback(
        (tab: TabKey) => {
            activeTabRef.current = tab;
            setActiveTab(tab);
            if (typeof window !== 'undefined') {
                sessionStorage.setItem(`finance-active-tab-${staffId || 'current'}`, tab);
            }
        },
        [staffId],
    );

    return {
        activeTab,
        activeTabRef,
        statsPeriod,
        setStatsPeriod,
        shiftDate,
        setShiftDate,
        selectedDate,
        setSelectedDate,
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        showShiftDetails,
        setShowShiftDetails,
        previousTabRef,
        handleTabChange,
    };
}

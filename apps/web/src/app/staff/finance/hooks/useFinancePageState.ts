import { useCallback, useEffect, useRef, useState } from 'react';

import { todayTz } from '@/lib/time';

import type { PeriodKey, TabKey } from '../types';

export function useFinancePageState(staffId?: string) {
    const getInitialTab = useCallback((): TabKey => {
        if (typeof window === 'undefined') {
            return staffId ? 'clients' : 'shift';
        }

        const savedTab = sessionStorage.getItem(`finance-active-tab-${staffId || 'current'}`);
        if (savedTab === 'shift' || savedTab === 'clients' || savedTab === 'stats') {
            return savedTab;
        }

        return staffId ? 'clients' : 'shift';
    }, [staffId]);

    const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab);
    const activeTabRef = useRef<TabKey>(getInitialTab());
    const [statsPeriod, setStatsPeriod] = useState<PeriodKey>('all');
    const [shiftDate, setShiftDate] = useState<Date>(todayTz());
    const [selectedDate, setSelectedDate] = useState<Date>(todayTz());
    const [selectedMonth, setSelectedMonth] = useState<Date>(todayTz());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [showShiftDetails, setShowShiftDetails] = useState(false);

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
        [staffId]
    );

    return {
        activeTab,
        activeTabRef,
        handleTabChange,
        setActiveTab,
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
    };
}

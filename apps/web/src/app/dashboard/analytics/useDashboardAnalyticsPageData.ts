'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
    BranchOption,
    DashboardTrendChartData,
    LoadResponse,
    OverviewResponse,
    PeriodPreset,
} from './types';

import { addDaysToDateString, todayDateString } from '@/lib/time';

export function useDashboardAnalyticsPageData() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [branchId, setBranchId] = useState<string>('all');
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [data, setData] = useState<OverviewResponse['data'] | null>(null);
    const [loadData, setLoadData] = useState<LoadResponse['data'] | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const endDefault = todayDateString();
        const startDefault = addDaysToDateString(endDefault, -30);
        setStartDate(startDefault);
        setEndDate(endDefault);
    }, []);

    useEffect(() => {
        let ignore = false;

        async function loadBranches() {
            try {
                const response = await fetch('/api/dashboard/branches/list', { cache: 'no-store' });
                if (!response.ok) return;

                const json = (await response.json()) as { ok?: boolean; data?: BranchOption[] };
                if (!json.ok || !Array.isArray(json.data)) return;

                if (!ignore) {
                    setBranches(json.data);
                }
            } catch {
                // Optional branch filter.
            }
        }

        void loadBranches();
        return () => {
            ignore = true;
        };
    }, []);

    useEffect(() => {
        if (!startDate || !endDate) return;
        let ignore = false;

        async function loadAll() {
            try {
                setLoading(true);
                setError(null);

                const params = new URLSearchParams();
                params.set('startDate', startDate);
                params.set('endDate', endDate);

                const [overviewResponse, loadResponse] = await Promise.all([
                    fetch(`/api/dashboard/analytics/overview?${params.toString()}`, {
                        cache: 'no-store',
                    }),
                    fetch(
                        `/api/dashboard/analytics/load?${new URLSearchParams({
                            startDate,
                            endDate,
                            ...(branchId !== 'all' ? { branchId } : {}),
                        }).toString()}`,
                        { cache: 'no-store' },
                    ),
                ]);

                if (!overviewResponse.ok) {
                    throw new Error(`Overview HTTP ${overviewResponse.status}`);
                }
                const overviewJson = (await overviewResponse.json()) as OverviewResponse;
                if (!overviewJson.ok || !overviewJson.data) {
                    throw new Error(overviewJson.error || 'Не удалось загрузить данные обзора');
                }

                if (!loadResponse.ok) {
                    throw new Error(`Load HTTP ${loadResponse.status}`);
                }
                const loadJson = (await loadResponse.json()) as LoadResponse;
                if (!loadJson.ok || !loadJson.data) {
                    throw new Error(loadJson.error || 'Не удалось загрузить данные по загрузке');
                }

                if (!ignore) {
                    setData(overviewJson.data);
                    setLoadData(loadJson.data);
                }
            } catch (value) {
                if (!ignore) {
                    setError(value instanceof Error ? value.message : String(value));
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        }

        void loadAll();
        return () => {
            ignore = true;
        };
    }, [branchId, endDate, reloadKey, startDate]);

    const trendChartData = useMemo<DashboardTrendChartData | null>(() => {
        if (!data) return null;
        return {
            bookings: data.byDay.map((point) => ({ x: point.date, y: point.bookingsConfirmedOrPaid })),
            revenue: data.byDay.map((point) => ({ x: point.date, y: point.totalRevenue })),
        };
    }, [data]);

    const promoShare =
        data && data.summary.revenue.total > 0 && data.summary.revenue.promoRevenue > 0
            ? Math.round(((data.summary.revenue.promoRevenue / data.summary.revenue.total) * 100 + Number.EPSILON) * 100) / 100
            : 0;

    const handlePresetChange = (preset: PeriodPreset) => {
        setPeriodPreset(preset);
        if (preset === 'custom') return;

        const days = preset === '7' ? 7 : preset === '30' ? 30 : 90;
        const end = todayDateString();
        const start = addDaysToDateString(end, -days);
        setStartDate(start);
        setEndDate(end);
    };

    const retry = () => {
        setError(null);
        setLoading(true);
        setReloadKey((value) => value + 1);
    };

    return {
        loading,
        error,
        periodPreset,
        startDate,
        endDate,
        branchId,
        branches,
        data,
        loadData,
        trendChartData,
        promoShare,
        setBranchId,
        handlePresetChange,
        retry,
        setStartDateAndCustom: (value: string) => {
            setPeriodPreset('custom');
            setStartDate(value);
        },
        setEndDateAndCustom: (value: string) => {
            setPeriodPreset('custom');
            setEndDate(value);
        },
    };
}

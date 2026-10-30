'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadPersistedAnalyticsFilters, persistAnalyticsFilters } from '../filterPersistence';

import type { OverviewResponse, PeriodPreset, TrendChartData } from './types';

import { addDaysToDateString, todayDateString } from '@/lib/time';

export function useAdminAnalyticsOverviewData() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [data, setData] = useState<OverviewResponse['data'] | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const endDefault = todayDateString();
        const startDefault = addDaysToDateString(endDefault, -30);
        const persisted = loadPersistedAnalyticsFilters();

        setStartDate(persisted.startDate ?? startDefault);
        setEndDate(persisted.endDate ?? endDefault);
    }, []);

    useEffect(() => {
        if (!startDate || !endDate) return;
        let ignore = false;

        async function loadOverview() {
            try {
                setLoading(true);
                setError(null);

                const params = new URLSearchParams();
                params.set('startDate', startDate);
                params.set('endDate', endDate);

                const response = await fetch(`/admin/api/analytics/overview?${params.toString()}`, {
                    cache: 'no-store',
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = (await response.json()) as OverviewResponse;
                if (!json.ok || !json.data) {
                    throw new Error(json.error || 'Не удалось загрузить данные обзора');
                }

                if (!ignore) {
                    setData(json.data);
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

        void loadOverview();
        return () => {
            ignore = true;
        };
    }, [endDate, reloadKey, startDate]);

    useEffect(() => {
        if (!startDate || !endDate) return;
        persistAnalyticsFilters({
            startDate,
            endDate,
        });
    }, [endDate, startDate]);

    const trendChartData = useMemo<TrendChartData | null>(() => {
        if (!data) return null;

        return {
            bookings: data.byDay.map((point) => ({ x: point.date, y: point.bookingsConfirmedOrPaid })),
            revenue: data.byDay.map((point) => ({ x: point.date, y: point.totalRevenue })),
            promoShare: data.byDay.map((point) => {
                const total = point.bookingsConfirmedOrPaid || 0;
                const promo = point.promoBookings || 0;
                const share = total > 0 ? Math.round(((promo / total) * 100 + Number.EPSILON) * 100) / 100 : 0;
                return { x: point.date, y: share };
            }),
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
        data,
        trendChartData,
        promoShare,
        handlePresetChange,
        retry,
        setStartDateAndCustom: (value: string) => {
            setStartDate(value);
            setPeriodPreset('custom');
        },
        setEndDateAndCustom: (value: string) => {
            setEndDate(value);
            setPeriodPreset('custom');
        },
    };
}

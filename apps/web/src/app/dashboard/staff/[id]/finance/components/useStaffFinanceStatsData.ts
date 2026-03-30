'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useState } from 'react';

import type { StaffFinanceStatsPayload, StaffFinanceStatsPeriod, StaffFinanceStatsResponse } from '@/lib/finance/types';
import { logDebug, logError } from '@/lib/log';
import { TZ } from '@/lib/time';

export function useStaffFinanceStatsData({
    staffId,
    t,
}: {
    staffId: string;
    t: (key: string, fallback: string) => string;
}) {
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<StaffFinanceStatsPeriod>('day');
    const [date, setDate] = useState(formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [stats, setStats] = useState<StaffFinanceStatsPayload | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const dateParam =
                period === 'year'
                    ? (date.split('-')[0] ?? date)
                    : period === 'month'
                        ? (date.length >= 7 ? date.substring(0, 7) : date)
                        : date.length === 7
                            ? `${date}-01`
                            : date.length === 4
                                ? `${date}-01-01`
                                : date;

            const url = `/api/dashboard/staff/${staffId}/finance/stats?period=${period}&date=${encodeURIComponent(dateParam)}`;
            logDebug('StaffFinanceStats', 'Loading stats', { url, staffId, period, date: dateParam });
            const response = await fetch(url, { cache: 'no-store' });
            const json = (await response.json()) as StaffFinanceStatsResponse;
            logDebug('StaffFinanceStats', 'Stats response', json);

            if (!json.ok) {
                throw new Error(json.error || t('finance.loading', 'Не удалось загрузить статистику'));
            }

            const payload =
                (json as { data?: { stats?: StaffFinanceStatsPayload }; stats?: StaffFinanceStatsPayload }).data?.stats ??
                (json as { stats?: StaffFinanceStatsPayload }).stats;

            setStats(payload ?? null);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setError(message);
            logError('StaffFinanceStats', 'Error loading stats', error);
        } finally {
            setLoading(false);
        }
    }, [date, period, staffId, t]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    return {
        loading,
        period,
        date,
        stats,
        error,
        setPeriod,
        setDate,
        loadStats,
    };
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { StaffFinanceStatsPayload, StaffFinanceStatsPeriod, StaffFinanceStatsResponse } from '@/lib/finance/types';
import { logDebug, logError } from '@/lib/log';

export function useStaffFinanceStatsData({
    staffId,
    t,
}: {
    staffId: string;
    t: (key: string, fallback: string) => string;
}) {
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<StaffFinanceStatsPeriod>('day');
    const [selectedDate, setDate] = useState<string | null>(null);
    const [serverDate, setServerDate] = useState('');
    const sequence = useRef(0);
    const [stats, setStats] = useState<StaffFinanceStatsPayload | null>(null);
    const [error, setError] = useState<string | null>(null);

    const request = useMemo(() => ({ staffId, selectedDate, period }), [staffId, selectedDate, period]);
    const [snapshotOwner, setSnapshotOwner] = useState<object | null>(null);
    const ownsSnapshot = snapshotOwner === request;
    const date = selectedDate ?? (ownsSnapshot ? serverDate : '');
    const loadStats = useCallback(async () => {
        const requestId = ++sequence.current;
        setLoading(true);
        setError(null);
        try {
            const date = selectedDate ?? '';
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

            const params = new URLSearchParams({ period });
            if (selectedDate) params.set('date', dateParam);
            const url = `/api/dashboard/staff/${staffId}/finance/stats?${params}`;
            logDebug('StaffFinanceStats', 'Loading stats', { url, staffId, period, date: dateParam });
            const response = await fetch(url, { cache: 'no-store' });
            const json = (await response.json()) as StaffFinanceStatsResponse;
            logDebug('StaffFinanceStats', 'Stats response', json);

            if (requestId !== sequence.current) return;
            if (!response.ok || !json.ok) {
                throw new Error(('error' in json && json.error) || t('finance.loading', 'Не удалось загрузить статистику'));
            }

            const payload =
                (json as { data?: { stats?: StaffFinanceStatsPayload }; stats?: StaffFinanceStatsPayload }).data?.stats ??
                (json as { stats?: StaffFinanceStatsPayload }).stats;

            if (!payload) throw new Error('Неполный финансовый отчёт');
            setSnapshotOwner(request);
            setServerDate(payload.dateFrom);
            setStats(payload);
        } catch (error) {
            if (requestId !== sequence.current) return;
            setSnapshotOwner(request);
            const message = error instanceof Error ? error.message : String(error);
            setError(message);
            logError('StaffFinanceStats', 'Error loading stats', error);
        } finally {
            if (requestId === sequence.current) setLoading(false);
        }
    }, [selectedDate, period, staffId, t, request]);

    useEffect(() => {
        void loadStats();
        return () => { sequence.current += 1; };
    }, [loadStats]);

    return {
        loading: !ownsSnapshot || loading,
        period,
        date,
        stats: ownsSnapshot ? stats : null,
        error: ownsSnapshot ? error : null,
        setPeriod,
        setDate,
        loadStats,
    };
}

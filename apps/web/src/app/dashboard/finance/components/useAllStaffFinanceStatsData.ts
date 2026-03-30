'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useState } from 'react';

import type { BranchOption, Period, StaffStat, TotalStats } from './allStaffFinanceStatsTypes';

import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';

export function useAllStaffFinanceStatsData({
    t,
}: {
    t: (key: string, fallback?: string) => string;
}) {
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('day');
    const [date, setDate] = useState(formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
    const [totalStats, setTotalStats] = useState<TotalStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [branchId, setBranchId] = useState<string | 'all'>('all');

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                period,
                date,
            });
            if (branchId !== 'all') {
                params.set('branchId', branchId);
            }

            const response = await fetch(`/api/dashboard/finance/all?${params.toString()}`, {
                cache: 'no-store',
            });
            const json = (await response.json()) as {
                ok?: boolean;
                message?: string;
                error?: string;
                details?: unknown;
                branches?: { id: string; name: string }[];
                staffStats?: StaffStat[];
                totalStats?: TotalStats | null;
            };

            if (!json.ok) {
                const errorMessage = json.message || json.error || t('finance.loading', 'Не удалось загрузить статистику');
                const errorDetails = json.details ? ` (${JSON.stringify(json.details)})` : '';
                throw new Error(errorMessage + errorDetails);
            }

            const apiBranches: BranchOption[] = Array.isArray(json.branches)
                ? json.branches.map((branch) => ({
                      id: String(branch.id),
                      name: String(branch.name),
                  }))
                : [];

            setBranches(apiBranches);
            setStaffStats(json.staffStats || []);
            setTotalStats(json.totalStats || null);
        } catch (value) {
            const message = value instanceof Error ? value.message : String(value);
            setError(message);
            logError('AllStaffFinanceStats', 'Error loading stats', value);
        } finally {
            setLoading(false);
        }
    }, [branchId, date, period, t]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    useEffect(() => {
        if (period !== 'day') return;

        const interval = setInterval(() => {
            void loadStats();
        }, 60000);

        return () => clearInterval(interval);
    }, [loadStats, period]);

    return {
        loading,
        period,
        date,
        staffStats,
        totalStats,
        error,
        branches,
        branchId,
        setPeriod,
        setDate,
        setBranchId,
        loadStats,
    };
}

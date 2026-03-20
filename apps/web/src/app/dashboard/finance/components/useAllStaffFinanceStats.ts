import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useState } from 'react';

import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';
import type { BranchOption, Period, StaffStat, TotalStats } from './allStaffFinanceStatsTypes';

type TranslationFn = (key: string, fallback: string) => string;

export function useAllStaffFinanceStats(t: TranslationFn, locale: string) {
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
            const params = new URLSearchParams({ period, date });
            if (branchId !== 'all') {
                params.set('branchId', branchId);
            }

            const res = await fetch(`/api/dashboard/finance/all?${params.toString()}`, {
                cache: 'no-store',
            });
            const json = await res.json();
            if (!json.ok) {
                const errorMsg = json.message || json.error || t('finance.loading', 'Не удалось загрузить статистику');
                const errorDetails = json.details ? ` (${JSON.stringify(json.details)})` : '';
                throw new Error(errorMsg + errorDetails);
            }

            const apiBranches: BranchOption[] = Array.isArray(json.branches)
                ? json.branches.map((branch: { id: string; name: string }) => ({
                      id: String(branch.id),
                      name: String(branch.name),
                  }))
                : [];

            setBranches(apiBranches);
            setStaffStats(json.staffStats || []);
            setTotalStats(json.totalStats || null);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            logError('AllStaffFinanceStats', 'Error loading stats', e);
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
    }, [period, loadStats]);

    const formatPeriodLabel = useCallback(() => {
        if (period === 'day') {
            return new Date(date + 'T12:00:00').toLocaleDateString(
                locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU',
                { day: '2-digit', month: 'long', year: 'numeric' }
            );
        }

        if (period === 'month') {
            const [year, month] = date.split('-');
            return new Date(`${year}-${month}-01`).toLocaleDateString(
                locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU',
                { month: 'long', year: 'numeric' }
            );
        }

        return date.split('-')[0];
    }, [date, locale, period]);

    return {
        loading,
        period,
        setPeriod,
        date,
        setDate,
        staffStats,
        totalStats,
        error,
        branches,
        branchId,
        setBranchId,
        loadStats,
        formatPeriodLabel,
    };
}

import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useState } from 'react';

import { logDebug, logError } from '@/lib/log';
import { TZ } from '@/lib/time';
import type { Period, Stats } from './staffFinanceStatsTypes';

type TranslationFn = (key: string, fallback: string) => string;

export function useStaffFinanceStats(
    staffId: string,
    t: TranslationFn,
    locale: string
) {
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('day');
    const [date, setDate] = useState(formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [stats, setStats] = useState<Stats | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `/api/dashboard/staff/${staffId}/finance/stats?period=${period}&date=${date}`;
            logDebug('StaffFinanceStats', 'Loading stats', { url, staffId, period, date });
            const res = await fetch(url, { cache: 'no-store' });
            const json = await res.json();
            logDebug('StaffFinanceStats', 'Stats response', json);
            if (!json.ok) {
                throw new Error(json.error || t('finance.loading', 'Не удалось загрузить статистику'));
            }

            setStats(json.stats);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            logError('StaffFinanceStats', 'Error loading stats', e);
        } finally {
            setLoading(false);
        }
    }, [staffId, period, date, t]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

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
        stats,
        error,
        loadStats,
        formatPeriodLabel,
    };
}

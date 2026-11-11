'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { BranchOption, Period, StaffStat, TotalStats } from './allStaffFinanceStatsTypes';
import { financePeriodDate } from './financePeriodDate';

import { logError } from '@/lib/log';

export function useAllStaffFinanceStatsData({
    t,
}: {
    t: (key: string, fallback?: string) => string;
}) {
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('day');
    const [selectedDate, setDate] = useState<string | null>(null);
    const [serverDate, setServerDate] = useState('');
    const sequence = useRef(0);
    const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
    const [totalStats, setTotalStats] = useState<TotalStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [branchId, setBranchId] = useState<string | 'all'>('all');

    const request = useMemo(() => ({ branchId, selectedDate, period }), [branchId, selectedDate, period]);
    const [snapshotOwner, setSnapshotOwner] = useState<object | null>(null);
    const ownsSnapshot = snapshotOwner === request;
    const date = selectedDate ?? (ownsSnapshot ? serverDate : '');
    const loadStats = useCallback(async () => {
        const requestId = ++sequence.current;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                period,
            });
            if (selectedDate) params.set('date', financePeriodDate(period, selectedDate));
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
                data?: {
                    dateFrom?: string;
                    branches?: { id: string; name: string }[];
                    staffStats?: StaffStat[];
                    totalStats?: TotalStats | null;
                };
            };

            if (requestId !== sequence.current) return;
            if (!response.ok || !json.ok || !json.data) {
                const errorMessage = json.message || json.error || t('finance.loading', 'Не удалось загрузить статистику');
                const errorDetails = json.details ? ` (${JSON.stringify(json.details)})` : '';
                throw new Error(errorMessage + errorDetails);
            }

            const apiBranches: BranchOption[] = Array.isArray(json.data.branches)
                ? json.data.branches.map((branch) => ({
                      id: String(branch.id),
                      name: String(branch.name),
                  }))
                : [];

            setSnapshotOwner(request);
            setServerDate(json.data.dateFrom ?? '');
            setBranches(apiBranches);
            setStaffStats(json.data.staffStats || []);
            setTotalStats(json.data.totalStats || null);
        } catch (value) {
            if (requestId !== sequence.current) return;
            setSnapshotOwner(request);
            const message = value instanceof Error ? value.message : String(value);
            setError(message);
            logError('AllStaffFinanceStats', 'Error loading stats', value);
        } finally {
            if (requestId === sequence.current) setLoading(false);
        }
    }, [branchId, selectedDate, period, t, request]);

    useEffect(() => {
        void loadStats();
        return () => { sequence.current += 1; };
    }, [loadStats]);

    useEffect(() => {
        if (period !== 'day') return;

        const interval = setInterval(() => {
            void loadStats();
        }, 60000);

        return () => clearInterval(interval);
    }, [loadStats, period]);

    return {
        loading: !ownsSnapshot || loading,
        period,
        date,
        staffStats: ownsSnapshot ? staffStats : [],
        totalStats: ownsSnapshot ? totalStats : null,
        error: ownsSnapshot ? error : null,
        branches: ownsSnapshot ? branches : [],
        branchId,
        setPeriod,
        setDate,
        setBranchId,
        loadStats,
    };
}

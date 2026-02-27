'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { formatDateTime } from '@/lib/dateFormat';

type DebugEntity = {
    days: number;
    window_since: string;
    with_null_rating: {
        staff: { id: string; full_name: string | null; biz_id: string; branch_id: string }[];
        branches: { id: string; name: string; biz_id: string }[];
        businesses: { id: string; name: string | null; slug: string | null }[];
    };
    without_metrics_since: {
        staff: { id: string; full_name: string | null; biz_id: string; branch_id: string }[];
        branches: { id: string; name: string; biz_id: string }[];
        businesses: { id: string; name: string | null; slug: string | null }[];
        total_count: { staff: number; branches: number; businesses: number };
    };
    recent_errors: {
        id: string;
        entity_id: string;
        entity_type: string;
        metric_date: string;
        error_message: string;
        created_at: string;
    }[];
};

type ApiResponse = { ok: boolean; error?: string; data?: DebugEntity };

const DAYS_OPTIONS = [1, 3, 7, 14, 30, 90];

function Table({
    title,
    count,
    rows,
    columns,
}: {
    title: string;
    count: number;
    rows: Record<string, unknown>[];
    columns: { key: string; label: string }[];
}) {
    if (rows.length === 0 && count === 0) return null;
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                {title}
                {count > rows.length && (
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                        (показано {rows.length} из {count})
                    </span>
                )}
            </div>
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                        {columns.map((c) => (
                            <th key={c.key} className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                            {columns.map((c) => (
                                <td key={c.key} className="px-4 py-2 text-gray-800 dark:text-gray-200">
                                    {String(row[c.key] ?? '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function RatingsDebugClient() {
    const { t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const daysParam = searchParams.get('days');
    const initialDays = Math.min(90, Math.max(1, parseInt(daysParam ?? '7', 10) || 7));
    const [days, setDays] = useState(initialDays);
    const [data, setData] = useState<DebugEntity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/ratings/debug-entities?days=${days}`, { cache: 'no-store' });
            const json = (await res.json()) as ApiResponse;
            if (res.status === 401 || res.status === 403) {
                router.push(`/auth/sign-in?redirect=${encodeURIComponent(`/admin/ratings-debug?days=${days}`)}`);
                return;
            }
            if (!json.ok || !json.data) {
                setError(json.error ?? 'Не удалось загрузить данные');
                setData(null);
                return;
            }
            setData(json.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка запроса');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [days, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateDays = (d: number) => {
        setDays(d);
        const u = new URLSearchParams(searchParams.toString());
        u.set('days', String(d));
        router.replace(`/admin/ratings-debug?${u.toString()}`, { scroll: false });
    };

    return (
        <main className="max-w-5xl mx-auto space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {t('admin.ratingsDebug.title', 'Отладка рейтингов')}
                        </h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {t('admin.ratingsDebug.description', 'Сущности с NULL рейтингом, без метрик за период, последние ошибки пересчёта.')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400" htmlFor="days">
                            {t('admin.ratingsDebug.daysLabel', 'Дней без метрик')}:
                        </label>
                        <select
                            id="days"
                            value={days}
                            onChange={(e) => updateDays(Number(e.target.value))}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        >
                            {DAYS_OPTIONS.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => fetchData()}
                            className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                        >
                            {t('common.refresh', 'Обновить')}
                        </button>
                    </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <Link href="/admin/ratings-status" className="underline hover:no-underline">
                        {t('admin.ratingsDebug.backToStatus', '← Здоровье рейтингов')}
                    </Link>
                </p>
            </section>

            {loading && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    {t('common.loading', 'Загрузка…')}
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            {!loading && !error && data && (
                <>
                    <section>
                        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {t('admin.ratingsDebug.withNullRating', 'С рейтингом NULL')}
                        </h2>
                        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                            {t('admin.ratingsDebug.windowSince', 'Окно «без метрик»')}: с {data.window_since}
                        </p>
                        <div className="space-y-4">
                            <Table
                                title={t('admin.ratingsDebug.staff', 'Сотрудники')}
                                count={data.with_null_rating.staff.length}
                                rows={data.with_null_rating.staff}
                                columns={[
                                    { key: 'id', label: 'ID' },
                                    { key: 'full_name', label: t('admin.ratingsDebug.name', 'Имя') },
                                    { key: 'biz_id', label: 'biz_id' },
                                    { key: 'branch_id', label: 'branch_id' },
                                ]}
                            />
                            <Table
                                title={t('admin.ratingsDebug.branches', 'Филиалы')}
                                count={data.with_null_rating.branches.length}
                                rows={data.with_null_rating.branches}
                                columns={[
                                    { key: 'id', label: 'ID' },
                                    { key: 'name', label: t('admin.ratingsDebug.name', 'Имя') },
                                    { key: 'biz_id', label: 'biz_id' },
                                ]}
                            />
                            <Table
                                title={t('admin.ratingsDebug.businesses', 'Бизнесы')}
                                count={data.with_null_rating.businesses.length}
                                rows={data.with_null_rating.businesses}
                                columns={[
                                    { key: 'id', label: 'ID' },
                                    { key: 'name', label: t('admin.ratingsDebug.name', 'Имя') },
                                    { key: 'slug', label: 'slug' },
                                ]}
                            />
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {t('admin.ratingsDebug.withoutMetrics', 'Без метрик за последние N дней')}
                        </h2>
                        <div className="space-y-4">
                            <Table
                                title={t('admin.ratingsDebug.staff', 'Сотрудники')}
                                count={data.without_metrics_since.total_count.staff}
                                rows={data.without_metrics_since.staff}
                                columns={[
                                    { key: 'id', label: 'ID' },
                                    { key: 'full_name', label: t('admin.ratingsDebug.name', 'Имя') },
                                    { key: 'biz_id', label: 'biz_id' },
                                    { key: 'branch_id', label: 'branch_id' },
                                ]}
                            />
                            <Table
                                title={t('admin.ratingsDebug.branches', 'Филиалы')}
                                count={data.without_metrics_since.total_count.branches}
                                rows={data.without_metrics_since.branches}
                                columns={[
                                    { key: 'id', label: 'ID' },
                                    { key: 'name', label: t('admin.ratingsDebug.name', 'Имя') },
                                    { key: 'biz_id', label: 'biz_id' },
                                ]}
                            />
                            <Table
                                title={t('admin.ratingsDebug.businesses', 'Бизнесы')}
                                count={data.without_metrics_since.total_count.businesses}
                                rows={data.without_metrics_since.businesses}
                                columns={[
                                    { key: 'id', label: 'ID' },
                                    { key: 'name', label: t('admin.ratingsDebug.name', 'Имя') },
                                    { key: 'slug', label: 'slug' },
                                ]}
                            />
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {t('admin.ratingsDebug.recentErrors', 'Последние ошибки пересчёта')}
                        </h2>
                        {data.recent_errors.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {t('admin.ratingsDebug.noErrors', 'Нет записей.')}
                            </p>
                        ) : (
                            <Table
                                title=""
                                count={data.recent_errors.length}
                                rows={data.recent_errors.map((e) => ({
                                    ...e,
                                    created_at: formatDateTime(e.created_at, 'ru', true),
                                }))}
                                columns={[
                                    { key: 'entity_type', label: 'Тип' },
                                    { key: 'entity_id', label: 'entity_id' },
                                    { key: 'metric_date', label: 'Дата' },
                                    { key: 'error_message', label: 'Ошибка' },
                                    { key: 'created_at', label: 'Создано' },
                                ]}
                            />
                        )}
                    </section>
                </>
            )}
        </main>
    );
}

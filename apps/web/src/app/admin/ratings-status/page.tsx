import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getT } from '@/app/_components/i18n/server';
import { formatDateTime } from '@/lib/dateFormat';

export const dynamic = 'force-dynamic';

type RatingsStatusResponse = {
    ok: boolean;
    error?: string;
    staff_last_metric_date: string | null;
    branch_last_metric_date: string | null;
    biz_last_metric_date: string | null;
    staff_last_rating_recalculated_at?: string | null;
    branch_last_rating_recalculated_at?: string | null;
    biz_last_rating_recalculated_at?: string | null;
    staff_without_rating: number;
    branches_without_rating: number;
    businesses_without_rating: number;
    recent_errors_total?: number;
    recent_errors_by_type?: Record<string, number>;
    recent_errors_days?: number;
    has_recent_errors?: boolean;
};

type RatingJob = {
    id: string;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    created_by: string | null;
    date_from: string;
    date_to: string;
    scope: string;
    status: 'queued' | 'running' | 'success' | 'error' | string;
    processed_days: number;
    total_days: number;
    error_summary: Record<string, unknown> | null;
    error_message: string | null;
};

function isStale(dateStr: string | null, maxDaysWithoutMetrics = 2): boolean {
    if (!dateStr) return true;
    const last = new Date(dateStr);
    if (Number.isNaN(last.getTime())) return true;
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > maxDaysWithoutMetrics;
}

export default async function RatingsStatusPage() {
    // Вызов уже существующего API, который сам проверяет супер‑админа
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const [statusRes, jobsRes] = await Promise.all([
        fetch(`${baseUrl}/api/admin/ratings/status`, {
            // Пробрасываем cookie автоматически на сервере Next
            cache: 'no-store',
        }),
        fetch(`${baseUrl}/api/admin/ratings/jobs`, {
            cache: 'no-store',
        }),
    ]);

    if (statusRes.status === 401 || statusRes.status === 403 || jobsRes.status === 401 || jobsRes.status === 403) {
        // На всякий случай уводим на логин / ошибку доступа
        redirect('/auth/sign-in?redirect=/admin/ratings-status');
    }

    const t = await getT('ru');

    if (!statusRes.ok) {
        return (
            <main className="max-w-3xl mx-auto">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                    <h1 className="text-lg font-semibold mb-2">
                        {t('admin.ratingsStatus.error.title', 'Ошибка статуса рейтингов')}
                    </h1>
                    <p>
                        {t(
                            'admin.ratingsStatus.error.description',
                            'Не удалось получить состояние рейтинговой системы.',
                        )}
                    </p>
                </div>
            </main>
        );
    }

    let data: RatingsStatusResponse;
    try {
        data = (await statusRes.json()) as RatingsStatusResponse;
    } catch {
        return (
            <main className="max-w-3xl mx-auto">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                    <h1 className="text-lg font-semibold mb-2">
                        {t('admin.ratingsStatus.error.title', 'Ошибка статуса рейтингов')}
                    </h1>
                    <p>
                        {t(
                            'admin.ratingsStatus.error.description',
                            'Не удалось получить состояние рейтинговой системы.',
                        )}
                    </p>
                </div>
            </main>
        );
    }

    const jobsJson = (await jobsRes.json().catch(() => ({ ok: false }))) as
        | { ok: true; jobs: RatingJob[] }
        | { ok: false; error?: string };

    if (!data.ok) {
        return (
            <main className="max-w-3xl mx-auto">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                    <h1 className="text-lg font-semibold mb-2">{t('admin.ratingsStatus.error.title', 'Ошибка статуса рейтингов')}</h1>
                    <p>{data.error || t('admin.ratingsStatus.error.description', 'Не удалось получить состояние рейтинговой системы.')}</p>
                </div>
            </main>
        );
    }

    const staffStale = isStale(data.staff_last_metric_date);
    const branchStale = isStale(data.branch_last_metric_date);
    const bizStale = isStale(data.biz_last_metric_date);

    const recentErrorsTotal = data.recent_errors_total ?? 0;
    const recentErrorsDays = data.recent_errors_days ?? 7;
    const hasRecentErrors = data.has_recent_errors ?? recentErrorsTotal > 0;

    // Используем унифицированную функцию форматирования дат
    const formatDate = (value: string | null | undefined) =>
        value ? formatDateTime(value, 'ru', true) : t('common.noData', 'нет данных');

    return (
        <main className="max-w-4xl mx-auto space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {t('admin.ratingsStatus.title', 'Здоровье рейтинговой системы')}
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {t('admin.ratingsStatus.description', 'Сводка по последним метрикам и сущностям без рассчитанного рейтинга.')}
                </p>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
                <div
                    className={`rounded-xl border p-4 shadow-sm ${
                        staffStale
                            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                {t('admin.ratingsStatus.metrics.staff.title', 'Метрики сотрудников')}
                            </p>
                            <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">
                                {t('admin.ratingsStatus.metrics.lastDate', 'Последняя дата метрик')}: {formatDate(data.staff_last_metric_date)}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                                {t('admin.ratingsStatus.metrics.lastRatingDate', 'Последний пересчёт рейтинга')}: {formatDate(data.staff_last_rating_recalculated_at)}
                            </p>
                        </div>
                        <span
                            className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                                staffStale
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            }`}
                        >
                            {staffStale ? t('common.problem', 'Проблема') : t('common.ok', 'ОК')}
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        {t('admin.ratingsStatus.metrics.withoutRating', 'Без рейтинга')}:{' '}
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {data.staff_without_rating}
                        </span>
                    </p>
                </div>

                <div
                    className={`rounded-xl border p-4 shadow-sm ${
                        branchStale
                            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                {t('admin.ratingsStatus.metrics.branches.title', 'Метрики филиалов')}
                            </p>
                            <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">
                                {t('admin.ratingsStatus.metrics.lastDate', 'Последняя дата метрик')}: {formatDate(data.branch_last_metric_date)}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                                {t('admin.ratingsStatus.metrics.lastRatingDate', 'Последний пересчёт рейтинга')}: {formatDate(data.branch_last_rating_recalculated_at)}
                            </p>
                        </div>
                        <span
                            className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                                branchStale
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            }`}
                        >
                            {branchStale ? t('common.problem', 'Проблема') : t('common.ok', 'ОК')}
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        {t('admin.ratingsStatus.metrics.withoutRating', 'Без рейтинга')}:{' '}
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {data.branches_without_rating}
                        </span>
                    </p>
                </div>

                <div
                    className={`rounded-xl border p-4 shadow-sm ${
                        bizStale
                            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                {t('admin.ratingsStatus.metrics.businesses.title', 'Метрики бизнесов')}
                            </p>
                            <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">
                                {t('admin.ratingsStatus.metrics.lastDate', 'Последняя дата метрик')}: {formatDate(data.biz_last_metric_date)}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                                {t('admin.ratingsStatus.metrics.lastRatingDate', 'Последний пересчёт рейтинга')}: {formatDate(data.biz_last_rating_recalculated_at)}
                            </p>
                        </div>
                        <span
                            className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                                bizStale
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                            }`}
                        >
                            {bizStale ? t('common.problem', 'Проблема') : t('common.ok', 'ОК')}
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        {t('admin.ratingsStatus.metrics.withoutRating', 'Без рейтинга')}:{' '}
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {data.businesses_without_rating}
                        </span>
                    </p>
                </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 space-y-2">
                <p>
                    {t('admin.ratingsStatus.info', 'Если какая‑то из карточек подсвечена красным и даты давно не обновлялись, проверьте cron‑задачу пересчёта рейтингов и логи API')} <code>/api/cron/recalculate-ratings</code>.
                </p>
                <p className="flex items-center gap-2">
                    <span
                        className={`inline-flex h-5 min-w-[2rem] items-center justify-center rounded-full px-2 text-[11px] font-semibold ${
                            hasRecentErrors
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                        }`}
                    >
                        {hasRecentErrors ? t('common.problem', 'Проблема') : t('common.ok', 'ОК')}
                    </span>
                    <span>
                        {t(
                            'admin.ratingsStatus.recentErrorsSummary',
                            'Ошибки пересчёта за последние N дней:',
                        )}{' '}
                        <span className={recentErrorsTotal > 0 ? 'font-semibold text-red-700 dark:text-red-300' : 'font-semibold text-emerald-700 dark:text-emerald-300'}>
                            {recentErrorsTotal}{' '}
                            {t('admin.ratingsStatus.recentErrorsDaysSuffix', 'шт.')}
                        </span>{' '}
                        <span className="text-gray-500 dark:text-gray-400">
                            ({recentErrorsDays}{' '}
                            {t('admin.ratingsStatus.days', 'дн.')})
                        </span>
                    </span>
                </p>
                <p className="mt-1">
                    <Link
                        href="/admin/ratings-debug"
                        className="font-medium text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        {t('admin.ratingsStatus.debugLink', 'Отладка рейтингов (debug)')}
                    </Link>
                </p>
            </section>

            {jobsJson.ok && jobsJson.jobs.length > 0 && (
                <section className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {t('admin.ratingsJobs.title', 'Задачи пересчёта рейтингов')}
                        </h2>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {t('admin.ratingsJobs.caption', 'Активные и завершённые задачи за последнее время')}
                        </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950/40">
                        <table className="min-w-full text-xs">
                            <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                <tr>
                                    <th className="px-3 py-2 text-left">ID</th>
                                    <th className="px-3 py-2 text-left">{t('admin.ratingsJobs.dates', 'Диапазон дат')}</th>
                                    <th className="px-3 py-2 text-left">{t('admin.ratingsJobs.scope', 'Область')}</th>
                                    <th className="px-3 py-2 text-left">{t('admin.ratingsJobs.status', 'Статус')}</th>
                                    <th className="px-3 py-2 text-left">{t('admin.ratingsJobs.progress', 'Прогресс')}</th>
                                    <th className="px-3 py-2 text-left">{t('admin.ratingsJobs.createdAt', 'Создана')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobsJson.jobs.map((job) => {
                                    const progress =
                                        job.total_days > 0
                                            ? `${job.processed_days}/${job.total_days}`
                                            : '-';
                                    const statusColor =
                                        job.status === 'success'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                            : job.status === 'running'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                                            : job.status === 'queued'
                                            ? 'bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-100'
                                            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
                                    return (
                                        <tr key={job.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                                            <td className="px-3 py-2 align-top font-mono text-[11px] text-gray-600 dark:text-gray-400">
                                                {job.id.slice(0, 8)}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                {job.date_from} → {job.date_to}
                                            </td>
                                            <td className="px-3 py-2 align-top">{job.scope}</td>
                                            <td className="px-3 py-2 align-top">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}>
                                                    {job.status}
                                                </span>
                                                {job.error_message && (
                                                    <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                                                        {job.error_message}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 align-top">{progress}</td>
                                            <td className="px-3 py-2 align-top">
                                                {formatDate(job.created_at)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </main>
    );
}



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
    staff_without_rating: number;
    branches_without_rating: number;
    businesses_without_rating: number;
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
    const res = await fetch(`${baseUrl}/api/admin/ratings/status`, {
        // Пробрасываем cookie автоматически на сервере Next
        cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
        // На всякий случай уводим на логин / ошибку доступа
        redirect('/auth/sign-in?redirect=/admin/ratings-status');
    }

    const data = (await res.json()) as RatingsStatusResponse;

    const t = getT('ru');
    
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

    // Используем унифицированную функцию форматирования дат
    const formatDate = (value: string | null) =>
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
                                {t('admin.ratingsStatus.metrics.lastDate', 'Последняя дата')}: {formatDate(data.staff_last_metric_date)}
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
                                {t('admin.ratingsStatus.metrics.lastDate', 'Последняя дата')}: {formatDate(data.branch_last_metric_date)}
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
                                {t('admin.ratingsStatus.metrics.lastDate', 'Последняя дата')}: {formatDate(data.biz_last_metric_date)}
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

            <section className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <p>
                    {t('admin.ratingsStatus.info', 'Если какая‑то из карточек подсвечена красным и даты давно не обновлялись, проверьте cron‑задачу пересчёта рейтингов и логи API')} <code>/api/cron/recalculate-ratings</code>.
                </p>
                <p className="mt-2">
                    <Link
                        href="/admin/ratings-debug"
                        className="font-medium text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        {t('admin.ratingsStatus.debugLink', 'Отладка рейтингов (debug)')}
                    </Link>
                </p>
            </section>
        </main>
    );
}



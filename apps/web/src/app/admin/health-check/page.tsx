import { redirect } from 'next/navigation';

import { getT } from '@/app/_components/i18n/server';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { readAdminHealthCheckForCaller } from '@/lib/adminHealthCheckReadService';
import { formatDateTime } from '@/lib/dateFormat';

export const dynamic = 'force-dynamic';

export default async function HealthCheckPage() {
    const t = await getT();
    
    // Используем унифицированную функцию форматирования дат
    function formatDate(value: string | null) {
        if (!value) return t('common.noData', 'нет данных');
        return formatDateTime(value, 'ru', true);
    }
    const result = await readAdminHealthCheckForCaller();

    if (!result.ok && (result.statusCode === 401 || result.statusCode === 403)) {
        redirect('/auth/sign-in?redirect=/admin/health-check');
    }

    if (!result.ok) {
        return (
            <main className="max-w-4xl mx-auto p-6">
                <AlertBanner
                    variant="danger"
                    title={t('admin.healthCheck.error.title', 'Ошибка health check')}
                    message={result.message}
                />
            </main>
        );
    }

    const data = result.data;

    return (
        <main className="max-w-4xl mx-auto space-y-6 p-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('admin.healthCheck.title', 'Health Check системы')}</h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {t('admin.healthCheck.description', 'Комплексная проверка здоровья системы: смены, рейтинги, промо.')}
                        </p>
                    </div>
                    <div
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                            data.ok
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                        }`}
                    >
                        {data.ok ? `✅ ${t('admin.healthCheck.status.healthy', 'Система здорова')}` : `⚠️ ${t('admin.healthCheck.status.problems', 'Обнаружены проблемы')}`}
                    </div>
                </div>
            </section>

            {data.alerts.length > 0 && (
                <section className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)]">
                    <h2 className="type-section-title text-[var(--text-primary)]">
                        {t('admin.healthCheck.alerts.title', 'Алерты')}
                    </h2>
                    <div className="space-y-3">
                        {data.alerts.map((alert, idx) => (
                            <div key={idx} className="space-y-2">
                                <AlertBanner
                                    variant={alert.type === 'error' ? 'danger' : 'warning'}
                                    title={alert.type === 'error' ? t('common.error', 'Ошибка') : t('common.warning', 'Предупреждение')}
                                    message={alert.message}
                                />
                                {alert.details && (
                                    <pre className="overflow-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-3 text-xs text-[var(--text-secondary)]">
                                        {JSON.stringify(alert.details, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="grid gap-4 md:grid-cols-3">
                <div
                    className={`rounded-xl border p-4 shadow-sm ${
                        data.checks.shifts.ok
                            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                {t('admin.healthCheck.checks.shifts.title', 'Смены')}
                            </p>
                            <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">
                                {t('admin.healthCheck.checks.shifts.openOlderThan2Days', 'Незакрытых старше 2 дней')}: {data.checks.shifts.openShiftsOlderThan2Days}
                            </p>
                        </div>
                        <span
                            className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                                data.checks.shifts.ok
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                            }`}
                        >
                            {data.checks.shifts.ok ? t('common.ok', 'ОК') : t('common.problem', 'Проблема')}
                        </span>
                    </div>
                </div>

                <div
                    className={`rounded-xl border p-4 shadow-sm ${
                        data.checks.ratings.ok
                            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                {t('admin.healthCheck.checks.ratings.title', 'Рейтинги')}
                            </p>
                            <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">
                                {t('admin.healthCheck.checks.ratings.lastMetric', 'Последняя метрика')}:{' '}
                                {data.checks.ratings.daysSinceLastMetric !== null
                                    ? `${data.checks.ratings.daysSinceLastMetric} ${t('common.daysAgo', 'дн. назад')}`
                                    : t('common.noData', 'нет данных')}
                            </p>
                        </div>
                        <span
                            className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                                data.checks.ratings.ok
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                            }`}
                        >
                            {data.checks.ratings.ok ? t('common.ok', 'ОК') : t('common.problem', 'Проблема')}
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        Staff: {formatDate(data.checks.ratings.staffLastMetricDate)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                        Branch: {formatDate(data.checks.ratings.branchLastMetricDate)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                        Biz: {formatDate(data.checks.ratings.bizLastMetricDate)}
                    </p>
                </div>

                <div
                    className={`rounded-xl border p-4 shadow-sm ${
                        data.checks.promotions.ok
                            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                            : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                                {t('admin.healthCheck.checks.promotions.title', 'Промо')}
                            </p>
                            <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">
                                {t('admin.healthCheck.checks.promotions.active', 'Активных')}: {data.checks.promotions.activePromotionsCount}
                            </p>
                            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                {t('admin.healthCheck.checks.promotions.lastApplication', 'Последнее применение')}:{' '}
                                {data.checks.promotions.daysSinceLastApplication !== null
                                    ? `${data.checks.promotions.daysSinceLastApplication} ${t('common.daysAgo', 'дн. назад')}`
                                    : t('common.never', 'никогда')}
                            </p>
                        </div>
                        <span
                            className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                                data.checks.promotions.ok
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                            }`}
                        >
                            {data.checks.promotions.ok ? t('common.ok', 'ОК') : t('common.warning', 'Предупреждение')}
                        </span>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-lg font-semibold">{t('admin.healthCheck.cron.title', 'Фоновые задания')}</h2>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead><tr>
                            <th scope="col" className="p-2">{t('admin.healthCheck.cron.job', 'Задание')}</th>
                            <th scope="col" className="p-2">{t('admin.healthCheck.cron.status', 'Состояние')}</th>
                            <th scope="col" className="p-2">{t('admin.healthCheck.cron.success', 'Последний успех')}</th>
                        </tr></thead>
                        <tbody>{data.checks.cronExecutions.jobs.map(job => (
                            <tr key={job.job} className="border-t border-gray-200 dark:border-gray-800">
                                <th scope="row" className="p-2 font-medium">{job.job}</th>
                                <td className="p-2">{t(`admin.healthCheck.cron.${job.status}`, job.status)}</td>
                                <td className="p-2">{formatDate(job.lastSuccessAt)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <h2 className="mb-3 text-lg font-semibold">{t('admin.healthCheck.queue.title', 'Очереди')}</h2>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                    <thead><tr>
                        <th scope="col" className="p-2">{t('admin.healthCheck.cron.job', 'Задание')}</th>
                        <th scope="col" className="p-2">{t('admin.healthCheck.cron.status', 'Состояние')}</th>
                        <th scope="col" className="p-2">{t('admin.healthCheck.queue.due', 'Готовы к обработке')}</th>
                        <th scope="col" className="p-2">{t('admin.healthCheck.queue.failed', 'Требуют разбора')}</th>
                        <th scope="col" className="p-2">{t('admin.healthCheck.queue.ambiguous', 'Доставка не подтверждена')}</th>
                        <th scope="col" className="p-2">{t('admin.healthCheck.queue.age', 'Ожидание, сек.')}</th>
                    </tr></thead>
                    <tbody>{data.checks.backgroundQueues.queues.map(queue => (
                        <tr key={queue.job} className="border-t border-gray-200 dark:border-gray-800">
                            <th scope="row" className="p-2 font-medium">{queue.job}</th>
                            <td className="p-2">{t(`admin.healthCheck.queue.${queue.status}`, queue.status)}</td>
                            <td className="p-2">{queue.counts?.due ?? '—'}</td>
                            <td className="p-2">{queue.counts?.failed ?? '—'}</td>
                            <td className="p-2">{queue.counts?.ambiguous ?? '—'}</td>
                            <td className="p-2">{queue.counts ? Math.ceil(queue.counts.oldest_due_age_seconds) : '—'}</td>
                        </tr>
                    ))}</tbody>
                </table></div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <p>
                    {t('admin.healthCheck.info', 'Плановое время проверки — 09:00 UTC (15:00 Бишкек). Фактическое выполнение показано в журнале заданий. Отправка предупреждений требует настройки получателя.')}
                </p>
            </section>
        </main>
    );
}




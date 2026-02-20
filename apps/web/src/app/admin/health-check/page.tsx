import { redirect } from 'next/navigation';

import { getT } from '@/app/_components/i18n/server';
import { formatDateTime } from '@/lib/dateFormat';

export const dynamic = 'force-dynamic';

type HealthCheckResponse = {
    ok: boolean;
    error?: string;
    alerts: Array<{
        type: 'error' | 'warning';
        message: string;
        details?: Record<string, unknown>;
    }>;
    checks: {
        shifts: {
            ok: boolean;
            openShiftsOlderThan2Days: number;
            lastCheckDate: string;
        };
        ratings: {
            ok: boolean;
            staffLastMetricDate: string | null;
            branchLastMetricDate: string | null;
            bizLastMetricDate: string | null;
            daysSinceLastMetric: number | null;
        };
        promotions: {
            ok: boolean;
            lastAppliedDate: string | null;
            daysSinceLastApplication: number | null;
            activePromotionsCount: number;
        };
    };
};

export default async function HealthCheckPage() {
    const t = getT('ru');
    
    // Используем унифицированную функцию форматирования дат
    function formatDate(value: string | null) {
        if (!value) return t('common.noData', 'нет данных');
        return formatDateTime(value, 'ru', true);
    }
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/admin/health-check`, {
        cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
        redirect('/auth/sign-in?redirect=/admin/health-check');
    }

    const data = (await res.json()) as HealthCheckResponse;

    if (!data.ok && data.error) {
        return (
            <main className="max-w-4xl mx-auto p-6">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                    <h1 className="text-lg font-semibold mb-2">{t('admin.healthCheck.error.title', 'Ошибка health check')}</h1>
                    <p>{data.error}</p>
                </div>
            </main>
        );
    }

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
                <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm dark:border-red-800 dark:bg-red-950/30">
                    <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-4">{t('admin.healthCheck.alerts.title', 'Алерты')}</h2>
                    <div className="space-y-3">
                        {data.alerts.map((alert, idx) => (
                            <div
                                key={idx}
                                className={`rounded-lg border p-4 ${
                                    alert.type === 'error'
                                        ? 'border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-900/40'
                                        : 'border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40'
                                }`}
                            >
                                <div className="flex items-start gap-2">
                                    <span className="text-lg">{alert.type === 'error' ? '❌' : '⚠️'}</span>
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{alert.message}</p>
                                        {alert.details && (
                                            <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                                                {JSON.stringify(alert.details, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                </div>
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

            <section className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <p>
                    {t('admin.healthCheck.info', 'Health check выполняется автоматически ежедневно в 09:00 UTC (14:00 Bishkek). При обнаружении проблем отправляется email-алерт на адрес, указанный в')} <code>ALERT_EMAIL_TO</code>.
                </p>
            </section>
        </main>
    );
}


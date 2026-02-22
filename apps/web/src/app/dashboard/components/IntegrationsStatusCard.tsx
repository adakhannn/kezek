'use client';

import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

const RETRY_COOLDOWN_MS = 5000;

type IntegrationStatus = {
    configured: boolean;
    ok: boolean;
    message?: string;
};

type ApiResponse = {
    ok: boolean;
    data?: { whatsapp: IntegrationStatus; telegram: IntegrationStatus };
    error?: string;
};

export function IntegrationsStatusCard() {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ApiResponse['data'] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryCooldown, setRetryCooldown] = useState(0);

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/dashboard/integrations-status', { cache: 'no-store' });
            const json = (await res.json()) as ApiResponse;
            if (!res.ok || !json.ok) {
                setError(json.error ?? t('dashboard.integrations.errorLoad', 'Не удалось загрузить статус'));
                setData(null);
                return;
            }
            setData(json.data ?? null);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || t('dashboard.integrations.errorLoad', 'Не удалось загрузить статус'));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleRetry = useCallback(() => {
        if (retryCooldown > 0) return;
        setRetryCooldown(RETRY_COOLDOWN_MS / 1000);
        fetchStatus();
    }, [fetchStatus, retryCooldown]);

    useEffect(() => {
        if (retryCooldown <= 0) return;
        const id = setInterval(() => {
            setRetryCooldown((prev) => {
                const next = prev - 1;
                if (next <= 0) clearInterval(id);
                return next;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [retryCooldown]);

    if (loading && !data) {
        return (
            <section className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                    {t('dashboard.integrations.title', 'Статус интеграций')}
                </h2>
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('dashboard.integrations.loading', 'Загрузка...')}
                </div>
            </section>
        );
    }

    return (
        <section className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                        {t('dashboard.integrations.title', 'Статус интеграций')}
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {t('dashboard.integrations.subtitle', 'Уведомления клиентам и сотрудникам')}
                    </p>
                </div>
                {error && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                        <button
                            type="button"
                            onClick={handleRetry}
                            disabled={retryCooldown > 0}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            {retryCooldown > 0
                                ? t('dashboard.integrations.retryIn', 'Повторить через {sec} с').replace('{sec}', String(retryCooldown))
                                : t('dashboard.integrations.retry', 'Повторить')}
                        </button>
                    </div>
                )}
            </div>

            {data && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div
                        className={`rounded-xl border p-3 ${
                            data.whatsapp.ok
                                ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30'
                                : data.whatsapp.configured
                                ? 'border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30'
                                : 'border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/50'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                WhatsApp
                            </span>
                            <span
                                className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                                    data.whatsapp.ok
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                                        : data.whatsapp.configured
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}
                            >
                                {data.whatsapp.ok
                                    ? t('dashboard.integrations.ok', 'ОК')
                                    : data.whatsapp.configured
                                    ? t('dashboard.integrations.error', 'Ошибка')
                                    : t('dashboard.integrations.notConfigured', 'Не настроен')}
                            </span>
                        </div>
                        {data.whatsapp.message && (
                            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                                {data.whatsapp.message}
                            </p>
                        )}
                    </div>

                    <div
                        className={`rounded-xl border p-3 ${
                            data.telegram.ok
                                ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30'
                                : data.telegram.configured
                                ? 'border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30'
                                : 'border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/50'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                Telegram
                            </span>
                            <span
                                className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                                    data.telegram.ok
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                                        : data.telegram.configured
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}
                            >
                                {data.telegram.ok
                                    ? t('dashboard.integrations.ok', 'ОК')
                                    : data.telegram.configured
                                    ? t('dashboard.integrations.error', 'Ошибка')
                                    : t('dashboard.integrations.notConfigured', 'Не настроен')}
                            </span>
                        </div>
                        {data.telegram.message && (
                            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                                {data.telegram.message}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

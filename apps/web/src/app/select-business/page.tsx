'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FullScreenStatus } from '@/app/_components/FullScreenStatus';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type Business = {
    id: string;
    name: string | null;
    city: string | null;
    slug: string | null;
};

type LoadState =
    | { status: 'loading' }
    | { status: 'ready'; currentBizId: string | null; businesses: Business[] }
    | { status: 'error'; message: string };

export const dynamic = 'force-dynamic';

export default function SelectBusinessPage() {
    const { t } = useLanguage();
    const router = useRouter();
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const res = await fetch('/api/me/current-business', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const json = (await res.json()) as {
                    ok: boolean;
                    data?: { currentBizId: string | null; businesses: Business[] };
                    error?: { message?: string };
                };
                if (!json.ok || !json.data) {
                    throw new Error(json.error?.message || 'Failed to load businesses');
                }
                if (cancelled) return;

                const { currentBizId, businesses } = json.data;

                // Если бизнесов нет — ничего выбирать не нужно, отправляем в общий редирект
                if (!businesses || businesses.length === 0) {
                    router.replace('/dashboard');
                    return;
                }

                // Если бизнес один — устанавливаем его и ведём в дашборд
                if (businesses.length === 1) {
                    const single = businesses[0];
                    if (single?.id) {
                        setSavingId(single.id);
                        try {
                            await fetch('/api/me/current-business', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bizId: single.id }),
                            });
                        } catch {
                            // игнорируем, редирект всё равно состоится, контекст подберётся по фоллбекам
                        } finally {
                            setSavingId(null);
                        }
                    }
                    router.replace('/dashboard');
                    return;
                }

                setState({
                    status: 'ready',
                    currentBizId,
                    businesses,
                });
            } catch (e) {
                if (cancelled) return;
                setState({
                    status: 'error',
                    message:
                        e instanceof Error
                            ? e.message
                            : t('selectBusiness.error.generic', 'Не удалось загрузить список бизнесов'),
                });
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [router, t]);

    const handleSelect = async (bizId: string) => {
        if (savingId) return;
        setSavingId(bizId);
        try {
            const res = await fetch('/api/me/current-business', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bizId }),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const json = (await res.json()) as { ok: boolean; error?: { message?: string } };
            if (!json.ok) {
                throw new Error(json.error?.message || 'Failed to set business');
            }
            router.replace('/dashboard');
        } catch (e) {
            setState({
                status: 'error',
                message:
                    e instanceof Error
                        ? e.message
                        : t('selectBusiness.error.change', 'Не удалось выбрать бизнес, попробуйте ещё раз'),
            });
            setSavingId(null);
        }
    };

    if (state.status === 'loading' || savingId) {
        return (
            <FullScreenStatus
                title={t('selectBusiness.loadingTitle', 'Загружаем список бизнесов')}
                subtitle={t('selectBusiness.loadingSubtitle', 'Подготавливаем варианты для выбора')}
                loading
            />
        );
    }

    if (state.status === 'error') {
        return (
            <FullScreenStatus
                title={t('selectBusiness.errorTitle', 'Ошибка загрузки бизнесов')}
                subtitle={t('selectBusiness.errorSubtitle', 'Попробуйте обновить страницу или войти заново')}
                message={state.message}
                loading={false}
            />
        );
    }

    const { businesses, currentBizId } = state;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/40 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/60 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-lg">
                <div className="mb-6 text-center">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-50">
                        {t('selectBusiness.title', 'Выберите бизнес для работы')}
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {t(
                            'selectBusiness.subtitle',
                            'У вашего аккаунта несколько бизнесов. Выберите, с каким вы хотите работать сейчас.',
                        )}
                    </p>
                </div>

                <div className="space-y-2">
                    {businesses.map((biz) => {
                        const isActive = biz.id === currentBizId;
                        const title = biz.name || biz.slug || t('selectBusiness.unknown', 'Бизнес без названия');
                        const subtitle = biz.city || undefined;
                        return (
                            <button
                                key={biz.id}
                                type="button"
                                onClick={() => void handleSelect(biz.id)}
                                className={`w-full rounded-xl border px-4 py-3 text-left transition shadow-sm ${
                                    isActive
                                        ? 'border-indigo-500 bg-indigo-50/80 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-50'
                                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{title}</p>
                                        {subtitle && (
                                            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                                {subtitle}
                                            </p>
                                        )}
                                    </div>
                                    {isActive && (
                                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <p className="mt-4 text-[11px] text-center text-gray-500 dark:text-gray-500">
                    {t(
                        'selectBusiness.hint',
                        'Вы всегда сможете сменить бизнес в левом меню кабинета — переключатель под заголовком.',
                    )}
                </p>
            </div>
        </main>
    );
}


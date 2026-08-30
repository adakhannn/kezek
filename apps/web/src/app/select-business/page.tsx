'use client';

import { BriefcaseBusiness, Check, ChevronRight, Info, LoaderCircle, MapPin } from 'lucide-react';
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
                    cache: 'no-store',
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
        // Сразу показываем выбранный бизнес активным
        setState((prev) =>
            prev.status === 'ready' ? { ...prev, currentBizId: bizId } : prev,
        );
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

    if (state.status === 'loading') {
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
        <main className="flex min-h-[calc(100svh-11rem)] items-start justify-center px-4 py-8 sm:items-center sm:px-6 sm:py-12">
            <div className="w-full max-w-3xl">
                <header className="mb-6 text-center sm:mb-8">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-[var(--shadow-lg)]">
                        <BriefcaseBusiness className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                        {t('selectBusiness.eyebrow', 'Рабочее пространство')}
                    </p>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                        {t('selectBusiness.title', 'Выберите бизнес для работы')}
                    </h1>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                        {t(
                            'selectBusiness.subtitle',
                            'У вашего аккаунта несколько бизнесов. Выберите, с каким вы хотите работать сейчас.',
                        )}
                    </p>
                </header>

                <section
                    aria-labelledby="business-list-title"
                    className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-lg)]"
                >
                    <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
                        <div>
                            <h2 id="business-list-title" className="text-base font-semibold text-[var(--text-primary)]">
                                {t('selectBusiness.listTitle', 'Доступные бизнесы')}
                            </h2>
                            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                {t('selectBusiness.count', 'Всего')}: {businesses.length}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3 p-4 sm:p-5">
                        {businesses.map((biz) => {
                            const isActive = biz.id === currentBizId;
                            const isSaving = savingId === biz.id;
                            const title = biz.name || biz.slug || t('selectBusiness.unknown', 'Бизнес без названия');
                            const subtitle = biz.city || (biz.slug ? `/b/${biz.slug}` : null);

                            return (
                                <button
                                    key={biz.id}
                                    type="button"
                                    disabled={!!savingId}
                                    onClick={() => void handleSelect(biz.id)}
                                    aria-current={isActive ? 'true' : undefined}
                                    aria-busy={isSaving}
                                    className={`group w-full rounded-xl border p-4 text-left transition-all sm:p-5 ${
                                        isActive
                                            ? 'border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_9%,var(--surface-card))] shadow-[var(--shadow-sm)]'
                                            : 'border-[var(--border-default)] bg-[var(--surface-card)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-emphasis)] hover:shadow-[var(--shadow-md)]'
                                    } ${savingId && !isSaving ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                                                isActive
                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                    : 'bg-[var(--surface-emphasis)] text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)]'
                                            }`}
                                        >
                                            {isActive ? (
                                                <Check className="h-5 w-5" aria-hidden="true" />
                                            ) : (
                                                <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate font-semibold text-[var(--text-primary)]">{title}</p>
                                                {isActive ? (
                                                    <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                                                        {t('selectBusiness.current', 'Текущий')}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {subtitle ? (
                                                <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--text-muted)]">
                                                    {biz.city ? <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                                                    <span className="truncate">{subtitle}</span>
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-[var(--accent-primary)]">
                                            <span className="hidden sm:inline">
                                                {isSaving
                                                    ? t('selectBusiness.saving', 'Переключаем…')
                                                    : isActive
                                                      ? t('selectBusiness.continue', 'Продолжить')
                                                      : t('selectBusiness.choose', 'Выбрать')}
                                            </span>
                                            {isSaving ? (
                                                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                                            ) : (
                                                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                <div className="mx-auto mt-5 flex max-w-xl items-start justify-center gap-2 text-center text-xs leading-5 text-[var(--text-muted)]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>
                        {t(
                            'selectBusiness.hint',
                            'Вы всегда сможете сменить бизнес через переключатель в шапке кабинета.',
                        )}
                    </p>
                </div>
            </div>
        </main>
    );
}


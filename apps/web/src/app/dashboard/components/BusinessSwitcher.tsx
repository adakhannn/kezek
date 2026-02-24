'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type Business = {
    id: string;
    name: string | null;
    city: string | null;
    slug: string | null;
};

type State =
    | { status: 'idle' | 'loading'; currentBizId?: string | null; businesses: Business[] }
    | { status: 'error'; message: string };

export function BusinessSwitcher() {
    const { t } = useLanguage();
    const router = useRouter();
    const [state, setState] = useState<State>({ status: 'loading', businesses: [] });
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setState((prev) => {
                if (prev.status === 'loading') {
                    return prev;
                }
                if (prev.status === 'idle') {
                    return { status: 'loading', currentBizId: prev.currentBizId, businesses: prev.businesses };
                }
                // Для состояния ошибки начинаем загрузку с пустого списка
                return { status: 'loading', businesses: [] };
            });
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
                    throw new Error(json.error?.message || 'Failed to load current business');
                }
                if (cancelled) return;
                setState({
                    status: 'idle',
                    currentBizId: json.data.currentBizId,
                    businesses: json.data.businesses || [],
                });
            } catch (e) {
                if (cancelled) return;
                setState({
                    status: 'error',
                    message:
                        e instanceof Error
                            ? e.message
                            : t('dashboard.businessSwitcher.error', 'Не удалось загрузить список бизнесов'),
                });
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [t]);

    const handleSelect = async (bizId: string) => {
        if (state.status === 'loading' || isSaving) return;
        if (state.status === 'idle' && state.currentBizId === bizId) {
            setIsOpen(false);
            return;
        }
        setIsSaving(true);
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
                throw new Error(json.error?.message || 'Failed to change business');
            }
            setIsOpen(false);
            router.refresh();
        } catch (e) {
            setState({
                status: 'error',
                message:
                    e instanceof Error
                        ? e.message
                        : t('dashboard.businessSwitcher.changeError', 'Не удалось сменить бизнес'),
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (state.status === 'error') {
        return (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                {t('dashboard.businessSwitcher.errorShort', 'Ошибка загрузки бизнесов')}
            </div>
        );
    }

    if (state.status === 'loading') {
        return (
            <div className="mt-2 h-8 w-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" aria-hidden="true" />
        );
    }

    // На этом этапе остаётся только состояние 'idle'
    if (state.status !== 'idle') {
        return null;
    }

    const { currentBizId, businesses } = state;
    if (!businesses || businesses.length <= 1) {
        // Нечего переключать
        return null;
    }

    const current =
        businesses.find((b) => b.id === currentBizId) ??
        businesses[0] ??
        null;

    const label = current?.name || current?.slug || t('dashboard.businessSwitcher.unknown', 'Бизнес');

    return (
        <div className="mt-3">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
            >
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[140px]">{label}</span>
                <svg
                    className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                >
                    <path d="M6 8l4 4 4-4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {isOpen && (
                <div className="mt-2 max-h-56 w-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    {businesses.map((b) => {
                        const isActive = b.id === current?.id;
                        const title = b.name || b.slug || t('dashboard.businessSwitcher.unknown', 'Бизнес');
                        const subtitle = b.city || undefined;
                        return (
                            <button
                                key={b.id}
                                type="button"
                                disabled={isSaving}
                                onClick={() => void handleSelect(b.id)}
                                className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition ${
                                    isActive
                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-100'
                                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <div className="flex flex-col">
                                    <span className="truncate">{title}</span>
                                    {subtitle && (
                                        <span className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                                            {subtitle}
                                        </span>
                                    )}
                                </div>
                                {isActive && (
                                    <span className="ml-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}


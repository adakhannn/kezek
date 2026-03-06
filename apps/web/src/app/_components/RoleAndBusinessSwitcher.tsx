'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useLanguage } from './i18n/LanguageProvider';

import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type Business = {
    id: string;
    name: string | null;
    city: string | null;
    slug: string | null;
};

type RoleSummary = {
    hasDashboard: boolean;
    hasStaff: boolean;
    hasCabinet: boolean;
    hasAdmin: boolean;
};

type SwitcherState =
    | { status: 'loading' }
    | {
          status: 'ready';
          roles: RoleSummary;
          businesses: Business[];
          currentBizId: string | null;
      }
    | { status: 'error' };

export function RoleAndBusinessSwitcher() {
    const { t } = useLanguage();
    const router = useRouter();
    const [state, setState] = useState<SwitcherState>({ status: 'loading' });
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const { data: sessionRes } = await supabase.auth.getSession();
                const user = sessionRes.session?.user;
                if (!user) {
                    if (!cancelled) setState({ status: 'error' });
                    return;
                }

                const [{ data: isSuperData }, { data: roleKeys }, currentBizRes] = await Promise.all([
                    supabase.rpc('is_super_admin'),
                    supabase.rpc('my_role_keys'),
                    fetch('/api/me/current-business', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                    }).catch(() => null),
                ]);

                const rolesArr = Array.isArray(roleKeys) ? (roleKeys as string[]) : [];

                const roles: RoleSummary = {
                    hasDashboard: isSuperData || rolesArr.some((r) => ['owner', 'admin', 'manager'].includes(r)),
                    hasStaff: rolesArr.includes('staff'),
                    hasCabinet: true,
                    hasAdmin: !!isSuperData,
                };

                let currentBizId: string | null = null;
                let businesses: Business[] = [];

                if (currentBizRes && currentBizRes.ok) {
                    try {
                        const json = (await currentBizRes.json()) as {
                            ok: boolean;
                            data?: { currentBizId: string | null; businesses: Business[] };
                        };
                        if (json.ok && json.data) {
                            currentBizId = json.data.currentBizId ?? null;
                            businesses = json.data.businesses ?? [];
                        }
                    } catch (e) {
                        logWarn('RoleAndBusinessSwitcher', 'failed to parse current-business response', e);
                    }
                }

                if (!cancelled) {
                    setState({
                        status: 'ready',
                        roles,
                        businesses,
                        currentBizId,
                    });
                }
            } catch (e) {
                logWarn('RoleAndBusinessSwitcher', 'failed to load role/business info', e);
                if (!cancelled) {
                    setState({ status: 'error' });
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [t]);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const el = containerRef.current;
            if (!el) return;
            if (event.target instanceof Node && !el.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    if (state.status === 'loading') {
        return (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <div className="h-3 w-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>{t('header.roleBusiness.loading', 'Загружаем доступные кабинеты...')}</span>
            </div>
        );
    }

    if (state.status === 'error') {
        return null;
    }

    const { roles, businesses, currentBizId } = state;

    let roleLabel = t('header.roleBusiness.client', 'Клиент');
    if (roles.hasAdmin) {
        roleLabel = t('header.roleBusiness.admin', 'Админ');
    } else if (roles.hasDashboard) {
        roleLabel = t('header.roleBusiness.owner', 'Владелец / менеджер');
    } else if (roles.hasStaff) {
        roleLabel = t('header.roleBusiness.staff', 'Сотрудник');
    }

    const currentBiz =
        businesses.find((b) => b.id === currentBizId) ??
        businesses[0] ??
        null;

    const bizName =
        currentBiz?.name ||
        currentBiz?.slug ||
        (businesses.length > 0 ? t('header.roleBusiness.someBusiness', 'Бизнес') : t('header.roleBusiness.noBusiness', 'Без бизнеса'));
    const bizCity = currentBiz?.city || '';
    const bizLabel = bizCity ? `${bizName} · ${bizCity}` : bizName;

    const handleBusinessSelect = async (bizId: string) => {
        try {
            const res = await fetch('/api/me/current-business', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bizId }),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (e) {
            logWarn('RoleAndBusinessSwitcher', 'failed to set current business from header', e);
        } finally {
            setIsOpen(false);
            router.refresh();
        }
    };

    return (
        <div className="hidden md:block" ref={containerRef}>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                >
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="truncate max-w-[90px]">{roleLabel}</span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="truncate max-w-[120px]">{bizLabel}</span>
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
                    <div className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white py-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900 z-[120]">
                        <div className="px-3 pb-2 text-[11px] text-gray-500 dark:text-gray-400">
                            {t('header.roleBusiness.caption', 'Выберите кабинет или бизнес')}
                        </div>

                        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {t('header.roleBusiness.sections.cabinets', 'Кабинеты')}
                        </div>
                        <div className="px-1 pb-2 space-y-1">
                            {roles.hasDashboard && (
                                <Link
                                    href="/dashboard"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
                                >
                                    <span>{t('header.businessCabinet', 'Кабинет бизнеса')}</span>
                                </Link>
                            )}
                            {roles.hasStaff && (
                                <Link
                                    href="/staff"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
                                >
                                    <span>{t('header.staffCabinet', 'Кабинет сотрудника')}</span>
                                </Link>
                            )}
                            {roles.hasCabinet && (
                                <Link
                                    href="/cabinet"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
                                >
                                    <span>{t('header.myBookings', 'Мои записи')}</span>
                                </Link>
                            )}
                            {roles.hasAdmin && (
                                <Link
                                    href="/admin"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
                                >
                                    <span>{t('header.adminPanel', 'Админ-панель')}</span>
                                </Link>
                            )}
                        </div>

                        {businesses.length > 0 && (
                            <>
                                <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
                                    {t('header.roleBusiness.sections.businesses', 'Бизнесы')}
                                </div>
                                <div className="max-h-48 overflow-auto px-1 space-y-1 pb-1">
                                    {businesses.map((b) => {
                                        const isCurrent = b.id === currentBizId;
                                        const title = b.name || b.slug || t('dashboard.businessSwitcher.unknown', 'Бизнес');
                                        const subtitle = b.city || undefined;
                                        return (
                                            <button
                                                key={b.id}
                                                type="button"
                                                onClick={() => void handleBusinessSelect(b.id)}
                                                className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-md text-left ${
                                                    isCurrent
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
                                                {isCurrent && (
                                                    <span className="ml-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}


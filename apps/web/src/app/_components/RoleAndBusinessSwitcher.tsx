'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useLanguage } from './i18n/LanguageProvider';

import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type RoleSummary = {
    hasDashboard: boolean;
    hasStaff: boolean;
    hasCabinet: boolean;
    hasAdmin: boolean;
};

type SwitcherState =
    | { status: 'loading' }
    | { status: 'ready'; roles: RoleSummary }
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

                const [{ data: isSuperData }, { data: roleKeys }] = await Promise.all([
                    supabase.rpc('is_super_admin'),
                    supabase.rpc('my_role_keys'),
                ]);

                const rolesArr = Array.isArray(roleKeys) ? (roleKeys as string[]) : [];

                const roles: RoleSummary = {
                    hasDashboard: isSuperData || rolesArr.some((r) => ['owner', 'admin', 'manager'].includes(r)),
                    hasStaff: rolesArr.includes('staff'),
                    hasCabinet: true,
                    hasAdmin: !!isSuperData,
                };

                if (!cancelled) {
                    setState({ status: 'ready', roles });
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

    const { roles } = state;

    let roleLabel = t('header.roleBusiness.client', 'Клиент');
    if (roles.hasAdmin) {
        roleLabel = t('header.roleBusiness.admin', 'Админ');
    } else if (roles.hasDashboard) {
        roleLabel = t('header.roleBusiness.owner', 'Владелец / менеджер');
    } else if (roles.hasStaff) {
        roleLabel = t('header.roleBusiness.staff', 'Сотрудник');
    }

    return (
        <div className="hidden md:block" ref={containerRef}>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                >
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="truncate max-w-[160px]">{roleLabel}</span>
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
                            {t('header.roleBusiness.captionRoles', 'Выберите кабинет (роль)')}
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
                    </div>
                )}
            </div>
        </div>
    );
}


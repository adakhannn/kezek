'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
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

type RoleAndBusinessSwitcherProps = {
    mode?: 'desktop' | 'mobile';
    onNavigate?: () => void;
};

export function RoleAndBusinessSwitcher({
    mode = 'desktop',
    onNavigate,
}: RoleAndBusinessSwitcherProps = {}) {
    const { t } = useLanguage();
    const [state, setState] = useState<SwitcherState>({ status: 'loading' });
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isMobile = mode === 'mobile';

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
    }, []);

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
            <div
                className={clsx(
                    isMobile ? 'flex w-full' : 'hidden md:flex',
                    'items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-xs text-[var(--text-muted)] shadow-[var(--shadow-xs)]',
                )}
            >
                <div className="h-3 w-3 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
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

    const handleNavigate = () => {
        setIsOpen(false);
        onNavigate?.();
    };

    const controlClassName = clsx(
        'inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-all duration-200 hover:border-[var(--border-default)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]',
        isMobile ? 'w-full justify-between px-3.5 py-3' : 'px-3.5 py-2',
    );

    const menuClassName = clsx(
        'z-[120] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)] shadow-[var(--shadow-lg)] backdrop-blur-xl',
        isMobile ? 'mt-2 w-full' : 'absolute right-0 mt-3 w-72',
    );

    return (
        <div className={clsx(isMobile ? 'w-full' : 'hidden md:block')} ref={containerRef}>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className={controlClassName}
                    aria-expanded={isOpen}
                >
                    <span className="inline-flex items-center gap-2 truncate">
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="truncate">{roleLabel}</span>
                    </span>
                    <svg
                        className={clsx('h-4 w-4 shrink-0 transition-transform', isOpen ? 'rotate-180' : '')}
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                    >
                        <path d="M6 8l4 4 4-4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                {isOpen ? (
                    <div className={menuClassName}>
                        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                            <p className="type-label text-[var(--text-primary)]">
                                {t('header.roleBusiness.captionRoles', 'Выберите кабинет (роль)')}
                            </p>
                            <p className="type-caption mt-1 text-[var(--text-muted)]">
                                {t('header.roleBusiness.sections.cabinets', 'Кабинеты')}
                            </p>
                        </div>

                        <div className="space-y-1 p-2">
                            {roles.hasDashboard ? (
                                <Link
                                    href="/dashboard"
                                    onClick={handleNavigate}
                                    className="flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                                >
                                    <span>{t('header.businessCabinet', 'Кабинет бизнеса')}</span>
                                </Link>
                            ) : null}
                            {roles.hasStaff ? (
                                <Link
                                    href="/staff"
                                    onClick={handleNavigate}
                                    className="flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                                >
                                    <span>{t('header.staffCabinet', 'Кабинет сотрудника')}</span>
                                </Link>
                            ) : null}
                            {roles.hasCabinet ? (
                                <Link
                                    href="/cabinet"
                                    onClick={handleNavigate}
                                    className="flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                                >
                                    <span>{t('header.myBookings', 'Мои записи')}</span>
                                </Link>
                            ) : null}
                            {roles.hasAdmin ? (
                                <Link
                                    href="/admin"
                                    onClick={handleNavigate}
                                    className="flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                                >
                                    <span>{t('header.adminPanel', 'Админ-панель')}</span>
                                </Link>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}


'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useLanguage } from './i18n/LanguageProvider';

import { hasBusinessDashboardAccess } from '@/lib/authContext';
import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type RoleSummary = {
    hasDashboard: boolean;
    hasStaff: boolean;
    hasCabinet: boolean;
    hasAdmin: boolean;
};

type BusinessSummary = {
    id: string;
    name: string | null;
    city: string | null;
    slug: string | null;
};

type SwitcherState =
    | { status: 'loading' }
    | { status: 'ready'; roles: RoleSummary; currentBizId: string | null; businesses: BusinessSummary[] }
    | { status: 'error'; message?: string };

type RoleAndBusinessSwitcherProps = {
    mode?: 'desktop' | 'mobile';
    onNavigate?: () => void;
};

export function RoleAndBusinessSwitcher({
    mode = 'desktop',
    onNavigate,
}: RoleAndBusinessSwitcherProps = {}) {
    const { t } = useLanguage();
    const router = useRouter();
    const [state, setState] = useState<SwitcherState>({ status: 'loading' });
    const [isOpen, setIsOpen] = useState(false);
    const [switchingBusinessId, setSwitchingBusinessId] = useState<string | null>(null);
    const [switchError, setSwitchError] = useState<string | null>(null);
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

                const [{ data: isSuperData }, { data: roleKeys }, businessResponse] = await Promise.all([
                    supabase.rpc('is_super_admin'),
                    supabase.rpc('my_role_keys'),
                    fetch('/api/me/current-business', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        cache: 'no-store',
                    }),
                ]);

                let currentBizId: string | null = null;
                let businesses: BusinessSummary[] = [];
                if (businessResponse.ok) {
                    const businessJson = (await businessResponse.json()) as {
                        ok?: boolean;
                        data?: { currentBizId: string | null; businesses: BusinessSummary[] };
                    };
                    if (businessJson.ok && businessJson.data) {
                        currentBizId = businessJson.data.currentBizId;
                        businesses = Array.isArray(businessJson.data.businesses)
                            ? businessJson.data.businesses
                            : [];
                    }
                }

                const rolesArr = Array.isArray(roleKeys) ? (roleKeys as string[]) : [];

                const roles: RoleSummary = {
                    hasDashboard: hasBusinessDashboardAccess(
                        !!isSuperData,
                        businesses.length > 0 || rolesArr.some((r) => ['owner', 'admin', 'manager'].includes(r)),
                    ),
                    hasStaff: rolesArr.includes('staff'),
                    hasCabinet: true,
                    hasAdmin: !!isSuperData,
                };

                if (!cancelled) {
                    setState({ status: 'ready', roles, currentBizId, businesses });
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
                            {state.status === 'ready' && state.businesses.length > 1 ? (
                                <div className="mb-2 border-b border-[var(--border-subtle)] pb-2">
                                    <p className="px-3 pb-1 text-xs font-medium text-[var(--text-muted)]">
                                        {t('header.roleBusiness.sections.businesses', 'Бизнесы')}
                                    </p>
                                    <div className="space-y-1">
                                        {state.businesses.map((business) => {
                                            const isCurrent = business.id === state.currentBizId;
                                            const label = business.name || business.slug || t('header.roleBusiness.someBusiness', 'Бизнес');
                                            return (
                                                <button
                                                    key={business.id}
                                                    type="button"
                                                    aria-pressed={isCurrent}
                                                    disabled={Boolean(switchingBusinessId)}
                                                    className={clsx(
                                                        'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition-colors',
                                                        isCurrent
                                                            ? 'bg-[var(--surface-emphasis)] text-[var(--text-primary)]'
                                                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]',
                                                        switchingBusinessId ? 'cursor-wait opacity-70' : '',
                                                    )}
                                                    onClick={() => {
                                                        if (isCurrent || switchingBusinessId) {
                                                            setIsOpen(false);
                                                            return;
                                                        }
                                                        setSwitchError(null);
                                                        setSwitchingBusinessId(business.id);
                                                        void (async () => {
                                                            try {
                                                                const response = await fetch('/api/me/current-business', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ bizId: business.id }),
                                                                });
                                                                if (!response.ok) {
                                                                    throw new Error(`HTTP ${response.status}`);
                                                                }
                                                                const result = (await response.json()) as { ok?: boolean };
                                                                if (!result.ok) throw new Error('Business switch failed');
                                                                setIsOpen(false);
                                                                router.push('/dashboard');
                                                                router.refresh();
                                                            } catch (error) {
                                                                setSwitchError(t('header.roleBusiness.switchError', 'Не удалось переключить бизнес. Попробуйте ещё раз.'));
                                                                logWarn('RoleAndBusinessSwitcher', 'failed to switch business', error);
                                                            } finally {
                                                                setSwitchingBusinessId(null);
                                                            }
                                                        })();
                                                    }}
                                                >
                                                    <span className="min-w-0 truncate">{label}</span>
                                                    {isCurrent ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" /> : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {switchError ? (
                                        <p role="alert" className="px-3 pt-2 text-xs text-red-400">
                                            {switchError}
                                        </p>
                                    ) : null}
                                    <Link
                                        href="/select-business"
                                        onClick={handleNavigate}
                                        className="mt-1 block px-3 py-2 text-xs text-[var(--accent-primary)] hover:underline"
                                    >
                                        {t('header.roleBusiness.switchBusiness', 'Открыть выбор бизнеса')}
                                    </Link>
                                </div>
                            ) : null}
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


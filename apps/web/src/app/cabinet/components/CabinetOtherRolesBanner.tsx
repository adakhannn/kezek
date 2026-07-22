'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { hasBusinessDashboardAccess } from '@/lib/authContext';
import { supabase } from '@/lib/supabaseClient';

const STORAGE_KEY = 'cabinet-other-roles-banner-dismissed';

type BannerState =
    | { status: 'loading' }
    | { status: 'hidden' }
    | {
          status: 'visible';
          hasDashboard: boolean;
          hasStaff: boolean;
          hasAdmin: boolean;
      };

export function CabinetOtherRolesBanner() {
    const { t } = useLanguage();
    const [state, setState] = useState<BannerState>({ status: 'loading' });
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                if (typeof window !== 'undefined') {
                    const stored = localStorage.getItem(STORAGE_KEY);
                    if (stored === '1') {
                        if (!cancelled) setDismissed(true);
                    }
                }

                const { data: sessionRes } = await supabase.auth.getSession();
                const user = sessionRes.session?.user;
                if (!user) {
                    if (!cancelled) setState({ status: 'hidden' });
                    return;
                }

                const [{ data: isSuperData }, { data: roleKeys }] = await Promise.all([
                    supabase.rpc('is_super_admin'),
                    supabase.rpc('my_role_keys'),
                ]);

                const rolesArr = Array.isArray(roleKeys) ? (roleKeys as string[]) : [];
                const hasDashboard = hasBusinessDashboardAccess(
                    !!isSuperData,
                    rolesArr.some((r) => ['owner', 'admin', 'manager'].includes(r)),
                );
                const hasStaff = rolesArr.includes('staff');
                const hasAdmin = !!isSuperData;

                if (!cancelled && (hasDashboard || hasStaff || hasAdmin)) {
                    setState({ status: 'visible', hasDashboard, hasStaff, hasAdmin });
                } else if (!cancelled) {
                    setState({ status: 'hidden' });
                }
            } catch {
                if (!cancelled) setState({ status: 'hidden' });
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, '1');
        }
    };

    if (state.status !== 'visible' || dismissed) return null;

    const links: { href: string; labelKey: string }[] = [];
    if (state.hasDashboard) links.push({ href: '/dashboard', labelKey: 'cabinet.banner.linkDashboard' });
    if (state.hasStaff) links.push({ href: '/staff', labelKey: 'cabinet.banner.linkStaff' });
    if (state.hasAdmin) links.push({ href: '/admin', labelKey: 'cabinet.banner.linkAdmin' });

    if (links.length === 0) return null;

    return (
        <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950/40"
            role="region"
            aria-label={t('cabinet.banner.alsoHasAccess', 'У вас также есть доступ к:')}
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                    {t('cabinet.banner.alsoHasAccess', 'У вас также есть доступ к:')}
                </span>
                <div className="flex flex-wrap gap-2">
                    {links.map(({ href, labelKey }) => (
                        <Link
                            key={href}
                            href={href}
                            className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                        >
                            {t(labelKey)}
                        </Link>
                    ))}
                </div>
            </div>
            <button
                type="button"
                onClick={handleDismiss}
                className="rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                aria-label={t('cabinet.banner.dismiss', 'Скрыть')}
            >
                {t('cabinet.banner.dismiss', 'Скрыть')}
            </button>
        </div>
    );
}

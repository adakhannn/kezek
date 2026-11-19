import { unstable_noStore as noStore } from 'next/cache';

import { PersonalCabinetButton } from './PersonalCabinetButton';
import { SignInButton } from './SignInButton';
import { SignOutButton } from './SignOutButton';
import { StaffCabinetButton } from './StaffCabinetButton';
import { getT } from './i18n/server';

import { getShellViewer } from '@/lib/shellViewer';

export const dynamic = 'force-dynamic';

export async function AuthStatusServer() {
    noStore();

    const viewer = await getShellViewer();
    if (viewer.status === 'unavailable') {
        const t = await getT();
        return (
            <div className="hidden lg:flex items-center gap-3">
                <span className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    {t('header.auth.serviceUnavailable', 'Сервис временно недоступен')}
                </span>
            </div>
        );
    }

    if (viewer.status === 'anonymous') {
        return (
            <div className="hidden lg:flex items-center gap-3">
                <SignInButton className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-2 text-sm font-medium text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-all duration-200 hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)] hover:shadow-[var(--shadow-md)]" />
            </div>
        );
    }

    const t = await getT();
    const accountLabel = viewer.accountLabel || t('header.account', 'аккаунт');
    const isStaff = viewer.roles.hasStaff;

    return (
        <div className="hidden lg:flex items-center gap-3">
            <div className="inline-flex max-w-[16rem] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-emphasis)_82%,transparent)] px-3.5 py-2 text-sm shadow-[var(--shadow-xs)]">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="truncate text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">{accountLabel}</span>
                </span>
            </div>
            {isStaff ? <StaffCabinetButton className="px-3.5" /> : null}
            <PersonalCabinetButton className="px-3.5" />
            <SignOutButton className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-2 text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-all duration-200 hover:border-[var(--border-default)] hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)] hover:shadow-[var(--shadow-sm)]" />
        </div>
    );
}

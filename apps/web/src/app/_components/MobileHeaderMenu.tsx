'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PersonalCabinetButton } from './PersonalCabinetButton';
import { RoleAndBusinessSwitcher } from './RoleAndBusinessSwitcher';
import { SignInButton } from './SignInButton';
import { SignOutButton } from './SignOutButton';
import { StaffCabinetButton } from './StaffCabinetButton';
import { useLanguage } from './i18n/LanguageProvider';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';

import { supabase } from '@/lib/supabaseClient';

export function MobileHeaderMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useLanguage();
    const pathname = usePathname();

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen]);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="motion-interactive inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                aria-label={t('header.menu', 'Меню')}
                aria-expanded={isOpen}
            >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {isOpen ? (
                <>
                    <button
                        type="button"
                        aria-label={t('common.close', 'Закрыть')}
                        className="fixed inset-0 z-[105] bg-black/70 lg:hidden"
                        onClick={() => setIsOpen(false)}
                    />

                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[120] w-[min(22rem,calc(100vw-1.5rem))] rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-lg)] md:fixed md:left-1/2 md:right-auto md:top-36 md:w-[min(44rem,calc(100vw-2rem))] md:-translate-x-1/2 md:p-5 lg:hidden">
                        <div className="space-y-4 md:grid md:grid-cols-3 md:items-start md:gap-4 md:space-y-0">
                            <section className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-emphasis)]/45 p-3">
                                <p className="type-caption px-1 text-[var(--text-muted)]">
                                    {t('header.language', 'Язык')}
                                </p>
                                <LanguageSwitcher onLanguageChange={() => setIsOpen(false)} />
                            </section>

                            <section className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-emphasis)]/45 p-3">
                                <p className="type-caption px-1 text-[var(--text-muted)]">
                                    {t('header.roleBusiness.sections.cabinets', 'Кабинеты')}
                                </p>
                                <RoleAndBusinessSwitcher mode="mobile" onNavigate={() => setIsOpen(false)} />
                            </section>

                            <section className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-emphasis)]/45 p-3">
                                <p className="type-caption px-1 text-[var(--text-muted)]">
                                    {t('header.account', 'Аккаунт')}
                                </p>
                                <MobileAuthStatus onAction={() => setIsOpen(false)} />
                            </section>
                        </div>
                    </div>
                </>
            ) : null}
        </>
    );
}

function MobileAuthStatus({ onAction }: { onAction: () => void }) {
    const { t } = useLanguage();
    const [user, setUser] = useState<{ id: string; email?: string; phone?: string } | null>(null);
    const [label, setLabel] = useState<string>('');
    const [isStaff, setIsStaff] = useState(false);

    useEffect(() => {
        let ignore = false;

        (async () => {
            const {
                data: { user: authUser },
            } = await supabase.auth.getUser();
            if (ignore || !authUser) {
                setUser(null);
                return;
            }

            setUser(authUser);

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', authUser.id)
                .maybeSingle();

            const userName =
                profile?.full_name?.trim() ||
                authUser.email ||
                (authUser.phone as string | undefined) ||
                'аккаунт';
            setLabel(userName);

            const { data: staff } = await supabase
                .from('staff')
                .select('id, biz_id')
                .eq('user_id', authUser.id)
                .eq('is_active', true)
                .maybeSingle();

            setIsStaff(!!staff);
        })();

        return () => {
            ignore = true;
        };
    }, []);

    if (!user) {
        return (
            <SignInButton
                onClick={onAction}
                className="inline-flex w-full items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] px-4 py-3 text-sm font-medium text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-all duration-200 hover:from-[var(--accent-primary-strong)] hover:to-[var(--accent-secondary-strong)]"
            />
        );
    }

    return (
        <div className="space-y-3">
            <div className="inline-flex w-full items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-emphasis)_82%,transparent)] px-3.5 py-2 text-sm shadow-[var(--shadow-xs)]">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="truncate text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">{label}</span>
                </span>
            </div>

            <div className="flex flex-col gap-2">
                {isStaff ? <StaffCabinetButton onClick={onAction} className="w-full py-3" /> : null}
                <PersonalCabinetButton onClick={onAction} className="w-full justify-center py-3" />
                <SignOutButton
                    onAction={onAction}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-all duration-200 hover:bg-[var(--surface-emphasis)] hover:text-[var(--text-primary)]"
                />
            </div>
        </div>
    );
}


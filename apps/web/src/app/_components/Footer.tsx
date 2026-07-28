'use client';

import Link from 'next/link';

import { useLanguage } from './i18n/LanguageProvider';

export function Footer() {
    const { t } = useLanguage();
    const year = new Date().getFullYear();

    return (
        <footer className="mt-auto px-3 pb-3 pt-6 sm:px-4 sm:pb-4 lg:px-6">
            <div className="mx-auto max-w-7xl">
                <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_86%,transparent)] px-4 py-4 shadow-[var(--shadow-md)] backdrop-blur-xl sm:px-5 sm:py-5">
                    <div className="flex flex-col items-center justify-between gap-3 sm:gap-4 md:flex-row md:items-center">
                        <p className="text-center text-xs text-[var(--text-muted)] sm:text-sm md:text-left" suppressHydrationWarning>
                            © {year} Kezek. {t('footer.rights', 'Все права защищены.')}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-end">
                            <Link
                                href="/business/apply"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.connectBusiness')}
                            </Link>
                            <Link
                                href="/auth/sign-in?redirect=/business/role-apply"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.joinBusiness')}
                            </Link>
                            <Link
                                href="/map"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.map', 'Карта филиалов')}
                            </Link>
                            <Link
                                href="/privacy"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.privacy', 'Политика конфиденциальности')}
                            </Link>
                            <Link
                                href="/terms"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.terms', 'Пользовательское соглашение')}
                            </Link>
                            <Link
                                href="/data-deletion"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.dataDeletion', 'Удаление данных')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}


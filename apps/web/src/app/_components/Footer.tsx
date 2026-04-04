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
                            В© {year} Kezek. {t('footer.rights', 'Р’СЃРµ РїСЂР°РІР° Р·Р°С‰РёС‰РµРЅС‹.')}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-end">
                            <Link
                                href="/map"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.map', 'РљР°СЂС‚Р° С„РёР»РёР°Р»РѕРІ')}
                            </Link>
                            <Link
                                href="/privacy"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.privacy', 'РџРѕР»РёС‚РёРєР° РєРѕРЅС„РёРґРµРЅС†РёР°Р»СЊРЅРѕСЃС‚Рё')}
                            </Link>
                            <Link
                                href="/terms"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.terms', 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРµ СЃРѕРіР»Р°С€РµРЅРёРµ')}
                            </Link>
                            <Link
                                href="/data-deletion"
                                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent-primary)] sm:text-sm"
                            >
                                {t('footer.dataDeletion', 'РЈРґР°Р»РµРЅРёРµ РґР°РЅРЅС‹С…')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

'use client';

import Link from 'next/link';

import {
    BusinessApplicationForm,
    type BusinessApplicationInitialValues,
    type BusinessCategoryOption,
} from './BusinessApplicationForm';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Card } from '@/components/ui/Card';
import { buttonStyles } from '@/components/ui/buttonStyles';

export function BusinessApplicationPageContent({
    categories,
    initialValues,
    isAuthenticated,
}: {
    categories: BusinessCategoryOption[];
    initialValues: BusinessApplicationInitialValues;
    isAuthenticated: boolean;
}) {
    const { t } = useLanguage();

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
            <div className="mb-6 text-center">
                <h1 className="text-3xl font-bold text-[var(--text-primary)]">
                    {t('business.apply.page.title')}
                </h1>
                <p className="mt-2 text-[var(--text-secondary)]">
                    {isAuthenticated
                        ? t('business.apply.page.authenticatedDescription')
                        : t('business.apply.page.guestDescription')}
                </p>
            </div>

            {isAuthenticated ? (
                <BusinessApplicationForm categories={categories} initialValues={initialValues} />
            ) : (
                <AuthenticationGate />
            )}
        </main>
    );
}

function AuthenticationGate() {
    const { t } = useLanguage();
    const benefits = [
        {
            title: t('business.apply.gate.benefit.application.title'),
            description: t('business.apply.gate.benefit.application.description'),
        },
        {
            title: t('business.apply.gate.benefit.status.title'),
            description: t('business.apply.gate.benefit.status.description'),
        },
        {
            title: t('business.apply.gate.benefit.access.title'),
            description: t('business.apply.gate.benefit.access.description'),
        },
    ];

    return (
        <Card variant="elevated" padding="lg" className="overflow-hidden">
            <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-emphasis)] text-[var(--accent-primary)]">
                    <svg className="h-7 w-7" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
                    {t('business.apply.gate.title')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {t('business.apply.gate.description')}
                </p>

                <ul className="my-6 grid gap-3 text-left md:grid-cols-3">
                    {benefits.map((item) => (
                        <li
                            key={item.title}
                            className="flex min-w-0 items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-emphasis)_72%,transparent)] p-3.5"
                        >
                            <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--status-success)_14%,transparent)] text-[var(--status-success)]"
                                aria-hidden="true"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 13l4 4L19 7" />
                                </svg>
                            </span>
                            <span className="min-w-0 pt-0.5">
                                <span className="block text-sm font-semibold leading-5 text-[var(--text-primary)]">
                                    {item.title}
                                </span>
                                <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">
                                    {item.description}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>

                <Link
                    href="/auth/sign-in?redirect=/business/apply"
                    className={buttonStyles({ fullWidth: true })}
                >
                    {t('business.apply.gate.signIn')}
                </Link>
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                    {t('business.apply.gate.returnHint')}
                </p>
            </div>
        </Card>
    );
}

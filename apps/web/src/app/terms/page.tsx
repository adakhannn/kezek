// apps/web/src/app/terms/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

import { aroundSlot, getLegalT, type LegalKey } from '@/app/_components/i18n/legal';
import { formatLocalizedDate } from '@/lib/kyDateFormat';
import { getPublicSiteOrigin } from '@/lib/siteOrigin';

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getLegalT();
    return {
        title: t('legal.terms.metaTitle'),
        description: t('legal.terms.metaDescription'),
    };
}

const ACCOUNT_RULES: readonly LegalKey[] = ['legal.terms.s3.i1', 'legal.terms.s3.i2', 'legal.terms.s3.i3'];
const BOOKING_RULES: readonly LegalKey[] = ['legal.terms.s4.i1', 'legal.terms.s4.i2', 'legal.terms.s4.i3'];
const OBLIGATIONS: readonly LegalKey[] = ['legal.terms.s5.i1', 'legal.terms.s5.i2', 'legal.terms.s5.i3'];
const LIABILITY_EXCLUSIONS: readonly LegalKey[] = ['legal.terms.s6.i1', 'legal.terms.s6.i2', 'legal.terms.s6.i3'];

export default async function TermsPage() {
    const { locale, t } = await getLegalT();
    const updated = formatLocalizedDate(new Date(), locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const [beforePrivacyLink, afterPrivacyLink] = aroundSlot(t('legal.terms.s7.p'), 'link');
    const [beforeTermsUrl, afterTermsUrl] = aroundSlot(t('legal.terms.s8.p'), 'url');
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
                <div className="min-w-0 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 sm:p-12">
                    <div className="mb-8">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors mb-6"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            {t('legal.common.backHome')}
                        </Link>
                        <h1 className="break-words text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                            {t('legal.terms.title')}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {t('legal.common.lastUpdated').replace('{date}', updated)}
                        </p>
                    </div>

                    <div className="min-w-0 space-y-8 [&_h2]:break-words">
                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.terms.s1.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.terms.s1.p1')}
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
                                {t('legal.terms.s1.p2')}
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.terms.s2.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.terms.s2.p')}
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.terms.s3.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                {t('legal.terms.s3.p')}
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                {ACCOUNT_RULES.map((key) => <li key={key}>{t(key)}</li>)}
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.terms.s4.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                {t('legal.terms.s4.p')}
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                {BOOKING_RULES.map((key) => <li key={key}>{t(key)}</li>)}
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.terms.s5.title')}
                            </h2>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                {OBLIGATIONS.map((key) => <li key={key}>{t(key)}</li>)}
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.terms.s6.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.terms.s6.p')}
                            </p>
                            <ul className="mt-3 space-y-2 text-gray-700 dark:text-gray-300">
                                {LIABILITY_EXCLUSIONS.map((key) => <li key={key}>{t(key)}</li>)}
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.terms.s7.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {beforePrivacyLink}
                                <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                    {t('legal.terms.s7.link')}
                                </Link>
                                {afterPrivacyLink}
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.terms.s8.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {beforeTermsUrl}
                                <span className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{getPublicSiteOrigin()}/terms</span>
                                {afterTermsUrl}
                            </p>
                        </section>
                    </div>

                    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200"
                        >
                            {t('legal.common.backHome')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}



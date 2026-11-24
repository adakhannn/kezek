// apps/web/src/app/data-deletion/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

import { getLegalT, type LegalKey } from '@/app/_components/i18n/legal';
import { formatLocalizedDate } from '@/lib/kyDateFormat';
import { getPublicSiteHost, getPublicSiteOrigin } from '@/lib/siteOrigin';

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getLegalT();
    return {
        title: t('legal.dataDeletion.metaTitle'),
        description: t('legal.dataDeletion.metaDescription'),
    };
}

const DELETED_DATA: ReadonlyArray<[LegalKey, LegalKey]> = [
    ['legal.dataDeletion.s2.profile.label', 'legal.dataDeletion.s2.profile.text'],
    ['legal.dataDeletion.s2.bookings.label', 'legal.dataDeletion.s2.bookings.text'],
    ['legal.dataDeletion.s2.reviews.label', 'legal.dataDeletion.s2.reviews.text'],
    ['legal.dataDeletion.s2.auth.label', 'legal.dataDeletion.s2.auth.text'],
];
const STEPS: ReadonlyArray<[LegalKey, LegalKey]> = [
    ['legal.dataDeletion.s3.step1.title', 'legal.dataDeletion.s3.step1.text'],
    ['legal.dataDeletion.s3.step2.title', 'legal.dataDeletion.s3.step2.text'],
    ['legal.dataDeletion.s3.step3.title', 'legal.dataDeletion.s3.step3.text'],
    ['legal.dataDeletion.s3.step4.title', 'legal.dataDeletion.s3.step4.text'],
];
const TIMELINE: readonly LegalKey[] = ['legal.dataDeletion.s4.i1', 'legal.dataDeletion.s4.i2', 'legal.dataDeletion.s4.i3'];
const PARTIAL_OPTIONS: readonly LegalKey[] = ['legal.dataDeletion.s5.i1', 'legal.dataDeletion.s5.i2', 'legal.dataDeletion.s5.i3'];

export default async function DataDeletionPage() {
    const { locale, t } = await getLegalT();
    const updated = formatLocalizedDate(new Date(), locale, { year: 'numeric', month: 'long', day: 'numeric' });
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-12">
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
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                            {t('legal.dataDeletion.title')}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {t('legal.common.lastUpdated').replace('{date}', updated)}
                        </p>
                    </div>

                    <div className="space-y-8">
                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.dataDeletion.s1.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.dataDeletion.s1.p')}
                            </p>
                            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>{t('legal.dataDeletion.s1.important.label')}</strong> {t('legal.dataDeletion.s1.important.text')}
                                </p>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.dataDeletion.s2.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                {t('legal.dataDeletion.s2.intro')}
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                {DELETED_DATA.map(([label, text]) => (
                                    <li key={label} className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span><strong>{t(label)}</strong> {t(text)}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>{t('legal.dataDeletion.s2.exceptions.label')}</strong> {t('legal.dataDeletion.s2.exceptions.text')}
                                </p>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.dataDeletion.s3.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                {t('legal.dataDeletion.s3.intro')}
                            </p>
                            <ol className="space-y-4 text-gray-700 dark:text-gray-300 ml-4">
                                {STEPS.map(([title, text], index) => (
                                    <li key={title} className="flex items-start gap-3">
                                        <span className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-semibold">{index + 1}</span>
                                        <div>
                                            <p className="font-medium mb-1">{t(title)}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {t(text)}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>{t('legal.dataDeletion.s3.alt.label')}</strong> {t('legal.dataDeletion.s3.alt.text')}
                                </p>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.dataDeletion.s4.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.dataDeletion.s4.intro')}
                            </p>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300 mt-3 ml-4">
                                {TIMELINE.map((key) => <li key={key}>• {t(key)}</li>)}
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.dataDeletion.s5.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.dataDeletion.s5.p')}
                            </p>
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>{t('legal.dataDeletion.s5.options')}</strong>
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-4">
                                    {PARTIAL_OPTIONS.map((key) => <li key={key}>• {t(key)}</li>)}
                                </ul>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.dataDeletion.s6.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.dataDeletion.s6.p')}
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.dataDeletion.s7.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.dataDeletion.s7.intro')}
                            </p>
                            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>{t('legal.common.serviceLabel')}</strong> Kezek<br/>
                                    <strong>{t('legal.common.websiteLabel')}</strong> <a href={getPublicSiteOrigin()} className="text-indigo-600 dark:text-indigo-400 hover:underline">{getPublicSiteHost()}</a><br/>
                                    <strong>Email:</strong> {t('legal.common.emailText')}<br/>
                                    <strong>{t('legal.dataDeletion.s7.relatedLabel')}</strong> <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('legal.dataDeletion.s7.privacyLink')}</Link>
                                </p>
                            </div>
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


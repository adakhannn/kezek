// apps/web/src/app/privacy/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

import { getLegalT, type LegalKey } from '@/app/_components/i18n/legal';
import { formatLocalizedDate } from '@/lib/kyDateFormat';
import { getPublicSiteHost, getPublicSiteOrigin } from '@/lib/siteOrigin';

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getLegalT();
    return {
        title: t('legal.privacy.metaTitle'),
        description: t('legal.privacy.metaDescription'),
    };
}

function CheckIcon() {
    return (
        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

const COLLECTED: ReadonlyArray<[LegalKey, LegalKey]> = [
    ['legal.privacy.s2.contacts.label', 'legal.privacy.s2.contacts.text'],
    ['legal.privacy.s2.bookings.label', 'legal.privacy.s2.bookings.text'],
    ['legal.privacy.s2.auth.label', 'legal.privacy.s2.auth.text'],
    ['legal.privacy.s2.tech.label', 'legal.privacy.s2.tech.text'],
];
const PURPOSES: readonly LegalKey[] = [
    'legal.privacy.s3.i1',
    'legal.privacy.s3.i2',
    'legal.privacy.s3.i3',
    'legal.privacy.s3.i4',
    'legal.privacy.s3.i5',
];
const RECIPIENTS: readonly LegalKey[] = ['legal.privacy.s5.i1', 'legal.privacy.s5.i2', 'legal.privacy.s5.i3'];
const RIGHTS: readonly LegalKey[] = ['legal.privacy.s6.i1', 'legal.privacy.s6.i2', 'legal.privacy.s6.i3', 'legal.privacy.s6.i4'];
const COOKIE_TYPES: readonly LegalKey[] = ['legal.privacy.s7.i1', 'legal.privacy.s7.i2', 'legal.privacy.s7.i3'];

export default async function PrivacyPage() {
    const { locale, t } = await getLegalT();
    const updated = formatLocalizedDate(new Date(), locale, { year: 'numeric', month: 'long', day: 'numeric' });
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
                            {t('legal.privacy.title')}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {t('legal.common.lastUpdated').replace('{date}', updated)}
                        </p>
                    </div>

                    <div className="min-w-0 space-y-8 [&_h2]:break-words">
                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.privacy.s1.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.privacy.s1.p1')}
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
                                {t('legal.privacy.s1.p2')}
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.privacy.s2.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                {t('legal.privacy.s2.intro')}
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                {COLLECTED.map(([label, text]) => (
                                    <li key={label} className="flex items-start gap-3">
                                        <CheckIcon />
                                        <span><strong>{t(label)}</strong> {t(text)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.privacy.s3.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                {t('legal.privacy.s3.intro')}
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                {PURPOSES.map((key) => (
                                    <li key={key} className="flex items-start gap-3">
                                        <CheckIcon />
                                        <span>{t(key)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.privacy.s4.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.privacy.s4.p')}
                            </p>
                            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>{t('legal.privacy.s4.measures.label')}</strong> {t('legal.privacy.s4.measures.text')}
                                </p>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.privacy.s5.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.privacy.s5.p1')}
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
                                {t('legal.privacy.s5.p2')}
                            </p>
                            <ul className="space-y-2 text-gray-700 dark:text-gray-300 mt-3 ml-4">
                                {RECIPIENTS.map((key) => <li key={key}>• {t(key)}</li>)}
                            </ul>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.privacy.s6.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                                {t('legal.privacy.s6.intro')}
                            </p>
                            <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                                {RIGHTS.map((key) => (
                                    <li key={key} className="flex items-start gap-3">
                                        <CheckIcon />
                                        <span>{t(key)}</span>
                                    </li>
                                ))}
                            </ul>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4 text-sm">
                                {t('legal.privacy.s6.note')}
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.privacy.s7.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.privacy.s7.p')}
                            </p>
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>{t('legal.privacy.s7.types')}</strong>
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-4">
                                    {COOKIE_TYPES.map((key) => <li key={key}>• {t(key)}</li>)}
                                </ul>
                            </div>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.privacy.s8.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.privacy.s8.p1')}
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3 text-sm">
                                {t('legal.privacy.s8.p2')}
                            </p>
                        </section>

                        <section className="border-l-4 border-indigo-500 pl-6">
                            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('legal.privacy.s9.title')}
                            </h2>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {t('legal.privacy.s9.intro')}
                            </p>
                            <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <strong>{t('legal.common.serviceLabel')}</strong> Kezek<br/>
                                    <strong>{t('legal.common.websiteLabel')}</strong> <a href={getPublicSiteOrigin()} className="text-indigo-600 dark:text-indigo-400 hover:underline">{getPublicSiteHost()}</a><br/>
                                    <strong>Email:</strong> {t('legal.common.emailText')}
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


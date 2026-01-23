'use client';

import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { transliterate } from '@/lib/transliterate';

type Biz = { id: string; slug: string; name: string; address: string; phones: string[]; rating_score: number | null };
type Branch = { id: string; name: string; address?: string | null; rating_score: number | null };
type Staff = { id: string; full_name: string; branch_id: string; avatar_url?: string | null; rating_score: number | null };
type Promotion = {
    id: string;
    branch_id: string;
    promotion_type: string;
    title_ru: string | null;
    params: Record<string, unknown>;
    branches?: { name: string };
};

type Data = {
    biz: Biz;
    branches: Branch[];
    staff: Staff[];
    promotions?: Promotion[];
};

export default function BusinessInfo({ data }: { data: Data }) {
    const { biz, branches, staff, promotions = [] } = data;
    const { t, locale } = useLanguage();

    const formatBranchName = (name: string): string => {
        if (locale === 'en') {
            return transliterate(name);
        }
        return name;
    };

    const formatStaffName = (name: string): string => {
        if (locale === 'en') {
            return transliterate(name);
        }
        return name;
    };

    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                            {biz.name}
                        </h1>
                        {biz.rating_score !== null && biz.rating_score !== undefined && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                                    {biz.rating_score.toFixed(1)}
                                </span>
                            </div>
                        )}
                    </div>
                    {biz.address && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{biz.address}</p>
                    )}
                    {biz.phones?.length ? (
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                            {t('booking.phoneLabel', 'Телефон:')} {biz.phones.join(', ')}
                        </p>
                    ) : null}
                </div>

                {/* Информационная секция о бизнесе */}
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t('business.info.title', 'О бизнесе')}
                    </h2>

                    {/* Филиалы */}
                    {branches.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                                {t('business.info.branches', 'Филиалы')} ({branches.length})
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {branches.map((b) => (
                                    <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{formatBranchName(b.name)}</span>
                                        {b.rating_score !== null && b.rating_score !== undefined && (
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded border border-amber-200 dark:border-amber-800">
                                                <svg className="w-3 h-3 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                    {b.rating_score.toFixed(1)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Сотрудники */}
                    {staff.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                                {t('business.info.staff', 'Сотрудники')} ({staff.length})
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {staff.slice(0, 9).map((s) => (
                                    <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                        {s.avatar_url ? (
                                            <img src={s.avatar_url} alt={formatStaffName(s.full_name)} className="w-8 h-8 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                                                {formatStaffName(s.full_name).charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{formatStaffName(s.full_name)}</span>
                                    </div>
                                ))}
                                {staff.length > 9 && (
                                    <div className="flex items-center justify-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                                        +{staff.length - 9} {t('business.info.more', 'ещё')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Акции */}
                    {promotions.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {t('business.info.promotions', 'Акции')} ({promotions.length})
                                </h3>
                                <Link
                                    href={`/b/${biz.slug}/promotions`}
                                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
                                >
                                    {t('business.info.viewAllPromotions', 'Все акции')}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </div>
                            <div className="space-y-2">
                                {promotions.slice(0, 3).map((promotion) => {
                                    const branch = branches.find(b => b.id === promotion.branch_id);
                                    const params = promotion.params || {};
                                    let description = promotion.title_ru || '';

                                    if (promotion.promotion_type === 'free_after_n_visits' && params.visit_count) {
                                        description = t('booking.promotions.freeAfterN', 'Каждая {n}-я услуга бесплатно').replace('{n}', String(params.visit_count));
                                    } else if ((promotion.promotion_type === 'birthday_discount' || promotion.promotion_type === 'first_visit_discount' || promotion.promotion_type === 'referral_discount_50') && params.discount_percent) {
                                        description = t('booking.promotions.discountPercent', 'Скидка {percent}%').replace('{percent}', String(params.discount_percent));
                                    }

                                    return (
                                        <div key={promotion.id} className="flex items-start gap-2 p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 hover:shadow-md transition-shadow">
                                            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                            </svg>
                                            <div className="flex-1">
                                                <p className="text-sm text-emerald-900 dark:text-emerald-100 font-semibold">{description}</p>
                                                {branch && (
                                                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">{formatBranchName(branch.name)}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {promotions.length > 3 && (
                                    <Link
                                        href={`/b/${biz.slug}/promotions`}
                                        className="block text-center py-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                    >
                                        {t('business.info.morePromotions', '+{count} ещё акций').replace('{count}', String(promotions.length - 3))}
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Кнопка для перехода к бронированию */}
                <div className="flex justify-center">
                    <Link
                        href={`/b/${biz.slug}/booking`}
                        className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                        {t('business.info.bookButton', 'Записаться')}
                        <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            </div>
        </main>
    );
}


'use client';

import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { RatingDisplay } from '@/components/RatingDisplay';
import { transliterate } from '@/lib/transliterate';

type Biz = { id: string; slug: string; name: string; address: string; phones: string[]; rating_score: number | null };
type Branch = { id: string; name: string; address?: string | null; rating_score: number | null };
type Promotion = {
    id: string;
    branch_id: string;
    promotion_type: string;
    title_ru: string | null;
    title_ky?: string | null;
    title_en?: string | null;
    description_ru?: string | null;
    description_ky?: string | null;
    description_en?: string | null;
    params: Record<string, unknown>;
    valid_from?: string | null;
    valid_to?: string | null;
    branches?: { name: string };
};

type Data = {
    biz: Biz;
    branches: Branch[];
    promotions: Promotion[];
};

export default function PromotionsPageClient({ data }: { data: Data }) {
    const { biz, branches, promotions } = data;
    const { t, locale } = useLanguage();

    const formatBranchName = (name: string): string => {
        if (locale === 'en') {
            return transliterate(name);
        }
        return name;
    };

    const getPromotionTitle = (promo: Promotion): string => {
        if (locale === 'ky' && promo.title_ky) return promo.title_ky;
        if (locale === 'en' && promo.title_en) return promo.title_en;
        return promo.title_ru || '';
    };

    const getPromotionDescription = (promo: Promotion): string => {
        if (locale === 'ky' && promo.description_ky) return promo.description_ky;
        if (locale === 'en' && promo.description_en) return promo.description_en;
        return promo.description_ru || '';
    };

    const getPromotionDisplayText = (promo: Promotion): string => {
        const params = promo.params || {};
        let text = getPromotionTitle(promo);

        if (!text) {
            // Генерируем текст на основе типа акции
            if (promo.promotion_type === 'free_after_n_visits' && params.visit_count) {
                text = t('promotions.types.freeAfterNVisits', 'Каждая {n}-я услуга бесплатно').replace('{n}', String(params.visit_count));
            } else if (promo.promotion_type === 'referral_free') {
                text = t('promotions.types.referralFree', 'Приведи друга — получи услугу бесплатно');
            } else if (promo.promotion_type === 'referral_discount_50') {
                text = t('promotions.types.referralDiscount50', 'Приведи друга — получи скидку 50%');
            } else if (promo.promotion_type === 'first_visit_discount' && params.discount_percent) {
                text = t('promotions.types.firstVisitDiscount', 'Скидка {percent}% на первый визит').replace('{percent}', String(params.discount_percent));
            } else if (promo.promotion_type === 'birthday_discount' && params.discount_percent) {
                text = t('promotions.types.birthdayDiscount', 'Скидка {percent}% в день рождения').replace('{percent}', String(params.discount_percent));
            }
        }

        return text;
    };

    const getPromotionIcon = (type: string) => {
        switch (type) {
            case 'free_after_n_visits':
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                );
            case 'referral_free':
            case 'referral_discount_50':
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                );
            case 'first_visit_discount':
            case 'birthday_discount':
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                );
        }
    };

    const getPromotionColor = (type: string) => {
        switch (type) {
            case 'free_after_n_visits':
                return 'from-emerald-500 to-teal-600';
            case 'referral_free':
            case 'referral_discount_50':
                return 'from-purple-500 to-pink-600';
            case 'first_visit_discount':
            case 'birthday_discount':
                return 'from-amber-500 to-orange-600';
            default:
                return 'from-indigo-500 to-blue-600';
        }
    };

    // Группируем акции по филиалам
    const promotionsByBranch = new Map<string, Promotion[]>();
    promotions.forEach((promo) => {
        const branchId = promo.branch_id;
        if (!promotionsByBranch.has(branchId)) {
            promotionsByBranch.set(branchId, []);
        }
        promotionsByBranch.get(branchId)!.push(promo);
    });

    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
                {/* Заголовок */}
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-3">
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                            {t('promotions.page.title', 'Акции и специальные предложения')}
                        </h1>
                        <RatingDisplay score={biz.rating_score} t={t} variant="badge" className="px-3 py-1" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 dark:text-gray-300">{biz.name}</h2>
                    {biz.address && <p className="text-sm text-gray-600 dark:text-gray-400">{biz.address}</p>}
                </div>

                {/* Акции */}
                {promotions.length === 0 ? (
                    <div className="text-center py-12 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                            {t('promotions.page.noPromotions', 'На данный момент нет активных акций')}
                        </p>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {t('promotions.page.noPromotionsHint', 'Следите за обновлениями!')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Array.from(promotionsByBranch.entries()).map(([branchId, branchPromotions]) => {
                            const branch = branches.find((b) => b.id === branchId);
                            return (
                                <div key={branchId} className="space-y-4">
                                    {branch && (
                                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                            {formatBranchName(branch.name)}
                                            {branch.address && (
                                                <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">
                                                    — {branch.address}
                                                </span>
                                            )}
                                        </h3>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {branchPromotions.map((promo) => {
                                            const colorClass = getPromotionColor(promo.promotion_type);
                                            const displayText = getPromotionDisplayText(promo);
                                            const description = getPromotionDescription(promo);
                                            const params = promo.params || {};

                                            return (
                                                <div
                                                    key={promo.id}
                                                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorClass} p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300`}
                                                >
                                                    <div className="relative z-10 space-y-3">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="rounded-full bg-white/20 p-2 backdrop-blur-sm">
                                                                    {getPromotionIcon(promo.promotion_type)}
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-lg font-bold">{displayText}</h4>
                                                                    {promo.promotion_type === 'free_after_n_visits' &&
                                                                        typeof params.visit_count === 'number' && (
                                                                        <p className="text-sm text-white/90 mt-1">
                                                                            {t(
                                                                                'promotions.details.freeAfterN',
                                                                                'Каждая {n}-я услуга бесплатно',
                                                                            ).replace('{n}', String(params.visit_count))}
                                                                        </p>
                                                                    )}
                                                                    {(promo.promotion_type === 'first_visit_discount' ||
                                                                        promo.promotion_type === 'birthday_discount') &&
                                                                        typeof params.discount_percent === 'number' && (
                                                                            <p className="text-sm text-white/90 mt-1">
                                                                                {t(
                                                                                    'promotions.details.discount',
                                                                                    'Скидка {percent}%',
                                                                                ).replace(
                                                                                    '{percent}',
                                                                                    String(params.discount_percent),
                                                                                )}
                                                                            </p>
                                                                        )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {description && (
                                                            <p className="text-sm text-white/90 leading-relaxed">{description}</p>
                                                        )}

                                                        {(promo.valid_from || promo.valid_to) && (
                                                            <div className="pt-2 border-t border-white/20">
                                                                <p className="text-xs text-white/80">
                                                                    {String(t('promotions.validPeriod', 'Действует: {from} — {to}')
                                                                        .replace('{from}', promo.valid_from ? new Date(promo.valid_from).toLocaleDateString(locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU') : t('promotions.validPeriod.from', 'с начала'))
                                                                        .replace('{to}', promo.valid_to ? new Date(promo.valid_to).toLocaleDateString(locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU') : t('promotions.validPeriod.to', 'без ограничений')))}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Декоративные элементы */}
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 blur-xl"></div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Кнопки действий */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
                    <Link
                        href={`/b/${biz.slug}/booking`}
                        className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
                    >
                        {t('promotions.page.bookButton', 'Записаться сейчас')}
                        <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                    <Link
                        href={`/b/${biz.slug}`}
                        className="inline-flex items-center justify-center px-8 py-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-semibold rounded-xl border-2 border-gray-300 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-200 text-lg"
                    >
                        {t('promotions.page.backToBusiness', 'О бизнесе')}
                    </Link>
                </div>
            </div>
        </main>
    );
}


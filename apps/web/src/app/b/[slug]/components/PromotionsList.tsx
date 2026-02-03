'use client';

import type { Promotion } from '../types';

type PromotionsListProps = {
    promotions: Promotion[];
    t: (key: string, fallback?: string) => string;
};

export function PromotionsList({ promotions, t }: PromotionsListProps) {
    if (promotions.length === 0) return null;

    return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
            <h3 className="mb-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {t('booking.promotions.title', '🎁 Активные акции в этом филиале:')}
            </h3>
            <div className="space-y-2">
                {promotions.map((promotion) => {
                    const params = promotion.params || {};
                    let description = promotion.title_ru || '';
                    
                    if (promotion.promotion_type === 'free_after_n_visits' && params.visit_count) {
                        description = t('booking.promotions.freeAfterN', 'Каждая {n}-я услуга бесплатно').replace('{n}', String(params.visit_count));
                    } else if ((promotion.promotion_type === 'birthday_discount' || promotion.promotion_type === 'first_visit_discount' || promotion.promotion_type === 'referral_discount_50') && params.discount_percent) {
                        description = t('booking.promotions.discountPercent', 'Скидка {percent}%').replace('{percent}', String(params.discount_percent));
                    }
                    
                    return (
                        <div key={promotion.id} className="flex items-start gap-2 rounded-lg bg-white dark:bg-gray-900 px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-emerald-800 dark:text-emerald-200">{description}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


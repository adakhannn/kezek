/**
 * Компонент для отображения сводки бронирования
 * Вынесен из view.tsx для улучшения поддерживаемости
 */

'use client';

import type { Service, Staff } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { transliterate } from '@/lib/transliterate';


type BookingSummaryProps = {
    branchName: string | null;
    dayLabel: string | null;
    staffCurrent: Staff | null;
    serviceCurrent: Service | null;
    branchId: string | null;
    branchPromotions: Array<{
        id: string;
        title_ru: string | null;
        promotion_type: string;
        params: Record<string, unknown> | null;
    }>;
    isAuthed: boolean;
};

export function BookingSummary({
    branchName,
    dayLabel,
    staffCurrent,
    serviceCurrent,
    branchId,
    branchPromotions,
    isAuthed,
}: BookingSummaryProps) {
    const { t, locale } = useLanguage();

    const formatStaffName = (name: string): string => {
        if (locale === 'en') {
            return transliterate(name);
        }
        return name;
    };

    return (
        <aside className="sticky top-4 h-fit rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('booking.summary.title', 'Сводка бронирования')}
            </h2>
            <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('booking.summary.branch', 'Филиал:')}</span>
                    <span className="text-right font-medium">{branchName || t('booking.summary.notSelected', 'Не выбран')}</span>
                </div>
                <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('booking.summary.service', 'Услуга:')}</span>
                    <span className="text-right font-medium">
                        {serviceCurrent
                            ? locale === 'en' && serviceCurrent.name_en
                                ? serviceCurrent.name_en
                                : locale === 'ky' && serviceCurrent.name_ky
                                ? serviceCurrent.name_ky
                                : locale === 'en'
                                ? transliterate(serviceCurrent.name_ru)
                                : serviceCurrent.name_ru
                            : t('booking.summary.notSelected', 'Не выбран')}
                    </span>
                </div>
                <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('booking.summary.master', 'Мастер:')}</span>
                    <div className="flex items-center gap-2">
                        {staffCurrent?.avatar_url ? (
                            <img
                                src={staffCurrent.avatar_url}
                                alt={formatStaffName(staffCurrent.full_name)}
                                className="h-8 w-8 rounded-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        ) : staffCurrent ? (
                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                                {formatStaffName(staffCurrent.full_name).charAt(0).toUpperCase()}
                            </div>
                        ) : null}
                        <span className="text-right font-medium">
                            {staffCurrent ? formatStaffName(staffCurrent.full_name) : t('booking.summary.notSelected', 'Не выбран')}
                        </span>
                    </div>
                </div>
                <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('booking.summary.day', 'День:')}</span>
                    <span className="text-right font-medium">{dayLabel || t('booking.summary.notSelected', 'Не выбран')}</span>
                </div>
                <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('booking.summary.time', 'Время:')}</span>
                    <span className="text-right font-medium">
                        {t('booking.summary.selectSlot', 'Выберите слот')}
                    </span>
                </div>
                {serviceCurrent?.price_from && (
                    <div className="mt-1 flex justify-between gap-2 border-t border-dashed border-gray-300 pt-1 dark:border-gray-700">
                        <span className="text-gray-500">{t('booking.summary.estimatedPrice', 'Ориентировочная стоимость:')}</span>
                        <span
                            className="text-right font-semibold text-emerald-600 dark:text-emerald-400"
                            data-testid="final-price"
                        >
                            {serviceCurrent.price_from}
                            {serviceCurrent.price_to &&
                            serviceCurrent.price_to !== serviceCurrent.price_from
                                ? `–${serviceCurrent.price_to}`
                                : ''}{' '}
                            {t('booking.currency', 'сом')}
                        </span>
                    </div>
                )}

                {/* Информация об акциях */}
                {branchId && branchPromotions.length > 0 && (
                    <div
                        className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40"
                        data-testid="promotions"
                    >
                        <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1">
                                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100 mb-1">
                                    {t('booking.summary.promotionWillApply', 'При оплате будет применена акция:')}
                                </p>
                                <ul className="space-y-1">
                                    {branchPromotions.map((promotion) => {
                                        const params = promotion.params || {};
                                        let description = promotion.title_ru || '';

                                        if (promotion.promotion_type === 'free_after_n_visits' && params.visit_count) {
                                            description = t('booking.promotions.freeAfterN', 'Каждая {n}-я услуга бесплатно').replace('{n}', String(params.visit_count));
                                        } else if ((promotion.promotion_type === 'birthday_discount' || promotion.promotion_type === 'first_visit_discount' || promotion.promotion_type === 'referral_discount_50') && params.discount_percent) {
                                            description = t('booking.promotions.discountPercent', 'Скидка {percent}%').replace('{percent}', String(params.discount_percent));
                                        }

                                        return (
                                            <li key={promotion.id} className="text-xs text-emerald-800 dark:text-emerald-200">
                                                • {description}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                {!isAuthed ? (
                    <span>{t('booking.needAuth', 'Для бронирования необходимо войти или зарегистрироваться. Нажмите кнопку «Войти» вверху страницы.')}</span>
                ) : (
                    <span>{t('booking.summary.selectSlotFirst', 'Выберите свободный слот для бронирования.')}</span>
                )}
            </div>
        </aside>
    );
}


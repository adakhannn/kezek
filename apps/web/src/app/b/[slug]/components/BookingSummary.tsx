/**
 * Компонент для отображения сводки бронирования
 * Вынесен из view.tsx для улучшения поддерживаемости
 */

'use client';

import type { Service, Staff } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { formatStaffName, getServiceName } from '@/lib/i18nHelpers';


type BookingSummaryProps = {
    branchName: string | null;
    dayLabel: string | null;
    staffCurrent: Staff | null;
    serviceCurrent: Service | null;
    /** При мультиселекте услуг — массив выбранных услуг для отображения и суммы цен */
    servicesSelected?: Service[];
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
    servicesSelected,
    branchId,
    branchPromotions,
    isAuthed,
}: BookingSummaryProps) {
    const { t, locale } = useLanguage();

    const formatName = (name: string): string => formatStaffName(name, locale);

    const hasMultiple = servicesSelected && servicesSelected.length > 0;
    const serviceLabel =
        hasMultiple
            ? null // показываем список ниже
            : serviceCurrent
                ? getServiceName(serviceCurrent, locale)
                : null;
    const totalPriceFrom =
        hasMultiple
            ? servicesSelected!.reduce((sum, s) => sum + (typeof s.price_from === 'number' ? s.price_from : 0), 0)
            : serviceCurrent?.price_from ?? 0;
    const totalPriceTo =
        hasMultiple
            ? servicesSelected!.reduce((sum, s) => sum + (typeof s.price_to === 'number' ? s.price_to : 0), 0)
            : serviceCurrent?.price_to ?? 0;
    const totalDurationMin = hasMultiple
        ? servicesSelected!.reduce((sum, s) => sum + s.duration_min, 0)
        : serviceCurrent?.duration_min ?? 0;
    const hasPrice = totalPriceFrom > 0 || totalPriceTo > 0;

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
                {hasMultiple ? (
                    <>
                        <div className="text-gray-500 font-medium">
                            {t('booking.summary.services', 'Услуги:')}
                        </div>
                        <ul className="space-y-1.5 pl-0 list-none">
                            {servicesSelected!.map((s) => {
                                const name = getServiceName(s, locale);
                                const priceFrom = typeof s.price_from === 'number' ? s.price_from : null;
                                const priceTo = typeof s.price_to === 'number' ? s.price_to : null;
                                const hasServicePrice = priceFrom != null || priceTo != null;
                                return (
                                    <li
                                        key={s.id}
                                        className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-dashed border-gray-200 pb-1 last:border-0 last:pb-0 dark:border-gray-700"
                                    >
                                        <span className="font-medium text-gray-800 dark:text-gray-200">
                                            {name}
                                        </span>
                                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                            {s.duration_min} {t('booking.duration.min', 'мин')}
                                            {hasServicePrice && (
                                                <>
                                                    {' · '}
                                                    {priceFrom ?? priceTo ?? 0}
                                                    {priceTo != null && priceTo !== (priceFrom ?? priceTo)
                                                        ? `–${priceTo}`
                                                        : ''}{' '}
                                                    {t('booking.currency', 'сом')}
                                                </>
                                            )}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="flex justify-between gap-2 border-t border-dashed border-gray-300 pt-1.5 dark:border-gray-700">
                            <span className="text-gray-500 font-medium">
                                {t('booking.summary.total', 'Всего:')}
                            </span>
                            <span
                                className="text-right font-semibold text-gray-900 dark:text-gray-100"
                                data-testid="final-price"
                            >
                                {totalDurationMin} {t('booking.duration.min', 'мин')}
                                {hasPrice && (
                                    <>
                                        {', '}
                                        {totalPriceFrom}
                                        {totalPriceTo > 0 && totalPriceTo !== totalPriceFrom
                                            ? `–${totalPriceTo}`
                                            : ''}{' '}
                                        {t('booking.currency', 'сом')}
                                    </>
                                )}
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="flex justify-between gap-2">
                        <span className="text-gray-500">{t('booking.summary.service', 'Услуга:')}</span>
                        <span className="text-right font-medium">
                            {serviceLabel ?? t('booking.summary.notSelected', 'Не выбран')}
                        </span>
                    </div>
                )}
                <div className="flex justify-between gap-2">
                    <span className="text-gray-500">{t('booking.summary.master', 'Мастер:')}</span>
                    <div className="flex items-center gap-2">
                        {staffCurrent?.avatar_url ? (
                            <img
                                src={staffCurrent.avatar_url}
                                alt={formatName(staffCurrent.full_name)}
                                className="h-8 w-8 rounded-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        ) : staffCurrent ? (
                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                                {formatName(staffCurrent.full_name).charAt(0).toUpperCase()}
                            </div>
                        ) : null}
                        <span className="text-right font-medium">
                            {staffCurrent ? formatName(staffCurrent.full_name) : t('booking.summary.notSelected', 'Не выбран')}
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
                {hasPrice && !hasMultiple && (
                    <div className="mt-1 flex justify-between gap-2 border-t border-dashed border-gray-300 pt-1 dark:border-gray-700">
                        <span className="text-gray-500">{t('booking.summary.estimatedPrice', 'Ориентировочная стоимость:')}</span>
                        <span
                            className="text-right font-semibold text-emerald-600 dark:text-emerald-400"
                            data-testid="final-price"
                        >
                            {totalPriceFrom}
                            {totalPriceTo > 0 && totalPriceTo !== totalPriceFrom
                                ? `–${totalPriceTo}`
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


/**
 * Компонент для выбора одной или нескольких услуг (мультиселект).
 * Клик по услуге добавляет/убирает её из выбора; отображаются суммарная длительность и диапазон цен.
 */

'use client';

import { useMemo } from 'react';

import { BookingEmptyState } from '../BookingEmptyState';
import type { Service } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getServiceName } from '@/lib/i18nHelpers';

type ServiceSelectorProps = {
    services: Service[];
    selectedServiceIds: string[];
    onToggle: (serviceId: string) => void;
    staffId: string | null;
};

export function ServiceSelector({
    services,
    selectedServiceIds,
    onToggle,
    staffId,
}: ServiceSelectorProps) {
    const { t, locale } = useLanguage();

    const formatServiceName = (service: Service): string => getServiceName(service, locale);

    const selectedSet = useMemo(
        () => new Set(selectedServiceIds),
        [selectedServiceIds],
    );

    const { totalDurationMin, totalPriceFrom, totalPriceTo } = useMemo(() => {
        let duration = 0;
        let from = 0;
        let to = 0;
        for (const s of services) {
            if (!selectedSet.has(s.id)) continue;
            duration += s.duration_min;
            if (typeof s.price_from === 'number') from += s.price_from;
            if (typeof s.price_to === 'number') to += s.price_to;
        }
        return {
            totalDurationMin: duration,
            totalPriceFrom: from,
            totalPriceTo: to,
        };
    }, [services, selectedSet]);

    if (!staffId) {
        return (
            <BookingEmptyState
                type="info"
                message={t('booking.empty.selectMasterFirst', 'Сначала выберите мастера.')}
            />
        );
    }

    if (services.length === 0) {
        return (
            <BookingEmptyState
                type="empty"
                message={t('booking.empty.noServices', 'У выбранного мастера пока нет назначенных услуг. Выберите другого мастера.')}
            />
        );
    }

    return (
        <>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                {t('booking.step4.hint', 'Можно выбрать несколько услуг за один визит. Нажмите на услугу, чтобы добавить или убрать.')}
            </p>
            <div className="flex flex-col gap-2">
                {services.map((s) => {
                    const selected = selectedSet.has(s.id);
                    const hasRange =
                        typeof s.price_from === 'number' &&
                        (typeof s.price_to === 'number'
                            ? s.price_to !== s.price_from
                            : false);
                    return (
                        <button
                            key={s.id}
                            type="button"
                            data-testid="service-card"
                            data-selected={selected}
                            onClick={() => onToggle(s.id)}
                            className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                                selected
                                    ? 'border-indigo-600 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60'
                                    : 'border-gray-200 bg-white hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                            }`}
                        >
                            <div className="flex items-start gap-2">
                                <span
                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                        selected
                                            ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500'
                                            : 'border-gray-300 dark:border-gray-600'
                                    }`}
                                    aria-hidden
                                >
                                    {selected ? (
                                        <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    ) : null}
                                </span>
                                <div>
                                    <div
                                        className="font-semibold text-gray-900 dark:text-gray-100"
                                        data-testid="service-option"
                                    >
                                        {formatServiceName(s)}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                        {s.duration_min} {t('booking.duration.min', 'мин')}
                                    </div>
                                </div>
                            </div>
                            {(typeof s.price_from === 'number' ||
                                typeof s.price_to === 'number') && (
                                <div className="whitespace-nowrap text-right text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    {s.price_from}
                                    {hasRange && s.price_to != null ? `–${s.price_to}` : ''}{' '}
                                    {t('booking.currency', 'сом')}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
            {selectedServiceIds.length > 0 && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
                    <div className="font-medium text-gray-700 dark:text-gray-300">
                        {t('booking.step4.total', 'Всего')}: {totalDurationMin} {t('booking.duration.min', 'мин')}
                        {(totalPriceFrom > 0 || totalPriceTo > 0) && (
                            <>
                                {' · '}
                                {totalPriceFrom}
                                {totalPriceTo !== totalPriceFrom && totalPriceTo > 0
                                    ? `–${totalPriceTo}`
                                    : ''}{' '}
                                {t('booking.currency', 'сом')}
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * Компонент для выбора услуги
 * Вынесен из view.tsx для улучшения поддерживаемости
 */

'use client';

import { BookingEmptyState } from '../BookingEmptyState';
import type { Service } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { transliterate } from '@/lib/transliterate';


type ServiceSelectorProps = {
    services: Service[];
    selectedServiceId: string;
    onSelect: (serviceId: string) => void;
    staffId: string | null;
};

export function ServiceSelector({ services, selectedServiceId, onSelect, staffId }: ServiceSelectorProps) {
    const { t, locale } = useLanguage();

    const formatServiceName = (service: Service): string => {
        if (locale === 'en' && service.name_en) {
            return service.name_en;
        }
        if (locale === 'ky' && service.name_ky) {
            return service.name_ky;
        }
        if (locale === 'en') {
            return transliterate(service.name_ru);
        }
        return service.name_ru;
    };

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
            <button
                type="button"
                data-testid="service-select"
                className="mb-3 inline-flex items-center rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
            >
                {t('booking.testIds.serviceSelect', 'Выбрать услугу')}
            </button>
            <div className="flex flex-col gap-2">
                {services.map((s) => {
                    const active = s.id === selectedServiceId;
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
                            onClick={() => onSelect(s.id)}
                            className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                                active
                                    ? 'border-indigo-600 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60'
                                    : 'border-gray-200 bg-white hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                            }`}
                        >
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
                            {(typeof s.price_from === 'number' ||
                                typeof s.price_to === 'number') && (
                                <div className="whitespace-nowrap text-right text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    {s.price_from}
                                    {hasRange && s.price_to ? `–${s.price_to}` : ''}{' '}
                                    {t('booking.currency', 'сом')}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </>
    );
}


'use client';

import { useMemo } from 'react';

import { BookingEmptyState } from '../BookingEmptyState';
import type { Service } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Badge } from '@/components/ui/Badge';
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
    const selectedSet = useMemo(() => new Set(selectedServiceIds), [selectedServiceIds]);

    const { totalDurationMin, totalPriceFrom, totalPriceTo } = useMemo(() => {
        let duration = 0;
        let from = 0;
        let to = 0;

        for (const service of services) {
            if (!selectedSet.has(service.id)) continue;
            duration += service.duration_min;
            if (typeof service.price_from === 'number') from += service.price_from;
            if (typeof service.price_to === 'number') to += service.price_to;
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
                title={t('booking.empty.selectMasterFirstTitle', 'Сначала нужен специалист')}
                message={t('booking.empty.selectMasterFirst', 'Сначала выберите мастера, и система покажет только доступные для него услуги.')}
            />
        );
    }

    if (services.length === 0) {
        return (
            <BookingEmptyState
                type="empty"
                title={t('booking.empty.noServicesTitle', 'Для этого специалиста нет услуг')}
                message={t('booking.empty.noServices', 'У выбранного мастера пока нет назначенных услуг. Выберите другого мастера.')}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-3">
                <p className="type-caption text-[var(--text-secondary)]">
                    {t('booking.step4.hint', 'Можно выбрать несколько услуг за один визит. Нажмите на услугу, чтобы добавить или убрать её.')}
                </p>
            </div>

            <div className="grid gap-3">
                {services.map((service) => {
                    const selected = selectedSet.has(service.id);
                    const hasRange =
                        typeof service.price_from === 'number' &&
                        typeof service.price_to === 'number' &&
                        service.price_to !== service.price_from;

                    return (
                        <button
                            key={service.id}
                            type="button"
                            data-testid="service-card"
                            data-selected={selected}
                            onClick={() => onToggle(service.id)}
                            className={[
                                'flex w-full items-start justify-between gap-3 rounded-[22px] border px-4 py-4 text-left transition-all',
                                selected
                                    ? 'border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] shadow-[var(--shadow-sm)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--accent-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)]',
                            ].join(' ')}
                        >
                            <div className="flex min-w-0 items-start gap-3">
                                <span
                                    className={[
                                        'mt-1 inline-flex h-5 w-5 items-center justify-center rounded border',
                                        selected
                                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                                            : 'border-[var(--border-default)] bg-[var(--surface-base)] text-transparent',
                                    ].join(' ')}
                                    aria-hidden="true"
                                >
                                    ✓
                                </span>
                                <div className="min-w-0">
                                    <div className="type-label text-[var(--text-primary)]" data-testid="service-option">
                                        {formatServiceName(service)}
                                    </div>
                                    <div className="type-caption mt-1 text-[var(--text-secondary)]">
                                        {service.duration_min} {t('booking.duration.min', 'мин')}
                                    </div>
                                    <div className="mt-2">
                                        <Badge variant={selected ? 'accent' : 'neutral'}>
                                            {selected
                                                ? t('booking.step4.selected', 'Добавлено в визит')
                                                : t('booking.step4.available', 'Можно выбрать')}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {(typeof service.price_from === 'number' || typeof service.price_to === 'number') ? (
                                <div className="whitespace-nowrap text-right">
                                    <div className="type-label text-[var(--status-success)]">
                                        {service.price_from ?? service.price_to ?? 0}
                                        {hasRange && service.price_to != null ? `–${service.price_to}` : ''}{' '}
                                        {t('booking.currency', 'сом')}
                                    </div>
                                    <div className="type-caption text-[var(--text-muted)]">
                                        {t('booking.step4.priceHint', 'ориентировочно')}
                                    </div>
                                </div>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            {selectedServiceIds.length > 0 ? (
                <div className="rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-3">
                    <div className="type-label text-[var(--text-primary)]">
                        {t('booking.step4.total', 'Всего')}: {totalDurationMin} {t('booking.duration.min', 'мин')}
                        {(totalPriceFrom > 0 || totalPriceTo > 0) ? (
                            <>
                                {' · '}
                                {totalPriceFrom}
                                {totalPriceTo !== totalPriceFrom && totalPriceTo > 0 ? `–${totalPriceTo}` : ''}{' '}
                                {t('booking.currency', 'сом')}
                            </>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

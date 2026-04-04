'use client';

import type { Service, Staff } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Card } from '@/components/ui/Card';
import { formatStaffName, getServiceName } from '@/lib/i18nHelpers';

type BookingSummaryProps = {
    branchName: string | null;
    dayLabel: string | null;
    staffCurrent: Staff | null;
    serviceCurrent: Service | null;
    servicesSelected?: Service[];
    branchId: string | null;
    branchPromotions: Array<{
        id: string;
        title_ru: string | null;
        promotion_type: string;
        params: Record<string, unknown> | null;
    }>;
    isAuthed: boolean;
    step: number;
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
    step,
}: BookingSummaryProps) {
    const { t, locale } = useLanguage();

    const formatName = (name: string): string => formatStaffName(name, locale);
    const hasMultiple = Boolean(servicesSelected && servicesSelected.length > 0);
    const selectedServices = servicesSelected ?? [];
    const serviceLabel = hasMultiple ? null : serviceCurrent ? getServiceName(serviceCurrent, locale) : null;

    const totalPriceFrom = hasMultiple
        ? selectedServices.reduce((sum, service) => sum + (typeof service.price_from === 'number' ? service.price_from : 0), 0)
        : serviceCurrent?.price_from ?? 0;
    const totalPriceTo = hasMultiple
        ? selectedServices.reduce((sum, service) => sum + (typeof service.price_to === 'number' ? service.price_to : 0), 0)
        : serviceCurrent?.price_to ?? 0;
    const totalDurationMin = hasMultiple
        ? selectedServices.reduce((sum, service) => sum + service.duration_min, 0)
        : serviceCurrent?.duration_min ?? 0;
    const hasPrice = totalPriceFrom > 0 || totalPriceTo > 0;

    const statusItems = [
        { label: t('booking.summary.branch', 'Филиал'), value: branchName, done: Boolean(branchName) },
        {
            label: hasMultiple ? t('booking.summary.services', 'Услуги') : t('booking.summary.service', 'Услуга'),
            value: hasMultiple ? `${selectedServices.length} выбрано` : serviceLabel,
            done: hasMultiple ? selectedServices.length > 0 : Boolean(serviceLabel),
        },
        {
            label: t('booking.summary.master', 'Специалист'),
            value: staffCurrent ? formatName(staffCurrent.full_name) : null,
            done: Boolean(staffCurrent),
        },
        { label: t('booking.summary.day', 'День'), value: dayLabel, done: Boolean(dayLabel) },
        {
            label: t('booking.summary.time', 'Время'),
            value: step >= 5 ? t('booking.summary.selectSlot', 'Выберите слот') : t('booking.summary.pending', 'Откроется позже'),
            done: false,
        },
    ];

    return (
        <aside className="space-y-4 lg:sticky lg:top-28">
            <Card variant="elevated" padding="lg" className="overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="type-label text-[var(--accent-primary)]">
                            {t('booking.summary.badge', 'Понятная сводка выбора')}
                        </p>
                        <h2 className="type-section-title mt-2 text-[var(--text-primary)]">
                            {t('booking.summary.title', 'Сводка бронирования')}
                        </h2>
                    </div>
                    <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
                        {`Шаг ${step}`}
                    </div>
                </div>

                <div className="mt-5 grid gap-3">
                    {statusItems.map((item) => (
                        <div
                            key={item.label}
                            className="flex items-start gap-3 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-3"
                        >
                            <span
                                className={[
                                    'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px]',
                                    item.done
                                        ? 'border-[var(--status-success)] bg-[var(--status-success)] text-[var(--text-inverse)]'
                                        : 'border-[var(--border-default)] bg-[var(--surface-emphasis)] text-[var(--text-muted)]',
                                ].join(' ')}
                                aria-hidden="true"
                            >
                                {item.done ? '✓' : '•'}
                            </span>
                            <div className="min-w-0">
                                <div className="type-caption text-[var(--text-muted)]">{item.label}</div>
                                <div className="type-label mt-1 text-[var(--text-primary)]">
                                    {item.value ?? t('booking.summary.notSelected', 'Не выбран')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {hasMultiple ? (
                    <div className="mt-5 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4">
                        <div className="type-label text-[var(--text-primary)]">
                            {t('booking.summary.services', 'Услуги')}
                        </div>
                        <ul className="mt-3 space-y-2">
                            {selectedServices.map((service) => {
                                const name = getServiceName(service, locale);
                                const priceFrom = typeof service.price_from === 'number' ? service.price_from : null;
                                const priceTo = typeof service.price_to === 'number' ? service.price_to : null;

                                return (
                                    <li
                                        key={service.id}
                                        className="flex items-start justify-between gap-3 rounded-[18px] bg-[var(--surface-card)] px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <div className="type-label text-[var(--text-primary)]">{name}</div>
                                            <div className="type-caption mt-1 text-[var(--text-secondary)]">
                                                {service.duration_min} {t('booking.duration.min', 'мин')}
                                            </div>
                                        </div>
                                        {(priceFrom != null || priceTo != null) ? (
                                            <div className="type-caption whitespace-nowrap text-[var(--status-success)]">
                                                {priceFrom ?? priceTo ?? 0}
                                                {priceTo != null && priceTo !== (priceFrom ?? priceTo) ? `–${priceTo}` : ''}{' '}
                                                {t('booking.currency', 'сом')}
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ) : null}

                {(staffCurrent || hasPrice) ? (
                    <div className="mt-5 rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4">
                        <div className="type-label text-[var(--text-primary)]">
                            {t('booking.summary.estimatedVisit', 'Ожидаемый визит')}
                        </div>
                        <div className="mt-3 grid gap-2">
                            {staffCurrent ? (
                                <div className="flex items-center gap-3">
                                    {staffCurrent.avatar_url ? (
                                        <img
                                            src={staffCurrent.avatar_url}
                                            alt={formatName(staffCurrent.full_name)}
                                            className="h-10 w-10 rounded-full object-cover"
                                            onError={(event) => {
                                                event.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="type-label flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--text-muted)]">
                                            {formatName(staffCurrent.full_name).charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <div className="type-label text-[var(--text-primary)]">
                                            {formatName(staffCurrent.full_name)}
                                        </div>
                                        <div className="type-caption text-[var(--text-secondary)]">
                                            {t('booking.summary.specialistHint', 'Специалист уже выбран для следующего шага')}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {(totalDurationMin > 0 || hasPrice) ? (
                                <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--surface-card)] px-3 py-2">
                                    <span className="type-caption text-[var(--text-secondary)]">
                                        {t('booking.summary.total', 'Итого')}
                                    </span>
                                    <span className="type-label text-[var(--text-primary)]" data-testid="final-price">
                                        {totalDurationMin > 0 ? `${totalDurationMin} ${t('booking.duration.min', 'мин')}` : ''}
                                        {totalDurationMin > 0 && hasPrice ? ', ' : ''}
                                        {hasPrice
                                            ? `${totalPriceFrom}${totalPriceTo > 0 && totalPriceTo !== totalPriceFrom ? `–${totalPriceTo}` : ''} ${t('booking.currency', 'сом')}`
                                            : ''}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {branchId && branchPromotions.length > 0 ? (
                    <div className="mt-5">
                        <AlertBanner
                            variant="success"
                            title={t('booking.summary.promotionWillApply', 'На выбранный филиал уже есть акции')}
                            message={branchPromotions
                                .map((promotion) => getPromotionDescription(promotion, t))
                                .join(' · ')}
                        />
                    </div>
                ) : null}
            </Card>

            <AlertBanner
                variant={isAuthed ? 'info' : 'warning'}
                title={
                    isAuthed
                        ? t('booking.summary.nextActionTitle', 'Финальный шаг')
                        : t('booking.summary.authTitle', 'Нужна авторизация или гостевая запись')
                }
                message={
                    isAuthed
                        ? t('booking.summary.selectSlotFirst', 'Выберите свободный слот, и система продолжит подтверждение записи.')
                        : t('booking.needAuth', 'Для бронирования понадобится вход или продолжение как гость после выбора слота.')
                }
            />
        </aside>
    );
}

function getPromotionDescription(
    promotion: {
        title_ru: string | null;
        promotion_type: string;
        params: Record<string, unknown> | null;
    },
    t: (key: string, fallback?: string) => string,
) {
    const params = promotion.params || {};

    if (promotion.promotion_type === 'free_after_n_visits' && params.visit_count) {
        return t('booking.promotions.freeAfterN', 'Каждая {n}-я услуга бесплатно').replace('{n}', String(params.visit_count));
    }

    if (
        (promotion.promotion_type === 'birthday_discount' ||
            promotion.promotion_type === 'first_visit_discount' ||
            promotion.promotion_type === 'referral_discount_50') &&
        params.discount_percent
    ) {
        return t('booking.promotions.discountPercent', 'Скидка {percent}%').replace('{percent}', String(params.discount_percent));
    }

    return promotion.title_ru || t('booking.summary.promotionFallback', 'Доступно специальное предложение');
}

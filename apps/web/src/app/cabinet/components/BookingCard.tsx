// apps/web/src/app/cabinet/components/BookingCard.tsx
'use client';

import {formatInTimeZone} from 'date-fns-tz';
import {useState, useEffect, useRef} from 'react';

import MapDialog from './MapDialog';
import ReviewDialog from './ReviewDialog';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusChip } from '@/components/ui/StatusChip';
import { ToastContainer } from '@/components/ui/Toast';
import { buttonStyles } from '@/components/ui/buttonStyles';
import { useToast } from '@/hooks/useToast';
import { getTimezone } from '@/lib/env';
import {logError} from '@/lib/log';
import { transliterate } from '@/lib/transliterate';

const TZ = getTimezone();

export default function BookingCard({
                                        bookingId,
                                        status,
                                        start_at,
                                        end_at,
                                        service,
                                        servicesList,
                                        staff,
                                        branch,
                                        business,
                                        serviceId,
                                        staffId,
                                        branchId,
                                        bizId,
                                        canCancel,
                                        review: initialReview,
                                        promotionApplied,
                                        subscriptionApplied,
                                    }: {
    bookingId: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    start_at: string;
    end_at: string;
    service: { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number } | null;
    /** Full list of visit services (for service bundles); when absent, treat as single-service visit. */
    servicesList?: { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }[];
    staff: { id: string; full_name: string } | null;
    branch: { id: string; name: string; lat: number | null; lon: number | null; address: string | null } | null;
    business: { id: string; name: string; slug: string } | null;
    serviceId?: string | null;
    staffId?: string | null;
    branchId?: string | null;
    bizId?: string | null;
    canCancel: boolean;
    review?: { id: string; rating: number; comment: string | null } | null;
    promotionApplied?: Record<string, unknown> | null;
    subscriptionApplied?: Record<string, unknown> | null;
}) {
    const [showMap, setShowMap] = useState(false);
    const [openReview, setOpenReview] = useState(false);
    const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [review, setReview] = useState(initialReview);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { t, locale } = useLanguage();
    const toast = useToast();

    const getServiceName = (svc: typeof service): string => {
        if (!svc) return t('cabinet.bookings.card.service', 'Service');
        if (locale === 'ky' && svc.name_ky) return svc.name_ky;
        if (locale === 'en' && svc.name_en) return svc.name_en;
        return svc.name_ru;
    };

    const formatStaffName = (name: string | null | undefined): string => {
        if (!name) return t('cabinet.bookings.card.masterNotSet', 'Master is not assigned');
        if (locale === 'en') return transliterate(name);
        return name;
    };

    const effectiveServiceId = serviceId ?? service?.id ?? null;
    const effectiveStaffId = staffId ?? staff?.id ?? null;
    const effectiveBranchId = branchId ?? branch?.id ?? null;
    const effectiveBizId = bizId ?? business?.id ?? null;

    function repeatBooking() {
        if (!business) return;
        try {
            if (typeof window !== 'undefined' && effectiveBizId && effectiveBranchId && effectiveServiceId && effectiveStaffId) {
                const key = `booking_state_${effectiveBizId}`;
                const dayStr = formatInTimeZone(new Date(start_at), TZ, 'yyyy-MM-dd');
                const payload = {
                    branchId: effectiveBranchId,
                    serviceId: effectiveServiceId,
                    staffId: effectiveStaffId,
                    day: dayStr,
                    step: 4,
                };
                window.localStorage.setItem(key, JSON.stringify(payload));
            }
        } catch (e) {
            logError('BookingCard', 'repeatBooking: failed to save state', e);
        }
        window.location.href = `/b/${business.slug}`;
    }

    useEffect(() => {
        setReview(initialReview);
    }, [initialReview]);

    useEffect(() => {
        return () => {
            if (reloadTimeoutRef.current) {
                clearTimeout(reloadTimeoutRef.current);
            }
        };
    }, []);

    async function cancelBooking() {
        setBusy(true);
        try {
            const response = await fetch('/api/bookings/' + bookingId + '/cancel', {
                method: 'POST',
            });
            const payload = await response.json();

            if (!payload.ok) {
                toast.showError(
                    payload.error ||
                        t(
                            'cabinet.bookings.card.cancelError',
                            'Failed to cancel booking',
                        ),
                );
                return;
            }

            setConfirmCancelOpen(false);
            location.reload();
        } finally {
            setBusy(false);
        }
    }

    const localeMap: Record<string, string> = {
        ky: 'ru-KG',
        ru: 'ru-RU',
        en: 'en-US',
    };
    
    const dateFormatter = new Intl.DateTimeFormat(localeMap[locale] || 'ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TZ,
    });
    
    const timeFormatter = new Intl.DateTimeFormat(localeMap[locale] || 'ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TZ,
    });
    
    const startDate = new Date(start_at);
    const endDate = new Date(end_at);
    const when = `${dateFormatter.format(startDate)} - ${timeFormatter.format(endDate)}`;

    const totalDurationMin =
        servicesList && servicesList.length > 0
            ? servicesList.reduce((sum, s) => sum + (s.duration_min || 0), 0)
            : service?.duration_min ?? 0;
    const hasMultipleServices = servicesList && servicesList.length > 1;
    const canLeaveReview = !canCancel && !review && status !== 'cancelled';
    const canEditReview = !canCancel && !!review && status !== 'cancelled';
    const canRepeatBooking = !!(service && business);
    const hasLocation = !!(business?.name || branch?.name || branch?.address);
    const hasMapCoordinates = branch?.lat != null && branch?.lon != null;

    const statusLabels = {
        hold: t('cabinet.bookings.card.status.hold', 'Pending confirmation'),
        confirmed: t('cabinet.bookings.card.status.confirmed', 'Confirmed'),
        paid: t('cabinet.bookings.card.status.paid', 'Paid'),
        cancelled: t('cabinet.bookings.card.status.cancelled', 'Cancelled'),
    };

    const statusOrder: Record<typeof status, number> = {
        hold: 1,
        confirmed: 2,
        paid: 3,
        cancelled: 3,
    };

    const timelineSteps: Array<{
        key: 'created' | 'confirmed' | 'completed' | 'promo';
        label: string;
        done: boolean;
    }> = [
        {
            key: 'created',
            label: t('cabinet.bookings.timeline.created', 'Created'),
            done: true,
        },
        {
            key: 'confirmed',
            label: t('cabinet.bookings.timeline.confirmed', 'Confirmed'),
            done: statusOrder[status] >= 2,
        },
        {
            key: 'completed',
            label:
                status === 'cancelled'
                    ? t('cabinet.bookings.timeline.cancelled', 'Cancelled')
                    : t('cabinet.bookings.timeline.completed', 'Completed'),
            done: statusOrder[status] >= 3,
        },
        {
            key: 'promo',
            label: t('cabinet.bookings.timeline.promo', 'Promo applied'),
            done: !!(promotionApplied && status === 'paid'),
        },
    ];

    return (
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-md)] transition-all duration-[var(--motion-base)] hover:shadow-[var(--shadow-lg)] sm:p-6">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusChip status={status} label={statusLabels[status]} className="shrink-0" />
                        <span className="type-label rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-3 py-1.5 text-[var(--text-secondary)]">
                            #{bookingId.slice(0, 8)}
                        </span>
                        {promotionApplied ? (
                            <Badge variant="success" size="md">
                                {t('cabinet.bookings.timeline.promo', 'Promo applied')}
                            </Badge>
                        ) : null}
                        {subscriptionApplied ? (
                            <Badge variant="info" size="md">
                                {t('cabinet.bookings.card.paidWithPackage', 'Paid with package')}
                            </Badge>
                        ) : null}
                    </div>
                    <div className="space-y-2">
                        <h3 className="type-section-title text-[var(--text-primary)]">
                            {getServiceName(service)}
                        </h3>
                        <div className="type-body flex flex-wrap items-center gap-x-3 gap-y-2 text-[var(--text-secondary)]">
                            <span className="inline-flex items-center gap-2">
                                <svg className="h-4 w-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{when}</span>
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <svg className="h-4 w-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>{formatStaffName(staff?.full_name)}</span>
                            </span>
                        </div>
                        {hasLocation ? (
                            <div className="type-caption flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>
                                    {business?.name}
                                    {branch?.name ? ` • ${branch.name}` : ''}
                                    {branch?.address ? ` • ${branch.address}` : ''}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[18rem] lg:grid-cols-1">
                    <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4">
                        <p className="type-label text-[var(--text-muted)]">
                            {t('cabinet.bookings.card.summary.when', 'Date and time')}
                        </p>
                        <p className="type-body mt-2 font-medium text-[var(--text-primary)]">{dateFormatter.format(startDate)}</p>
                        <p className="type-caption mt-1 text-[var(--text-secondary)]">
                            {timeFormatter.format(startDate)} - {timeFormatter.format(endDate)} • {TZ}
                        </p>
                    </div>
                    <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4">
                        <p className="type-label text-[var(--text-muted)]">
                            {t('cabinet.bookings.card.summary.duration', 'Duration')}
                        </p>
                        <p className="type-body mt-2 font-medium text-[var(--text-primary)]">
                            {totalDurationMin} {t('booking.duration.min', 'мин')}
                        </p>
                        <p className="type-caption mt-1 text-[var(--text-secondary)]">
                            {hasMultipleServices
                                ? t('cabinet.bookings.card.servicesList.title', 'Services in visit')
                                : t('cabinet.bookings.card.service', 'Service')}
                        </p>
                    </div>
                    <div className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4">
                        <p className="type-label text-[var(--text-muted)]">
                            {t('cabinet.bookings.card.summary.nextAction', 'Next action')}
                        </p>
                        <p className="type-body mt-2 font-medium text-[var(--text-primary)]">
                            {canCancel
                                ? t('cabinet.bookings.card.actions.cancel', 'Cancel')
                                : canLeaveReview
                                    ? t('cabinet.bookings.card.actions.review', 'Leave review')
                                    : canEditReview
                                        ? t('cabinet.bookings.card.actions.editReviewShort', 'Edit review')
                                        : t('cabinet.bookings.card.actions.repeat', 'Repeat')}
                        </p>
                        <p className="type-caption mt-1 text-[var(--text-secondary)]">
                            {status === 'cancelled'
                                ? t('cabinet.bookings.timeline.cancelled', 'Cancelled')
                                : status === 'paid'
                                    ? t('cabinet.bookings.timeline.completed', 'Completed')
                                    : statusLabels[status]}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mb-4 rounded-[20px] border border-[var(--border-subtle)] bg-[color:color-mix(in_srgb,var(--surface-card)_88%,var(--surface-page))] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="type-label text-[var(--text-secondary)]">
                        {t('cabinet.bookings.card.progress', 'Booking progress')}
                    </p>
                    <span className="type-caption text-[var(--text-muted)]">{statusLabels[status]}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                    {timelineSteps.map((step) => (
                        <div
                            key={step.key}
                            className={`rounded-[16px] border px-3 py-3 ${
                                step.done
                                    ? 'border-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)]'
                                    : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                                        step.done
                                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                                            : 'border-[var(--border-default)] text-[var(--text-muted)]'
                                    }`}
                                >
                                    {step.done ? (
                                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l3 3 7-7" />
                                        </svg>
                                    ) : (
                                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                    )}
                                </div>
                                <span className="type-label text-[var(--text-primary)]">{step.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {promotionApplied && typeof promotionApplied === 'object' && 'promotion_type' in promotionApplied && (
                <div className="mb-3 rounded-lg border border-[color:color-mix(in_srgb,var(--status-success)_30%,transparent)] bg-[var(--status-success-soft)] px-3 py-2">
                    <div className="flex items-start gap-2">
                        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--status-success)]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                            <p className="type-label mb-1 text-[var(--status-success)]">
                                {t('cabinet.bookings.card.promotionApplied', 'Applied promotion:')}
                            </p>
                            <p className="type-caption text-[color:color-mix(in_srgb,var(--status-success)_86%,var(--text-primary))]">
                                {String(promotionApplied.promotion_title || promotionApplied.promotion_type || '')}
                                {('discount_percent' in promotionApplied && promotionApplied.discount_percent) ? ` - ${String(promotionApplied.discount_percent)}%` : ''}
                                {('final_amount' in promotionApplied && promotionApplied.final_amount) ? (
                                    <span className="ml-2 font-semibold">
                                        {t('cabinet.bookings.card.finalAmount', 'Final amount:')} {String(promotionApplied.final_amount)} {t('booking.currency', 'som')}
                                    </span>
                                ) : null}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {subscriptionApplied && typeof subscriptionApplied === 'object' && ('plan_id' in subscriptionApplied || 'plan_name_ru' in subscriptionApplied || 'promotion_title' in subscriptionApplied) && (() => {
                const name = String((subscriptionApplied as Record<string, unknown>).plan_name_ru ?? (subscriptionApplied as Record<string, unknown>).promotion_title ?? '');
                const finalAmount = (subscriptionApplied as Record<string, unknown>).final_amount;
                return (
                    <div className="mb-3 rounded-lg border border-[color:color-mix(in_srgb,var(--status-info)_30%,transparent)] bg-[var(--status-info-soft)] px-3 py-2">
                        <div className="flex items-start gap-2">
                            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--status-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <div className="flex-1">
                                <p className="type-label text-[var(--status-info)]">
                                    {t('cabinet.bookings.card.paidWithPackage', 'Paid with package')}: "{name}"
                                    {finalAmount != null && (
                                        <span className="ml-2 font-semibold text-[color:color-mix(in_srgb,var(--status-info)_86%,var(--text-primary))]">
                                            {t('cabinet.bookings.card.finalAmount', 'Final amount:')} {String(finalAmount)} {t('booking.currency', 'som')}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {hasMultipleServices && servicesList ? (
                <div className="mb-4 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="type-label text-[var(--text-secondary)]">
                            {t('cabinet.bookings.card.servicesList.title', 'Services in visit')}
                        </p>
                        <span className="type-caption text-[var(--text-muted)]">
                            {t('cabinet.bookings.card.totalDuration', 'Total:')} {totalDurationMin} {t('booking.duration.min', 'min')}
                        </span>
                    </div>
                    <ul className="mt-3 grid gap-2">
                        {servicesList.map((s) => (
                            <li
                                key={s.id}
                                className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2"
                            >
                                <span className="type-body font-medium text-[var(--text-primary)]">
                                    {getServiceName(s as typeof service)}
                                </span>
                                <span className="type-caption text-[var(--text-muted)]">
                                    {s.duration_min} {t('booking.duration.min', 'min')}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {review && status !== 'cancelled' && (
                <div className="mb-4 rounded-lg border border-[color:color-mix(in_srgb,var(--status-success)_30%,transparent)] bg-[var(--status-success-soft)] p-3">
                    <div className="flex items-start gap-2">
                        <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--status-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <svg
                                            key={i}
                                            className={`h-4 w-4 ${i < review.rating ? 'fill-current text-[var(--status-warning)]' : 'text-[var(--text-muted)]/55'}`}
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    ))}
                                </div>
                                <span className="type-body font-medium text-[var(--text-primary)]">
                                    {t('cabinet.bookings.card.review.title', 'Your review: {rating}*').replace('{rating}', String(review.rating))}
                                </span>
                            </div>
                            {review.comment && (
                                <p className="type-body mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">{review.comment}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4">
                <div className="flex flex-wrap gap-2">
                    {canRepeatBooking ? (
                        <Button
                            type="button"
                            onClick={repeatBooking}
                            size="md"
                            leadingIcon={
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            }
                        >
                            {t('cabinet.bookings.card.actions.repeat', 'Повторить')}
                        </Button>
                    ) : null}

                    <a
                        className={buttonStyles({ variant: 'secondary', size: 'md' })}
                        href={`/booking/${bookingId}`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>{t('cabinet.bookings.card.actions.open', 'Открыть')}</span>
                    </a>

                    <Button
                        type="button"
                        variant="outline"
                        size="md"
                        onClick={() => setShowMap(true)}
                        disabled={!hasMapCoordinates}
                        leadingIcon={
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        }
                    >
                        {t('cabinet.bookings.card.actions.onMap', 'На карте')}
                    </Button>

                    {canLeaveReview ? (
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            disabled={reviewSubmitting}
                            onClick={() => {
                                setReviewSubmitting(true);
                                setOpenReview(true);
                            }}
                            leadingIcon={
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                            }
                        >
                            {t('cabinet.bookings.card.actions.review', 'Оставить отзыв')}
                        </Button>
                    ) : null}

                    {canEditReview ? (
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => setOpenReview(true)}
                            leadingIcon={
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            }
                        >
                            {t('cabinet.bookings.card.actions.editReview', 'Редактировать отзыв ({rating}★)').replace('{rating}', String(review?.rating ?? ''))}
                        </Button>
                    ) : null}

                    {canCancel ? (
                        <Button
                            type="button"
                            variant="danger"
                            size="md"
                            disabled={busy}
                            onClick={() => setConfirmCancelOpen(true)}
                            leadingIcon={
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            }
                        >
                            {busy ? t('cabinet.bookings.card.actions.cancelling', 'Отмена...') : t('cabinet.bookings.card.actions.cancel', 'Отменить')}
                        </Button>
                    ) : null}
                </div>
            </div>

            {showMap && (
                <MapDialog
                    open={showMap}
                    onClose={() => setShowMap(false)}
                    lat={branch?.lat ?? null}
                    lon={branch?.lon ?? null}
                    title={`${business?.name ?? ''} - ${branch?.name ?? ''}`}
                    address={branch?.address ?? ''}
                />
            )}

            {openReview && (
                <ReviewDialog
                    bookingId={bookingId}
                    onClose={() => {
                        setOpenReview(false);
                        setReviewSubmitting(false);
                    }}
                    existingReview={review || null}
                    onReviewCreated={(newReview) => {
                        setReview(newReview);
                        setOpenReview(false);
                        setReviewSubmitting(false);
                        if (reloadTimeoutRef.current) {
                            clearTimeout(reloadTimeoutRef.current);
                        }
                        reloadTimeoutRef.current = setTimeout(() => {
                            window.location.reload();
                        }, 300);
                    }}
                />
            )}
            <ConfirmDialog
                open={confirmCancelOpen}
                onClose={() => setConfirmCancelOpen(false)}
                onConfirm={cancelBooking}
                title={t('cabinet.bookings.card.cancelConfirmTitle', 'Cancel booking?')}
                message={t('cabinet.bookings.card.cancelConfirm', 'Are you sure you want to cancel this booking?')}
                confirmLabel={t('cabinet.bookings.card.actions.cancel', 'Cancel booking')}
                cancelLabel={t('common.cancel', 'Back')}
                confirmVariant="danger"
                isLoading={busy}
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}


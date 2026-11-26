import { ScrollView, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import OfflineBanner from '../../components/ui/OfflineBanner';
import { useLanguage, type Locale } from '../../i18n';
import { formatDate, formatTime } from '../../utils/format';
import { getStatusColor, getStatusText } from '../../utils/i18n';
import { styles } from './bookingDetailsStyles';
import type { BookingDetails, TimelineStep } from './types';

type Props = {
    booking: BookingDetails;
    timelineSteps: TimelineStep[];
    canCancel: boolean;
    isCancelling: boolean;
    canReschedule: boolean;
    /** Started: only the business can cancel or reschedule now (R25-10). */
    startedNotice: boolean;
    benefitRescheduleNotice: boolean;
    primaryPhone: string | null;
    onRepeat: () => void;
    onCancel: () => void;
    onReschedule: () => void;
    onCall: () => void;
    onWhatsApp: () => void;
    /** A master or manager reads the booking (B1): no client actions. */
    isStaffView?: boolean;
    /** The details are the cabinet's offline copy saved then (B4). */
    offlineSavedAt?: string | null;
    onRetry?: () => void;
    canReview?: boolean;
    onReview?: () => void;
    canShowMap?: boolean;
    onShowMap?: () => void;
    onDirections?: () => void;
};

type ServiceName = { name_ru: string; name_ky?: string | null; name_en?: string | null };

function localizedServiceName(service: ServiceName, locale: Locale): string {
    if (locale === 'ky' && service.name_ky) return service.name_ky;
    if (locale === 'en' && service.name_en) return service.name_en;
    return service.name_ru;
}

export function BookingDetailsSections({
    booking,
    timelineSteps,
    canCancel,
    isCancelling,
    canReschedule,
    startedNotice,
    benefitRescheduleNotice,
    primaryPhone,
    onRepeat,
    onCancel,
    onReschedule,
    onCall,
    onWhatsApp,
    isStaffView = false,
    offlineSavedAt = null,
    onRetry,
    canReview = false,
    onReview,
    canShowMap = false,
    onShowMap,
    onDirections,
}: Props) {
    const { t, locale } = useLanguage();
    const tz = booking.business?.tz;
    const services = booking.services ?? [];
    const promotion = booking.promotion ?? null;
    const visitPackage = booking.package ?? null;
    const finalAmount = promotion?.final_amount ?? visitPackage?.final_amount ?? null;
    const review = booking.review ?? null;
    const isOffline = !!offlineSavedAt;

    return (
        <ScrollView style={styles.container} testID="booking-details-screen">
            {isOffline ? (
                <OfflineBanner
                    title={t('cabinet.details.offline.title')}
                    message={t('cabinet.details.offline.message', {
                        date: `${formatDate(offlineSavedAt, locale)} • ${formatTime(offlineSavedAt)}`,
                    })}
                    onRetry={onRetry}
                    style={[styles.card, styles.banner]}
                />
            ) : null}

            <Card style={styles.card}>
                <View style={styles.header}>
                    <Text style={styles.serviceName}>
                        {services.length > 1
                            ? services.map((item) => localizedServiceName(item, locale)).join(' + ')
                            : booking.service?.name_ru || t('cabinet.ui.serviceFallback')}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(booking.status, locale)}</Text>
                    </View>
                </View>

                {isStaffView ? (
                    <View style={styles.section} testID="booking-details-client">
                        <Text style={styles.label}>{t('cabinet.details.client')}</Text>
                        <Text style={styles.value}>{booking.client_name || t('cabinet.details.clientFallback')}</Text>
                    </View>
                ) : null}

                {booking.business && (
                    <View style={styles.section}>
                        <Text style={styles.label}>{t('cabinet.details.business')}</Text>
                        <Text style={styles.value}>{booking.business.name}</Text>
                        {booking.business.phones && booking.business.phones.length > 0 && (
                            <Text style={styles.phone}>{booking.business.phones[0]}</Text>
                        )}
                    </View>
                )}

                {booking.staff && (
                    <View style={styles.section}>
                        <Text style={styles.label}>{t('cabinet.details.staff')}</Text>
                        <Text style={styles.value}>{booking.staff.full_name}</Text>
                    </View>
                )}

                {booking.branch && (
                    <View style={styles.section}>
                        <Text style={styles.label}>{t('cabinet.details.branch')}</Text>
                        <Text style={styles.value}>{booking.branch.name}</Text>
                        {booking.branch.address && <Text style={styles.address}>{booking.branch.address}</Text>}
                        {canShowMap && onShowMap && onDirections ? (
                            <View style={styles.mapRow}>
                                <Button
                                    title={t('cabinet.details.showOnMap')}
                                    onPress={onShowMap}
                                    variant="outline"
                                    size="sm"
                                    style={styles.mapButton}
                                />
                                <Button
                                    title={t('cabinet.details.directions')}
                                    onPress={onDirections}
                                    variant="outline"
                                    size="sm"
                                    style={styles.mapButton}
                                />
                            </View>
                        ) : null}
                    </View>
                )}

                {services.length > 1 ? (
                    <View style={styles.section} testID="booking-details-services">
                        <Text style={styles.label}>{t('cabinet.details.services')}</Text>
                        {services.map((item, index) => (
                            <Text key={`${item.name_ru}-${index}`} style={styles.serviceLine}>
                                {item.duration_min
                                    ? t('cabinet.details.serviceLine', {
                                          name: localizedServiceName(item, locale),
                                          minutes: item.duration_min,
                                      })
                                    : localizedServiceName(item, locale)}
                            </Text>
                        ))}
                    </View>
                ) : null}

                <View style={styles.timelineSection}>
                    <Text style={styles.label}>{t('cabinet.details.status')}</Text>
                    <View style={styles.timelineRow}>
                        {timelineSteps.map((step, index) => (
                            <View key={step.key} style={styles.timelineStep}>
                                <View style={[styles.timelineDot, step.done && styles.timelineDotDone]}>
                                    {step.done && <Text style={styles.timelineDotText}>✓</Text>}
                                </View>
                                <Text style={styles.timelineLabel}>{t(step.labelKey)}</Text>
                                {index < timelineSteps.length - 1 && <View style={styles.timelineConnector} />}
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>{t('cabinet.details.when')}</Text>
                    <Text style={styles.value}>{formatDate(booking.start_at, locale, tz)}</Text>
                    <Text style={styles.time}>
                        {formatTime(booking.start_at, tz)} - {formatTime(booking.end_at, tz)}
                    </Text>
                    {booking.service?.duration_min ? (
                        <Text style={styles.duration}>
                            {t('cabinet.details.duration', { minutes: booking.service.duration_min })}
                        </Text>
                    ) : null}
                </View>

                {booking.service && (booking.service.price_from || booking.service.price_to) ? (
                    <View style={styles.section}>
                        <Text style={styles.label}>{t('cabinet.details.price')}</Text>
                        <Text style={styles.price}>
                            {booking.service.price_from && booking.service.price_to
                                ? t('cabinet.details.priceRange', { from: booking.service.price_from, to: booking.service.price_to })
                                : booking.service.price_from
                                  ? t('cabinet.details.priceFrom', { from: booking.service.price_from })
                                  : booking.service.price_to
                                    ? t('cabinet.details.priceTo', { to: booking.service.price_to })
                                    : ''}
                        </Text>
                    </View>
                ) : null}

                {promotion || visitPackage ? (
                    <View style={styles.section} testID="booking-details-benefit">
                        <Text style={styles.label}>{t('cabinet.details.benefit')}</Text>
                        {promotion ? (
                            <Text style={styles.benefitLine}>
                                {promotion.title
                                    ? t('cabinet.details.promotion', { title: promotion.title })
                                    : t('cabinet.card.promotion')}
                                {promotion.discount_percent
                                    ? ` · ${t('cabinet.details.promotionDiscount', { percent: promotion.discount_percent })}`
                                    : ''}
                            </Text>
                        ) : null}
                        {visitPackage ? (
                            <Text style={styles.benefitLine}>
                                {visitPackage.name
                                    ? t('cabinet.details.paidWithPackageNamed', { name: visitPackage.name })
                                    : t('cabinet.details.paidWithPackage')}
                            </Text>
                        ) : null}
                        {finalAmount != null ? (
                            <Text style={styles.price}>{t('cabinet.details.finalAmount', { amount: finalAmount })}</Text>
                        ) : null}
                    </View>
                ) : null}

                {review && !isStaffView ? (
                    <View style={styles.section} testID="booking-details-review">
                        <Text style={styles.label}>{t('cabinet.review.yours', { rating: review.rating })}</Text>
                        <Text style={styles.value}>{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</Text>
                        {review.comment ? <Text style={styles.reviewText}>{review.comment}</Text> : null}
                    </View>
                ) : null}
            </Card>

            <View style={styles.actions}>
                {isStaffView ? (
                    <Text style={styles.notice} testID="booking-staff-view-notice">
                        {t('cabinet.details.staffViewNotice')}
                    </Text>
                ) : (
                    <Button title={t('cabinet.details.repeat')} onPress={onRepeat} style={styles.primaryAction} />
                )}

                {canReview && onReview ? (
                    <Button
                        title={t(review ? 'cabinet.review.edit' : 'cabinet.review.create')}
                        onPress={onReview}
                        variant="outline"
                        style={styles.primaryAction}
                    />
                ) : null}

                {canReschedule && (
                    <Button
                        title={t('cabinet.details.reschedule')}
                        onPress={onReschedule}
                        variant="outline"
                        style={styles.cancelButton}
                        disabled={isCancelling}
                    />
                )}

                {canCancel && (
                    <Button
                        title={t('cabinet.details.cancel')}
                        onPress={onCancel}
                        variant="outline"
                        style={styles.cancelButton}
                        loading={isCancelling}
                    />
                )}

                {startedNotice && (
                    <Text style={styles.notice} testID="booking-started-notice">
                        {t('cabinet.details.startedNotice')}
                    </Text>
                )}

                {benefitRescheduleNotice && <Text style={styles.notice}>{t('cabinet.details.benefitRescheduleNotice')}</Text>}

                {primaryPhone && !isStaffView && (
                    <View style={styles.contactRow}>
                        <Button
                            title={t('cabinet.details.call')}
                            onPress={onCall}
                            variant="outline"
                            style={styles.contactButton}
                        />
                        <Button
                            title={t('cabinet.details.whatsapp')}
                            onPress={onWhatsApp}
                            variant="outline"
                            style={styles.contactButton}
                        />
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

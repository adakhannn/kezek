import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import ActionBar from '../../components/ui/ActionBar';
import { StatusPill } from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import ListRow, { KeyValueRow, ListGroup } from '../../components/ui/ListRow';
import OfflineBanner from '../../components/ui/OfflineBanner';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import { formatDate, formatPhone, formatTime } from '../../utils/format';
import { getLocalizedText, getServiceName, getStatusText } from '../../utils/i18n';
import { bookingStatusTone } from '../cabinet/CabinetScreenSections';
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

/**
 * One booking under the "Запись" header: the visit (service, state, time) in the accent card, its
 * progress, the details as label – value rows, the place with the map, then the actions as rows;
 * "Повторить запись" is the sticky primary action of the client.
 */
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
    const promotionTitle = promotion
        ? getLocalizedText({ ru: promotion.title, ky: promotion.title_ky, en: promotion.title_en }, locale)
        : "";
    const visitPackage = booking.package ?? null;
    const finalAmount = promotion?.final_amount ?? visitPackage?.final_amount ?? null;
    const review = booking.review ?? null;
    const isOffline = !!offlineSavedAt;
    const businessPhone = booking.business?.phones?.[0] ?? null;
    const price = booking.service && (booking.service.price_from || booking.service.price_to)
        ? booking.service.price_from && booking.service.price_to
            ? t('cabinet.details.priceRange', { from: booking.service.price_from, to: booking.service.price_to })
            : booking.service.price_from
              ? t('cabinet.details.priceFrom', { from: booking.service.price_from })
              : t('cabinet.details.priceTo', { to: booking.service.price_to ?? '' })
        : null;
    const showReview = canReview && !!onReview;
    const showContacts = !!primaryPhone && !isStaffView;
    const hasActions = showReview || canReschedule || canCancel || showContacts;

    return (
        <Screen
            testID="booking-details-screen"
            // "Повторить запись" belongs to a visit that is over; an upcoming one is managed by its own actions.
            footer={isStaffView || canCancel || canReschedule ? undefined : (
                <ActionBar primary={{ title: t('cabinet.details.repeat'), onPress: onRepeat }} />
            )}
        >
            {isOffline ? (
                <OfflineBanner
                    title={t('cabinet.details.offline.title')}
                    message={t('cabinet.details.offline.message', {
                        date: `${formatDate(offlineSavedAt, locale)} • ${formatTime(offlineSavedAt)}`,
                    })}
                    onRetry={onRetry}
                    style={styles.banner}
                />
            ) : null}

            <Card variant="accent" padding="md" style={styles.hero}>
                <View style={styles.heroTop}>
                    <Text style={styles.serviceName}>
                        {services.length > 1
                            ? services.map((item) => getServiceName(item, locale)).join(' + ')
                            : getServiceName(booking.service, locale) || t('cabinet.ui.serviceFallback')}
                    </Text>
                    <StatusPill label={getStatusText(booking.status, locale)} tone={bookingStatusTone(booking.status)} />
                </View>
                <View style={styles.when}>
                    <Ionicons name="calendar-outline" size={18} color={colors.tone.accent.fg} />
                    <Text style={styles.date}>{formatDate(booking.start_at, locale, tz)}</Text>
                </View>
                <Text style={styles.time}>
                    {formatTime(booking.start_at, tz)}–{formatTime(booking.end_at, tz)}
                </Text>
                {booking.service?.duration_min ? (
                    <Text style={styles.duration}>
                        {t('cabinet.details.duration', { minutes: booking.service.duration_min })}
                    </Text>
                ) : null}
            </Card>

            <Section title={t('cabinet.details.status')}>
                <View style={styles.timelineRow}>
                    {timelineSteps.map((step, index) => (
                        <View key={step.key} style={styles.timelineStep}>
                            {index > 0 ? (
                                <View style={[styles.timelineConnector, step.done && styles.timelineConnectorDone]} />
                            ) : null}
                            <View style={[styles.timelineDot, step.done && styles.timelineDotDone]}>
                                {step.done ? <Ionicons name="checkmark" size={14} color={colors.text.light} /> : null}
                            </View>
                            <Text style={[styles.timelineLabel, step.done && styles.timelineLabelDone]}>{t(step.labelKey)}</Text>
                        </View>
                    ))}
                </View>
            </Section>

            <ListGroup>
                {isStaffView ? (
                    <View testID="booking-details-client">
                        <KeyValueRow label={t('cabinet.details.client')} value={booking.client_name || t('cabinet.details.clientFallback')} />
                    </View>
                ) : null}
                {booking.business ? (
                    <KeyValueRow label={t('cabinet.details.business')} value={booking.business.name} />
                ) : null}
                {businessPhone ? (
                    <KeyValueRow label={t('cabinet.profile.phone.label')} value={formatPhone(businessPhone)} />
                ) : null}
                {booking.staff ? (
                    <KeyValueRow label={t('cabinet.details.staff')} value={booking.staff.full_name} />
                ) : null}
                {price ? (
                    <KeyValueRow label={t('cabinet.details.price')} value={price} emphasis />
                ) : null}
            </ListGroup>

            {booking.branch ? (
                <Section title={t('cabinet.details.branch')}>
                    <ListGroup inset>
                        <ListRow
                            icon="location-outline"
                            title={booking.branch.name}
                            subtitle={booking.branch.address ?? undefined}
                            numberOfLines={2}
                        />
                        {canShowMap && onShowMap ? (
                            <ListRow icon="map-outline" iconTone="neutral" title={t('cabinet.details.showOnMap')} onPress={onShowMap} />
                        ) : null}
                        {canShowMap && onDirections ? (
                            <ListRow icon="navigate-outline" iconTone="neutral" title={t('cabinet.details.directions')} onPress={onDirections} />
                        ) : null}
                    </ListGroup>
                </Section>
            ) : null}

            {services.length > 1 ? (
                <Section title={t('cabinet.details.services')} testID="booking-details-services">
                    <ListGroup>
                        {services.map((item, index) => (
                            <View key={`${item.name_ru}-${index}`} style={styles.serviceRow}>
                                <Text style={styles.serviceLine}>
                                    {item.duration_min
                                        ? t('cabinet.details.serviceLine', {
                                              name: getServiceName(item, locale),
                                              minutes: item.duration_min,
                                          })
                                        : getServiceName(item, locale)}
                                </Text>
                            </View>
                        ))}
                    </ListGroup>
                </Section>
            ) : null}

            {promotion || visitPackage ? (
                <Section title={t('cabinet.details.benefit')} testID="booking-details-benefit">
                    <Card variant="plain" padding="md" style={styles.benefit}>
                        {promotion ? (
                            <View style={styles.benefitRow}>
                                <Ionicons name="pricetag-outline" size={16} color={colors.tone.success.fg} />
                                <Text style={styles.benefitLine}>
                                    {promotionTitle
                                        ? t('cabinet.details.promotion', { title: promotionTitle })
                                        : t('cabinet.card.promotion')}
                                    {promotion.discount_percent
                                        ? ` · ${t('cabinet.details.promotionDiscount', { percent: promotion.discount_percent })}`
                                        : ''}
                                </Text>
                            </View>
                        ) : null}
                        {visitPackage ? (
                            <View style={styles.benefitRow}>
                                <Ionicons name="ticket-outline" size={16} color={colors.tone.success.fg} />
                                <Text style={styles.benefitLine}>
                                    {visitPackage.name
                                        ? t('cabinet.details.paidWithPackageNamed', { name: visitPackage.name })
                                        : t('cabinet.details.paidWithPackage')}
                                </Text>
                            </View>
                        ) : null}
                        {finalAmount != null ? (
                            <Text style={styles.total}>{t('cabinet.details.finalAmount', { amount: finalAmount })}</Text>
                        ) : null}
                    </Card>
                </Section>
            ) : null}

            {review && !isStaffView ? (
                <Section title={t('cabinet.review.yours', { rating: review.rating })} testID="booking-details-review">
                    <Card variant="plain" padding="md" style={styles.review}>
                        <Text style={styles.stars}>{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</Text>
                        {review.comment ? <Text style={styles.reviewText}>{review.comment}</Text> : null}
                    </Card>
                </Section>
            ) : null}

            {isStaffView ? (
                <Notice text={t('cabinet.details.staffViewNotice')} testID="booking-staff-view-notice" />
            ) : null}
            {startedNotice ? (
                <Notice text={t('cabinet.details.startedNotice')} testID="booking-started-notice" />
            ) : null}
            {benefitRescheduleNotice ? <Notice text={t('cabinet.details.benefitRescheduleNotice')} /> : null}

            {hasActions ? (
                <ListGroup inset>
                    {showReview ? (
                        <ListRow
                            icon="star-outline"
                            iconTone="warning"
                            title={t(review ? 'cabinet.review.edit' : 'cabinet.review.create')}
                            onPress={onReview}
                        />
                    ) : null}
                    {canReschedule ? (
                        <ListRow
                            icon="calendar-outline"
                            title={t('cabinet.details.reschedule')}
                            onPress={onReschedule}
                            disabled={isCancelling}
                        />
                    ) : null}
                    {showContacts ? (
                        <ListRow icon="call-outline" iconTone="success" title={t('cabinet.details.call')} onPress={onCall} />
                    ) : null}
                    {showContacts ? (
                        <ListRow icon="logo-whatsapp" iconTone="success" title={t('cabinet.details.whatsapp')} onPress={onWhatsApp} />
                    ) : null}
                    {canCancel ? (
                        <ListRow
                            icon="close-circle-outline"
                            title={t('cabinet.details.cancel')}
                            onPress={onCancel}
                            disabled={isCancelling}
                            destructive
                            chevron={false}
                        />
                    ) : null}
                </ListGroup>
            ) : null}
        </Screen>
    );
}

function Notice({ text, testID }: { text: string; testID?: string }) {
    return (
        <View style={styles.notice} testID={testID}>
            <Ionicons name="information-circle-outline" size={18} color={colors.tone.info.fg} />
            <Text style={styles.noticeText}>{text}</Text>
        </View>
    );
}

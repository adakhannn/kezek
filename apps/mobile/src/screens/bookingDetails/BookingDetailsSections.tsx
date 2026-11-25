import { ScrollView, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useLanguage } from '../../i18n';
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
};

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
}: Props) {
    const { t, locale } = useLanguage();
    return (
        <ScrollView style={styles.container} testID="booking-details-screen">
            <Card style={styles.card}>
                <View style={styles.header}>
                    <Text style={styles.serviceName}>{booking.service?.name_ru || t('cabinet.ui.serviceFallback')}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(booking.status, locale)}</Text>
                    </View>
                </View>

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
                    </View>
                )}

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
                    <Text style={styles.value}>{formatDate(booking.start_at, locale, booking.business?.tz)}</Text>
                    <Text style={styles.time}>
                        {formatTime(booking.start_at, booking.business?.tz)} - {formatTime(booking.end_at, booking.business?.tz)}
                    </Text>
                    {booking.service?.duration_min && (
                        <Text style={styles.duration}>
                            {t('cabinet.details.duration', { minutes: booking.service.duration_min })}
                        </Text>
                    )}
                </View>

                {booking.service && (booking.service.price_from || booking.service.price_to) && (
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
                )}
            </Card>

            <View style={styles.actions}>
                <Button title={t('cabinet.details.repeat')} onPress={onRepeat} style={styles.primaryAction} />

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

                {primaryPhone && (
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

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { ListGroup } from '../../components/ui/ListRow';
import Section from '../../components/ui/Section';
import { colors } from '../../constants/colors';
import { space, typeScale } from '../../constants/theme';
import { useBooking } from '../../contexts/BookingContext';
import { useLanguage } from '../../i18n';
import { trackMobileEvent } from '../../lib/analytics';
import { RootStackParamList } from '../../navigation/types';
import { getServiceName } from '../../utils/i18n';
import { formatBookingPrice } from './bookingFormat';
import BookingLoadError from './BookingLoadError';
import { pickSelectedServices, summarizeServices } from './bookingSelection';
import { BookingContextLine, BookingOptionRow, BookingStepScreen, BookingStepSkeleton } from './BookingStepLayout';
import { useBookingStep2Services } from './useBookingStep2Services';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingStep2Service() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setServices, setServiceId, toggleServiceId } = useBooking();
    const { t } = useLanguage();
    const { servicesData, isLoading, hasError, isRetrying, retry } = useBookingStep2Services({
        bookingData,
        setServices,
        setServiceId,
    });
    const selectedServices = pickSelectedServices(servicesData ?? [], bookingData.serviceIds);
    const total = summarizeServices(selectedServices);
    const totalPrice = formatBookingPrice(total, t, { compact: true });
    const goBack = () => navigation.goBack();

    // Several services make one visit with one master (C3, web ServiceSelector).
    const handleSelectService = (serviceId: string) => {
        toggleServiceId(serviceId);
        if (bookingData.business?.id) {
            trackMobileEvent({
                eventType: 'booking_flow_step',
                bizId: bookingData.business.id,
                branchId: bookingData.branchId ?? undefined,
                metadata: { step: 'service' },
            });
        }
    };

    const handleNext = () => {
        if (selectedServices.length > 0) {
            navigation.navigate('BookingStep3Staff');
        }
    };

    const context = <BookingContextLine name={bookingData.business?.name} />;

    if (isLoading) {
        return (
            <BookingStepScreen step={2}>
                {context}
                <BookingStepSkeleton label={t('booking.step2.loading')} rows={5} />
            </BookingStepScreen>
        );
    }

    if (hasError) {
        return (
            <BookingStepScreen step={2}>
                {context}
                <BookingLoadError title={t('booking.error.loadServices')} onRetry={retry} retrying={isRetrying} />
            </BookingStepScreen>
        );
    }

    if (!servicesData || servicesData.length === 0) {
        return (
            <BookingStepScreen step={2}>
                {context}
                <EmptyState
                    icon="cut-outline"
                    title={t('booking.step2.emptyTitle')}
                    message={t('booking.step2.emptyMessage')}
                    compact
                    action={<Button title={t('booking.nav.back')} onPress={goBack} variant="outline" fullWidth />}
                />
            </BookingStepScreen>
        );
    }

    const summary = selectedServices.length > 1 ? (
        <View style={styles.total} accessibilityLiveRegion="polite">
            <Text style={styles.totalLabel}>
                {t('booking.step2.selectedCount', { count: selectedServices.length })}
            </Text>
            <Text style={styles.totalValue}>
                {[
                    total.durationMin > 0 ? t('booking.duration.minutes', { minutes: total.durationMin }) : null,
                    totalPrice,
                ]
                    .filter(Boolean)
                    .join(', ')}
            </Text>
        </View>
    ) : null;

    return (
        <BookingStepScreen
            step={2}
            back={goBack}
            next={{ title: t('booking.nav.next'), onPress: handleNext, disabled: selectedServices.length === 0 }}
            summary={summary}
        >
            {context}
            <Section
                title={t('booking.progress.service')}
                caption={servicesData.length > 1 ? t('booking.step2.multiHint') : undefined}
            >
                <ListGroup>
                    {servicesData.map((service) => (
                        <BookingOptionRow
                            key={service.id}
                            multiple
                            title={getServiceName(service, t.locale)}
                            value={formatBookingPrice(service, t, { compact: true })}
                            valueHint={service.duration_min
                                ? t('booking.duration.minutes', { minutes: service.duration_min })
                                : null}
                            selected={bookingData.serviceIds.includes(service.id)}
                            onPress={() => handleSelectService(service.id)}
                        />
                    ))}
                </ListGroup>
            </Section>
        </BookingStepScreen>
    );
}

const styles = StyleSheet.create({
    total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
    totalLabel: { ...typeScale.callout, color: colors.text.secondary },
    totalValue: { ...typeScale.bodyStrong, color: colors.text.primary, flexShrink: 1, textAlign: 'right' },
});

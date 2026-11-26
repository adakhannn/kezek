import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
import { useBooking } from '../../contexts/BookingContext';
import { useLanguage } from '../../i18n';
import { trackMobileEvent } from '../../lib/analytics';
import { RootStackParamList } from '../../navigation/types';
import { getServiceName } from '../../utils/i18n';
import { formatBookingPrice } from './bookingFormat';
import BookingLoadError from './BookingLoadError';
import { pickSelectedServices, summarizeServices } from './bookingSelection';
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

    if (isLoading) {
        return (
            <View style={styles.container}>
                <LoadingSpinner message={t('booking.step2.loading')} />
            </View>
        );
    }

    if (hasError) {
        return (
            <View style={styles.container}>
                <BookingProgressIndicator currentStep={2} />
                <View style={styles.header}>
                    <Text style={styles.title}>{bookingData.business?.name}</Text>
                </View>
                <View style={styles.section}>
                    <BookingLoadError title={t('booking.error.loadServices')} onRetry={retry} retrying={isRetrying} />
                </View>
            </View>
        );
    }

    if (!servicesData || servicesData.length === 0) {
        return (
            <View style={styles.container}>
                <BookingProgressIndicator currentStep={2} />
                <View style={styles.header}>
                    <Text style={styles.title}>{bookingData.business?.name}</Text>
                </View>
                <EmptyState
                    icon="cut-outline"
                    title={t('booking.step2.emptyTitle')}
                    message={t('booking.step2.emptyMessage')}
                    compact
                    style={styles.emptyContainer}
                />
            </View>
        );
    }

    return (
        <LinearGradient
            colors={[
                colors.background.gradient.from,
                colors.background.gradient.via,
                colors.background.gradient.to,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientContainer}
        >
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <BookingProgressIndicator currentStep={2} />
                <View style={styles.header}>
                    <Text style={styles.title}>{bookingData.business?.name}</Text>
                </View>

                <View style={styles.section}>
                    {servicesData.length > 1 ? (
                        <Text style={styles.hint}>{t('booking.step2.multiHint')}</Text>
                    ) : null}
                    <View style={styles.optionsList}>
                        {servicesData.map((service) => {
                            const price = formatBookingPrice(service, t, { compact: true });
                            const isSelected = bookingData.serviceIds.includes(service.id);
                            return (
                                <MotionPressable
                                    key={service.id}
                                    style={[styles.serviceCard, isSelected && styles.serviceCardSelected]}
                                    onPress={() => handleSelectService(service.id)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: isSelected }}
                                >
                                    {isSelected ? (
                                        <LinearGradient
                                            colors={['rgba(79, 70, 229, 0.1)', 'rgba(79, 70, 229, 0.15)']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.serviceCardGradient}
                                        >
                                            <View style={styles.serviceHeader}>
                                                <View style={styles.serviceInfo}>
                                                    <Text style={styles.serviceNameSelected}>
                                                        {getServiceName(service, t.locale)}
                                                    </Text>
                                                    {service.duration_min ? (
                                                        <Text style={styles.serviceDurationSelected}>
                                                            {t('booking.duration.minutes', { minutes: service.duration_min })}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                {price ? (
                                                    <Text style={styles.priceTextSelected}>{price}</Text>
                                                ) : null}
                                            </View>
                                        </LinearGradient>
                                    ) : (
                                        <View style={styles.serviceCardContent}>
                                            <View style={styles.serviceHeader}>
                                                <View style={styles.serviceInfo}>
                                                    <Text style={styles.serviceName}>{getServiceName(service, t.locale)}</Text>
                                                    {service.duration_min ? (
                                                        <Text style={styles.serviceDuration}>
                                                            {t('booking.duration.minutes', { minutes: service.duration_min })}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                {price ? (
                                                    <Text style={styles.priceText}>{price}</Text>
                                                ) : null}
                                            </View>
                                        </View>
                                    )}
                                </MotionPressable>
                            );
                        })}
                    </View>

                    {selectedServices.length > 1 ? (
                        <View style={styles.totalRow} accessibilityLiveRegion="polite">
                            <Text style={styles.totalLabel}>
                                {t('booking.step2.selectedCount', { count: selectedServices.length })}
                            </Text>
                            <Text style={styles.totalValue}>
                                {[
                                    total.durationMin > 0
                                        ? t('booking.duration.minutes', { minutes: total.durationMin })
                                        : null,
                                    totalPrice,
                                ]
                                    .filter(Boolean)
                                    .join(', ')}
                            </Text>
                        </View>
                    ) : null}

                    <View style={styles.buttonContainer}>
                        <Button
                            title={t('booking.nav.back')}
                            onPress={() => navigation.goBack()}
                            variant="outline"
                            style={styles.backButton}
                        />
                        <Button
                            title={t('booking.nav.next')}
                            onPress={handleNext}
                            disabled={selectedServices.length === 0}
                            variant="primary"
                            style={styles.nextButton}
                        />
                    </View>
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        padding: 20,
        paddingTop: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
    },
    section: {
        padding: 20,
    },
    optionsList: {
        gap: 8,
    },
    hint: {
        fontSize: 13,
        color: colors.text.secondary,
        marginBottom: 12,
    },
    totalRow: {
        marginTop: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    totalLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.text.secondary,
    },
    totalValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        flexShrink: 1,
        textAlign: 'right',
    },
    serviceCard: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.background.secondary,
        overflow: 'hidden',
    },
    serviceCardSelected: {
        borderColor: colors.primary.from,
    },
    serviceCardGradient: {
        padding: 12,
    },
    serviceCardContent: {
        padding: 12,
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
    },
    serviceNameSelected: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 4,
    },
    serviceDuration: {
        fontSize: 11,
        color: colors.text.tertiary,
    },
    serviceDurationSelected: {
        fontSize: 11,
        color: colors.text.secondary,
    },
    priceText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.status.success,
        textAlign: 'right',
    },
    priceTextSelected: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.status.success,
        textAlign: 'right',
    },
    emptyContainer: {
        paddingHorizontal: 0,
    },
    buttonContainer: {
        marginTop: 24,
        paddingHorizontal: 0,
        flexDirection: 'row',
        gap: 12,
    },
    backButton: {
        flex: 1,
    },
    nextButton: {
        flex: 1,
    },
});

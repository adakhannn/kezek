import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { formatServicePrice } from '@shared-client/formatters';
import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';
import { useBookingStep2Services } from './useBookingStep2Services';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingStep2Service() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setServices, setServiceId } = useBooking();
    const { servicesData, isLoading } = useBookingStep2Services({
        bookingData,
        setServices,
        setServiceId,
    });

    const handleSelectService = (serviceId: string) => {
        setServiceId(serviceId);
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
        if (bookingData.serviceId) {
            navigation.navigate('BookingStep3Staff');
        }
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <LoadingSpinner message="Р—Р°РіСЂСѓР·РєР° СѓСЃР»СѓРі..." />
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
                    title="РќРµС‚ РґРѕСЃС‚СѓРїРЅС‹С… СѓСЃР»СѓРі"
                    message="Р”Р»СЏ РІС‹Р±СЂР°РЅРЅРѕРіРѕ С„РёР»РёР°Р»Р° РїРѕРєР° РЅРµС‚ Р°РєС‚РёРІРЅС‹С… СѓСЃР»СѓРі."
                    compact
                    style={styles.emptyContainer}
                />
            </View>
        );
    }

    return (
        <LinearGradient
            colors={[colors.background.gradient.from, colors.background.gradient.via, colors.background.gradient.to]}
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
                    <View style={styles.optionsList}>
                        {servicesData.map((service) => {
                            const price = formatServicePrice(service, 'СЃРѕРј');
                            const isSelected = bookingData.serviceId === service.id;
                            return (
                                <MotionPressable
                                    key={service.id}
                                    style={[styles.serviceCard, isSelected && styles.serviceCardSelected]}
                                    onPress={() => handleSelectService(service.id)}
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
                                                        {service.name_ru}
                                                    </Text>
                                                    {service.duration_min ? (
                                                        <Text style={styles.serviceDurationSelected}>
                                                            {service.duration_min} РјРёРЅ
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                {price ? (
                                                    <Text style={styles.priceTextSelected}>
                                                        {price.replace(' - ', 'вЂ“').replace('РѕС‚ ', '')}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        </LinearGradient>
                                    ) : (
                                        <View style={styles.serviceCardContent}>
                                            <View style={styles.serviceHeader}>
                                                <View style={styles.serviceInfo}>
                                                    <Text style={styles.serviceName}>{service.name_ru}</Text>
                                                    {service.duration_min ? (
                                                        <Text style={styles.serviceDuration}>
                                                            {service.duration_min} РјРёРЅ
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                {price ? (
                                                    <Text style={styles.priceText}>
                                                        {price.replace(' - ', 'вЂ“').replace('РѕС‚ ', '')}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        </View>
                                    )}
                                </MotionPressable>
                            );
                        })}
                    </View>

                    <View style={styles.buttonContainer}>
                        <Button
                            title="РќР°Р·Р°Рґ"
                            onPress={() => navigation.goBack()}
                            variant="outline"
                            style={styles.backButton}
                        />
                        <Button
                            title="Р”Р°Р»СЊС€Рµ"
                            onPress={handleNext}
                            disabled={!bookingData.serviceId}
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

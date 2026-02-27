import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { useBooking } from '../../contexts/BookingContext';
import { colors } from '../../constants/colors';
import Button from '../../components/ui/Button';
import BookingProgressIndicator from '../../components/BookingProgressIndicator';
import { RootStackParamList } from '../../navigation/types';
import { trackMobileEvent } from '../../lib/analytics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function BookingStep2Service() {
    const navigation = useNavigation<NavigationProp>();
    const { bookingData, setServices, setServiceId } = useBooking();

    const { data: servicesData, isLoading } = useQuery({
        queryKey: ['services', bookingData.business?.id, bookingData.branchId],
        queryFn: async () => {
            if (!bookingData.business?.id || !bookingData.branchId) return [];

            const { data, error } = await supabase
                .from('services')
                .select('id, name_ru, duration_min, price_from, price_to, branch_id')
                .eq('biz_id', bookingData.business.id)
                .eq('branch_id', bookingData.branchId)
                .eq('active', true)
                .order('name_ru');

            if (error) throw error;
            return data || [];
        },
        enabled: !!bookingData.business?.id && !!bookingData.branchId,
    });

    useEffect(() => {
        if (servicesData) {
            setServices(servicesData);
            if (servicesData.length === 1) {
                setServiceId(servicesData[0].id);
            }
        }
    }, [servicesData, setServices, setServiceId]);

    const formatPrice = (service: typeof servicesData[0]) => {
        if (service.price_from && service.price_to) {
            return `${service.price_from} - ${service.price_to} сом`;
        } else if (service.price_from) {
            return `от ${service.price_from} сом`;
        }
        return null;
    };

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
            // Навигация в BookingStep3Staff находится в RootStack
            (navigation as unknown as { navigate: (screen: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) => void }).navigate('BookingStep3Staff');
        }
    };

    if (isLoading) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Загрузка услуг...</Text>
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
                <View style={styles.emptyContainer}>
                    <Ionicons name="cut-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyText}>Нет доступных услуг</Text>
                </View>
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
                                const price = formatPrice(service);
                                const isSelected = bookingData.serviceId === service.id;
                                return (
                                    <TouchableOpacity
                                        key={service.id}
                                        style={[
                                            styles.serviceCard,
                                            isSelected && styles.serviceCardSelected,
                                        ]}
                                        onPress={() => handleSelectService(service.id)}
                                        activeOpacity={0.7}
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
                                                        {service.duration_min && (
                                                            <Text style={styles.serviceDurationSelected}>
                                                                {service.duration_min} мин
                                                            </Text>
                                                        )}
                                                    </View>
                                                    {price && (
                                                        <Text style={styles.priceTextSelected}>
                                                            {price.replace(' - ', '–').replace('от ', '')}
                                                        </Text>
                                                    )}
                                                </View>
                                            </LinearGradient>
                                        ) : (
                                            <View style={styles.serviceCardContent}>
                                                <View style={styles.serviceHeader}>
                                                    <View style={styles.serviceInfo}>
                                                        <Text style={styles.serviceName}>
                                                            {service.name_ru}
                                                        </Text>
                                                        {service.duration_min && (
                                                            <Text style={styles.serviceDuration}>
                                                                {service.duration_min} мин
                                                            </Text>
                                                        )}
                                                    </View>
                                                    {price && (
                                                        <Text style={styles.priceText}>
                                                            {price.replace(' - ', '–').replace('от ', '')}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {servicesData.length > 0 && (
                            <View style={styles.buttonContainer}>
                                <Button
                                    title="Назад"
                                    onPress={() => navigation.goBack()}
                                    variant="outline"
                                    style={styles.backButton}
                                />
                                <Button
                                    title="Дальше"
                                    onPress={handleNext}
                                    disabled={!bookingData.serviceId}
                                    variant="primary"
                                    style={styles.nextButton}
                                />
                            </View>
                        )}
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
    subtitle: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    loadingText: {
        textAlign: 'center',
        padding: 40,
        color: colors.text.secondary,
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
        color: '#10b981', // emerald-500
        textAlign: 'right',
    },
    priceTextSelected: {
        fontSize: 11,
        fontWeight: '600',
        color: '#10b981', // emerald-500
        textAlign: 'right',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
        color: colors.text.secondary,
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


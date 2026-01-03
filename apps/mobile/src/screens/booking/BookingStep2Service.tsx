import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../lib/supabase';
import { useBooking } from '../../contexts/BookingContext';

type NavigationProp = NativeStackNavigationProp<any>;

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
                setTimeout(() => {
                    // @ts-ignore
                    navigation.navigate('BookingStep3Staff');
                }, 300);
            }
        }
    }, [servicesData, setServices, setServiceId, navigation]);

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
        // @ts-ignore
        navigation.navigate('BookingStep3Staff');
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
                <View style={styles.header}>
                    <Text style={styles.title}>{bookingData.business?.name}</Text>
                    <Text style={styles.subtitle}>Шаг 2 из 5: Выберите услугу</Text>
                </View>
                <View style={styles.emptyContainer}>
                    <Ionicons name="cut-outline" size={48} color="#9ca3af" />
                    <Text style={styles.emptyText}>Нет доступных услуг</Text>
                </View>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.title}>{bookingData.business?.name}</Text>
                <Text style={styles.subtitle}>Шаг 2 из 5: Выберите услугу</Text>
            </View>

            <View style={styles.section}>
                <View style={styles.optionsList}>
                    {servicesData.map((service) => {
                        const price = formatPrice(service);
                        return (
                            <TouchableOpacity
                                key={service.id}
                                style={[
                                    styles.serviceCard,
                                    bookingData.serviceId === service.id && styles.serviceCardSelected,
                                ]}
                                onPress={() => handleSelectService(service.id)}
                            >
                                <View style={styles.serviceHeader}>
                                    <View style={styles.serviceInfo}>
                                        <Text
                                            style={[
                                                styles.serviceName,
                                                bookingData.serviceId === service.id && styles.serviceNameSelected,
                                            ]}
                                        >
                                            {service.name_ru}
                                        </Text>
                                        {service.duration_min && (
                                            <View style={styles.serviceMeta}>
                                                <Ionicons 
                                                    name="time-outline" 
                                                    size={16} 
                                                    color={bookingData.serviceId === service.id ? '#fff' : '#6b7280'} 
                                                />
                                                <Text
                                                    style={[
                                                        styles.serviceDuration,
                                                        bookingData.serviceId === service.id && styles.serviceDurationSelected,
                                                    ]}
                                                >
                                                    {service.duration_min} мин.
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    {bookingData.serviceId === service.id && (
                                        <Ionicons name="checkmark-circle" size={24} color="#fff" />
                                    )}
                                </View>
                                {price && (
                                    <View style={[
                                        styles.priceContainer,
                                        bookingData.serviceId === service.id && styles.priceContainerSelected
                                    ]}>
                                        <Text
                                            style={[
                                                styles.priceText,
                                                bookingData.serviceId === service.id && styles.priceTextSelected,
                                            ]}
                                        >
                                            {price}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
    },
    loadingText: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280',
    },
    section: {
        padding: 20,
    },
    optionsList: {
        gap: 12,
    },
    serviceCard: {
        padding: 20,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#e5e7eb',
    },
    serviceCardSelected: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    serviceNameSelected: {
        color: '#fff',
    },
    serviceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    serviceDuration: {
        fontSize: 14,
        color: '#6b7280',
    },
    serviceDurationSelected: {
        color: '#fff',
    },
    priceContainer: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    priceContainerSelected: {
        borderTopColor: 'rgba(255, 255, 255, 0.3)',
    },
    priceText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#059669',
    },
    priceTextSelected: {
        color: '#fff',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        fontSize: 16,
        color: '#6b7280',
    },
});

